import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PostingEngine, CreateVoucherInput } from '../src/domain/posting/posting-engine.js';
import { initializeBusiness } from '../src/database/seed.js';

describe('UI-047: Invoice Editing & Numbering Integrity Suite', () => {
  const db = new DatabaseSync(':memory:');
  const schemaPath = path.resolve(__dirname, '../src/database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);

  const companyId = 'comp_ui047_test';
  initializeBusiness(db, {
    companyId,
    companyName: 'UI047 Test Co',
    state: 'Tamil Nadu',
    stateCode: '33',
    gstin: '33AABCT1234A1Z5'
  });

  const fy = db.prepare('SELECT * FROM financial_years WHERE company_id = ?').get(companyId) as any;
  const godown = db.prepare('SELECT * FROM godowns WHERE company_id = ?').get(companyId) as any;

  // Insert customer party
  const partyLedgerId = `${companyId}_led_cust_1`;
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, code)
    VALUES (?, ?, ?, 'Test Customer', 'CUST01')
  `).run(partyLedgerId, companyId, `${companyId}_grp_debtors`);

  const partyId = 'pty_test_customer_01';
  db.prepare(`
    INSERT INTO parties (party_id, company_id, ledger_id, party_name, party_type, gstin)
    VALUES (?, ?, ?, 'Test Customer', 'CUSTOMER', '33ABCDE1234F1Z5')
  `).run(partyId, companyId, partyLedgerId);

  // Insert unit and stock item
  const unitId = 'unit_nos_01';
  db.prepare(`
    INSERT INTO units (unit_id, company_id, unit_name, symbol)
    VALUES (?, ?, 'Numbers', 'NOS')
  `).run(unitId, companyId);

  const itemId = 'item_laptop_01';
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise)
    VALUES (?, ?, 'ThinkPad T14', '84713010', ?, 18, 5000000, 7500000, 10, 5000000)
  `).run(itemId, companyId, unitId);

  it('1. Creating a draft sales invoice assigns or retains voucher number', () => {
    const draftInput: CreateVoucherInput = {
      companyId,
      fyId: fy.fy_id,
      voucherType: 'SALES',
      voucherNumber: 'INV-2026-0042',
      voucherDate: '2026-06-15',
      partyId,
      status: 'DRAFT',
      lines: [
        {
          itemId,
          godownId: godown.godown_id,
          quantity: 1,
          ratePaise: 7500000,
          gstRate: 18,
          movementType: 'OUT'
        }
      ]
    };

    const res = PostingEngine.postVoucher(db, draftInput);
    assert.equal(res.status, 'DRAFT');
    assert.equal(res.voucherNumber, 'INV-2026-0042');

    // Verify voucher exists in DB with correct status and number
    const vch = db.prepare('SELECT * FROM vouchers WHERE voucher_id = ?').get(res.voucherId) as any;
    assert.ok(vch);
    assert.equal(vch.status, 'DRAFT');
    assert.equal(vch.voucher_number, 'INV-2026-0042');

    // Verify 0 ledger entries or stock entries for draft
    const leCount = (db.prepare('SELECT COUNT(*) as c FROM ledger_entries WHERE voucher_id = ?').get(res.voucherId) as any).c;
    assert.equal(leCount, 0);
  });

  it('2. Updating an existing draft in-place preserves voucher ID and invoice number', () => {
    const vchBefore = db.prepare("SELECT * FROM vouchers WHERE voucher_number = 'INV-2026-0042'").get() as any;
    assert.ok(vchBefore);
    const originalVoucherId = vchBefore.voucher_id;

    // Edit draft: update quantity from 1 to 2, keep voucherNumber as 'INV-2026-0042'
    const updateInput: CreateVoucherInput = {
      companyId,
      fyId: fy.fy_id,
      voucherType: 'SALES',
      voucherNumber: 'INV-2026-0042',
      voucherDate: '2026-06-16', // updated date
      partyId,
      status: 'DRAFT',
      lines: [
        {
          itemId,
          godownId: godown.godown_id,
          quantity: 2,
          ratePaise: 7500000,
          gstRate: 18,
          movementType: 'OUT'
        }
      ]
    };

    const updateRes = PostingEngine.updateDraftVoucher(db, originalVoucherId, updateInput);
    assert.equal(updateRes.voucherId, originalVoucherId, 'Voucher ID must remain unchanged');
    assert.equal(updateRes.voucherNumber, 'INV-2026-0042', 'Invoice number must remain unchanged');
    assert.equal(updateRes.status, 'DRAFT');

    // Verify DB record
    const vchAfter = db.prepare('SELECT * FROM vouchers WHERE voucher_id = ?').get(originalVoucherId) as any;
    assert.equal(vchAfter.voucher_number, 'INV-2026-0042');
    assert.equal(vchAfter.voucher_date, '2026-06-16');

    // Verify total vouchers count is still 1 (no duplicate voucher created)
    const countVouchers = (db.prepare("SELECT COUNT(*) as c FROM vouchers WHERE voucher_number = 'INV-2026-0042'").get() as any).c;
    assert.equal(countVouchers, 1, 'No duplicate voucher should exist');
  });

  it('3. Multiple successive edits do not change the voucher ID or consume new numbers', () => {
    const vch = db.prepare("SELECT * FROM vouchers WHERE voucher_number = 'INV-2026-0042'").get() as any;

    for (let i = 1; i <= 3; i++) {
      const editInput: CreateVoucherInput = {
        companyId,
        fyId: fy.fy_id,
        voucherType: 'SALES',
        voucherNumber: 'INV-2026-0042',
        voucherDate: `2026-06-1${i}`,
        partyId,
        narration: `Edit pass #${i}`,
        status: 'DRAFT',
        lines: [
          {
            itemId,
            godownId: godown.godown_id,
            quantity: i,
            ratePaise: 7500000,
            gstRate: 18,
            movementType: 'OUT'
          }
        ]
      };

      const res = PostingEngine.updateDraftVoucher(db, vch.voucher_id, editInput);
      assert.equal(res.voucherId, vch.voucher_id);
      assert.equal(res.voucherNumber, 'INV-2026-0042');
    }

    const countVouchers = (db.prepare("SELECT COUNT(*) as c FROM vouchers WHERE voucher_number = 'INV-2026-0042'").get() as any).c;
    assert.equal(countVouchers, 1);
  });

  it('4. Promoting draft to POSTED retains original number and voucher ID', () => {
    const vch = db.prepare("SELECT * FROM vouchers WHERE voucher_number = 'INV-2026-0042'").get() as any;

    const postRes = PostingEngine.postDraftVoucher(db, companyId, vch.voucher_id, 'test_user');
    assert.equal(postRes.voucherId, vch.voucher_id, 'Promoted voucher must retain existing voucher ID');
    assert.equal(postRes.voucherNumber, 'INV-2026-0042', 'Promoted voucher must retain existing invoice number');
    assert.equal(postRes.status, 'POSTED');

    // Verify DB status
    const vchPosted = db.prepare('SELECT * FROM vouchers WHERE voucher_id = ?').get(vch.voucher_id) as any;
    assert.equal(vchPosted.status, 'POSTED');
    assert.equal(vchPosted.voucher_number, 'INV-2026-0042');

    // Verify double-entry ledger entries exist now
    const leCount = (db.prepare('SELECT COUNT(*) as c FROM ledger_entries WHERE voucher_id = ?').get(vch.voucher_id) as any).c;
    assert.ok(leCount > 0, 'Posted voucher must have ledger entries');

    // Verify stock movement entry exists
    const seCount = (db.prepare('SELECT COUNT(*) as c FROM stock_entries WHERE voucher_id = ?').get(vch.voucher_id) as any).c;
    assert.ok(seCount > 0, 'Posted sales voucher must have stock entries');
  });

  it('5. Attempting to directly update a POSTED voucher as a draft is rejected', () => {
    const vch = db.prepare("SELECT * FROM vouchers WHERE voucher_number = 'INV-2026-0042'").get() as any;
    assert.equal(vch.status, 'POSTED');

    assert.throws(
      () => {
        PostingEngine.updateDraftVoucher(db, vch.voucher_id, {
          companyId,
          fyId: fy.fy_id,
          voucherType: 'SALES',
          voucherDate: '2026-06-20',
          lines: []
        });
      },
      /current status is POSTED\. Only DRAFT vouchers can be updated in-place/
    );
  });
});
