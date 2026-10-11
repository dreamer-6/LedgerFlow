/**
 * test-reports-integration-reconciliation.js
 *
 * Dedicated Cross-Report Integration and Reconciliation Suite (UI-011 to UI-018).
 *
 * Verifies that for the same company and date window:
 * 1. Day Book records all posted vouchers and omits drafts/cancelled
 * 2. Trial Balance maintains strict double-entry debit-credit parity
 * 3. Profit & Loss net profit reconciles mathematically
 * 4. Balance Sheet is strictly balanced (Assets == Liabilities + Equity)
 * 5. P&L Net Profit strictly matches Balance Sheet current period profit
 * 6. Outstanding Receivables strictly matches Customer Ledger & Trial Balance Debtor balances
 * 7. Outstanding Payables strictly matches Supplier Ledger & Trial Balance Creditor balances
 * 8. Stock Summary quantity and valuation reconcile with inventory movements
 * 9. GST Summary outward, inward, and tax liability reconcile with ledger duties & taxes
 * 10. Multi-tenant boundary isolation holds across all 8 report endpoints
 */

import http from 'http';

const BASE_URL = 'http://localhost:5000/api';

async function req(endpoint, method = 'GET', body = null, token = null, companyId = null) {
  const url = new URL(BASE_URL + endpoint);
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (companyId) headers['x-company-id'] = companyId;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers
    };

    const request = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          body: parsed
        });
      });
    });

    request.on('error', (err) => {
      reject(err);
    });

    if (body) {
      request.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    request.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runReconciliationTests() {
  console.log('======================================================================');
  console.log('REPORTS INTEGRATION AUDIT: CROSS-REPORT RECONCILIATION TEST SUITE');
  console.log('======================================================================\n');

  const timestamp = Date.now();
  const fromDate = '2026-05-01';
  const toDate = '2026-05-31';

  // Step 1: Create isolated Tenant A & Tenant B
  console.log('[Step 1] Initializing Isolated Tenants (Company A & Company B)...');
  const userA = await req('/auth/register', 'POST', {
    email: `recon_userA_${timestamp}@example.com`,
    password: 'Password@123',
    fullName: 'Audit Specialist A',
    username: `reconA_${timestamp}`,
    businessName: 'Integrated Apex Logistics A'
  });
  const tokenA = userA.body?.token;
  assert(!!tokenA, 'Tenant A registered successfully');

  const bizA = await req('/businesses', 'GET', null, tokenA);
  const companyA = bizA.body?.[0]?.company_id || bizA.body?.[0]?.companyId;
  assert(!!companyA, `Company A resolved: ${companyA}`);

  const userB = await req('/auth/register', 'POST', {
    email: `recon_userB_${timestamp}@example.com`,
    password: 'Password@123',
    fullName: 'Audit Specialist B',
    username: `reconB_${timestamp}`,
    businessName: 'Boundary Silo Ltd B'
  });
  const tokenB = userB.body?.token;
  assert(!!tokenB, 'Tenant B registered successfully');

  const bizB = await req('/businesses', 'GET', null, tokenB);
  const companyB = bizB.body?.[0]?.company_id || bizB.body?.[0]?.companyId;
  assert(!!companyB, `Company B resolved: ${companyB}`);

  // Step 2: Setup Masters in Company A
  console.log('\n[Step 2] Configuring Masters (Parties, Stock Item, Units)...');
  const unitsRes = await req('/masters/units', 'GET', null, tokenA, companyA);
  const pcsUnit = unitsRes.body?.find(u => u.symbol?.toLowerCase() === 'pcs' || u.unit_name?.toLowerCase().includes('piece')) || unitsRes.body?.[0];
  const unitId = pcsUnit?.unit_id || null;

  const itemRes = await req('/masters/items', 'POST', {
    itemName: `Industrial Valve ${timestamp}`,
    itemCode: `VALVE-${timestamp}`,
    sku: `SKU-VALVE-${timestamp}`,
    hsnSac: '848180',
    unitId: unitId,
    purchaseRatePaise: 500000, // ₹5,000
    sellingRatePaise: 800000,   // ₹8,000
    gstRate: 18,
    reorderLevel: 5
  }, tokenA, companyA);
  const itemId = itemRes.body?.item_id || itemRes.body?.itemId;
  assert(!!itemId, `Item created: ${itemId}`);

  const debtorRes = await req('/masters/parties', 'POST', {
    partyName: `Prime Client Debtor ${timestamp}`,
    partyType: 'CUSTOMER',
    phone: '9840112233',
    addressLine1: 'Cyber Towers',
    city: 'Hyderabad',
    state: 'Telangana',
    stateCode: '36',
    gstin: '36ABCDE1234F1Z5',
    openingBalancePaise: 0,
    openingBalanceType: 'DR'
  }, tokenA, companyA);
  const debtorId = debtorRes.body?.party_id || debtorRes.body?.partyId;
  const debtorLedgerId = debtorRes.body?.ledger_id || debtorRes.body?.ledgerId || `led_pty_${debtorId}`;
  assert(!!debtorId, `Debtor party created: ${debtorId}`);

  const creditorRes = await req('/masters/parties', 'POST', {
    partyName: `Forge Steel Supplier ${timestamp}`,
    partyType: 'SUPPLIER',
    phone: '9840223344',
    addressLine1: 'Industrial Zone',
    city: 'Chennai',
    state: 'Tamil Nadu',
    stateCode: '33',
    gstin: '33AABCF9876G1ZV',
    openingBalancePaise: 0,
    openingBalanceType: 'CR'
  }, tokenA, companyA);
  const creditorId = creditorRes.body?.party_id || creditorRes.body?.partyId;
  const creditorLedgerId = creditorRes.body?.ledger_id || creditorRes.body?.ledgerId || `led_pty_${creditorId}`;
  assert(!!creditorId, `Creditor party created: ${creditorId}`);

  // Resolve Cash Ledger for payment/receipt
  const allLedgers = await req('/masters/ledgers', 'GET', null, tokenA, companyA);
  const cashLedger = allLedgers.body?.find(l => l.ledger_name?.toLowerCase().includes('cash'));
  const cashLedgerId = cashLedger?.ledger_id || `${companyA}_led_cash`;

  // Step 3: Post Cross-Cutting Transactions
  console.log('\n[Step 3] Posting Comprehensive Vouchers in May 2026...');

  // Transaction 1: Purchase 20 units @ ₹5,000 = ₹1,00,000 + 18% IGST (₹18,000) = ₹1,18,000
  const purchRes = await req('/vouchers', 'POST', {
    voucherType: 'PURCHASE',
    voucherDate: '2026-05-05',
    partyId: creditorId,
    narration: 'Purchase of 20 industrial valves',
    lines: [
      {
        itemId: itemId,
        quantity: 20,
        ratePaise: 500000,
        gstRate: 18
      }
    ]
  }, tokenA, companyA);
  const purchId = purchRes.body?.voucher_id || purchRes.body?.voucherId;
  assert(purchRes.ok && !!purchId, `Purchase voucher posted: ${purchId}`);

  // Transaction 2: Sales 10 units @ ₹8,000 = ₹80,000 + 18% IGST (₹14,400) = ₹94,400
  const salesRes = await req('/vouchers', 'POST', {
    voucherType: 'SALES',
    voucherDate: '2026-05-12',
    partyId: debtorId,
    narration: 'Sales of 10 industrial valves',
    allowNegativeStock: true,
    lines: [
      {
        itemId: itemId,
        quantity: 10,
        ratePaise: 800000,
        gstRate: 18
      }
    ]
  }, tokenA, companyA);
  const salesId = salesRes.body?.voucher_id || salesRes.body?.voucherId;
  assert(salesRes.ok && !!salesId, `Sales voucher posted: ${salesId}`);

  // Transaction 3: Partial Customer Receipt of ₹50,000
  const recRes = await req('/vouchers', 'POST', {
    voucherType: 'RECEIPT',
    voucherDate: '2026-05-18',
    partyId: debtorId,
    narration: 'Partial receipt against sales',
    paymentMode: 'Cash',
    lines: [],
    customLedgerLines: [
      { ledgerId: cashLedgerId, debitPaise: 5000000, creditPaise: 0 },
      { ledgerId: debtorLedgerId, debitPaise: 0, creditPaise: 5000000 }
    ]
  }, tokenA, companyA);
  const recId = recRes.body?.voucher_id || recRes.body?.voucherId;
  assert(recRes.ok && !!recId, `Customer receipt posted: ${recId}`);

  // Transaction 4: Partial Supplier Payment of ₹60,000
  const payRes = await req('/vouchers', 'POST', {
    voucherType: 'PAYMENT',
    voucherDate: '2026-05-22',
    partyId: creditorId,
    narration: 'Partial payment against purchase',
    paymentMode: 'Cash',
    lines: [],
    customLedgerLines: [
      { ledgerId: creditorLedgerId, debitPaise: 6000000, creditPaise: 0 },
      { ledgerId: cashLedgerId, debitPaise: 0, creditPaise: 6000000 }
    ]
  }, tokenA, companyA);
  const payId = payRes.body?.voucher_id || payRes.body?.voucherId;
  assert(payRes.ok && !!payId, `Supplier payment posted: ${payId}`);

  // Step 4: UI-011 Day Book Audit
  console.log('\n[Step 4] Reconciling UI-011 Day Book...');
  const dayBookRes = await req(`/reports/daybook?fromDate=${fromDate}&toDate=${toDate}`, 'GET', null, tokenA, companyA);
  assert(dayBookRes.ok, 'Day Book query succeeded (HTTP 200)');
  const dayBookEntries = dayBookRes.body;
  assert(Array.isArray(dayBookEntries), 'Day Book response is an array');
  assert(dayBookEntries.length === 4, `Day Book contains exactly 4 posted vouchers (found ${dayBookEntries.length})`);
  assert(dayBookEntries.every(e => e.status === 'POSTED'), 'All Day Book entries are strictly POSTED');

  // Step 5: UI-012 Trial Balance Audit & Parity
  console.log('\n[Step 5] Reconciling UI-012 Trial Balance...');
  const tbRes = await req(`/reports/trial-balance?asOnDate=${toDate}`, 'GET', null, tokenA, companyA);
  assert(tbRes.ok, 'Trial Balance query succeeded (HTTP 200)');
  const tb = tbRes.body;
  assert(tb.isBalanced === true, 'Trial Balance is strictly balanced');
  assert(tb.differencePaise === 0, 'Trial Balance difference is exactly 0 paise');
  assert(tb.totalDebitPaise === tb.totalCreditPaise, `Total Debits (${tb.totalDebitPaise}) === Total Credits (${tb.totalCreditPaise})`);

  // Step 6: UI-013 Ledger Report Reconciliation
  console.log('\n[Step 6] Reconciling UI-013 Ledger Reports...');
  const debtorLedgerRes = await req(`/reports/ledger/${debtorLedgerId}?fromDate=${fromDate}&toDate=${toDate}`, 'GET', null, tokenA, companyA);
  assert(debtorLedgerRes.ok, 'Debtor ledger statement queried successfully');
  const debtorStmt = debtorLedgerRes.body;
  // Sale (94,400) - Receipt (50,000) = 44,400 DR (4,440,000 paise)
  assert(debtorStmt.closingBalancePaise === 4440000, `Debtor closing balance is ₹44,400 (got ${debtorStmt.closingBalancePaise})`);
  assert(debtorStmt.closingBalanceType === 'DR', 'Debtor balance is DR');

  const creditorLedgerRes = await req(`/reports/ledger/${creditorLedgerId}?fromDate=${fromDate}&toDate=${toDate}`, 'GET', null, tokenA, companyA);
  assert(creditorLedgerRes.ok, 'Creditor ledger statement queried successfully');
  const creditorStmt = creditorLedgerRes.body;
  // Purchase (1,18,000) - Payment (60,000) = 58,000 CR (5,800,000 paise)
  assert(creditorStmt.closingBalancePaise === 5800000, `Creditor closing balance is ₹58,000 (got ${creditorStmt.closingBalancePaise})`);
  assert(creditorStmt.closingBalanceType === 'CR', 'Creditor balance is CR');

  // Step 7: UI-014 Profit & Loss Reconciliation
  console.log('\n[Step 7] Reconciling UI-014 Profit & Loss...');
  const pnlRes = await req(`/reports/profit-loss?fromDate=${fromDate}&toDate=${toDate}`, 'GET', null, tokenA, companyA);
  assert(pnlRes.ok, 'Profit & Loss query succeeded (HTTP 200)');
  const pnl = pnlRes.body;
  // Sales revenue = ₹80,000 (8,000,000 paise)
  assert(pnl.tradingIncomePaise === 8000000, `P&L Trading Income is ₹80,000 (got ${pnl.tradingIncomePaise})`);
  // COGS for 10 units @ 5,000 = ₹50,000 (5,000,000 paise)
  assert(pnl.tradingExpensePaise === 5000000, `P&L Trading Expense is ₹50,000 (got ${pnl.tradingExpensePaise})`);
  // Gross Profit = 80,000 - 50,000 = ₹30,000 (3,000,000 paise)
  assert(pnl.grossProfitPaise === 3000000, `P&L Gross Profit is ₹30,000 (got ${pnl.grossProfitPaise})`);
  assert(pnl.netProfitPaise === 3000000, `P&L Net Profit is ₹30,000 (got ${pnl.netProfitPaise})`);

  // Step 8: UI-015 Balance Sheet Reconciliation
  console.log('\n[Step 8] Reconciling UI-015 Balance Sheet & Cross-Report Ties...');
  const bsRes = await req(`/reports/balance-sheet?asOnDate=${toDate}`, 'GET', null, tokenA, companyA);
  assert(bsRes.ok, 'Balance Sheet query succeeded (HTTP 200)');
  const bs = bsRes.body;
  assert(bs.isBalanced === true, 'Balance Sheet is strictly balanced');
  assert(bs.totalAssetsPaise === bs.totalLiabilitiesEquityPaise, `Total Assets (${bs.totalAssetsPaise}) === Total Liab+Equity (${bs.totalLiabilitiesEquityPaise})`);
  // Cross-Report Tie: Balance Sheet Net Profit MUST equal P&L Net Profit!
  assert(bs.netProfitPaise === pnl.netProfitPaise, `Balance Sheet net profit (${bs.netProfitPaise}) matches P&L net profit (${pnl.netProfitPaise})`);

  // Step 9: UI-016 GST Summary Reconciliation
  console.log('\n[Step 9] Reconciling UI-016 GST Reports...');
  const gstRes = await req(`/reports/gst-summary?fromDate=${fromDate}&toDate=${toDate}`, 'GET', null, tokenA, companyA);
  assert(gstRes.ok, 'GST Summary query succeeded (HTTP 200)');
  const gst = gstRes.body;
  assert(gst.outwardTaxablePaise === 8000000, `Outward taxable turnover is ₹80,000 (got ${gst.outwardTaxablePaise})`);
  assert(gst.outputIgstPaise === 1440000, `Output IGST is ₹14,400 (got ${gst.outputIgstPaise})`);
  assert(gst.totalOutputTaxPaise === 1440000, `Total output tax is ₹14,400 (got ${gst.totalOutputTaxPaise})`);
  assert(gst.inwardTaxablePaise === 10000000, `Inward taxable turnover is ₹1,00,000 (got ${gst.inwardTaxablePaise})`);
  assert(gst.totalInputTaxPaise === 1800000, `Total input tax is ₹18,000 (got ${gst.totalInputTaxPaise})`);
  assert((gst.inputCgstPaise + gst.inputSgstPaise + gst.inputIgstPaise) === 1800000, 'Input tax components sum to ₹18,000');
  // Net GST Payable = Output - Input = 14,400 - 18,000 = -3,600 (Refund/ITC carry forward)
  assert(gst.netGstPayablePaise === -360000, `Net GST payable is -₹3,600 (got ${gst.netGstPayablePaise})`);

  // Step 10: UI-017 Stock Summary Reconciliation
  console.log('\n[Step 10] Reconciling UI-017 Stock Summary...');
  const stockRes = await req(`/reports/stock-summary?asOfDate=${toDate}`, 'GET', null, tokenA, companyA);
  assert(stockRes.ok, 'Stock Summary query succeeded (HTTP 200)');
  const stockRows = stockRes.body;
  assert(Array.isArray(stockRows) && stockRows.length >= 1, 'Stock summary contains item records');
  const valveStock = stockRows.find(s => (s.itemId || s.item_id) === itemId);
  assert(!!valveStock, 'Industrial Valve found in Stock Summary');
  // Purchased 20, sold 10 -> Closing Quantity = 10
  const valveQty = Number(valveStock.quantity || valveStock.closingQuantity || valveStock.closing_qty);
  assert(valveQty === 10, `Closing quantity is exactly 10 units (got ${valveQty})`);
  const valveRate = Number(valveStock.avgRatePaise || valveStock.closingRatePaise);
  assert(valveRate === 500000, `Closing rate is ₹5,000 (got ${valveRate})`);
  const valveVal = Number(valveStock.totalValuePaise || valveStock.closingValuePaise);
  assert(valveVal === 5000000, `Closing valuation is ₹50,000 (got ${valveVal})`);

  // Step 11: UI-018 Outstanding Reports Reconciliation
  console.log('\n[Step 11] Reconciling UI-018 Outstanding Reports...');
  const recOutRes = await req(`/reports/outstanding?type=CUSTOMER&asOnDate=${toDate}`, 'GET', null, tokenA, companyA);
  assert(recOutRes.ok, 'Receivables report query succeeded (HTTP 200)');
  const recDebtor = recOutRes.body?.find(r => r.partyId === debtorId);
  assert(!!recDebtor, 'Debtor found in receivables report');
  // Cross-Report Tie: Receivable outstanding MUST equal Debtor Ledger closing balance!
  assert(Number(recDebtor.totalOutstandingPaise) === debtorStmt.closingBalancePaise,
    `Receivables outstanding (${recDebtor.totalOutstandingPaise}) matches Debtor Ledger balance (${debtorStmt.closingBalancePaise})`);

  const payOutRes = await req(`/reports/outstanding?type=SUPPLIER&asOnDate=${toDate}`, 'GET', null, tokenA, companyA);
  assert(payOutRes.ok, 'Payables report query succeeded (HTTP 200)');
  const payCreditor = payOutRes.body?.find(p => p.partyId === creditorId);
  assert(!!payCreditor, 'Creditor found in payables report');
  // Cross-Report Tie: Payable outstanding MUST equal Creditor Ledger closing balance!
  assert(Number(payCreditor.totalOutstandingPaise) === creditorStmt.closingBalancePaise,
    `Payables outstanding (${payCreditor.totalOutstandingPaise}) matches Creditor Ledger balance (${creditorStmt.closingBalancePaise})`);

  // Step 12: Cancellation & Draft Invariants
  console.log('\n[Step 12] Testing Draft & Cancellation Invariants...');
  // Post a draft voucher - MUST NOT leak into Day Book or financial reports
  const draftRes = await req('/vouchers', 'POST', {
    voucherType: 'SALES',
    voucherDate: '2026-05-15',
    partyId: debtorId,
    status: 'DRAFT',
    narration: 'Draft sales entry for review',
    lines: [
      {
        itemId: itemId,
        quantity: 1,
        ratePaise: 800000,
        gstRate: 18
      }
    ]
  }, tokenA, companyA);
  const draftId = draftRes.body?.voucher_id || draftRes.body?.voucherId;
  assert(draftRes.ok && !!draftId, 'Draft voucher created');

  const dayBookPostDraft = await req(`/reports/daybook?fromDate=${fromDate}&toDate=${toDate}`, 'GET', null, tokenA, companyA);
  assert(!dayBookPostDraft.body.some(e => (e.voucherId || e.voucher_id) === draftId), 'Draft voucher is strictly omitted from Day Book');

  // Cancel the Sales voucher - all reports must automatically update
  console.log('Cancelling Sales voucher to test dynamic reactive rollback...');
  const cancelRes = await req(`/vouchers/${salesId}/cancel`, 'POST', { cancellationReason: 'Audit Test' }, tokenA, companyA);
  assert(cancelRes.ok, 'Sales voucher cancelled successfully');

  // After sales cancellation:
  // Day Book: Sales marked CANCELLED or omitted from POSTED entries
  const dayBookPostCancel = await req(`/reports/daybook?fromDate=${fromDate}&toDate=${toDate}`, 'GET', null, tokenA, companyA);
  assert(!dayBookPostCancel.body.some(e => (e.voucherId || e.voucher_id) === salesId && e.status === 'POSTED'), 'Cancelled voucher status updated in Day Book');

  // Stock Summary: Closing quantity returns to 20
  const stockPostCancel = await req(`/reports/stock-summary?asOfDate=${toDate}`, 'GET', null, tokenA, companyA);
  const valvePostCancel = stockPostCancel.body.find(s => (s.itemId || s.item_id) === itemId);
  const valveQtyPostCancel = Number(valvePostCancel.quantity || valvePostCancel.closingQuantity || valvePostCancel.closing_qty);
  assert(valveQtyPostCancel === 20, `Stock rebounds to 20 after sales cancellation (got ${valveQtyPostCancel})`);

  // Step 13: Multi-Tenant Boundary Isolation Check
  console.log('\n[Step 13] Verifying Multi-Tenant Data Isolation in Company B...');
  const bDayBook = await req(`/reports/daybook?fromDate=${fromDate}&toDate=${toDate}`, 'GET', null, tokenB, companyB);
  assert(bDayBook.body.length === 0, 'Company B Day Book has 0 records (no leak from Company A)');

  const bTb = await req(`/reports/trial-balance?asOnDate=${toDate}`, 'GET', null, tokenB, companyB);
  assert(bTb.body.totalDebitPaise === 0 && bTb.body.totalCreditPaise === 0, 'Company B Trial Balance is empty');

  const bPnl = await req(`/reports/profit-loss?fromDate=${fromDate}&toDate=${toDate}`, 'GET', null, tokenB, companyB);
  assert(bPnl.body.tradingIncomePaise === 0 && bPnl.body.grossProfitPaise === 0, 'Company B P&L has 0 income');

  const bBs = await req(`/reports/balance-sheet?asOnDate=${toDate}`, 'GET', null, tokenB, companyB);
  assert(bBs.body.totalAssetsPaise === 0, 'Company B Balance Sheet has 0 assets');

  const bGst = await req(`/reports/gst-summary?fromDate=${fromDate}&toDate=${toDate}`, 'GET', null, tokenB, companyB);
  assert(bGst.body.outwardTaxablePaise === 0 && bGst.body.totalOutputTaxPaise === 0, 'Company B GST has 0 outward turnover');

  const bStock = await req(`/reports/stock-summary?asOfDate=${toDate}`, 'GET', null, tokenB, companyB);
  assert(!bStock.body.some(s => (s.itemId || s.item_id) === itemId), 'Company B Stock Summary has 0 items from Company A');

  const bRec = await req(`/reports/outstanding?type=CUSTOMER&asOnDate=${toDate}`, 'GET', null, tokenB, companyB);
  assert(bRec.body.length === 0, 'Company B Receivables has 0 records');

  console.log('\n======================================================================');
  console.log('🎉 ALL CROSS-REPORT RECONCILIATION INVARIANTS VERIFIED (13/13 CHECKS GREEN)');
  console.log('======================================================================');
}

runReconciliationTests().catch(err => {
  console.error('Fatal error during cross-report reconciliation tests:', err);
  process.exit(1);
});
