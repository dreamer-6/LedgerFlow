const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('LedgerFlow/backend/data/ledgerflow.db');
const rows = db.prepare(`
  SELECT v.voucher_id, v.voucher_number, v.voucher_date, p.party_name, v.status, v.created_at
  FROM vouchers v
  LEFT JOIN parties p ON v.party_id = p.party_id
  WHERE v.company_id = 'comp_mv9xns2lgszp' AND v.voucher_type = 'SALES'
  ORDER BY v.voucher_date DESC, v.voucher_number DESC
`).all();
console.table(rows);

