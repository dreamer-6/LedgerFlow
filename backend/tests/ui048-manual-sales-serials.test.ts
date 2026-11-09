import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { getDatabase, closeDatabase } from '../src/database/connection';
import { initializeBusiness } from '../src/database/seed';
import { PostingEngine } from '../src/domain/posting/posting-engine';
import fs from 'node:fs';
import path from 'node:path';

describe('UI-048: Manual / Unbilled Serial Numbers on Sales Invoices', () => {
  let db: DatabaseSync;
  const testDbPath = path.resolve(__dirname, 'ui048_test.db');

  const companyId = 'comp_test_unbilled';
  let fyId = 'fy_test_2627';
  let godownId = 'godown_main';
  const customerId = 'cust_alpha';
  const itemId = 'item_laptop';

  before(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
    db = getDatabase(testDbPath);

    // Seed company & chart of accounts via standard initializeBusiness
    initializeBusiness(db as any, {
      companyId,
      companyName: 'Test Electronics Hub',
      gstin: '33AAAAA0000A1Z5',
      stateCode: '33',
      fyId,
      fyName: '2026-2027',
      startDate: '2026-04-01',
      endDate: '2027-03-31'
    });

    const fyRow = db.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? LIMIT 1').get(companyId) as { fy_id: string } | undefined;
    if (fyRow) {
      fyId = fyRow.fy_id;
    }

    let godown = db.prepare('SELECT godown_id FROM godowns WHERE company_id = ? LIMIT 1').get(companyId) as { godown_id: string } | undefined;
    if (godown) {
      godownId = godown.godown_id;
    } else {
      godownId = 'godown_main';
      db.prepare(`
        INSERT INTO godowns (godown_id, company_id, godown_name, is_default)
        VALUES (?, ?, 'Main Godown', 1)
      `).run(godownId, companyId);
    }

    // Customer Ledger
    db.prepare(`
      INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, is_party)
      VALUES ('ledger_cust_alpha', ?, 'Alpha Technologies', '${companyId}_grp_debtors', 1)
    `).run(companyId);

    // Customer Party
    db.prepare(`
      INSERT INTO parties (party_id, company_id, ledger_id, party_name, party_type, gstin)
      VALUES (?, ?, 'ledger_cust_alpha', 'Alpha Technologies', 'CUSTOMER', '33BBBBB1111B1Z2')
    `).run(customerId, companyId);

    // Party address
    db.prepare(`
      INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
      VALUES ('addr_cust_alpha', ?, '100 Silicon Way', 'Trichy', 'Tamil Nadu', '33', '620001')
    `).run(customerId);

    let unit = db.prepare('SELECT unit_id FROM units WHERE company_id = ? LIMIT 1').get(companyId) as { unit_id: string } | undefined;
    let unitId = unit ? unit.unit_id : 'unit_nos';
    if (!unit) {
      db.prepare(`
        INSERT INTO units (unit_id, company_id, unit_name, symbol)
        VALUES (?, ?, 'Numbers', 'NOS')
      `).run(unitId, companyId);
    }

    // Stock item: Laptop (has_serial_no = 1, warranty_months = 12)
    db.prepare(`
      INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, selling_rate_paise, purchase_rate_paise, has_serial_no, warranty_months, gst_rate)
      VALUES (?, ?, 'Dell Latitude 7420', '8471', ?, 6000000, 5000000, 1, 12, 18)
    `).run(itemId, companyId, unitId);

    // Different stock item for collision testing
    db.prepare(`
      INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, selling_rate_paise, purchase_rate_paise, has_serial_no, warranty_months, gst_rate)
      VALUES ('item_mouse', ?, 'Logitech Wireless Mouse', '8471', ?, 100000, 80000, 1, 6, 18)
    `).run(companyId, unitId);
  });

  after(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  it('1. Successfully posts Sales Invoice with brand new unbilled manual serial number', () => {
    // Unit was purchased for cash without an official purchase invoice, so stock_item_serials has NO records yet!
    const serialCountBefore = db.prepare('SELECT COUNT(*) as count FROM stock_item_serials WHERE item_id = ?').get(itemId) as { count: number };
    assert.strictEqual(serialCountBefore.count, 0, 'Initially 0 serials in stock');

    const result = PostingEngine.postVoucher(db as any, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherNumber: 'INV-2627-001',
      voucherDate: '2026-05-10',
      partyId: customerId,
      placeOfSupply: '33',
      allowNegativeStock: true,
      lines: [
        {
          itemId,
          godownId,
          quantity: 1,
          ratePaise: 6000000,
          gstRate: 18,
          serialNumber: 'DELL-LAT-99201',
          warrantyMonths: 12
        }
      ]
    });

    assert.ok(result.voucherId, 'Voucher posted successfully');
    assert.strictEqual(result.voucherNumber, 'INV-2627-001');

    // Verify stock_item_serials now has DELL-LAT-99201 with status SOLD
    const serialRecord = db.prepare(`
      SELECT * FROM stock_item_serials
      WHERE company_id = ? AND item_id = ? AND serial_number = ?
    `).get(companyId, itemId, 'DELL-LAT-99201') as any;

    assert.ok(serialRecord, 'Serial record was automatically registered in stock_item_serials');
    assert.strictEqual(serialRecord.status, 'SOLD', 'Status is SOLD');
    assert.strictEqual(serialRecord.sales_voucher_id, result.voucherId, 'Linked to sales voucher');
    assert.strictEqual(serialRecord.customer_id, customerId, 'Linked to customer');
    assert.strictEqual(serialRecord.sales_date, '2026-05-10', 'Sales date recorded');
    assert.strictEqual(serialRecord.warranty_expiry_date, '2027-05-10', 'Warranty calculated as 12 months');
  });

  it('2. Blocks attempting to re-sell the exact same serial number while it is marked SOLD', () => {
    assert.throws(() => {
      PostingEngine.postVoucher(db as any, {
        companyId,
        fyId,
        voucherType: 'SALES',
        voucherNumber: 'INV-2627-002',
        voucherDate: '2026-05-12',
        partyId: customerId,
        placeOfSupply: '33',
        allowNegativeStock: true,
        lines: [
          {
            itemId,
            godownId,
            quantity: 1,
            ratePaise: 6000000,
            gstRate: 18,
            serialNumber: 'DELL-LAT-99201', // Already SOLD in INV-2627-001!
            warrantyMonths: 12
          }
        ]
      });
    }, /already marked as SOLD/);
  });

  it('3. Blocks attempting to use a serial registered to a different stock item', () => {
    // Pre-insert a serial for item_mouse
    db.prepare(`
      INSERT INTO stock_item_serials (serial_id, company_id, item_id, godown_id, serial_number, status, created_at, updated_at)
      VALUES ('ser_mouse_01', ?, 'item_mouse', ?, 'SN-MOUSE-881', 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(companyId, godownId);

    assert.throws(() => {
      PostingEngine.postVoucher(db as any, {
        companyId,
        fyId,
        voucherType: 'SALES',
        voucherNumber: 'INV-2627-003',
        voucherDate: '2026-05-15',
        partyId: customerId,
        placeOfSupply: '33',
        allowNegativeStock: true,
        lines: [
          {
            itemId, // DELL laptop
            godownId,
            quantity: 1,
            ratePaise: 6000000,
            gstRate: 18,
            serialNumber: 'SN-MOUSE-881', // Belongs to item_mouse!
            warrantyMonths: 12
          }
        ]
      });
    }, /registered under a different item/);
  });

  it('4. Cancelling the sales voucher restores unbilled serial to AVAILABLE state', () => {
    // Cancel the original sales invoice INV-2627-001
    const vch = db.prepare("SELECT voucher_id FROM vouchers WHERE voucher_number = 'INV-2627-001'").get() as { voucher_id: string };
    assert.ok(vch);

    PostingEngine.cancelVoucher(db as any, companyId, vch.voucher_id, 'admin', 'Customer returned order', { allowNegativeStock: true });

    // Check serial record status
    const serialRecord = db.prepare(`
      SELECT * FROM stock_item_serials
      WHERE company_id = ? AND item_id = ? AND serial_number = ?
    `).get(companyId, itemId, 'DELL-LAT-99201') as any;

    assert.strictEqual(serialRecord.status, 'AVAILABLE', 'Unbilled serial transitioned to AVAILABLE upon cancellation');
    assert.strictEqual(serialRecord.sales_voucher_id, null, 'sales_voucher_id cleared');
    assert.strictEqual(serialRecord.customer_id, null, 'customer_id cleared');
  });

  it('5. Re-selling the unbilled serial once AVAILABLE succeeds smoothly', () => {
    const result = PostingEngine.postVoucher(db as any, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherNumber: 'INV-2627-004',
      voucherDate: '2026-05-20',
      partyId: customerId,
      placeOfSupply: '33',
      allowNegativeStock: true,
      lines: [
        {
          itemId,
          godownId,
          quantity: 1,
          ratePaise: 6200000,
          gstRate: 18,
          serialNumber: 'DELL-LAT-99201',
          warrantyMonths: 12
        }
      ]
    });

    assert.ok(result.voucherId);
    const serialRecord = db.prepare(`
      SELECT * FROM stock_item_serials
      WHERE company_id = ? AND item_id = ? AND serial_number = ?
    `).get(companyId, itemId, 'DELL-LAT-99201') as any;

    assert.strictEqual(serialRecord.status, 'SOLD');
    assert.strictEqual(serialRecord.sales_voucher_id, result.voucherId);
  });
});
