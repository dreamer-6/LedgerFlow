const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('LedgerFlow/backend/data/ledgerflow.db');

const salesVouchers = db.prepare(`
  SELECT voucher_id, voucher_number, voucher_date, party_id, reference_number, total_amount_paise, status, created_at, cancellation_reason
  FROM vouchers
  WHERE company_id = 'comp_mv9xns2lgszp' AND voucher_type = 'SALES'
  ORDER BY voucher_number ASC
`).all();

console.log('All Sales Vouchers in DB:');
console.table(salesVouchers);

// Check party names
const parties = db.prepare(`SELECT party_id, party_name FROM parties WHERE company_id = 'comp_mv9xns2lgszp'`).all();
const partyMap = Object.fromEntries(parties.map(p => [p.party_id, p.party_name]));

salesVouchers.forEach(v => {
  console.log(`${v.voucher_number} | Date: ${v.voucher_date} | Status: ${v.status} | Party: ${partyMap[v.party_id] || v.party_id} | Created: ${v.created_at} | Reason: ${v.cancellation_reason || ''}`);
});

