# STACKLY FICO - General Ledger & GST Module

An enterprise Financial Accounting (FI) module built with FastAPI (Python) and Vanilla HTML5/CSS3/JavaScript.

## Features

- **Dashboard Overview:** Real-time metrics for General Ledger postings, running balances, GST invoices, and net tax liability.
- **General Ledger (GL):**
  - **Ledger Book & Statements:** Detailed account-level ledger transactions with running debit/credit balance calculations.
  - **Chart of Accounts:** Create, update, view, and manage GL accounts (Assets, Liabilities, Equity, Revenue, Expense).
  - **Journal Entries:** Balanced double-entry voucher posting with automatic debit/credit validation.
- **Goods and Services Tax (GST):**
  - **Tax Invoices Entry:** Support for Sales (Outward Supply) and Purchases (Inward Supply).
  - **Automatic Tax Breakdown:** Intra-State (CGST + SGST) and Inter-State (IGST) at standard rates (0%, 5%, 12%, 18%, 28%).
  - **Input Tax Credit (ITC) & Liability Summary:** Real-time computation of net tax payable or carry-forward credit.

## Tech Stack

- **Backend:** FastAPI, SQLAlchemy, PyMySQL / SQLite fallback, Pydantic v2
- **Frontend:** HTML5, Modern CSS3, Vanilla ES6 JavaScript
- **Database:** MySQL (default) or SQLite

## Setup Instructions

### 1. Backend Setup

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in `backend/` (or copy from `.env.example`):
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=fico_gl_dev
USE_SQLITE=false
```

Start the FastAPI backend:
```bash
uvicorn app.main:app --reload
```
API Documentation will be available at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup

Open `frontend/index.html` directly in your browser or serve it using VS Code Live Server (or any static HTTP server).
