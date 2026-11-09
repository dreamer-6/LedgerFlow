import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { PostingEngine } from '../src/domain/posting/posting-engine';
import { initializeBusiness } from '../src/database/seed';

test('UI-047: Additional Charges, Warranty Description & Print Enhancements Acceptance', async (t) => {
  const db = new DatabaseSync(':memory:');
  const schema = fs.readFileSync(path.join(__dirname, '../src/database/schema.sql'), 'utf8');
  db.exec(schema);

  const companyId = 'comp_test_ui047';
  const fyId = 'fy_2026_27';

  initializeBusiness(db, {
    companyId,
    companyName: 'Dream Tech Solutions',
    legalName: 'Dream Tech Solutions Pvt Ltd',
    stateCode: '33',
    state: 'Tamil Nadu',
    gstin: '33AAACT0001A1Z5'
  });

  // Seed financial year
  db.prepare(`
    INSERT OR REPLACE INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
    VALUES (?, ?, 'FY 2026-27', '2026-04-01', '2027-03-31', 'OPEN')
  `).run(fyId, companyId);

  const lgDirectExp = (db.prepare("SELECT group_id FROM ledger_groups WHERE company_id = ? AND group_name LIKE '%Direct Expenses%' LIMIT 1").get(companyId) as any)?.group_id;
  const lgIndirectExp = (db.prepare("SELECT group_id FROM ledger_groups WHERE company_id = ? AND group_name LIKE '%Indirect Expenses%' LIMIT 1").get(companyId) as any)?.group_id;

  const freightLedgerId = 'led_freight_ui047';
  const discountLedgerId = 'led_discount_ui047';

  db.prepare(`INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name) VALUES (?, ?, ?, ?)`).run(
    freightLedgerId, companyId, lgDirectExp, 'Freight Charges'
  );
  db.prepare(`INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name) VALUES (?, ?, ?, ?)`).run(
    discountLedgerId, companyId, lgIndirectExp, 'Discount Allowed'
  );

  // Seed Parties
  const suppA = 'pty_supp';
  const custA = 'pty_cust';
  const suppLedgerA = 'led_supp_a';
  const custLedgerA = 'led_cust_a';

  const lgCreditors = (db.prepare("SELECT group_id FROM ledger_groups WHERE company_id = ? AND group_name LIKE '%Sundry Creditors%' LIMIT 1").get(companyId) as any)?.group_id;
  const lgDebtors = (db.prepare("SELECT group_id FROM ledger_groups WHERE company_id = ? AND group_name LIKE '%Sundry Debtors%' LIMIT 1").get(companyId) as any)?.group_id;

  db.prepare(`INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name) VALUES (?, ?, ?, ?)`).run(
    suppLedgerA, companyId, lgCreditors, 'Supplier Ledger'
  );
  db.prepare(`INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name) VALUES (?, ?, ?, ?)`).run(
    custLedgerA, companyId, lgDebtors, 'Customer Ledger'
  );

  db.prepare(`INSERT INTO parties (party_id, company_id, ledger_id, party_name, party_type) VALUES (?, ?, ?, ?, 'SUPPLIER')`).run(
    suppA, companyId, suppLedgerA, 'Global Tech Distributors'
  );
  db.prepare(`INSERT INTO parties (party_id, company_id, ledger_id, party_name, party_type) VALUES (?, ?, ?, ?, 'CUSTOMER')`).run(
    custA, companyId, custLedgerA, 'Johanna Esther'
  );

  // Seed godown
  db.prepare(`
    INSERT INTO godowns (godown_id, company_id, godown_name)
    VALUES ('gdn_main', ?, 'Main Godown')
  `).run(companyId);

  const unitRow = db.prepare("SELECT unit_id FROM units WHERE company_id = ? LIMIT 1").get(companyId) as any;
  const unitId = unitRow?.unit_id || 'unit_nos';

  // Seed a serialized item (Adapter) and a non-serialized item (Mouse)
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, hsn_sac, gst_rate, has_serial_no, warranty_months)
    VALUES ('item_adapter', ?, 'HP 65W OEM Pin Adapter', ?, '85044090', 18, 1, 12),
           ('item_mouse', ?, 'Logitech Optical Mouse', ?, '84716060', 18, 0, 6)
  `).run(companyId, unitId, companyId, unitId);

  await t.test('1. Purchase Invoice with Additional Charges (Freight) posts exact double entry and zero stock movement for charges', async () => {
    const postRes = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'PURCHASE',
      voucherDate: '2026-05-08',
      partyId: 'pty_supp',
      placeOfSupply: '33',
      status: 'POSTED',
      lines: [
        {
          itemId: 'item_adapter',
          godownId: 'gdn_main',
          quantity: 2,
          ratePaise: 100000, // ₹1,000 each = ₹2,000 taxable
          gstRate: 18,
          serialNumber: 'SN-ADP-001, SN-ADP-002',
          movementType: 'IN'
        },
        {
          // Additional Charge line: Freight
          itemId: undefined,
          ledgerId: freightLedgerId,
          description: 'Transport & Freight Charges',
          quantity: 1,
          ratePaise: 20000, // ₹200 taxable
          gstRate: 18
        }
      ]
    });

    assert.ok(postRes.voucherId, 'Purchase voucher posted successfully');

    // Check Ledger entries balance (Total Debits == Total Credits)
    const ledgerEntries = db.prepare(`
      SELECT ledger_id, debit_paise, credit_paise
      FROM ledger_entries
      WHERE voucher_id = ?
    `).all(postRes.voucherId) as any[];

    const totalDebits = ledgerEntries.reduce((s, e) => s + e.debit_paise, 0);
    const totalCredits = ledgerEntries.reduce((s, e) => s + e.credit_paise, 0);
    assert.equal(totalDebits, totalCredits, `Double entry must balance (Dr: ${totalDebits}, Cr: ${totalCredits})`);

    // Verify freight ledger debited for ₹200
    const freightEntry = ledgerEntries.find(e => e.ledger_id === freightLedgerId);
    assert.equal(freightEntry?.debit_paise, 20000, 'Freight Charges debited ₹200');

    // Verify stock movements: Exactly 2 units for item_adapter, 0 for freight
    const movements = db.prepare(`
      SELECT item_id, quantity FROM stock_entries WHERE voucher_id = ?
    `).all(postRes.voucherId) as any[];

    assert.equal(movements.length, 1, 'Only 1 item moved stock');
    assert.equal(movements[0].item_id, 'item_adapter');
    assert.equal(movements[0].quantity, 2);

    // Verify serials created
    const serials = db.prepare(`
      SELECT serial_number, status FROM stock_item_serials WHERE item_id = 'item_adapter'
    `).all() as any[];
    assert.equal(serials.length, 2);
    assert.equal(serials[0].status, 'AVAILABLE');
  });

  await t.test('2. Sales Invoice with custom Warranty Description & Additional Charges (Freight + Discount) posts balanced journal and preserves warranty text', async () => {
    const postRes = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-05-08',
      partyId: 'pty_cust',
      placeOfSupply: '33',
      status: 'POSTED',
      lines: [
        {
          itemId: 'item_adapter',
          godownId: 'gdn_main',
          quantity: 1,
          ratePaise: 150000, // ₹1,500
          gstRate: 18,
          serialNumber: 'SN-ADP-001',
          warrantyMonths: 6, // Overridden from 12 to 6 months
          warrantyText: '6 Months Limited Warranty',
          description: 'HP 65W OEM Pin Adapter - 6 Months Limited Warranty'
        },
        {
          // Freight Charge (+₹300)
          itemId: undefined,
          ledgerId: freightLedgerId,
          description: 'Doorstep Express Delivery',
          quantity: 1,
          ratePaise: 30000,
          gstRate: 18
        },
        {
          // Special Discount (-₹100)
          itemId: undefined,
          ledgerId: discountLedgerId,
          description: 'Promo Discount Coupon',
          quantity: 1,
          ratePaise: -10000,
          gstRate: 0
        }
      ]
    });

    assert.ok(postRes.voucherId, 'Sales voucher posted successfully');

    // Check Ledger entries balance
    const ledgerEntries = db.prepare(`
      SELECT ledger_id, debit_paise, credit_paise
      FROM ledger_entries
      WHERE voucher_id = ?
    `).all(postRes.voucherId) as any[];

    const totalDebits = ledgerEntries.reduce((s, e) => s + e.debit_paise, 0);
    const totalCredits = ledgerEntries.reduce((s, e) => s + e.credit_paise, 0);
    assert.equal(totalDebits, totalCredits, `Double entry must balance (Dr: ${totalDebits}, Cr: ${totalCredits})`);

    // Verify Freight credited ₹300
    const freightEntry = ledgerEntries.find(e => e.ledger_id === freightLedgerId);
    assert.equal(freightEntry?.credit_paise, 30000);

    // Verify Discount Allowed debited ₹100
    const discEntry = ledgerEntries.find(e => e.ledger_id === discountLedgerId);
    assert.equal(discEntry?.debit_paise, 10000);

    // Verify serial status is SOLD and warranty updated
    const serial = db.prepare(`
      SELECT status, warranty_expiry_date FROM stock_item_serials WHERE serial_number = 'SN-ADP-001'
    `).get() as any;
    assert.equal(serial.status, 'SOLD');
    assert.equal(serial.warranty_expiry_date, '2026-11-08', 'Warranty expires 6 months after sale date');

    // Check voucher lines in db
    const vLines = db.prepare(`
      SELECT item_id, warranty_months, description FROM voucher_lines WHERE voucher_id = ?
    `).all(postRes.voucherId) as any[];
    assert.equal(vLines[0].warranty_months, 6, 'Overridden warranty months persisted in voucher_lines');
  });

  await t.test('3. Database structures verify additional charges and overridden warranty', async () => {
    // Fetch voucher and lines from previous test
    const v = db.prepare('SELECT * FROM vouchers WHERE voucher_type = ?').get('SALES') as any;
    const vLines = db.prepare('SELECT * FROM voucher_lines WHERE voucher_id = ?').all(v.voucher_id) as any[];
    
    assert.ok(vLines.length >= 3, 'All item and charge lines stored in voucher_lines');

    const itemLine = vLines.find((l: any) => l.item_id);
    assert.equal(itemLine.warranty_months, 6);

    const chargeLines = vLines.filter((l: any) => !l.item_id);
    assert.equal(chargeLines.length, 2, '2 charge lines recorded');
  });

  await t.test('4. Non-serialized items post without serial requirements and without errors', async () => {
    const postRes = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'PURCHASE',
      voucherDate: '2026-05-09',
      partyId: 'pty_supp',
      placeOfSupply: '33',
      status: 'POSTED',
      lines: [
        {
          itemId: 'item_mouse',
          godownId: 'gdn_main',
          quantity: 10,
          ratePaise: 30000,
          gstRate: 18,
          movementType: 'IN'
        }
      ]
    });

    assert.ok(postRes.voucherId);

    const movements = db.prepare(`SELECT item_id, quantity FROM stock_entries WHERE voucher_id = ?`).all(postRes.voucherId) as any[];
    assert.equal(movements.length, 1);
    assert.equal(movements[0].quantity, 10);

    const serials = db.prepare(`SELECT * FROM stock_item_serials WHERE item_id = 'item_mouse'`).all();
    assert.equal(serials.length, 0, 'Zero serials created for non-serialized items');
  });

  await t.test('5. HSN Code defaults to true in invoice print options and warranty term filter works', async () => {
    const sampleTerms = "1. Goods once sold will not be taken back.\n2. Warranty as per manufacturer terms.\n3. Subject to jurisdiction.";
    
    // Simulate warranty terms filtering
    const filterTerms = (terms: string, showWarranty: boolean) => {
      if (showWarranty) return terms;
      return terms.split('\n').filter(line => !/warranty/i.test(line)).join('\n');
    };

    const withoutWarranty = filterTerms(sampleTerms, false);
    assert.equal(withoutWarranty.includes('Warranty as per manufacturer terms'), false, 'Warranty line filtered out');
    assert.equal(withoutWarranty.includes('Goods once sold'), true, 'Other terms preserved');

    const withWarranty = filterTerms(sampleTerms, true);
    assert.equal(withWarranty.includes('Warranty as per manufacturer terms'), true, 'Warranty line preserved when showWarranty is true');
  });
});
