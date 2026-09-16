"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterController = void 0;
const routes_js_1 = require("../api/routes.js");
class MasterController {
    db;
    constructor(db) {
        this.db = db;
    }
    getLedgers = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            const companyId = (0, routes_js_1.resolveCompanyId)(req, this.db, user);
            if (!companyId)
                return res.json([]);
            const rows = this.db.prepare(`
        SELECT l.*, g.group_name, g.nature
        FROM ledgers l
        JOIN ledger_groups g ON l.group_id = g.group_id
        WHERE l.company_id = ? AND l.is_active = 1
        ORDER BY l.ledger_name ASC
      `).all(companyId);
            res.json(rows);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    createLedger = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            const targetCompanyId = req.body.companyId || (0, routes_js_1.resolveCompanyId)(req, this.db, user);
            const { groupId, ledgerName, code, openingBalancePaise, openingBalanceType } = req.body;
            const ledgerId = 'led_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
            this.db.prepare(`
        INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, code, opening_balance_paise, opening_balance_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(ledgerId, targetCompanyId, groupId, ledgerName, code || null, openingBalancePaise || 0, openingBalanceType || 'DR');
            res.status(201).json({ ledgerId, ledgerName });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    getGroups = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            const companyId = (0, routes_js_1.resolveCompanyId)(req, this.db, user);
            if (!companyId)
                return res.json([]);
            const rows = this.db.prepare('SELECT * FROM ledger_groups WHERE company_id = ? OR company_id IS NULL ORDER BY group_name ASC').all(companyId);
            res.json(rows);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    getParties = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            const companyId = (0, routes_js_1.resolveCompanyId)(req, this.db, user);
            if (!companyId)
                return res.json([]);
            const type = req.query.type;
            let query = `
        SELECT p.*, pa.address_line1, pa.address_line2, pa.city, pa.state, pa.state_code, pa.pincode,
               l.opening_balance_paise, l.opening_balance_type,
               (COALESCE(l.opening_balance_paise * (CASE WHEN l.opening_balance_type = 'DR' THEN 1 ELSE -1 END), 0) +
                COALESCE((SELECT SUM(le.debit_paise - le.credit_paise) FROM ledger_entries le WHERE le.ledger_id = p.ledger_id), 0)) as current_balance_paise
        FROM parties p
        JOIN ledgers l ON p.ledger_id = l.ledger_id
        LEFT JOIN party_addresses pa ON p.party_id = pa.party_id
        WHERE p.company_id = ?
      `;
            const params = [companyId];
            if (type) {
                query += ` AND (p.party_type = ? OR p.party_type = 'BOTH')`;
                params.push(type);
            }
            query += ` ORDER BY p.party_name ASC`;
            const rows = this.db.prepare(query).all(...params);
            res.json(rows);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    createParty = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            const targetCompanyId = req.body.companyId || (0, routes_js_1.resolveCompanyId)(req, this.db, user);
            const { partyName, partyType, gstin, pan, phone, email, contactPerson, bankName, addressLine1, addressLine2, city, state, stateCode, pincode, openingBalancePaise } = req.body;
            if (!partyName || !partyName.trim()) {
                return res.status(400).json({ error: 'Party Name is required.' });
            }
            let derivedPan = pan;
            if (!derivedPan && gstin && gstin.length === 15) {
                derivedPan = gstin.substring(2, 12);
            }
            this.db.exec('BEGIN TRANSACTION;');
            const partyId = 'party_' + Date.now().toString(36);
            const ledgerId = 'led_pty_' + Date.now().toString(36);
            try {
                const groupCode = (partyType === 'CUSTOMER') ? 'SUNDRY_DEBTORS' : 'SUNDRY_CREDITORS';
                const group = this.db.prepare('SELECT group_id FROM ledger_groups WHERE company_id = ? AND code = ?').get(targetCompanyId, groupCode);
                const groupId = group ? group.group_id : null;
                const obPaise = Number(openingBalancePaise || 0);
                const obType = (partyType === 'CUSTOMER') ? 'DR' : 'CR';
                this.db.prepare(`
          INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(ledgerId, targetCompanyId, groupId, partyName.trim(), obPaise, obType);
                this.db.prepare(`
          INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin, pan, phone, email, contact_person, bank_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(partyId, targetCompanyId, ledgerId, partyType || 'CUSTOMER', partyName.trim(), gstin || null, derivedPan || null, phone || null, email || null, contactPerson || null, bankName || null);
                this.db.prepare(`
          INSERT INTO party_addresses (party_id, address_type, address_line1, address_line2, city, state, state_code, pincode)
          VALUES (?, 'BILLING', ?, ?, ?, ?, ?, ?)
        `).run(partyId, addressLine1 || null, addressLine2 || null, city || null, state || 'Tamil Nadu', stateCode || '33', pincode || null);
                this.db.exec('COMMIT;');
                res.status(201).json({ partyId, partyName, ledgerId });
            }
            catch (innerErr) {
                this.db.exec('ROLLBACK;');
                throw innerErr;
            }
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    updateParty = (req, res) => {
        try {
            const { id } = req.params;
            const b = req.body;
            let derivedPan = b.pan;
            if (!derivedPan && b.gstin && b.gstin.length === 15) {
                derivedPan = b.gstin.substring(2, 12);
            }
            this.db.exec('BEGIN TRANSACTION;');
            try {
                this.db.prepare(`
          UPDATE parties SET
            party_name = ?, party_type = ?, gstin = ?, pan = ?,
            phone = ?, email = ?, contact_person = ?, bank_name = ?
          WHERE party_id = ?
        `).run(b.partyName, b.partyType, b.gstin, derivedPan, b.phone, b.email, b.contactPerson, b.bankName, id);
                this.db.prepare(`
          UPDATE party_addresses SET
            address_line1 = ?, address_line2 = ?, city = ?, state = ?, state_code = ?, pincode = ?
          WHERE party_id = ?
        `).run(b.addressLine1, b.addressLine2, b.city, b.state, b.stateCode, b.pincode, id);
                const party = this.db.prepare('SELECT ledger_id FROM parties WHERE party_id = ?').get(id);
                if (party && party.ledger_id) {
                    this.db.prepare('UPDATE ledgers SET ledger_name = ? WHERE ledger_id = ?').run(b.partyName, party.ledger_id);
                }
                this.db.exec('COMMIT;');
                res.json({ success: true });
            }
            catch (innerErr) {
                this.db.exec('ROLLBACK;');
                throw innerErr;
            }
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    deleteParty = (req, res) => {
        try {
            const { id } = req.params;
            const party = this.db.prepare('SELECT ledger_id FROM parties WHERE party_id = ?').get(id);
            if (!party)
                return res.status(404).json({ error: 'Party not found' });
            const usage = this.db.prepare('SELECT COUNT(*) as count FROM vouchers WHERE party_id = ?').get(id)?.count || 0;
            if (usage > 0)
                return res.status(400).json({ error: 'Cannot delete party as it has associated vouchers.' });
            this.db.exec('BEGIN TRANSACTION;');
            try {
                this.db.prepare('DELETE FROM party_addresses WHERE party_id = ?').run(id);
                this.db.prepare('DELETE FROM parties WHERE party_id = ?').run(id);
                if (party.ledger_id) {
                    this.db.prepare('DELETE FROM ledgers WHERE ledger_id = ?').run(party.ledger_id);
                }
                this.db.exec('COMMIT;');
                res.json({ success: true });
            }
            catch (innerErr) {
                this.db.exec('ROLLBACK;');
                throw innerErr;
            }
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    getItems = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            const companyId = (0, routes_js_1.resolveCompanyId)(req, this.db, user);
            if (!companyId)
                return res.json([]);
            const rows = this.db.prepare(`
        SELECT si.*, u.unit_name,
               (COALESCE(si.opening_qty, 0) + 
                COALESCE((SELECT SUM(se.quantity * CASE WHEN se.movement_type = 'IN' THEN 1 ELSE -1 END) 
                          FROM stock_entries se 
                          WHERE se.item_id = si.item_id), 0)) as current_qty
        FROM stock_items si
        LEFT JOIN units u ON si.unit_id = u.unit_id
        WHERE si.company_id = ? AND si.is_active = 1
        ORDER BY si.item_name ASC
      `).all(companyId);
            res.json(rows);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    createItem = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            const targetCompanyId = req.body.companyId || (0, routes_js_1.resolveCompanyId)(req, this.db, user);
            const b = req.body;
            if (!b.itemName || !b.itemName.trim()) {
                return res.status(400).json({ error: 'Item name is required.' });
            }
            const existing = this.db.prepare(`
        SELECT item_id, item_name, serial_numbers, purchase_rate_paise, selling_rate_paise
        FROM stock_items
        WHERE company_id = ? AND (LOWER(item_name) = LOWER(?) OR (sku IS NOT NULL AND sku != '' AND LOWER(sku) = LOWER(?)))
        LIMIT 1
      `).get(targetCompanyId, b.itemName.trim(), (b.sku || '').trim());
            let godownId = b.godownId;
            if (!godownId || godownId === 'godown_main') {
                const defGodown = this.db.prepare('SELECT godown_id FROM godowns WHERE company_id = ? LIMIT 1').get(targetCompanyId);
                godownId = defGodown?.godown_id || `${targetCompanyId}_godown_main`;
            }
            const qty = Number(b.quantityToAdd ?? b.openingQty ?? 0);
            const rate = Number(b.purchaseRatePaise ?? b.openingRatePaise ?? 0);
            const sellRate = Number(b.sellingRatePaise || 0);
            if (existing) {
                let updatedSerials = existing.serial_numbers || '';
                if (b.serialNumbers && b.serialNumbers.trim()) {
                    updatedSerials = updatedSerials
                        ? `${updatedSerials}, ${b.serialNumbers.trim()}`
                        : b.serialNumbers.trim();
                }
                this.db.prepare(`
          UPDATE stock_items SET
            hsn_sac = COALESCE(?, hsn_sac),
            gst_rate = COALESCE(?, gst_rate),
            purchase_rate_paise = CASE WHEN ? > 0 THEN ? ELSE purchase_rate_paise END,
            selling_rate_paise = CASE WHEN ? > 0 THEN ? ELSE selling_rate_paise END,
            reorder_level = COALESCE(?, reorder_level),
            serial_numbers = ?,
            has_serial_no = CASE WHEN ? = 1 OR ? IS NOT NULL THEN 1 ELSE has_serial_no END
          WHERE item_id = ?
        `).run(b.hsnSac || null, b.gstRate || null, rate, rate, sellRate, sellRate, b.reorderLevel || null, updatedSerials || null, b.hasSerialNo ? 1 : 0, b.serialNumbers || null, existing.item_id);
                if (qty > 0) {
                    const valPaise = Math.round(qty * rate);
                    const entryId = 'se_upd_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
                    this.db.prepare(`
            INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
            VALUES (?, 'vch_stock_upd', ?, ?, ?, 'IN', ?, ?, ?)
          `).run(entryId, existing.item_id, godownId, new Date().toISOString().split('T')[0], qty, rate, valPaise);
                }
                return res.status(200).json({
                    itemId: existing.item_id, itemName: existing.item_name, updated: true,
                    message: `Stock updated successfully for '${existing.item_name}'. ${qty > 0 ? `Added ${qty} units.` : 'Details updated.'}`
                });
            }
            let unitId = b.unitId;
            if (!unitId || unitId === 'unit_nos') {
                const defUnit = this.db.prepare('SELECT unit_id FROM units WHERE company_id = ? LIMIT 1').get(targetCompanyId);
                unitId = defUnit?.unit_id || b.unitId || 'unit_nos';
            }
            const itemId = 'item_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
            this.db.prepare(`
        INSERT INTO stock_items (
          item_id, company_id, item_name, item_code, sku, hsn_sac,
          unit_id, gst_rate, cess_rate, purchase_rate_paise, selling_rate_paise,
          opening_qty, opening_rate_paise, reorder_level, serial_numbers, has_serial_no
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, targetCompanyId, b.itemName.trim(), b.itemCode || null, b.sku || null, b.hsnSac || '9999', unitId, b.gstRate || 18, b.cessRate || 0, rate, sellRate, qty, rate, b.reorderLevel || 0, b.serialNumbers || null, b.hasSerialNo ? 1 : 0);
            if (qty > 0) {
                const openingVal = Math.round(qty * rate);
                this.db.prepare(`
          INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
          VALUES (?, 'vch_opening', ?, ?, ?, 'IN', ?, ?, ?)
        `).run('se_opn_' + itemId, itemId, godownId, new Date().toISOString().split('T')[0], qty, rate, openingVal);
            }
            res.status(201).json({ itemId, itemName: b.itemName, updated: false, message: `Created stock item '${b.itemName}'.` });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    updateItem = (req, res) => {
        try {
            const b = req.body;
            this.db.prepare(`
        UPDATE stock_items SET
          item_name = ?, item_code = ?, sku = ?, hsn_sac = ?,
          unit_id = ?, gst_rate = ?, cess_rate = ?,
          purchase_rate_paise = ?, selling_rate_paise = ?,
          reorder_level = ?
        WHERE item_id = ?
      `).run(b.itemName, b.itemCode || null, b.sku || null, b.hsnSac || '9999', b.unitId || 'unit_nos', b.gstRate || 18, b.cessRate || 0, b.purchaseRatePaise || 0, b.sellingRatePaise || 0, b.reorderLevel || 0, req.params.id);
            res.json({ success: true, message: 'Stock item updated successfully.' });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    };
    deleteItem = (req, res) => {
        try {
            const itemId = req.params.id;
            const lineCount = this.db.prepare('SELECT COUNT(*) as cnt FROM voucher_lines WHERE item_id = ?').get(itemId)?.cnt || 0;
            if (lineCount > 0) {
                this.db.prepare('UPDATE stock_items SET is_active = 0 WHERE item_id = ?').run(itemId);
            }
            else {
                this.db.prepare('DELETE FROM stock_entries WHERE item_id = ?').run(itemId);
                this.db.prepare('DELETE FROM stock_items WHERE item_id = ?').run(itemId);
            }
            res.json({ success: true, message: 'Stock item removed successfully.' });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    getGodowns = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            const companyId = (0, routes_js_1.resolveCompanyId)(req, this.db, user);
            if (!companyId)
                return res.json([]);
            const rows = this.db.prepare('SELECT * FROM godowns WHERE company_id = ? OR company_id IS NULL ORDER BY godown_name ASC').all(companyId);
            res.json(rows);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    getUnits = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            const companyId = (0, routes_js_1.resolveCompanyId)(req, this.db, user);
            if (!companyId)
                return res.json([]);
            const rows = this.db.prepare('SELECT * FROM units WHERE company_id = ? OR company_id IS NULL ORDER BY unit_name ASC').all(companyId);
            res.json(rows);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
}
exports.MasterController = MasterController;
