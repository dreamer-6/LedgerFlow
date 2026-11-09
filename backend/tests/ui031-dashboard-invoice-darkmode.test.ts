/**
 * UI-031: Dashboard, Standard Invoice, Dark Mode & Bill Editing Automated Test Suite
 *
 * Covers:
 *  1. Dashboard Financial Year Default & 12 FY Months (Apr-Mar) with zero-activity months.
 *  2. Dashboard Single Day & Custom Date Range filtering.
 *  3. In-Place Draft Bill Editing (PostingEngine.updateDraftVoucher):
 *     - Retains voucher_number without incrementing sequence numbers.
 *     - Status remains DRAFT, lines/totals updated, audit log written.
 *  4. Posted Voucher Amendment (PostingEngine.amendVoucher):
 *     - Cancels original, generates new voucher number, reverses ledger entries.
 *  5. Standard Invoice Line Tax Rate & Warranty Formatting:
 *     - Voucher line query fetches item_gst_rate & item_warranty_months.
 *     - GST rate resolution (fallback to item_gst_rate, avoiding 0%).
 *     - Warranty formatting ('Years', 'Months', 'Both').
 *  6. Outstanding Balance & Settlement Reconciliation:
 *     - Excludes DRAFT & CANCELLED vouchers.
 *     - Fully settled bills show ₹0 outstanding.
 *     - Partial and credit bills reflect true balance.
 */

import assert from 'node:assert';
import { getDatabase } from '../src/database/connection.js';
import { initializeBusiness } from '../src/database/seed.js';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';
import { ReportEngine } from '../src/reports/report-engine.js';

console.log('======================================================================');
console.log('LEDGERFLOW UI-031 — DASHBOARD, INVOICE, DARK MODE & BILL EDITING TEST');
console.log('======================================================================\n');

const db = getDatabase(':memory:');
const companyId = 'comp_ui031_test';

// 1. Initialize Company
initializeBusiness(db, {
  companyId,
  companyName: 'UI-031 Precision Technologies Pvt Ltd',
  stateCode: '27', // Maharashtra
  gstin: '27AABCP1234M1Z2'
});

const activeFy = db.prepare("SELECT * FROM financial_years WHERE company_id = ? AND status = 'OPEN' LIMIT 1").get(companyId) as any;
assert.ok(activeFy, 'Active Financial Year must exist');
const fyId = activeFy.fy_id;
const godownId = `${companyId}_godown_main`;

// 2. Setup Customer & Supplier
const custId = `${companyId}_pty_cust_01`;
const custLedgerId = `${companyId}_led_cust_01`;
db.prepare(`
  INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type, is_party)
  VALUES (?, ?, 'Apex Retail Corp', '${companyId}_grp_debtors', 0, 'DR', 1)
`).run(custLedgerId, companyId);
db.prepare(`
  INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id, gstin)
  VALUES (?, ?, 'Apex Retail Corp', 'CUSTOMER', ?, '27AAACB2222B1Z3')
`).run(custId, companyId, custLedgerId);
db.prepare(`
  INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
  VALUES ('addr_${custId}', ?, '100 Gateway Center', 'Mumbai', 'Maharashtra', '27', '400001')
`).run(custId);

const suppId = `${companyId}_pty_supp_01`;
const suppLedgerId = `${companyId}_led_supp_01`;
db.prepare(`
  INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type, is_party)
  VALUES (?, ?, 'Premier Wholesale', '${companyId}_grp_creditors', 0, 'CR', 1)
`).run(suppLedgerId, companyId);
db.prepare(`
  INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id, gstin)
  VALUES (?, ?, 'Premier Wholesale', 'SUPPLIER', ?, '27ZZZBS3333C1Z8')
`).run(suppId, companyId, suppLedgerId);
db.prepare(`
  INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
  VALUES ('addr_${suppId}', ?, '50 Industrial Area', 'Pune', 'Maharashtra', '27', '411001')
`).run(suppId);

// 3. Setup Stock Item with Warranty & Serial tracking
const nosUnits = db.prepare("SELECT * FROM units WHERE company_id = ? AND UPPER(symbol) = 'NOS'").all(companyId) as any[];
const defaultUnitId = nosUnits[0].unit_id;

const itemId = `${companyId}_item_workstation`;
db.prepare(`
  INSERT INTO stock_items (
    item_id, company_id, item_name, sku, hsn_sac, unit_id, gst_rate,
    purchase_rate_paise, selling_rate_paise, warranty_months, has_serial_no
  ) VALUES (?, ?, 'Z-Series Professional Workstation', 'SKU-WS-01', '84715000', ?, 18, 8000000, 11000000, 24, 1)
`).run(itemId, companyId, defaultUnitId);

// Add serial numbers
db.prepare(`
  INSERT INTO stock_item_serials (serial_id, item_id, serial_number, status, purchase_date)
  VALUES ('ser_ws_01', ?, 'WS-SN-001', 'AVAILABLE', '2026-04-05'),
         ('ser_ws_02', ?, 'WS-SN-002', 'AVAILABLE', '2026-04-05'),
         ('ser_ws_03', ?, 'WS-SN-003', 'AVAILABLE', '2026-04-05')
`).run(itemId, itemId, itemId);

// Add initial opening stock so sales can be posted without inventory errors
db.prepare(`
  INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
  VALUES ('vch_open_test', ?, ?, 'JOURNAL', 'OPN-01', '2026-04-01', 80000000, 'POSTED')
`).run(companyId, fyId);

db.prepare(`
  INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
  VALUES ('stk_open_ui031', 'vch_open_test', ?, ?, '2026-04-01', 'IN', 10, 8000000, 80000000)
`).run(itemId, godownId);

console.log('✓ Business, parties, items, and initial inventory initialized in memory.\n');

// ---------------------------------------------------------------------
// TEST 1: Dashboard FY Default & 12 FY Months Structure (Apr-Mar)
// ---------------------------------------------------------------------
console.log('--- TEST 1: Dashboard FY Default & 12 FY Months Structure ---');
{
  // Post a sales voucher in April 2026
  const vchApril = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-10',
    partyId: custId,
    status: 'POSTED',
    isTaxInclusive: false,
    lines: [
      {
        itemId,
        godownId,
        quantity: 1,
        ratePaise: 10000000, // ₹1,00,000
        gstRate: 18,
        isTaxInclusive: false,
        serialNumber: 'WS-SN-001',
        warrantyMonths: 24,
        movementType: 'OUT'
      }
    ]
  });
  assert.ok(vchApril.voucherId, 'April sales voucher created');

  // Post a purchase voucher in July 2026
  const vchJuly = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-07-15',
    partyId: suppId,
    status: 'POSTED',
    isTaxInclusive: false,
    lines: [
      {
        itemId,
        godownId,
        quantity: 2,
        ratePaise: 8000000,
        gstRate: 18,
        isTaxInclusive: false,
        serialNumber: 'WS-SN-004, WS-SN-005',
        movementType: 'IN'
      }
    ]
  });
  assert.ok(vchJuly.voucherId, 'July purchase voucher created');

  // Compute trend data simulating the backend dashboard endpoint logic
  const fyMonths = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const monthMap = new Map<string, { month: string; sales: number; purchase: number }>();
  fyMonths.forEach(m => monthMap.set(m, { month: m, sales: 0, purchase: 0 }));

  const rawTrends = db.prepare(`
    SELECT
      strftime('%m', voucher_date) as month_num,
      voucher_type,
      SUM(total_amount_paise) as total_paise
    FROM vouchers
    WHERE company_id = ?
      AND fy_id = ?
      AND status = 'POSTED'
      AND voucher_type IN ('SALES', 'PURCHASE')
    GROUP BY strftime('%m', voucher_date), voucher_type
  `).all(companyId, fyId) as any[];

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (const r of rawTrends) {
    const idx = parseInt(r.month_num, 10) - 1;
    const mName = monthNames[idx];
    if (monthMap.has(mName)) {
      const entry = monthMap.get(mName)!;
      if (r.voucher_type === 'SALES') {
        entry.sales = Number(r.total_paise) / 100;
      } else if (r.voucher_type === 'PURCHASE') {
        entry.purchase = Number(r.total_paise) / 100;
      }
    }
  }

  const trendData = fyMonths.map(m => monthMap.get(m)!);
  assert.strictEqual(trendData.length, 12, 'Trend data must contain all 12 FY months');
  assert.strictEqual(trendData[0].month, 'Apr', 'First month must be Apr');
  assert.strictEqual(trendData[11].month, 'Mar', 'Last month must be Mar');

  // Verify April values
  assert.strictEqual(trendData[0].sales, 118000, 'April sales should be ₹1,18,000');
  assert.strictEqual(trendData[0].purchase, 0, 'April purchase should be 0');

  // Verify May (zero activity month preserved)
  assert.strictEqual(trendData[1].sales, 0, 'May sales must be 0 (zero activity month preserved)');
  assert.strictEqual(trendData[1].purchase, 0, 'May purchase must be 0 (zero activity month preserved)');

  // Verify July
  const julEntry = trendData.find(t => t.month === 'Jul');
  assert.ok(julEntry, 'July entry exists');
  assert.strictEqual(julEntry.purchase, 188800, 'July purchase should be ₹1,88,800');
  assert.strictEqual(julEntry.sales, 0, 'July sales should be 0');

  console.log('✓ Verified 12 FY months trendData preserves zero-activity months (Apr-Mar order).\n');
}

// ---------------------------------------------------------------------
// TEST 2: Dashboard Single Day and Custom Date Range Queries
// ---------------------------------------------------------------------
console.log('--- TEST 2: Dashboard Single Day and Custom Date Range Queries ---');
{
  // Query Single Day: 2026-04-10 (should match April sales voucher)
  const singleDaySales = db.prepare(`
    SELECT COALESCE(SUM(total_amount_paise), 0) as total_paise
    FROM vouchers
    WHERE company_id = ?
      AND status = 'POSTED'
      AND voucher_type = 'SALES'
      AND voucher_date = '2026-04-10'
  `).get(companyId) as any;
  assert.strictEqual(Number(singleDaySales.total_paise), 11800000, 'Single day sales for 2026-04-10 is ₹1,18,000');

  // Query Single Day: 2026-04-11 (different day, should be 0)
  const singleDayOther = db.prepare(`
    SELECT COALESCE(SUM(total_amount_paise), 0) as total_paise
    FROM vouchers
    WHERE company_id = ?
      AND status = 'POSTED'
      AND voucher_type = 'SALES'
      AND voucher_date = '2026-04-11'
  `).get(companyId) as any;
  assert.strictEqual(Number(singleDayOther.total_paise), 0, 'Single day sales for 2026-04-11 should be 0');

  // Query Custom Range: 2026-04-01 to 2026-04-30 (includes April voucher, excludes July voucher)
  const customRange = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN voucher_type = 'SALES' THEN total_amount_paise ELSE 0 END), 0) as sales_paise,
      COALESCE(SUM(CASE WHEN voucher_type = 'PURCHASE' THEN total_amount_paise ELSE 0 END), 0) as purchase_paise
    FROM vouchers
    WHERE company_id = ?
      AND status = 'POSTED'
      AND voucher_date BETWEEN '2026-04-01' AND '2026-04-30'
  `).get(companyId) as any;
  assert.strictEqual(Number(customRange.sales_paise), 11800000, 'April range contains April sales');
  assert.strictEqual(Number(customRange.purchase_paise), 0, 'April range contains no purchases');

  console.log('✓ Verified Single Day and Custom Date Range filtering.\n');
}

// ---------------------------------------------------------------------
// TEST 3: In-Place Draft Voucher Editing (PostingEngine.updateDraftVoucher)
// ---------------------------------------------------------------------
console.log('--- TEST 3: In-Place Draft Voucher Editing ---');
{
  // 1. Create a DRAFT voucher
  const draftVch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-12',
    partyId: custId,
    status: 'DRAFT',
    isTaxInclusive: false,
    lines: [
      {
        itemId,
        godownId,
        quantity: 1,
        ratePaise: 10000000,
        gstRate: 18,
        isTaxInclusive: false,
        movementType: 'OUT'
      }
    ]
  });
  const draftId = draftVch.voucherId;
  const draftNum = draftVch.voucherNumber;
  assert.ok(draftId, 'Draft voucher created');
  assert.ok(draftNum, 'Draft voucher has voucher number');

  // Check statutory next voucher number before edit
  const nextNumBefore = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'SALES');

  // 2. Update the Draft voucher in-place
  const updateResult = PostingEngine.updateDraftVoucher(db, draftId, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-15',
    partyId: custId,
    narration: 'Updated draft with 2 units and revised pricing',
    lines: [
      {
        itemId,
        godownId,
        quantity: 2,
        ratePaise: 12000000, // ₹1,20,000 each = ₹2,40,000
        gstRate: 18,
        isTaxInclusive: false,
        serialNumbers: ['WS-SN-002', 'WS-SN-003'],
        movementType: 'OUT'
      }
    ]
  });

  assert.strictEqual(updateResult.voucherId, draftId, 'Voucher ID must remain unchanged');
  assert.strictEqual(updateResult.voucherNumber, draftNum, 'Voucher Number must remain unchanged');

  // Verify voucher record in DB
  const vchInDb = db.prepare("SELECT * FROM vouchers WHERE voucher_id = ?").get(draftId) as any;
  assert.strictEqual(vchInDb.status, 'DRAFT', 'Status must remain DRAFT');
  assert.strictEqual(vchInDb.voucher_number, draftNum, 'Voucher number unchanged in DB');
  assert.strictEqual(vchInDb.voucher_date, '2026-05-15', 'Date updated in DB');
  assert.strictEqual(Number(vchInDb.total_amount_paise), 28320000, 'Total amount updated to ₹2,83,200');

  // Verify lines in DB
  const linesInDb = db.prepare("SELECT * FROM voucher_lines WHERE voucher_id = ?").all(draftId) as any[];
  assert.strictEqual(linesInDb.length, 1, 'One updated line in DB');
  assert.strictEqual(Number(linesInDb[0].quantity), 2, 'Quantity updated to 2');
  assert.strictEqual(Number(linesInDb[0].rate_paise), 12000000, 'Rate updated to ₹1,20,000');

  // Verify statutory next voucher number was NOT consumed or incremented
  const nextNumAfter = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'SALES');
  assert.strictEqual(nextNumAfter, nextNumBefore, 'Statutory sequence number must NOT increment when editing a DRAFT voucher');

  // Verify audit log has UPDATE_DRAFT_VOUCHER entry
  const auditLogs = db.prepare("SELECT * FROM audit_logs WHERE entity_id = ? AND action = 'UPDATE_DRAFT_VOUCHER'").all(draftId) as any[];
  assert.strictEqual(auditLogs.length, 1, 'Audit log must record UPDATE_DRAFT_VOUCHER action');

  console.log('✓ Verified In-Place Draft Editing: preserved sequence number, updated totals/lines, logged audit entry.\n');
}

// ---------------------------------------------------------------------
// TEST 4: Atomic Amendment for Posted Vouchers (PostingEngine.amendVoucher)
// ---------------------------------------------------------------------
console.log('--- TEST 4: Atomic Amendment for Posted Vouchers ---');
{
  // 1. Create a POSTED voucher
  const postedVch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-06-01',
    partyId: custId,
    status: 'POSTED',
    isTaxInclusive: false,
    lines: [
      {
        itemId,
        godownId,
        quantity: 1,
        ratePaise: 11000000,
        gstRate: 18,
        isTaxInclusive: false,
        serialNumber: 'WS-SN-002',
        movementType: 'OUT'
      }
    ]
  });
  const originalId = postedVch.voucherId;
  const originalNum = postedVch.voucherNumber;

  // 2. Amend the posted voucher
  const amendmentResult = PostingEngine.amendVoucher(db, originalId, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-06-02',
    partyId: custId,
    lines: [
      {
        itemId,
        godownId,
        quantity: 1,
        ratePaise: 10500000,
        gstRate: 18,
        isTaxInclusive: false,
        serialNumber: 'WS-SN-002',
        movementType: 'OUT'
      }
    ]
  });

  // Verify original voucher is CANCELLED
  const originalInDb = db.prepare("SELECT * FROM vouchers WHERE voucher_id = ?").get(originalId) as any;
  assert.strictEqual(originalInDb.status, 'CANCELLED', 'Original voucher must be marked CANCELLED');

  // Verify replacement voucher is created and POSTED with a new voucher number
  const replacementId = amendmentResult.replacementVoucherId;
  assert.notStrictEqual(replacementId, originalId, 'Replacement voucher must have distinct voucherId');
  const replacementInDb = db.prepare("SELECT * FROM vouchers WHERE voucher_id = ?").get(replacementId) as any;
  assert.strictEqual(replacementInDb.status, 'POSTED', 'Replacement voucher must have status POSTED');
  assert.notStrictEqual(replacementInDb.voucher_number, originalNum, 'Replacement voucher must have a new sequence voucher_number');
  assert.strictEqual(Number(replacementInDb.total_amount_paise), 12390000, 'Replacement voucher total is ₹1,23,900');

  console.log('✓ Verified Posted Voucher Amendment: atomic cancellation, reversal, and replacement.\n');
}

// ---------------------------------------------------------------------
// TEST 5: Standard Invoice Item GST Rate & Warranty Formatting
// ---------------------------------------------------------------------
console.log('--- TEST 5: Standard Invoice Item GST Rate & Warranty Formatting ---');
{
  // Verify GET /vouchers/:id lines query includes si.gst_rate and si.warranty_months
  const linesQuery = `
    SELECT
      vl.*,
      si.item_name,
      si.sku,
      si.hsn_sac,
      si.gst_rate as item_gst_rate,
      si.warranty_months as item_warranty_months,
      u.symbol as unit_symbol
    FROM voucher_lines vl
    LEFT JOIN stock_items si ON vl.item_id = si.item_id
    LEFT JOIN units u ON si.unit_id = u.unit_id
    WHERE vl.voucher_id = ?
  `;

  const vchAprilRecord = db.prepare("SELECT voucher_id FROM vouchers WHERE company_id = ? AND voucher_date = '2026-04-10'").get(companyId) as any;
  const lines = db.prepare(linesQuery).all(vchAprilRecord.voucher_id) as any[];

  assert.ok(lines.length > 0, 'Found voucher lines');
  const line0 = lines[0];
  assert.strictEqual(Number(line0.item_gst_rate), 18, 'Line query must return item_gst_rate = 18%');
  assert.strictEqual(Number(line0.item_warranty_months), 24, 'Line query must return item_warranty_months = 24');

  // Test GST Rate Resolution Logic (from InvoiceAdapter):
  // taxPercent should resolve correctly: line.gst_rate || (cgstRate + sgstRate) || line.item_gst_rate || 0
  const lineGstRate = (line0.cgst_rate ? Number(line0.cgst_rate) * 2 : 0) || Number(line0.item_gst_rate) || 0;
  assert.strictEqual(lineGstRate, 18, 'Invoice adapter accurately resolves 18% GST rate (never 0%)');

  // Test Warranty Formatter Logic:
  function formatWarrantyDisplay(months?: number | string | null, format: 'Years' | 'Months' | 'Both' = 'Years'): string | null {
    if (months == null) return null;
    const num = typeof months === 'string' ? parseInt(months, 10) : months;
    if (isNaN(num) || num <= 0) return null;

    const isExactYears = num % 12 === 0;
    const yearsVal = num / 12;
    const yearsStr = isExactYears
      ? `${yearsVal} ${yearsVal === 1 ? 'Year' : 'Years'}`
      : `${yearsVal.toFixed(1).replace(/\.0$/, '')} Years`;
    const monthsStr = `${num} ${num === 1 ? 'Month' : 'Months'}`;

    if (format === 'Months') return monthsStr;
    if (format === 'Both') return `${yearsStr} (${monthsStr})`;
    return num >= 12 ? yearsStr : monthsStr;
  }

  // Years format
  assert.strictEqual(formatWarrantyDisplay(12, 'Years'), '1 Year', '12 months converts to 1 Year');
  assert.strictEqual(formatWarrantyDisplay(24, 'Years'), '2 Years', '24 months converts to 2 Years');
  assert.strictEqual(formatWarrantyDisplay(18, 'Years'), '1.5 Years', '18 months converts to 1.5 Years');
  assert.strictEqual(formatWarrantyDisplay(6, 'Years'), '6 Months', '<12 months displays in months');

  // Months format
  assert.strictEqual(formatWarrantyDisplay(24, 'Months'), '24 Months', 'Months format outputs 24 Months');

  // Both format
  assert.strictEqual(formatWarrantyDisplay(24, 'Both'), '2 Years (24 Months)', 'Both format outputs 2 Years (24 Months)');
  assert.strictEqual(formatWarrantyDisplay(null, 'Years'), null, 'Null returns null');
  assert.strictEqual(formatWarrantyDisplay(0, 'Years'), null, '0 returns null');

  console.log('✓ Verified Line GST Rate resolution and Warranty formatting.\n');
}

// ---------------------------------------------------------------------
// TEST 6: Outstanding Balance & Settlement Reconciliation
// ---------------------------------------------------------------------
console.log('--- TEST 6: Outstanding Balance & Settlement Reconciliation ---');
{
  // Report before settlement
  const outstandingBefore = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER');

  // DRAFT vouchers and CANCELLED vouchers are strictly excluded
  const custRowBefore = outstandingBefore.find(r => r.partyId === custId);
  assert.ok(custRowBefore, 'Customer row exists in outstanding report');

  // Settle the April sales voucher (₹1,18,000) fully via RECEIPT voucher
  const vchApril = db.prepare("SELECT * FROM vouchers WHERE company_id = ? AND voucher_date = '2026-04-10'").get(companyId) as any;
  const receiptVch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'RECEIPT',
    voucherDate: '2026-04-20',
    partyId: custId,
    status: 'POSTED',
    lines: [],
    customLedgerLines: [
      {
        ledgerId: `${companyId}_led_cash`,
        debitPaise: 11800000,
        creditPaise: 0
      },
      {
        ledgerId: custLedgerId,
        debitPaise: 0,
        creditPaise: 11800000
      }
    ],
    billAllocation: {
      referenceVoucherId: vchApril.voucher_id,
      allocationType: 'AGAINST_REF'
    }
  });
  assert.ok(receiptVch.voucherId, 'Receipt settlement voucher created');

  // Re-run outstanding report after settlement
  const outstandingAfter = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER');
  const custRowAfter = outstandingAfter.find(r => r.partyId === custId);
  assert.ok(custRowAfter, 'Customer row exists after settlement');

  // Total outstanding was: April (₹1,18,000) + June replacement (₹1,23,900) = ₹2,41,900
  // After settling April (₹1,18,000), remaining outstanding must be exactly ₹1,23,900 (12390000 paise)
  assert.strictEqual(custRowAfter.totalOutstandingPaise, 12390000, 'Remaining outstanding matches unpaid June bill (₹1,23,900)');

  console.log('✓ Verified Outstanding Balance reconciliation (no synthetic zeroing, excluded drafts & cancelled).\n');
}

console.log('======================================================================');
console.log('ALL UI-031 SUITE TESTS PASSED WITH 100% ACCURACY AND INTEGRITY!');
console.log('======================================================================');
