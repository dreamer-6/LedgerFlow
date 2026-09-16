# LedgerFlow
## Final Project Architecture, Working Flow, Authentication & Design System

> **LedgerFlow** is a business-owned Accounting & ERP OS designed around double-entry accounting, inventory, GST, outstanding management, reporting, auditability, and secure business data isolation.

---

## 1. Product Vision

LedgerFlow is **not an invoice generator**.

It is a complete business accounting operating system.

The central principle is:

```text
ONE BUSINESS TRANSACTION
        ↓
ONE VOUCHER
        ↓
ACCOUNTING EFFECT
+
INVENTORY EFFECT
+
GST EFFECT
+
OUTSTANDING EFFECT
+
AUDIT EFFECT
        ↓
REPORTS
```

The dashboard and reports are never the source of truth. Posted transactions are.

Every report must ultimately trace back to posted business transactions.

---

# 2. Core Accounting Principle

LedgerFlow follows **double-entry accounting**.

For every posted accounting voucher:

```text
TOTAL DEBIT = TOTAL CREDIT
```

A voucher must never be posted when:

```text
Debit != Credit
```

### Example: Credit Sale

```text
Customer A/c              DR ₹59,000
    Sales A/c                 CR ₹50,000
    Output CGST               CR ₹4,500
    Output SGST               CR ₹4,500
```

Debit:

```text
₹59,000
```

Credit:

```text
₹59,000
```

The accounting engine is the heart of LedgerFlow.

---

# 3. High-Level Architecture

```text
                    USER
                     │
                     ▼
              AUTHENTICATION
                     │
                     ▼
              BUSINESS CONTEXT
                     │
                     ▼
              FINANCIAL YEAR
                     │
                     ▼
               LEDGERFLOW UI
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
      MASTERS     VOUCHERS      REPORTS
                     │
                     ▼
              VALIDATION ENGINE
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    ACCOUNTING    INVENTORY       GST
      ENGINE        ENGINE       ENGINE
        │            │            │
        └────────────┼────────────┘
                     ▼
              POSTING ENGINE
                     │
                     ▼
                 DATABASE
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
      LEDGER       STOCK          TAX
      ENTRIES      MOVEMENTS      ENTRIES
        │            │            │
        └────────────┼────────────┘
                     ▼
                REPORT ENGINE
```

---

# 4. Technology Stack

## Frontend

- React
- TypeScript
- CSS / CSS Modules or equivalent component styling

## Backend

- Node.js
- Express
- TypeScript

## Database

First version:

- SQLite
- better-sqlite3

Architecture must allow future migration to:

- PostgreSQL

Business logic must not be tightly coupled to SQLite.

Frontend must never directly manipulate accounting database records.

---

# 5. Application Architecture

Use layered architecture:

```text
Presentation Layer
        ↓
API Layer
        ↓
Application / Service Layer
        ↓
Domain Layer
        ↓
Repository Layer
        ↓
Database
```

Suggested project structure:

```text
/ledgerflow
│
├── /frontend
│   ├── /components
│   ├── /layouts
│   ├── /pages
│   ├── /features
│   ├── /hooks
│   ├── /services
│   ├── /utils
│   └── /styles
│
├── /backend
│   ├── /api
│   ├── /middleware
│   ├── /controllers
│   ├── /services
│   ├── /repositories
│   └── /validators
│
├── /domain
│   ├── /accounting
│   ├── /inventory
│   ├── /gst
│   ├── /voucher
│   ├── /party
│   └── /reports
│
├── /database
│   ├── /migrations
│   ├── /seed
│   └── schema
│
├── /shared
│   ├── /types
│   ├── /constants
│   └── /utilities
│
├── /tests
│
└── /docs
```

---

# 6. Authentication Architecture

LedgerFlow must have:

- Sign Up
- Login
- Logout
- Password Reset
- Session Management
- User Profile
- Role Management
- Business Access Control

Authentication and authorization are separate.

### Authentication

> Who is the user?

### Authorization

> What can this user access?

---

# 7. Signup Flow

Signup establishes both:

```text
USER ACCOUNT
+
BUSINESS
```

Flow:

```text
SIGN UP
   ↓
ACCOUNT DETAILS
   ↓
BUSINESS DETAILS
   ↓
GST / TAX DETAILS
   ↓
FINANCIAL YEAR
   ↓
SYSTEM INITIALIZATION
   ↓
DASHBOARD
```

## Step 1: Account

- Full Name
- Email
- Phone
- Password
- Confirm Password

## Step 2: Business

- Business Name
- Business Type
- Address
- City
- State
- Pincode
- Phone
- Email

## Step 3: GST / Tax

- GST Registered?
- GSTIN
- Registration Type
- State
- Tax Preferences

## Step 4: Financial Year

Default:

```text
01 April → 31 March
```

Allow configuration where required.

---

# 8. Account Creation Transaction

When signup is completed:

```text
BEGIN TRANSACTION

Create User

Create Business

Create User-Business relationship

Create Financial Year

Create Default Ledger Groups

Create Default Ledgers

Create Default Units

Create Default Tax Configuration

Create Voucher Numbering Configuration

Create Default Settings

Create Audit Entry

COMMIT
```

If anything fails:

```text
ROLLBACK EVERYTHING
```

Never create a partially initialized business.

---

# 9. Login Flow

```text
LOGIN
  ↓
Find User
  ↓
Verify Password Hash
  ↓
Check User Status
  ↓
Create Secure Session
  ↓
Resolve Authorized Business
  ↓
Resolve Active Financial Year
  ↓
Load Business Context
  ↓
Open Dashboard
```

---

# 10. Business Data Isolation

Fundamental ownership model:

```text
USER
 ↓
BUSINESS
 ↓
FINANCIAL YEAR
 ↓
TRANSACTIONS
```

Core relationship:

```text
users
    ↓
user_businesses
    ↓
businesses
    ↓
financial_years
```

Every business-owned table must contain:

```text
business_id
```

Relevant transaction tables must additionally contain:

```text
financial_year_id
```

Example:

```text
LEDGERS

ledger_id
business_id
ledger_group_id
ledger_name
...
```

```text
VOUCHERS

voucher_id
business_id
financial_year_id
voucher_type
voucher_number
...
```

```text
STOCK ITEMS

item_id
business_id
...
```

Never trust a `business_id` supplied by the frontend.

The backend must determine the authorized business from the authenticated session.

---

# 11. Multi-Business Architecture

Version 1:

```text
One user
→ one active business
```

Architecture must support future:

```text
One user
→ multiple businesses
```

Example:

```text
Arun
│
├── DREAM TECH SOLUTIONS
│
└── Another Business
```

Changing business must change the complete business context.

Never mix:

- Ledgers
- Parties
- Stock
- Vouchers
- GST
- Reports

between businesses.

---

# 12. Authorization

Roles:

```text
OWNER
ACCOUNTANT
STAFF
```

### OWNER

Full access.

### ACCOUNTANT

- Vouchers
- Ledgers
- Reports
- GST
- Outstanding

### STAFF

- Sales
- Purchase
- Inventory

Use permission-based authorization so permissions can be extended later.

Examples:

```text
sales.create
sales.edit
sales.post
sales.cancel

purchase.create
purchase.post

reports.view

settings.manage

users.manage
```

---

# 13. Security

Passwords must never be stored as plain text.

Use secure password hashing.

Implement:

- Authentication middleware
- Authorization middleware
- Session expiry
- Secure cookies or secure token mechanism
- Input validation
- SQL injection protection
- Rate limiting for login
- Audit logging
- Permission checks

Never expose sensitive database information to the frontend.

---

# 14. Company Master

Fields:

```text
company_id
business_name
legal_name
address
city
state
state_code
pincode
country
phone
email
website
GSTIN
PAN
logo
bank details
invoice settings
tax settings
financial year settings
```

Company settings must be separate from user settings.

---

# 15. Financial Year

Fields:

```text
financial_year_id
business_id
start_date
end_date
status
```

Statuses:

```text
OPEN
LOCKED
CLOSED
```

Normal transactions cannot be posted to CLOSED years.

Next year's opening balances should be generated from the previous year's closing balances.

---

# 16. Master Data

Masters:

- Company
- Financial Year
- Ledger Groups
- Ledgers
- Parties
- Party Addresses
- Stock Groups
- Stock Categories
- Stock Items
- Units
- Godowns
- Voucher Types
- Tax Configuration

---

# 17. Ledger Group Structure

Default groups:

```text
ASSETS

Current Assets
    Cash
    Bank Accounts
    Sundry Debtors
    Inventory

LIABILITIES

Current Liabilities
    Sundry Creditors
    GST Payable

EQUITY

Capital
Retained Earnings

INCOME

Sales
Service Income
Other Income

EXPENSES

Purchases
Cost of Goods Sold
Rent
Salary
Electricity
Transport
Repairs
Other Expenses
```

---

# 18. Ledger

Fields:

```text
ledger_id
business_id
group_id
ledger_name
ledger_type
opening_balance
opening_balance_type
GST applicability
credit_limit
credit_period
active status
```

Party ledgers should reference party records where applicable.

---

# 19. Party

Party types:

```text
CUSTOMER
SUPPLIER
BOTH
```

Fields:

```text
party_id
business_id
ledger_id
name
GSTIN
PAN
phone
email
state
state_code
billing address
shipping address
credit limit
credit period
opening balance
```

---

# 20. Stock Item

Fields:

```text
item_id
business_id
stock_group_id
stock_category_id
item_name
item_code
SKU
HSN/SAC
unit
GST rate
cess rate
purchase rate
selling rate
reorder level
batch support
serial support
expiry support
active status
```

---

# 21. Godowns

Support multiple stock locations.

Examples:

- Main Store
- Warehouse
- Service Center
- Office

Stock movements must identify the relevant godown.

---

# 22. Voucher Architecture

Every business transaction is a voucher.

Voucher:

```text
voucher_id
business_id
financial_year_id
voucher_type
voucher_number
date
reference_number
narration
status
created_by
created_at
updated_at
```

Statuses:

```text
DRAFT
POSTED
CANCELLED
AMENDED
```

Voucher structure:

```text
VOUCHER
│
├── Header
├── Lines
├── Accounting Entries
├── Stock Entries
├── Tax Entries
└── Audit Information
```

---

# 23. Voucher Types

Primary:

- Sales
- Purchase
- Receipt
- Payment
- Contra
- Journal

Returns / notes:

- Sales Return
- Purchase Return
- Credit Note
- Debit Note

Inventory:

- Stock Journal
- Physical Stock

Optional document workflow:

- Sales Order
- Purchase Order
- Delivery Note
- Receipt Note

---

# 24. Voucher Lifecycle

```text
DRAFT
   ↓
VALIDATE
   ↓
CALCULATE
   ↓
PREVIEW ACCOUNTING EFFECT
   ↓
POST
   ↓
LOCK ACCOUNTING EFFECTS
   ↓
REPORTS
```

Cancellation:

```text
POSTED
   ↓
CANCEL
   ↓
GENERATE REVERSAL EFFECT
   ↓
CANCELLED
```

Never silently delete posted accounting history.

---

# 25. Posting Engine

The Posting Engine is the central transaction processor.

```text
Voucher
  ↓
Validate
  ↓
Business Rules
  ↓
Calculate Tax
  ↓
Calculate Accounting
  ↓
Calculate Inventory
  ↓
Calculate Outstanding
  ↓
Validate Debit/Credit
  ↓
Database Transaction
  ↓
Create Voucher
  ↓
Create Voucher Lines
  ↓
Create Ledger Entries
  ↓
Create Stock Entries
  ↓
Create Tax Entries
  ↓
Create Audit Log
  ↓
COMMIT
```

If any step fails:

```text
ROLLBACK ALL
```

---

# 26. Sales Workflow

```text
CUSTOMER
   ↓
SALES VOUCHER
   ↓
SELECT ITEMS
   ↓
QUANTITY
   ↓
RATE
   ↓
DISCOUNT
   ↓
TAXABLE VALUE
   ↓
GST ENGINE
   ↓
CGST + SGST OR IGST
   ↓
ROUNDING
   ↓
FINAL TOTAL
   ↓
ACCOUNTING ENTRIES
   ↓
INVENTORY OUT
   ↓
CUSTOMER OUTSTANDING
   ↓
GST OUTPUT
   ↓
POST
   ↓
REPORTS
   ↓
PRINT INVOICE
```

---

# 27. Sales Accounting

Credit sale:

```text
Customer DR
    Sales CR
    Output GST CR
```

Cash sale:

```text
Cash DR
    Sales CR
    Output GST CR
```

If inventory is tracked:

```text
COGS DR
    Inventory CR
```

This allows accurate gross profit calculation.

---

# 28. Purchase Workflow

```text
SUPPLIER
   ↓
PURCHASE VOUCHER
   ↓
SELECT ITEMS
   ↓
QUANTITY
   ↓
RATE
   ↓
DISCOUNT
   ↓
TAXABLE VALUE
   ↓
GST ENGINE
   ↓
INPUT GST
   ↓
ACCOUNTING
   ↓
INVENTORY IN
   ↓
SUPPLIER OUTSTANDING
   ↓
POST
   ↓
REPORTS
```

---

# 29. Purchase Accounting

```text
Purchase DR
Input CGST DR
Input SGST DR
    Supplier CR
```

For inter-state:

```text
Purchase DR
Input IGST DR
    Supplier CR
```

---

# 30. Receipt Workflow

```text
CUSTOMER
   ↓
RECEIPT
   ↓
PAYMENT MODE
   ↓
AMOUNT
   ↓
BILL ALLOCATION
   ↓
ACCOUNTING
   ↓
OUTSTANDING REDUCTION
   ↓
POST
```

Accounting:

```text
Bank/Cash DR
    Customer CR
```

---

# 31. Payment Workflow

```text
SUPPLIER
   ↓
PAYMENT
   ↓
BANK/CASH
   ↓
AMOUNT
   ↓
BILL ALLOCATION
   ↓
ACCOUNTING
   ↓
OUTSTANDING REDUCTION
   ↓
POST
```

Accounting:

```text
Supplier DR
    Bank/Cash CR
```

---

# 32. Contra Workflow

```text
FROM ACCOUNT
   ↓
TO ACCOUNT
   ↓
AMOUNT
   ↓
VALIDATE
   ↓
POST
```

Examples:

```text
Cash DR
    Bank CR
```

or:

```text
Bank DR
    Cash CR
```

---

# 33. Journal Workflow

```text
Date
Reference
Narration

↓

Multiple accounting lines

↓

Debit
Credit

↓

Check:

TOTAL DEBIT = TOTAL CREDIT

↓

POST
```

---

# 34. Inventory Engine

Never maintain inventory only as:

```text
current_stock = current_stock - quantity
```

Instead maintain stock movements.

Stock Entry:

```text
stock_entry_id
business_id
voucher_id
item_id
godown_id
date
movement_type
quantity_in
quantity_out
rate
value
```

Closing stock:

```text
Opening Stock
+
Stock IN
-
Stock OUT
=
Closing Stock
```

---

# 35. Inventory Valuation

Initial version:

```text
WEIGHTED AVERAGE COST
```

Architecture must support future:

```text
FIFO
STANDARD COST
```

---

# 36. GST Engine

GST must be a separate domain service.

Inputs:

- Seller state
- Buyer state
- Buyer GSTIN
- Place of supply
- HSN/SAC
- Taxable value
- GST rate
- Cess
- Tax inclusive/exclusive mode

Outputs:

- Taxable value
- CGST
- SGST
- IGST
- Cess
- Total tax
- Invoice total

Basic classification:

```text
INTRA-STATE
    ↓
CGST + SGST

INTER-STATE
    ↓
IGST
```

Do not embed GST calculations directly into UI components.

---

# 37. Tax-Inclusive Mode

Support:

### Tax Exclusive

```text
Base
+
GST
=
Total
```

### Tax Inclusive

Final price already contains GST.

Example:

```text
₹1,180 at 18%

Taxable value = ₹1,000
GST = ₹180
```

---

# 38. Discount

Support:

- Percentage
- Fixed amount
- Line discount
- Invoice discount

GST must be calculated using the correct applicable taxable value.

---

# 39. Rounding

Support:

- Nearest ₹1
- Nearest ₹5
- Nearest ₹10

Store:

```text
calculated_total
round_off
final_total
```

Never overwrite the original calculated amount.

---

# 40. Outstanding Engine

For every credit invoice:

```text
Invoice Amount
Paid Amount
Outstanding
Due Date
```

Formula:

```text
Opening Outstanding
+
Credit Transactions
-
Settlements
=
Closing Outstanding
```

Support:

- Partial payment
- Advance payment
- Advance receipt
- Bill allocation
- Ageing
- Due dates

---

# 41. Ageing

Default buckets:

```text
Current
1-30
31-60
61-90
90+
```

Overdue values should use restrained warning styling.

---

# 42. Sales Return

Never delete the original invoice.

Create a reversal transaction.

Original:

```text
Customer DR
Sales CR
GST CR
Inventory OUT
```

Return:

```text
Sales Return DR
GST DR
Customer CR
Inventory IN
```

Maintain original voucher reference.

---

# 43. Purchase Return

Reverse the appropriate:

- Purchase
- Input GST
- Supplier
- Inventory

Create a separate return transaction.

---

# 44. Posted Transaction Rule

Posted transactions are accounting history.

Do not directly overwrite them.

Allowed:

- Amendment
- Cancellation
- Reversal
- Replacement voucher

Audit trail must preserve:

```text
Created by
Created at
Modified by
Modified at
Cancelled by
Cancellation reason
```

---

# 45. Report Engine

Reports are **read models derived from posted transactions**.

## Accounting

- Day Book
- Ledger
- Trial Balance
- Cash Book
- Bank Book
- Profit & Loss
- Balance Sheet

## Inventory

- Stock Summary
- Stock Ledger
- Stock Valuation
- Godown Stock
- Item Movement
- Low Stock

## Party

- Customer Ledger
- Supplier Ledger
- Receivables
- Payables
- Ageing
- Bill-wise Outstanding

## GST

- Sales GST
- Purchase GST
- CGST Summary
- SGST Summary
- IGST Summary
- HSN/SAC Summary
- Tax Rate Summary

---

# 46. Trial Balance

Generate from ledger entries.

Display:

```text
Ledger
Debit
Credit
```

Bottom:

```text
Total Debit
Total Credit
```

Integrity:

```text
TOTAL DEBIT = TOTAL CREDIT
```

If not:

```text
ACCOUNTING INTEGRITY ERROR
```

---

# 47. Profit & Loss

Calculate:

```text
Revenue
-
COGS
=
Gross Profit

Gross Profit
-
Operating Expenses
+
Other Income
=
Net Profit
```

Never store Net Profit as an editable value.

---

# 48. Balance Sheet

## Assets

- Cash
- Bank
- Receivables
- Inventory
- Other Assets

## Liabilities

- Payables
- GST Payable
- Loans
- Other Liabilities

## Equity

- Capital
- Retained Earnings
- Current Year Profit

Validation:

```text
Total Assets
=
Total Liabilities + Equity
```

---

# 49. Dashboard

The dashboard must remain intentionally minimal.

Header:

```text
Good Evening, [User]

Here's what's happening with your business today.
```

Primary action:

```text
+ New Voucher
```

KPI cards:

- Today's Sales
- Receivables
- Payables
- Cash & Bank Balance

Main:

- Sales & Purchase Trend
- Recent Transactions

Lower:

- Low Stock Items
- Business Health
- Quick Actions

Quick Actions:

- New Sale
- New Purchase
- Receive Payment
- Make Payment

Do not overload the dashboard.

---

# 50. Business Health

Show:

```text
Accounting Integrity
Books are balanced

GST Engine
Working properly

Inventory
Stock values are in sync

Database
Last backup
```

Use restrained green indicators.

This is a core LedgerFlow identity feature.

---

# 51. Invoice Engine

Invoice is generated from the posted Sales Voucher.

A4 format.

Include:

- Company
- GSTIN
- Invoice Number
- Invoice Date
- Customer
- Billing Address
- Shipping Address
- Place of Supply

Items:

```text
Sl No
Description
HSN/SAC
Quantity
Rate
Unit
Discount
Taxable Value
GST Rate
CGST
SGST
IGST
Amount
```

Summary:

```text
Taxable Value
CGST
SGST
IGST
Cess
Round Off
Grand Total
```

Also include:

- Amount in Words
- Bank Details
- Terms & Conditions
- Authorized Signatory

---

# 52. Print Architecture

Screen UI and print UI must be separate.

Print mode removes:

- Sidebar
- Topbar
- Buttons
- Navigation
- Screen-only elements

Provide:

- A4 Tax Invoice
- Detailed Invoice
- Simple Invoice
- Thermal Invoice

The same voucher data should feed all templates.

---

# 53. Database Core Tables

```text
users

businesses

user_businesses

financial_years

ledger_groups

ledgers

parties

party_addresses

stock_groups

stock_categories

stock_items

units

godowns

voucher_types

vouchers

voucher_lines

ledger_entries

stock_entries

tax_entries

sales

sales_lines

purchases

purchase_lines

receipts

payments

sales_returns

purchase_returns

credit_notes

debit_notes

orders

order_lines

invoice_sequences

audit_logs

roles

permissions

user_roles

settings

backups
```

---

# 54. Database Rule

Core transaction truth:

```text
VOUCHER
```

Supporting effects:

```text
LEDGER ENTRY
STOCK ENTRY
TAX ENTRY
```

Sales and Purchase domain records should reference the core voucher.

Accounting entries must reference `voucher_id`.

Stock entries must reference `voucher_id`.

Tax entries must reference `voucher_id`.

---

# 55. Database Integrity

Use:

- Primary Keys
- Foreign Keys
- Unique Constraints
- Check Constraints
- Indexes
- Transactions

Enforce:

- Business ownership
- Financial-year ownership
- Voucher uniqueness
- Valid ledger references
- Valid item references
- Valid party references

---

# 56. API Architecture

## Authentication

```text
POST /auth/signup
POST /auth/login
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
GET  /auth/me
```

## Business

```text
GET /business
PUT /business
GET /business/settings
```

## Masters

```text
GET /parties
POST /parties
GET /parties/:id
PUT /parties/:id

GET /ledgers
POST /ledgers

GET /items
POST /items

GET /godowns
POST /godowns
```

## Vouchers

```text
POST /vouchers/sales
POST /vouchers/purchase
POST /vouchers/receipt
POST /vouchers/payment
POST /vouchers/contra
POST /vouchers/journal

GET /vouchers
GET /vouchers/:id

POST /vouchers/:id/post
POST /vouchers/:id/cancel
```

## Reports

```text
GET /reports/day-book
GET /reports/ledger
GET /reports/trial-balance
GET /reports/profit-loss
GET /reports/balance-sheet
GET /reports/stock
GET /reports/outstanding
GET /reports/gst
```

## Backup

```text
POST /backup
GET /backup
POST /restore
```

All API routes must enforce authentication and business authorization.

---

# 57. Frontend Application Structure

## Main Navigation

- Dashboard
- Vouchers & Entry
- Masters & Items
- Reports
- System

## Vouchers

- Sales
- Purchase
- Receipt
- Payment
- Contra
- Journal
- Credit Note
- Debit Note
- Sales Return
- Purchase Return
- Stock Journal

## Masters

- Parties
- Ledgers
- Stock Items
- Units
- Godowns
- Groups

## Reports

- Day Book
- Ledger
- Trial Balance
- Profit & Loss
- Balance Sheet
- Stock Summary
- Outstanding
- GST Reports

## System

- Backup & Audit
- Company Settings

---

# 58. Voucher Entry UX

Voucher entry is a primary workflow.

Optimize for:

- Fast data entry
- Keyboard navigation
- Low friction

Support:

```text
TAB
ENTER
ESC
Arrow keys
Autocomplete
Quick create
Keyboard shortcuts
```

Desktop:

```text
Voucher Header
↓
Party
↓
Items
↓
Tax
↓
Totals
↓
Actions
```

The transaction table must be the visual focus.

---

# 59. Quick Create

Allow creation of:

- New Customer
- New Supplier
- New Item
- New Ledger

without leaving the voucher.

Example:

```text
Party not found
        ↓
+ Create Party
        ↓
Mini form
        ↓
Save
        ↓
Return to voucher
```

---

# 60. Global Search

Search:

- Invoice
- Voucher
- Party
- Ledger
- Item
- SKU
- GSTIN
- HSN/SAC

Shortcut:

```text
Ctrl + K
```

---

# 61. Responsive Architecture

The application must be genuinely responsive.

Support:

```text
320px+
480px+
768px+
1024px+
1280px+
1440px+
```

## Desktop

- Expanded sidebar
- Multi-column dashboard
- Full tables
- Multi-column forms

## Laptop

- Collapsible sidebar
- Reduced spacing
- 2-column forms

## Tablet

- Drawer navigation
- 2-column forms
- 2 × 2 KPI layout

## Mobile

- Off-canvas navigation
- Single-column layouts
- Stacked forms
- Compact cards
- Responsive transaction items
- Sticky action bar

---

# 62. Mobile Voucher

Never compress the desktop table into unreadable columns.

Use expandable item cards:

```text
Laptop

1 Nos × ₹52,000

GST 18%

₹52,000

[Edit] [Delete]
```

Then:

```text
+ Add Item

Tax Summary

Grand Total
```

Sticky bottom:

```text
Cancel
Save
Save & Print
```

---

# 63. Responsive Table Rule

Use:

- Normal table
- Controlled horizontal scrolling
- Responsive list/card

depending on the data.

Financial statements should preserve column alignment.

Never sacrifice financial readability just to eliminate scrolling.

---

# 64. Dark Design System

LedgerFlow uses a **premium dark-first visual identity**.

Core philosophy:

```text
BLACK IS THE CANVAS.

WHITE IS THE INFORMATION.

ACCENT COLORS COMMUNICATE STATE.

SPACING CREATES PREMIUM QUALITY.
```

The design should feel:

- Premium
- Dark
- Modern
- Minimal
- Data-focused
- Confident
- Professional
- Slightly futuristic

Avoid:

- Traditional accounting software aesthetics
- Generic admin templates
- Banking clones
- Cryptocurrency dashboards
- Gaming interfaces
- Cyberpunk styling
- Excessive glassmorphism

---

# 65. Dark Color Tokens

## Background

```text
#050505
```

## Shell

```text
#111113
```

## Surface

```text
#18181B
```

## Surface Hover

```text
#202023
```

## Elevated

```text
#29292C
```

## Borders

```text
#242428
#303035
```

## Primary Text

```text
#F7F7F8
```

## Secondary Text

```text
#A6A6AD
```

## Muted Text

```text
#6F7078
```

## Disabled Text

```text
#4F5056
```

---

# 66. Accent Tokens

```text
Blue:
#5685F5

Purple:
#A982FF

Green:
#20D9A3

Orange:
#FFB45F

Coral:
#FF777E

Cyan:
#25C7E8
```

Use accents intentionally.

### Blue

- Interactive elements
- Links
- Navigation
- Focus

### Purple

- Analytics

### Green

- Success
- Paid
- Healthy
- Balanced

### Orange

- Warning
- Low stock
- Pending

### Coral

- Error
- Overdue
- Negative

### Cyan

- Secondary metrics

---

# 67. Dark Mode Rule

Do NOT create:

- Blue background
- Blue cards
- Blue gradients
- Blue glow everywhere

The dominant colors must be:

```text
BLACK
CHARCOAL
WHITE
```

Accent colors guide attention.

---

# 68. Typography

Primary:

```text
Inter
```

Alternatives:

```text
Geist
Manrope
```

Sizes:

```text
Page title:    28-32px / 700
Section:       16-18px / 600
Body:          14px
Metadata:      12px
KPI:           30-36px / 700
```

Use tabular numerals for financial values.

Example:

```text
₹1,28,450.00
```

---

# 69. Spacing

Use:

```text
4
8
12
16
20
24
32
40
48
64
```

Desktop page padding:

```text
24-32px
```

Mobile:

```text
16px
```

---

# 70. Border Radius

```text
Buttons:       8px
Inputs:        8-10px
Cards:         14px
Large panels:  16px
Shell:         20px
```

Avoid excessive pill shapes.

---

# 71. Cards

Cards:

```text
background: #18181B
border:     #242428
radius:     14px
padding:    20-24px
```

Avoid heavy shadows.

Avoid excessive cards.

Not every piece of information needs a card.

---

# 72. Button System

## Primary

White background + dark text

or green accent for selected primary actions.

## Secondary

Dark surface + subtle border + white text

## Tertiary

Text-only

## Danger

Coral

Do not make every button blue.

---

# 73. Input System

```text
Background:
#111111

Border:
#303035

Text:
#F7F7F8

Placeholder:
#6F7078
```

Focus:

```text
Subtle blue outline
```

---

# 74. Table System

```text
Header:
#202023

Row:
#18181B

Hover:
#202023

Border:
#242428
```

No heavy cell borders.

Right-align financial values.

Keep column alignment consistent.

---

# 75. Status System

```text
POSTED      → Green
DRAFT       → Orange
PAID        → Green
PARTIAL     → Blue
OVERDUE      → Coral
CANCELLED   → Muted red
```

Use compact badges.

---

# 76. Dashboard Visual Style

Use a premium dark analytics composition.

Top:

```text
Greeting
+
New Voucher
```

Then:

```text
4 KPI cards
```

Then:

```text
Sales & Purchase Analytics
+
Recent Transactions
```

Then:

```text
Low Stock
+
Business Health
+
Quick Actions
```

Use generous whitespace.

Do not fill every available pixel.

---

# 77. Sidebar Design

Dark sidebar.

Top:

```text
LedgerFlow
ACCOUNTING & ERP OS
```

Navigation should be compact.

Active item:

- Subtle colored background
- Accent icon
- Bright text

Desktop:

```text
Expanded
```

Tablet:

```text
Collapsed
```

Mobile:

```text
Off-canvas
```

---

# 78. Top Bar

Include:

- Logo
- Company
- Global Search
- Financial Year
- Date
- Notifications
- Theme
- Profile

Keep the header quiet.

Do not overload it.

---

# 79. Dark Login

Login should feel premium and connected to the product.

Dark background.

LedgerFlow branding.

```text
Welcome Back

Email

Password

Sign In

Forgot Password

Create Account
```

Use black and charcoal surfaces.

White primary CTA.

Minimal accent color.

---

# 80. Dark Signup

Signup should be a guided setup:

```text
Step 1:
Account Details

Step 2:
Business Details

Step 3:
GST & Preferences
```

Show progress clearly.

Do not overwhelm the user with one giant form.

---

# 81. Audit Log

Track:

```text
LOGIN
LOGOUT
CREATE
UPDATE
POST
CANCEL
AMEND
BACKUP
RESTORE
SETTINGS CHANGE
```

Fields:

```text
user
timestamp
action
module
record
old value
new value
reason
```

---

# 82. Backup / Restore

Support:

- Manual Backup
- Automatic Backup
- Restore
- Database Export
- Backup Verification

Never allow restore without confirmation.

Backup is a core business feature.

---

# 83. Import / Export

Support:

```text
CSV
Excel
JSON
```

Import:

- Parties
- Ledgers
- Items
- Opening balances
- Opening stock

Export:

- Reports
- Transactions
- Masters

---

# 84. Error Handling

Never show only:

```text
"Something went wrong."
```

Explain:

1. What happened
2. Why it happened
3. What the user can do

Example:

```text
Voucher cannot be posted.

Debit and credit differ by ₹500.

Review the accounting entries before posting.
```

---

# 85. Accounting Integrity

Continuously validate:

```text
Debit = Credit

Opening Stock
+
Stock IN
-
Stock OUT
=
Closing Stock

Opening Outstanding
+
Credit Transactions
-
Settlements
=
Closing Outstanding

Assets
=
Liabilities + Equity
```

These are fundamental system invariants.

---

# 86. Testing

Create automated tests for:

- Signup
- Login
- Business isolation
- Permissions
- Sales
- Purchase
- Receipt
- Payment
- Contra
- Journal
- GST
- Discount
- Roundoff
- Inventory
- Returns
- Outstanding
- Trial Balance
- P&L
- Balance Sheet
- Backup
- Restore

Critical test:

```text
Every posted accounting voucher must balance.
```

---

# 87. Development Order

Do NOT build the dashboard first.

Do NOT build the beautiful invoice first.

Do NOT start with animations.

Build in this order:

```text
PHASE 1
Database foundation

PHASE 2
Authentication

PHASE 3
Business + Financial Year

PHASE 4
Ledger Groups + Ledgers

PHASE 5
Accounting / Voucher Engine

PHASE 6
Journal

PHASE 7
Trial Balance

PHASE 8
Inventory Engine

PHASE 9
Stock Ledger

PHASE 10
Purchase

PHASE 11
Sales

PHASE 12
GST Engine

PHASE 13
Receipt + Payment

PHASE 14
Outstanding

PHASE 15
P&L

PHASE 16
Balance Sheet

PHASE 17
Reports

PHASE 18
Invoice Print Engine

PHASE 19
Dashboard

PHASE 20
Audit

PHASE 21
Backup / Restore

PHASE 22
Advanced GST integrations

PHASE 23
Performance and security hardening
```

---

# 88. Implementation Rule

Before implementing each module:

1. Define its data model.
2. Define its business rules.
3. Define its accounting effects.
4. Define its inventory effects.
5. Define its tax effects.
6. Define its API.
7. Define validation.
8. Define tests.
9. Then build the UI.

Never build UI first and invent the business logic afterward.

---

# 89. Most Important Architectural Rule

Never solve accounting problems by changing displayed numbers.

Always follow:

```text
USER ACTION
    ↓
VOUCHER
    ↓
VALIDATION
    ↓
BUSINESS RULES
    ↓
ACCOUNTING ENGINE
    ↓
INVENTORY ENGINE
    ↓
GST ENGINE
    ↓
OUTSTANDING ENGINE
    ↓
POSTING ENGINE
    ↓
DATABASE
    ↓
REPORT ENGINE
```

---

# 90. Final Product Structure

```text
                    LEDGERFLOW
                         │
             ┌───────────┴───────────┐
             │                       │
       AUTHENTICATION            BUSINESS
             │                       │
             └───────────┬───────────┘
                         │
                  FINANCIAL YEAR
                         │
            ┌────────────┴────────────┐
            │                         │
         MASTERS                   VOUCHERS
            │                         │
     ┌──────┼──────┐          ┌───────┼────────┐
     │      │      │          │       │        │
   Party  Ledger  Stock      Sales  Purchase  Money
     │      │      │          │       │        │
     └──────┴──────┴──────────┴───────┴────────┘
                         │
                  POSTING ENGINE
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    ACCOUNTING        INVENTORY          GST
        │                │                │
        └────────────────┼────────────────┘
                         │
                     DATABASE
                         │
                 ┌───────┼────────┐
                 │       │        │
               Ledger   Stock     Tax
                 │       │        │
                 └───────┼────────┘
                         │
                    REPORT ENGINE
                         │
          ┌──────────────┼──────────────┐
          │              │              │
      ACCOUNTING      INVENTORY        GST
       REPORTS         REPORTS       REPORTS
```

---

# 91. Final UX Principle

LedgerFlow must make the user feel:

- "I know where I am."
- "I know what this transaction does."
- "I know where the money went."
- "I know how much stock I have."
- "I know what customers owe me."
- "I know what I owe suppliers."
- "I know whether my books are balanced."
- "I can trust the reports."

The application should feel:

```text
PREMIUM
but not decorative

POWERFUL
but not complicated

MINIMAL
but not empty

MODERN
but not trend-driven

FAST
but not rushed

ACCOUNTING-FIRST
but beautiful
```

---

# 92. Final Quality Bar

Before declaring LedgerFlow complete:

```text
✓ Authentication works
✓ Business isolation works
✓ Financial years work
✓ Permissions work
✓ Masters work
✓ Voucher engine works
✓ Debit = Credit
✓ Inventory movements work
✓ GST engine works
✓ Outstanding works
✓ Sales works
✓ Purchase works
✓ Receipts work
✓ Payments work
✓ Returns work
✓ Trial Balance works
✓ P&L works
✓ Balance Sheet works
✓ Stock reports work
✓ GST reports work
✓ Invoice printing works
✓ Audit trail works
✓ Backup works
✓ Restore works
✓ Responsive design works
✓ Dark theme works
✓ Keyboard navigation works
✓ Error states work
✓ Loading states work
✓ Empty states work
✓ Automated tests exist
```

---

# Final Architecture Principle

The entire system is governed by:

```text
USER
 ↓
BUSINESS
 ↓
FINANCIAL YEAR
 ↓
VOUCHER
 ↓
POSTING ENGINE
 ├── Accounting
 ├── Inventory
 ├── GST
 └── Outstanding
 ↓
DATABASE
 ↓
REPORTS
```

The UI sits **around the engine**, not inside it.

The database is the source of truth.

The voucher is the source of transaction truth.

The accounting engine is the source of financial truth.

The inventory engine is the source of stock truth.

The GST engine is the source of tax calculation truth.

The report engine derives information from those sources.

LedgerFlow should be built as a business-owned accounting operating system,
not merely an invoice application.
