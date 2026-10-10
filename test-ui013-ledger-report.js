/**
 * test-ui013-ledger-report.js — UI-013 Ledger Report Dedicated End-to-End Test Suite
 *
 * Verifies:
 * 1. Ledger Statement Retrieval (GET /api/reports/ledger/:id)
 *    - Validates authoritative schema: ledgerName, openingBalancePaise, openingBalanceType,
 *      closingBalancePaise, closingBalanceType, lines: LedgerStatementLine[]
 *    - Validates line properties: date, voucherNumber, voucherType, particulars, debitPaise, creditPaise, runningBalancePaise, balanceType
 * 2. Mathematical Parity & Running Balance Consistency
 *    - Opening balance accurately accumulates pre-period transactions and baseline ledger opening balance
 *    - Each line's running balance follows double-entry arithmetic
 *    - Closing balance matches the final running balance
 * 3. Date Boundary Enforcement
 *    - Transactions prior to fromDate aggregate strictly into openingBalancePaise
 *    - Transactions between fromDate and toDate appear in the transaction stream
 *    - Transactions after toDate are omitted from both opening balance and stream
 * 4. Voucher Lifecycle & Status Integrity (POSTED Only)
 *    - Cancelled vouchers are excluded from balances and lines
 * 5. Multi-Tenant Company Isolation
 *    - Attempting to access Company A's ledger with Company B headers fails with tenant rejection
 * 6. Voucher Drill-Down Integrity
 *    - Vouchers in statement lines resolve via GET /api/vouchers/:id
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

async function runTests() {
  console.log('======================================================================');
  console.log('UI-013: LEDGER REPORT END-TO-END VERIFICATION');
  console.log('======================================================================\n');

  const timestamp = Date.now();

  // 1. Authenticate user & resolve company A & B
  console.log('[Step 1] Authenticating Test User A & User B...');
  const emailA = `ledger_userA_${timestamp}@example.com`;
  const regA = await req('/auth/register', 'POST', {
    email: emailA,
    password: 'Password@123',
    fullName: 'Ledger Accountant A',
    username: `ledgerA_${timestamp}`,
    businessName: 'Alpha Ledger Corp'
  });
  const tokenA = regA.body?.token;
  assert(!!tokenA, 'User A registered with JWT');

  const bizA = await req('/businesses', 'GET', null, tokenA);
  const companyIdA = bizA.body?.[0]?.company_id || bizA.body?.[0]?.companyId;
  assert(!!companyIdA, `Company A resolved: ${companyIdA}`);

  const emailB = `ledger_userB_${timestamp}@example.com`;
  const regB = await req('/auth/register', 'POST', {
    email: emailB,
    password: 'Password@123',
    fullName: 'Ledger Auditor B',
    username: `ledgerB_${timestamp}`,
    businessName: 'Beta Logistics Corp'
  });
  const tokenB = regB.body?.token;
  assert(!!tokenB, 'User B registered with JWT');

  const bizB = await req('/businesses', 'GET', null, tokenB);
  const companyIdB = bizB.body?.[0]?.company_id || bizB.body?.[0]?.companyId;
  assert(!!companyIdB, `Company B resolved: ${companyIdB}`);

  // 2. Setup Party, Item, and Ledgers in Company A
  console.log('\n[Step 2] Setting up Party and Item in Company A...');
  const partyRes = await req('/masters/parties', 'POST', {
    partyName: `Customer Sigma ${timestamp}`,
    partyType: 'CUSTOMER',
    addressLine1: '456 Commercial Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    stateCode: '29',
    gstin: '29ABCDE1234F1Z5',
    phone: '9876543210',
    email: 'sigma@customer.in'
  }, tokenA, companyIdA);
  const partyIdA = partyRes.body?.party_id || partyRes.body?.partyId;
  const partyLedgerIdA = partyRes.body?.ledger_id || partyRes.body?.ledgerId;
  assert(!!partyIdA, `Party created for Company A: ${partyIdA}`);

  // Resolve debtor ledger if not returned directly
  let debtorLedgerId = partyLedgerIdA;
  if (!debtorLedgerId) {
    const ledgersRes = await req('/masters/ledgers', 'GET', null, tokenA, companyIdA);
    const debtor = ledgersRes.body?.find(l => l.ledger_name.includes(`Customer Sigma ${timestamp}`));
    debtorLedgerId = debtor?.ledger_id;
  }
  assert(!!debtorLedgerId, `Resolved Debtor ledger ID: ${debtorLedgerId}`);

  const itemRes = await req('/masters/items', 'POST', {
    itemName: `Consulting Unit ${timestamp}`,
    hsnSac: '998311',
    sellingRatePaise: 1000000, // ₹10,000
    gstRate: 18
  }, tokenA, companyIdA);
  const itemIdA = itemRes.body?.item_id || itemRes.body?.itemId;
  assert(!!itemIdA, `Item created for Company A: ${itemIdA}`);

  // 3. Post Vouchers across different date periods
  // FY 2026-27: 2026-04-01 to 2027-03-31
  console.log('\n[Step 3] Creating and posting vouchers with temporal boundaries...');
  
  // Voucher 1: Prior date (2026-04-15) -> Should be inside Opening Balance when querying 2026-05-01..2026-05-31
  const v1 = await req('/vouchers', 'POST', {
    voucherType: 'SALES',
    voucherDate: '2026-04-15',
    partyId: partyIdA,
    narration: 'Voucher 1: Pre-period Sales invoice',
    allowNegativeStock: true,
    lines: [{ itemId: itemIdA, quantity: 1, ratePaise: 1000000, gstRate: 0 }] // ₹10,000 Dr
  }, tokenA, companyIdA);
  assert(v1.ok, 'Voucher 1 (Pre-period: 2026-04-15) posted');
  const v1Id = v1.body?.voucher_id || v1.body?.voucherId;

  // Voucher 2: In-period date (2026-05-10) -> Should appear as Line 1
  const v2 = await req('/vouchers', 'POST', {
    voucherType: 'SALES',
    voucherDate: '2026-05-10',
    partyId: partyIdA,
    narration: 'Voucher 2: In-period Sales invoice',
    allowNegativeStock: true,
    lines: [{ itemId: itemIdA, quantity: 2, ratePaise: 1000000, gstRate: 0 }] // ₹20,000 Dr
  }, tokenA, companyIdA);
  assert(v2.ok, 'Voucher 2 (In-period: 2026-05-10) posted');
  const v2Id = v2.body?.voucher_id || v2.body?.voucherId;

  // Resolve cash ledger for receipt voucher
  const allLedgersA = await req('/masters/ledgers', 'GET', null, tokenA, companyIdA);
  const cashLedger = allLedgersA.body?.find(l => l.ledger_name.toLowerCase().includes('cash'));
  const cashLedgerId = cashLedger?.ledger_id || `${companyIdA}_led_cash`;

  // Voucher 3: In-period receipt (2026-05-20) -> Should appear as Line 2
  const v3 = await req('/vouchers', 'POST', {
    voucherType: 'RECEIPT',
    voucherDate: '2026-05-20',
    partyId: partyIdA,
    narration: 'Voucher 3: In-period Customer Payment Received',
    paymentMode: 'Cash',
    lines: [],
    customLedgerLines: [
      { ledgerId: cashLedgerId, debitPaise: 500000, creditPaise: 0, particulars: 'Cash In Hand' },
      { ledgerId: debtorLedgerId, debitPaise: 0, creditPaise: 500000, particulars: 'By Customer Sigma' }
    ]
  }, tokenA, companyIdA);
  assert(v3.ok, 'Voucher 3 (In-period Receipt: 2026-05-20) posted');
  const v3Id = v3.body?.voucher_id || v3.body?.voucherId;

  // Voucher 4: Future date (2026-06-15) -> Should be omitted from 2026-05-01..2026-05-31 query
  const v4 = await req('/vouchers', 'POST', {
    voucherType: 'SALES',
    voucherDate: '2026-06-15',
    partyId: partyIdA,
    narration: 'Voucher 4: Future Sales invoice',
    allowNegativeStock: true,
    lines: [{ itemId: itemIdA, quantity: 1, ratePaise: 1000000, gstRate: 0 }] // ₹10,000 Dr
  }, tokenA, companyIdA);
  assert(v4.ok, 'Voucher 4 (Future: 2026-06-15) posted');
  const v4Id = v4.body?.voucher_id || v4.body?.voucherId;

  // 4. Query Ledger Statement via GET /reports/ledger/:id
  console.log('\n[Step 4] Querying Ledger Statement for period 2026-05-01 to 2026-05-31...');
  const fromDate = '2026-05-01';
  const toDate = '2026-05-31';
  const stmtRes = await req(`/reports/ledger/${debtorLedgerId}?fromDate=${fromDate}&toDate=${toDate}`, 'GET', null, tokenA, companyIdA);

  assert(stmtRes.ok, 'GET /reports/ledger/:id returned HTTP 200');
  const stmt = stmtRes.body;
  
  assert(typeof stmt.ledgerName === 'string', `Statement has ledgerName: ${stmt.ledgerName}`);
  assert(typeof stmt.openingBalancePaise === 'number', `Statement has openingBalancePaise: ${stmt.openingBalancePaise}`);
  assert(['DR', 'CR'].includes(stmt.openingBalanceType), `Statement openingBalanceType is DR or CR: ${stmt.openingBalanceType}`);
  assert(typeof stmt.closingBalancePaise === 'number', `Statement has closingBalancePaise: ${stmt.closingBalancePaise}`);
  assert(['DR', 'CR'].includes(stmt.closingBalanceType), `Statement closingBalanceType is DR or CR: ${stmt.closingBalanceType}`);
  assert(Array.isArray(stmt.lines), 'Statement contains lines array');

  // Verify Opening Balance reflects Voucher 1 (₹10,000 = 1,000,000 paise Dr)
  console.log('\n[Step 5] Validating Opening Balance & Boundary Enforcement...');
  assert(stmt.openingBalancePaise === 1000000, `Opening balance exactly equals pre-period Voucher 1 (1,000,000 paise): ${stmt.openingBalancePaise}`);
  assert(stmt.openingBalanceType === 'DR', `Opening balance is DR: ${stmt.openingBalanceType}`);

  // Verify Lines contain only in-period vouchers (Voucher 2 and Voucher 3)
  assert(stmt.lines.length === 2, `Lines array contains exactly 2 in-period transactions (found ${stmt.lines.length})`);
  const foundV2 = stmt.lines.find(l => l.voucherNumber && (l.date === '2026-05-10'));
  const foundV3 = stmt.lines.find(l => l.voucherNumber && (l.date === '2026-05-20'));
  assert(!!foundV2, 'In-period Voucher 2 (2026-05-10) is present in lines');
  assert(!!foundV3, 'In-period Voucher 3 (2026-05-20) is present in lines');

  // Verify pre-period (V1) and future (V4) vouchers do NOT appear in the lines
  const foundV1 = stmt.lines.find(l => l.date === '2026-04-15');
  const foundV4 = stmt.lines.find(l => l.date === '2026-06-15');
  assert(!foundV1, 'Pre-period Voucher 1 (2026-04-15) is NOT in lines (properly rolled into opening balance)');
  assert(!foundV4, 'Future Voucher 4 (2026-06-15) is NOT in lines');

  // 6. Verify Running Balance and Mathematical Consistency
  console.log('\n[Step 6] Validating Running Balance and Double-Entry Parity...');
  let rolling = stmt.openingBalanceType === 'DR' ? stmt.openingBalancePaise : -stmt.openingBalancePaise;
  for (let i = 0; i < stmt.lines.length; i++) {
    const line = stmt.lines[i];
    rolling += (line.debitPaise - line.creditPaise);
    const expectedType = rolling >= 0 ? 'DR' : 'CR';
    const expectedMagnitude = Math.abs(rolling);

    assert(line.runningBalancePaise === expectedMagnitude, `Line ${i + 1} runningBalancePaise matches arithmetic (${line.runningBalancePaise})`);
    assert(line.balanceType === expectedType, `Line ${i + 1} balanceType matches expected (${line.balanceType})`);
  }

  // Closing balance must equal last line's running balance
  const lastLine = stmt.lines[stmt.lines.length - 1];
  assert(stmt.closingBalancePaise === lastLine.runningBalancePaise, `Closing balance matches final running balance: ${stmt.closingBalancePaise}`);
  assert(stmt.closingBalanceType === lastLine.balanceType, `Closing balance type matches final balance type: ${stmt.closingBalanceType}`);

  // 7. Multi-Tenant Company Isolation
  console.log('\n[Step 7] Testing Cross-Company Multi-Tenant Isolation...');
  // User B tries to access Company A's ledger statement
  const leakAttempt = await req(`/reports/ledger/${debtorLedgerId}?fromDate=${fromDate}&toDate=${toDate}`, 'GET', null, tokenB, companyIdB);
  assert(!leakAttempt.ok || leakAttempt.status >= 400, `Company B access to Company A ledger is strictly rejected (status: ${leakAttempt.status})`);

  // 8. Voucher Drill-Down Verification
  console.log('\n[Step 8] Verifying Voucher Drill-Down Integrity...');
  const v2Fetch = await req(`/vouchers/${v2Id}`, 'GET', null, tokenA, companyIdA);
  assert(v2Fetch.ok, `Voucher ${v2Id} successfully retrieved via drill-down route`);
  const returnedVoucherId = v2Fetch.body?.voucher?.voucher_id || v2Fetch.body?.voucher_id;
  assert(returnedVoucherId === v2Id, 'Retrieved voucher ID matches drill-down target');

  // 9. Cancelled Voucher Exclusion
  console.log('\n[Step 9] Validating Cancellation Handling...');
  // Cancel Voucher 2
  const cancelRes = await req(`/vouchers/${v2Id}/cancel`, 'POST', { reason: 'Test cancellation' }, tokenA, companyIdA);
  assert(cancelRes.ok, `Voucher 2 cancelled successfully`);

  // Re-query statement
  const postCancelStmt = await req(`/reports/ledger/${debtorLedgerId}?fromDate=${fromDate}&toDate=${toDate}`, 'GET', null, tokenA, companyIdA);
  assert(postCancelStmt.ok, 'Re-queried ledger statement post-cancellation');
  const cancelledFound = postCancelStmt.body.lines.find(l => l.date === '2026-05-10');
  assert(!cancelledFound, 'Cancelled Voucher 2 is excluded from statement lines');
  assert(postCancelStmt.body.lines.length === 1, 'Only non-cancelled Voucher 3 remains in statement lines');

  console.log('\n======================================================================');
  console.log('✅ UI-013: ALL LEDGER REPORT VERIFICATION CHECKS PASSED');
  console.log('======================================================================\n');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
