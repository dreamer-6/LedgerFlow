# UI-046 Implementation Plan: Serialized Purchase Workflow, Invoice Print Enhancements & Register UI Stabilization

## Executive Summary
This implementation plan addresses the end-to-end serialized item lifecycle across Item Master, Purchase Entry, Posting Engine, Sales Invoicing, Invoice Printing (Standard, Simple, Thermal), and Register UI dropdown stabilization in LedgerFlow.

---

## 1. Architectural Scope & Root Cause Diagnosis

### 1.1 Item Master & Quick Creation Discrepancy
- **Root Cause**: `QuickItemModal.tsx` lacked the `hasSerialNo` tracking toggle, meaning quick-created items were saved with `has_serial_no = 0`. Furthermore, `PUT /masters/items/:id` in `backend/src/api/routes.ts` omitted `has_serial_no` from its update query, preventing toggling serial tracking on existing items.
- **Fix**:
  1. Add `hasSerialNo` toggle in `QuickItemModal.tsx`, pass in payload to `POST /masters/items`, and propagate `has_serial_no` in `onSuccess`.
  2. Update `PUT /masters/items/:id` to persist `has_serial_no = COALESCE(?, has_serial_no)`.

### 1.2 Redundant New Item Buttons & Contaminated Item Labels
- **Root Cause**: Both `PurchaseInvoiceView.tsx` and `SalesInvoiceView.tsx` had an inline `+` icon button next to the item selector, creating UI clutter and confusing duplication with the primary `+ New Item` header button. Additionally, `PurchaseInvoiceView.tsx` option labels concatenated `(HSN: ...)` into the name string.
- **Fix**:
  1. Remove duplicate inline `+` button in both views.
  2. Standardize dropdown option labels to `{it.item_name}` only.
  3. Ensure the header `+ New Item` button reliably opens `QuickItemModal`, refreshes item lists, and sets newly created items on the active row.

### 1.3 Purchase Serial Number Allocation UI
- **Root Cause**: The serial allocation button in `PurchaseInvoiceView.tsx` lacked explicit counter clarity (`X / Y Serials Allocated`) and needed consistent status badges matching the design system.
- **Fix**:
  1. Render dynamic counter: `${count} / ${line.quantity} Serials Allocated`.
  2. Badge styling: Green (`#16A34A` / `#DCFCE7`) when exact match (`count === quantity`), Orange (`#EA580C` / `#FFEDD5`) when 0 allocated, Amber (`#D97706` / `#FEF3C7`) when partially allocated.
  3. Enforce exact match check before posting, allowing draft saving with partial/empty serials.

### 1.4 Invoice Print Templates & Historical Retrieval
- **Root Cause**:
  1. Print templates (`StandardInvoice`, `SimpleInvoice`, `ThermalInvoice`) did not render `Serial No: ...` beneath item descriptions in a standardized fashion.
  2. For historical vouchers without `voucher_lines.serial_number` populated, backend `GET /vouchers/:id` did not resolve serials from `stock_item_serials`.
- **Fix**:
  1. In `backend/src/api/routes.ts` (`GET /vouchers/:id`), join `stock_item_serials` for sales/purchase vouchers when `serial_number` is missing on the line, without inventing serials.
  2. In `StandardInvoice.tsx`, `SimpleInvoice.tsx`, and `ThermalInvoice.tsx`, render `Serial No: ${item.serialNumber}` directly beneath item descriptions.
  3. In `printPagination.ts`, update `estimateItemRowHeight` to calculate row height factoring multi-serial text lines (`+ 16 * serialLines`).

### 1.5 Continuation Header on Multi-Page Documents
- **Root Cause**: `StandardInvoice.tsx` continuation header lacked company GSTIN and party details, while `SimpleInvoice.tsx` lacked multi-page continuation headers entirely.
- **Fix**:
  1. Standardize continuation header across pages 2+: Company Name, GSTIN, `(Continued)` badge, Customer/Supplier Name, Invoice #, and Date.
  2. Repeat table headers across all pages.

### 1.6 Register Action Menu Clipping
- **Root Cause**: In `PurchaseRegisterView.tsx` and `SalesRegisterView.tsx`, 3-dot dropdown menus were positioned relatively inside table cells nested within `overflow-x: auto` containers, clipping menu content or forcing unwanted scrollbars.
- **Fix**:
  1. Implement React Portal (`createPortal`) targeting `document.body` with fixed viewport coordinates and boundary detection (`openUp` when near screen bottom).

### 1.7 Truthful Warranty Display
- **Root Cause**: `ItemsView.tsx` contained hardcoded `'1-3 Years'`, `'1Y'`, and default `'1'` initial values, fabricating warranties on items without manufacturer guarantees.
- **Fix**:
  1. Default warranty to 0.
  2. Only display warranty badges or text when `warranty_months > 0`.

---

## 2. Implementation Checklist

| Phase | Component | Action | Verification |
|-------|-----------|--------|--------------|
| 1 | Backend API (`routes.ts`) | Add `has_serial_no` to `PUT /masters/items/:id`; enhance `GET /vouchers/:id` with serial fallback | Unit test |
| 2 | QuickItemModal (`QuickItemModal.tsx`) | Add serial tracking toggle; pass to API | Form test |
| 3 | ItemsView (`ItemsView.tsx`) | Eliminate invented warranty strings; default warranty to 0 | UI check |
| 4 | Purchase Creation (`PurchaseInvoiceView.tsx`) | Clean item label; remove duplicate plus; dynamic allocation badge | UI check |
| 5 | Sales Creation (`SalesInvoiceView.tsx`) | Clean item label; remove duplicate plus; truthful warranty badge | UI check |
| 6 | Invoice Printing (`StandardInvoice`, `SimpleInvoice`, `ThermalInvoice`) | Render `Serial No: ...` beneath item description | Print test |
| 7 | Pagination Engine (`printPagination.ts`) | Adjust height estimation for serial lines | Pagination test |
| 8 | Multi-Page Continuation | Company GSTIN, party name, continuation badge on pages 2+ | Multi-page test |
| 9 | Register UI (`PurchaseRegisterView`, `SalesRegisterView`) | Portal action menu to `document.body` with boundary check | Dropdown test |
| 10 | Automated Test Suite | Create `backend/tests/ui046-serial-invoice-register.test.ts` (22 tests) | 100% pass |
| 11 | Full Regression & Build | Run full test suite & frontend production build | 0 errors |

---

## 3. Deliverables
1. `UI-046-IMPLEMENTATION-PLAN.md` (this file)
2. `UI-046-IMPLEMENTATION-REPORT.md`
3. `UI-046-PRINT-QA-REPORT.md`
4. Updated `STATUS.md`

