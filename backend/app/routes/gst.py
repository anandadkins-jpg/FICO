from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GSTTransaction
from app.schemas import (
    GSTTransactionCreate,
    GSTTransactionResponse,
    GSTSummaryResponse,
)

router = APIRouter(prefix="/api/gst", tags=["GST"])


@router.post("/transactions", response_model=GSTTransactionResponse, status_code=201)
def create_gst_transaction(
    data: GSTTransactionCreate,
    db: Session = Depends(get_db),
):
    existing = db.query(GSTTransaction).filter(
        GSTTransaction.invoice_number == data.invoice_number
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Invoice number already exists",
        )

    transaction = GSTTransaction(**data.model_dump())
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


@router.get("/transactions", response_model=list[GSTTransactionResponse])
def get_gst_transactions(
    transaction_type: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(GSTTransaction)
    if transaction_type in ("OUTWARD", "INWARD"):
        query = query.filter(GSTTransaction.transaction_type == transaction_type)

    return query.order_by(
        GSTTransaction.invoice_date.desc(),
        GSTTransaction.id.desc(),
    ).all()


@router.get("/summary", response_model=GSTSummaryResponse)
def get_gst_summary(db: Session = Depends(get_db)):
    transactions = db.query(GSTTransaction).all()

    total_outward_taxable = Decimal("0.00")
    total_inward_taxable = Decimal("0.00")
    total_output_cgst = Decimal("0.00")
    total_output_sgst = Decimal("0.00")
    total_output_igst = Decimal("0.00")
    total_itc_cgst = Decimal("0.00")
    total_itc_sgst = Decimal("0.00")
    total_itc_igst = Decimal("0.00")

    for t in transactions:
        taxable = Decimal(str(t.taxable_amount or 0))
        cgst = Decimal(str(t.cgst_amount or 0))
        sgst = Decimal(str(t.sgst_amount or 0))
        igst = Decimal(str(t.igst_amount or 0))

        if t.transaction_type == "OUTWARD":
            total_outward_taxable += taxable
            total_output_cgst += cgst
            total_output_sgst += sgst
            total_output_igst += igst
        elif t.transaction_type == "INWARD":
            total_inward_taxable += taxable
            total_itc_cgst += cgst
            total_itc_sgst += sgst
            total_itc_igst += igst

    total_output_tax = total_output_cgst + total_output_sgst + total_output_igst
    total_input_tax_credit = total_itc_cgst + total_itc_sgst + total_itc_igst
    net_gst_payable = total_output_tax - total_input_tax_credit

    return GSTSummaryResponse(
        total_outward_taxable=total_outward_taxable,
        total_inward_taxable=total_inward_taxable,
        total_output_cgst=total_output_cgst,
        total_output_sgst=total_output_sgst,
        total_output_igst=total_output_igst,
        total_output_tax=total_output_tax,
        total_itc_cgst=total_itc_cgst,
        total_itc_sgst=total_itc_sgst,
        total_itc_igst=total_itc_igst,
        total_input_tax_credit=total_input_tax_credit,
        net_gst_payable=net_gst_payable,
        total_transactions=len(transactions),
    )


@router.delete("/transactions/{transaction_id}")
def delete_gst_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.query(GSTTransaction).filter(
        GSTTransaction.id == transaction_id
    ).first()

    if not transaction:
        raise HTTPException(
            status_code=404,
            detail="GST transaction not found",
        )

    db.delete(transaction)
    db.commit()
    return {"message": "GST transaction deleted successfully"}
