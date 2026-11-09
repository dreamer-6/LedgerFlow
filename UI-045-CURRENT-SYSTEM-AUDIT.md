# UI-045: LedgerFlow Serial Number Tracking & Inventory Lifecycle
## Phase 1: Current System Comprehensive Audit Report

**Date:** 2026-11-08  
**Project:** LedgerFlow Accounting & Inventory Management System  
**Document:** `UI-045-CURRENT-SYSTEM-AUDIT.md`  
**Status:** Audit Completed — Architectural Gaps Identified  

---

### 1. Executive Summary & Objective

The objective of UI-045 is to audit the existing LedgerFlow inventory and serial-number tracking implementation, diagnose the architectural flaws causing serial numbers created in the system to fail to appear or track reliably in Sales and Inventory workflows, and establish the target architecture separating **Product Definition** from **Physical Inventory Units**.

A thorough inspection of the LedgerFlow codebase was conducted across:
- Database schema (`backend/src/database/schema.sql`, `backend/src/database/connection.ts`)
- Master data routes & endpoints (`backend/src/api/routes.ts`)
- Accounting & Inventory Domain Engine (`backend/src/domain/posting/posting-engine.ts`)
- Inventory Valuation & Balances (`backend/src/domain/inventory/valuation.ts`)
- Frontend Item Master (`frontend/src/pages/ItemsView.tsx`, `MastersView.tsx`)
- Frontend Transaction Screens (`frontend/src/pages/PurchaseInvoiceView.tsx`, `frontend/src/pages/SalesInvoiceView.tsx`)
- Shared Serial UI Components (`frontend/src/components/accounting/SerialPickerModal.tsx`)
- Live database contents (`ledgerflow.db`)

---

### 2. Item Master Audit Findings

#### 2.1 Conflation of Product Definition and Physical Inventory Units
In `stock_items` (`schema.sql` and `connection.ts`), an item is defined with columns such as `item_id`, `company_id`, `item_name`, `unit_id`, `gst_rate`, `purchase_rate_paise`, `selling_rate_paise`, and `warranty_months`.
Two columns were added via migrations:
- `has_serial_no INTEGER DEFAULT 0` (boolean flag indicating whether serial tracking is enabled)
- `serial_numbers TEXT` (a freeform comma-separated text string, e.g. `'SN253951101445, 25GTS11A0033585'`)

In `frontend/src/pages/ItemsView.tsx` (lines 1123–1134):
```tsx
{trackSerial && (
  <div className="item-field-group">
    <label className="item-field-label">Serial Numbers (Comma-separated)</label>
    <input
      type="text"
      className="item-input"
      placeholder="e.g. SN1001, SN1002, SN1003"
      value={serialNumbers}
      onChange={(e) => setSerialNumbers(e.target.value)}
    />
  </div>
)}
```
When creating or editing an item with serial tracking enabled:
1. Users are prompted to type serial numbers directly into the Item Master form.
2. In `backend/src/api/routes.ts` (lines 520–534 and 736–749), these comma-separated strings are parsed and inserted directly into `stock_item_serials` as `status = 'AVAILABLE'` with `purchase_date = todayStr`.
3. **Flaw:** This treats Item Master creation as an implicit stock-in transaction without any godown assignment, without a purchase voucher, and without generating a corresponding inventory movement in `stock_entries`.
4. As a result, an item could have `opening_qty = 0`, but 5 serials marked `AVAILABLE` in `stock_item_serials`. The accounting inventory balance is 0, while the serial register claims 5 physical units exist in an unspecified void!
5. When editing an existing item (`PUT /masters/items/:id`), the backend attempted to append or overwrite `stock_items.serial_numbers`, creating duplicate rows or overwriting master state without any lifecycle safety.

---

### 3. Purchase Module Audit Findings

#### 3.1 Purchase Creation & UI Serial Allocation
- In `frontend/src/pages/PurchaseInvoiceView.tsx`, line items check `matched.has_serial_no` to show a "Serials Entered" badge opening `SerialPickerModal` in `PURCHASE` mode.
- **Flaw:** In `PurchaseInvoiceView.tsx` `handlePost()` (lines 726–740), there is **zero validation** ensuring that serialized items actually have serial numbers assigned. A user can purchase 10 units of a serial-tracked item without entering a single serial number.
- Furthermore, no validation exists to enforce that the count of entered serial numbers matches the purchase quantity (`serials.length === quantity`).

#### 3.2 Posting Engine Purchase Behavior
In `backend/src/domain/posting/posting-engine.ts` (lines 1012–1077):
```typescript
if (isPosted && pl.lineInput.itemId && pl.lineInput.serialNumber) {
  const serialsArr = pl.lineInput.serialNumber.split(',').map((s: string) => s.trim()).filter(Boolean);
  ...
}
```
- If `pl.lineInput.serialNumber` is omitted, the engine silently posts the purchase without creating any records in `stock_item_serials`.
- If serial numbers are provided, they are inserted into `stock_item_serials`:
  ```sql
  INSERT INTO stock_item_serials (serial_id, item_id, serial_number, status, purchase_date, warranty_expiry_date)
  VALUES (?, ?, ?, 'AVAILABLE', ?, ?)
  ```
- **Flaw:** Notice what is completely missing from this insert:
  - `company_id`: NOT stored in `stock_item_serials`.
  - `godown_id`: NOT stored in `stock_item_serials` (even though `voucher_lines` and `stock_entries` track godowns).
  - `purchase_voucher_id`: NOT stored in `stock_item_serials`.
  - `purchase_voucher_line_id`: NOT stored in `stock_item_serials`.
  - `supplier_id`: NOT stored in `stock_item_serials`.
- **Draft Behavior:** Unposted draft purchases correctly do not insert rows into `stock_item_serials`. However, draft serial strings in `voucher_lines.serial_number` are unvalidated and not checked for collisions with active inventory.

---

### 4. Sales Module Audit Findings: Root Cause of Missing Serials

#### 4.1 The Primary Breakdown: API Endpoint Bypass & Godown Ignorance
In `frontend/src/pages/SalesInvoiceView.tsx` (lines 2095–2111), clicking "Select Unit Serials" opens `SerialPickerModal` with `mode="SALES"` and `itemId`.
Inside `SerialPickerModal.tsx` (lines 50–67):
```typescript
api.getItemSerials(itemId, true) // detailed=true
```
In `backend/src/api/routes.ts` (lines 779–819):
```typescript
router.get('/masters/items/:id/serials', ...withCompany, (req: SecureRequest, res: Response) => {
  const isDetailed = req.query.detailed === 'true';

  const rows = db.prepare(`
    SELECT serial_number, status, purchase_date, warranty_expiry_date FROM stock_item_serials
    WHERE item_id = ? AND status = 'AVAILABLE'
  `).all(req.params.id) as any[];

  if (isDetailed) {
    res.json(rows.map(r => ({
      serialNumber: r.serial_number,
      status: r.status,
      purchaseDate: r.purchase_date || null,
      warrantyExpiryDate: r.warranty_expiry_date || null
    })));
    return; // <--- EARLY RETURN!
  }

  let list = rows.map((r: any) => r.serial_number);
  if (list.length === 0 && item.serial_numbers) {
    // FALLBACK to item.serial_numbers text field
    ...
  }
  res.json(list);
});
```

**Root Causes Identified:**
1. **The Early Return Trap:** When `detailed=true` is requested (which `SerialPickerModal.tsx` always did), if `stock_item_serials` had no rows for `item_id`, the endpoint immediately returned `[]`. The fallback logic in lines 803–814 that parsed `item.serial_numbers` was completely unreachable! Therefore, any serial numbers entered in Item Master were completely invisible in Sales!
2. **Missing Godown Filtering:** `stock_item_serials` has no `godown_id` column. Physical units exist in physical warehouses. Sales invoices specify a godown, but `GET /masters/items/:id/serials` could not filter serials by godown.
3. **No Strict Validation on Sales Post:** In `PostingEngine`, if a user posts a sales invoice for a serial-tracked item without selecting serials, the invoice posts without error, bypassing serial tracking entirely and creating an untracked inventory depletion.

---

### 5. Inventory Engine & Voucher Cancellation Audit Findings

#### 5.1 Disconnection Between Stock Entries & Serial Records
- The Inventory Engine (`stock_entries`) records: `(entry_id, voucher_id, item_id, godown_id, movement_type: IN|OUT, quantity, rate_paise)`.
- `stock_item_serials` had no linkage to `godown_id`, `company_id`, or voucher IDs.
- Thus, the inventory engine and serial tracking operated as two disparate, desynchronized systems. There was no foreign-key guarantee or reconcilable link between physical unit availability and godown stock balance.

#### 5.2 Voucher Cancellation Flaws
In `backend/src/domain/posting/posting-engine.ts` (`cancelVoucher`, lines 1515–1578):
1. **Sales Cancellation:** Successfully restored serials by updating `status = 'AVAILABLE'` for serials matching `item_id` and `serial_number`. However, it did not reset or clear sales voucher or customer references because those columns did not exist.
2. **Purchase Cancellation:**
   - Attempted to read `audit_logs` details for `introducedSerials`. If the audit log was missing, altered, or failed to parse, zero serials were updated.
   - For introduced serials, it executed a fragile text `LIKE` query against `voucher_lines.serial_number` across all other posted vouchers (`%${is.serialNumber}%`).
   - If not referenced elsewhere, it executed:
     ```sql
     DELETE FROM stock_item_serials WHERE item_id = ? AND serial_number = ? AND status = 'AVAILABLE'
     ```
     This hard-deleted unit records, destroying all historical lookup and audit traces.
   - Crucially, it did NOT check whether any of the purchased serials had already been **SOLD** to customers! If a purchase of 3 units occurred and 2 were sold, cancelling the purchase should be blocked because physical units have already left the company.

---

### 6. Existing Database State & Schema Comparison

#### 6.1 Existing Database State in `ledgerflow.db`
Inspection of `ledgerflow.db` revealed:
- `stock_items`: 3 items exist:
  1. `item_e43279232a2e48cd`: 'GIGABYTE 6GB GRAPHIC RTX3050 WF2 OC', `has_serial_no: 1`, `serial_numbers: 'SN253951101445'`
  2. `item_00fcf02b604c412d`: 'K7 TOTAL SECURITY 1Y 1USER', `has_serial_no: 1`, `serial_numbers: '25GTS11A0033585'`
  3. `item_aef88b092d224296`: 'TOSHIBA 65W ADAPTER', `has_serial_no: 0`, `serial_numbers: null`
- `stock_item_serials`: 2 rows exist, both `AVAILABLE`, with `purchase_date = '2026-11-05'`, but missing `company_id`, `godown_id`, `purchase_voucher_id`, etc.
- In `voucher_lines`, non-serialized lines for Toshiba Adapter had string `'IN'` and `'OUT'` stored in `serial_number` due to an earlier migration/test script.

#### 6.2 Schema Comparison: Current vs Target

| Field | Current `stock_item_serials` | Target `stock_item_serials` | Status / Migration Plan |
|---|---|---|---|
| `serial_id` | `TEXT PRIMARY KEY` | `TEXT PRIMARY KEY` | Preserved |
| `company_id` | *Missing* | `TEXT NOT NULL REFERENCES companies` | Add column + backfill from item + index |
| `item_id` | `TEXT NOT NULL REFERENCES stock_items` | `TEXT NOT NULL REFERENCES stock_items` | Preserved + indexed |
| `serial_number` | `TEXT NOT NULL` | `TEXT NOT NULL` | Preserved + indexed |
| `godown_id` | *Missing* | `TEXT REFERENCES godowns` | Add column + backfill default godown |
| `status` | `CHECK(status IN ('AVAILABLE', 'SOLD'))` | `CHECK(status IN ('DRAFT', 'AVAILABLE', 'RESERVED', 'SOLD', 'RETURNED', 'DAMAGED', 'WRITTEN_OFF'))` | Expand status enum safely |
| `purchase_voucher_id` | *Missing* | `TEXT REFERENCES vouchers` | Add column |
| `purchase_voucher_line_id` | *Missing* | `TEXT` | Add column |
| `supplier_id` | *Missing* | `TEXT REFERENCES parties` | Add column |
| `purchase_date` | `DATE` | `DATE` | Preserved |
| `warranty_expiry_date` | `DATE` | `DATE` | Preserved |
| `sales_voucher_id` | *Missing* | `TEXT REFERENCES vouchers` | Add column |
| `sales_voucher_line_id` | *Missing* | `TEXT` | Add column |
| `customer_id` | *Missing* | `TEXT REFERENCES parties` | Add column |
| `sales_date` | *Missing* | `DATE` | Add column |
| `created_at` | `DATETIME DEFAULT CURRENT_TIMESTAMP` | `DATETIME DEFAULT CURRENT_TIMESTAMP` | Preserved |
| `updated_at` | *Missing* | `DATETIME DEFAULT CURRENT_TIMESTAMP` | Add column |
| Constraints | `UNIQUE(item_id, serial_number)` | `UNIQUE(company_id, item_id, serial_number)` | Upgrade constraint |

---

### 7. Summary of Required Remediations
1. **Upgrade Database Schema & Safe Migration:** Add missing relational columns to `stock_item_serials` without data loss. Backfill existing 2 records with their valid `company_id` and default `godown_id`.
2. **Clean Item Master:** Persist `has_serial_no: 1` as product tracking definition only. Do NOT force or require future purchased serial numbers to be typed into the master.
3. **Purchase Module Enforcement:** When purchasing serial-tracked items, enforce serial allocation equal to quantity before post. On post, atomically create/activate unit records linked to purchase voucher, supplier, godown, and date.
4. **Sales Module Authoritative Integration:** Pass `godownId` to available serial API and picker modal. Authoritative backend endpoint returns units where `company_id = ? AND item_id = ? AND godown_id = ? AND status = 'AVAILABLE'`. Enforce exact serial selection count on post and atomically transition to `SOLD`.
5. **Voucher Cancellation Safety:** Prevent cancelling purchases if any serials are already `SOLD`. On valid purchase cancellation, mark status `CANCELLED` or remove safely without destroying audit logs. On sales cancellation, restore serials to `AVAILABLE` and clear sales voucher links.
6. **Serial Number Register:** Implement full Serial Number Register view with KPI summary cards, multi-facet filtering, table view, and detailed unit lifecycle history.
7. **Comprehensive Automated Test Suite:** Implement `ui045-serial-number-tracking.test.ts` verifying all 18 acceptance criteria.

