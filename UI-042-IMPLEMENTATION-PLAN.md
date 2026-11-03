# UI-042: Receipt Module Implementation — Plan & Architecture

## Objective
Implement and integrate a complete, production-grade Receipt module in LedgerFlow using the four supplied reference screenshots as the primary visual and interaction references:
1. **Receipt Dashboard** (`media_1793731281361_bced802c.jpg`)
2. **Record Receipt** (`media_1793731281355_887f7050.jpg`)
3. **Receipt Register** (`media_1793731281346_407a5731.jpg`)
4. **Receipt Details** (`media_1793731281183_11b55b47.jpg`)
5. **Receipt Print Template & Modal**

The module adheres strictly to LedgerFlow's design system (Inter, JetBrains Mono, orange primary `#F97316`, warm ivory/white surfaces, dark mode support), integer paise accounting engine (`PostingEngine`), company/financial year multi-tenant isolation, and authentic data reconciliation (no fabricated statistics).

---

## 1. Architecture & Design Specification

### 1.1 Sidebar Navigation Hierarchy
- Parent Item: **Receipts** (Icon: ArrowDownToLine / Box, hotkey `Alt+R`)
  - Clicking parent item directly navigates to and displays `ReceiptDashboardView` (`setReceiptViewMode('dashboard')`).
  - Independent chevron button (`e.stopPropagation()`) toggles expandable submenu (`expandedGroup === 'receipts'`).
  - Clicking parent while expanded continues to navigate to `ReceiptDashboardView`.
- Collapsible Submenu contains **strictly two child items**:
  1. `Record Receipt` → navigates to `RecordReceiptView` (`setReceiptViewMode('create')`)
  2. `Receipt Register` → navigates to `ReceiptRegisterView` (`setReceiptViewMode('register')`)
- No redundant "Receipt Dashboard" submenu entry.
- Active Highlighting:
  - Parent item is `.active` when `activeTab === 'receipts'`.
  - `Record Receipt` child is `.active` when `receiptViewMode === 'create'`.
  - `Receipt Register` child is `.active` when `receiptViewMode === 'register'` or `'view'`.

### 1.2 Receipt Dashboard (`ReceiptDashboardView.tsx`)
Reference: `media_1793731281361_bced802c.jpg`
- **Header**: Breadcrumbs `Receipt > Receipt Dashboard`, Title `Receipt Dashboard`, Subtitle `Track collections, receipts and allocation status.`, Button `+ Record Receipt`.
- **4 Real-data KPI Cards**:
  1. `Total Received`: Sum of posted receipts in current active FY with authentic month-over-month trend and mini-bars.
  2. `Receipt Count`: Total count of receipts in current FY with MoM growth and mini-bars.
  3. `Allocated Amount`: Sum of amounts adjusted against invoices with percentage of total received (`(allocated / total) * 100%`) and progress indicator.
  4. `Unallocated Amount`: Total on-account / advance collections with percentage of total received and progress indicator.
- **Collection Trend Card**:
  - Bar chart showing monthly collections across the financial year (Apr to Mar).
  - `Value` / `Count` toggle pill buttons.
  - Zero-filling for empty months; 100% authentic reconciliation against database.
- **Receipt by Mode Card**:
  - Donut chart + tabular legend for Bank Transfer, UPI, Cash, Cheque, and Others.
  - Center label: `Total Received` and bold currency figure.
- **Needs Attention Card**:
  - 3 action rows with count badges and chevron links to register with active filter:
    1. `Unallocated Receipts`: Advance / On-account receipts
    2. `Partially Allocated`: Receipts not fully adjusted
    3. `Allocation Pending`: Recently recorded, not allocated
- **Recent Receipts Card**:
  - Table of recent 5-10 receipts with columns: `Date`, `Receipt No.`, `Customer / Party`, `Mode`, `Amount (₹)`, `Allocation`, `Status`.
  - Link `View Register →` navigates to Receipt Register.
  - Clicking receipt row or voucher number navigates to `ReceiptDetailsView`.

### 1.3 Record Receipt (`RecordReceiptView.tsx`)
Reference: `media_1793731281355_887f7050.jpg`
- **Header**: Breadcrumbs `Receipts > Record Receipt`, Title `Record Receipt`, Subtitle `Record customer payments and allocate against invoices.`
- **Actions Bar**:
  - `Save as Draft`
  - `Preview`
  - `Print / PDF`
  - `Save & Post` (primary orange)
- **Section A: Customer Details**:
  - Searchable customer combobox (by name, code, GSTIN, phone).
  - `+ New Customer` modal shortcut.
  - 2-column details card on selection: Party Name, Code, Address, Country, GSTIN, Phone, Email, State with state code.
- **Section B: Receipt Details**:
  - `Receipt No. *`: Auto-sequenced from authoritative numbering engine (`/vouchers/next-number?type=RECEIPT`).
  - `Receipt Date *`: Date picker defaulting to current active date.
  - `Reference No. (Optional)`: Input for UTR / Cheque / Bank ref.
  - `Receipt Remark (Optional)`: Remark input.
- **Section C: Receipt Mode**:
  - `Received Into *`: Bank or Cash ledger dropdown.
  - `Payment Mode *`: `Bank Transfer`, `UPI`, `Cash`, `Cheque`, `NEFT`, `RTGS`, etc.
  - `Reference No. (Optional)` and `Reference Date (Optional)`.
- **Section D: Allocate Invoices**:
  - Outstanding sales invoices table for selected customer:
    - Checkbox selection.
    - `Date`, `Invoice No.` (orange link), `Invoice Amount (₹)`, `Outstanding (₹)`, `Allocate Amount (₹)` input.
  - Search invoice / description filter + `Load Outstanding` button.
  - Invariants:
    - Capped at invoice pending amount (`invoice.total_amount_paise - invoice.paid_amount_paise`).
    - Capped at receipt total amount.
    - Support partial and multiple allocations.
    - Immediate real-time totals recomputation.
- **Section E: Amount Summary**:
  - `Total Received *` (input in Rupees, stored in integer paise).
  - `Allocated Amount`: Sum of allocated rows.
  - `Unallocated Amount`: `Total Received - Allocated Amount` (allocated to `ON_ACCOUNT`).
  - Large highlight box: `Total (Received)` `₹ 95,000.00` in bold orange.
  - `Accounting Entry (on Save & Post)` preview:
    - `Dr Bank/Cash <Ledger Name>`
    - `Cr <Customer Name>`
- **Section F, G, H**:
  - `Terms and Conditions`: Template selection and editable numbered terms.
  - `Internal Notes (Optional)`: Stored in draft metadata / notes; shielded from customer-facing print.
  - `Other Information`: Narration input.

### 1.4 Receipt Register (`ReceiptRegisterView.tsx`)
Reference: `media_1793731281346_407a5731.jpg`
- **Header**: Breadcrumbs `Receipts > Receipt Register`, Title `Receipt Register`, Subtitle `View, search and manage all receipt vouchers.`, Button `+ Record Receipt`.
- **5 Real-data KPI Cards**:
  1. `Total Received`
  2. `Receipt Count`
  3. `Fully Allocated`
  4. `Partially Allocated`
  5. `On Account`
- **Filter Bar**:
  - Search input (receipt no., customer, reference).
  - Date Range presets (`All`, `Today`, `This Month`, `This Quarter`, `FY`).
  - Customer dropdown.
  - Received Into dropdown (`All`, `Cash`, `Bank`).
  - Allocation status dropdown (`All`, `Fully Allocated`, `Partially Allocated`, `On Account`).
  - `More Filters` toggle.
  - Refresh button.
- **Register Table**:
  - Checkbox selection.
  - Columns: `Date`, `Receipt No.` (orange clickable), `Customer / Party`, `Received Into`, `Payment Mode`, `Amount (₹)`, `Allocation` (badge), `Status` (badge), `Actions` (View, Print, More).
  - Pagination with configurable rows per page (10, 25, 50).

### 1.5 Receipt Details (`ReceiptDetailsView.tsx`)
Reference: `media_1793731281183_11b55b47.jpg`
- **Header**: Breadcrumbs `Receipts > Receipt Register > RCT-XXXX`, Title `Receipt : RCT-XXXX`, Status badge `Posted`/`Draft`/`Cancelled`, Subtitle `Customer Receipt – <Customer Name>`, Actions `← Back`, `Duplicate`, `Print / PDF`, `⋮` (Cancel Voucher, Audit Log).
- **Cards Grid**:
  - `Customer / Party`: Name, code, address, phone, email.
  - `Receipt Details`: Voucher number, voucher date, reference number, remark.
  - `Payment Details`: Received into ledger, payment mode, reference date, UTR/Cheque number.
  - `Invoice Allocation`: Table showing all adjusted invoices (`#`, `Invoice No.`, `Invoice Date`, `Invoice Amount`, `Outstanding`, `Allocated Amount`).
  - `Amount Summary`: Total Received, Allocated Amount, Unallocated Amount, highlighted Total box.
  - `Terms and Conditions`: Stored terms list.
  - `Internal Notes`: Internal note card (visible on screen for internal staff).
  - `Accounting Entry`: Double entry breakdown (`Dr Cash/Bank`, `Cr Customer`).
  - `Voucher Timeline`: Horizontal event stepper (`Draft Created`, `Posted`, `Allocation Updated`) with authentic timestamps from audit_logs.

### 1.6 Receipt Printing (`ReceiptPrintModal.tsx`)
- Standard professional A4 printable receipt document.
- Header with company logo, company name, address, GSTIN, PAN, state.
- Document title: `RECEIPT VOUCHER`.
- Voucher details (Receipt No, Date, Payment Mode, Bank/Cash, Reference/UTR No).
- Customer details (Received With Thanks From, GSTIN, Address, Phone).
- Amount in figures and Amount in Words (Indian numbering).
- Invoices adjusted breakdown table.
- Terms & Conditions.
- Authorized Signatory block.
- Shielding invariant: Internal notes and dealer costs NEVER leak onto printed receipt.

---

## 2. Backend & Data Layer Enhancements

### 2.1 Multiple Invoice Allocations in `PostingEngine`
Extend `CreateVoucherInput` in `backend/src/domain/posting/posting-engine.ts`:
```ts
export interface CreateVoucherInput {
  ...
  billAllocation?: {
    referenceVoucherId?: string;
    allocationType: 'NEW_REF' | 'AGAINST_REF' | 'ADVANCE' | 'ON_ACCOUNT';
    dueDate?: string;
  };
  billAllocations?: Array<{
    referenceVoucherId?: string;
    allocationType: 'NEW_REF' | 'AGAINST_REF' | 'ADVANCE' | 'ON_ACCOUNT';
    amountPaise: number;
    dueDate?: string;
  }>;
}
```
In `_postVoucherInternal`:
- When `input.billAllocations` is provided:
  - Validate each referenced voucher: exists, same `companyId`, `status != 'CANCELLED'`.
  - Validate allocation amount does not exceed invoice outstanding: `amountPaise <= (refVch.total_amount_paise - paidPaise)`.
  - Insert rows into `bill_allocations`.
  - If total allocated paise < party receipt amount, insert remainder as `ON_ACCOUNT`.
- If singular `input.billAllocation` is provided, preserve existing single-allocation behavior.
- In `_draftMeta`: persist `billAllocations` so draft receipts retain all allocated invoices when reopened or posted.

### 2.2 Enriched Bill Allocations in `GET /vouchers/:id`
Update `GET /vouchers/:id` query in `backend/src/api/routes.ts`:
Join both `vouchers v` (the allocating voucher) and `vouchers ref_v` (the target sales invoice) so the client receives invoice numbers, invoice dates, invoice total amounts, and pending amounts directly.

### 2.3 Enriched Voucher List for Receipts in `GET /vouchers?type=RECEIPT`
Compute `allocated_amount_paise` and `unallocated_amount_paise` for each receipt voucher:
- `allocated_amount_paise`: sum of `bill_allocations` where `allocation_type = 'AGAINST_REF'`.
- `unallocated_amount_paise`: `total_amount_paise - allocated_amount_paise`.
- `allocation_status`:
  - `Fully Allocated` when `unallocated_amount_paise === 0 && allocated_amount_paise > 0`
  - `Partially Allocated` when `allocated_amount_paise > 0 && unallocated_amount_paise > 0`
  - `On Account` when `allocated_amount_paise === 0`

---

## 3. Verification & Testing Strategy

1. **Unit & Accounting Test Suite** (`backend/tests/ui042-receipt-module.test.ts`):
   - Receipt voucher number auto-generation.
   - Draft receipt creation and zero ledger/allocation impact.
   - Posting atomic double-entry records (`Dr Bank/Cash`, `Cr Customer`).
   - Single invoice full allocation.
   - Single invoice partial allocation.
   - Multiple invoices allocation (matching screenshot scenario: INV-0038 ₹35,000 + INV-0041 ₹60,000 = ₹95,000).
   - On-account / unallocated receipt.
   - Server-side validation: over-allocation rejection, cancelled invoice allocation rejection, cross-company security isolation.
   - Cancellation with reversal ledger entries.
   - Dashboard & Register metric calculations.
2. **Frontend Navigation & Component Integration**:
   - Sidebar structure: Receipts parent $\to$ Dashboard; submenu contains strictly Record Receipt and Receipt Register.
   - Browser navigation, hotkeys `Alt+R` and `F6`.
   - Routing: Dashboard $\leftrightarrow$ Creation $\leftrightarrow$ Register $\leftrightarrow$ Details $\leftrightarrow$ Print.
3. **Existing Regression Verification**:
   - UI-041 Quotation Sidebar Navigation (`ui041-quotation-sidebar-navigation.test.ts`)
   - UI-040 Visual Consistency (`ui040-visual-consistency.test.ts`)
   - UI-039 Quotation Rebuild (`ui039-quotation-rebuild.test.ts`)
   - UI-024 Smart Pricing (`ui024-smart-pricing.test.ts`)
   - Production build (`npm run build`).

