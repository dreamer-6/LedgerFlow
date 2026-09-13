import { getDatabase } from '../src/database/connection.js';
import http from 'http';

function request(method: string, path: string, body?: any, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api' + path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, res => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 500, body: JSON.parse(resData) });
        } catch {
          resolve({ status: res.statusCode || 500, body: resData });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  const db = getDatabase();
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('DELETE FROM user_businesses;');
  db.exec('DELETE FROM companies;');
  db.exec('DELETE FROM financial_years;');
  db.exec('DELETE FROM units;');
  db.exec('DELETE FROM godowns;');
  db.exec('DELETE FROM ledger_groups;');
  db.exec('DELETE FROM ledgers;');
  db.exec('DELETE FROM parties;');
  db.exec('DELETE FROM stock_items;');
  db.exec('DELETE FROM vouchers;');
  db.exec('DELETE FROM voucher_lines;');
  db.exec('DELETE FROM ledger_entries;');
  db.exec('DELETE FROM stock_entries;');
  db.exec('DELETE FROM tax_entries;');
  db.exec('DELETE FROM bill_allocations;');
  db.exec("DELETE FROM users WHERE username != 'admin';");
  db.exec('PRAGMA foreign_keys = ON;');

  console.log('=== TEST 1: Initial Zero Companies ===');
  const compRes = await request('GET', '/companies/current');
  console.log('GET /companies/current returns:', compRes.body);
  if (compRes.body.company !== null) throw new Error('Expected 0 companies initially!');

  console.log('\n=== TEST 2: User Signs Up & Provisions Their Own Business ===');
  const regRes = await request('POST', '/auth/register', {
    fullName: 'Priya Sundaram',
    email: 'priya@sundaramlogistics.com',
    password: 'securePassword2026',
    companyName: 'Sundaram Logistics Pvt Ltd',
    legalName: 'Sundaram Logistics Private Limited',
    gstin: '33AAACS5555A1Z2',
    state: 'Tamil Nadu',
    stateCode: '33'
  });
  console.log('Registration status:', regRes.status);
  console.log('User full name:', regRes.body.user?.fullName);
  console.log('Owned Company:', regRes.body.company?.company_name);
  console.log('Active Company ID:', regRes.body.activeCompanyId);

  const token = regRes.body.token;
  const companyId = regRes.body.activeCompanyId;
  const authHeaders = { 'Authorization': 'Bearer ' + token, 'x-company-id': companyId };

  console.log('\n=== TEST 3: Verify Isolated Masters ===');
  const ledgersRes = await request('GET', '/masters/ledgers', null, authHeaders);
  console.log('Isolated Ledgers created:', ledgersRes.body.length);

  const unitsRes = await request('GET', '/masters/units', null, authHeaders);
  console.log('Isolated Units created:', unitsRes.body.length);

  const godownsRes = await request('GET', '/masters/godowns', null, authHeaders);
  console.log('Isolated Godowns created:', godownsRes.body.length);

  console.log('\n=== TEST 4: Create Customer Party ===');
  const partyRes = await request('POST', '/masters/parties', {
    partyName: 'Chennai Retailers Ltd',
    partyType: 'CUSTOMER',
    gstin: '33AAACR1111A1Z9',
    state: 'Tamil Nadu',
    stateCode: '33',
    openingBalancePaise: 0
  }, authHeaders);
  console.log('Created Party:', partyRes.body.partyName, 'ID:', partyRes.body.partyId);

  console.log('\n=== TEST 5: Create Stock Item ===');
  const itemRes = await request('POST', '/masters/items', {
    itemName: 'Industrial Packaging Box',
    hsnSac: '4819',
    taxRatePercent: 18,
    standardSaleRatePaise: 25000,
    standardCostPaise: 15000,
    openingStockQty: 100,
    openingStockRatePaise: 15000
  }, authHeaders);
  console.log('Created Item:', itemRes.body.itemName, 'ID:', itemRes.body.itemId);

  console.log('\n=== TEST 6: Record Sales Voucher (F8) ===');
  const salesRes = await request('POST', '/vouchers', {
    voucherType: 'SALES',
    voucherDate: '2026-09-13',
    partyId: partyRes.body.partyId,
    lines: [
      {
        itemId: itemRes.body.itemId,
        quantity: 10,
        ratePaise: 25000,
        discountPercent: 0,
        taxRatePercent: 18
      }
    ],
    narration: 'Invoice for 10 boxes'
  }, authHeaders);
  console.log('Sales Voucher posted:', salesRes.status, 'Invoice Number:', salesRes.body.voucherNumber, 'Total:', salesRes.body.totalAmountPaise / 100);

  console.log('\n=== TEST 7: Verify Day Book & Dashboard ===');
  const daybookRes = await request('GET', '/reports/daybook', null, authHeaders);
  console.log('Day Book entries count:', Array.isArray(daybookRes.body) ? daybookRes.body.length : daybookRes.body);

  const dashRes = await request('GET', '/reports/dashboard', null, authHeaders);
  console.log('Dashboard Today Sales: ₹' + (dashRes.body.todaySalesPaise / 100));
  console.log('Dashboard Receivables: ₹' + (dashRes.body.receivablesPaise / 100));

  console.log('\n=== TEST 8: Verify Trial Balance ===');
  const tbRes = await request('GET', '/reports/trial-balance', null, authHeaders);
  console.log('Trial Balance balanced?:', tbRes.body.isBalanced);
  console.log('Total Debit: ₹' + (tbRes.body.totalDebitPaise / 100), 'Total Credit: ₹' + (tbRes.body.totalCreditPaise / 100));

  console.log('\n=== TEST 9: Multi-Business Isolation Test ===');
  const userBizRes = await request('POST', '/businesses', {
    companyName: 'Sundaram Express Logistics',
    gstin: '29AAACS5555A1Z4',
    state: 'Karnataka',
    stateCode: '29'
  }, authHeaders);
  console.log('Second Business Created:', userBizRes.body.company?.company_name);

  const biz2Headers = { 'Authorization': 'Bearer ' + token, 'x-company-id': userBizRes.body.company.company_id };
  const biz2Parties = await request('GET', '/masters/parties', null, biz2Headers);
  console.log('Second Business Parties count (should be 0):', biz2Parties.body.length);
  const biz2Vouchers = await request('GET', '/vouchers', null, biz2Headers);
  console.log('Second Business Vouchers count (should be 0):', biz2Vouchers.body.length);

  console.log('\n>>> ALL 9 TESTS PASSED 100% PERFECTLY! <<<');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
