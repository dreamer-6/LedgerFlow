/**
 * ui045-serial-number-tracking.test.ts — Comprehensive Test Suite for UI-045:
 * Serial Number Tracking & Inventory Lifecycle
 *
 * Verifies all 18 Acceptance Criteria + Edge Case Guards:
 *  1. Create "Dell Inspiron 15" in Item Master with Serial Number Tracking enabled.
 *  2. Verify tracking configuration persistence.
 *  3. Create Purchase Entry for quantity 3 (DELL-IN-001, DELL-IN-002, DELL-IN-003).
 *  4. Draft purchase does NOT make serials available for sale.
 *  5. Post purchase atomically creates 3 AVAILABLE units with godown, supplier, voucher linkage.
 *  6. Confirm all 3 appear in Serial Register as AVAILABLE.
 *  7. Available serial lookup filters by item and godown.
 *  8. Post sales invoice for 2 units (DELL-IN-001, DELL-IN-002).
 *  9. Confirm those 2 become SOLD, linked to customer and sales voucher.
 * 10. Confirm DELL-IN-003 remains AVAILABLE.
 * 11. Stock balance and serial register reconcile 100%.
 * 12. Double-sale prevention: cannot sell already SOLD unit.
 * 13. Cancel sales voucher: safely restores units to AVAILABLE and clears sales voucher links.
 * 14. Purchase cancellation guard: cannot cancel purchase while serials are SOLD.
 * 15. Valid purchase cancellation: safely un-stocks available units.
 * 16. Multi-tenant isolation: Company B cannot see, query, or mutate Company A's serials.
 * 17. Validation guards: quantity mismatch, duplicates, missing serials strictly rejected.
 * 18. Opening stock & Return lifecycle transitions.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getDatabase } from '../src/database/connection';
import { initializeBusiness } from '../src/database/seed';
import { PostingEngine } from '../src/domain/posting/posting-engine';
import { InventoryEngine } from '../src/domain/inventory/valuation';

describe('UI-045: Serial Number Tracking & Inventory Lifecycle', () => {
  let db: DatabaseSync;
  const testDbPath = path.resolve(__dirname, '../../test_ui045_serials.db');

  const companyA = 'cmp_ui045_a';
  const companyB = 'cmp_ui045_b';
  const fyId = 'fy_2026_27';

  const godownA1 = 'g_a1_main';
  const godownA2 = 'g_a2_secondary';
  const godownB1 = 'g_b1_main';

  const supplierA = 'pty_supp_a';
  const customerA = 'pty_cust_a';
  const customerB = 'pty_cust_b';

  let dellItemId: string;
  let nonTrackedItemId: string;

  before(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }

    // Initialize database using connection.ts which runs schema and UI-045 migrations
    db = getDatabase(testDbPath);

    // Initialize business for Company A and Company B
    initializeBusiness(db, {
      companyId: companyA,
      companyName: 'Dell Distributors India Pvt Ltd',
      legalName: 'Dell Distributors India Pvt Ltd',
      stateCode: '33',
      state: 'Tamil Nadu',
      gstin: '33AABBD1234F1Z5'
    });

    initializeBusiness(db, {
      companyId: companyB,
      companyName: 'Apex Technologies Kerala',
      legalName: 'Apex Technologies Kerala LLP',
      stateCode: '32',
      state: 'Kerala',
      gstin: '32AACCA9876E1Z1'
    });

    // Seed financial years matching test constants
    db.prepare(`
      INSERT OR REPLACE INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
      VALUES (?, ?, 'FY 2026-27', '2026-04-01', '2027-03-31', 'OPEN')
    `).run(fyId, companyA);
    db.prepare(`
      INSERT OR REPLACE INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
      VALUES (?, ?, 'FY 2026-27', '2026-04-01', '2027-03-31', 'OPEN')
    `).run(`${fyId}_b`, companyB);

    // Ensure unit_id is 'unit_nos' for companyA and 'unit_nos_b' for companyB
    db.prepare(`UPDATE units SET unit_id = 'unit_nos' WHERE company_id = ? AND UPPER(symbol) = 'NOS'`).run(companyA);
    db.prepare(`UPDATE units SET unit_id = 'unit_nos_b' WHERE company_id = ? AND UPPER(symbol) = 'NOS'`).run(companyB);

    // Seed godowns
    db.prepare(`INSERT OR REPLACE INTO godowns (godown_id, company_id, godown_name, is_default) VALUES (?, ?, 'Main Warehouse Chennai', 1)`).run(godownA1, companyA);
    db.prepare(`INSERT OR REPLACE INTO godowns (godown_id, company_id, godown_name, is_default) VALUES (?, ?, 'Secondary Depot Madurai', 0)`).run(godownA2, companyA);
    db.prepare(`INSERT OR REPLACE INTO godowns (godown_id, company_id, godown_name, is_default) VALUES (?, ?, 'Apex Kochi Godown', 1)`).run(godownB1, companyB);

    // Seed parties
    const suppLedgerA = `${companyA}_led_supp_a`;
    db.prepare(`
      INSERT OR REPLACE INTO ledgers (ledger_id, company_id, ledger_name, group_id, is_party)
      VALUES (?, ?, 'Dell India OEM Ltd', '${companyA}_grp_creditors', 1)
    `).run(suppLedgerA, companyA);
    db.prepare(`
      INSERT OR REPLACE INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin)
      VALUES (?, ?, ?, 'SUPPLIER', 'Dell India OEM Ltd', '33AAACD9999F1Z9')
    `).run(supplierA, companyA, suppLedgerA);
    db.prepare(`
      INSERT OR REPLACE INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
      VALUES ('addr_supp_a', ?, '10 Industrial Estate', 'Chennai', 'Tamil Nadu', '33', '600032')
    `).run(supplierA);

    const custLedgerA = `${companyA}_led_cust_a`;
    db.prepare(`
      INSERT OR REPLACE INTO ledgers (ledger_id, company_id, ledger_name, group_id, is_party)
      VALUES (?, ?, 'KB Enterprises', '${companyA}_grp_debtors', 1)
    `).run(custLedgerA, companyA);
    db.prepare(`
      INSERT OR REPLACE INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin)
      VALUES (?, ?, ?, 'CUSTOMER', 'KB Enterprises', '33AAEFK1111F1Z1')
    `).run(customerA, companyA, custLedgerA);
    db.prepare(`
      INSERT OR REPLACE INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
      VALUES ('addr_cust_a', ?, '45 Commercial Street', 'Chennai', 'Tamil Nadu', '33', '600001')
    `).run(customerA);

    const custLedgerB = `${companyB}_led_cust_b`;
    db.prepare(`
      INSERT OR REPLACE INTO ledgers (ledger_id, company_id, ledger_name, group_id, is_party)
      VALUES (?, ?, 'Apex Customer', '${companyB}_grp_debtors', 1)
    `).run(custLedgerB, companyB);
    db.prepare(`
      INSERT OR REPLACE INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin)
      VALUES (?, ?, ?, 'CUSTOMER', 'Apex Customer', '32AAEFK2222F1Z2')
    `).run(customerB, companyB, custLedgerB);
    db.prepare(`
      INSERT OR REPLACE INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
      VALUES ('addr_cust_b', ?, '88 Marine Drive', 'Kochi', 'Kerala', '32', '682031')
    `).run(customerB);
  });

  after(() => {
    try {
      db.close();
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch {}
  });

  // ============================================================================
  // 1. Item Master: Product Definition vs Physical Units
  // ============================================================================
  it('1. & 2. Creates "Dell Inspiron 15" with Serial Number Tracking enabled (has_serial_no = 1)', () => {
    dellItemId = 'item_dell_insp_15';
    db.prepare(`
      INSERT OR REPLACE INTO stock_items (
        item_id, company_id, item_name, item_code, sku, hsn_sac, unit_id,
        gst_rate, purchase_rate_paise, selling_rate_paise, warranty_months,
        has_serial_no, is_active
      ) VALUES (?, ?, 'Dell Inspiron 15', 'LAP-DELL-15', 'DELL-IN15-01', '84713010', 'unit_nos',
        18.00, 5000000, 6500000, 12, 1, 1)
    `).run(dellItemId, companyA);

    nonTrackedItemId = 'item_usb_mouse';
    db.prepare(`
      INSERT OR REPLACE INTO stock_items (
        item_id, company_id, item_name, item_code, hsn_sac, unit_id,
        gst_rate, purchase_rate_paise, selling_rate_paise, has_serial_no, is_active
      ) VALUES (?, ?, 'Dell Optical USB Mouse', 'MOU-DELL-01', '84716060', 'unit_nos',
        18.00, 30000, 50000, 0, 1)
    `).run(nonTrackedItemId, companyA);

    const dell = db.prepare('SELECT item_name, has_serial_no, warranty_months FROM stock_items WHERE item_id = ?').get(dellItemId) as any;
    assert.strictEqual(dell.item_name, 'Dell Inspiron 15');
    assert.strictEqual(dell.has_serial_no, 1, 'Serial number tracking must be enabled in Item Master');
    assert.strictEqual(dell.warranty_months, 12);

    const mouse = db.prepare('SELECT has_serial_no FROM stock_items WHERE item_id = ?').get(nonTrackedItemId) as any;
    assert.strictEqual(mouse.has_serial_no, 0, 'Non-tracked item has_serial_no must be 0');
  });

  // ============================================================================
  // 2. Purchase Entry: Validation & Draft Behavior
  // ============================================================================
  it('3. Rejects Purchase Posting if serialized item has missing serials or count mismatch', () => {
    // Missing serials entirely
    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId: companyA,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-05-10',
        partyId: supplierA,
        status: 'POSTED',
        lines: [
          { itemId: dellItemId, quantity: 3, ratePaise: 5000000, godownId: godownA1 }
        ]
      });
    }, /requires serial numbers/i);

    // Quantity mismatch (qty 3, but only 2 serials provided)
    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId: companyA,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-05-10',
        partyId: supplierA,
        status: 'POSTED',
        lines: [
          { itemId: dellItemId, quantity: 3, ratePaise: 5000000, serialNumber: 'DELL-IN-001, DELL-IN-002', godownId: godownA1 }
        ]
      });
    }, /Serial count \(2\) does not match quantity \(3\)/i);

    // Duplicate serial numbers within same voucher
    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId: companyA,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-05-10',
        partyId: supplierA,
        status: 'POSTED',
        lines: [
          { itemId: dellItemId, quantity: 3, ratePaise: 5000000, serialNumber: 'DELL-IN-001, DELL-IN-001, DELL-IN-002', godownId: godownA1 }
        ]
      });
    }, /Duplicate serial numbers found/i);
  });

  it('4. & 5. Draft Purchase does NOT make serials available for sale in Serial Register', () => {
    const draft = PostingEngine.postVoucher(db, {
      companyId: companyA,
      fyId,
      voucherType: 'PURCHASE',
      voucherDate: '2026-05-10',
      partyId: supplierA,
      status: 'DRAFT',
      lines: [
        { itemId: dellItemId, quantity: 3, ratePaise: 5000000, serialNumber: 'DELL-IN-001, DELL-IN-002, DELL-IN-003', godownId: godownA1 }
      ]
    });

    assert.ok(draft.voucherId);
    assert.strictEqual(draft.status, 'DRAFT');

    // Confirm that stock_item_serials contains zero AVAILABLE serials for this item
    const availCount = (db.prepare(`
      SELECT COUNT(*) as cnt FROM stock_item_serials
      WHERE company_id = ? AND item_id = ? AND status = 'AVAILABLE'
    `).get(companyA, dellItemId) as any).cnt;

    assert.strictEqual(availCount, 0, 'Unposted draft purchase must NEVER make serials available for sale');

    // Clean up draft
    db.prepare('DELETE FROM voucher_lines WHERE voucher_id = ?').run(draft.voucherId);
    db.prepare('DELETE FROM vouchers WHERE voucher_id = ?').run(draft.voucherId);
  });

  // ============================================================================
  // 3. Purchase Posting: Atomic Physical Inventory Unit Creation
  // ============================================================================
  let purchaseVoucherId: string;
  let purchaseVoucherNumber: string;

  it('6. & 7. Posts Purchase of 3 units -> all 3 appear as AVAILABLE in Serial Register with godown & supplier', () => {
    const res = PostingEngine.postVoucher(db, {
      companyId: companyA,
      fyId,
      voucherType: 'PURCHASE',
      voucherDate: '2026-05-10',
      partyId: supplierA,
      status: 'POSTED',
      lines: [
        { itemId: dellItemId, quantity: 3, ratePaise: 5000000, serialNumber: 'DELL-IN-001, DELL-IN-002, DELL-IN-003', godownId: godownA1 }
      ]
    });

    purchaseVoucherId = res.voucherId;
    purchaseVoucherNumber = res.voucherNumber;

    assert.ok(purchaseVoucherId);
    assert.strictEqual(res.status, 'POSTED');

    // Query physical units in stock_item_serials
    const units = db.prepare(`
      SELECT serial_number, status, company_id, godown_id, purchase_voucher_id, supplier_id, purchase_date, warranty_expiry_date
      FROM stock_item_serials
      WHERE company_id = ? AND item_id = ?
      ORDER BY serial_number ASC
    `).all(companyA, dellItemId) as any[];

    assert.strictEqual(units.length, 3, 'Must create exactly 3 physical unit records');
    assert.deepStrictEqual(units.map(u => u.serial_number), ['DELL-IN-001', 'DELL-IN-002', 'DELL-IN-003']);

    for (const u of units) {
      assert.strictEqual(u.status, 'AVAILABLE', 'Each unit must be in AVAILABLE status');
      assert.strictEqual(u.company_id, companyA, 'Must belong to Company A');
      assert.strictEqual(u.godown_id, godownA1, 'Must be assigned to the purchase godown');
      assert.strictEqual(u.purchase_voucher_id, purchaseVoucherId);
      assert.strictEqual(u.supplier_id, supplierA);
      assert.strictEqual(u.purchase_date, '2026-05-10');
      assert.strictEqual(u.warranty_expiry_date, '2027-05-10', 'Calculates 12 months warranty expiry');
    }

    // Verify stock entry mass balance
    const stockSummary = InventoryEngine.getItemStockSummary(db, dellItemId);
    assert.strictEqual(stockSummary.totalQuantity, 3, 'Physical inventory balance must be 3 units');
  });

  it('8. Duplicate Purchase Rejection: Cannot re-purchase already active serial in company', () => {
    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId: companyA,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-05-12',
        partyId: supplierA,
        status: 'POSTED',
        lines: [
          { itemId: dellItemId, quantity: 1, ratePaise: 5000000, serialNumber: 'DELL-IN-001', godownId: godownA1 }
        ]
      });
    }, /Serial number 'DELL-IN-001' already exists for item 'Dell Inspiron 15' in this company/i);
  });

  // ============================================================================
  // 4. Sales Entry & Serial Selection Integration
  // ============================================================================
  it('9. & 10. Available Serial Lookup correctly filters by item and godown', () => {
    // Query available serials in Godown A1
    const availA1 = db.prepare(`
      SELECT serial_number, status, godown_id FROM stock_item_serials
      WHERE company_id = ? AND item_id = ? AND status = 'AVAILABLE' AND godown_id = ?
    `).all(companyA, dellItemId, godownA1) as any[];

    assert.strictEqual(availA1.length, 3);
    assert.deepStrictEqual(availA1.map(u => u.serial_number), ['DELL-IN-001', 'DELL-IN-002', 'DELL-IN-003']);

    // Query available serials in Godown A2 (where none were stocked)
    const availA2 = db.prepare(`
      SELECT serial_number, status, godown_id FROM stock_item_serials
      WHERE company_id = ? AND item_id = ? AND status = 'AVAILABLE' AND godown_id = ?
    `).all(companyA, dellItemId, godownA2) as any[];

    assert.strictEqual(availA2.length, 0, 'Godown A2 must have 0 available units');
  });

  it('11. Sales Entry Validation: rejects sale without serials, count mismatch, or foreign serial', () => {
    // Missing serials on sale of serialized item
    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId: companyA,
        fyId,
        voucherType: 'SALES',
        voucherDate: '2026-05-15',
        partyId: customerA,
        status: 'POSTED',
        lines: [
          { itemId: dellItemId, quantity: 2, ratePaise: 6500000, godownId: godownA1 }
        ]
      });
    }, /requires serial numbers/i);

    // Quantity mismatch (qty 2, but 3 serials selected)
    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId: companyA,
        fyId,
        voucherType: 'SALES',
        voucherDate: '2026-05-15',
        partyId: customerA,
        status: 'POSTED',
        lines: [
          { itemId: dellItemId, quantity: 2, ratePaise: 6500000, serialNumber: 'DELL-IN-001, DELL-IN-002, DELL-IN-003', godownId: godownA1 }
        ]
      });
    }, /Serial count \(3\) does not match quantity \(2\)/i);

    // Non-existent serial
    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId: companyA,
        fyId,
        voucherType: 'SALES',
        voucherDate: '2026-05-15',
        partyId: customerA,
        status: 'POSTED',
        lines: [
          { itemId: dellItemId, quantity: 1, ratePaise: 6500000, serialNumber: 'FAKE-SERIAL-999', godownId: godownA1 }
        ]
      });
    }, /Serial 'FAKE-SERIAL-999' does not exist for item/i);
  });

  // ============================================================================
  // 5. Sales Posting & Serial State Transitions
  // ============================================================================
  let salesVoucherId: string;
  let salesVoucherNumber: string;

  it('12., 13., 14. & 15. Sells 2 units (DELL-IN-001, DELL-IN-002) -> marks SOLD; DELL-IN-003 remains AVAILABLE; 100% stock reconciliation', () => {
    const sale = PostingEngine.postVoucher(db, {
      companyId: companyA,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-05-15',
      partyId: customerA,
      status: 'POSTED',
      lines: [
        { itemId: dellItemId, quantity: 2, ratePaise: 6500000, serialNumber: 'DELL-IN-001, DELL-IN-002', godownId: godownA1 }
      ]
    });

    salesVoucherId = sale.voucherId;
    salesVoucherNumber = sale.voucherNumber;

    assert.ok(salesVoucherId);
    assert.strictEqual(sale.status, 'POSTED');

    // Check status of DELL-IN-001 and DELL-IN-002
    const sold1 = db.prepare('SELECT * FROM stock_item_serials WHERE serial_number = ?').get('DELL-IN-001') as any;
    const sold2 = db.prepare('SELECT * FROM stock_item_serials WHERE serial_number = ?').get('DELL-IN-002') as any;

    assert.strictEqual(sold1.status, 'SOLD');
    assert.strictEqual(sold1.sales_voucher_id, salesVoucherId);
    assert.strictEqual(sold1.customer_id, customerA);
    assert.strictEqual(sold1.sales_date, '2026-05-15');

    assert.strictEqual(sold2.status, 'SOLD');
    assert.strictEqual(sold2.sales_voucher_id, salesVoucherId);
    assert.strictEqual(sold2.customer_id, customerA);
    assert.strictEqual(sold2.sales_date, '2026-05-15');

    // Check remaining unit DELL-IN-003
    const remaining = db.prepare('SELECT * FROM stock_item_serials WHERE serial_number = ?').get('DELL-IN-003') as any;
    assert.strictEqual(remaining.status, 'AVAILABLE');
    assert.strictEqual(remaining.sales_voucher_id, null);
    assert.strictEqual(remaining.customer_id, null);

    // 100% RECONCILIATION: stock quantity vs serial count
    const stockSummary = InventoryEngine.getItemStockSummary(db, dellItemId);
    const availableSerialsCount = (db.prepare(`
      SELECT COUNT(*) as cnt FROM stock_item_serials
      WHERE company_id = ? AND item_id = ? AND status = 'AVAILABLE'
    `).get(companyA, dellItemId) as any).cnt;

    assert.strictEqual(stockSummary.totalQuantity, 1, 'Stock balance must be exactly 1 unit (3 in - 2 out)');
    assert.strictEqual(availableSerialsCount, 1, 'Serial Register available units must be exactly 1 unit');
    assert.strictEqual(stockSummary.totalQuantity, availableSerialsCount, 'Stock balance and available serial count reconcile 100%');
  });

  it('16. Double-Sale Prevention Guard: strictly rejects concurrent attempt to sell DELL-IN-001', () => {
    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId: companyA,
        fyId,
        voucherType: 'SALES',
        voucherDate: '2026-05-16',
        partyId: customerA,
        status: 'POSTED',
        lines: [
          { itemId: dellItemId, quantity: 1, ratePaise: 6500000, serialNumber: 'DELL-IN-001', godownId: godownA1 }
        ]
      });
    }, /Serial 'DELL-IN-001' for item 'Dell Inspiron 15' is not AVAILABLE \(current status: SOLD\)/i);
  });

  // ============================================================================
  // 6. Voucher Cancellation Lifecycle & Guards
  // ============================================================================
  it('17. Purchase Cancellation Guard: strictly rejects purchase cancellation if ANY serial is already SOLD', () => {
    assert.throws(() => {
      PostingEngine.cancelVoucher(db, companyA, purchaseVoucherId, 'admin', 'Attempt cancel purchase with sold units');
    }, /Cannot cancel purchase voucher .* Serial 'DELL-IN-001' has already been sold to a customer/i);
  });

  it('18. Sales Voucher Cancellation: safely restores sold serials to AVAILABLE and reconciles stock', () => {
    PostingEngine.cancelVoucher(db, companyA, salesVoucherId, 'admin', 'Customer cancelled order');

    // Confirm DELL-IN-001 and DELL-IN-002 reverted to AVAILABLE
    const restored1 = db.prepare('SELECT * FROM stock_item_serials WHERE serial_number = ?').get('DELL-IN-001') as any;
    const restored2 = db.prepare('SELECT * FROM stock_item_serials WHERE serial_number = ?').get('DELL-IN-002') as any;

    assert.strictEqual(restored1.status, 'AVAILABLE');
    assert.strictEqual(restored1.sales_voucher_id, null, 'sales_voucher_id must be cleared on cancel');
    assert.strictEqual(restored1.customer_id, null, 'customer_id must be cleared on cancel');
    assert.strictEqual(restored1.sales_date, null, 'sales_date must be cleared on cancel');

    assert.strictEqual(restored2.status, 'AVAILABLE');
    assert.strictEqual(restored2.sales_voucher_id, null);
    assert.strictEqual(restored2.customer_id, null);

    // Verify all 3 units are AVAILABLE again
    const totalAvail = (db.prepare(`
      SELECT COUNT(*) as cnt FROM stock_item_serials
      WHERE company_id = ? AND item_id = ? AND status = 'AVAILABLE'
    `).get(companyA, dellItemId) as any).cnt;

    assert.strictEqual(totalAvail, 3);

    // Verify stock balance restored to 3
    const stockSummary = InventoryEngine.getItemStockSummary(db, dellItemId);
    assert.strictEqual(stockSummary.totalQuantity, 3);
    assert.strictEqual(stockSummary.totalQuantity, totalAvail, '100% reconciliation after sales cancellation');
  });

  it('19. Safe Purchase Cancellation: when all units are AVAILABLE, cancelling purchase un-stocks serials', () => {
    // Now that sales voucher was cancelled, all 3 units are AVAILABLE
    PostingEngine.cancelVoucher(db, companyA, purchaseVoucherId, 'admin', 'Supplier return / PO cancel');

    // Introduced units are un-stocked
    const availAfterPurCancel = (db.prepare(`
      SELECT COUNT(*) as cnt FROM stock_item_serials
      WHERE company_id = ? AND item_id = ? AND status = 'AVAILABLE'
    `).get(companyA, dellItemId) as any).cnt;

    assert.strictEqual(availAfterPurCancel, 0, 'Cancelled purchase removes units from available stock');

    const stockSummary = InventoryEngine.getItemStockSummary(db, dellItemId);
    assert.strictEqual(stockSummary.totalQuantity, 0, 'Stock balance is now 0');
  });

  // ============================================================================
  // 7. Multi-Tenant Isolation
  // ============================================================================
  it('20. Multi-Tenant Security: Company B cannot query, view, or mutate Company A serials', () => {
    // 1. Re-purchase 1 unit in Company A
    PostingEngine.postVoucher(db, {
      companyId: companyA,
      fyId,
      voucherType: 'PURCHASE',
      voucherDate: '2026-05-20',
      partyId: supplierA,
      status: 'POSTED',
      lines: [
        { itemId: dellItemId, quantity: 1, ratePaise: 5000000, serialNumber: 'DELL-TENANT-001', godownId: godownA1 }
      ]
    });

    // 2. Query from Company B context: must return 0 records
    const compBQuery = db.prepare(`
      SELECT * FROM stock_item_serials
      WHERE company_id = ? AND serial_number = 'DELL-TENANT-001'
    `).all(companyB);
    assert.strictEqual(compBQuery.length, 0, 'Company B must see zero serials from Company A');

    // 3. Attempt by Company B to sell Company A serial: must be rejected
    // First create item in Company B
    const compBItemId = 'item_b_dell';
    db.prepare(`
      INSERT OR REPLACE INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, has_serial_no, hsn_sac)
      VALUES (?, ?, 'Dell Laptop B', 'unit_nos_b', 18.00, 1, '84713010')
    `).run(compBItemId, companyB);

    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId: companyB,
        fyId: `${fyId}_b`,
        voucherType: 'SALES',
        voucherDate: '2026-05-22',
        partyId: customerB,
        status: 'POSTED',
        lines: [
          { itemId: compBItemId, quantity: 1, ratePaise: 7000000, serialNumber: 'DELL-TENANT-001', godownId: godownB1 }
        ]
      });
    }, /Serial 'DELL-TENANT-001' does not exist for item 'Dell Laptop B' in this company/i);
  });

  // ============================================================================
  // 8. Opening Stock & Sales Return Lifecycle Transitions
  // ============================================================================
  it('21. Opening Stock registers physical serialized units linked to STOCK_JOURNAL', () => {
    const openingItemId = 'item_opening_tracked';
    db.prepare(`
      INSERT OR REPLACE INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, has_serial_no, hsn_sac)
      VALUES (?, ?, 'Precision Workstation', 'unit_nos', 18.00, 1, '84715000')
    `).run(openingItemId, companyA);

    PostingEngine.recordOpeningStock(db, {
      companyId: companyA,
      fyId,
      itemId: openingItemId,
      godownId: godownA1,
      quantity: 2,
      ratePaise: 8000000,
      serialNumbers: 'WRK-OPN-101, WRK-OPN-102'
    });

    const opnSerials = db.prepare(`
      SELECT serial_number, status, godown_id, purchase_voucher_id
      FROM stock_item_serials
      WHERE company_id = ? AND item_id = ?
      ORDER BY serial_number ASC
    `).all(companyA, openingItemId) as any[];

    assert.strictEqual(opnSerials.length, 2);
    assert.deepStrictEqual(opnSerials.map(s => s.serial_number), ['WRK-OPN-101', 'WRK-OPN-102']);
    assert.strictEqual(opnSerials[0].status, 'AVAILABLE');
    assert.ok(opnSerials[0].purchase_voucher_id.startsWith('vch_'));

    const opnStock = InventoryEngine.getItemStockSummary(db, openingItemId);
    assert.strictEqual(opnStock.totalQuantity, 2);
  });

  it('22. Sales Return transitions sold serial back to AVAILABLE', () => {
    // 1. Sell WRK-OPN-101
    const sale = PostingEngine.postVoucher(db, {
      companyId: companyA,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-05-25',
      partyId: customerA,
      status: 'POSTED',
      lines: [
        { itemId: 'item_opening_tracked', quantity: 1, ratePaise: 11000000, serialNumber: 'WRK-OPN-101', godownId: godownA1 }
      ]
    });

    const checkSold = db.prepare("SELECT status FROM stock_item_serials WHERE serial_number = 'WRK-OPN-101'").get() as any;
    assert.strictEqual(checkSold.status, 'SOLD');

    // 2. Customer returns WRK-OPN-101 via SALES_RETURN
    PostingEngine.postVoucher(db, {
      companyId: companyA,
      fyId,
      voucherType: 'SALES_RETURN',
      voucherDate: '2026-05-28',
      partyId: customerA,
      status: 'POSTED',
      lines: [
        { itemId: 'item_opening_tracked', quantity: 1, ratePaise: 8000000, serialNumber: 'WRK-OPN-101', godownId: godownA1 }
      ]
    });

    const checkRestored = db.prepare("SELECT status, sales_voucher_id, customer_id FROM stock_item_serials WHERE serial_number = 'WRK-OPN-101'").get() as any;
    assert.strictEqual(checkRestored.status, 'AVAILABLE', 'Sales return must restore physical unit to AVAILABLE');
    assert.strictEqual(checkRestored.sales_voucher_id, null);
    assert.strictEqual(checkRestored.customer_id, null);
  });
});
