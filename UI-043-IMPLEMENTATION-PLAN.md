# UI-043 IMPLEMENTATION PLAN
## Payments Module + Global Dark Theme Stabilization

**Author**: Antigravity Engineering  
**Version**: 1.0.0  
**Target Module**: Payments Module (Transactions) & Global Dark Theme Engine  
**Design Reference**: 4 Approved Screenshots (Payment Dashboard, Record Payment, Payment Register, Payment Details)  
**Status**: APPROVED FOR IMPLEMENTATION

---

## 1. Executive Summary

UI-043 delivers a comprehensive enterprise-grade Payments module and stabilises the global dark theme across LedgerFlow. Following the successful implementation of the Receipts module (UI-042), the Payments module mirrors its architectural rigor while introducing critical purchase-side workflows:
1. **Three Payment Types**: Purchase Payment (vendor settlement with multi-invoice allocation & advance), Expense Payment (operational overheads with direct ledger debit), and Other Payment (assets, deposits, loans & advances).
2. **Visual Fidelity**: Direct adherence to the 4 reference screenshots for Payment Dashboard, Record Payment, Payment Register, and Payment Details.
3. **Strict Double-Entry & Integer Paise Accounting**: All calculations execute in integer paise (`amount_paise`), validated through `PostingEngine` with atomic rollback, concurrency safeguards, and strict audit trails.
4. **Global Dark Theme Stabilization**: Systemic replacement of hardcoded light colors (`#FFFFFF`, `bg-white`, `#0F172A`, `#E2E8F0`) with semantic CSS tokens from `tokens.css`, ensuring seamless contrast and zero color bleed across both Light and Dark modes.

---

## 2. Phase 1: Inspection & Architectural Assessment

### 2.1 Backend Schema & Posting Engine
- **Vouchers Table**: `voucher_type = 'PAYMENT'` already supported with status lifecycle `DRAFT | POSTED | CANCELLED`.
- **Bill Allocations Table**: `bill_allocations` table supports `AGAINST_REF` (allocated against specific `PURCHASE` voucher) and `ON_ACCOUNT` (supplier advance / unallocated balance).
- **Posting Engine (`posting-engine.ts`)**:
  - `PostingEngine.postVoucher`: Accepts `voucherType: 'PAYMENT'`, `customLedgerLines`, and `billAllocations`.
  - Multi-allocation validation: Checks each referenced purchase invoice exists, belongs to company context, is not cancelled, and prevents over-allocation beyond outstanding balance.
  - Automatic `ON_ACCOUNT` assignment: Any unallocated payment remainder is automatically recorded as `ON_ACCOUNT`.
  - Cancellation lifecycle: Voiding a payment automatically restores the outstanding balance on settled purchase invoices.
  - Numbering engine: Generates sequential statutory numbers (`PMT-YYYY-XXXX` / `PAY-YYYY-XXXX`).
- **Route Enhancement (`routes.ts`)**:
  - Update `GET /vouchers` to include subqueries for `paid_from_ledger_name` (Bank/Cash ledger credited) and `paid_to_ledger_name` (Party or Expense account debited).

### 2.2 Global Theme Architecture
- **Tokens System (`tokens.css`)**: Comprehensive CSS variables defined under `:root, [data-theme="light"]` and `[data-theme="dark"]`:
  - `--color-background`: `#F8F7F4` (light) / `#080808` (dark)
  - `--color-surface`: `#FFFFFF` (light) / `#151515` (dark)
  - `--color-surface-secondary`: `#F8F7F4` (light) / `#191919` (dark)
  - `--color-border`: `#E5E7EB` (light) / `#292929` (dark)
  - `--color-text`: `#0F172A` (light) / `#F5F5F5` (dark)
  - `--color-text-secondary`: `#475569` (light) / `#8E8E8E` (dark)
  - `--color-primary`: `#F97316` (light) / `#FF641F` (dark)
- **Theme Switcher (`ThemeToggle.tsx`) & HTML Bootstrap (`index.html`)**:
  - Synchronize both `data-theme="dark"` attribute AND `.dark` CSS class on `document.documentElement` so all CSS rules consistently match.

---

## 3. Phase 2: Payments Module Specification

### 3.1 Sidebar Navigation
- **Payments Parent Item**:
  - Single click directly navigates to `PaymentDashboardView` (`activeTab = 'payments'`, `paymentViewMode = 'dashboard'`).
  - Contains chevron toggle to expand/collapse.
  - Clicking Payments while already expanded navigates directly to `PaymentDashboardView`.
- **Submenu**: Strictly contains only TWO items:
  1. `Record Payment` (`paymentViewMode = 'create'`)
  2. `Payment Register` (`paymentViewMode = 'register'`)
  - No redundant "Payment Dashboard" submenu entry.

### 3.2 Payment Dashboard (`PaymentDashboardView.tsx`)
Reference: `media_1793861106475_8bf71d8e.jpg`
- **Header**: Title "Payment Dashboard", breadcrumb "Payments > Payment Dashboard", description "Track vendor payments, expenses and other cash outflows.", and "+ Record Payment" orange button.
- **4 Top KPI Cards**:
  1. *Total Paid*: Total amount in ₹ with comparison vs last month and mini trend sparkline.
  2. *Payment Count*: Total voucher count with comparison and mini trend sparkline.
  3. *Supplier Payments*: Amount paid to suppliers (% of total) with green accent sparkline.
  4. *Expense & Other Payments*: Operational expenses & other outflows (% of total) with bronze accent sparkline.
- **Middle Section**:
  - *Payment Trend (60% width)*: Monthly outflow bar chart with "Value" / "Count" toggle.
  - *Payment by Type (40% width)*: Donut chart displaying split between Purchase Payments, Expense Payments, and Other Payments.
- **Bottom Section**:
  - *Needs Attention (35% width)*: Supplier Advances (unadjusted), Partially Allocated purchase payments, and High Value Payments (> ₹1,00,000).
  - *Recent Payments (65% width)*: Table showing Date, Payment No. (clickable link), Type, Paid To / Party, Paid From, Amount (₹), Status ("Posted"), and "View Register ->" link.

### 3.3 Record Payment (`RecordPaymentView.tsx`)
Reference: `media_1793861106323_079bf923.jpg`
- **Header Actions**: "Save as Draft", "Preview", "Print / PDF", and primary "Save & Post".
- **Payment Type Selector (Top Card)**:
  - 3 interactive radio cards:
    1. `Purchase Payment`: "Pay supplier and allocate against purchase invoices" (package icon).
    2. `Expense Payment`: "Pay for business expenses (e.g., rent, electricity)" (document icon).
    3. `Other Payment`: "Other business payments (e.g., advance, deposit)" (layers icon).
- **Dynamic Field Layout**:
  - **If Purchase Payment**:
    - *Supplier / Party Details*: Select supplier dropdown (`SUP-...`), displays address, GSTIN, phone, state.
    - *Payment Details*: Payment No. (`PMT-2026-XXXX`), Date, Reference No. (UTR/Cheque), Narration.
    - *Payment Mode*: Paid From (Bank/Cash ledger dropdown), Payment Mode (Bank Transfer, UPI, Cash, Cheque, NEFT/RTGS), Reference Date.
    - *Invoice Allocation*: Table loading outstanding purchase invoices with checkboxes, Invoice No., Date, Invoice Amount, Outstanding Amount, and editable Allocate Amount input with sequential auto-allocation button.
    - *Amount Summary*: Payment Amount input, Allocated Amount, Unallocated (Advance) calculation, Total Payment highlight.
    - *Accounting Preview*: Live double-entry preview:
      - `Dr [Supplier Name]` (Total Payment)
      - `Cr [Bank/Cash Ledger]` (Total Payment)
    - *Terms and Notes*: Standard terms and customizable notes.
  - **If Expense Payment**:
    - *Expense Account Details*: Expense ledger dropdown (Rent, Electricity, Office Supplies, etc.).
    - *Payment Details & Mode*: Same bank/cash selection, payment mode, reference.
    - *Amount Summary*: Expense amount.
    - *Accounting Preview*: `Dr [Expense Ledger]`, `Cr [Bank/Cash Ledger]`.
  - **If Other Payment**:
    - *Target Account Details*: Ledger dropdown (Assets, Deposits, Loans & Advances, etc.).
    - *Accounting Preview*: `Dr [Target Ledger]`, `Cr [Bank/Cash Ledger]`.

### 3.4 Payment Register (`PaymentRegisterView.tsx`)
Reference: `media_1793861106323_141c1dd4.jpg`
- **5 KPI Summary Cards**: Total Paid, Payment Count, Purchase Payments, Expense Payments, Other Payments.
- **Filter Toolbar**:
  - Search input ("Search payment no., supplier, reference...").
  - Date Range selector with preset quick filters.
  - Payment Type dropdown ("All Types", "Purchase", "Expense", "Other").
  - Supplier / Party filter.
  - Paid From ledger filter.
  - Status filter ("All", "Posted", "Draft", "Cancelled").
  - Refresh button.
- **Data Table**:
  - Columns: Checkbox, Date (sortable), Payment No. (sortable, orange clickable link), Type (Purchase/Expense/Other badges), Paid To / Party, Paid From, Payment Mode, Amount (₹), Status (`Posted`, `Draft`, `Cancelled`), Allocation (`Fully Allocated`, `Partially Allocated`, `—`), Actions.
  - Action buttons: View details eye icon, Print icon, three dots menu (Cancel Voucher, Duplicate).
  - Pagination controls: Rows per page selector (10, 25, 50), page indicator, previous/next controls.

### 3.5 Payment Voucher Details & Print
Reference: `media_1793861106323_ea49ea14.jpg`
- **`PaymentDetailsView.tsx`**:
  - Header: Voucher number with status badge (`Posted`), back button, duplicate button, print button, cancel voucher action.
  - Top cards: Supplier / Party details, Payment Details, Payment Mode.
  - Middle cards: Invoice Allocation breakdown table with totals row, Amount Summary card.
  - Bottom cards: Terms and Notes, Accounting Entry table (`Dr Party/Expense`, `Cr Bank/Cash`), Payment Status card (`Posted`, `Fully Allocated`).
  - Voucher Timeline: Draft Created -> Posted -> No Further Changes.
- **`PaymentPrintModal.tsx`**:
  - High-fidelity clean A4 document format.
  - Header with Company details, GSTIN, and voucher metadata.
  - Clean table of invoice settlements and allocation breakdown.
  - Numbers converted to Indian Rupees Words.
  - Authorized Signatory stamp & signature area.
  - Zero internal notes or dealer sensitive data leaked.

---

## 4. Phase 3: Global Dark Theme Stabilization

1. **Systemic Audit & Class/Variable Mapping**:
   - Inspect all views for hardcoded `#FFFFFF`, `bg-white`, `#0F172A`, `#E2E8F0`, and convert them to `var(--color-surface)`, `var(--color-surface-secondary)`, `var(--color-border)`, `var(--color-text)`, `var(--color-text-secondary)`.
2. **Screens Covered**:
   - Dashboard (`DashboardView.tsx`)
   - Payments (`PaymentDashboardView.tsx`, `RecordPaymentView.tsx`, `PaymentRegisterView.tsx`, `PaymentDetailsView.tsx`)
   - Receipts (`ReceiptDashboardView.tsx`, `RecordReceiptView.tsx`, `ReceiptRegisterView.tsx`, `ReceiptDetailsView.tsx`)
   - Purchases (`PurchaseView.tsx`, `PurchaseRegisterView.tsx`, `PurchaseReturnView.tsx`, `PurchaseInvoiceView.tsx`)
   - Quotation (`QuotationDashboardView.tsx`, `QuotationRegisterView.tsx`, `QuotationDetailsView.tsx`, `QuotationCreationView.tsx`)
   - Sales (`SalesView.tsx`, `SalesRegisterView.tsx`, `SalesInvoiceView.tsx`, `IndividualSalesInvoiceView.tsx`)
   - Masters (`ItemsView.tsx`, `PartiesView.tsx`, `LedgersView.tsx`, `GodownsView.tsx`, `UnitsView.tsx`)
   - Reports (`ReportsView.tsx`, `DayBookView.tsx`, `StockSummaryView.tsx`, `LedgerReportView.tsx`, `TrialBalanceView.tsx`)
3. **HTML / Theme Toggle Sync**:
   - Update `ThemeToggle.tsx` and `index.html` to toggle both `data-theme="dark"` attribute and `dark` class on `document.documentElement`.
4. **Documentation**:
   - Compile `DARK-THEME-AUDIT-REPORT.md`.

---

## 5. Verification Plan

1. **Backend Integration & Unit Tests (`backend/tests/ui043-payments-module.test.ts`)**:
   - Test sequential statutory numbering for Payments (`PMT-` prefix).
   - Test Purchase payment posting with multi-invoice allocation against purchase invoices.
   - Test unallocated remainder recorded as `ON_ACCOUNT` (supplier advance).
   - Test over-allocation rejection (alloc > outstanding).
   - Test Expense payment posting (`Dr Expense, Cr Bank`).
   - Test Other payment posting (`Dr Asset/Deposit, Cr Bank`).
   - Test payment cancellation restoring invoice outstanding balances.
   - Test multi-tenant isolation.
2. **Frontend Build & Regression Verification**:
   - Run `npm run build` in `frontend` to verify TypeScript compile and Vite asset bundling with 0 errors.
   - Verify sidebar navigation behavior: clicking Payments opens dashboard directly, submenu contains only Record Payment and Payment Register.
   - Verify theme toggling in browser between Light and Dark modes.

