# UI-039 Implementation Plan: Quotation Module Rebuild, Print Engine Fix & Smart Pricing Integration

**Objective:** Stabilize and upgrade the complete LedgerFlow Quotation module to production-grade parity with Sales and Purchase, adhering strictly to the LedgerFlow Design System and the three supplied reference screenshots (Quotation Register, Quotation Dashboard, Quotation View).

---

## 1. Trace Analysis & Root Cause Audit

### 1.1 Trace Workflow
$$\text{Form State} \longrightarrow \text{Calculation Engine} \longrightarrow \text{Storage / DB} \longrightarrow \text{Preview / Print} \longrightarrow \text{Register} \longrightarrow \text{Details} \longrightarrow \text{Sales Conversion}$$

### 1.2 Identified Root Causes
1. **Property Mapping Mismatch in Print Adapter (`InvoiceAdapter.ts`):**
   - In `normalizeQuotationData`, line item rates were mapped from `item.unitPrice` instead of `item.rate ?? item.unitPrice`, causing rate values to fall back to `0.00`.
   - Tax line properties (`cgstAmount`, `sgstAmount`, `igstAmount`) were mapped from `item.cgst`, `item.sgst`, `item.igst`, causing tax breakdowns to evaluate to `0` or empty.
   - Quotation subtotal and grand total looked for `q.taxAmount` and `q.totalAmount` instead of `q.grandTotal` and calculated tax totals, producing mismatched summaries.
2. **Incorrect Document Identity in Print Templates:**
   - `StandardInvoice.tsx`, `SimpleInvoice.tsx`, and `ThermalInvoice.tsx` evaluated `data.voucherType === 'PURCHASE' ? ... : 'TAX INVOICE'`. As a result, all quotations were mislabeled as `TAX INVOICE`.
   - Field labels displayed `Invoice No`, `Invoice Date`, `Due Date` instead of `Quotation No`, `Quotation Date`, `Valid Until`.
3. **Multi-Page A4 Pagination Engine Deficiencies:**
   - `printPagination.ts` allowed up to 9–10 items on page 1 before splitting, crowding against the footer.
   - When content flowed to page 2, `StandardInvoice.tsx` forced a `minHeight: 660px` empty filler row, creating a huge blank table and in many cases forcing a 3rd blank page with only the footer.
4. **Quotation Tax Presentation Setting Missing:**
   - Lack of a dedicated setting for "Show GST Breakdown" vs "Show Final Price Without Separate GST Breakdown".
5. **Navigation & Module Hierarchy Gap:**
   - Sidebar had `Quotation` as a flat item without the standard expandable submenu (`Quotation Dashboard`, `Create Quotation`, `Quotation Register`).
   - `App.tsx` only had `'dashboard'` and `'create'` views, lacking dedicated `'register'` and `'view'` views.
6. **Hardcoded Fallbacks in Quotation Creation:**
   - In `QuotationCreationView.tsx`, customer details fell back to `'ABC Enterprises'`, `'CUS-001'`, and `'Coimbatore'`.

---

## 2. Implementation Architecture

### Phase 1: Storage & Models (`quotationStorage.ts`)
- Extend `QuotationRecord` to support:
  - `showGstBreakdown: boolean` (default `true`)
  - `status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED'`
  - Full audit timestamps, customer code, sales person, validity dates.
- Ensure multi-tenant isolation, sequential numbering (`QTN-YYYY-XXXXX`), and clean JSON serialization.

### Phase 2: Quotation Creation Fix (`QuotationCreationView.tsx`)
- Form state is authoritative.
- Remove synthetic customer defaults (`ABC Enterprises`, etc.).
- Tax Presentation Toggle: "Show GST Breakdown" vs "Show Final Price Without Separate GST Breakdown".
- Support both GST-inclusive and GST-exclusive pricing with exact integer-paise calculations.
- Clean breadcrumb: `Quotation > Create Quotation`.
- Instant preview and print modal reflection without persisting to DB.
- Reconcile words formatting with rounded grand total.

### Phase 3: Print & Preview Normalization (`InvoiceAdapter.ts`, `StandardInvoice.tsx`, `SimpleInvoice.tsx`, `ThermalInvoice.tsx`)
- Fix `normalizeQuotationData` mapping for `rate`, `quantity`, `hsnSac`, `cgstAmount`, `sgstAmount`, `igstAmount`, `taxableAmount`, `totalAmount`, `grandTotal`.
- Display **QUOTATION** title when `voucherType === 'QUOTATION'`.
- Correct subtitle: `PRICE OFFER • ORIGINAL FOR CUSTOMER`.
- Correct labels: `Quotation No`, `Quotation Date`, `Valid Until`.
- Calibrate A4 Pagination:
  - Max 7 normal rows on page 1.
  - Continuation page for rows $> 7$ with repeated headers and compact continuation title.
  - Totals, amount in words, bank, and signature on final page.
  - Eliminate oversized empty filler row on continuation page to prevent unnecessary 3rd pages.

### Phase 4: Smart Pricing & Online Reference Preservation
- Retain all 5 pricing methods (Target Profit, Target Total, Markup %, Gross Margin %, Manual).
- Retain 3 allocation modes (Proportional to Cost, Proportional to Qty, Equal).
- Retain all 6 rounding steps (Exact, ₹1, ₹5, ₹10, ₹50, ₹100).
- Preserve existing online reference matching and manual reference price entry.
- Strict invariant: dealer cost and margins never leak to customer-facing outputs.

### Phase 5: Quotation Dashboard (`QuotationDashboardView.tsx`)
- Match `media_2` screenshot:
  - 5 KPI cards: Total Quotations, Total Quoted Value, Converted to Sales, Awaiting Response, Expired.
  - Quotation Trend bar chart (monthly turnover with Value / Count toggle).
  - Conversion Overview donut chart (Converted, Awaiting Response, Expired percentages).
  - Needs Attention cards (Expiring Soon, Awaiting Response, Expired).
  - Recent Quotations list (5 latest quotations with status badges and quick view).
  - Quick Actions (Create Quotation, Duplicate Quotation, Convert to Sales Invoice, Print / PDF).

### Phase 6: Quotation Register (`QuotationRegisterView.tsx`)
- Match `media_1` screenshot:
  - 5 KPI summary cards: Total Quotations, Converted, Awaiting Response, Rejected, Expired.
  - Filter bar: Date Range, Customer / Party, Status, Validity.
  - Search: Quotation number, customer name, customer code.
  - Data table: Checkbox, Date, Quotation No (orange link), Customer / Party, Valid Until, Amount (₹) (bold, right-aligned), Status pill badges, Actions.
  - Sorting, pagination (10 per page), page size selector, export, view, edit draft, print, convert.

### Phase 7: Quotation Details / View (`QuotationDetailsView.tsx`)
- Match `media_3` screenshot:
  - Breadcrumbs: `Quotation > Quotation Register > QTN-2026-0049`.
  - Header: Quotation No, status badge, subtitle, actions (`Back`, `Edit`, `Duplicate`, `Print / PDF`, `Convert to Sales Invoice` orange CTA).
  - 3-column top cards: Customer Details, Quotation Details, Status & Timeline.
  - 2-column middle cards: Item Details table (with Tax Inclusive / Exclusive toggle), Amount Summary card with orange Grand Total and Amount in Words.
  - Bottom row: Terms & Conditions, Notes, Other Information.

### Phase 8: Navigation & Layout Integration (`Sidebar.tsx`, `App.tsx`, `AppShell.tsx`)
- Sidebar expandable accordion under TRANSACTIONS:
  - **Quotation** (orange active highlight)
    - Quotation Dashboard
    - Create Quotation
    - Quotation Register
- Single-open accordion logic synchronized with Sales and Purchase.
- `quotationViewMode` in state: `'dashboard' | 'create' | 'register' | 'view'`.
- Quotation Details opens directly upon clicking quotation number in register or dashboard.

### Phase 9: Testing & Automated Verification
- Create dedicated `test-ui039-quotations-e2e.test.ts` covering:
  1. Creation with 1 item and 10 items.
  2. Rate and amount parity across form, preview, and print.
  3. GST-inclusive and GST-exclusive calculation.
  4. CGST/SGST vs IGST.
  5. GST breakdown visibility setting.
  6. Amount in words match.
  7. Smart pricing methods & allocation.
  8. Online price lookup & manual reference.
  9. Zero cost leakage to print/preview.
  10. Dashboard metrics & conversion rates.
  11. Register search, filter, and sorting.
  12. Quotation to Sales Invoice conversion (with duplicate prevention).
  13. Print pagination page counts (1 item, 7 items, 8 items, 15 items).
- Run full test suite, TS checks, and frontend build.

---

## 3. Implementation Order
1. Update `quotationStorage.ts` (data contracts).
2. Fix `InvoiceAdapter.ts` (`normalizeQuotationData` property mapping).
3. Update print templates (`StandardInvoice.tsx`, `SimpleInvoice.tsx`, `ThermalInvoice.tsx`) for `QUOTATION` identity.
4. Refine pagination engine in `printPagination.ts` and `StandardInvoice.tsx`.
5. Create `QuotationDashboardView.tsx`.
6. Create `QuotationRegisterView.tsx`.
7. Create `QuotationDetailsView.tsx`.
8. Update `QuotationCreationView.tsx`.
9. Update `Sidebar.tsx` and `App.tsx` for full 4-tier navigation.
10. Implement and run automated test suite.
11. Produce implementation report and update `STATUS.md`.
