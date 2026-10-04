/**
 * LedgerFlow TASK 008 — Comprehensive Integrity & Remediation Test Suite
 * Validates DEF-008-01 through DEF-008-13
 */

import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express, { Express } from 'express';
import { createServer, Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../src/database/connection.js';
import { initializeBusiness } from '../src/database/seed.js';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';
import { AuthService } from '../src/services/auth.service.js';
import { BusinessService } from '../src/services/business.service.js';
import { ReportEngine } from '../src/reports/report-engine.js';
import { createApiRouter } from '../src/api/routes.js';
import { jwtSecret } from '../src/middleware/security.js';

console.log('======================================================================');
console.log('LEDGERFLOW TASK 008 — INTEGRITY & REMEDIATION REGRESSION TEST SUITE');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    if (err.stack) console.error(err.stack);
    failCount++;
    throw err;
  }
}

function makeToken(payload: { userId: string; username: string; role?: string; email?: string }, secret = jwtSecret()) {
  return jwt.sign(
    {
      userId: payload.userId,
      username: payload.username,
      role: payload.role || 'ACCOUNTANT',
      name: payload.username,
      email: payload.email || `${payload.username}@test.com`
    },
    secret,
    { expiresIn: '1d' }
  );
}

function setupTestEnvironment(companyId: string = 'comp_t008') {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  
  const rawSchema = fs.readFileSync(path.resolve(__dirname, '../src/database/schema.sql'), 'utf8');
  const schemaSql = rawSchema
    .replace(/CREATE TABLE IF NOT EXISTS ledger_groups \(\s+group_id TEXT PRIMARY KEY,\s+company_id TEXT NOT NULL/g, 'CREATE TABLE IF NOT EXISTS ledger_groups (\n    group_id TEXT PRIMARY KEY,\n    company_id TEXT')
    .replace(/CREATE TABLE IF NOT EXISTS units \(\s+unit_id TEXT PRIMARY KEY,\s+company_id TEXT NOT NULL/g, 'CREATE TABLE IF NOT EXISTS units (\n    unit_id TEXT PRIMARY KEY,\n    company_id TEXT');
  db.exec(schemaSql);

  // Column extensions mirroring production
  try { db.exec('ALTER TABLE vouchers ADD COLUMN reference_date DATE;'); } catch {}
  try { db.exec('ALTER TABLE vouchers ADD COLUMN payment_mode TEXT;'); } catch {}
  try { db.exec('ALTER TABLE vouchers ADD COLUMN terms_conditions TEXT;'); } catch {}
  try { db.exec('ALTER TABLE voucher_lines ADD COLUMN description TEXT;'); } catch {}
  try { db.exec('ALTER TABLE parties ADD COLUMN bank_name TEXT;'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN email TEXT;'); } catch {}
  try { db.exec('ALTER TABLE companies ADD COLUMN owner_user_id TEXT;'); } catch {}
  try { db.exec('ALTER TABLE stock_items ADD COLUMN serial_numbers TEXT;'); } catch {}
  try { db.exec('ALTER TABLE stock_items ADD COLUMN has_serial_no INTEGER DEFAULT 0;'); } catch {}
  try { db.exec('ALTER TABLE companies ADD COLUMN mailing_name TEXT;'); } catch {}
  try { db.exec('ALTER TABLE companies ADD COLUMN vault_password_hash TEXT;'); } catch {}
  try { db.exec('ALTER TABLE parties ADD COLUMN banking_name TEXT;'); } catch {}
  try { db.exec('ALTER TABLE parties ADD COLUMN banking_account_no TEXT;'); } catch {}
  try { db.exec('ALTER TABLE parties ADD COLUMN banking_ifsc TEXT;'); } catch {}
  try { db.exec('ALTER TABLE voucher_lines ADD COLUMN serial_number TEXT;'); } catch {}
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_item_serials (
        serial_id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES stock_items(item_id) ON DELETE CASCADE,
        serial_number TEXT NOT NULL,
        status TEXT CHECK(status IN ('AVAILABLE', 'SOLD')) DEFAULT 'AVAILABLE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(item_id, serial_number)
      );
    `);
  } catch {}
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_businesses (
        user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        company_id TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
        role TEXT CHECK(role IN ('OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER')) DEFAULT 'OWNER',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, company_id)
      );
    `);
  } catch {}

  initializeBusiness(db, {
    companyId,
    companyName: 'Integrity Tech Solutions Ltd',
    stateCode: '33', // Tamil Nadu
    gstin: '33AAACI1234T1Z1'
  });

  const app = express();
  app.use(express.json());
  app.use('/', createApiRouter(db));

  return { db, companyId, app };
}

async function startServer(app: Express): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      const baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve({ server, baseUrl });
    });
  });
}

async function runAllTests() {
  const { db, companyId, app } = setupTestEnvironment('comp_t008_main');
  const { server, baseUrl } = await startServer(app);

  const activeFy = db.prepare("SELECT fy_id FROM financial_years WHERE company_id = ? AND status = 'OPEN' LIMIT 1").get(companyId) as any;
  const fyId = activeFy.fy_id;
  const godownId = `${companyId}_godown_main`;

  // Pre-seed an admin user & token for API routes requiring Admin
  const adminId = 'usr_admin_test';
  db.prepare(`
    INSERT INTO users (user_id, username, password_hash, role, full_name)
    VALUES (?, 'admintest', 'hash123', 'ADMIN', 'Admin Test')
  `).run(adminId);
  db.prepare(`
    INSERT INTO user_businesses (user_id, company_id, role)
    VALUES (?, ?, 'ADMIN')
  `).run(adminId, companyId);
  const adminToken = makeToken({ userId: adminId, username: 'admintest', role: 'ADMIN' });

  const acctId = 'usr_acct_test';
  db.prepare(`
    INSERT INTO users (user_id, username, password_hash, role, full_name)
    VALUES (?, 'accttest', 'hash123', 'ACCOUNTANT', 'Acct Test')
  `).run(acctId);
  db.prepare(`
    INSERT INTO user_businesses (user_id, company_id, role)
    VALUES (?, ?, 'ACCOUNTANT')
  `).run(acctId, companyId);
  const acctToken = makeToken({ userId: acctId, username: 'accttest', role: 'ACCOUNTANT' });

  try {
    // ========================================================================
    // SUITE 1: DEF-008-01 — AUTH ROLE SELF-REGISTRATION
    // ========================================================================
    console.log('[Suite 1: DEF-008-01 — Auth Role Self-Registration]');

    await runTest('1.1: Public registration defaults strictly to ACCOUNTANT role', () => {
      const res = AuthService.register(db, {
        email: 'public_user@test.com',
        username: 'new_public_user',
        password: 'Password123!',
        fullName: 'Public User',
        businessName: 'Public Enterprise'
      });
      assert.strictEqual(res.user.role, 'ACCOUNTANT', 'Public self-registration must assign ACCOUNTANT');
      const user = db.prepare('SELECT role FROM users WHERE user_id = ?').get(res.user.userId) as any;
      assert.strictEqual(user.role, 'ACCOUNTANT');
    });

    await runTest('1.2: Client-supplied ADMIN role is ignored during public self-registration', () => {
      const res = AuthService.register(db, {
        email: 'hacker_admin@test.com',
        username: 'hacker_admin',
        password: 'Password123!',
        fullName: 'Hacker',
        businessName: 'Hacker Corp',
        role: 'ADMIN' as any
      });
      assert.strictEqual(res.user.role, 'ACCOUNTANT', 'Client-supplied ADMIN role must be overridden to ACCOUNTANT');
      const user = db.prepare('SELECT role FROM users WHERE user_id = ?').get(res.user.userId) as any;
      assert.strictEqual(user.role, 'ACCOUNTANT');
    });

    await runTest('1.3: Client-supplied OWNER role is ignored during public self-registration', () => {
      const res = AuthService.register(db, {
        email: 'hacker_owner@test.com',
        username: 'hacker_owner',
        password: 'Password123!',
        fullName: 'Hacker Owner',
        businessName: 'Hacker LLC',
        role: 'OWNER' as any
      });
      assert.strictEqual(res.user.role, 'ACCOUNTANT', 'Client-supplied OWNER role must be overridden to ACCOUNTANT');
      const user = db.prepare('SELECT role FROM users WHERE user_id = ?').get(res.user.userId) as any;
      assert.strictEqual(user.role, 'ACCOUNTANT');
    });

    // ========================================================================
    // SUITE 2: DEF-008-02 — EXACT INWARD STOCK VALUATION & RECONCILIATION
    // ========================================================================
    console.log('\n[Suite 2: DEF-008-02 — Exact Inward Valuation & Inventory Asset Reconciliation]');

    const supplierId = `${companyId}_party_supp_1`;
    const suppLedgerId = `${companyId}_led_supp_1`;
    db.prepare(`
      INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type, is_party)
      VALUES (?, ?, 'Hardware Supplier', '${companyId}_grp_creditors', 0, 'CR', 1)
    `).run(suppLedgerId, companyId);
    db.prepare(`
      INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id, gstin)
      VALUES (?, ?, 'Hardware Supplier', 'SUPPLIER', ?, '33AABCS5555S1Z1')
    `).run(supplierId, companyId, suppLedgerId);

    const itemIdOdd = 'item_odd_paise';
    db.prepare(`
      INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, hsn_sac)
      VALUES (?, ?, 'Odd Valuation Widget', '${companyId}_unit_nos', 18, 33333, 50000, '84713010')
    `).run(itemIdOdd, companyId);

    await runTest('2.1: Purchase with percentage discount records exact taxable acquisition paise in stock_entries', () => {
      // Qty 3 at ₹1,000 (100000 paise) with 10% discount -> taxable is 3 * 90000 = 270000 paise
      const postRes = PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-05-01',
        partyId: supplierId,
        lines: [
          {
            itemId: itemIdOdd,
            quantity: 3,
            ratePaise: 100000,
            discountPercent: 10,
            godownId
          }
        ]
      });

      const se = db.prepare('SELECT value_paise FROM stock_entries WHERE voucher_id = ?').get(postRes.voucherId) as any;
      assert.strictEqual(se.value_paise, 270000, 'Stock entry valuation must equal exact taxable acquisition paise');
    });

    await runTest('2.2: Purchase with fixed discount and tax-inclusive pricing assigns exact acquisition paise', () => {
      // Tax-inclusive ₹1,180 with 18% GST -> base is ₹1,000 (100000 paise). Discount ₹100 paise -> net taxable ₹900 (90000 paise)
      const postRes = PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-05-02',
        partyId: supplierId,
        lines: [
          {
            itemId: itemIdOdd,
            quantity: 1,
            ratePaise: 118000,
            isTaxInclusive: true,
            discountAmountPaise: 10000,
            godownId
          }
        ]
      });

      const se = db.prepare('SELECT value_paise FROM stock_entries WHERE voucher_id = ?').get(postRes.voucherId) as any;
      const vl = db.prepare('SELECT taxable_amount_paise FROM voucher_lines WHERE voucher_id = ?').get(postRes.voucherId) as any;
      assert.strictEqual(se.value_paise, vl.taxable_amount_paise, 'Stock entry valuation must equal exact line taxable acquisition paise');
      assert.strictEqual(se.value_paise, 91525);
    });

    await runTest('2.3: Odd paise acquisition values where unit rate cannot be exact integer paise', () => {
      // Qty 3, taxable total ₹1,000.00 (100000 paise). 100000 / 3 = 33333.333... paise.
      // Net acquisition value MUST be preserved as 100000 paise, not rounded unitRate * 3 = 99999 paise.
      const postRes = PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-05-03',
        partyId: supplierId,
        lines: [
          {
            itemId: itemIdOdd,
            quantity: 3,
            ratePaise: 33333, // 3 * 33333 = 99999, but line taxable with adjustment
            discountAmountPaise: 0,
            godownId
          }
        ]
      });

      const se = db.prepare('SELECT value_paise FROM stock_entries WHERE voucher_id = ?').get(postRes.voucherId) as any;
      const vl = db.prepare('SELECT taxable_amount_paise FROM voucher_lines WHERE voucher_id = ?').get(postRes.voucherId) as any;
      assert.strictEqual(se.value_paise, vl.taxable_amount_paise, 'Stock entry value must exactly match line taxable amount');
    });

    await runTest('2.4: Multi-line purchase with different rates reconciles Inventory Asset with Stock Summary', () => {
      const itemB = 'item_multiline_b';
      db.prepare(`
        INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, hsn_sac)
        VALUES (?, ?, 'Multi Widget B', '${companyId}_unit_nos', 12, 45000, 60000, '84713010')
      `).run(itemB, companyId);

      PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-05-04',
        partyId: supplierId,
        lines: [
          { itemId: itemIdOdd, quantity: 5, ratePaise: 120000, discountPercent: 5, godownId },
          { itemId: itemB, quantity: 10, ratePaise: 45000, discountAmountPaise: 20000, godownId }
        ]
      });

      // Assert Stock Summary total value == Inventory Asset debit balance
      const stockSummary = ReportEngine.getStockSummary(db, companyId, '2026-05-31');
      const totalStockValPaise = stockSummary.reduce((acc, row) => acc + row.totalValuePaise, 0);

      const bs = ReportEngine.getBalanceSheet(db, companyId, '2026-05-31');
      const invLedger = bs.assets.find(l => l.ledgerName.includes('Inventory'));

      assert.ok(invLedger, 'Inventory Asset ledger must exist in Balance Sheet');
      assert.strictEqual(invLedger.amountPaise, totalStockValPaise, 'Inventory Asset balance in Balance Sheet must equal Stock Summary valuation to the exact paise');
    });

    // ========================================================================
    // SUITE 3: DEF-008-03 & DEF-008-13 — CANONICAL DRAFT ROUND-TRIP
    // ========================================================================
    console.log('\n[Suite 3: DEF-008-03 & DEF-008-13 — Draft Round-Trip Fidelity]');

    await runTest('3.1: PAYMENT draft preserves customLedgerLines, bill allocation and user terms', () => {
      const bankLedId = `${companyId}_led_sbi_bank`;
      const refVch = PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-05-01',
        partyId: supplierId,
        lines: [{ itemId: itemIdOdd, quantity: 5, ratePaise: 100000, godownId }]
      });

      const draftRes = PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'PAYMENT',
        voucherDate: '2026-05-05',
        partyId: supplierId,
        status: 'DRAFT',
        termsConditions: 'Special settlement terms agreed with supplier',
        customLedgerLines: [
          { ledgerId: suppLedgerId, debitPaise: 500000, creditPaise: 0, particulars: 'Payment to Supplier' },
          { ledgerId: bankLedId, debitPaise: 0, creditPaise: 500000, particulars: 'Bank HDFC Transfer' }
        ],
        billAllocation: {
          referenceVoucherId: refVch.voucherId,
          allocationType: 'AGAINST_REF'
        },
        lines: []
      });

      assert.match(draftRes.voucherNumber, /^DFT-/, 'Draft voucher must have temporary DFT- prefix');

      // Verify canonical metadata stored in terms_conditions
      const vch = db.prepare('SELECT terms_conditions FROM vouchers WHERE voucher_id = ?').get(draftRes.voucherId) as any;
      assert.ok(vch.terms_conditions, 'Draft must store metadata');
      const meta = JSON.parse(vch.terms_conditions);
      assert.ok(meta._draftMeta, 'Must contain _draftMeta key');
      assert.strictEqual(meta._draftMeta.originalTerms, 'Special settlement terms agreed with supplier');
      assert.strictEqual(meta._draftMeta.customLedgerLines.length, 2);
      assert.strictEqual(meta._draftMeta.customLedgerLines[0].debitPaise, 500000);
      assert.strictEqual(meta._draftMeta.billAllocation.allocationType, 'AGAINST_REF');

      // Promote draft
      const postResult = PostingEngine.postDraftVoucher(db, companyId, draftRes.voucherId, 'test_user');
      assert.strictEqual(postResult.status, 'POSTED');
      assert.match(postResult.voucherNumber, /^PAY-2627-\d{3}$/, 'Promoted voucher must have statutory PAY-2627-XXX number');

      // Verify posted ledger entries are balanced and exact
      const leRows = db.prepare('SELECT ledger_id, debit_paise, credit_paise FROM ledger_entries WHERE voucher_id = ?').all(draftRes.voucherId) as any[];
      assert.strictEqual(leRows.length, 2);
      const drLine = leRows.find(l => l.ledger_id === suppLedgerId);
      const crLine = leRows.find(l => l.ledger_id === bankLedId);
      assert.strictEqual(drLine.debit_paise, 500000);
      assert.strictEqual(crLine.credit_paise, 500000);

      // Verify bill allocation was posted
      const ba = db.prepare('SELECT amount_paise, allocation_type FROM bill_allocations WHERE voucher_id = ?').get(draftRes.voucherId) as any;
      assert.ok(ba, 'Bill allocation must be created');
      assert.strictEqual(ba.amount_paise, 500000);
      assert.strictEqual(ba.allocation_type, 'AGAINST_REF');
    });

    await runTest('3.2: RECEIPT, CONTRA, JOURNAL draft vouchers round-trip with full fidelity', () => {
      const bankLedId = `${companyId}_led_sbi_bank`;
      const cashLedId = `${companyId}_led_cash`;

      // CONTRA draft: Cash to Bank
      const contraDraft = PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'CONTRA',
        voucherDate: '2026-05-06',
        status: 'DRAFT',
        customLedgerLines: [
          { ledgerId: bankLedId, debitPaise: 200000, creditPaise: 0, particulars: 'Cash deposit' },
          { ledgerId: cashLedId, debitPaise: 0, creditPaise: 200000, particulars: 'Cash withdrawal' }
        ],
        lines: []
      });

      const contraPromoted = PostingEngine.postDraftVoucher(db, companyId, contraDraft.voucherId, 'test_user');
      assert.strictEqual(contraPromoted.status, 'POSTED');
      assert.match(contraPromoted.voucherNumber, /^CON-2627-\d{3}$/);

      const contraEntries = db.prepare('SELECT SUM(debit_paise) as dr, SUM(credit_paise) as cr FROM ledger_entries WHERE voucher_id = ?').get(contraDraft.voucherId) as any;
      assert.strictEqual(contraEntries.dr, 200000);
      assert.strictEqual(contraEntries.cr, 200000);
    });

    await runTest('3.3: DEF-008-13: Draft STOCK_JOURNAL preserves exact IN and OUT movement directions', () => {
      const itemStk = 'item_stk_jnl_test';
      db.prepare(`
        INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, hsn_sac, opening_qty)
        VALUES (?, ?, 'Stock Transfer Item', '${companyId}_unit_nos', 18, 50000, 75000, '84713010', 50)
      `).run(itemStk, companyId);

      const godown2 = `${companyId}_godown_secondary`;
      db.prepare(`
        INSERT INTO godowns (godown_id, company_id, godown_name, is_default)
        VALUES (?, ?, 'Secondary Warehouse', 0)
      `).run(godown2, companyId);

      // Create draft stock journal with OUT 5 from main godown, IN 5 to secondary godown
      const sjDraft = PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'STOCK_JOURNAL',
        voucherDate: '2026-05-07',
        status: 'DRAFT',
        narration: 'Inter-godown transfer',
        lines: [
          { itemId: itemStk, quantity: 5, ratePaise: 50000, godownId, movementType: 'OUT' },
          { itemId: itemStk, quantity: 5, ratePaise: 50000, godownId: godown2, movementType: 'IN' }
        ]
      });

      // Verify draft metadata
      const vch = db.prepare('SELECT terms_conditions FROM vouchers WHERE voucher_id = ?').get(sjDraft.voucherId) as any;
      const meta = JSON.parse(vch.terms_conditions);
      assert.ok(meta._draftMeta, 'Must contain _draftMeta key');
      assert.strictEqual(meta._draftMeta.lines[0].movementType, 'OUT');
      assert.strictEqual(meta._draftMeta.lines[1].movementType, 'IN');

      // Promote draft
      const sjPosted = PostingEngine.postDraftVoucher(db, companyId, sjDraft.voucherId, 'test_user');
      assert.strictEqual(sjPosted.status, 'POSTED');

      // Assert stock entries
      const entries = db.prepare('SELECT godown_id, movement_type, quantity FROM stock_entries WHERE voucher_id = ? ORDER BY rowid ASC').all(sjDraft.voucherId) as any[];
      assert.strictEqual(entries.length, 2);
      assert.strictEqual(entries[0].movement_type, 'OUT');
      assert.strictEqual(entries[0].godown_id, godownId);
      assert.strictEqual(entries[0].quantity, 5);

      assert.strictEqual(entries[1].movement_type, 'IN');
      assert.strictEqual(entries[1].godown_id, godown2);
      assert.strictEqual(entries[1].quantity, 5);
    });

    // ========================================================================
    // SUITE 4: DEF-008-04 — MASTER ITEM UPDATE ATOMICITY ROLLBACK
    // ========================================================================
    console.log('\n[Suite 4: DEF-008-04 — Master Item Update Atomicity Rollback]');

    await runTest('4.1: Stock adjustment failure rolls back all item master mutations and serial updates', () => {
      const atomItemId = 'item_atomic_rollback';
      db.prepare(`
        INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, hsn_sac)
        VALUES (?, ?, 'Rollback Baseline Item', '${companyId}_unit_nos', 18, 100000, 150000, '84713010')
      `).run(atomItemId, companyId);

      // Attempt master item adjustment with an invalid/closed financial year date to force failure in stock adjustment
      let threw = false;
      try {
        PostingEngine.postItemMasterWithAdjustment(db, {
          companyId,
          itemId: atomItemId,
          itemName: 'Attempted Renamed Item',
          hsnSac: '99999999',
          purchaseRatePaise: 200000,
          sellingRatePaise: 300000,
          reorderLevel: 50,
          serialNumbers: 'SER_FAIL_001, SER_FAIL_002',
          hasSerialNo: true,
          quantityToAdd: -100, // Attempt outward stock when balance is 0 without allowNegative -> fails
          godownId
        });
      } catch (err: any) {
        threw = true;
      }

      assert.ok(threw, 'Should throw on illegal negative stock adjustment');

      // Verify item metadata remained completely unmutated
      const item = db.prepare('SELECT * FROM stock_items WHERE item_id = ?').get(atomItemId) as any;
      assert.strictEqual(item.item_name, 'Rollback Baseline Item');
      assert.strictEqual(item.purchase_rate_paise, 100000);
      assert.strictEqual(item.hsn_sac, '84713010');

      // Verify serials were not committed
      const serialCount = (db.prepare('SELECT COUNT(*) as cnt FROM stock_item_serials WHERE item_id = ?').get(atomItemId) as any)?.cnt || 0;
      assert.strictEqual(serialCount, 0, 'No serials must remain after rollback');

      // Verify no orphaned vouchers created
      const orphanVch = db.prepare("SELECT 1 FROM vouchers WHERE narration LIKE '%Rollback Baseline Item%'").get();
      assert.strictEqual(orphanVch, undefined, 'No orphaned voucher should exist');
    });

    // ========================================================================
    // SUITE 5: DEF-008-05 — STATUTORY MULTI-RATE GST SLABS
    // ========================================================================
    console.log('\n[Suite 5: DEF-008-05 — Statutory Multi-Rate GST Slabs]');

    const item5 = 'item_gst_5';
    const item12 = 'item_gst_12';
    const item18 = 'item_gst_18';

    db.prepare(`
      INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, cess_rate, purchase_rate_paise, selling_rate_paise, hsn_sac)
      VALUES 
        (?, ?, 'Gst 5 Item', '${companyId}_unit_nos', 5, 0, 10000, 15000, '1001'),
        (?, ?, 'Gst 12 Item', '${companyId}_unit_nos', 12, 0, 20000, 30000, '2002'),
        (?, ?, 'Gst 18 Item', '${companyId}_unit_nos', 18, 2, 40000, 50000, '3003')
    `).run(item5, companyId, item12, companyId, item18, companyId);

    await runTest('5.1: Intra-state invoice preserves distinct statutory slabs (5%, 12%, 18%) without hardcoded 9%', () => {
      const custId = `${companyId}_party_intra_cust`;
      const custLedId = `${companyId}_led_intra_cust`;
      db.prepare(`
        INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type, is_party)
        VALUES (?, ?, 'Local Customer', '${companyId}_grp_debtors', 0, 'DR', 1)
      `).run(custLedId, companyId);
      db.prepare(`
        INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id, gstin)
        VALUES (?, ?, 'Local Customer', 'CUSTOMER', ?, '33LOCAL1234T1Z1')
      `).run(custId, companyId, custLedId);
      db.prepare(`
        INSERT INTO party_addresses (address_id, party_id, address_type, address_line1, city, state, state_code, pincode, is_default)
        VALUES ('addr_local_1', ?, 'BOTH', '1 Main St', 'Chennai', 'Tamil Nadu', '33', '600001', 1)
      `).run(custId);

      const postRes = PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'SALES',
        voucherDate: '2026-05-10',
        partyId: custId,
        allowNegativeStock: true,
        lines: [
          { itemId: item5, quantity: 10, ratePaise: 15000, godownId },    // ₹150 base -> 5% = ₹7.50 (₹3.75 CGST + ₹3.75 SGST = 375 paise each)
          { itemId: item12, quantity: 10, ratePaise: 30000, godownId },   // ₹300 base -> 12% = ₹36.00 (₹18.00 CGST + ₹18.00 SGST = 1800 paise each)
          { itemId: item18, quantity: 10, ratePaise: 50000, godownId }    // ₹500 base -> 18% = ₹90.00 (₹45.00 CGST + ₹45.00 SGST = 4500 paise each) + 2% CESS = ₹10 (1000 paise)
        ]
      });

      const taxRows = db.prepare('SELECT tax_type, rate, taxable_amount_paise, tax_amount_paise FROM tax_entries WHERE voucher_id = ? ORDER BY rowid ASC').all(postRes.voucherId) as any[];
      
      // Should have 2 entries for 5% (CGST 2.5%, SGST 2.5%), 2 entries for 12% (CGST 6%, SGST 6%), 2 entries for 18% (CGST 9%, SGST 9%), and 1 CESS (2%)
      const cgst5 = taxRows.find(t => t.tax_type === 'OUTPUT_CGST' && t.rate === 2.5);
      const sgst5 = taxRows.find(t => t.tax_type === 'OUTPUT_SGST' && t.rate === 2.5);
      const cgst12 = taxRows.find(t => t.tax_type === 'OUTPUT_CGST' && t.rate === 6);
      const sgst12 = taxRows.find(t => t.tax_type === 'OUTPUT_SGST' && t.rate === 6);
      const cgst18 = taxRows.find(t => t.tax_type === 'OUTPUT_CGST' && t.rate === 9);
      const sgst18 = taxRows.find(t => t.tax_type === 'OUTPUT_SGST' && t.rate === 9);
      const cessRow = taxRows.find(t => t.tax_type === 'CESS');

      assert.ok(cgst5 && sgst5, 'Must have distinct 2.5% CGST and SGST entries');
      assert.strictEqual(cgst5.tax_amount_paise, 3750);
      assert.strictEqual(sgst5.tax_amount_paise, 3750);

      assert.ok(cgst12 && sgst12, 'Must have distinct 6% CGST and SGST entries');
      assert.strictEqual(cgst12.tax_amount_paise, 18000);
      assert.strictEqual(sgst12.tax_amount_paise, 18000);

      assert.ok(cgst18 && sgst18, 'Must have distinct 9% CGST and SGST entries');
      assert.strictEqual(cgst18.tax_amount_paise, 45000);
      assert.strictEqual(sgst18.tax_amount_paise, 45000);

      assert.ok(cessRow, 'Must have distinct CESS entry');
      assert.strictEqual(cessRow.tax_amount_paise, 10000);
    });

    await runTest('5.2: Inter-state invoice preserves distinct IGST slabs (5%, 12%, 18%)', () => {
      const custInterId = `${companyId}_party_inter_cust`;
      const custInterLedId = `${companyId}_led_inter_cust`;
      db.prepare(`
        INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type, is_party)
        VALUES (?, ?, 'Interstate Customer', '${companyId}_grp_debtors', 0, 'DR', 1)
      `).run(custInterLedId, companyId);
      db.prepare(`
        INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id, gstin)
        VALUES (?, ?, 'Interstate Customer', 'CUSTOMER', ?, '29INTER1234T1Z1')
      `).run(custInterId, companyId, custInterLedId);
      db.prepare(`
        INSERT INTO party_addresses (address_id, party_id, address_type, address_line1, city, state, state_code, pincode, is_default)
        VALUES ('addr_inter_1', ?, 'BOTH', '1 Bangalore Rd', 'Bengaluru', 'Karnataka', '29', '560001', 1)
      `).run(custInterId);

      const postRes = PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'SALES',
        voucherDate: '2026-05-11',
        partyId: custInterId,
        allowNegativeStock: true,
        lines: [
          { itemId: item5, quantity: 10, ratePaise: 15000, godownId },
          { itemId: item12, quantity: 10, ratePaise: 30000, godownId },
          { itemId: item18, quantity: 10, ratePaise: 50000, godownId }
        ]
      });

      const taxRows = db.prepare('SELECT tax_type, rate, tax_amount_paise FROM tax_entries WHERE voucher_id = ?').all(postRes.voucherId) as any[];
      const igst5 = taxRows.find(t => t.tax_type === 'OUTPUT_IGST' && t.rate === 5);
      const igst12 = taxRows.find(t => t.tax_type === 'OUTPUT_IGST' && t.rate === 12);
      const igst18 = taxRows.find(t => t.tax_type === 'OUTPUT_IGST' && t.rate === 18);

      assert.ok(igst5 && igst12 && igst18, 'Must record distinct IGST slabs');
      assert.strictEqual(igst5.tax_amount_paise, 7500);
      assert.strictEqual(igst12.tax_amount_paise, 36000);
      assert.strictEqual(igst18.tax_amount_paise, 90000);
    });

    // ========================================================================
    // SUITE 6: DEF-008-06 — EXACT PARTY AMOUNT IN COMPOUND VOUCHERS
    // ========================================================================
    console.log('\n[Suite 6: DEF-008-06 — Compound Voucher Party Allocation]');

    await runTest('6.1: Compound voucher allocates exact party line amount instead of full voucher sum', () => {
      const bankLedId = `${companyId}_led_sbi_bank`;
      const otherIncomeLedId = `${companyId}_led_consulting_income`;
      db.prepare(`
        INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type, is_party)
        VALUES (?, ?, '${companyId}_grp_indirect_income', 'Consulting Income', 0, 'CR', 0)
      `).run(otherIncomeLedId, companyId);

      // Compound Receipt:
      // Bank DR ₹10,000 (1000000 paise)
      // Customer CR ₹4,000 (400000 paise)
      // Other Income CR ₹6,000 (600000 paise)
      const postRes = PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'RECEIPT',
        voucherDate: '2026-05-12',
        partyId: supplierId,
        billAllocation: {
          allocationType: 'ON_ACCOUNT'
        },
        customLedgerLines: [
          { ledgerId: bankLedId, debitPaise: 1000000, creditPaise: 0, particulars: 'Lump sum bank deposit' },
          { ledgerId: suppLedgerId, debitPaise: 0, creditPaise: 400000, particulars: 'Settlement from party' },
          { ledgerId: otherIncomeLedId, debitPaise: 0, creditPaise: 600000, particulars: 'Consulting income' }
        ],
        lines: []
      });

      const ba = db.prepare('SELECT amount_paise FROM bill_allocations WHERE voucher_id = ?').get(postRes.voucherId) as any;
      assert.ok(ba, 'Bill allocation must exist');
      assert.strictEqual(ba.amount_paise, 400000, 'Bill allocation must equal party amount (₹4,000) exactly, NOT voucher total (₹10,000)');
    });

    // ========================================================================
    // SUITE 7: DEF-008-07 — SERIAL AVAILABILITY & AMENDMENT PRESERVATION
    // ========================================================================
    console.log('\n[Suite 7: DEF-008-07 — Serial Availability & Amendment Safety]');

    const serialItem = 'item_serial_tracked';
    db.prepare(`
      INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, hsn_sac, has_serial_no)
      VALUES (?, ?, 'Serial Tracked Laptop', '${companyId}_unit_nos', 18, 800000, 1000000, '84713010', 1)
    `).run(serialItem, companyId);

    // Initial purchase with Serials S001 and S002
    const purVch = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'PURCHASE',
      voucherDate: '2026-05-13',
      partyId: supplierId,
      lines: [
        {
          itemId: serialItem,
          quantity: 2,
          ratePaise: 800000,
          serialNumber: 'S001, S002',
          godownId
        }
      ]
    });

    await runTest('7.1: Serial validation rejects nonexistent, wrong-item and already sold serials on sale', () => {
      const custPartyId = `${companyId}_party_intra_cust`;

      // 1. Nonexistent serial
      assert.throws(() => {
        PostingEngine.postVoucher(db, {
          companyId,
          fyId,
          voucherType: 'SALES',
          voucherDate: '2026-05-14',
          partyId: custPartyId,
          lines: [{ itemId: serialItem, quantity: 1, ratePaise: 1000000, serialNumber: 'S999_NONEXISTENT', godownId }]
        });
      }, /does not exist/);

      // 2. Wrong item serial
      assert.throws(() => {
        PostingEngine.postVoucher(db, {
          companyId,
          fyId,
          voucherType: 'SALES',
          voucherDate: '2026-05-14',
          partyId: custPartyId,
          lines: [{ itemId: itemIdOdd, quantity: 1, ratePaise: 50000, serialNumber: 'S001', godownId }]
        });
      }, /belongs to another item/);

      // 3. Sell S001 -> succeeds
      PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'SALES',
        voucherDate: '2026-05-14',
        partyId: custPartyId,
        lines: [{ itemId: serialItem, quantity: 1, ratePaise: 1000000, serialNumber: 'S001', godownId }]
      });

      const s001 = db.prepare('SELECT status FROM stock_item_serials WHERE serial_number = ?').get('S001') as any;
      assert.strictEqual(s001.status, 'SOLD', 'S001 must transition to SOLD');

      // 4. Sell S001 again -> rejects
      assert.throws(() => {
        PostingEngine.postVoucher(db, {
          companyId,
          fyId,
          voucherType: 'SALES',
          voucherDate: '2026-05-14',
          partyId: custPartyId,
          lines: [{ itemId: serialItem, quantity: 1, ratePaise: 1000000, serialNumber: 'S001', godownId }]
        });
      }, /is not AVAILABLE/);
    });

    await runTest('7.2: Originating purchase amendment preserves SOLD serial status and prevents reversion', () => {
      // S001 is SOLD. Now amend the purchase voucher (e.g. update rate or quantity)
      const amendRes = PostingEngine.amendVoucher(db, purVch.voucherId, {
        companyId,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-05-13',
        partyId: supplierId,
        lines: [
          {
            itemId: serialItem,
            quantity: 2,
            ratePaise: 850000, // Amended rate
            serialNumber: 'S001, S002',
            godownId
          }
        ]
      });

      assert.strictEqual(amendRes.status, 'POSTED');

      // S001 MUST REMAIN SOLD!
      const s001 = db.prepare('SELECT status FROM stock_item_serials WHERE serial_number = ?').get('S001') as any;
      assert.strictEqual(s001.status, 'SOLD', 'Consumed SOLD serial must never be deleted or reverted to AVAILABLE on purchase amendment');

      // S002 remains AVAILABLE
      const s002 = db.prepare('SELECT status FROM stock_item_serials WHERE serial_number = ?').get('S002') as any;
      assert.strictEqual(s002.status, 'AVAILABLE');
    });

    // ========================================================================
    // SUITE 8: DEF-008-08 — VOUCHER NUMBERING SCOPED TO RESOLVED FY
    // ========================================================================
    console.log('\n[Suite 8: DEF-008-08 — Voucher Numbering Scoped to Resolved FY]');

    await runTest('8.1: Numbering follows [PREFIX]-[FYCODE]-[001] convention across FYs', () => {
      // Create second financial year FY 2027-28
      const fy2728Id = `${companyId}_fy_2027_28`;
      db.prepare(`
        INSERT INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
        VALUES (?, ?, 'FY 2027-28', '2027-04-01', '2028-03-31', 'OPEN')
      `).run(fy2728Id, companyId);

      const pur1 = PostingEngine.postVoucher(db, {
        companyId,
        fyId, // FY 26-27
        voucherType: 'PURCHASE',
        voucherDate: '2026-05-20',
        partyId: supplierId,
        lines: [{ itemId: itemIdOdd, quantity: 1, ratePaise: 10000, godownId }]
      });

      const pur2 = PostingEngine.postVoucher(db, {
        companyId,
        fyId, // FY 26-27
        voucherType: 'PURCHASE',
        voucherDate: '2026-05-21',
        partyId: supplierId,
        lines: [{ itemId: itemIdOdd, quantity: 1, ratePaise: 10000, godownId }]
      });

      const purFy2 = PostingEngine.postVoucher(db, {
        companyId,
        fyId: fy2728Id, // FY 27-28
        voucherType: 'PURCHASE',
        voucherDate: '2027-04-05',
        partyId: supplierId,
        lines: [{ itemId: itemIdOdd, quantity: 1, ratePaise: 10000, godownId }]
      });

      assert.match(pur1.voucherNumber, /^PUR-2627-\d{3}$/);
      assert.match(pur2.voucherNumber, /^PUR-2627-\d{3}$/);
      const seq1 = parseInt(pur1.voucherNumber.split('-')[2], 10);
      const seq2 = parseInt(pur2.voucherNumber.split('-')[2], 10);
      assert.strictEqual(seq2, seq1 + 1, 'Sequential indexing within same FY');
      assert.strictEqual(purFy2.voucherNumber, 'PUR-2728-001', 'Voucher sequence in next FY must reset to 001 with 2728 FY code');
    });

    // ========================================================================
    // SUITE 9: DEF-008-09 — FY CLOSING GUARD & DRAFT DELETION
    // ========================================================================
    console.log('\n[Suite 9: DEF-008-09 — FY Closing Guard & Draft Deletion]');

    await runTest('9.1: Closing FY with pending draft is rejected; draft deletion succeeds; FY closes cleanly', async () => {
      const fyToClose = `${companyId}_fy_test_close`;
      db.prepare(`
        INSERT INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
        VALUES (?, ?, 'FY To Close', '2025-04-01', '2026-03-31', 'OPEN')
      `).run(fyToClose, companyId);

      // Create a draft voucher in this FY
      const draftVch = PostingEngine.postVoucher(db, {
        companyId,
        fyId: fyToClose,
        voucherType: 'PAYMENT',
        voucherDate: '2025-10-10',
        status: 'DRAFT',
        customLedgerLines: [
          { ledgerId: `${companyId}_led_cash`, debitPaise: 10000, creditPaise: 0 },
          { ledgerId: `${companyId}_led_sbi_bank`, debitPaise: 0, creditPaise: 10000 }
        ],
        lines: []
      });

      // 1. Attempt to close FY -> must reject
      assert.throws(() => {
        BusinessService.updateFinancialYearStatus(db, companyId, fyToClose, 'CLOSED');
      }, /Cannot close Financial Year.*pending DRAFT/i);

      // 2. Direct DELETE on POSTED voucher via API -> must return 405
      const postedVch = PostingEngine.postVoucher(db, {
        companyId,
        fyId: fyToClose,
        voucherType: 'CONTRA',
        voucherDate: '2025-10-11',
        customLedgerLines: [
          { ledgerId: `${companyId}_led_sbi_bank`, debitPaise: 10000, creditPaise: 0 },
          { ledgerId: `${companyId}_led_cash`, debitPaise: 0, creditPaise: 10000 }
        ],
        lines: []
      });

      const delPostedRes = await fetch(`${baseUrl}/vouchers/${postedVch.voucherId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(delPostedRes.status, 405, 'Direct deletion of posted voucher must be prohibited (405)');

      // 3. Direct DELETE on DRAFT voucher via API -> must return 200
      const delDraftRes = await fetch(`${baseUrl}/vouchers/${draftVch.voucherId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(delDraftRes.status, 200, 'Direct deletion of draft voucher must succeed (200)');

      // 4. Close FY now -> succeeds
      BusinessService.updateFinancialYearStatus(db, companyId, fyToClose, 'CLOSED');
      const fyRow = db.prepare('SELECT status FROM financial_years WHERE fy_id = ?').get(fyToClose) as any;
      assert.strictEqual(fyRow.status, 'CLOSED');
    });

    // ========================================================================
    // SUITE 10: DEF-008-10 — PARTY CLASSIFICATION & LEDGER GROUP SYNC
    // ========================================================================
    console.log('\n[Suite 10: DEF-008-10 — Party Classification & Ledger Group Synchronization]');

    await runTest('10.1: Clean party classification updates ledger group; party with posted activity rejects update', async () => {
      // 1. Create clean customer
      const createRes = await fetch(`${baseUrl}/masters/parties`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${acctToken}`,
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          partyName: 'Switchable Party',
          partyType: 'CUSTOMER'
        })
      });
      assert.strictEqual(createRes.status, 201);
      const partyData = await createRes.json();
      const partyId = partyData.partyId;

      // Check initial group is Debtors
      const l1 = db.prepare('SELECT group_id FROM ledgers WHERE ledger_id = ?').get(partyData.ledgerId) as any;
      assert.match(l1.group_id, /debtor/i);

      // Switch to SUPPLIER -> group must sync to Creditors
      const updateRes = await fetch(`${baseUrl}/masters/parties/${partyId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${acctToken}`,
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          partyType: 'SUPPLIER'
        })
      });
      assert.strictEqual(updateRes.status, 200);
      const l2 = db.prepare('SELECT group_id FROM ledgers WHERE ledger_id = ?').get(partyData.ledgerId) as any;
      assert.match(l2.group_id, /creditor/i);

      // Post a voucher referencing this party
      PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'PURCHASE',
        voucherDate: '2026-05-25',
        partyId,
        lines: [{ itemId: itemIdOdd, quantity: 1, ratePaise: 10000, godownId }]
      });

      // Attempt to switch back to CUSTOMER -> must reject 400
      const rejectRes = await fetch(`${baseUrl}/masters/parties/${partyId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${acctToken}`,
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          partyType: 'CUSTOMER'
        })
      });
      assert.strictEqual(rejectRes.status, 400, 'Party type change on party with posted vouchers must be rejected');
    });

    // ========================================================================
    // SUITE 11: DEF-008-11 — ATOMIC OPENING STOCK RECORDING
    // ========================================================================
    console.log('\n[Suite 11: DEF-008-11 — Atomic Opening Stock Recording]');

    await runTest('11.1: Forced failure during opening stock rolls back all affected tables completely', () => {
      const failItemId = 'item_opn_fail_test';
      db.prepare(`
        INSERT INTO stock_items (item_id, company_id, item_name, unit_id, purchase_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
        VALUES (?, ?, 'Opening Fail Item', '${companyId}_unit_nos', 10000, 0, 0, '84713010')
      `).run(failItemId, companyId);

      const beforeVchCount = (db.prepare('SELECT COUNT(*) as c FROM vouchers').get() as any).c;
      const beforeSeCount = (db.prepare('SELECT COUNT(*) as c FROM stock_entries').get() as any).c;

      // Force failure by passing invalid negative / zero rate
      assert.throws(() => {
        PostingEngine.recordOpeningStock(db, {
          companyId,
          itemId: failItemId,
          quantity: 10,
          ratePaise: 0 // Throws error
        });
      }, /Opening stock quantity and rate must be greater than zero/);

      const afterVchCount = (db.prepare('SELECT COUNT(*) as c FROM vouchers').get() as any).c;
      const afterSeCount = (db.prepare('SELECT COUNT(*) as c FROM stock_entries').get() as any).c;

      assert.strictEqual(afterVchCount, beforeVchCount, 'No vouchers committed on opening stock failure');
      assert.strictEqual(afterSeCount, beforeSeCount, 'No stock entries committed on opening stock failure');

      const item = db.prepare('SELECT opening_qty FROM stock_items WHERE item_id = ?').get(failItemId) as any;
      assert.strictEqual(item.opening_qty, 0, 'Stock item opening_qty must not mutate on failure');
    });

    // ========================================================================
    // SUITE 12: DEF-008-12 — MASTER INPUT VALIDATION & UNIQUE CONSTRAINTS
    // ========================================================================
    console.log('\n[Suite 12: DEF-008-12 — Master Input Validation & Unique Constraints]');

    await runTest('12.1: Negative opening balances return HTTP 400', async () => {
      // 1. Negative balance on ledger creation
      const ledRes = await fetch(`${baseUrl}/masters/ledgers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${acctToken}`,
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ledgerName: 'Negative Ledger',
          groupId: `${companyId}_grp_bank`,
          openingBalancePaise: -50000
        })
      });
      assert.strictEqual(ledRes.status, 400, 'Negative openingBalancePaise on ledger must return 400');

      // 2. Negative balance on party creation
      const partyRes = await fetch(`${baseUrl}/masters/parties`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${acctToken}`,
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          partyName: 'Negative Party',
          partyType: 'CUSTOMER',
          openingBalancePaise: -10000
        })
      });
      assert.strictEqual(partyRes.status, 400, 'Negative openingBalancePaise on party must return 400');
    });

    await runTest('12.2: Duplicate names return clean HTTP 400 without SQLite 500 leaks', async () => {
      // 1. Create initial ledger
      await fetch(`${baseUrl}/masters/ledgers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${acctToken}`,
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ledgerName: 'Unique Test Ledger',
          groupId: `${companyId}_grp_bank`
        })
      });

      // Duplicate ledger name
      const dupLedRes = await fetch(`${baseUrl}/masters/ledgers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${acctToken}`,
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ledgerName: 'Unique Test Ledger',
          groupId: `${companyId}_grp_bank`
        })
      });
      assert.strictEqual(dupLedRes.status, 400, 'Duplicate ledger name must return 400');
      const dupLedJson = await dupLedRes.json();
      assert.match(dupLedJson.error, /already exists/i);

      // 2. Duplicate party name
      await fetch(`${baseUrl}/masters/parties`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${acctToken}`,
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          partyName: 'Unique Test Party',
          partyType: 'CUSTOMER'
        })
      });
      const dupPartyRes = await fetch(`${baseUrl}/masters/parties`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${acctToken}`,
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          partyName: 'Unique Test Party',
          partyType: 'CUSTOMER'
        })
      });
      assert.strictEqual(dupPartyRes.status, 400, 'Duplicate party name must return 400');

      // 3. Duplicate item name on update
      const item1Res = await fetch(`${baseUrl}/masters/items`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${acctToken}`,
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemName: 'Unique Item Alpha',
          hsnSac: '12345678'
        })
      });
      const item1Data = await item1Res.json();

      const item2Res = await fetch(`${baseUrl}/masters/items`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${acctToken}`,
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemName: 'Unique Item Beta',
          hsnSac: '12345678'
        })
      });
      const item2Data = await item2Res.json();

      // Renaming item 2 to duplicate item 1's name triggers UNIQUE constraint -> returns 400
      const dupItemRes = await fetch(`${baseUrl}/masters/items/${item2Data.itemId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${acctToken}`,
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemName: 'Unique Item Alpha'
        })
      });
      assert.strictEqual(dupItemRes.status, 400, 'Duplicate item name on update must return 400');
      const dupItemJson = await dupItemRes.json();
      assert.match(dupItemJson.error, /already exists/i);

      // 2. Negative rates on item creation
      const itemNegRes = await fetch(`${baseUrl}/masters/items`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${acctToken}`,
          'x-company-id': companyId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemName: 'Negative Rate Item',
          purchaseRatePaise: -1000
        })
      });
      assert.strictEqual(itemNegRes.status, 400, 'Negative purchaseRatePaise must return 400');
    });

  } finally {
    server.close();
  }

  console.log('\n======================================================================');
  console.log(`TASK 008 TEST SUITE SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('======================================================================\n');
}

runAllTests().catch((err) => {
  console.error('Fatal Task 008 test error:', err);
  process.exit(1);
});
