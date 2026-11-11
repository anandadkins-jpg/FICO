from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AccountCreate(BaseModel):
    company_code: str = "1000"
    account_code: str = Field(min_length=1, max_length=20)
    account_name: str = Field(min_length=1, max_length=100)

    account_type: Literal[
        "ASSET", "LIABILITY", "EQUITY",
        "REVENUE", "EXPENSE"
    ]

    account_group: str = Field(min_length=1, max_length=50)


class AccountUpdate(BaseModel):
    account_name: str | None = Field(default=None, max_length=100)
    account_type: Literal[
        "ASSET", "LIABILITY", "EQUITY",
        "REVENUE", "EXPENSE"
    ] | None = None
    account_group: str | None = Field(default=None, max_length=50)
    is_active: bool | None = None


class AccountResponse(BaseModel):
    id: int
    company_code: str
    account_code: str
    account_name: str
    account_type: str
    account_group: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class JournalLineCreate(BaseModel):
    account_id: int
    debit: Decimal = Field(default=Decimal("0.00"), ge=0)
    credit: Decimal = Field(default=Decimal("0.00"), ge=0)

    @model_validator(mode="after")
    def validate_line(self):
        if (self.debit > 0) == (self.credit > 0):
            raise ValueError(
                "Enter either debit or credit for each line, not both."
            )
        return self


class JournalCreate(BaseModel):
    company_code: str = "1000"
    posting_date: date
    narration: str = Field(min_length=1)
    lines: list[JournalLineCreate] = Field(min_length=2)

    @model_validator(mode="after")
    def validate_totals(self):
        total_debit = sum(
            (line.debit for line in self.lines),
            Decimal("0.00")
        )
        total_credit = sum(
            (line.credit for line in self.lines),
            Decimal("0.00")
        )

        if total_debit != total_credit:
            raise ValueError(
                "Total debit must equal total credit."
            )

        return self


class GSTTransactionCreate(BaseModel):
    company_code: str = "1000"
    invoice_number: str = Field(min_length=1, max_length=50)
    invoice_date: date
    party_name: str = Field(min_length=1, max_length=100)
    gstin: str = Field(min_length=15, max_length=15)
    transaction_type: Literal["OUTWARD", "INWARD"]
    supply_type: Literal["INTRA_STATE", "INTER_STATE"] = "INTRA_STATE"
    hsn_sac: str | None = Field(default=None, max_length=20)
    taxable_amount: Decimal = Field(ge=0)
    gst_rate: Decimal = Field(ge=0)
    cgst_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    sgst_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    igst_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    total_amount: Decimal = Field(ge=0)


class GSTTransactionResponse(BaseModel):
    id: int
    company_code: str
    invoice_number: str
    invoice_date: date
    party_name: str
    gstin: str
    transaction_type: str
    supply_type: str
    hsn_sac: str | None
    taxable_amount: Decimal
    gst_rate: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    total_amount: Decimal

    model_config = ConfigDict(from_attributes=True)


class GSTSummaryResponse(BaseModel):
    total_outward_taxable: Decimal
    total_inward_taxable: Decimal
    total_output_cgst: Decimal
    total_output_sgst: Decimal
    total_output_igst: Decimal
    total_output_tax: Decimal
    total_itc_cgst: Decimal
    total_itc_sgst: Decimal
    total_itc_igst: Decimal
    total_input_tax_credit: Decimal
    net_gst_payable: Decimal
    total_transactions: int
