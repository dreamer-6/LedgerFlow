# UI-048: Service Management Implementation, Dashboard Redesign, Voucher Numbering & Day Book Integrity
## Comprehensive Implementation Plan

### 1. Executive Summary & Objectives
This document establishes the architecture and execution roadmap for the five core workstreams defined in **UI-048**:
1. **Sales & Purchase Overview Dashboard Redesign**: Implement the new modern dual-line spline chart design (`media_1794727913825_f639a08d.jpg` / `LedgerFlow Sales & Purchase Dashboard(2).png`) with time filters (7D, 30D, 3M, 6M, 1Y), summary KPI cards (Total Sales, Total Purchase, Net Profit with % changes), interactive tooltips with both amounts, and bottom metrics (Gross Profit, Profit Margin %). Connect to authoritative transactional data without synthetic baselines.
2. **Sales Invoice Numbering Correction**: Diagnose and guarantee monotonic, consecutive invoice numbering continuing seamlessly (e.g., sequence 19 -> 20) under company isolation, financial year scoping, draft preservation, concurrency safety, and immutability rules.
3. **In-Place Invoice Editing Audit & Stabilization**: Verify and harden in-place voucher editing across draft and posted vouchers. Ensure voucher numbers, line configurations, taxes, serial units, and double-entry ledgers are updated in-place without generating cancelled ghost vouchers or duplicating inventory movements.
4. **Service Management Module**: Build a comprehensive, end-to-end Service Management domain supporting both **Dealer Warranty** (operational RMA without billing) and **Internal Repair** (with optional Service Bill generation) lifecycles. Implement 5 core screens matching user mockups:
   - Screen A: Service Dashboard (`media_1794727913714_a13deb76.jpg`)
   - Screen B: Service Register (`media_1794727913714_3e433425.jpg`)
   - Screen C: New Service Job Form
   - Screen D: Service Job Details Workspace (`media_1794727913715_52a725ed.jpg`)
   - Screen E: Service Bill Creation (`media_1794727913831_f9af8d25.jpg`)
5. **Day Book Duplicate Entry Clarification & Display Enhancement**: Reconcile Day Book entries with double-entry ledgers, display explicit linked voucher reference badges (e.g., immediate settlement links), eliminate flawed hardcoded debit/credit heuristics, and provide intuitive filtering.

---

### 2. Workstream 1: Dashboard Sales & Purchase Overview Redesign

#### 2.1 Visual Design Specifications (`media_1794727913825_f639a08d.jpg`)
- **Header**:
  - Icon: Bar chart icon in rounded light container (`#F1F5F9`).
  - Title: `Sales & Purchase Overview`.
  - Subtitle: `Track sales, purchases and business performance.`
  - Time Selector Pills: `7D`, `30D`, `3M`, `6M`, `1Y` (active pill dark `#0F172A` with white text, inactive pills subtle light gray).
- **Summary KPI Cards (Top Ribbon)**:
  - 3 symmetric cards with clean borders and subtle box-shadow:
    1. `Total Sales`: Trend icon in container, bold INR value, green pill `↑ +X.X%`.
    2. `Total Purchase`: Cart icon in container, bold INR value, green/red pill `↑ +X.X%`.
    3. `Net Profit`: Layers icon in container, bold INR value, green/red pill `↑ +X.X%`.
- **Main Spline Line Chart**:
  - Curved spline paths connecting data points (Cubic Bézier curve interpolation).
  - Blue line (`#2563EB`, strokeWidth 3) for Sales with subtle fading gradient area fill below (`rgba(37, 99, 235, 0.15)` to `transparent`).
  - Purple line (`#9333EA`, strokeWidth 3) for Purchase with subtle fading gradient area fill below (`rgba(147, 51, 234, 0.12)` to `transparent`).
  - Data point circular markers: White interior with colored border.
  - Interactive hover state:
    - Vertical dashed guide line (`#94A3B8`).
    - Floating tooltip displaying period name (e.g., `Sep '26`), Sales amount (blue dot), Purchase amount (purple dot).
  - Dynamic Y-axis scale based on maximum period transaction amounts, formatted in standard Indian Lakhs/Thousands (`L` / `k`).
- **Bottom Summary Ribbon**:
  - Left: Interactive legend dots (`● Sales` blue, `● Purchase` purple).
  - Right: Combined metric badge:
    - `Gross Profit`: Bar icon + formatted INR amount.
    - `Profit Margin`: `%` icon + percentage formatted to 1 decimal place.

#### 2.2 Authoritative Backend Data Pipeline
- The backend report API `/reports/dashboard-overview` or `/reports/overview` will compute:
  - Posted `SALES` vouchers (taxable amount or total amount excluding cancelled) within the selected period.
  - Posted `PURCHASE` vouchers within the selected period.
  - Prior-period comparison metrics for 7D, 30D, 3M, 6M, 1Y to calculate authentic percentage changes (`salesPctChange`, `purchasePctChange`, `profitPctChange`).
  - Gross Profit (`Total Sales - Total Purchase` or authoritative Trading Gross Profit from P&L).
  - Profit Margin (`(Gross Profit / Total Sales) * 100`).

---

### 3. Workstream 2: Sales Invoice Numbering Sequence Correction

#### 3.1 Root Cause Analysis
1. Historical invoice editing previously operated via `amendVoucher`, which generated a brand new voucher with a new sequence number and cancelled the old one. Multiple edits consumed sequence numbers rapidly.
2. When invoice 19 was edited or amended, new numbers 20, 21, etc. were created.
3. In `PostingEngine.getNextVoucherNumber`, the generator scans active posted and cancelled vouchers, identifying `max(counter)` and offering `max + 1`.
4. In-place editing (`PostingEngine.updatePostedVoucher`) implemented in UI-047/UI-048 permanently stops number skipping during edits.
5. In addition, `getNextVoucherNumber` must properly handle sequential gaps, guarantee concurrency locks using transactions, prevent previews from consuming numbers, and verify that test fixture numbering seamlessly generates `DTS-2627-020` when 19 is the highest active number.

---

### 4. Workstream 3: In-Place Invoice Editing Audit & Stabilization

#### 4.1 Verification Scope
- Audit `SalesInvoiceView.tsx`, `PurchaseInvoiceView.tsx`, and `VoucherEntryView.tsx`.
- Guarantee that when editing an existing voucher:
  1. `voucher_id` and `voucher_number` remain identical.
  2. Prior `ledger_entries` are safely replaced without leaving duplicate balances.
  3. Prior `stock_entries` are safely replaced without stock inflation or leakage.
  4. Serial number allocations (`stock_item_serials`) are updated to reflect the new state.
  5. Vouchers are never converted from `POSTED` to `DRAFT` during edit.
  6. Financial year boundaries and company permissions are enforced.

---

### 5. Workstream 4: Service Management Module Architecture

#### 5.1 Domain Decoupling: Service Job vs Service Bill
- **Service Job (`service_jobs`)**:
  - Pure operational lifecycle tracking a physical device brought in for service, maintenance, or dealer warranty.
  - Does NOT touch financial ledgers.
  - Physical locations: `CUSTOMER`, `SHOP`, `COURIER_TO_DEALER`, `DEALER`, `COURIER_FROM_DEALER`, `RETURNED_TO_SHOP`, `DELIVERED_TO_CUSTOMER`.
  - Dealer Warranty details: Dealer selection, courier docket number, dispatch date, dealer RMA action, replacement serial tracking.
- **Service Bill (`vouchers` with service metadata or linked `service_job_id`)**:
  - Financial accounting document with itemized parts and labour charges.
  - Posts double-entry transactions (Debit Debtor/Cash, Credit Service Income, Credit CGST/SGST/IGST, Credit Inventory for parts).
  - Can optionally reference a `service_job_id`, or exist independently.

#### 5.2 Database Schema Migration
Create table `service_jobs`:
```sql
CREATE TABLE IF NOT EXISTS service_jobs (
  job_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  fy_id TEXT NOT NULL,
  job_number TEXT NOT NULL,
  job_date TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  device_type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  accessories TEXT,
  problem_reported TEXT NOT NULL,
  diagnosis TEXT,
  work_performed TEXT,
  service_type TEXT NOT NULL DEFAULT 'INTERNAL_REPAIR',
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  physical_location TEXT NOT NULL DEFAULT 'SHOP',
  technician_name TEXT,
  estimated_cost_paise INTEGER DEFAULT 0,
  advance_paid_paise INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'NORMAL',
  warranty_status TEXT DEFAULT 'OUT_OF_WARRANTY',
  dealer_id TEXT,
  dealer_name TEXT,
  courier_name TEXT,
  docket_number TEXT,
  dispatch_date TEXT,
  expected_return_date TEXT,
  dealer_received_date TEXT,
  dealer_action TEXT,
  replacement_serial_number TEXT,
  dealer_return_date TEXT,
  dealer_docket_number TEXT,
  service_bill_id TEXT,
  service_bill_number TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(company_id),
  FOREIGN KEY (customer_id) REFERENCES parties(party_id),
  FOREIGN KEY (dealer_id) REFERENCES parties(party_id),
  FOREIGN KEY (service_bill_id) REFERENCES vouchers(voucher_id)
);
```

Create table `service_job_events`:
```sql
CREATE TABLE IF NOT EXISTS service_job_events (
  event_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  location TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES service_jobs(job_id) ON DELETE CASCADE
);
```

#### 5.3 UI Components & Routing
- Update `Sidebar.tsx`:
  - Section `Service` (collapsible, icon `Wrench`):
    - `Service Dashboard` -> `ServiceDashboardView.tsx`
    - `New Service Job` -> `ServiceJobFormView.tsx`
    - `Service Register` -> `ServiceRegisterView.tsx`
    - `Service Bills` -> `ServiceBillCreationView.tsx` / `ServiceBillView.tsx`
- Implement:
  - `ServiceDashboardView.tsx`: Matching Mockup A (`media_1794727913714_a13deb76.jpg`).
  - `ServiceRegisterView.tsx`: Matching Mockup B (`media_1794727913714_3e433425.jpg`).
  - `ServiceJobFormView.tsx`: New/Edit Service Job form with customer selection, device details, problem description, dealer warranty toggle.
  - `ServiceJobDetailsView.tsx`: Matching Mockup D (`media_1794727913715_52a725ed.jpg`) with lifecycle timeline, dealer tracking card, status update modal, and "Generate Service Bill" button.

---

### 6. Workstream 5: Day Book Duplicate Entry Clarification

#### 6.1 Diagnosis
- In double-entry accounting, an invoice with immediate settlement creates two vouchers:
  - Sales Invoice (`DTS-2627-023`)
  - Linked Receipt Voucher (`REC-2627-023`)
- A purchase invoice with immediate payment creates:
  - Purchase Invoice (`PUR-2627-016`)
  - Linked Payment Voucher (`PAY-2627-016`)
- In `DayBookView.tsx`:
  - No reference linking was displayed, making them appear to be four identical entries for ₹850.
  - Debit/Credit columns used a hardcoded heuristic `isDebit = type === 'SALES' || type === 'RECEIPT'`.
- Enhancement:
  - Update `ReportEngine.getDayBook` to return `reference_number` and linked settlement metadata.
  - In `DayBookView.tsx`, display clear badges:
    - E.g., `Settlement for DTS-2627-023 (Immediate Payment)`
    - E.g., `Against PUR-2627-016`
  - Reconcile Debits and Credits with double-entry ledgers.
  - Add quick filter pills: `All`, `Invoices Only`, `Payments & Receipts`, `Journal & Others`.

---

### 7. Verification & Quality Gates
- **Automated Tests**:
  - `ui048-service-management.test.ts`: Verify service job CRUD, dealer dispatch, warranty lifecycle, and isolation.
  - `ui048-numbering-and-daybook.test.ts`: Verify sequential numbering (19 -> 20), concurrency safety, and Day Book data integrity.
  - Regression testing across all 18 backend test suites.
- **Frontend & Backend Production Builds**:
  - Zero TypeScript compile errors (`tsc --noEmit`).
  - Clean Vite build (`npm run build`).
- **Reports**:
  - `UI-048-IMPLEMENTATION-REPORT.md`
  - `UI-048-VERIFICATION-REPORT.md`
  - Updated `STATUS.md`.

