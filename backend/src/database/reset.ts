import { getDatabase } from './connection.js';

export function resetAllData(db = getDatabase()) {
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('DELETE FROM bill_allocations;');
  db.exec('DELETE FROM tax_entries;');
  db.exec('DELETE FROM stock_entries;');
  db.exec('DELETE FROM ledger_entries;');
  db.exec('DELETE FROM voucher_lines;');
  db.exec('DELETE FROM vouchers;');
  db.exec('DELETE FROM party_addresses;');
  db.exec('DELETE FROM parties;');
  db.exec('DELETE FROM stock_items;');
  db.exec('DELETE FROM ledgers WHERE is_party = 1;');
  db.exec('PRAGMA foreign_keys = ON;');

  return {
    vouchers: (db.prepare('SELECT COUNT(*) as c FROM vouchers').get() as any).c,
    parties: (db.prepare('SELECT COUNT(*) as c FROM parties').get() as any).c,
    stock_items: (db.prepare('SELECT COUNT(*) as c FROM stock_items').get() as any).c,
    ledger_entries: (db.prepare('SELECT COUNT(*) as c FROM ledger_entries').get() as any).c,
    core_ledgers: (db.prepare('SELECT COUNT(*) as c FROM ledgers').get() as any).c
  };
}

if (process.argv[1] && process.argv[1].includes('reset.ts')) {
  const result = resetAllData();
  console.log('Reset complete successfully:');
  console.log(JSON.stringify(result, null, 2));
}
