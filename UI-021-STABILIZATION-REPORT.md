# LedgerFlow UI-021 Stabilization Report

**Executive Summary:**  
UI-021 addresses fundamental layout robustness, accessibility contrast in dark themes, voucher immutability & audit-compliant lifecycle workflows, invoice design fidelity with optional white-labeling, and a complete audit of all presentation metrics to ensure 100% adherence to authentic database accounting facts.

---

## 1. Pillar 1: Dashboard Layout & Scroll Stabilization

### Root Causes
- Panels and tables placed in flex and grid containers previously lacked explicit constraints (`min-width: 0; min-height: 0;`), causing flex child expansion when content size varied between adjacent columns.
- Table containers did not enforce explicit baseline min-heights, leading to uneven card heights across screen resolutions.
- Table row action menus (kebab dropdowns) with fixed `top: 100%` positioning near the bottom of tables exceeded the boundary of parent scroll wrappers (`overflow-x: auto`), generating unwanted vertical scrollbars and clipping menu items.

### Solutions Implemented
- In `frontend/src/styles/dashboard.css`:
  - Added `align-items: stretch;` to `.lf-dashboard-grid-bottom` and page grid layouts.
  - Specified `min-width: 0; min-height: 0; height: 100%;` on `.lf-panel-card` containers.
  - Set explicit min-height thresholds: `.lf-dashboard-grid-bottom .lf-panel-card` at `min-height: 380px;`, Recent Sales/Purchases cards at `min-height: 420px;`, and table inner scroll containers at `min-height: 260px;` (300px on Dashboard).
- Dynamic Action Menu Positioning:
  - In `DashboardView.tsx`, `SalesView.tsx`, and `PurchaseView.tsx`, row action popovers evaluate:
    ```tsx
    const isNearBottom = idx >= list.length - 2;
    ```
  - When `isNearBottom` is true, the popover opens upward (`bottom: '100%'`, `marginBottom: 4px`, `top: undefined`). This completely eliminates vertical scroll jumps and guarantees full visibility without clipping.

---

## 2. Pillar 2: Dark Theme Contrast & Form Controls Audit

### Root Causes
- Windows Chromium browser engines apply user-agent defaults that render `<option>` tags inside native `<select>` dropdowns with a bright white background (`#FFFFFF`) and dark text unless `color-scheme: dark;` and explicit background/color rules are established on the form controls.
- Reports and tables in specific views contained hardcoded `#ffffff` backgrounds or light borders that clashed when users switched to Dark Mode (`[data-theme="dark"]`).

### Solutions Implemented
- In `frontend/src/styles/tokens.css`:
  - Defined explicit theme tokens `--bg-card` and `--border-color`.
  - Added global styling for form controls:
    ```css
    select, input, textarea {
      color-scheme: light dark;
    }
    [data-theme="dark"] select,
    [data-theme="dark"] input,
    [data-theme="dark"] textarea {
      color-scheme: dark;
    }
    [data-theme="dark"] option,
    [data-theme="dark"] optgroup {
      background-color: #191919;
      color: #F5F5F5;
    }
    ```
- Updated `OutstandingReportsView.tsx` and related components to replace hardcoded `#ffffff` card backgrounds with `var(--bg-card)`.
- Maintained strict print isolation: `@media print` rules force print views and invoice modals to remain a clean white page with dark ink, preserving professional document printing.

---

## 3. Pillar 3: Three-Tier Voucher Lifecycle & Permanent Purge

### Architectural Distinction
LedgerFlow enforces a rigorous separation between the three voucher lifecycle states to uphold statutory double-entry accounting standards and prevent regulatory non-compliance:

```
[ POSTED Voucher ] ───(Direct DELETE)───> ⛔ HTTP 405 Method Not Allowed (Immutable)
       │
       ▼ (Cancel Voucher)
[ CANCELLED Voucher ] (Reversal ledger entries created, audit log preserved)
       │
       ├─► (Hide from Normal Lists) ──► is_hidden = 1 (Excluded from default lists, viewable via toggle)
       │
       └─► (Permanent Purge) ──► OWNER/ADMIN Only + Zero External Bill Allocations
                                  ├── Writes VOUCHER_PERMANENT_PURGE audit tombstone
                                  └── Atomically purges child and voucher records
```

### Invariants & Safeguards
1. **POSTED Immutability (Suite 5 Test 5.1):** Direct deletion of active POSTED vouchers is strictly forbidden. The backend unconditionally returns `405 Method Not Allowed`.
2. **Draft Deletion:** DRAFT vouchers possess zero accounting or inventory effects and are safely removed.
3. **Hide from Normal Lists:**
   - Added `is_hidden INTEGER DEFAULT 0` column to `vouchers` table in SQLite schema.
   - `GET /vouchers` defaults to filtering `WHERE is_hidden = 0`.
   - Added endpoints `POST /vouchers/:id/hide` and `POST /vouchers/:id/unhide`.
   - Added `includeHidden=true` query parameter and "Show Cancelled" UI toggles across Sales and Purchase views.
4. **Permanent Purge with Audit Tombstone:**
   - Available strictly for CANCELLED vouchers.
   - Requires `OWNER` or `ADMIN` role (`req.membershipRole || req.user?.role`).
   - Checks that zero external bill allocations reference the voucher (`SELECT COUNT(*) FROM bill_allocations WHERE reference_voucher_id = ? AND voucher_id != ?`).
   - Atomically records a `VOUCHER_PERMANENT_PURGE` audit tombstone with full snapshot details before deleting dependent records (`tax_entries`, `bill_allocations`, `stock_entries`, `ledger_entries`, `voucher_lines`) and the `vouchers` row inside an atomic transaction.

---

## 4. Pillar 4: Standard Invoice Fidelity & Wordmark Configuration

### Visual Parity
- Updated `StandardInvoice.tsx` to match `Standard Invoice Model.png` (SkyTech Computers):
  - Removed decorative handwritten SVG signatures.
  - Replaced with a clean 48px physical blank signature line and statutory label: `Authorized Signatory For {companyName}`.
  - Maintained two-tone header (`TAX INVOICE`), peach accent headers (`#FFF7ED`), and Indian currency words conversion.

### White-Labeling & LedgerFlow Wordmark Preference
- Added optional `showLedgerflowWordmark` flag (`boolean`) in `InvoiceAdapter.ts`.
- When enabled, renders a discreet, elegant wordmark in the bottom-left footer (`Powered by LedgerFlow`).
- When disabled, renders a clean blank footer.
- Accessible via print configuration toggle in `InvoicePrintModal.tsx` and persistent company settings in `InvoicePrintingTab.tsx` (`invoice_settings.show_ledgerflow_wordmark`).

---

## 5. Pillar 5: Real Business Data Audit (Zero Fabricated Metrics)

All hardcoded percentages, artificial multiplier curves, and synthetic defaults have been audited and eliminated.

| Module | Old Fabricated Value | New Authentic Data Source | Verification |
|---|---|---|---|
| **Sales KPI 1** | `+12.4% vs last period` | `growthMetrics.salesGrowth` derived from monthly vouchers or `—` | Authentic calculation against prior 30-day window |
| **Sales KPI 2** | `+8.6% vs last period` | `growthMetrics.paidGrowth` derived from received payments or `—` | Calculated from cash/bank debit entries |
| **Sales KPI 3** | `+4.2% vs last period` | `growthMetrics.unpaidGrowth` derived from outstanding dues or `—` | Calculated from pending debtor balances |
| **Sales KPI 4** | `↑ 2.8% active` | Neutral badge `Active Period` | Displays active FY indicator without fake growth rate |
| **Sales Trends** | Fake hardcoded bezier curves `[35, 45, ...]` | Real `trendData` points aggregated from monthly sales vouchers | Rendered only when real invoices exist |
| **Purchases KPI 1** | `↑ 8.6% vs last month` | `purchaseGrowth.purchasesGrowth` from real purchase vouchers | Real month-over-month calculation |
| **Purchases KPI 2** | `↑ 12.3% paid` | `purchaseGrowth.paidGrowth` from authentic payment vouchers | Real payment comparison |
| **Purchases KPI 3** | `↑ 6.1% overdue` | `purchaseGrowth.unpaidGrowth` from creditor balances | Real balance comparison |
| **Purchases KPI 4** | `↑ 3 new` | Neutral badge `Active Vendors` | Reflected from master supplier count |
| **Purchases Ratio**| `paidPercentage \|\| 69` | `kpis.paidPercentage \|\| 0` | 0% default when no purchase activity recorded |

---

## 6. Verification & Test Matrix

| Test Suite | Purpose | Result |
|---|---|---|
| `test-ui021-voucher-lifecycle.js` | Integration test covering DRAFT deletion, POSTED 405 defense, Hide/Unhide, Cancel, and Permanent Purge with audit tombstone verification | **8/8 Passed (100%)** |
| `test-ui020-invoice-settings.js` | Settings persistence, financial year prioritization, GST invoice structure, and tenant isolation | **5/5 Passed (100%)** |
| `npm --prefix backend test` | Comprehensive backend test suite (Task 001 Security, Task 003 Inventory, Task 004 Masters, Concurrency) | **194/194 Passed (100%)** |
| `npm --prefix frontend run build` | TypeScript compile and Vite production bundling | **Exit Code 0 (Clean)** |

---

## 7. Conclusion
The LedgerFlow system is fully stabilized under UI-021. Form control contrast, layout overflow elimination, voucher immutability boundaries, invoice fidelity, and presentation metrics strictly reflect genuine double-entry accounting truths.
