# UI-047 IMPLEMENTATION PLAN
## Dashboard Intelligence, Sales Profitability & Invoice Editing Integrity

---

## 1. Executive Summary & Objectives

This implementation plan outlines the architecture, diagnosis, and step-by-step engineering tasks to stabilize, redesign, and enhance LedgerFlow across five core domains:

1. **Invoice Editing & Numbering Integrity**: Ensure editing draft invoices strictly preserves the original invoice number and voucher ID in-place without generating synthetic/duplicate vouchers or consuming numbering sequences. Strictly protect posted vouchers against silent overwrites while providing clear statutory amendment guidance.
2. **Sales Dashboard Recent Invoices**: Enforce a fixed-height layout with stable pagination controls (previous/next, page indicators, row counts) and responsive table layout that eliminates layout shifting.
3. **Authoritative Sales Profitability**: Implement a prominent profitability card displaying Net Sales (excluding GST), Cost of Goods Sold (COGS) from authoritative stock valuation/P&L records, Gross Profit, and Gross Profit Margin percentage. Clearly distinguish Gross Profit from Net Profit, never fabricating missing expenses.
4. **Main Dashboard Redesign**:
   - **Business Health Gauge**: Replace the previous visualization with a premium semicircular gauge inspired by the reference design (vibrant orange `#FF6B2B` progress arc, light grey remaining arc, 21 fine inner tick marks, central numerical score, small trend pill, subtitle "of 100 points") powered by a 100% transparent, explainable 100-point scoring model grounded in real accounting data.
   - **Stock Summary Card**: Remove Quick Actions and replace with a high-fidelity Stock Summary card featuring an informative valuation tooltip, as-of date selector (Today, This Month, Previous Month, Current FY, Custom), Total Stock Value, month-over-month trend indicator, category legend, and a large central-value Donut chart computed from authoritative inventory valuation.
5. **Sales & Purchase Overview Redesign**: Integrate summary KPI metrics with previous-period comparison percentages (safely avoiding division by zero) and adaptive chart granularity (Daily for week/short periods, Weekly for month/quarter, Monthly for financial year).

---

## 2. Phase 1: Inspection & Diagnosis of Existing Subsystems

### 2.1 Invoice Editing & Numbering Subsystem
- **Current Behavior**:
  - In `frontend/src/pages/SalesInvoiceView.tsx` line 1177, `buildPayload` conditionally cleared `voucherNumber` whenever `status === 'DRAFT'` (`voucherNumber: status === 'DRAFT' ? undefined : (voucherNumber || undefined)`).
  - When editing a draft invoice, `SalesInvoiceView.tsx` failed to pass the existing `voucher_number`, causing the backend or client to allocate a new sequence or default to a temporary `DFT-` number.
  - In `SalesInvoiceView.tsx`, `editVoucherStatus` was not tracked. When a draft invoice was edited and submitted via "Post & Save Invoice", it invoked `api.updateVoucher(editVoucherId, payload)`, which only updated the draft record in `vouchers` and `voucher_lines` but **never promoted** the draft to `POSTED` status (unlike `PurchaseInvoiceView.tsx` which invokes `api.postDraftVoucher`).
  - In `backend/src/api/routes.ts` line 1675, editing a `POSTED` voucher unconditionally forced `payload.voucherNumber = undefined`, causing `PostingEngine.amendVoucher` to allocate a replacement number and cancel the original without explicit confirmation in the UI.
- **Root Cause**:
  - Lack of distinction between Create mode and Edit mode in `buildPayload`.
  - Missing post-draft promotion step in `SalesInvoiceView.tsx` upon "Post & Save".
  - Missing user warning banner distinguishing in-place draft edits from statutory amendments of posted vouchers.

### 2.2 Sales Dashboard Recent Invoices Layout
- **Current Behavior**:
  - In `frontend/src/pages/SalesView.tsx` line 1024, the table container had `minHeight: '420px'` but rendered `filtered.map(...)` over the entire array without pagination.
  - Adding invoices caused the card to expand indefinitely, disrupting the adjacent 3-card column (Top Customers, Donut, Quick Actions) and altering the dashboard layout.
- **Root Cause**:
  - Absence of fixed height clamping and client-side pagination slicing (page number, total pages, page size selector).

### 2.3 Sales Profitability & Expense Coverage
- **Current Behavior**:
  - `SalesView.tsx` currently displays 5 KPI cards: Total Sales (gross amount including tax), Total Invoices, Average Invoice Value, Outstanding, and Paid Invoices.
  - There is no dedicated profitability card detailing Net Sales (taxable value without GST), authoritative COGS, Gross Profit, and Gross Profit Margin.
- **Root Cause**:
  - The Sales dashboard relied on simple invoice totals instead of querying `ReportEngine.getProfitAndLoss` or line-level taxable amounts and weighted-average COGS.

### 2.4 Main Dashboard Business Health & Quick Actions
- **Current Behavior**:
  - In `DashboardView.tsx`, the Business Health card uses a basic 180° arc without the fine tick marks, trend pill, or multi-dimensional scoring model.
  - Quick Actions occupied a full panel card with redundant navigation buttons that duplicated the primary sidebar and navigation bar.
- **Root Cause**:
  - The business health gauge lacked visual refinement (fine inner radial ticks, pill trend badge, clear subtitle) and multi-factor scoring (combining margin, liquidity, turnover, and growth).
  - Quick Actions provided no live intelligence or stock insights.

### 2.5 Sales & Purchase Overview Granularity
- **Current Behavior**:
  - `DashboardView.tsx` rendered 12 monthly bars hardcoded to the financial year, regardless of whether the user selected a single day, week, or custom date range.
- **Root Cause**:
  - Backend `/reports/dashboard` returned only monthly buckets (`substr(voucher_date, 1, 7)`), lacking daily or weekly date aggregation for narrower periods.

---

## 3. Phase 2: Implementation Plan — Invoice Editing & Numbering Integrity

### 3.1 Frontend (`SalesInvoiceView.tsx`)
1. **Track `editVoucherStatus`**:
   - Add state: `const [editVoucherStatus, setEditVoucherStatus] = useState<'DRAFT' | 'POSTED' | 'CANCELLED' | null>(null);`
   - In `getVoucherById(editVoucherId)`, set `setEditVoucherStatus(voucher.status);` and preserve `voucher.voucher_number`.
2. **Preserve Voucher Number in `buildPayload`**:
   - Ensure that in Edit Mode (`editVoucherId`), `voucherNumber` is explicitly preserved:
     ```typescript
     voucherNumber: (editVoucherId || status !== 'DRAFT') ? (voucherNumber?.trim() || undefined) : undefined
     ```
3. **Implement Atomic Post on Save for Drafts**:
   - In `handlePost`:
     - If `editVoucherId && editVoucherStatus === 'DRAFT'`:
       - First call `await api.updateVoucher(editVoucherId, payload);` to persist line edits.
       - Next call `const postRes = await api.postDraftVoucher(editVoucherId);` to promote the voucher to `POSTED`, generate double-entry ledgers, and execute inventory stock movements.
       - Final voucher number remains `postRes.voucherNumber || voucherNumber`.
4. **Distinguish Mode in UI**:
   - Display a contextual info banner when editing:
     - **Draft mode**: "Editing Draft Invoice [INV-XXXX] — Changes will update this draft in-place without altering its number."
     - **Posted mode**: "Notice: This invoice is POSTED. In accordance with statutory audit rules, saving modifications will initiate an audited amendment (reversing the original under audit trail and issuing an amended voucher)."
   - Change button text:
     - New: "Save & Post Invoice"
     - Draft edit: "Update & Post Invoice"
     - Posted edit: "Amend & Post Invoice"

### 3.2 Backend Integrity Verification
1. Ensure `PostingEngine.updateDraftVoucher` retains `vch.voucher_number` when `candidate === vch.voucher_number` or when `input.voucherNumber` is undefined.
2. Verify `PostingEngine.postDraftVoucher` retains existing statutory voucher numbers (`INV-xxxx`, `PUR-xxxx`) and only generates a new number if the draft was prefixed with temporary `DFT-`.

---

## 4. Phase 3: Implementation Plan — Sales Dashboard Enhancements

### 4.1 Fixed-Height Recent Invoices with Pagination (`SalesView.tsx`)
1. **Container Dimensions**:
   - Set fixed height: `height: '520px'`, `display: 'flex'`, `flexDirection: 'column'`.
   - Table body container: `flex: 1`, `overflowY: 'auto'`.
2. **Pagination Logic**:
   - Page size: 6 items per page (fits comfortably in 520px height without vertical scrollbars).
   - State: `const [currentPage, setCurrentPage] = useState(1);`
   - Sliced data: `const paginatedInvoices = useMemo(() => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filtered, currentPage]);`
   - Controls: `<button onClick={handlePrev} disabled={currentPage === 1}>Previous</button>`, `<span className="page-indicator">Page {currentPage} of {totalPages} ({filtered.length} total)</span>`, `<button onClick={handleNext} disabled={currentPage >= totalPages}>Next</button>`.

### 4.2 Sales Profitability Section (`SalesView.tsx`)
1. **Data Source**:
   - Fetch authoritative P&L data for active period from `api.getProfitAndLoss(companyId, fromDate, toDate)`.
   - Calculate:
     - `Net Sales = pnlData.tradingIncomePaise` (Sales Revenue less Sales Returns, strictly excluding GST).
     - `Cost of Goods Sold = pnlData.tradingExpensePaise` (autoritative weighted-average inventory cost).
     - `Gross Profit = Net Sales - COGS`.
     - `Gross Profit Margin % = Net Sales > 0 ? (Gross Profit / Net Sales) * 100 : 0`.
2. **Display Elements**:
   - Render a dedicated Profitability Card with 4 metrics:
     - **Net Sales Turnover** (excl. GST)
     - **Cost of Goods Sold (COGS)**
     - **Gross Profit (₹)**
     - **Gross Profit Margin (%)** with visual progress indicator.
   - Prominently label as **Gross Profit** (never mislabel as Net Profit).
   - Display informative tooltip explaining the accounting formula and statutory GST exclusion.

---

## 5. Phase 4: Implementation Plan — Main Dashboard Redesign

### 5.1 Business Health Semicircular Gauge (`DashboardView.tsx`)
1. **Visual Styling**:
   - SVG Semicircle (180° arc from 180° to 0°).
   - Background arc: light grey (`#E2E8F0` / dark `#334155`), radius 80, stroke width 14.
   - Progress arc: `#FF6B2B` with stroke-dasharray and stroke-dashoffset.
   - **21 Inner Radial Ticks**:
     - Rendered along inner radius ($r_1 = 62$, $r_2 = 70$) at $9^\circ$ intervals from $180^\circ$ down to $0^\circ$.
     - Ticks within score percentage colored `#FF6B2B`; remaining ticks colored `#E2E8F0`.
   - **Center Content**:
     - Score (e.g. `82`) in 36px font.
     - Trend Pill (e.g. `+1` with green arrow or `-2` with red arrow) representing change vs previous equivalent period.
     - Subtitle: "of 100 points".
2. **Transparent Scoring Formula (100 Points Total)**:
   - **Gross Profit Margin (25 pts)**: $\ge 25\% \to 25$, $15\text{--}25\% \to 20$, $5\text{--}15\% \to 15$, $0\text{--}5\% \to 10$, $<0\% \to 0$.
   - **Quick Ratio / Liquidity (25 pts)**: $\ge 1.5 \to 25$, $1.0\text{--}1.5 \to 20$, $0.7\text{--}1.0 \to 15$, $0.4\text{--}0.7 \to 10$, $<0.4 \to 5$ (Debt-free with liquid assets = 25).
   - **Receivables Turnover (25 pts)**: Outstanding as % of Sales: $\le 20\% \to 25$, $20\text{--}40\% \to 20$, $40\text{--}60\% \to 15$, $>60\% \to 5$.
   - **Sales Growth vs Previous Period (25 pts)**: Growth $>0\% \to 25$, active without prior $\to 20$, decline $<15\% \to 15$, decline $>15\% \to 10$.
   - **Unavailable State**: If 0 transactions recorded, display score `--` with message "No transactions recorded yet".

### 5.2 Stock Summary Card (`DashboardView.tsx`)
1. **Card Architecture**:
   - Replaces Quick Actions panel in the bottom-right grid cell.
   - **Left Section**:
     - Title: "Stock Summary" with info tooltip explaining weighted-average valuation.
     - As-of date selector dropdown:
       - Today (`todayStr`)
       - This Month (`endOfCurrentMonth`)
       - Previous Month (`endOfLastMonth`)
       - Current Financial Year (`endOfCurrentFY`)
     - Total Stock Value in large bold font (`formatINR(totalStockValPaise)`).
     - MoM percentage change and trend pill (`+3.2% vs last month`).
     - Category breakdown legend: colored dot, category name, value, and share %.
   - **Right Section**:
     - Large SVG Donut Chart with central total stock valuation.
     - Category segments with vibrant, accessible color palette (`#FF6B2B`, `#3B82F6`, `#10B981`, `#8B5CF6`, `#F59E0B`).
     - Percentage callout labels for each category.
   - **Empty State**:
     - If total stock value is 0, display an illustrative package icon and message: "No inventory items recorded. Add stock items to view valuation."

---

## 6. Phase 5: Implementation Plan — Sales & Purchase Overview Redesign

### 6.1 KPI Summary Ribbons (`DashboardView.tsx`)
- Display 4 key metrics above or inside the overview card:
  1. Total Sales (Net) for selected period & % change vs previous period.
  2. Total Purchases (Net) for selected period & % change vs previous period.
  3. Total Invoices count & % change.
  4. Net Balance (Sales - Purchase) with growth indicator.
- **Divide-by-zero safeguard**:
  ```typescript
  const calcChangePct = (curr: number, prev: number) => {
    if (prev <= 0) return curr > 0 ? '+100%' : '0%';
    const pct = Math.round(((curr - prev) / prev) * 1000) / 10;
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  };
  ```

### 6.2 Adaptive Trend Granularity
- **Period Mapping**:
  - `This Week` $\to$ Daily buckets (Mon, Tue, Wed, Thu, Fri, Sat, Sun).
  - `This Month` / `Previous Month` $\to$ Daily or 4 Weekly buckets.
  - `This Quarter` $\to$ Weekly buckets (W1, W2, ... W13).
  - `Financial Year` $\to$ 12 Monthly buckets (Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar).
  - `Custom Date Range` $\to$ If $\le 14$ days: Daily; if $\le 90$ days: Weekly; otherwise: Monthly.
- Interactive tooltip on bar hover displaying exact amounts, voucher count, and date range.

---

## 7. Verification & Quality Assurance Plan

1. **Automated Backend Suite**:
   - Run `npm test` across all voucher posting, amendment, draft promotion, and report tests.
   - Add unit test verifying draft invoice editing preserves `voucher_number` and `voucher_id` without creating duplicates.
2. **Frontend Type Check & Build**:
   - Run `npm run build` in `frontend/` to confirm zero TypeScript compilation errors.
3. **Manual Flow Verification**:
   - Draft edit test: Create draft invoice `INV-TEST-001`, edit details, save draft $\to$ verify ID and number unchanged.
   - Post draft test: Edit draft invoice, click "Save & Post" $\to$ verify voucher promoted to `POSTED`, ledgers created, number preserved.
   - Recent Invoices pagination test: Verify table height remains 520px across page 1, 2, etc., and empty state renders cleanly.
   - Business Health test: Verify 21 radial ticks render properly and score reflects real accounting ratios.
   - Stock Summary test: Verify as-of date filter triggers valuation up to that date, donut chart renders categories accurately, and empty state handles 0 items.
4. **Documentation**:
   - Author `UI-047-IMPLEMENTATION-REPORT.md`.
   - Author `UI-047-ACCOUNTING-VALIDATION-REPORT.md`.
   - Author `UI-047-UI-QA-REPORT.md`.
   - Update `STATUS.md`.

