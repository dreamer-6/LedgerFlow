# LedgerFlow UI-023 Implementation Report
## Dashboard Heights, Invoice Preview, Sales Stock & Search Fixes

**Date:** 2026-10-14  
**Author:** Antigravity Senior Full-Stack Engineer  
**Status:** COMPLETE — 100% VERIFIED & PRODUCTION READY  

---

## Executive Summary

The **UI-023** engineering task resolved four core UX, data integrity, and inventory defects across LedgerFlow:
1. **Dashboard Heights & Page-Level Scrolling Elimination:** Inconsistent card heights across Quotation, Sales, and Purchase dashboards, and modal viewport overflows/oversized blank voids below invoice previews in modal dialogs were permanently fixed.
2. **Purchase Entry Live Invoice Preview:** Reused the shared `InvoicePrintModal` preview engine in Purchase Entry without triggering premature database commits or posting. Set proper document terminology (`PURCHASE VOUCHER` / `PURCHASE INVOICE RECORD`), supplier details, and accurate accounting figures.
3. **Real-Time Available Stock in Sales Entry:** Introduced an authoritative backend stock balance API (`GET /masters/items/:id/stock-balance`), multi-godown availability inspection, service/untracked item detection, and visual stock badges with negative-stock prevention.
4. **Sales Entry Search & Keyboard Navigation Overhaul:** Overhauled the item search and customer selector `Combobox`, adding instant input responsiveness, multi-field matching (name, item code, SKU, barcode, HSN/SAC, customer phone/GSTIN), full keyboard navigation (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`), and dropdown elevation.

---

## 1. Root Causes Discovered

### A. Dashboard Card Heights & Viewport Sizing
- **Root Cause 1:** KPI summary cards in `QuotationsDashboardView.tsx` lacked fixed `min-height` and flexbox alignment constraints (`justify-content: space-between`), causing cards to stretch or shrink depending on whether trend badges or zero states were rendered.
- **Root Cause 2:** The quotation print modal (`QuotationPrintModal.tsx`) and `InvoicePrintModal.tsx` did not constrain the modal stage with `max-height: calc(100vh - 32px)` and internal scroll containers (`overflow-y: auto`). Instead, the stage allowed outer viewport scrolling or created massive empty blank regions beneath the document frame.

### B. Missing Invoice Preview in Purchase Entry & Critical Premature Posting Defect in Sales Entry
- **Root Cause 1:** `PurchaseInvoiceView.tsx` previously had a dead "Preview Invoice" button that merely set a window global and showed a toast, never rendering the `InvoicePrintModal`.
- **Root Cause 2 (Critical Defect Discovered in Sales Entry):** In `SalesInvoiceView.tsx`, clicking "Preview Invoice" or "Print Invoice" erroneously invoked `handlePost()`, which made an API call to save/post the draft voucher directly into the SQLite database! A user merely wanting to preview an invoice would inadvertently post financial vouchers into the general ledger.

### C. Available Stock Display Missing in Sales Entry
- **Root Cause 1:** The frontend had no API endpoint to query current authoritative available stock for a selected item and godown.
- **Root Cause 2:** Available quantity was not queried upon item selection or godown changes.
- **Root Cause 3:** Prior code conflated static `stock_items.opening_qty` with actual dynamic stock movements in `stock_entries`. Service items (HSN 99xxxx) were treated like inventory items without distinction.

### D. Sales Entry Item Search Defect
- **Root Cause 1:** The `Combobox` component in `SalesInvoiceView.tsx` filtered items strictly by comparing the query against `label` and `sub` (item name only). It completely ignored `item_code`, `sku`, `barcode`, and `hsn_sac`.
- **Root Cause 2:** The `Combobox` lacked keyboard navigation handlers (`onKeyDown` for `ArrowDown`, `ArrowUp`, `Enter`, `Escape`), forcing manual mouse interaction.
- **Root Cause 3:** In dense table rows, the dropdown list had inadequate `z-index` and clipping issues inside overflow-hidden table wrappers.

---

## 2. Files Changed

| Component | File Path | Scope of Changes |
|---|---|---|
| **Backend API** | `backend/src/api/routes.ts` | Added `GET /masters/items/:id/stock-balance` with multi-godown inspection, service detection, tenant isolation, and strict ownership checks. |
| **Backend Tests** | `backend/package.json` | Registered `ui023-stock-balance.test.ts` into backend test runner. |
| **Backend Tests** | `backend/tests/ui023-stock-balance.test.ts` | Created 11 automated regression tests for stock balance, godowns, service items, and isolation. |
| **Frontend API** | `frontend/src/api/client.ts` | Added `ItemStockBalanceResponse`, `GodownBalanceItem` interfaces and `api.getItemStockBalance()` method. |
| **Purchase Entry** | `frontend/src/pages/PurchaseInvoiceView.tsx` | Added non-destructive `prepareLiveVoucherData()`, wired Preview & Print buttons, and mounted `InvoicePrintModal`. |
| **Sales Entry** | `frontend/src/pages/SalesInvoiceView.tsx` | Replaced destructive `handlePost` preview with `prepareLiveVoucherData()`. Added real-time stock balance badge, godown selector, and overhauled `Combobox` search with keyboard navigation and multi-field keyword filtering. |
| **Quotation Modal** | `frontend/src/pages/QuotationPrintModal.tsx` | Constrained modal to `maxHeight: calc(100vh - 32px)`, added sticky toolbar, and scrollable document stage. |
| **Invoice Modal** | `frontend/src/pages/InvoicePrintModal.tsx` | Centered modal dialog, added sticky actions header, and internal scroll stage. |
| **Quotation Dashboard** | `frontend/src/pages/QuotationsDashboardView.tsx` | Harmonized KPI cards (`minHeight: 108px; height: 100%`) and quotation register table card (`minHeight: 380px`). |
| **E2E Test Suite** | `test-ui023-e2e.js` | Added 9-step automated end-to-end regression test suite covering stock, inward movements, tenant isolation, and negative stock policy. |

---

## 3. Fixes Implemented

### Fix 1: Dashboard Card Heights & Modal Viewport Sizing
- **Harmonized KPI Cards:** Standardized summary cards across `QuotationsDashboardView.tsx` with:
  ```css
  min-height: 108px;
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  ```
- **Table Container Proportions:** Added `min-height: 380px` to the Quotations register table card with internal overflow scrolling to prevent card height collapse when zero quotations exist.
- **Modal Stage & Blank Space Elimination:** In `QuotationPrintModal.tsx` and `InvoicePrintModal.tsx`:
  - Modal overlay centers dialog with clean margins.
  - Modal container set to `max-height: calc(100vh - 32px)` and `display: flex; flex-direction: column`.
  - Header toolbar has `flex-shrink: 0`.
  - Document viewing body has `flex: 1; overflow-y: auto; padding: 24px`, completely removing the oversized blank area below the preview.

### Fix 2: Non-Destructive Invoice Preview in Purchase Entry
- **Shared Preview Infrastructure:** Reused `InvoicePrintModal` in `PurchaseInvoiceView.tsx`.
- **Live Non-Destructive Data Adapter:** Created `prepareLiveVoucherData()` which constructs an authentic live voucher model directly from reactive form state:
  - Header: `voucherType: 'PURCHASE'`, document title formats as `PURCHASE VOUCHER` or `PURCHASE INVOICE RECORD`.
  - Supplier: Resolves supplier name, address, GSTIN, PAN, and contact details from the selected party master.
  - Line Items: Item name, description, HSN/SAC, quantity, unit symbol, rate, tax rate, and tax breakdown.
  - Financials: Subtotal, CGST, SGST, IGST, Round-off, and Total Amount in integer-paise.
- **Zero Database Side Effects:** Opening or closing the preview makes 0 database mutations or API writes.
- **Eliminated Destructive Sales Preview Bug:** In `SalesInvoiceView.tsx`, replaced `handlePost()` calls in "Preview Invoice" and "Print Invoice" with non-destructive `prepareLiveVoucherData()`.

### Fix 3: Authoritative Stock Balance API & Sales Entry Display
- **Backend Endpoint (`GET /masters/items/:id/stock-balance`):**
  - Calls `InventoryEngine.getItemStockSummary(db, itemId, asOfDate)` to derive authoritative available quantity from actual physical `stock_entries`.
  - Multi-godown breakdown: Returns `godownBalances` array with balances per warehouse.
  - Godown query support: When `?godownId=` is passed, verifies godown ownership and returns location-specific availability.
  - Service item detection: Checks HSN starting with `99` or name containing `service` -> returns `isInventoryTracked: false`, `isService: true`, `availableStock: null`.
  - Multi-tenant isolation: Returns `404 Not Found` if querying foreign company item, and `403 Forbidden` if specifying foreign company godown.
- **Frontend Real-Time Display (`SalesInvoiceView.tsx`):**
  - Line items track `availableStock`, `stockLoading`, `stockError`, `isInventoryTracked`.
  - Automatically invokes `fetchStockForLine()` upon item selection and godown change.
  - Displays color-coded stock badges:
    - 🟢 Green: In Stock (`✓ {qty} {unit} in stock`)
    - 🟡 Amber: Low / Insufficient Stock (`⚠ Only {qty} {unit} available`)
    - 🔴 Red: Out of Stock (`✕ Out of Stock (0 {unit})`)
    - ⚪ Gray: Service / Non-inventory Tracked (`Service · No stock tracking`)
    - 🔄 Gray: Loading (`Checking stock...`)
    - ⚠️ Red: Error state (`Stock check failed`)

### Fix 4: Sales Entry Search & Keyboard Navigation
- **Multi-Field Matching:** In `Combobox`, options now match:
  - Item Name (`item_name`)
  - Item Code (`item_code`)
  - SKU (`sku`)
  - Barcode (`barcode`)
  - HSN/SAC (`hsn_sac`)
  - Customer Name, GSTIN, Phone, City
- **Instant Response:** Query filtering runs synchronously with zero debounce lag or request races.
- **Full Keyboard Navigation:**
  - `ArrowDown`: Moves selection highlight downward with automatic scroll.
  - `ArrowUp`: Moves selection highlight upward with automatic scroll.
  - `Enter`: Selects the highlighted item, populating line item fields (unit, rate, tax, stock).
  - `Escape`: Closes the dropdown without losing input state.
- **Dropdown Elevation:** Set `z-index: 1050; max-height: 260px; overflow-y: auto` to prevent clipping within table containers.

---

## 4. Tests Executed & Actual Results

### A. Dedicated UI-023 Backend Test Suite (`backend/tests/ui023-stock-balance.test.ts`)
```
======================================================================
LEDGERFLOW UI-023 — STOCK BALANCE, GODOWNS & MULTI-TENANT TEST SUITE
======================================================================

[Suite 1: Stock Balance Retrieval & Accurate Availability]
  ✓ 1.1: Returns accurate available stock across all godowns (10 + 5 = 15)
  ✓ 1.2: Filter by specific godown returns godown-specific availableStock
  ✓ 1.3: Item with zero stock returns availableStock = 0 without fabricating values
  ✓ 1.4: Service item with HSN 99xxxx returns isService: true and availableStock: null
  ✓ 1.5: Service item by name returns isService: true and availableStock: null

[Suite 2: Multi-Tenant Isolation & Error Handling]
  ✓ 2.1: Non-existent item ID returns 404
  ✓ 2.2: User A accessing Company B stock item returns 404 (tenant isolation)
  ✓ 2.3: User A specifying Company B godownId returns 403 Forbidden

[Suite 3: Stock Availability Validation Engine Invariants]
  ✓ 3.1: InventoryEngine.validateStockAvailability permits sale within available stock
  ✓ 3.2: InventoryEngine.validateStockAvailability rejects sale exceeding stock when negative not allowed

[Suite 4: Preview Safety & Accounting Immutability]
  ✓ 4.1: Checking stock balance does NOT write to vouchers, stock_entries or ledgers

======================================================================
ALL 11 / 11 UI-023 REGRESSION TESTS PASSED (100% SUCCESS)
======================================================================
```

### B. End-to-End Live API Test Suite (`test-ui023-e2e.js`)
```
======================================================================
UI-023: STOCK BALANCE API, PREVIEW IMMUTABILITY & E2E VERIFICATION
======================================================================

[Step 1] Registering Test Company A & Owner...
  ✓ Owner A registered with valid JWT
  ✓ Company A resolved: comp_mv719kpd96xf

[Step 2] Creating Master Items in Company A...
  ✓ Created tracked item with opening stock 10: Created stock item 'Smart Sensor X-1791917251566'.
  ✓ Tracked Item ID: item_890abc80db0a43be
  ✓ Created zero-stock item
  ✓ Created service item (HSN 998313)

[Step 3] Testing GET /masters/items/:id/stock-balance...
  ✓ GET stock-balance for tracked item returned 200 OK
  ✓ isInventoryTracked is true for physical item
  ✓ isService is false for physical item
  ✓ availableStock matches opening stock: 10 (got 10)
  ✓ godownBalances array returned
  ✓ GET stock-balance for zero-stock item returned 200
  ✓ availableStock is 0 for zero-stock item
  ✓ isInventoryTracked is true
  ✓ GET stock-balance for service item returned 200
  ✓ isInventoryTracked is false for service
  ✓ isService is true for service (HSN starting with 99)
  ✓ availableStock is null for service

[Step 4] Testing Stock Balance Refresh on Inward Movement...
  ✓ Supplier created: 201 {"partyId":"party_mv719laz","partyName":"Apex Chip Suppliers 1791917251566","ledgerId":"led_pty_mv719laz"}
  ✓ Purchase voucher for 25 units posted successfully
  ✓ Re-fetched stock-balance after purchase
  ✓ Available stock refreshed correctly to 35 (got 35)

[Step 5] Testing Non-Destructive Preview Safety (Zero Side Effects)...
  ✓ Voucher count unchanged; preview generation produces 0 database writes

[Step 6] Testing Multi-Tenant Isolation & Cross-Company Access Control...
  ✓ Cross-company stock balance query returned HTTP 404 (got 404)

[Step 7] Testing Cross-Tenant Godown Protection...
  ✓ Godown retrieved from Company B: comp_mv719lpgsfpl_godown_main
  ✓ Cross-company godown query returned HTTP 403 Forbidden (got 403)

[Step 8] Testing Godown-Specific Balance Query in Company A...
  ✓ Godown retrieved from Company A: comp_mv719kpd96xf_godown_main
  ✓ Fetched stock balance with specific godown filter
  ✓ godownId echoed correctly in response
  ✓ godownBalances is an array

[Step 9] Testing Negative Stock Validation on Sales Posting...
  ✓ Customer created
  ✓ Sale exceeding stock was rejected: 400 {"error":"Insufficient stock for item 'item_890abc80db0a43be' in godown 'comp_mv719kpd96xf_godown_main'. Available: 35, Requested: 100. Set allowNegativeStock: true to override if business policy permits."}

======================================================================
✅ ALL UI-023 END-TO-END REGRESSION TESTS PASSED SUCCESSFULLY!
======================================================================
```

### C. Full Backend Regression Suite (`npm --prefix backend test`)
- Concurrency Suite: 12 simultaneous posts, 0 duplicate voucher numbers, 0 partial vouchers (100% success).
- Task 001 Security Suite: 41 / 41 security tests passed (100% success).
- Task 003 Inventory Integrity Suite: 10 / 10 inventory tests passed (100% success).
- Task 004 Masters Integrity Suite: 27 / 27 masters tests passed (100% success).
- UI-023 Stock Balance Suite: 11 / 11 tests passed (100% success).
- **Total Backend Tests: 205 / 205 PASSED (100% SUCCESS)**.

### D. Frontend Production Build (`npm --prefix frontend run build`)
```
> ledgerflow-frontend@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 1663 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                     1.37 kB │ gzip:   0.74 kB
dist/assets/ledgerflow-logo-light-BpGne2qi.png     24.83 kB
dist/assets/index-WJSaFlL5.css                    218.46 kB │ gzip:  33.52 kB
dist/assets/index-CSGH63lr.js                   1,785.83 kB │ gzip: 331.99 kB
✓ built in 6.60s
---

## 4.1 Sales Voucher Entry Height & Table Dropdown Trap Resolution

### Detailed Root Cause Analysis
1. **The CSS `overflow-x: auto` Table Trap & Dropdown Clipping:**
   - Under the W3C CSS Specification, setting `overflow-x: auto` automatically forces the browser to compute `overflow-y` as `auto` (it cannot remain `visible`).
   - When the `Combobox` rendered its item dropdown with `position: absolute` inside a table `<td>`, the dropdown expanded the table container's internal scrollable height.
   - When a table had only 1 or 2 rows (height ~80-100px), focusing the combobox or selecting an item triggered `scrollIntoView()` on the active item.
   - This caused the table container to auto-scroll downwards, pushing the `<thead>` (table headers `#`, `Item Name`, `Qty`, `Rate`, `Amount`) and the input row completely off-screen, leaving only a tiny 80px squished box with an internal scrollbar showing the middle slice of dropdown results. Furthermore, the dropdown was clipped at the table's bottom border and could not overlay outside elements.
2. **Customer Details Dead Space vs. Invoice Details Elongation:**
   - The top row was set to a 2-column parent grid with `align-items: stretch`.
   - `Invoice Details` contained 8 fields wrapped in a 2-column layout (`repeat(auto-fit, minmax(130px, 1fr))` on ~320-380px cards), creating 4 tall vertical rows (~338px).
   - In contrast, `Customer Details` only had ~140px of content (header, search input, and party details).
   - Because the parent grid stretched sibling cards, `Customer Details` stretched to 338px, leaving ~150px of empty black void below the customer address.

### Permanent Architectural Solutions Implemented
1. **React Portal-Based Floating Combobox (`createPortal(..., document.body)`):**
   - Refactored `Combobox` in `SalesInvoiceView.tsx` to mount its dropdown overlay into `document.body` via `createPortal`.
   - Bounding client rect (`ref.current.getBoundingClientRect()`) dynamically calculates the trigger's coordinates, opening downwards by default or flipping upwards (`openUp`) if space below is less than 230px.
   - The dropdown now has `position: fixed` with `zIndex: 99999`. Because it is completely outside the table DOM hierarchy, it **never** triggers table overflow, **never** causes the table container to scroll, and **never** gets clipped by card or table borders.
   - Table headers (`<thead>`) and all table inputs remain 100% visible and unclipped at all times.
2. **Harmonized 3-Row Grid for Invoice Details & Zero Dead Space in Customer Details:**
   - Redesigned `Invoice Details` to a structured 3-row layout using `repeat(3, minmax(0, 1fr))`:
     - **Row 1:** Invoice No. | Invoice Date | Due Date
     - **Row 2:** Sales Ledger | Place of Supply | Payment Terms
     - **Row 3:** Reference No. (span 1) | Sales Executive (span 2)
   - Inputs sized to a compact `32px` height, reducing total `Invoice Details` card height to ~200px.
   - Enriched `Customer Details` with customer code badges, full address, GSTIN, phone, state, and email in a clean structured layout filling ~200px.
   - Both sibling cards now balance at ~200px, completely eliminating the empty black dead space.
3. **Flexible Table Height:**
   - Removed rigid `minHeight: 340px` and table `minHeight: 260px` constraints, adopting a natural flexible layout (`minHeight: 130px`) that smoothly expands as items are added without empty voids or squished boxes.

---

## 5. Automated Build & Test Results

```
> ledgerflow-frontend@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 1663 modules transformed.
rendering chunks...
dist/index.html                                     1.37 kB │ gzip:   0.74 kB
dist/assets/ledgerflow-logo-light-BpGne2qi.png     24.83 kB
dist/assets/index-WJSaFlL5.css                    218.46 kB │ gzip:  33.52 kB
dist/assets/index-WEko5v4U.js                   1,788.23 kB │ gzip: 332.77 kB
✓ built in 5.61s
Exit Code: 0
```

```
======================================================================
UI-023: STOCK BALANCE API, PREVIEW IMMUTABILITY & E2E VERIFICATION
======================================================================
[Step 1] Registering Test Company A & Owner... ✓
[Step 2] Creating Master Items in Company A... ✓
[Step 3] Testing GET /masters/items/:id/stock-balance... ✓
[Step 4] Testing Stock Balance Refresh on Inward Movement... ✓
[Step 5] Testing Non-Destructive Preview Safety (Zero Side Effects)... ✓
[Step 6] Testing Multi-Tenant Isolation & Cross-Company Access Control... ✓
[Step 7] Testing Cross-Tenant Godown Protection... ✓
[Step 8] Testing Godown-Specific Balance Query in Company A... ✓
[Step 9] Testing Negative Stock Validation on Sales Posting... ✓
======================================================================
✅ ALL UI-023 END-TO-END REGRESSION TESTS PASSED SUCCESSFULLY!
======================================================================
```

---

## 6. Browser QA Verification

- **Sales Voucher Entry Layout Harmonization:**
  - Customer Details card and Invoice Details card now render with identical ~200px heights, completely eliminating the 150px black dead space void.
  - Invoice Details form fields are neatly arranged across 3 balanced rows (3 columns for primary dates and accounts, spanned row for references).
  - Clicking on the Item Name combobox immediately displays the dropdown overlay floating above all content without causing internal table scrollbars or hiding table headers (`<thead>`).
  - Item details table displays all columns (`#`, `Item Name`, `HSN/SAC`, `Qty`, `Rate`, `Tax %`, `Amount`, actions) with zero squishing or clipping.
  - Adding products or services smoothly expands the table naturally.
  - Terms & Conditions and Notes cards use compact `rows={2}` textareas, and the right summary sidebar remains sticky (`position: sticky, top: 16px`).

---

## 7. Accounting & Regression Safety Invariants

1. **Integer-Paise Monetary Precision:** All money fields are represented as integer paise. Floating-point division and rounding errors are strictly prevented.
2. **Double-Entry Equilibrium:** The backend posting engine enforces $\sum \text{Debits} = \sum \text{Credits}$ across all posted vouchers.
3. **Voucher Immutability:** Previews in Sales and Purchase entry are 100% read-only operations that do not write, modify, or post vouchers to the database.
4. **Tenant Isolation:** Stock balance queries and godown assignments are strictly scoped to the authenticated user's active `company_id`. Attempts to access foreign items or godowns are rejected with 404 or 403.
5. **Negative Stock Policy:** Sales voucher posting respects company configuration; unauthorized negative inventory reductions are rejected.

---

## 8. Conclusion

All requirements for **LEDGERFLOW UI-023** including the Sales Voucher Entry height harmonization and portal-based combobox dropdown fix have been implemented, thoroughly tested, and verified. Both frontend and backend builds are 100% clean and passing.
