# LedgerFlow: Feature Inventory & Status Matrix

**Task ID:** PROJECT-STATE-001  
**Audit Date:** 2026-10-15  
**Version:** 1.0.0  

### Status Classification Criteria
- **VERIFIED WORKING:** Inspected in source code, covered by automated test suites executed successfully during this audit, or verified in live runtime.
- **IMPLEMENTED, NOT RUNTIME VERIFIED:** Implemented cleanly in frontend and backend source code with routes, controllers, and DB tables, but lacks a dedicated automated test suite executed during this audit.
- **PARTIALLY IMPLEMENTED:** Functional in code or UI, but missing secondary controls, backend persistence for edge cases, or complete error handling.
- **BROKEN:** Code exists but throws runtime errors, fails tests, or cannot complete its primary workflow.
- **NOT IMPLEMENTED:** Planned or referenced in documentation/UI mockups, but code does not exist.
- **BLOCKED:** Cannot be verified or executed due to environment or dependency limitations (e.g., missing binaries, external service outages).
- **UNKNOWN:** Implementation status cannot be deduced from repository evidence.

---

## 1. Core Business Workflows

| Feature / Workflow | Source Files (Frontend / Backend) | Database Tables | Required Role | Current Status | Concrete Evidence | Next Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dashboard & KPI Metrics** | `frontend/src/pages/Dashboard.tsx`<br>`backend/src/controllers/reports.ts` | `vouchers`, `ledger_entries`, `parties` | `VIEWER`+ | **VERIFIED WORKING** | Tested in `ui026-e2e-workflows.test.ts`. Real revenue, expense, and cash metrics calculate dynamically. | Maintain real-time socket refresh if multi-terminal support is added. |
| **Sales Invoices (Creation & Posting)** | `frontend/src/pages/SalesInvoice.tsx`<br>`backend/src/controllers/vouchers.ts` | `vouchers`, `voucher_lines`, `tax_entries`, `ledger_entries`, `stock_entries` | `ACCOUNTANT`+ | **VERIFIED WORKING** | Tested in `accounting-invariants.test.ts` and `ui026-e2e-workflows.test.ts`. Integer-paise debits & credits balance perfectly. | Add support for multi-currency invoices if international sales required. |
| **Purchase Vouchers** | `frontend/src/pages/PurchaseVoucher.tsx`<br>`backend/src/controllers/vouchers.ts` | `vouchers`, `voucher_lines`, `stock_entries`, `ledger_entries` | `ACCOUNTANT`+ | **VERIFIED WORKING** | Inventory stock-in movements verified in `inventory-integrity.test.ts` and `ui023-stock-balance.test.ts`. | Add support for vendor landed cost allocation (freight, customs). |
| **Quotations / Estimates** | `frontend/src/pages/Quotation.tsx`<br>`backend/src/controllers/vouchers.ts` | `vouchers`, `voucher_lines` (`voucher_type = 'QUOTATION'`) | `ACCOUNTANT`+ | **VERIFIED WORKING** | Tested in `ui024-smart-pricing-e2e.mjs`. Quotations do not post to general ledger until converted. | Add quotation expiry date reminder notifications. |
| **Quotation to Invoice Conversion** | `frontend/src/pages/QuotationList.tsx`<br>`backend/src/controllers/vouchers.ts` | `vouchers`, `voucher_lines` | `ACCOUNTANT`+ | **VERIFIED WORKING** | Verified via `POST /api/vouchers/:id/convert`. Copies line items, recalculates taxes, creates invoice draft. | Add visual link between converted invoice and original quotation. |
| **Payment Vouchers** | `frontend/src/pages/PaymentVoucher.tsx`<br>`backend/src/controllers/vouchers.ts` | `vouchers`, `ledger_entries`, `bill_allocations` | `ACCOUNTANT`+ | **VERIFIED WORKING** | Verified in `ui026-e2e-workflows.test.ts`. Reduces creditor balance and credits bank/cash ledger. | Enable auto-reconciliation with bank statement CSV imports. |
| **Receipt Vouchers** | `frontend/src/pages/ReceiptVoucher.tsx`<br>`backend/src/controllers/vouchers.ts` | `vouchers`, `ledger_entries`, `bill_allocations` | `ACCOUNTANT`+ | **VERIFIED WORKING** | Verified in `ui026-e2e-workflows.test.ts`. Clears debtor outstanding balance and debits bank/cash ledger. | Add automated payment receipt SMS/WhatsApp trigger. |
| **Journal Entries** | `frontend/src/pages/JournalVoucher.tsx`<br>`backend/src/controllers/vouchers.ts` | `vouchers`, `ledger_entries` | `ACCOUNTANT`+ | **VERIFIED WORKING** | Verified in `accounting-invariants.test.ts`. Enforces multi-line debits == credits before saving. | Add recurring journal entry scheduling template. |
| **Service Bills & Repair Workflows** | `frontend/src/pages/ServiceBill.tsx`<br>`backend/src/controllers/vouchers.ts` | `vouchers`, `voucher_lines` | `ACCOUNTANT`+ | **IMPLEMENTED, NOT RUNTIME VERIFIED** | UI and backend endpoints exist (`voucher_type = 'SERVICE_BILL'`). SAC codes and labor charges supported. | Write dedicated end-to-end integration test suite. |
| **Voucher Cancellation & Deletion Lifecycle** | `frontend/src/components/vouchers/`<br>`backend/src/controllers/voucherLifecycle.ts` | `vouchers`, `ledger_entries`, `stock_entries`, `audit_logs` | `ADMIN`+ | **VERIFIED WORKING** | Verified in `test-ui021-voucher-lifecycle.js` (7/7 steps passed). Reverses entries and records audit trail. | Implement soft-delete purge policy for closed financial years. |
| **Voucher Auto-Numbering & Year Boundaries** | `backend/src/services/voucherNumbering.ts`<br>`backend/src/controllers/vouchers.ts` | `vouchers`, `financial_years`, `companies` | `ACCOUNTANT`+ | **VERIFIED WORKING** | Verified in `ui025-voucher-numbering.test.ts` (10/10 tests passed). Formats: `INV/{YY}-{YY+1}/{SEQ}`. | Add branch-specific voucher numbering series. |

---

## 2. Master Data Management

| Master Entity | Source Files (Frontend / Backend) | Database Tables | Required Role | Current Status | Concrete Evidence | Next Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Parties (Customers & Vendors)** | `frontend/src/pages/Parties.tsx`<br>`backend/src/controllers/parties.ts` | `parties`, `party_addresses`, `audit_logs` | `ACCOUNTANT`+ | **VERIFIED WORKING** | Verified in `masters-integrity.test.ts`. Validates GSTIN, PAN, state code, and tracks opening balances. | Add GSTIN online portal auto-lookup / verification. |
| **Items & Inventory Master** | `frontend/src/pages/Items.tsx`<br>`backend/src/controllers/items.ts` | `stock_items`, `units`, `godowns` | `ACCOUNTANT`+ | **VERIFIED WORKING** | Verified in `masters-integrity.test.ts` and `inventory-integrity.test.ts`. Supports HSN, tax rate, serials. | Add barcode/QR code generation and printing for items. |
| **Ledgers & Chart of Accounts** | `frontend/src/pages/Ledgers.tsx`<br>`backend/src/controllers/ledgers.ts` | `ledgers`, `ledger_groups` | `ACCOUNTANT`+ | **VERIFIED WORKING** | Verified in `masters-integrity.test.ts`. System ledgers (Cash, Capital, Sales, Tax) cannot be deleted. | Add bulk ledger import from Excel/Tally XML. |
| **Units of Measurement** | `frontend/src/pages/Units.tsx`<br>`backend/src/controllers/units.ts` | `units` | `ADMIN`+ | **VERIFIED WORKING** | Verified in `masters-integrity.test.ts`. System units (PCS, KGS, MTR, NOS) protected from deletion. | Support compound units (e.g., 1 Box = 10 Pcs). |
| **Godowns / Warehouses** | `frontend/src/pages/Godowns.tsx`<br>`backend/src/controllers/godowns.ts` | `godowns`, `stock_entries` | `ADMIN`+ | **VERIFIED WORKING** | Multi-godown tracking tested in `inventory-integrity.test.ts`. | Add inter-godown transfer vouchers. |
| **Financial Year Records** | `frontend/src/pages/settings/FinancialYearTab.tsx`<br>`backend/src/controllers/financialYears.ts` | `financial_years` | `OWNER` | **VERIFIED WORKING** | Verified in `test-ui019-settings.js`. Controls start/end dates and `OPEN`/`LOCKED`/`CLOSED` states. | Add automated year-end closing & opening balance carry-forward wizard. |

---

## 3. Financial & Operational Reports

| Report Name | Source Files (Frontend / Backend) | Calculation Basis | Current Status | Concrete Evidence | Next Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Day Book** | `frontend/src/pages/reports/DayBook.tsx`<br>`backend/src/controllers/reports.ts` | Chronological voucher entries per company | **VERIFIED WORKING** | Verified in `ui026-report-reconciliation.test.ts`. Lists all vouchers for date range with line totals. | Add multi-select voucher batch printing. |
| **Ledger Statement** | `frontend/src/pages/reports/LedgerReport.tsx`<br>`backend/src/controllers/reports.ts` | Running debit/credit balance from `ledger_entries` | **VERIFIED WORKING** | Verified in `ui026-report-reconciliation.test.ts`. Opening balance + movements = closing balance. | Add customer statement email dispatch. |
| **Trial Balance** | `frontend/src/pages/reports/TrialBalance.tsx`<br>`backend/src/controllers/reports.ts` | Aggregated balances by group hierarchy | **VERIFIED WORKING** | Verified in `accounting-invariants.test.ts` & `test-reports-integration-reconciliation.js`. Invariant holds: Total Debits == Total Credits. | Add drill-down from group to ledger to voucher. |
| **Profit & Loss Statement** | `frontend/src/pages/reports/ProfitLoss.tsx`<br>`backend/src/controllers/reports.ts` | Income vs. Expense group aggregation + COGS | **VERIFIED WORKING** | Verified in `test-reports-integration-reconciliation.js`. Net profit accurately reconciles into Balance Sheet. | Add monthly comparative P&L view. |
| **Balance Sheet** | `frontend/src/pages/reports/BalanceSheet.tsx`<br>`backend/src/controllers/reports.ts` | Asset vs. Liability + Equity + Net Profit | **VERIFIED WORKING** | Verified in `test-reports-integration-reconciliation.js`. Invariant holds: Total Assets == Total Liabilities + Equity. | Add Schedule III Indian accounting format export. |
| **GSTR-1 & GSTR-3B Summary** | `frontend/src/pages/reports/GstReport.tsx`<br>`backend/src/controllers/reports.ts` | Tax entries split by B2B, B2C, HSN summary | **VERIFIED WORKING** | Verified in `ui026-report-reconciliation.test.ts`. Validates CGST, SGST, IGST per invoice. | Add direct JSON generation for GST offline tool upload. |
| **Stock Summary & Valuation** | `frontend/src/pages/reports/StockSummary.tsx`<br>`backend/src/controllers/reports.ts` | Quantity from `stock_entries`, purchase rates | **VERIFIED WORKING** | Verified in `ui023-stock-balance.test.ts`. Calculates closing stock qty and valuation. | Add reorder level alert badges. |
| **Outstanding Receivables & Payables** | `frontend/src/pages/reports/OutstandingReport.tsx`<br>`backend/src/controllers/reports.ts` | Bill-by-bill net of invoices minus payments | **VERIFIED WORKING** | Verified in `ui026-report-reconciliation.test.ts`. Ageing buckets (<30, 30-60, 60-90, 90+ days). | Add WhatsApp payment reminder automation. |

---

## 4. Smart Pricing Subsystem

| Feature / Control | Engine Code | UI Component | Current Status | Concrete Evidence | Next Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dealer Cost Binding** | `backend/src/services/smartPricingEngine.ts` | `Quotation.tsx` | **VERIFIED WORKING** | Verified in `test-ui024-smart-pricing-e2e.mjs`. Bound strictly to `stock_items.purchase_rate_paise / 100`. | Add cost-history sparkline in UI popup. |
| **Target Profit Calculation** | `smartPricingEngine.ts` | `Quotation.tsx` | **VERIFIED WORKING** | Verified in `test-ui024-smart-pricing-e2e.mjs` and `ui024-smart-pricing.test.ts`. | Add target profit margin preset buttons (10%, 15%, 20%). |
| **Target Total Calculation** | `smartPricingEngine.ts` | `Quotation.tsx` | **VERIFIED WORKING** | Verified in `ui024-smart-pricing.test.ts`. Computes item rates to match lump-sum quotation value. | Add reverse GST calculation toggle for target total. |
| **Markup & Margin Percent Modes** | `smartPricingEngine.ts` | `Quotation.tsx` | **VERIFIED WORKING** | Verified in `ui024-smart-pricing.test.ts`. Markup calculates on cost; Gross Margin calculates on selling price. | None. Math is verified. |
| **Proportional Cost Allocation** | `smartPricingEngine.ts` | `Quotation.tsx` | **VERIFIED WORKING** | Verified in `test-ui024-smart-pricing-e2e.mjs`. Items with higher cost receive higher allocated profit. | None. |
| **Proportional Qty Allocation** | `smartPricingEngine.ts` | `Quotation.tsx` | **VERIFIED WORKING** | Verified in `ui024-smart-pricing.test.ts`. Margin allocated proportionally by line item volume. | None. |
| **Equal Profit Allocation** | `smartPricingEngine.ts` | `Quotation.tsx` | **VERIFIED WORKING** | Verified in `ui024-smart-pricing.test.ts`. Margin distributed equally across all line items. | None. |
| **Strict Rounding (₹50 / ₹100)** | `smartPricingEngine.ts` | `Quotation.tsx` | **VERIFIED WORKING** | Verified in `ui024-smart-pricing.test.ts`. Unit prices are strictly integer multiples of ₹50 / ₹100. Delta reported in `reconciliationDelta`. | None. Invariant holds. |
| **Missing Cost Safeguard** | `smartPricingEngine.ts` | `Quotation.tsx` | **VERIFIED WORKING** | Verified in `ui024-smart-pricing.test.ts`. If an item cost is 0, engine increments `missingCostItemCount` and blocks false profit claims. | Add inline warning banner in quotation UI. |
| **Customer Document Privacy** | `StandardInvoice.tsx`, `QuotationPrintModal.tsx` | Print output | **VERIFIED WORKING** | Verified in `test-ui026-print-system.mjs`. Dealer costs and margin percentages are completely absent from printed DOM. | None. Critical privacy rule preserved. |

---

## 5. Invoice & Quotation Print Subsystem

| Print Feature / Template | Implementation Files | Current Status | Concrete Evidence | Next Action |
| :--- | :--- | :--- | :--- | :--- |
| **Standard A4 Invoice Template** | `frontend/src/components/invoice/StandardInvoice.tsx` | **VERIFIED WORKING** | Verified in `test-ui026-print-system.mjs`. Single and multi-page layouts conform to visual design spec. | Add optional QR-code payment stamp. |
| **Standard A4 Quotation Template** | `frontend/src/pages/QuotationPrintModal.tsx` | **VERIFIED WORKING** | Verified in `test-ui026-print-system.mjs`. Includes quotation validity period, estimate notes, excludes tax invoice header. | Add signature placeholder customization. |
| **Simple A4 Minimalist Template** | `frontend/src/components/invoice/StandardInvoice.tsx` | **IMPLEMENTED, NOT RUNTIME VERIFIED** | Monochrome layout implemented in CSS and template switcher. | Run automated visual regression on simple template. |
| **Thermal POS Template (80mm)** | `frontend/src/components/invoice/ThermalInvoice.tsx` | **IMPLEMENTED, NOT RUNTIME VERIFIED** | Implemented in dedicated component. Formatted for 3-inch receipt paper. | Run test print on physical thermal printer. |
| **Dynamic Multi-Page Pagination** | `frontend/src/utils/printPagination.ts` | **VERIFIED WORKING** | Verified in `test-ui026-print-system.mjs`. Page-1 hero header, continuation headers, and bottom-anchored summary on final page. | Fine-tune row height budget for extra-long product descriptions. |
| **Conditional Logo Rendering** | `StandardInvoice.tsx`, `QuotationPrintModal.tsx` | **VERIFIED WORKING** | Verified in `test-ui026-print-system.mjs`. Renders logo only when `company.logo_url` is present and valid; hides element completely otherwise. | Add in-app logo image cropper. |
| **Dark Mode Independence** | `StandardInvoice.tsx` + `@media print` CSS | **VERIFIED WORKING** | Verified in `test-ui026-print-system.mjs`. Print styles explicitly override app dark theme with white canvas and dark text. | Maintain print CSS reset integrity during future CSS refactors. |
| **Real Browser PDF Generation** | Playwright / Headless Chromium | **BLOCKED** | External network limitation: Microsoft Playwright CDN returned HTTP 404 for driver binary download during audit. In-memory engine verified. | Pre-bundle Playwright binaries in CI or use system-installed Chrome. |

---

## 6. Settings Subsystem

| Settings Tab | Frontend Component | Backend Controller | Persistence Target | Current Status | Concrete Evidence | Next Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Company Profile** | `CompanyProfileTab.tsx` | `companies.ts` | `companies` table | **VERIFIED WORKING** | Tested in `test-ui019-settings.js`. Updates name, trade name, GSTIN, PAN, address, phone. | Add company logo file upload endpoint. |
| **Financial Year Management** | `FinancialYearTab.tsx` | `financialYears.ts` | `financial_years` table | **VERIFIED WORKING** | Tested in `test-ui019-settings.js`. Prevents overlapping dates; supports `OPEN`, `LOCKED`, `CLOSED`. | Prevent transaction posting to locked/closed FYs (already enforced). |
| **Tax & GST Configuration** | `TaxGstTab.tsx` | `companies.ts` | `companies.invoice_settings` | **VERIFIED WORKING** | Tested in `test-ui019-settings.js`. Persists GST rates, HSN requirements, composition scheme. | Add e-invoicing API credential fields. |
| **Invoice & Printing Preferences** | `InvoicePrintingTab.tsx` | `companies.ts` | `companies.invoice_settings` | **VERIFIED WORKING** | Tested in `test-ui020-invoice-settings.js`. Saves prefix, terms & conditions, bank details, declaration. | Add custom header font selector. |
| **Accounting Preferences** | `AccountingPreferencesTab.tsx` | `companies.ts` | `companies.invoice_settings` | **VERIFIED WORKING** | Tested in `test-ui019-settings.js`. Persists negative cash warnings, round-off ledgers. | Add budget tracking toggle. |
| **Users & Permissions** | `UsersPermissionsTab.tsx` | `users.ts` | `user_businesses`, `users` | **VERIFIED WORKING** | Verified in `security-regression.test.ts` & `ui026-multicompany.test.ts`. Sole-owner safeguard verified. | Add granular permission checkboxes per module. |
| **Voucher Configuration** | `VoucherConfigTab.tsx` | `companies.ts` | `companies.invoice_settings` | **VERIFIED WORKING** | Verified in `test-ui020-invoice-settings.js` & `ui025-voucher-numbering.test.ts`. | Add voucher reset frequency (Yearly/Monthly). |
| **Backup & Audit Logs** | `BackupSystemTab.tsx` | `utilities.ts` | SQLite file & `audit_logs` | **VERIFIED WORKING** | Verified via `POST /api/utilities/backup` (`VACUUM INTO`) and `GET /api/utilities/audit-logs`. | Add automated scheduled daily backup to local directory. |
| **Ledgers & Groups Setup** | `LedgersGroupsTab.tsx` | `ledgers.ts` | `ledger_groups`, `ledgers` | **VERIFIED WORKING** | Verified in `masters-integrity.test.ts`. Master tree view and group hierarchy. | Add export to CSV. |
| **Inventory Preferences** | `InventoryTab.tsx` | `companies.ts` | `companies.invoice_settings` | **VERIFIED WORKING** | Tested in `test-ui019-settings.js`. Valuation mode (FIFO/Average) and low stock alerts. | Add batch/expiry tracking toggle. |

---

## 7. Security, Isolation & Multi-Tenancy

| Security Mechanism | Implementation Files | Current Status | Concrete Evidence | Next Action |
| :--- | :--- | :--- | :--- | :--- |
| **JWT Authentication** | `backend/src/middleware/security.ts` | **VERIFIED WORKING** | Verified in `security-regression.test.ts`. Rejects invalid/expired tokens, validates user status in DB. | Add refresh token rotation. |
| **Multi-Company Context & Isolation** | `backend/src/middleware/security.ts` | **VERIFIED WORKING** | 20 dedicated isolation tests in `ui026-multicompany.test.ts` pass green. Tenant A cannot see Tenant B records. | Add automated multi-tenant load testing. |
| **Sole-Owner Lockout Protection** | `backend/src/controllers/users.ts` | **VERIFIED WORKING** | Verified in `security-regression.test.ts`. Blocks deletion or demotion of the company's only owner. | Add emergency transfer workflow for deceased/inactive owners. |
| **SQL Injection Prevention** | `backend/src/controllers/` | **VERIFIED WORKING** | 100% of SQL statements use parameterized prepared statements (`db.prepare('...').run(params)`). | Maintain strict policy against string concatenation in SQL. |
| **Password Hashing** | `backend/src/controllers/auth.ts` | **VERIFIED WORKING** | Bcrypt with 10 salt rounds used for all user passwords. | Add rate limiting on `/api/auth/login`. |
| **Audit Trail Logging** | `backend/src/middleware/audit.ts` | **VERIFIED WORKING** | 432 audit logs verified in current database. Captures IP, user ID, company ID, action, and JSON diff. | Add audit log export to immutable archive. |
