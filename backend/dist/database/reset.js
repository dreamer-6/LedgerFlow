"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetAllData = resetAllData;
const connection_js_1 = require("./connection.js");
function resetAllData(db = (0, connection_js_1.getDatabase)()) {
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
        vouchers: db.prepare('SELECT COUNT(*) as c FROM vouchers').get().c,
        parties: db.prepare('SELECT COUNT(*) as c FROM parties').get().c,
        stock_items: db.prepare('SELECT COUNT(*) as c FROM stock_items').get().c,
        ledger_entries: db.prepare('SELECT COUNT(*) as c FROM ledger_entries').get().c,
        core_ledgers: db.prepare('SELECT COUNT(*) as c FROM ledgers').get().c
    };
}
if (process.argv[1] && process.argv[1].includes('reset.ts')) {
    const result = resetAllData();
    console.log('Reset complete successfully:');
    console.log(JSON.stringify(result, null, 2));
}
