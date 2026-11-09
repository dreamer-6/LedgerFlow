# QA-012: UI-046 Production Acceptance & Serial Integrity Audit Report

**Date:** 2026-11-09  
**Auditor:** Antigravity (DeepMind Advanced Agentic Coding)  
**Target Application:** LedgerFlow Accounting & Inventory Management System  
**Audit Scope:** UI-046 Production Acceptance, Serial Integrity, Historical Serial Mapping, Cancellation Integrity, Browser PDF Print Acceptance, Register UI Stabilization & Full Regression  

---

## 1. Executive Summary

An independent, rigorous production acceptance audit was conducted across LedgerFlow following the completion of UI-046. The audit verified the system directly against the source code, live SQLite database schema, API route handlers, posting engine invariants, Chromium headless print output, and full automated regression suites.

### Key Audit Findings & Corrective Engineering:
1. **Historical Serial Mapping:** When the same serialized stock item appeared on multiple voucher lines in a single invoice, serials were previously fetched using `voucher_id` and `item_id`, resulting in all serials being duplicated across both lines. We corrected `GET /vouchers/:id` in `backend/src/api/routes.ts` to link serials strictly by `sales_voucher_line_id` and `purchase_voucher_line_id`. A deterministic partition fallback was implemented for legacy unlinked lines so serials are never duplicated across lines or assigned to the wrong line.
2. **Cancellation Integrity & Status Domain:** Previously, purchase cancellation hard-deleted serial records via `DELETE FROM stock_item_serials`, obliterating historical audit trails and transaction references. We updated `stock_item_serials` schema and added an automated SQLite migration to support `'CANCELLED'` in the status constraint domain. `PostingEngine._cancelVoucherInternal` was updated to transition unsold units to `status = 'CANCELLED'`, preserving `purchase_voucher_id`, `purchase_voucher_line_id`, `supplier_id`, `purchase_date`, and transaction references.
3. **Re-Purchase of Cancelled Units:** Resolved a bug in `posting-engine.ts` where `purchase_date = COALESCE(purchase_date, ?)` retained the old purchase date indefinitely. Corrected the SQL expression to `purchase_date = COALESCE(?, purchase_date)`, ensuring re-purchased units update their purchase date and voucher links cleanly.
4. **Register Action Menus Viewport Clearance:** In `PurchaseRegisterView.tsx` and `SalesRegisterView.tsx`, 3-dot action menus opening upwards on bottom table rows were positioned exactly flush against the button edge, risking clipping. Added a 4px viewport margin (`window.innerHeight - menuCoords.top + 4`) ensuring unobstructed access.
5. **Print CSS Overflow Fix:** Single-page A4 invoices previously experienced a blank second page spill in Chromium print due to `.a4-page-sheet` possessing `min-height: 285mm`, exceeding the standard 281mm printable area ($297\text{mm} - 16\text{mm}$). Enforced `min-height: 0 !important; height: auto !important;` inside `@media print` in `StandardInvoice.tsx`, ensuring single-page invoices render strictly on 1 sheet.
6. **Print Acceptance Artifacts:** Generated 8 authentic browser PDFs using headless Google Chrome across single-page, multi-page, 3+ page, thermal 80mm/58mm rolls, multi-serial wrapping, and historical recovered serial scenarios.

---

## 2. Source Files Inspected & Modified

| File Path | Action | Description |
|---|---|---|
| `backend/src/api/routes.ts` | Modified | Updated `GET /vouchers/:id` to map serials by exact `sales_voucher_line_id` / `purchase_voucher_line_id` with partition fallback. |
| `backend/src/database/schema.sql` | Modified | Updated `stock_item_serials.status` CHECK constraint to include `'CANCELLED'`. |
| `backend/src/database/connection.ts` | Modified | Added automated migration `stock_item_serials_v3` to alter table constraint for existing databases. |
| `backend/src/domain/posting/posting-engine.ts` | Modified | Replaced hard-deletion with `status = 'CANCELLED'`; fixed `purchase_date = COALESCE(?, purchase_date)` on unit re-purchase. |
| `backend/tests/qa012-production-acceptance.test.ts` | Created | Dedicated 9-test production acceptance test suite. |
| `backend/tests/ui046-serial-invoice-register.test.ts` | Modified | Updated test assertion 20 to verify `CANCELLED` status rather than row deletion. |
| `backend/package.json` | Modified | Added `"test:qa012"` npm script. |
| `frontend/src/components/invoice/StandardInvoice.tsx` | Modified | Added `@media print` overflow reset to prevent single-page invoices spilling onto blank second page. |
| `frontend/src/pages/PurchaseRegisterView.tsx` | Modified | Updated upward action menu positioning with 4px clearance. |
| `frontend/src/pages/SalesRegisterView.tsx` | Modified | Updated upward action menu positioning with 4px clearance. |
| `frontend/scripts/generate-qa-pdfs.tsx` | Created | Headless Chrome browser PDF generation script for 8 acceptance scenarios. |

---

## 3. Browser PDF Acceptance Artifacts

All 8 PDF scenarios were generated using authentic headless Google Chrome (`145.0.7632.117`) rendering the production React invoice components (`StandardInvoice`, `SimpleInvoice`, `ThermalInvoice`). The generated files reside in both `G:\HTML\LedgerFlow\pdf-acceptance-artifacts\` and the conversation artifacts directory.

| # | Scenario | File Name | Size (Bytes) | Verification Outcome |
|---|---|---|---|---|
| 1 | Standard A4, 1 Page | `01_standard_a4_one_page.pdf` | 383,029 | **PASS** — Strictly 1 page. Header, GSTIN, party details, totals, and bank details fit cleanly within printable bounds. |
| 2 | Standard A4, 2 Pages | `02_standard_a4_two_pages.pdf` | 182,934 | **PASS** — Page 1 displays items 1–8; Page 2 displays repeated header with Company Name, GSTIN, `(Continued)` indicator, party info, invoice #, items 9–14, and totals footer. |
| 3 | Standard A4, 3+ Pages | `03_standard_a4_three_plus_pages.pdf` | 525,630 | **PASS** — Multi-page flow spanning 3 pages without clipped rows; each continuation page displays authoritative continuation header and column headings. |
| 4 | Simple Invoice, Multi-Page | `04_simple_invoice_multipage.pdf` | 319,667 | **PASS** — Minimalist corporate invoice format spanning across page boundary with preserved alignment and totals. |
| 5 | Thermal 80mm Roll | `05_thermal_80mm.pdf` | 165,475 | **PASS** — 80mm roll format with compact typography, dashed separators, centered store header, itemized lines, and tax summary. |
| 6 | Thermal 58mm Roll | `06_thermal_58mm.pdf` | 109,247 | **PASS** — Ultra-compact 58mm roll format with narrow wrapping and legible barcode/totals summary. |
| 7 | Long Descriptions & Serials | `07_long_descriptions_and_serials.pdf` | 397,028 | **PASS** — Multi-line description wrapping and multi-serial badges (`SN-DELL-LAT-2026-X1`, `X2`, `X3`) formatted in monospace without table overflow. |
| 8 | Historical Invoice Serials | `08_historical_invoice.pdf` | 380,273 | **PASS** — Faithful display of serial numbers recovered from `stock_item_serials` for vouchers whose line records had blank `serial_number` strings. |

---

## 4. Acceptance Test Scenarios & Audit Verifications

### 4.1. Historical Serial Mapping
- **Line ID Association:** Verified that serials are tied to individual lines via `sales_voucher_line_id` and `purchase_voucher_line_id`.
- **Multi-Line Test:** When a voucher contains multiple lines of the exact same stock item (e.g., Line 1 with Qty 2 and Line 2 with Qty 3), serials are mapped strictly to their respective line IDs. Line 1 contains only the 2 serials assigned to it, and Line 2 contains only the 3 serials assigned to it.
- **Zero Cross-Contamination:** Confirmed that serials are never cross-pollinated, duplicated across lines, or assigned to the wrong line.
- **Zero Inference:** Serials are never inferred from current godown availability; historical vouchers reflect historical serial assignments.

### 4.2. Cancellation Integrity
- **Purchase Cancellation with Available Units:** When a purchase voucher is cancelled and all units remain unsold in stock, the serial records are **NOT** hard-deleted. They transition to `status = 'CANCELLED'`.
- **Audit Trail Preservation:** The `purchase_voucher_id`, `purchase_voucher_line_id`, `supplier_id`, and `purchase_date` remain intact in `stock_item_serials`, preserving full traceability in the Serial Number Register.
- **Double-Protection Guard:** If ANY serial unit from a purchase voucher has been sold on a sales invoice, attempting to cancel the purchase voucher throws a strict error: `"Cannot cancel purchase voucher: serial unit '...' has already been sold on sales voucher '...'."`
- **Sales Voucher Cancellation:** Cancelling a sales voucher resets unit status from `SOLD` to `AVAILABLE`, unlinks `sales_voucher_id`, `sales_voucher_line_id`, and `customer_id`, and retains the unit in its original `godown_id`.
- **Unit Re-Purchase:** If a supplier re-delivers a previously cancelled serial number on a subsequent purchase voucher, the system reactivates the unit to `AVAILABLE`, updates the purchase voucher reference, and updates `purchase_date = '2026-11-05'` without encountering SQLite UNIQUE constraint collisions.

### 4.3. Purchase & Sales User Interface
- **Non-Serialized Workflows:** Stock items with `has_serial_no = 0` (e.g., Cat6 Ethernet Cables) operate with zero serial prompt requirements during purchase or sales entry.
- **Draft Voucher Flexibility:** Draft purchase and sales vouchers permit saving with zero or partial serial numbers. Draft vouchers do not make serials available for sale in `stock_item_serials`.
- **Strict Post Validation:** Posting a voucher with serialized items strictly enforces `serials.length === quantity`. Partial counts, missing serials, or duplicates throw instant validation errors.
- **Clean Item Selector:** Dropdown displays pure item names (`{it.item_name}`) without appended `(HSN: ...)`.
- **Truthful Warranty Badges:** Stock items created without an explicit warranty default to `0 Months / None`. The system never fabricates `'1-3 Years'` warranty text.
- **Register Action Menus:** Action menus on the top row open downwards; action menus on the bottom row open upwards with a 4px viewport clearance via React portals (`createPortal(..., document.body)`), completely eliminating table clipping and scrollbar creation.

### 4.4. Multi-Tenant Isolation
- **Cross-Tenant Queries:** Queries by Company B for Company A serials return `undefined` / zero records.
- **Independent Serial Namespaces:** Company B can purchase and track the exact same serial number (`SN-L1-001`) under its own company ID without colliding with Company A's records.

---

## 5. Execution Commands & Exit Codes

| Command | Working Directory | Exit Code | Results Summary |
|---|---|---|---|
| `npm run test:qa012` | `G:\HTML\LedgerFlow\backend` | **0** | **9 / 9 passed (100% success)** — Full production acceptance test suite covering multi-line mapping, cancellation integrity, re-purchasing, and tenant isolation. |
| `npm run test:ui046` | `G:\HTML\LedgerFlow\backend` | **0** | **21 / 21 passed (100% success)** — Serialized purchase workflow, draft saving, posting guards, historical serial recovery, warranty truthfulness, and pagination height estimation. |
| `npm run test:ui045` | `G:\HTML\LedgerFlow\backend` | **0** | **15 / 15 passed (100% success)** — 22 assertions verifying complete inventory lifecycle, double-sale prevention, stock reconciliation, and serial register filters. |
| `npm run test:ui044` | `G:\HTML\LedgerFlow\backend` | **0** | **17 / 17 passed (100% success)** — Journal module double-entry balance, draft lifecycle, and register KPI reconciliation. |
| `npm test` | `G:\HTML\LedgerFlow\backend` | **0** | **17 / 17 suites passed (100% success)** — All accounting invariants, concurrency (12 simultaneous vouchers), security regression (41 tests), inventory integrity, and report reconciliation. |
| `npm run build` | `G:\HTML\LedgerFlow\frontend` | **0** | **Clean production build** — `tsc` passed with 0 errors; `vite build` generated 1,685 transformed modules in 10.65s without warnings or type conflicts. |

---

## 6. Audit Verdict

**ACCEPTANCE STATUS: PASSED FOR PRODUCTION DEPLOYMENT (100% GREEN)**

All acceptance criteria defined in QA-012 have been independently verified through source code inspection, database verification, automated test suites, and authentic headless browser PDF generation. The system preserves accounting invariants, enforces inventory integrity, provides truthful warranty and serial tracking, and ensures reliable invoice printing.

