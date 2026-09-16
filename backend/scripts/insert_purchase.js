import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const dbPath = path.resolve('data/ledgerflow.db');
const db = new DatabaseSync(dbPath);

console.log('Fetching active company...');
const company = db.prepare('SELECT * FROM companies LIMIT 1').get();
if (!company) {
    console.error('No company found.');
    process.exit(1);
}
const companyId = company.company_id;
console.log('Company:', company.company_name, `(${companyId})`);

const fy = db.prepare("SELECT * FROM financial_years WHERE company_id = ? AND status = 'OPEN' ORDER BY start_date DESC LIMIT 1").get(companyId);
if (!fy) {
    console.error('No open financial year found.');
    process.exit(1);
}
const fyId = fy.fy_id;
console.log('FY:', fy.name, `(${fyId})`);

// 1. Setup Party (Supplier)
const partyName = 'Next IT World';
let party = db.prepare('SELECT * FROM parties WHERE company_id = ? AND party_name = ?').get(companyId, partyName);
if (!party) {
    console.log('Creating party:', partyName);
    const ledgerId = 'led_pty_' + Date.now().toString(36);
    const partyId = 'party_' + Date.now().toString(36);
    const creditorsGroup = db.prepare("SELECT group_id FROM ledger_groups WHERE company_id = ? AND code = 'SUNDRY_CREDITORS'").get(companyId);
    
    db.prepare("INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type) VALUES (?, ?, ?, ?, 0, 'CR')")
      .run(ledgerId, companyId, creditorsGroup.group_id, partyName);
    
    db.prepare("INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin) VALUES (?, ?, ?, 'SUPPLIER', ?, '33AAFFN5770P1ZR')")
      .run(partyId, companyId, ledgerId, partyName);
    
    party = db.prepare('SELECT * FROM parties WHERE company_id = ? AND party_name = ?').get(companyId, partyName);
}
console.log('Party ID:', party.party_id, 'Ledger ID:', party.ledger_id);

// Ensure Purchase and Tax Ledgers exist
const ensureLedger = (name, code, groupCode) => {
    let led = db.prepare('SELECT * FROM ledgers WHERE company_id = ? AND ledger_name = ?').get(companyId, name);
    if (!led) {
        const grp = db.prepare("SELECT group_id FROM ledger_groups WHERE company_id = ? AND code = ?").get(companyId, groupCode);
        const ledId = 'led_sys_' + Date.now().toString(36) + Math.random().toString(36).substring(2,5);
        db.prepare("INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, code) VALUES (?, ?, ?, ?, ?)").run(ledId, companyId, grp.group_id, name, code);
        led = db.prepare('SELECT * FROM ledgers WHERE company_id = ? AND ledger_name = ?').get(companyId, name);
    }
    return led.ledger_id;
};

const purchaseLedgerId = ensureLedger('Purchase A/c', 'PURCHASE', 'PURCHASE_ACCOUNTS');
const cgstLedgerId = ensureLedger('Input CGST', 'INPUT_CGST', 'DUTIES_AND_TAXES');
const sgstLedgerId = ensureLedger('Input SGST', 'INPUT_SGST', 'DUTIES_AND_TAXES');
const freightLedgerId = ensureLedger('Freight Charges', 'FREIGHT', 'DIRECT_EXPENSES');

// Helper to ensure item
const ensureItem = (name, hsn, qty, rate, sellRate) => {
    let item = db.prepare('SELECT * FROM stock_items WHERE company_id = ? AND item_name = ?').get(companyId, name);
    if (!item) {
        console.log('Creating item:', name);
        const unit = db.prepare('SELECT unit_id FROM units WHERE company_id = ? LIMIT 1').get(companyId);
        const itemId = 'item_' + Date.now().toString(36) + Math.random().toString(36).substring(2,6);
        db.prepare(`
            INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise)
            VALUES (?, ?, ?, ?, ?, 18, ?, ?)
        `).run(itemId, companyId, name, hsn, unit.unit_id, rate * 100, sellRate * 100);
        item = db.prepare('SELECT * FROM stock_items WHERE company_id = ? AND item_name = ?').get(companyId, name);
    }
    return item.item_id;
};

const items = [
    { name: 'Core I5 4TH GEN', hsn: '84733010', qty: 1, rate: 1313.56, amount: 1313.56 },
    { name: 'ZEBRONICS 81 CHIPSET MOTHERBOARD', hsn: '84733020', qty: 1, rate: 1228.81, amount: 1228.81 },
    { name: 'DAICHI 8GB DDR3 DESKTOP RAM', hsn: '84733030', qty: 1, rate: 1525.42, amount: 1525.42 },
    { name: 'EVM 256GB SSD', hsn: '85235100', qty: 1, rate: 2542.37, amount: 2542.37 },
    { name: '1155 CPU FAN', hsn: '84733099', qty: 1, rate: 148.31, amount: 148.31 },
    { name: 'FOXIN CABINET W/O SMPS', hsn: '84733099', qty: 1, rate: 466.10, amount: 466.10 },
    { name: 'EVM 500W SMPS', hsn: '85044029', qty: 1, rate: 360.17, amount: 360.17 }
];

console.log('Preparing to call PostingEngine...');
