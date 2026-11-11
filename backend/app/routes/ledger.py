from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GLAccount, JournalEntry, JournalLine
from app.schemas import (
    AccountCreate,
    AccountUpdate,
    AccountResponse,
    JournalCreate,
)

router = APIRouter(prefix="/api/gl", tags=["General Ledger"])


@router.post("/accounts", response_model=AccountResponse, status_code=201)
def create_account(data: AccountCreate, db: Session = Depends(get_db)):
    existing = db.query(GLAccount).filter(
        GLAccount.company_code == data.company_code,
        GLAccount.account_code == data.account_code,
    ).first()

    if existing:
        raise HTTPException(status_code=409, detail="Account already exists")

    account = GLAccount(**data.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)

    return account


@router.get("/accounts", response_model=list[AccountResponse])
def get_accounts(db: Session = Depends(get_db)):
    return db.query(GLAccount).order_by(GLAccount.account_code).all()


@router.get("/accounts/{account_id}", response_model=AccountResponse)
def get_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(GLAccount).filter(
        GLAccount.id == account_id
    ).first()

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    return account


@router.put("/accounts/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    data: AccountUpdate,
    db: Session = Depends(get_db),
):
    account = db.query(GLAccount).filter(
        GLAccount.id == account_id
    ).first()

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(account, field, value)

    db.commit()
    db.refresh(account)

    return account


@router.delete("/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(GLAccount).filter(
        GLAccount.id == account_id
    ).first()

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.journal_lines:
        raise HTTPException(
            status_code=409,
            detail="Account is used in journal entries; deactivate it instead",
        )

    db.delete(account)
    db.commit()

    return {"message": "Account deleted successfully"}


@router.post("/journal-entries", status_code=201)
def create_journal_entry(data: JournalCreate, db: Session = Depends(get_db)):
    account_ids = {line.account_id for line in data.lines}

    accounts = db.query(GLAccount).filter(
        GLAccount.id.in_(account_ids)
    ).all()

    account_map = {account.id: account for account in accounts}

    if len(account_map) != len(account_ids):
        raise HTTPException(status_code=400, detail="Invalid account ID")

    for account in accounts:
        if not account.is_active:
            raise HTTPException(
                status_code=400,
                detail=f"Account {account.account_code} is inactive",
            )

        if account.company_code != data.company_code:
            raise HTTPException(
                status_code=400,
                detail="Account company does not match journal company",
            )

    entry = JournalEntry(
        document_number=f"GL-{uuid4().hex[:12].upper()}",
        company_code=data.company_code,
        posting_date=data.posting_date,
        narration=data.narration,
        status="POSTED",
    )

    for line in data.lines:
        entry.lines.append(
            JournalLine(
                account_id=line.account_id,
                debit=line.debit,
                credit=line.credit,
            )
        )

    try:
        db.add(entry)
        db.commit()
        db.refresh(entry)
    except Exception:
        db.rollback()
        raise

    return {
        "message": "Journal entry posted successfully",
        "document_number": entry.document_number,
        "status": entry.status,
    }


@router.get("/journal-entries")
def get_journal_entries(db: Session = Depends(get_db)):
    entries = db.query(JournalEntry).order_by(
        JournalEntry.id.desc()
    ).all()

    return [
        {
            "id": entry.id,
            "document_number": entry.document_number,
            "company_code": entry.company_code,
            "posting_date": entry.posting_date,
            "narration": entry.narration,
            "status": entry.status,
            "lines": [
                {
                    "account_id": line.account_id,
                    "account_code": line.account.account_code,
                    "account_name": line.account.account_name,
                    "debit": str(line.debit),
                    "credit": str(line.credit),
                }
                for line in entry.lines
            ],
        }
        for entry in entries
    ]


@router.get("/ledger-report")
def get_ledger_report(
    account_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(JournalLine, JournalEntry, GLAccount)
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .join(GLAccount, JournalLine.account_id == GLAccount.id)
    )

    if account_id:
        query = query.filter(JournalLine.account_id == account_id)

    records = query.order_by(
        JournalEntry.posting_date.asc(),
        JournalEntry.id.asc(),
        JournalLine.id.asc(),
    ).all()

    account_balances = {}
    items = []

    for line, entry, account in records:
        acc_key = str(account.id)
        if acc_key not in account_balances:
            account_balances[acc_key] = Decimal("0.00")

        debit = Decimal(str(line.debit))
        credit = Decimal(str(line.credit))

        if account.account_type in ("ASSET", "EXPENSE"):
            account_balances[acc_key] += (debit - credit)
        else:
            account_balances[acc_key] += (credit - debit)

        items.append({
            "line_id": line.id,
            "entry_id": entry.id,
            "document_number": entry.document_number,
            "posting_date": str(entry.posting_date),
            "account_id": account.id,
            "account_code": account.account_code,
            "account_name": account.account_name,
            "account_type": account.account_type,
            "narration": entry.narration,
            "debit": str(line.debit),
            "credit": str(line.credit),
            "running_balance": str(account_balances[acc_key]),
        })

    return {
        "items": items,
        "account_balances": {
            k: str(v) for k, v in account_balances.items()
        },
    }
