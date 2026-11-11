from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    Boolean,
    Text,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class GLAccount(Base):
    __tablename__ = "gl_accounts"

    __table_args__ = (
        UniqueConstraint(
            "company_code",
            "account_code",
            name="uq_gl_account_company_code",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    company_code = Column(
        String(10),
        nullable=False,
        default="1000",
        index=True,
    )

    account_code = Column(
        String(20),
        nullable=False,
    )

    account_name = Column(String(100), nullable=False)
    account_type = Column(String(30), nullable=False)
    account_group = Column(String(50), nullable=False)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    journal_lines = relationship(
        "JournalLine",
        back_populates="account",
    )


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)

    document_number = Column(
        String(30),
        unique=True,
        nullable=False,
        index=True,
    )

    company_code = Column(
        String(10),
        nullable=False,
        default="1000",
        index=True,
    )

    posting_date = Column(Date, nullable=False)
    narration = Column(Text, nullable=False)

    status = Column(
        String(20),
        nullable=False,
        default="POSTED",
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    lines = relationship(
        "JournalLine",
        back_populates="journal_entry",
        cascade="all, delete-orphan",
    )


class JournalLine(Base):
    __tablename__ = "journal_lines"

    __table_args__ = (
        CheckConstraint(
            "debit >= 0 AND credit >= 0",
            name="ck_journal_line_nonnegative_amounts",
        ),
        CheckConstraint(
            "(debit > 0 AND credit = 0) OR "
            "(credit > 0 AND debit = 0)",
            name="ck_journal_line_debit_or_credit",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    journal_entry_id = Column(
        Integer,
        ForeignKey("journal_entries.id"),
        nullable=False,
        index=True,
    )

    account_id = Column(
        Integer,
        ForeignKey("gl_accounts.id"),
        nullable=False,
        index=True,
    )

    debit = Column(
        Numeric(15, 2),
        nullable=False,
        default=0,
    )

    credit = Column(
        Numeric(15, 2),
        nullable=False,
        default=0,
    )

    journal_entry = relationship(
        "JournalEntry",
        back_populates="lines",
    )

    account = relationship(
        "GLAccount",
        back_populates="journal_lines",
    )


class GSTTransaction(Base):
    __tablename__ = "gst_transactions"

    id = Column(Integer, primary_key=True, index=True)

    company_code = Column(
        String(10),
        nullable=False,
        default="1000",
        index=True,
    )

    invoice_number = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    invoice_date = Column(Date, nullable=False)
    party_name = Column(String(100), nullable=False)
    gstin = Column(String(15), nullable=False)

    transaction_type = Column(
        String(20),
        nullable=False,  # "OUTWARD" or "INWARD"
        index=True,
    )

    supply_type = Column(
        String(20),
        nullable=False,
        default="INTRA_STATE",  # "INTRA_STATE" or "INTER_STATE"
    )

    hsn_sac = Column(String(20), nullable=True)

    taxable_amount = Column(
        Numeric(15, 2),
        nullable=False,
        default=0,
    )

    gst_rate = Column(
        Numeric(5, 2),
        nullable=False,
        default=18.00,
    )

    cgst_amount = Column(
        Numeric(15, 2),
        nullable=False,
        default=0,
    )

    sgst_amount = Column(
        Numeric(15, 2),
        nullable=False,
        default=0,
    )

    igst_amount = Column(
        Numeric(15, 2),
        nullable=False,
        default=0,
    )

    total_amount = Column(
        Numeric(15, 2),
        nullable=False,
        default=0,
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )
