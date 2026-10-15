# LedgerFlow: Next Agent Handover Guide

**Task ID:** PROJECT-STATE-001  
**Audit Date:** 2026-10-15  
**Target Audience:** Future AI Engineers & Core Developers  
**Primary Repository:** `g:/HTML/LedgerFlow`  
**Current Git Branch:** `main` (HEAD: `ab777060ef4e09128743fab0bdf5ef97380fcb86`)  

---

## 1. What LedgerFlow Is

LedgerFlow is a double-entry accounting, GST compliance, inventory control, and smart quotation management system built specifically for Indian MSMEs. It operates with mathematical rigor using pure integer-paise arithmetic across all database records and calculation engines. It features multi-company tenant isolation, role-based authorization, comprehensive financial reporting (Trial Balance, P&L, Balance Sheet, GST), an intelligent smart pricing engine, and pixel-accurate A4 invoice/quotation printing.

---

## 2. Codebase Organization

```
LedgerFlow/
├── backend/                         # Express.js + TypeScript + node:sqlite API server
│   ├── data/
│   │   └── ledgerflow.db            # Active SQLite 3 database (WAL mode, FK enabled)
│   ├── src/
│   │   ├── controllers/             # HTTP route controllers (auth, vouchers, reports, etc.)
│   │   ├── db/                      # Schema definition (schema.ts) & migrations
│   │   ├── middleware/              # Security (security.ts), audit logging, company context
│   │   ├── routes/                  # Express route declarations (/api/*)
│   │   ├── services/                # Authoritative domain engines:
│   │   │   ├── accountingEngine.ts  # Double-entry posting rules
│   │   │   ├── doubleEntry.ts       # Debit/credit balance validation
│   │   │   ├── inventoryEngine.ts   # Stock movement & valuation
│   │   │   ├── smartPricingEngine.ts# Target profit, allocation & rounding logic
│   │   │   └── voucherNumbering.ts  # FY sequence generation (e.g., INV/24-25/0001)
│   │   └── tests/                   # 12 automated test suites (354+ passing tests)
│   ├── package.json
│   └── tsconfig.json
├── frontend/                        # React 18 + TypeScript + Vite SPA
│   ├── src/
│   │   ├── components/              # Shared UI components (layout, invoice templates, modals)
│   │   ├── pages/                   # 38 screen components (Sales, Quotations, Reports, etc.)
│   │   │   └── settings/            # 10 dedicated settings tabs
│   │   ├── services/                # API client layer (Axios/Fetch HTTP helpers)
│   │   ├── utils/                   # Shared helpers:
│   │   │   ├── formatters.ts        # Currency (₹ paise to rupees) & date formatters
│   │   │   └── printPagination.ts   # Dynamic A4 content-aware pagination algorithm
│   │   ├── App.tsx                  # Root component & central view router
│   │   ├── index.css                # Core design system tokens (colors, typography, print rules)
│   │   └── components.css           # Component-level styling & layout rules
│   ├── package.json
│   └── vite.config.ts
├── test-*.js / test-*.mjs           # Root integration test scripts (Smart pricing, print, etc.)
├── PROJECT-STATE.md                 # Primary system architecture & state snapshot
├── PROJECT-STATE-MATRIX.md          # Exhaustive feature status matrix
├── PROJECT-STATE-HANDOVER.md        # This handover document
├── PROJECT-STATE-TEST-RESULTS.md    # Evidence-backed test & build log
└── PROJECT-STATE-RISKS.md           # Prioritized risk & defect register
```

---

## 3. What Must NOT Be Changed Casually (Critical Invariants)

1. **Integer-Paise Money Representation:**
   - **Rule:** Never store financial amounts in the database as floating-point numbers.
   - **Database Columns:** `debit_paise`, `credit_paise`, `taxable_amount_paise`, `cgst_paise`, `sgst_paise`, `igst_paise`, `total_amount_paise`, `rate_paise`, `purchase_rate_paise`, `selling_rate_paise`.
   - **Conversion:** Always multiply rupees by 100 (`Math.round(val * 100)`) when writing to DB, and divide by 100 (`paise / 100`) when displaying in UI.

2. **Double-Entry Balance Invariant:**
   - **Rule:** For every voucher posted to `ledger_entries`, $\sum \text{debit\_paise} \equiv \sum \text{credit\_paise}$.
   - **Guard:** Database transactions in `backend/src/controllers/vouchers.ts` reject unbalanced vouchers. Never disable this check.

3. **Multi-Tenant Company Isolation:**
   - **Rule:** Every authenticated request must pass through `resolveCompanyContext` in `backend/src/middleware/security.ts`.
   - **Verification:** Every SQL query touching company data must include `WHERE company_id = ?` binding `req.companyId`. Never trust client-supplied company IDs in request bodies without validating against `req.companyId`.

4. **Sole-Owner Lockout Protection:**
   - **Rule:** A user who is the sole `OWNER` of a company cannot be deleted or demoted to Admin/Accountant/Viewer.
   - **Guard:** Enforced in `backend/src/controllers/users.ts`.

5. **Customer Document Privacy:**
   - **Rule:** Dealer acquisition costs, markup percentages, and internal margin figures must NEVER appear on customer-facing invoice or quotation printouts.
   - **Guard:** Verified in `test-ui026-print-system.mjs`.

6. **Smart Pricing Rounding Invariants:**
   - **Rule:** When `ROUND_50` or `ROUND_100` rounding is selected, line item prices must strictly be integer multiples of ₹50 or ₹100. The pricing engine must report discrepancies via `reconciliationDelta` rather than falsely claiming `targetAchieved: true`.

---

## 4. What Has Recently Changed

- **UI-026 & UI-029 (Invoice & Quotation Print Overhaul):**
  - Implemented dynamic, content-aware multi-page A4 print pagination in `frontend/src/utils/printPagination.ts`.
  - Updated `frontend/src/components/invoice/StandardInvoice.tsx` and `frontend/src/pages/QuotationPrintModal.tsx` to cleanly separate Page 1 (hero header + address cards) from continuation pages (compact header + repeated column headers) and the final page (anchored summary, words, bank details, terms, and signature).
  - Fixed company logo rendering so it only displays when a valid `company.logo_url` exists.
  - Resolved print modal button alignment and made preview container full-screen responsive.
  - Verified dark-mode independence during printing via `@media print` CSS overrides.

---

## 5. What Remains Unfinished & Known Gaps

1. **Service Bills & Repair Workflow:**
   - Implemented in `frontend/src/pages/ServiceBill.tsx`, but lacks a dedicated automated test suite in the backend.
2. **Thermal POS Printing:**
   - Implemented in `frontend/src/components/invoice/ThermalInvoice.tsx`, but requires physical printer validation or thermal raster emulator testing.
3. **Headless Browser PDF Generation:**
   - Playwright automated browser test failed due to external Microsoft CDN 404 on the driver binary download. PDF export currently relies on the browser's native `window.print()` dialog.
4. **Rate Limiting on Authentication Endpoints:**
   - `/api/auth/login` does not currently employ IP/account-based rate limiting.

---

## 6. Highest-Priority Defects & Risks

1. **Rate Limiting Gaps (Security Risk - Medium):**
   - Brute-force protection should be added via `express-rate-limit` on `/api/auth/login`.
2. **JWT Secret Development Fallback (Security Risk - Low in Dev, Critical in Prod):**
   - Development mode auto-generates a process-local random secret if `JWT_SECRET` is unset. Ensure `JWT_SECRET` is mandatory in all production deployments.
3. **Foreign Key Performance on Mass Deletion (Operational Risk - Low):**
   - Large financial year deletions cascade through ledger and stock entries. Ensure indexing on `voucher_id` and `company_id` is maintained.

---

## 7. Recommended Next Task

**Task Recommendation:** `TEST-AUTOMATION-002: Service Bill & E2E Workflow Expansion`
1. Write a dedicated backend automated test suite `backend/src/tests/service-bills.test.ts` to verify SAC code handling, technician labor lines, and tax calculations.
2. Add rate limiting middleware to `/api/auth/login`.
3. Package offline Chromium dependencies so headless browser PDF generation does not depend on external CDN downloads.

---

## 8. Exact Commands for Setup, Build & Tests

### Setup & Development
```bash
# Backend setup and run
cd g:\HTML\LedgerFlow\backend
npm install
npm run dev      # Runs API on http://localhost:5000

# Frontend setup and run
cd g:\HTML\LedgerFlow\frontend
npm install
npm run dev      # Runs UI on http://localhost:5173
```

### Production Build
```bash
# Validate TypeScript and bundle backend
cd g:\HTML\LedgerFlow\backend
npm run build    # Output: backend/dist/

# Validate TypeScript and bundle frontend
cd g:\HTML\LedgerFlow\frontend
npm run build    # Output: frontend/dist/
```

### Automated Tests
```bash
# Run all backend test suites (354+ tests, exit code 0)
cd g:\HTML\LedgerFlow\backend
npm test

# Run root-level integration scripts
cd g:\HTML\LedgerFlow
node test-ui026-print-system.mjs             # Print pagination & privacy (6/6 pass)
node test-ui024-smart-pricing-e2e.mjs        # Smart pricing engine (16/16 pass)
node test-reports-integration-reconciliation.js # Financial report integrity (13/13 pass)
node test-ui021-voucher-lifecycle.js         # Voucher cancellation & audit (7/7 pass)
node test-ui019-settings.js                  # Settings persistence (6/6 pass)
node test-ui020-invoice-settings.js          # Invoice settings persistence (5/5 pass)
```

---

## 9. First Files the Next Agent Should Inspect

1. `backend/src/middleware/security.ts`: Understand the authentication, company context, and role guards before modifying any API routes.
2. `backend/src/services/smartPricingEngine.ts`: The mathematical reference for target profit, markups, and rounding allocations.
3. `backend/src/controllers/vouchers.ts`: The central transactional hub where double-entry posting, inventory movements, and voucher lifecycles intersect.
4. `frontend/src/utils/printPagination.ts`: The core A4 print pagination budget calculator.
5. `frontend/src/App.tsx`: The primary route dispatcher and global application state holder.
