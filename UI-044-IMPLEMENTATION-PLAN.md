# UI-044 Implementation Plan: Journal Module Implementation

## 1. Objectives & Source of Truth

Implement the complete **Journal Module** matching the four reference screenshots:
1. `media_1793878224822_e98c1a9f.jpg` → **Journal Dashboard** (`JournalDashboardView.tsx`)
2. `media_1793878224928_c43645b5.jpg` → **Create Journal Entry** (`CreateJournalView.tsx`)
3. `media_1793878224807_ff4187a7.jpg` → **Journal Register** (`JournalRegisterView.tsx`)
4. `media_1793878224828_dde10392.jpg` → **Journal Voucher Details** (`JournalDetailsView.tsx`)
5. A4 Printable Document → **Journal Print Modal** (`JournalPrintModal.tsx`)

---

## 2. Navigation Architecture

- **Main Navigation Click:**
  - Clicking the parent **Journal** item in `Sidebar.tsx` navigates directly to `JournalDashboardView` (`journalViewMode = 'dashboard'`).
- **Collapsible Submenu:**
  - The parent item remains expandable/collapsible.
  - Submenu strictly renders **only two** items:
    1. **Create Journal** (`journalViewMode = 'create'`)
    2. **Journal Register** (`journalViewMode = 'register'`)
  - **Zero** redundant "Journal Dashboard" submenu entry.
- **Active Navigation Highlighting:**
  - On Dashboard: Journal parent is active; submenu items remain unhighlighted.
  - On Create Journal: Journal parent is active and `Create Journal` child is highlighted.
  - On Journal Register & Details: Journal parent is active and `Journal Register` child is highlighted.

---

## 3. Screen Specifications & Deliverables

### 3.1 Journal Dashboard (`JournalDashboardView.tsx`)
- 5 Authentic KPI Cards:
  - `Total Journal Amount`
  - `Journal Count`
  - `Posted Entries`
  - `Draft Entries`
  - `Cancelled Entries`
- Journal Trend Chart:
  - Monthly distribution (Apr–Oct/Mar) with `Amount` (₹ Lakhs) and `Count` toggles.
- Journal by Type Donut Chart:
  - Breakdown by `Adjustment Entries`, `Transfer Entries`, `Provision Entries`, and `Other Entries`.
- Needs Attention Section:
  - `Draft Entries`, `Cancelled Entries`, `High Value Entries (> ₹5,00,000)` with direct register filters.
- Recent Journal Entries Table:
  - Date, Journal No, Narration, Debit, Credit, Status badge, and `View Register →` shortcut.

### 3.2 Create Journal Entry (`CreateJournalView.tsx`)
- Header Actions:
  - `Save as Draft`, `Preview` (read-only modal, 0 writes), `Save & Post`.
- Voucher Details:
  - `Journal No. *` (authoritative prefix `JRN`), `Journal Date *`.
- Entry Information:
  - `Entry Type` dropdown (`Adjustment Entry`, `Transfer Entry`, `Provision Entry`, `Correction Entry`, `Other Entry`).
  - `Reference No. (Optional)`.
- Ledger Entries Grid:
  - Dynamic rows: `#`, `Ledger Account *`, `Narration (Optional)`, `Debit (₹)`, `Credit (₹)`, `Action` (trash icon).
  - Mutual exclusivity: Debit and Credit cannot both have values on the same line.
  - Minimum 2 valid ledger lines required.
  - Real-time running totals for Debit and Credit.
  - Status indicator: `Balanced` (green checkmark) vs `Unbalanced` (amber alert with difference).
- Narration / Remarks (Required).
- Entry Summary: Total Debit, Total Credit, Difference highlighted box.
- Live Accounting Preview: `Dr` and `Cr` summary lines.
- Notes card with validation guidance.

### 3.3 Journal Register (`JournalRegisterView.tsx`)
- 5 KPI summary cards.
- Multi-parameter filter toolbar: Search, Date Range, Entry Type, Ledger Account, Status (`All`, `Posted`, `Draft`, `Cancelled`), Refresh.
- Register Table: Checkbox, Date, Journal No (orange link), Entry Type badge, Narration, Total Amount, Status badge, Actions (`View`, `Print`, `Cancel`).
- Pagination: Configurable rows per page, page navigation.
- Statutory Cancellation modal with mandatory audit reason.

### 3.4 Journal Voucher Details (`JournalDetailsView.tsx`)
- Header: Breadcrumb, Journal No, Status badge, Subtitle, `← Back`, `Duplicate`, `Print / PDF`, `More Actions`.
- Voucher Details: Journal No, Date, Entry Type, Reference No, Status.
- Entry Information: Narration, Created By, Created On, Posted On.
- Voucher Summary: Total Debit, Total Credit, Difference.
- Ledger Entries table with group name displayed below ledger account name.
- Accounting Entry summary, Notes, and Voucher Timeline stepper.

### 3.5 Journal Print Modal (`JournalPrintModal.tsx`)
- A4 printable voucher with letterhead, voucher metadata, ledger entries table, debit/credit totals, amount in Indian words, and authorized signatory.
- Strict zero-leakage of internal notes.

---

## 4. Backend & Accounting Engine Integration

1. **Prefix Standard:**
   - Update default prefix in `PostingEngine.getNextVoucherNumber` for `JOURNAL` to `JRN` to match mockups (`JRN-2026-0036`).
2. **Metadata Storage:**
   - Store `entry_type` in `vouchers.payment_mode` and in `terms_conditions` JSON metadata for 100% round-trip fidelity.
3. **Double-Entry Validation:**
   - Strict `totalDebit === totalCredit` in integer paise.
   - Rejection of unbalanced postings.
   - Minimum 2 lines.
   - Server-side ledger validation and tenant company isolation.
4. **Draft vs Posted Lifecycle:**
   - Draft creates voucher record with status `DRAFT`, 0 active ledger entries, and stores lines in metadata / draft voucher lines.
   - Posting atomically creates `ledger_entries` for each line.
   - Cancelling reverses/clears ledger entries and updates status to `CANCELLED` with audit tombstone.
5. **API Enhancements:**
   - Update `GET /vouchers/:id` to join `lg.group_name` on `ledger_entries` and `voucher_lines`.

---

## 5. Global Dark Theme Stabilization

- Build all new Journal components using semantic tokens from `tokens.css`:
  - `var(--color-surface)`
  - `var(--color-surface-secondary)`
  - `var(--color-border)`
  - `var(--color-text)`
  - `var(--color-text-secondary)`
  - `var(--color-text-muted)`
  - `var(--color-primary)`
- Verify high contrast and zero hardcoded white/black colors in dark mode.

---

## 6. Verification & Test Strategy

1. **Automated Test Suite (`backend/tests/ui044-journal-module.test.ts`):**
   - Sidebar navigation invariants (Journal parent opens Dashboard, submenu strictly has 2 items).
   - Authoritative voucher numbering (`JRN-` prefix).
   - Draft creation (0 ledger entries).
   - Atomic balanced posting (Dr == Cr).
   - Unbalanced posting rejection.
   - Minimum 2 lines enforcement.
   - Entry type persistence and retrieval.
   - Multi-tenant company isolation.
   - Cancellation and reversal.
   - Dashboard & Register KPI reconciliation against SQLite.
2. **Regression Verification:**
   - `npm run test:ui043` (Payments)
   - `npm run test:ui042` (Receipts)
   - Full regression suite `npm test`
   - Frontend production build `npm run build`
