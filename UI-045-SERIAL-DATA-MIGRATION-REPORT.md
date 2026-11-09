# UI-045: Serial Number Data Migration & Integrity Report

## Executive Summary

As part of the **UI-045: Serial Number Tracking & Inventory Lifecycle** initiative, LedgerFlow transitioned from legacy ad-hoc text string storage (`stock_items.serial_numbers`) to a dedicated, normalized relational architecture in `stock_item_serials`. This document details the schema migration, data backfill, integrity validation, and reconciliation procedures implemented and executed.

---

## 1. Schema Evolution & Migration Strategy

### 1.1 Legacy Architecture vs Target Architecture

| Aspect | Legacy Architecture | UI-045 Target Architecture |
|---|---|---|
| Product Definition | Stored comma-separated text strings in `stock_items.serial_numbers` | Pure master definition: `has_serial_no INTEGER DEFAULT 0` toggle |
| Physical Unit Tracking | Implicit, un-linked text entries | Dedicated table `stock_item_serials` with 1 row per physical unit |
| Godown Awareness | None (serials had no godown affiliation) | Scoped via `godown_id TEXT REFERENCES godowns(godown_id)` |
| Multi-Tenant Scoping | Missing or implicit | Strictly scoped via `company_id TEXT REFERENCES companies(company_id)` |
| Transaction Lifecycle | No transaction linking | Foreign keys to `purchase_voucher_id`, `supplier_id`, `sales_voucher_id`, `customer_id` |
| Status State Machine | Limited (`AVAILABLE`, `SOLD`) | Comprehensive: `AVAILABLE`, `SOLD`, `RETURNED`, `RESERVED`, `DAMAGED`, `WRITTEN_OFF`, `CANCELLED` |

### 1.2 Safe Migration DDL (`src/database/connection.ts`)

The database connection orchestrator inspects the table structure on startup and applies non-destructive idempotent migrations:

```sql
-- 1. Ensure stock_items master tracking columns
ALTER TABLE stock_items ADD COLUMN has_serial_no INTEGER DEFAULT 0;
ALTER TABLE stock_items ADD COLUMN serial_numbers TEXT;

-- 2. Ensure stock_item_serials columns
ALTER TABLE stock_item_serials ADD COLUMN company_id TEXT REFERENCES companies(company_id);
ALTER TABLE stock_item_serials ADD COLUMN godown_id TEXT REFERENCES godowns(godown_id);
ALTER TABLE stock_item_serials ADD COLUMN purchase_voucher_id TEXT REFERENCES vouchers(voucher_id);
ALTER TABLE stock_item_serials ADD COLUMN purchase_voucher_line_id TEXT REFERENCES voucher_lines(line_id);
ALTER TABLE stock_item_serials ADD COLUMN supplier_id TEXT REFERENCES parties(party_id);
ALTER TABLE stock_item_serials ADD COLUMN purchase_date DATE;
ALTER TABLE stock_item_serials ADD COLUMN sales_voucher_id TEXT REFERENCES vouchers(voucher_id);
ALTER TABLE stock_item_serials ADD COLUMN sales_voucher_line_id TEXT REFERENCES voucher_lines(line_id);
ALTER TABLE stock_item_serials ADD COLUMN customer_id TEXT REFERENCES parties(party_id);
ALTER TABLE stock_item_serials ADD COLUMN sales_date DATE;
ALTER TABLE stock_item_serials ADD COLUMN warranty_expiry_date DATE;
ALTER TABLE stock_item_serials ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- 3. High-Performance Indexing
CREATE INDEX IF NOT EXISTS idx_stock_serials_comp_item ON stock_item_serials(company_id, item_id);
CREATE INDEX IF NOT EXISTS idx_stock_serials_status ON stock_item_serials(status);
CREATE INDEX IF NOT EXISTS idx_stock_serials_godown ON stock_item_serials(godown_id);
CREATE INDEX IF NOT EXISTS idx_stock_serials_sales ON stock_item_serials(sales_voucher_id);
CREATE INDEX IF NOT EXISTS idx_stock_serials_purch ON stock_item_serials(purchase_voucher_id);
```

---

## 2. Data Backfill & Cleansing Procedures

### 2.1 Company ID & Godown Backfill

For any pre-existing rows in `stock_item_serials` created during earlier iterations without `company_id` or `godown_id`:

1. **Company Backfill:** Each serial row's `company_id` is updated from its parent `stock_items.company_id`:
   ```sql
   UPDATE stock_item_serials
   SET company_id = (SELECT company_id FROM stock_items WHERE stock_items.item_id = stock_item_serials.item_id)
   WHERE company_id IS NULL;
   ```
2. **Godown Backfill:** Any serials without an assigned godown are attached to the default warehouse of their parent company:
   ```sql
   UPDATE stock_item_serials
   SET godown_id = (
     SELECT godown_id FROM godowns
     WHERE godowns.company_id = stock_item_serials.company_id AND is_default = 1
     LIMIT 1
   )
   WHERE godown_id IS NULL;
   ```

### 2.2 Legacy Comma-Separated String Ingestion

In `src/api/routes.ts`, `GET /masters/items/:id/serials` includes an automatic ingestion fallback: if an item has serial numbers stored in `stock_items.serial_numbers` but no corresponding rows in `stock_item_serials`, the endpoint queries or creates units as `AVAILABLE`, ensuring legacy catalog entries immediately show up in the serial selector.

---

## 3. Data Integrity & Invariants

1. **Single-Ownership Guarantee:** A physical serial unit belongs to exactly one `company_id` and is located in exactly one `godown_id`. Cross-tenant lookups (`company_id = ?`) are hard-filtered at both SQL and domain posting levels.
2. **Duplicate Registration Prevention:** Posting a purchase voucher validates that none of the provided serials already exist in an active (`AVAILABLE`, `SOLD`, `RESERVED`) state in that company.
3. **Double-Sale Guard:** Selling an item requires that every selected serial exists in `stock_item_serials`, belongs to the item's company, is in `AVAILABLE` state, and resides in the godown specified in the transaction line.
4. **Voucher Cancellation Lifecycle:**
   - **Sales Cancellation:** Reverts `SOLD` serials to `AVAILABLE` and nullifies sales voucher pointers.
   - **Purchase Cancellation:** Strictly checks if any unit from the purchase was subsequently sold. If any unit is `SOLD`, cancellation is blocked with an informative error instructing the user to reverse the sales voucher first. If all units are `AVAILABLE`, cancellation safely deletes or marks the units `CANCELLED`.
5. **Reconciliation:** For all items with `has_serial_no = 1`, the count of `AVAILABLE` units in `stock_item_serials` matches the net balance ($IN - OUT$) of `stock_entries` in that godown.

---

## 4. Verification & Validation Summary

| Test Case | Scope | Status |
|---|---|---|
| Schema Migration Test | Evaluates table creation, alter table idempotency, and indexes on live SQLite | **PASS** |
| Data Backfill Test | Verifies `company_id` and default `godown_id` population | **PASS** |
| Cross-Tenant Query Isolation | Company B attempting to access Company A serials returns zero rows | **PASS** |
| Double-Sale Block | Concurrently attempting to sell a sold serial throws domain error | **PASS** |
| Over-Return & Restoration | Returns transition sold serials back to `AVAILABLE` | **PASS** |

The migration and data integrity framework is fully verified and production-ready.

