# TASK 009 — Phase 2 Plan

## 1. Executive Summary

This document presents the Phase 2 Production Readiness & Remediation Plan for the LedgerFlow accounting and ERP system.

Based on the comprehensive, read-only Phase 1 audit ([TASK-009-PHASE-1-AUDIT.md](file:///g:/HTML/LedgerFlow/TASK-009-PHASE-1-AUDIT.md)), LedgerFlow's core engine contains **0 confirmed defects**, with all previous defects DEF-008-01 through DEF-008-13 verified 100% resolved across 189 green tests.

All 46 API client methods called by the frontend map directly to active backend endpoints. There are zero architectural or financial blockers to beginning the UI/UX implementation phase. Consequently, the approved remediation scope for Phase 2/3 is focused strictly on **high-value production hardening and query contract completion**:
1. SQLite connection lock timeout hardening (`PRAGMA busy_timeout = 5000;`).
2. Multi-tenant compound index for accelerated voucher reporting queries.
3. Voucher status filter support in `GET /vouchers` for seamless UI draft vs. posted segregation.

All existing accounting, inventory, tax, security, and FY invariants remain strictly preserved with zero schema changes and zero frontend changes.

---

## 2. Phase 1 Findings Summary

| Classification | Count | Description |
|---|---|---|
| **Confirmed Defects** | **0** | No data corrupting, inconsistent, or invalid behavior found. |
| **Missing Capabilities** | **8** | Pre-accounting (Quotes/POs), stock transfers, item stock ledger, godowns/units full CRUD, batch tracking, GSTR JSON export, RMA job cards, online restore. |
| **Production Hardening** | **5** | SQLite busy timeout, composite query index, voucher status filter, structured logging, auth rate limiting. |
| **UI Blockers** | **0** | All existing UI screens and operations have fully functioning backend contracts. |

---

## 3. Approved Fixes

### HARDEN-001: SQLite Connection Lock Timeout Hardening
- **Title:** Configure `PRAGMA busy_timeout = 5000;` on SQLite Connection
- **Severity:** P2 (Production Hardening)
- **Reason:** In WAL mode under concurrent operations, write transactions (`BEGIN IMMEDIATE`) can briefly lock the database. Without a busy timeout, competing threads immediately fail with `SQLITE_BUSY: database is locked`.
- **Target Behavior:** SQLite waits up to 5,000ms for locks to clear before raising an error, ensuring smooth multi-request concurrency.
- **Affected Files:** `backend/src/database/connection.ts`
- **Affected Layers:** Database Connection Layer

### HARDEN-002: Multi-Tenant Compound Query Indexing
- **Title:** Add Composite Index on `vouchers(company_id, voucher_date, status)`
- **Severity:** P2 (Performance Hardening)
- **Reason:** Multi-tenant report queries filter by `company_id = ? AND voucher_date >= ? AND voucher_date <= ? AND status = 'POSTED'`. Without this composite index, SQLite filters by date first and then scans company/status.
- **Target Behavior:** Queries utilize a dedicated covering composite index, improving response times as transaction volume scales.
- **Affected Files:** `backend/src/database/connection.ts` (safe migration block)
- **Affected Layers:** Database Schema / Indexing Layer

### HARDEN-003: Voucher Status Filter Support on `GET /vouchers`
- **Title:** Add `status` Query Parameter Support to `GET /vouchers`
- **Severity:** P2 (UI Contract Completion)
- **Reason:** The frontend Voucher Management view requires filtering vouchers by lifecycle state (`DRAFT` vs `POSTED` vs `CANCELLED`). Currently `GET /vouchers` only supports `type`, `fromDate`, and `toDate`.
- **Target Behavior:** `GET /vouchers?status=DRAFT` returns only draft vouchers; omitting `status` preserves existing behavior.
- **Affected Files:** `backend/src/api/routes.ts`
- **Affected Layers:** API Routing Layer

---

## 4. Deferred Findings

The following capabilities are useful but explicitly deferred until after the UI phase:
1. **Item Stock Movement Ledger Endpoint (`/reports/stock-ledger/:itemId`):** Aggregated stock summary is currently sufficient for UI; item-level chronological ledger drill-down will be added in a subsequent reporting milestone.
2. **Dedicated Inter-Godown Stock Transfer Contract:** Can currently be executed via paired lines in `STOCK_JOURNAL`.
3. **Full Godowns & Units Master CRUD (`POST`, `PUT`, `DELETE`):** Default seed provides standard godowns and units; master editing can be expanded in post-UI master maintenance.
4. **Online Database Restore Endpoint (`POST /utilities/restore`):** Backup is online via `VACUUM INTO`; restore remains an administrative operational procedure.
5. **Statutory GSTR-1 & GSTR-3B JSON File Export:** GST Summary report computes all required figures; portal file export formatting will be added in statutory export phase.

---

## 5. Future Capabilities

1. Pre-accounting Quotations & Purchase Orders with conversion pipelines.
2. Formal Service / RMA Job Card ticketing state machines.
3. Batch / Lot tracking with manufacturing and expiry dates.
4. Schema migration from SQLite to PostgreSQL.
5. Multi-branch distributed offline synchronization.

---

## 6. Detailed Work Packages

### Work Package 1 (WP-01): SQLite Busy Timeout Configuration
- **File:** `backend/src/database/connection.ts`
- **Change:** Add `db.exec('PRAGMA busy_timeout = 5000;');` immediately following `PRAGMA journal_mode = WAL;`.
- **Risk:** Zero risk; native SQLite parameter that increases lock tolerance.

### Work Package 2 (WP-02): Composite Index for Voucher Filtering
- **File:** `backend/src/database/connection.ts`
- **Change:** Add `try { db.exec('CREATE INDEX IF NOT EXISTS idx_vouchers_comp_date_status ON vouchers(company_id, voucher_date, status);'); } catch {}` in the migration block.
- **Risk:** Zero risk; safe non-destructive DDL that accelerates queries.

### Work Package 3 (WP-03): Voucher Status Query Filter
- **File:** `backend/src/api/routes.ts`
- **Change:** In `router.get('/vouchers', ...)`, extract `status` from `req.query`, and if provided, append `AND v.status = ?` with parameter binding.
- **Risk:** Zero risk; additive filter, 100% backward-compatible.

---

## 7. Transaction Boundary Plan

- All voucher posting, amendments, and stock adjustments remain enclosed within strict `BEGIN IMMEDIATE` / `COMMIT` transactions.
- Zero changes to transaction boundaries.
- Busy timeout enhances transaction resilience under concurrent write contention.

---

## 8. Security Plan

- Multi-tenant boundary checks remain strictly enforced on all queries (`company_id = ?`).
- Role-based authorization (`withAuth`, `withCompany`, `withAccountant`, `withAdmin`, `withOwner`) remains completely untouched.
- `GET /vouchers` retains company scoping (`WHERE v.company_id = ?`).

---

## 9. Accounting Integrity Plan

- Fundamental double-entry equation ($\sum \text{Debits} \equiv \sum \text{Credits}$) remains invariant.
- Nominal accounts continue resetting to ₹0 at FY boundaries.
- Multi-year dynamic retained earnings on Balance Sheet remains invariant.
- Zero alterations to double-entry logic or chart of accounts.

---

## 10. Inventory Integrity Plan

- Perpetual WAVG inventory valuation remains invariant.
- Negative stock policy obeys company configuration.
- Consumed stock and sold serial safety checks remain invariant.
- Zero alterations to valuation formulas or stock movement tables.

---

## 11. API Contract Plan

- `GET /vouchers`:
  - Request: `GET /api/vouchers?companyId=...&type=...&status=DRAFT&fromDate=...&toDate=...`
  - Response: Array of voucher objects matching criteria.
  - Backward compatibility: Omitting `status` returns all statuses up to `LIMIT 100`.

---

## 12. Regression Test Plan

Create [backend/tests/task-009-readiness.test.ts](file:///g:/HTML/LedgerFlow/backend/tests/task-009-readiness.test.ts) covering:
1. `PRAGMA busy_timeout` returns `5000`.
2. Composite index `idx_vouchers_comp_date_status` exists in SQLite master.
3. `GET /vouchers` status filter returns only matching vouchers (e.g. `DRAFT` vs `POSTED`).
4. Full accounting and inventory integrity verification.

Run all 189 existing test cases to confirm 100% regression freedom.

---

## 13. Acceptance Criteria

1. Busy timeout is configured to 5000ms.
2. Composite index is created without schema file modification.
3. `GET /vouchers` filters correctly by `status`.
4. All 189 existing tests pass cleanly (100% GREEN).
5. All new TASK 009 tests pass cleanly.
6. TypeScript check clean (0 errors).
7. Backend and frontend builds clean (0 errors).
8. `schema.sql` diff = 0.
9. `frontend/` diff = 0.

---

## 14. Commit Plan

- Commit `009-A`: `chore(database): configure sqlite busy timeout and voucher composite index [HARDEN-001, HARDEN-002]`
- Commit `009-B`: `feat(vouchers): support status filtering in get vouchers endpoint [HARDEN-003]`
- Commit `009-C`: `test(readiness): regression suite for TASK 009 production readiness hardening`
- Commit `009-D`: `chore: finalize TASK 009 implementation report and acceptance sign-off`

---

## 15. Files Allowed to Change

- `backend/src/database/connection.ts`
- `backend/src/api/routes.ts`
- `backend/tests/task-009-readiness.test.ts` (New test file)
- `TASK-009-PHASE-2-PLAN.md`
- `TASK-009-PHASE-3-IMPLEMENTATION-REPORT.md`

---

## 16. Files Explicitly Protected

- `backend/src/database/schema.sql` (STRICTLY FORBIDDEN)
- `frontend/**` (STRICTLY FORBIDDEN)
- `package.json` (STRICTLY FORBIDDEN)
- `backend/src/domain/accounting/double-entry.ts` (STRICTLY FORBIDDEN)
- `backend/src/domain/inventory/valuation.ts` (STRICTLY FORBIDDEN)
- `backend/src/domain/tax/gst-engine.ts` (STRICTLY FORBIDDEN)

---

## 17. UI Handoff Criteria

The backend is certified 100% ready for the UI phase when:
- All 46 frontend API contracts are validated.
- All 189 + new tests pass with 0 failures.
- Zero open defects exist.
- Working tree is clean.

---

## 18. Final Status

PHASE 2 STATUS:
PLAN READY — AWAITING APPROVAL
