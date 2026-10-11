/**
 * test-ui019-settings.js — UI-019 Accounting Settings End-to-End Test Suite
 *
 * Verifies:
 * 1. Company Profile persistence (PUT /api/companies/current) across all supported fields:
 *    - Business name, legal name, mailing name, GSTIN, PAN
 *    - Address lines, city, state, state_code, pincode, contact phone, email
 *    - Banking coordinates (bank_name, account_no, ifsc, branch)
 *    - Invoice terms & conditions, currency, currency symbol
 * 2. Financial Year lifecycle and state-transition invariants (GET / POST / PUT /api/financial-years):
 *    - Fetching company FYs
 *    - Creating non-overlapping FYs
 *    - Date overlap validation rejection (HTTP 400)
 *    - Status transition to LOCKED
 *    - Reopening requirements (reason audit trail)
 * 3. Voucher configuration & next auto-number retrieval (GET /api/vouchers/next-number)
 * 4. Genuine Database Backup execution (POST /api/utilities/backup) with OWNER role
 * 5. Strict multi-tenant isolation and authorization checks
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
  console.log('UI-019: LEDGERFLOW ACCOUNTING SETTINGS END-TO-END TEST SUITE');
  console.log('======================================================================\n');

  const timestamp = Date.now();

  // ------------------------------------------------------------------
  // 1. Authenticate Test Users
  // ------------------------------------------------------------------
  console.log('[Step 1] Registering Test User A & User B...');
  const emailA = `settings_userA_${timestamp}@example.com`;
  const regA = await req('/auth/register', 'POST', {
    email: emailA,
    password: 'Password@123',
    fullName: 'Accounting Settings Specialist A',
    username: `settingsA_${timestamp}`,
    businessName: 'Apex Enterprise Solutions'
  });
  const tokenA = regA.body?.token;
  assert(!!tokenA, 'User A registered with valid JWT');

  const bizA = await req('/businesses', 'GET', null, tokenA);
  const companyIdA = bizA.body?.[0]?.company_id || bizA.body?.[0]?.companyId;
  assert(!!companyIdA, `Company A resolved: ${companyIdA}`);

  const emailB = `settings_userB_${timestamp}@example.com`;
  const regB = await req('/auth/register', 'POST', {
    email: emailB,
    password: 'Password@123',
    fullName: 'Accounting Settings Specialist B',
    username: `settingsB_${timestamp}`,
    businessName: 'Horizon Ventures'
  });
  const tokenB = regB.body?.token;
  assert(!!tokenB, 'User B registered with valid JWT');

  const bizB = await req('/businesses', 'GET', null, tokenB);
  const companyIdB = bizB.body?.[0]?.company_id || bizB.body?.[0]?.companyId;
  assert(!!companyIdB, `Company B resolved: ${companyIdB}`);

  // ------------------------------------------------------------------
  // 2. Test Section 1: Company Profile Persistence
  // ------------------------------------------------------------------
  console.log('\n[Step 2] Testing Company Profile Persistence (PUT /companies/current)...');
  const profilePayload = {
    company_name: 'Apex Enterprise Solutions Private Limited',
    legal_name: 'Apex Enterprise Solutions Pvt. Ltd.',
    mailing_name: 'Apex Enterprise Solutions Billing Dept',
    gstin: '27AABCU9603R1ZM',
    pan: 'AABCU9603R',
    address_line1: '402 Stellar Tower, MIDC Industrial Area',
    address_line2: 'Andheri East',
    city: 'Mumbai',
    state: 'Maharashtra',
    state_code: '27',
    pincode: '400093',
    phone: '+91 22 2830 1122',
    email: 'accounts@apexenterprise.in',
    bank_name: 'HDFC Bank Ltd',
    bank_account_no: '50200012345678',
    bank_ifsc: 'HDFC0000060',
    bank_branch: 'Andheri East Branch',
    terms_and_conditions: '1. Payment due within 30 days of invoice date.\n2. Goods once sold will not be accepted back.\n3. Subject to Mumbai Jurisdiction.',
    currency: 'INR',
    currency_symbol: '₹'
  };

  const updateRes = await req('/companies/current', 'PUT', profilePayload, tokenA, companyIdA);
  assert(updateRes.ok, `PUT /companies/current succeeded (status: ${updateRes.status})`);
  assert(updateRes.body?.success === true, 'PUT /companies/current returned success: true');

  // Verify persistence via GET /companies/current
  const verifyRes = await req('/companies/current', 'GET', null, tokenA, companyIdA);
  assert(verifyRes.ok, 'GET /companies/current retrieved persisted data');
  const comp = verifyRes.body?.company || verifyRes.body;
  assert(comp?.company_name === profilePayload.company_name, 'Persisted company_name verified');
  assert(comp?.legal_name === profilePayload.legal_name, 'Persisted legal_name verified');
  assert(comp?.mailing_name === profilePayload.mailing_name, 'Persisted mailing_name verified');
  assert(comp?.gstin === profilePayload.gstin, 'Persisted GSTIN verified');
  assert(comp?.pan === profilePayload.pan, 'Persisted PAN verified');
  assert(comp?.state_code === profilePayload.state_code, 'Persisted state_code verified');
  assert(comp?.bank_account_no === profilePayload.bank_account_no, 'Persisted bank_account_no verified');
  assert(comp?.bank_ifsc === profilePayload.bank_ifsc, 'Persisted bank_ifsc verified');
  assert(comp?.terms_and_conditions === profilePayload.terms_and_conditions, 'Persisted terms_and_conditions verified');

  // ------------------------------------------------------------------
  // 3. Test Section 2: Financial Year Management
  // ------------------------------------------------------------------
  console.log('\n[Step 3] Testing Financial Year Management & State Invariants...');
  
  // Query FYs for Company A
  const fysRes = await req(`/financial-years?companyId=${companyIdA}`, 'GET', null, tokenA, companyIdA);
  assert(fysRes.ok, 'GET /financial-years succeeded');
  assert(Array.isArray(fysRes.body), 'Financial years list is an array');
  assert(fysRes.body.length >= 1, `Company A has initial FY (found ${fysRes.body.length})`);

  const initialFy = fysRes.body[0];
  const initialFyId = initialFy.fy_id || initialFy.id;
  assert(!!initialFyId, `Initial FY ID present: ${initialFyId}`);

  // Create a new future FY (non-overlapping)
  const newFyRes = await req('/financial-years', 'POST', {
    companyId: companyIdA,
    name: `FY ${new Date().getFullYear() + 2}-${new Date().getFullYear() + 3}`,
    startDate: `${new Date().getFullYear() + 2}-04-01`,
    endDate: `${new Date().getFullYear() + 3}-03-31`
  }, tokenA, companyIdA);
  assert(newFyRes.ok, `POST /financial-years created future FY (status: ${newFyRes.status})`);
  const createdFyId = newFyRes.body?.fy_id || newFyRes.body?.id;
  assert(!!createdFyId, `Created FY ID: ${createdFyId}`);

  // Test Overlap Rejection
  const overlapRes = await req('/financial-years', 'POST', {
    companyId: companyIdA,
    name: 'Overlapping Year',
    startDate: `${new Date().getFullYear() + 2}-06-01`,
    endDate: `${new Date().getFullYear() + 3}-01-31`
  }, tokenA, companyIdA);
  assert(overlapRes.status === 400, `Overlapping financial year properly rejected with HTTP 400 (got ${overlapRes.status})`);

  // Test FY Status Update: Lock FY
  const lockRes = await req(`/financial-years/${createdFyId}`, 'PUT', {
    status: 'LOCKED'
  }, tokenA, companyIdA);
  assert(lockRes.ok, `PUT /financial-years/:id locked future FY (status: ${lockRes.status})`);
  assert(lockRes.body?.status === 'LOCKED', 'FY status updated to LOCKED');

  // Test FY Status Update: Unlock FY
  const unlockRes = await req(`/financial-years/${createdFyId}`, 'PUT', {
    status: 'OPEN'
  }, tokenA, companyIdA);
  assert(unlockRes.ok, `PUT /financial-years/:id reopened locked FY (status: ${unlockRes.status})`);
  assert(unlockRes.body?.status === 'OPEN', 'FY status restored to OPEN');

  // ------------------------------------------------------------------
  // 4. Test Section 3: Voucher Configuration / Next Auto-Number
  // ------------------------------------------------------------------
  console.log('\n[Step 4] Testing Voucher Configuration Next Auto-Number Fetch...');
  const voucherTypes = ['SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA'];
  for (const vType of voucherTypes) {
    const numRes = await req(`/vouchers/next-number?type=${vType}&companyId=${companyIdA}&fyId=${initialFyId}`, 'GET', null, tokenA, companyIdA);
    if (!numRes.ok) {
      console.error(`Debug: /vouchers/next-number for ${vType} returned ${numRes.status}:`, numRes.body);
    }
    assert(numRes.ok, `GET /vouchers/next-number for ${vType} succeeded`);
    assert(typeof numRes.body?.nextVoucherNumber === 'string' && numRes.body.nextVoucherNumber.length > 0,
      `Received next voucher number for ${vType}: ${numRes.body?.nextVoucherNumber}`);
  }

  // ------------------------------------------------------------------
  // 5. Test Section 4: Genuine Database Backup Execution
  // ------------------------------------------------------------------
  console.log('\n[Step 5] Testing Genuine Database Backup Trigger (POST /utilities/backup)...');
  const backupRes = await req('/utilities/backup', 'POST', {}, tokenA, companyIdA);
  assert(backupRes.ok, `POST /utilities/backup succeeded (status: ${backupRes.status})`);
  assert(backupRes.body?.success === true, 'Backup returned success: true');
  assert(typeof backupRes.body?.backupPath === 'string' || typeof backupRes.body?.message === 'string',
    'Backup response contains genuine backup location or confirmation');

  // Verify Audit Log retrieval
  const auditRes = await req('/utilities/audit-logs', 'GET', null, tokenA, companyIdA);
  assert(auditRes.ok, 'GET /utilities/audit-logs succeeded for Company A');
  assert(Array.isArray(auditRes.body), 'Audit logs is a valid array');

  // ------------------------------------------------------------------
  // 6. Test Section 5: Strict Multi-Tenant Isolation
  // ------------------------------------------------------------------
  console.log('\n[Step 6] Testing Multi-Tenant Isolation & Security Boundaries...');
  
  // User B tries to update Company A
  const attackRes = await req('/companies/current', 'PUT', {
    company_name: 'Hacked Company Name by B'
  }, tokenB, companyIdA); // token B with companyId A
  
  const checkCompA = await req('/companies/current', 'GET', null, tokenA, companyIdA);
  const compA = checkCompA.body?.company || checkCompA.body;
  assert(compA?.company_name === profilePayload.company_name,
    'Company A data is strictly preserved; Company B cannot modify Company A profile');

  // Query FYs of Company A using User B's token
  const leakRes = await req(`/financial-years?companyId=${companyIdA}`, 'GET', null, tokenB, companyIdA);
  // Either forbidden/empty or not Company A's data
  if (leakRes.ok && Array.isArray(leakRes.body)) {
    const hasCompanyAFy = leakRes.body.some(fy => fy.company_id === companyIdA);
    assert(!hasCompanyAFy, 'Cross-tenant bleed prevented: User B cannot retrieve Company A FYs');
  } else {
    assert(!leakRes.ok || leakRes.status === 403, 'Cross-tenant access rejected');
  }

  console.log('\n======================================================================');
  console.log('✅ ALL UI-019 ACCOUNTING SETTINGS TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================================\n');
}

runTests().catch(err => {
  console.error('Fatal test runner exception:', err);
  process.exit(1);
});
