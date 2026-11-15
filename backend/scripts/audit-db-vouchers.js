const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('LedgerFlow/backend/data/ledgerflow.db');

const dups = db.prepare(`
  SELECT voucher_id, COUNT(*) as cnt 
  FROM vouchers 
  WHERE company_id = 'comp_mv9xns2lgszp' AND status = 'POSTED'
  GROUP BY voucher_id 
  HAVING cnt > 1
`).all();
console.log('Duplicate voucher IDs:', dups);

const numDups = db.prepare(`
  SELECT voucher_type, voucher_number, COUNT(*) as cnt 
  FROM vouchers 
  WHERE company_id = 'comp_mv9xns2lgszp' AND status = 'POSTED'
  GROUP BY voucher_type, voucher_number 
  HAVING cnt > 1
`).all();
console.log('Duplicate voucher numbers:', numDups);

const allVchs = db.prepare(`
  SELECT voucher_type, COUNT(*) as cnt
  FROM vouchers
  WHERE company_id = 'comp_mv9xns2lgszp' AND status = 'POSTED'
  GROUP BY voucher_type
`).all();
console.log('Voucher counts by type:', allVchs);

