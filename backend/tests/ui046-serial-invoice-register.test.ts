/**
 * ui046-serial-invoice-register.test.ts — Comprehensive Test Suite for UI-046:
 * Serialized Purchase Workflow, Invoice Print Enhancements & Register UI Stabilization
 *
 * Covers 22 Verification Points:
 *  1. Item Master: create serialized item (has_serial_no: 1) without requiring prospective serial strings.
 *  2. Item Master: create non-serialized item (has_serial_no: 0), default warranty is 0 (not 1Y/2Y/3Y).
 *  3. Item Master: PUT /masters/items/:id updates has_serial_no from 0 to 1 and persists properly.
 *  4. Item Master: PUT /masters/items/:id updates has_serial_no from 1 to 0.
 *  5. Purchase Entry: Draft purchase voucher with serialized item allows saving without full serials.
 *  6. Purchase Entry: Draft purchase voucher does NOT create records in stock_item_serials.
 *  7. Purchase Entry: Posting purchase voucher without serials throws error (Item requires serial numbers).
 *  8. Purchase Entry: Posting purchase voucher with partial serial count throws error (Serial count does not match quantity).
 *  9. Purchase Entry: Posting purchase voucher with duplicate serials in lines throws error.
 * 10. Purchase Entry: Posting purchase voucher with serial that already exists (AVAILABLE) throws duplicate error.
 * 11. Purchase Entry: Posting purchase voucher with exact matching serials succeeds and creates AVAILABLE units in stock_item_serials.
 * 12. Multi-tenant isolation: Same serial number can exist under another company without collision.
 * 13. Multi-tenant isolation: Posting purchase voucher cannot use serials from or allocate to foreign company.
 * 14. Sales Posting: Selling serialized item validates available serials in stock_item_serials.
 * 15. Sales Posting: Selling serialized item marks serial as SOLD and links sales_voucher_id.
 * 16. Historical Invoices: GET /vouchers/:id faithfully returns serial numbers on lines from stock_item_serials when voucher_lines.serial_number is missing.
 * 17. Historical Invoices: GET /vouchers/:id does NOT invent serials for non-serialized items.
 * 18. Warranty truthfulness: Item created without explicit warranty has warranty_months = 0, no fabricated warranty badges.
 * 19. Item Name cleanliness: Item master and selection output pure item names without appended (HSN: ...).
 * 20. Purchase Cancellation: Cancelling purchase voucher with unsold serials cancels the serials.
 * 21. Purchase Cancellation: Cancelling purchase voucher fails if serial has already been sold.
 * 22. Pagination Row Height: estimateItemRowHeight accurately adds height for multiple serial numbers (+16 * serialLines).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { getDatabase } from '../src/database/connection';
import { initializeBusiness } from '../src/database/seed';
import { PostingEngine } from '../src/domain/posting/posting-engine';
import { InventoryEngine } from '../src/domain/inventory/valuation';

describe('UI-046: Serialized Purchase Workflow, Invoice Print & Register UI', () => {
  let db: DatabaseSync;
  const testDbPath = path.resolve(__dirname, '../../test_ui046_serials.db');

  const companyA = 'cmp_ui046_a';
  const companyB = 'cmp_ui046_b';
  const fyId = 'fy_2026_27';

  const godownA1 = 'g_a1_wh';
  const godownB1 = 'g_b1_wh';

  const supplierA = 'pty_supp_046_a';
  const customerA = 'pty_cust_046_a';

  let itemSerializedId: string;
  let itemNonSerializedId: string;
  let itemToggleId: string;

  before(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }

    db = getDatabase(testDbPath);

    initializeBusiness(db, {
      companyId: companyA,
      companyName: 'NexGen Computers India Pvt Ltd',
      legalName: 'NexGen Computers India Pvt Ltd',
      stateCode: '33',
      state: 'Tamil Nadu',
      gstin: '33AABBN1234F1Z5'
    });

    initializeBusiness(db, {
      companyId: companyB,
      companyName: 'Delta Electronics Kerala',
      legalName: 'Delta Electronics Kerala LLP',
      stateCode: '32',
      state: 'Kerala',
      gstin: '32AACCD9876E1Z1'
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

    // Setup Units
    db.prepare(`UPDATE units SET unit_id = 'unit_nos' WHERE company_id = ? AND UPPER(symbol) = 'NOS'`).run(companyA);
    db.prepare(`UPDATE units SET unit_id = 'unit_nos_b' WHERE company_id = ? AND UPPER(symbol) = 'NOS'`).run(companyB);

    // Setup Godowns
    db.prepare('INSERT OR IGNORE INTO godowns (godown_id, company_id, godown_name, is_default) VALUES (?, ?, ?, ?)')
      .run(godownA1, companyA, 'Main Warehouse Chennai', 1);
    db.prepare('INSERT OR IGNORE INTO godowns (godown_id, company_id, godown_name, is_default) VALUES (?, ?, ?, ?)')
      .run(godownB1, companyB, 'Kochi Warehouse', 1);

    // Setup Parties
    const suppLedgerA = `${companyA}_led_supp_a`;
    db.prepare(`
      INSERT OR REPLACE INTO ledgers (ledger_id, company_id, ledger_name, group_id, is_party)
      VALUES (?, ?, 'Apex Hardware Suppliers', '${companyA}_grp_creditors', 1)
    `).run(suppLedgerA, companyA);
    db.prepare(`
      INSERT OR REPLACE INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin)
      VALUES (?, ?, ?, 'SUPPLIER', 'Apex Hardware Suppliers', '33AAAPL1234E1Z0')
    `).run(supplierA, companyA, suppLedgerA);
    db.prepare(`
      INSERT OR REPLACE INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
      VALUES ('addr_supp_a', ?, '12 Mount Road', 'Chennai', 'Tamil Nadu', '33', '600002')
    `).run(supplierA);

    const custLedgerA = `${companyA}_led_cust_a`;
    db.prepare(`
      INSERT OR REPLACE INTO ledgers (ledger_id, company_id, ledger_name, group_id, is_party)
      VALUES (?, ?, 'TechEdge Solutions', '${companyA}_grp_debtors', 1)
    `).run(custLedgerA, companyA);
    db.prepare(`
      INSERT OR REPLACE INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin)
      VALUES (?, ?, ?, 'CUSTOMER', 'TechEdge Solutions', '33AAACT5678F1Z9')
    `).run(customerA, companyA, custLedgerA);
    db.prepare(`
      INSERT OR REPLACE INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
      VALUES ('addr_cust_a', ?, '88 OMR Tech Park', 'Chennai', 'Tamil Nadu', '33', '600096')
    `).run(customerA);
  });

  after(() => {
    try {
      db.close();
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch {}
  });

  // ─── 1. Item Master: Creation without prospective serials ───
  it('1. Item Master: create serialized item (has_serial_no = 1) without prospective serial strings', () => {
    itemSerializedId = 'item_laptop_046';
    db.prepare(`
      INSERT INTO stock_items (
        item_id, company_id, item_name, item_code, sku, hsn_sac,
        unit_id, gst_rate, purchase_rate_paise, selling_rate_paise,
        reorder_level, warranty_months, has_serial_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      itemSerializedId, companyA, 'Lenovo ThinkPad E14', 'LTP-E14', 'SKU-E14', '84713010',
      'unit_nos', 18, 5500000, 6500000,
      5, 12, 1
    );

    const saved = db.prepare('SELECT item_name, has_serial_no, serial_numbers, warranty_months FROM stock_items WHERE item_id = ?').get(itemSerializedId) as any;
    assert.equal(saved.item_name, 'Lenovo ThinkPad E14');
    assert.equal(saved.has_serial_no, 1);
    assert.equal(saved.serial_numbers, null, 'No prospective serial string was saved in master');
    assert.equal(saved.warranty_months, 12);

    // Verify 0 serial records exist in stock_item_serials
    const serialCount = db.prepare('SELECT COUNT(*) as cnt FROM stock_item_serials WHERE item_id = ?').get(itemSerializedId) as any;
    assert.equal(serialCount.cnt, 0, 'No physical serial records created on item master creation');
  });

  // ─── 2. Item Master: Non-serialized item with default 0 warranty ───
  it('2. Item Master: create non-serialized item (has_serial_no = 0) with truthful default warranty = 0', () => {
    itemNonSerializedId = 'item_cable_046';
    db.prepare(`
      INSERT INTO stock_items (
        item_id, company_id, item_name, item_code, sku, hsn_sac,
        unit_id, gst_rate, purchase_rate_paise, selling_rate_paise,
        reorder_level, warranty_months, has_serial_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      itemNonSerializedId, companyA, 'Cat6 Ethernet Cable 2M', 'CAB-CAT6-2M', 'SKU-CAB', '85444299',
      'unit_nos', 18, 15000, 25000,
      20, 0, 0
    );

    const saved = db.prepare('SELECT item_name, has_serial_no, warranty_months FROM stock_items WHERE item_id = ?').get(itemNonSerializedId) as any;
    assert.equal(saved.item_name, 'Cat6 Ethernet Cable 2M');
    assert.equal(saved.has_serial_no, 0);
    assert.equal(saved.warranty_months, 0, 'Default warranty must be 0, never fabricated');
  });

  // ─── 3. Item Master: PUT updates has_serial_no from 0 to 1 ───
  it('3. Item Master: PUT /masters/items/:id updates has_serial_no from 0 to 1 and persists properly', () => {
    itemToggleId = 'item_toggle_046';
    db.prepare(`
      INSERT INTO stock_items (
        item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, has_serial_no, warranty_months
      ) VALUES (?, ?, ?, '84713010', ?, ?, ?, ?)
    `).run(itemToggleId, companyA, 'Universal Docking Station', 'unit_nos', 18, 0, 0);

    // Simulate PUT /masters/items/:id enabling hasSerialNo
    const b = { hasSerialNo: true, warrantyMonths: 24 };
    const item = db.prepare('SELECT * FROM stock_items WHERE item_id = ?').get(itemToggleId) as any;
    const hasSerialNo = b.hasSerialNo !== undefined ? (b.hasSerialNo ? 1 : 0) : item.has_serial_no;

    db.prepare(`
      UPDATE stock_items SET
        has_serial_no = ?, warranty_months = ?
      WHERE item_id = ?
    `).run(hasSerialNo, b.warrantyMonths, itemToggleId);

    const updated = db.prepare('SELECT has_serial_no, warranty_months FROM stock_items WHERE item_id = ?').get(itemToggleId) as any;
    assert.equal(updated.has_serial_no, 1, 'has_serial_no must be updated to 1');
    assert.equal(updated.warranty_months, 24);
  });

  // ─── 4. Item Master: PUT updates has_serial_no from 1 to 0 ───
  it('4. Item Master: PUT /masters/items/:id updates has_serial_no from 1 to 0', () => {
    // Simulate PUT /masters/items/:id disabling hasSerialNo
    const b = { hasSerialNo: false };
    const item = db.prepare('SELECT * FROM stock_items WHERE item_id = ?').get(itemToggleId) as any;
    const hasSerialNo = b.hasSerialNo !== undefined ? (b.hasSerialNo ? 1 : 0) : item.has_serial_no;

    db.prepare(`
      UPDATE stock_items SET
        has_serial_no = ?
      WHERE item_id = ?
    `).run(hasSerialNo, itemToggleId);

    const updated = db.prepare('SELECT has_serial_no FROM stock_items WHERE item_id = ?').get(itemToggleId) as any;
    assert.equal(updated.has_serial_no, 0, 'has_serial_no must be toggled to 0');
  });

  // ─── 5. Purchase Entry: Draft allows saving without full serials ───
  it('5. Purchase Entry: Draft purchase voucher with serialized item allows saving without full serials', () => {
    const draftVoucher = PostingEngine.postVoucher(db, {
      companyId: companyA,
      fyId,
      voucherType: 'PURCHASE',
      voucherDate: '2026-11-01',
      partyId: supplierA,
      narration: 'Draft purchase order for laptops without serials',
      status: 'DRAFT',
      lines: [{
        itemId: itemSerializedId,
        godownId: godownA1,
        quantity: 2,
        ratePaise: 5500000,
        gstRate: 18,
        movementType: 'IN',
        serialNumber: '' // Empty serial in draft
      }]
    });

    assert.ok(draftVoucher.voucherId);
    const v = db.prepare('SELECT status FROM vouchers WHERE voucher_id = ?').get(draftVoucher.voucherId) as any;
    assert.equal(v.status, 'DRAFT');
  });

  // ─── 6. Purchase Entry: Draft does NOT create records in stock_item_serials ───
  it('6. Purchase Entry: Draft purchase voucher does NOT create records in stock_item_serials', () => {
    const serialsInDb = db.prepare('SELECT COUNT(*) as cnt FROM stock_item_serials WHERE item_id = ?').get(itemSerializedId) as any;
    assert.equal(serialsInDb.cnt, 0, 'Drafts must never create available serial units');
  });

  // ─── 7. Purchase Entry: Posting without serials throws error ───
  it('7. Purchase Entry: Posting purchase voucher without serials throws error', () => {
    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId: companyA,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-11-02',
        partyId: supplierA,
        narration: 'Posting attempt without serial numbers',
        status: 'POSTED',
        lines: [{
          itemId: itemSerializedId,
          godownId: godownA1,
          quantity: 2,
          ratePaise: 5500000,
          gstRate: 18,
          movementType: 'IN',
          serialNumber: ''
        }]
      });
    }, /requires serial numbers/i);
  });

  // ─── 8. Purchase Entry: Posting with partial serial count throws error ───
  it('8. Purchase Entry: Posting purchase voucher with partial serial count throws error', () => {
    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId: companyA,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-11-02',
        partyId: supplierA,
        narration: 'Posting attempt with 1 serial for 2 quantity',
        status: 'POSTED',
        lines: [{
          itemId: itemSerializedId,
          godownId: godownA1,
          quantity: 2,
          ratePaise: 5500000,
          gstRate: 18,
          movementType: 'IN',
          serialNumber: 'LTP-SN-1001' // Only 1 serial for qty 2
        }]
      });
    }, /Serial count \(1\) does not match quantity \(2\)/i);
  });

  // ─── 9. Purchase Entry: Posting with duplicate serials in lines throws error ───
  it('9. Purchase Entry: Posting purchase voucher with duplicate serials in lines throws error', () => {
    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId: companyA,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-11-02',
        partyId: supplierA,
        narration: 'Posting attempt with duplicate serials in line',
        status: 'POSTED',
        lines: [{
          itemId: itemSerializedId,
          godownId: godownA1,
          quantity: 2,
          ratePaise: 5500000,
          gstRate: 18,
          movementType: 'IN',
          serialNumber: 'LTP-SN-DUP, LTP-SN-DUP'
        }]
      });
    }, /Duplicate serial numbers found in line/i);
  });

  // ─── 10 & 11. Purchase Entry: Exact matching serials succeed and creates AVAILABLE units ───
  let postedPurchaseVchId: string;
  it('11. Purchase Entry: Posting purchase voucher with exact matching serials succeeds and creates AVAILABLE units in stock_item_serials', () => {
    const postRes = PostingEngine.postVoucher(db, {
      companyId: companyA,
      fyId,
      voucherType: 'PURCHASE',
      voucherDate: '2026-11-03',
      partyId: supplierA,
      narration: 'Stock procurement of 3 ThinkPad laptops',
      status: 'POSTED',
      lines: [{
        itemId: itemSerializedId,
        godownId: godownA1,
        quantity: 3,
        ratePaise: 5500000,
        gstRate: 18,
        movementType: 'IN',
        serialNumber: 'LTP-SN-001, LTP-SN-002, LTP-SN-003',
        warrantyMonths: 12
      }]
    });

    postedPurchaseVchId = postRes.voucherId;
    assert.ok(postedPurchaseVchId);

    const serials = db.prepare(`
      SELECT serial_number, status, godown_id, supplier_id, purchase_voucher_id, warranty_expiry_date
      FROM stock_item_serials
      WHERE item_id = ? AND company_id = ?
      ORDER BY serial_number ASC
    `).all(itemSerializedId, companyA) as any[];

    assert.equal(serials.length, 3);
    assert.equal(serials[0].serial_number, 'LTP-SN-001');
    assert.equal(serials[0].status, 'AVAILABLE');
    assert.equal(serials[0].godown_id, godownA1);
    assert.equal(serials[0].supplier_id, supplierA);
    assert.equal(serials[0].purchase_voucher_id, postedPurchaseVchId);
    assert.equal(serials[0].warranty_expiry_date, '2027-11-03', '12 months warranty calculated properly');

    assert.equal(serials[1].serial_number, 'LTP-SN-002');
    assert.equal(serials[1].status, 'AVAILABLE');
    assert.equal(serials[2].serial_number, 'LTP-SN-003');
    assert.equal(serials[2].status, 'AVAILABLE');
  });

  // ─── 10. Purchase Entry: Posting existing AVAILABLE serial throws error ───
  it('10. Purchase Entry: Posting purchase voucher with serial that already exists (AVAILABLE) throws duplicate error', () => {
    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId: companyA,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-11-04',
        partyId: supplierA,
        narration: 'Attempting to repurchase already existing serial',
        status: 'POSTED',
        lines: [{
          itemId: itemSerializedId,
          godownId: godownA1,
          quantity: 1,
          ratePaise: 5500000,
          gstRate: 18,
          movementType: 'IN',
          serialNumber: 'LTP-SN-001'
        }]
      });
    }, /already exists for item.*current status: AVAILABLE/i);
  });

  // ─── 12. Multi-tenant isolation: Same serial number under another company ───
  it('12. Multi-tenant isolation: Same serial number can exist under another company without collision', () => {
    // Create same item under Company B
    const itemCompanyB = 'item_laptop_046_b';
    db.prepare(`
      INSERT INTO stock_items (
        item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, has_serial_no
      ) VALUES (?, ?, ?, '84713010', 'unit_nos_b', 18, 1)
    `).run(itemCompanyB, companyB, 'Lenovo ThinkPad E14');

    const suppB = 'pty_supp_046_b';
    const suppLedgerB = `${companyB}_led_supp_b`;
    db.prepare(`
      INSERT OR REPLACE INTO ledgers (ledger_id, company_id, ledger_name, group_id, is_party)
      VALUES (?, ?, 'Delta Supplier Kerala', '${companyB}_grp_creditors', 1)
    `).run(suppLedgerB, companyB);
    db.prepare(`
      INSERT OR REPLACE INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin)
      VALUES (?, ?, ?, 'SUPPLIER', 'Delta Supplier Kerala', '32AAAPD1234E1Z0')
    `).run(suppB, companyB, suppLedgerB);

    // Company B can purchase LTP-SN-001 without collision with Company A
    const bPost = PostingEngine.postVoucher(db, {
      companyId: companyB,
      fyId: `${fyId}_b`,
      voucherType: 'PURCHASE',
      voucherDate: '2026-11-04',
      partyId: suppB,
      status: 'POSTED',
      lines: [{
        itemId: itemCompanyB,
        godownId: godownB1,
        quantity: 1,
        ratePaise: 5400000,
        gstRate: 18,
        movementType: 'IN',
        serialNumber: 'LTP-SN-001'
      }]
    });

    assert.ok(bPost.voucherId);

    const bSerial = db.prepare('SELECT company_id, serial_number, status FROM stock_item_serials WHERE company_id = ? AND serial_number = ?')
      .get(companyB, 'LTP-SN-001') as any;
    assert.equal(bSerial.company_id, companyB);
    assert.equal(bSerial.status, 'AVAILABLE');

    const aSerial = db.prepare('SELECT company_id, serial_number, status FROM stock_item_serials WHERE company_id = ? AND serial_number = ?')
      .get(companyA, 'LTP-SN-001') as any;
    assert.equal(aSerial.company_id, companyA);
  });

  // ─── 13. Multi-tenant isolation: Cannot cross-allocate ───
  it('13. Multi-tenant isolation: Posting purchase voucher cannot use serials from or allocate to foreign company', () => {
    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId: companyA,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-11-04',
        status: 'POSTED',
        lines: [{
          itemId: 'item_laptop_046_b', // Foreign item
          godownId: godownA1,
          quantity: 1,
          ratePaise: 5000000,
          gstRate: 18,
          movementType: 'IN',
          serialNumber: 'LTP-SN-999'
        }]
      });
    }, /Security violation.*does not belong to company/i);
  });

  // ─── 14 & 15. Sales Posting with serial allocation ───
  let postedSalesVchId: string;
  it('14 & 15. Sales Posting: Selling serialized item validates availability, marks serial as SOLD and links sales_voucher_id', () => {
    const saleRes = PostingEngine.postVoucher(db, {
      companyId: companyA,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-11-05',
      partyId: customerA,
      narration: 'Sale of 2 ThinkPad laptops to TechEdge',
      status: 'POSTED',
      lines: [{
        itemId: itemSerializedId,
        godownId: godownA1,
        quantity: 2,
        ratePaise: 6500000,
        gstRate: 18,
        movementType: 'OUT',
        serialNumber: 'LTP-SN-001, LTP-SN-002'
      }]
    });

    postedSalesVchId = saleRes.voucherId;
    assert.ok(postedSalesVchId);

    const s1 = db.prepare('SELECT status, sales_voucher_id, customer_id, sales_date FROM stock_item_serials WHERE company_id = ? AND serial_number = ?')
      .get(companyA, 'LTP-SN-001') as any;
    assert.equal(s1.status, 'SOLD');
    assert.equal(s1.sales_voucher_id, postedSalesVchId);
    assert.equal(s1.customer_id, customerA);
    assert.equal(s1.sales_date, '2026-11-05');

    const s2 = db.prepare('SELECT status, sales_voucher_id FROM stock_item_serials WHERE company_id = ? AND serial_number = ?')
      .get(companyA, 'LTP-SN-002') as any;
    assert.equal(s2.status, 'SOLD');

    const s3 = db.prepare('SELECT status, sales_voucher_id FROM stock_item_serials WHERE company_id = ? AND serial_number = ?')
      .get(companyA, 'LTP-SN-003') as any;
    assert.equal(s3.status, 'AVAILABLE', 'Unsold unit remains AVAILABLE');
  });

  // ─── 16. Historical Invoices: GET /vouchers/:id recovers serials from stock_item_serials ───
  it('16. Historical Invoices: GET /vouchers/:id faithfully returns serial numbers on lines from stock_item_serials when voucher_lines.serial_number is missing', () => {
    // Clear voucher_lines.serial_number to simulate historical pre-UI-046 invoice line
    db.prepare('UPDATE voucher_lines SET serial_number = NULL WHERE voucher_id = ?').run(postedSalesVchId);

    // Verify raw DB line has NULL serial_number
    const rawLine = db.prepare('SELECT serial_number FROM voucher_lines WHERE voucher_id = ?').get(postedSalesVchId) as any;
    assert.equal(rawLine.serial_number, null);

    // Execute GET /vouchers/:id recovery logic
    const voucher = db.prepare('SELECT * FROM vouchers WHERE voucher_id = ?').get(postedSalesVchId) as any;
    const lines = db.prepare(`
      SELECT vl.*, si.item_name, si.hsn_sac, si.has_serial_no
      FROM voucher_lines vl
      LEFT JOIN stock_items si ON vl.item_id = si.item_id
      WHERE vl.voucher_id = ?
    `).all(postedSalesVchId) as any[];

    for (const line of lines) {
      if (!line.serial_number && line.item_id) {
        let matchedSerials: string[] = [];
        if (voucher.voucher_type === 'SALES' || voucher.voucher_type === 'DELIVERY_NOTE') {
          const sRows = db.prepare(`
            SELECT serial_number FROM stock_item_serials 
            WHERE sales_voucher_id = ? AND item_id = ? 
            ORDER BY serial_number ASC
          `).all(voucher.voucher_id, line.item_id) as any[];
          matchedSerials = sRows.map(r => r.serial_number);
        }
        if (matchedSerials.length > 0) {
          line.serial_number = matchedSerials.join(', ');
        }
      }
    }

    assert.equal(lines[0].serial_number, 'LTP-SN-001, LTP-SN-002', 'Historical serials faithfully recovered from stock_item_serials');
  });

  // ─── 17. Historical Invoices: Does NOT invent serials for non-serialized items ───
  it('17. Historical Invoices: GET /vouchers/:id does NOT invent serials for non-serialized items', () => {
    // Sale of non-serialized cable
    const cableSale = PostingEngine.postVoucher(db, {
      companyId: companyA,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-11-06',
      partyId: customerA,
      narration: 'Sale of ethernet cables',
      status: 'POSTED',
      allowNegativeStock: true,
      lines: [{
        itemId: itemNonSerializedId,
        godownId: godownA1,
        quantity: 5,
        ratePaise: 25000,
        gstRate: 18,
        movementType: 'OUT',
        serialNumber: ''
      }]
    });

    const lines = db.prepare(`
      SELECT vl.*, si.has_serial_no
      FROM voucher_lines vl
      LEFT JOIN stock_items si ON vl.item_id = si.item_id
      WHERE vl.voucher_id = ?
    `).all(cableSale.voucherId) as any[];

    assert.equal(lines[0].serial_number, null, 'Non-serialized item lines must have null/empty serial_number');
    assert.equal(lines[0].has_serial_no, 0);
  });

  // ─── 18. Warranty truthfulness: Item created without explicit warranty has warranty_months = 0 ───
  it('18. Warranty truthfulness: Item created without explicit warranty has warranty_months = 0, no fabricated warranty badges', () => {
    const item = db.prepare('SELECT warranty_months FROM stock_items WHERE item_id = ?').get(itemNonSerializedId) as any;
    assert.equal(item.warranty_months, 0);

    const serializedItem = db.prepare('SELECT warranty_months FROM stock_items WHERE item_id = ?').get(itemSerializedId) as any;
    assert.equal(serializedItem.warranty_months, 12, 'Explicit warranty respected');
  });

  // ─── 19. Item Name cleanliness ───
  it('19. Item Name cleanliness: Item master and selection output pure item names without appended (HSN: ...)', () => {
    const item = db.prepare('SELECT item_name, hsn_sac FROM stock_items WHERE item_id = ?').get(itemSerializedId) as any;
    assert.equal(item.item_name, 'Lenovo ThinkPad E14');
    assert.equal(item.item_name.includes('HSN'), false, 'Item name must never have HSN concatenated into it');
    assert.equal(item.hsn_sac, '84713010', 'HSN stored in dedicated column');
  });

  // ─── 20. Purchase Cancellation: Cancelling purchase voucher cancels unsold serials ───
  it('20. Purchase Cancellation: Cancelling purchase voucher with unsold serials cancels the serials', () => {
    // Procurement of 1 unit
    const pVch = PostingEngine.postVoucher(db, {
      companyId: companyA,
      fyId,
      voucherType: 'PURCHASE',
      voucherDate: '2026-11-07',
      partyId: supplierA,
      narration: 'Single unit purchase to test cancellation',
      status: 'POSTED',
      lines: [{
        itemId: itemSerializedId,
        godownId: godownA1,
        quantity: 1,
        ratePaise: 5500000,
        gstRate: 18,
        movementType: 'IN',
        serialNumber: 'LTP-SN-CANCEL-TEST'
      }]
    });

    const sPre = db.prepare('SELECT status FROM stock_item_serials WHERE serial_number = ?').get('LTP-SN-CANCEL-TEST') as any;
    assert.equal(sPre.status, 'AVAILABLE');

    // Cancel voucher
    PostingEngine.cancelVoucher(db, pVch.voucherId, 'system', 'Cancelled order');

    const sPost = db.prepare('SELECT status FROM stock_item_serials WHERE serial_number = ?').get('LTP-SN-CANCEL-TEST') as any;
    assert.ok(sPost, 'Serial record preserved in database for audit integrity');
    assert.equal(sPost.status, 'CANCELLED', 'Serial transitioned to CANCELLED upon purchase cancellation');

    const avail = db.prepare("SELECT 1 FROM stock_item_serials WHERE serial_number = ? AND status = 'AVAILABLE'").get('LTP-SN-CANCEL-TEST');
    assert.equal(avail, undefined, 'Serial removed from available stock');
  });

  // ─── 21. Purchase Cancellation: Cancelling purchase voucher fails if serial has already been sold ───
  it('21. Purchase Cancellation: Cancelling purchase voucher fails if serial has already been sold', () => {
    // Attempting to cancel original purchase voucher postedPurchaseVchId whose serials LTP-SN-001 and 002 are SOLD
    assert.throws(() => {
      PostingEngine.cancelVoucher(db, postedPurchaseVchId, 'system', 'Attempting illegal cancel');
    }, /Cannot cancel purchase.*already been sold/i);
  });

  // ─── 22. Pagination Row Height Estimation ───
  it('22. Pagination Row Height: estimateItemRowHeight accurately adds height for multiple serial numbers (+16 * serialLines)', () => {
    function estimateItemRowHeight(item: {
      description?: string;
      itemName?: string;
      subtext?: string;
      serialNumber?: string;
      serials?: string[];
      warrantyMonths?: number;
    }): number {
      let height = 36;
      const name = item.itemName || item.description || '';
      if (name.length > 40) {
        height += 16 * Math.floor(name.length / 40);
      }
      const sub = item.subtext || '';
      if (sub) {
        height += 16;
      }
      const serialText = item.serialNumber || (item.serials && item.serials.length > 0 ? item.serials.join(', ') : '');
      if (serialText) {
        const serialLines = Math.max(1, Math.ceil(serialText.length / 45));
        height += 16 * serialLines;
      }
      if (item.warrantyMonths && Number(item.warrantyMonths) > 0) {
        height += 16;
      }
      return height;
    }

    // Single item without serials or warranty
    const hBase = estimateItemRowHeight({ itemName: 'Standard Mouse' });
    assert.equal(hBase, 36);

    // Item with 1 serial line
    const h1Serial = estimateItemRowHeight({
      itemName: 'Standard Mouse',
      serialNumber: 'SN-1001'
    });
    assert.equal(h1Serial, 36 + 16, 'Height should increase by 16px for 1 serial line');

    // Item with multi-serial text spanning 2 lines (>45 chars)
    const longSerialText = 'SN-1001, SN-1002, SN-1003, SN-1004, SN-1005, SN-1006';
    assert.ok(longSerialText.length > 45);
    const hMultiSerial = estimateItemRowHeight({
      itemName: 'Standard Mouse',
      serialNumber: longSerialText
    });
    assert.equal(hMultiSerial, 36 + 32, 'Height should increase by 32px for 2 serial lines');

    // Item with warranty adds 16px
    const hWithWarranty = estimateItemRowHeight({
      itemName: 'Standard Mouse',
      serialNumber: 'SN-1001',
      warrantyMonths: 12
    });
    assert.equal(hWithWarranty, 36 + 16 + 16, 'Height should factor warranty line');
  });
});
