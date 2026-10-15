import { getDatabase } from './connection.js';

export function resetAllData(db = getDatabase(), options: { includeAccountsAndCompanies?: boolean } = {}) {
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('DELETE FROM audit_logs;');
  try { db.exec('DELETE FROM stock_item_serials;'); } catch {}
  db.exec('DELETE FROM bill_allocations;');
  db.exec('DELETE FROM tax_entries;');
  db.exec('DELETE FROM stock_entries;');
  db.exec('DELETE FROM ledger_entries;');
  db.exec('DELETE FROM voucher_lines;');
  db.exec('DELETE FROM vouchers;');
  db.exec('DELETE FROM party_addresses;');
  db.exec('DELETE FROM parties;');
  db.exec('DELETE FROM stock_items;');

  if (options.includeAccountsAndCompanies) {
    db.exec('DELETE FROM godowns;');
    db.exec('DELETE FROM units;');
    db.exec('DELETE FROM financial_years;');
    db.exec('DELETE FROM ledgers;');
    db.exec('DELETE FROM ledger_groups;');
    try { db.exec('DELETE FROM user_businesses;'); } catch {}
    db.exec('DELETE FROM companies;');
    db.exec('DELETE FROM users;');
    try { db.exec('DELETE FROM sqlite_sequence;'); } catch {}
  } else {
    db.exec('DELETE FROM ledgers WHERE is_party = 1;');
  }

  db.exec('PRAGMA foreign_keys = ON;');
  try { db.exec('VACUUM;'); } catch {}

  return {
    users: (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c,
    companies: (db.prepare('SELECT COUNT(*) as c FROM companies').get() as any).c,
    vouchers: (db.prepare('SELECT COUNT(*) as c FROM vouchers').get() as any).c,
    parties: (db.prepare('SELECT COUNT(*) as c FROM parties').get() as any).c,
    stock_items: (db.prepare('SELECT COUNT(*) as c FROM stock_items').get() as any).c,
    ledger_entries: (db.prepare('SELECT COUNT(*) as c FROM ledger_entries').get() as any).c,
    ledgers: (db.prepare('SELECT COUNT(*) as c FROM ledgers').get() as any).c
  };
}

if (process.argv[1] && process.argv[1].includes('reset.ts')) {
  const wipeAll = process.argv.includes('--all') || process.argv.includes('--fresh');
  const result = resetAllData(getDatabase(), { includeAccountsAndCompanies: wipeAll });
  console.log('Reset complete successfully:');
  console.log(JSON.stringify(result, null, 2));
}

