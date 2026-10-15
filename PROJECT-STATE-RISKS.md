# LedgerFlow: Prioritized Risk, Defect & Vulnerability Register

**Task ID:** PROJECT-STATE-001  
**Audit Date:** 2026-10-15  
**Version:** 1.0.0  
**Scope:** Architecture, Security, Financial Integrity, Data Privacy, and Production Readiness  

---

## 1. Executive Risk Summary

This register catalogs all identified defects, architectural vulnerabilities, financial risks, privacy concerns, and production deployment gaps discovered during the comprehensive audit of the LedgerFlow codebase.

| Risk ID | Category | Severity | Description | Status | Immediate Mitigation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RSK-SEC-001** | Security | **Medium** | Missing rate-limiting middleware on `/api/auth/login` | Open | Install `express-rate-limit` to prevent credential brute-forcing |
| **RSK-SEC-002** | Security | **Low** | Dev fallback generates random JWT secret if environment variable is unset | Managed | Enforce strict startup failure in `production` mode if `JWT_SECRET` is unset |
| **RSK-FIN-001** | Accounting | **Low** | Floating-point conversions during rupee input before integer-paise multiplication | Managed | Standardize on `Math.round(val * 100)` utility across all input controllers |
| **RSK-PRV-001** | Privacy | **Low** | Potential dealer cost leakage if new print templates are added without audit | Managed | Implement automated DOM assertion test for any new print template |
| **RSK-OPS-001** | Infrastructure | **Medium** | Single SQLite file concurrency limits under high simultaneous write loads | Open | SQLite WAL mode is enabled, but horizontal scaling requires PostgreSQL or Litestream replication |
| **RSK-OPS-002** | Testing | **Low** | Playwright CDN 404 driver download blocks automated headless PDF generation | Open | Bundle local Chromium binary or test against installed Chrome browser |
| **RSK-UI-001** | UI / Print | **Low** | Very long item descriptions (5+ lines) could overflow estimated line item height budget | Open | Refine row-height calculation in `printPagination.ts` to account for description string length |

---

## 2. Security & Multi-Tenancy Risks

### RSK-SEC-001: Rate Limiting on Authentication Endpoints
- **Severity:** Medium
- **Location:** `backend/src/routes/auth.ts`, `backend/src/controllers/auth.ts`
- **Finding:** The `/api/auth/login` endpoint does not apply rate-limiting middleware. A malicious actor could execute automated brute-force attacks against user passwords.
- **Evidence:** Inspection of `backend/src/server.ts` and `auth.ts` shows standard Express JSON parsing and routing without an IP-based throttle.
- **Recommended Action:**
  ```typescript
  import rateLimit from 'express-rate-limit';
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login requests per window
    message: { error: 'Too many login attempts. Please try again later.' }
  });
  router.post('/login', loginLimiter, authController.login);
  ```

### RSK-SEC-002: JWT Secret Environment Configuration
- **Severity:** Low (Development) / Critical (if deployed without env)
- **Location:** `backend/src/middleware/security.ts`
- **Finding:** In development, `security.ts` auto-generates a process-local random string if `process.env.JWT_SECRET` is unset. If restarted, all existing tokens are invalidated. In production, it throws an error.
- **Evidence:** Verified in `security.ts`:
  ```typescript
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production.');
  }
  ```
- **Recommended Action:** Ensure production deployment guides explicitly document setting `JWT_SECRET` in `.env`.

---

## 3. Financial & Accounting Risks

### RSK-FIN-001: Rupee-to-Paise Input Conversion Accuracy
- **Severity:** Low
- **Location:** `backend/src/controllers/vouchers.ts`, `backend/src/services/smartPricingEngine.ts`
- **Finding:** Frontend sends numeric rupee values (e.g., `1250.75`), which backend converts to integer paise. If floating-point arithmetic is executed directly without rounding (e.g., `1250.75 * 100 = 125074.99999999999`), converting via `Math.floor` or truncation would introduce a 1-paise error.
- **Evidence:** Audit confirms backend universally uses `Math.round(val * 100)` or integer parsing. Invariant tests in `accounting-invariants.test.ts` pass with 0 discrepancy.
- **Recommended Action:** Centralize all conversion in a single shared helper `toPaise(rupees: number): number => Math.round(Number(rupees) * 100)`.

### RSK-FIN-002: Financial Year Period Lock Bypass
- **Severity:** Low
- **Location:** `backend/src/controllers/financialYears.ts`, `backend/src/controllers/vouchers.ts`
- **Finding:** If a user back-dates a voucher to a `LOCKED` or `CLOSED` financial year, financial reports for that historical period could be retroactively altered.
- **Evidence:** `vouchers.ts` validates the voucher date against `financial_years` and rejects postings to closed years.
- **Recommended Action:** Add unit test explicitly verifying that attempting to create or post a voucher dated within a `LOCKED` or `CLOSED` financial year returns HTTP 400.

---

## 4. Privacy & Confidential Data Risks

### RSK-PRV-001: Dealer Cost Leakage in Customer Quotations
- **Severity:** Medium (Business Impact) / Low (Technical Likelihood)
- **Location:** `frontend/src/components/invoice/StandardInvoice.tsx`, `frontend/src/pages/QuotationPrintModal.tsx`
- **Finding:** In B2B sales, disclosing dealer acquisition costs or internal profit margins to customers would severely damage negotiation leverage.
- **Evidence:** Verified by `test-ui026-print-system.mjs` (Test 6: PASS). The rendered HTML DOM for printed invoices and quotations contains neither dealer cost fields nor internal margin metrics.
- **Recommended Action:** Require that any new print template added to the codebase must pass a DOM-scrubbing privacy test before merging.

---

## 5. Operational & Production Deployment Gaps

### RSK-OPS-001: SQLite Concurrency Under High Simultaneous Load
- **Severity:** Medium
- **Location:** `backend/data/ledgerflow.db`
- **Finding:** SQLite allows multiple concurrent readers but serializes writes. Under intense multi-user simultaneous invoice posting (e.g., 50+ concurrent cashier terminals), database write-lock contention (`SQLITE_BUSY`) could occur.
- **Evidence:** Current settings use WAL mode (`PRAGMA journal_mode = WAL`) and busy timeouts, which accommodate typical MSME retail workloads (<20 terminals).
- **Recommended Action:** For multi-branch or enterprise deployments (>50 concurrent write streams), plan an abstraction layer to support PostgreSQL.

### RSK-OPS-002: External CDN Dependency for Playwright PDF Generation
- **Severity:** Low
- **Location:** Root test scripts & browser automation
- **Finding:** Running `npx playwright test` requires downloading the Chromium driver binary from Microsoft's Azure Edge CDN. When the CDN returns 404 or the machine is offline, automated headless PDF tests fail.
- **Evidence:** Observed during this audit: `playwright-1.57.0-win.zip` returned HTTP 404.
- **Recommended Action:** Use system-installed Chrome via `puppeteer-core` with `executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'` or rely on native browser `window.print()`.

---

## 6. UI, Design & Print Defects

### RSK-UI-001: Row Height Budget for Multi-Line Descriptions
- **Severity:** Low
- **Location:** `frontend/src/utils/printPagination.ts`
- **Finding:** The print pagination algorithm assumes an average row height budget (e.g., ~38px per item row). If a user enters an unusually long item description (e.g., 10 lines of technical specifications), the row could exceed 38px, causing the page to push content past the 1020px physical page boundary.
- **Evidence:** Standard items with 1-2 lines paginate cleanly. Extreme test cases with 8-line descriptions have not been tested with dynamic row measurement.
- **Recommended Action:** Update `calculateItemRowHeight(item)` in `printPagination.ts` to dynamically estimate height based on `Math.ceil(item.description.length / 50) * 16px`.

---

## 7. Demo Data & Production Cleanliness Audit

### RSK-DAT-001: Hardcoded Test Fixtures in Production Screens
- **Severity:** Low
- **Finding:** A search of the codebase was conducted to detect hardcoded demo company names, fake customers, dummy PANs, or fabricated sales statistics.
- **Evidence:**
  - `backend/data/ledgerflow.db` contains test seed records used during development (e.g., test users and dummy companies).
  - Production components in `frontend/src/pages/` fetch data dynamically from `/api/*` endpoints. If the database is empty, the UI displays legitimate empty states (e.g., "No invoices found. Click 'Create Invoice' to get started").
  - No artificial sales statistics or hardcoded fake chart curves were found masking missing API data in production screens.
- **Recommended Action:** Provide a clean database initialization script (`npm run db:reset-clean`) that seeds only mandatory system ledgers (Cash, Bank, Capital, GST) without demo transactions for fresh production deployments.
