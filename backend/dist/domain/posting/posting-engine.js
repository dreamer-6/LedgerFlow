"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostingEngine = void 0;
const gst_engine_js_1 = require("../tax/gst-engine.js");
const double_entry_js_1 = require("../accounting/double-entry.js");
const valuation_js_1 = require("../inventory/valuation.js");
class PostingEngine {
    /**
     * Generates the next sequential voucher number
     */
    static getNextVoucherNumber(db, companyId, fyId, voucherType) {
        const prefixes = {
            SALES: 'INV',
            PURCHASE: 'PUR',
            RECEIPT: 'REC',
            PAYMENT: 'PAY',
            CONTRA: 'CON',
            JOURNAL: 'JNL',
            CREDIT_NOTE: 'CRN',
            DEBIT_NOTE: 'DBN',
            SALES_RETURN: 'SLR',
            PURCHASE_RETURN: 'PRR',
            STOCK_JOURNAL: 'STK'
        };
        let prefix = prefixes[voucherType] || 'VCH';
        // For Sales Invoices, use company name initials/acronym (e.g., Dream Tech Solutions -> DTS)
        if (voucherType === 'SALES') {
            const comp = db.prepare('SELECT company_name FROM companies WHERE company_id = ?').get(companyId);
            if (comp && comp.company_name) {
                const words = comp.company_name.trim().split(/[\s_-]+/).filter(w => w.length > 0);
                if (words.length > 1) {
                    prefix = words.map(w => w[0].toUpperCase()).join('');
                }
                else if (words.length === 1) {
                    prefix = words[0].substring(0, 3).toUpperCase();
                }
            }
        }
        const row = db.prepare(`
      SELECT voucher_number FROM vouchers
      WHERE company_id = ? AND fy_id = ? AND voucher_type = ?
      ORDER BY rowid DESC LIMIT 1
    `).get(companyId, fyId, voucherType);
        let nextCounter = 1;
        if (row && row.voucher_number) {
            const parts = row.voucher_number.split(/[-/]/);
            const lastNumStr = parts[parts.length - 1];
            const parsed = parseInt(lastNumStr, 10);
            if (!isNaN(parsed)) {
                nextCounter = parsed + 1;
            }
        }
        let candidate = `${prefix}-${nextCounter.toString().padStart(4, '0')}`;
        while (db.prepare('SELECT 1 FROM vouchers WHERE company_id = ? AND fy_id = ? AND voucher_type = ? AND voucher_number = ?').get(companyId, fyId, voucherType, candidate)) {
            nextCounter++;
            candidate = `${prefix}-${nextCounter.toString().padStart(4, '0')}`;
        }
        return candidate;
    }
    /**
     * Atomic Posting Function
     * Guarantees rollback on any error and enforces accounting invariants
     */
    static postVoucher(db, input) {
        // 1. Basic Validations
        const fy = db.prepare('SELECT status, start_date, end_date FROM financial_years WHERE fy_id = ?')
            .get(input.fyId);
        if (!fy)
            throw new Error(`Financial Year '${input.fyId}' not found.`);
        if (fy.status !== 'OPEN')
            throw new Error(`Financial Year status is ${fy.status}. Posting prohibited.`);
        if (input.voucherDate < fy.start_date || input.voucherDate > fy.end_date) {
            throw new Error(`Voucher date ${input.voucherDate} is outside the active Financial Year (${fy.start_date} to ${fy.end_date}).`);
        }
        // Company state for GST Place of Supply
        const company = db.prepare('SELECT state_code, company_name FROM companies WHERE company_id = ?')
            .get(input.companyId);
        if (!company)
            throw new Error(`Company '${input.companyId}' not found.`);
        let placeOfSupplyStateCode = company.state_code;
        let partyLedgerId = null;
        if (input.partyId) {
            const party = db.prepare(`
        SELECT p.ledger_id, pa.state_code
        FROM parties p
        LEFT JOIN party_addresses pa ON p.party_id = pa.party_id
        WHERE p.party_id = ?
      `).get(input.partyId);
            if (!party)
                throw new Error(`Party with ID '${input.partyId}' not found.`);
            partyLedgerId = party.ledger_id;
            if (party.state_code) {
                placeOfSupplyStateCode = party.state_code;
            }
        }
        const voucherId = 'vch_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
        const fyIdToUse = input.fyId || input.financialYearId || 'fy_2026_27';
        let voucherNumber = input.voucherNumber?.trim();
        if (voucherNumber) {
            const alreadyExists = db.prepare('SELECT 1 FROM vouchers WHERE company_id = ? AND fy_id = ? AND voucher_type = ? AND voucher_number = ?').get(input.companyId, fyIdToUse, input.voucherType, voucherNumber);
            if (alreadyExists) {
                voucherNumber = this.getNextVoucherNumber(db, input.companyId, fyIdToUse, input.voucherType);
            }
        }
        else {
            voucherNumber = this.getNextVoucherNumber(db, input.companyId, fyIdToUse, input.voucherType);
        }
        // 2. Perform Calculations Based on Voucher Type
        const processedLines = [];
        const taxResults = [];
        const stockMovements = [];
        let cogsAmountPaise = 0;
        // Helper to resolve valid godown for company
        const resolveValidGodownId = (requestedGodownId) => {
            if (requestedGodownId) {
                const check = db.prepare('SELECT godown_id FROM godowns WHERE godown_id = ? AND (company_id = ? OR company_id IS NULL)').get(requestedGodownId, input.companyId);
                if (check)
                    return check.godown_id;
            }
            const defaultGodown = db.prepare('SELECT godown_id FROM godowns WHERE company_id = ? ORDER BY is_default DESC LIMIT 1').get(input.companyId);
            if (defaultGodown)
                return defaultGodown.godown_id;
            const anyGodown = db.prepare('SELECT godown_id FROM godowns WHERE company_id = ? LIMIT 1').get(input.companyId);
            if (anyGodown)
                return anyGodown.godown_id;
            const newGodownId = `${input.companyId}_godown_main`;
            db.prepare('INSERT OR IGNORE INTO godowns (godown_id, company_id, godown_name, location, is_default) VALUES (?, ?, ?, ?, 1)')
                .run(newGodownId, input.companyId, 'Main Warehouse', 'Central Warehouse');
            return newGodownId;
        };
        for (const line of input.lines) {
            let gstRate = line.gstRate ?? 18;
            let cessRate = line.cessRate ?? 0;
            // If item provided, retrieve item's default GST rate if not explicitly passed
            if (line.itemId) {
                const item = db.prepare('SELECT gst_rate, cess_rate, item_name FROM stock_items WHERE item_id = ?')
                    .get(line.itemId);
                if (item && line.gstRate === undefined) {
                    gstRate = item.gst_rate;
                    cessRate = item.cess_rate;
                }
            }
            const taxRes = gst_engine_js_1.GstEngine.calculateLineTax({
                quantity: line.quantity || 1,
                ratePaise: line.ratePaise,
                discountPercent: line.discountPercent,
                discountAmountPaise: line.discountAmountPaise,
                isTaxInclusive: line.isTaxInclusive,
                gstRate,
                cessRate,
                sellerStateCode: company.state_code,
                placeOfSupplyStateCode
            });
            taxResults.push(taxRes);
            processedLines.push({ lineInput: line, taxResult: taxRes });
            // Determine valid godown
            const resolvedGodownId = line.itemId ? resolveValidGodownId(line.godownId) : null;
            // Calculate Stock Movements
            if (line.itemId && resolvedGodownId && (line.quantity || 0) > 0) {
                const qty = Number(line.quantity);
                if (input.voucherType === 'SALES' || input.voucherType === 'PURCHASE_RETURN') {
                    // Validate stock and cost at Weighted Average
                    const stockSummary = valuation_js_1.InventoryEngine.getItemStockSummary(db, line.itemId, input.voucherDate);
                    const unitCost = stockSummary.weightedAverageRatePaise || line.ratePaise;
                    const costValue = Math.round(qty * unitCost);
                    cogsAmountPaise += costValue;
                    stockMovements.push({
                        itemId: line.itemId,
                        godownId: resolvedGodownId,
                        movementType: 'OUT',
                        quantity: qty,
                        ratePaise: unitCost,
                        valuePaise: costValue
                    });
                }
                else if (input.voucherType === 'PURCHASE' || input.voucherType === 'SALES_RETURN') {
                    const costValue = Math.round(qty * line.ratePaise);
                    stockMovements.push({
                        itemId: line.itemId,
                        godownId: resolvedGodownId,
                        movementType: 'IN',
                        quantity: qty,
                        ratePaise: line.ratePaise,
                        valuePaise: costValue
                    });
                }
            }
        }
        const voucherTotals = gst_engine_js_1.GstEngine.calculateVoucherTotals(taxResults);
        let finalVoucherTotal = voucherTotals.totalAmountPaise;
        if (finalVoucherTotal === 0 && input.customLedgerLines && input.customLedgerLines.length > 0) {
            finalVoucherTotal = input.customLedgerLines.reduce((sum, l) => sum + (l.debitPaise || 0), 0);
        }
        // 3. Assemble Accounting Lines
        let ledgerLines = [];
        const findLedgerId = (possibleIds, nameMatch) => {
            for (const id of possibleIds) {
                const scoped = `${input.companyId}_${id}`;
                if (db.prepare('SELECT 1 FROM ledgers WHERE ledger_id = ?').get(scoped))
                    return scoped;
                if (db.prepare('SELECT 1 FROM ledgers WHERE ledger_id = ?').get(id))
                    return id;
            }
            if (nameMatch) {
                const row = db.prepare('SELECT ledger_id FROM ledgers WHERE company_id = ? AND ledger_name LIKE ? LIMIT 1').get(input.companyId, nameMatch);
                if (row)
                    return row.ledger_id;
            }
            return possibleIds[0];
        };
        if (input.customLedgerLines && input.customLedgerLines.length > 0) {
            ledgerLines = input.customLedgerLines;
        }
        else if (input.voucherType === 'SALES') {
            if (!partyLedgerId)
                throw new Error('Party (Customer) is mandatory for Sales voucher.');
            ledgerLines = double_entry_js_1.DoubleEntryEngine.buildSalesEntries({
                customerLedgerId: partyLedgerId,
                salesLedgerId: findLedgerId(['led_sales'], '%Sales%'),
                taxableAmountPaise: voucherTotals.taxableAmountPaise,
                cgstAmountPaise: voucherTotals.cgstAmountPaise,
                sgstAmountPaise: voucherTotals.sgstAmountPaise,
                igstAmountPaise: voucherTotals.igstAmountPaise,
                roundOffPaise: voucherTotals.roundOffPaise,
                totalAmountPaise: voucherTotals.totalAmountPaise,
                outputCgstLedgerId: findLedgerId(['led_out_cgst', 'led_output_cgst'], '%Output CGST%'),
                outputSgstLedgerId: findLedgerId(['led_out_sgst', 'led_output_sgst'], '%Output SGST%'),
                outputIgstLedgerId: findLedgerId(['led_out_igst', 'led_output_igst'], '%Output IGST%'),
                roundOffLedgerId: findLedgerId(['led_roundoff', 'led_round_off'], '%Round Off%'),
                cogsAmountPaise,
                cogsLedgerId: findLedgerId(['led_cogs'], '%Cost of Goods%'),
                inventoryLedgerId: findLedgerId(['led_inventory'], '%Inventory%')
            });
        }
        else if (input.voucherType === 'PURCHASE') {
            if (!partyLedgerId)
                throw new Error('Party (Supplier) is mandatory for Purchase voucher.');
            ledgerLines = double_entry_js_1.DoubleEntryEngine.buildPurchaseEntries({
                supplierLedgerId: partyLedgerId,
                purchaseLedgerId: findLedgerId(['led_purchase'], '%Purchase%'),
                taxableAmountPaise: voucherTotals.taxableAmountPaise,
                cgstAmountPaise: voucherTotals.cgstAmountPaise,
                sgstAmountPaise: voucherTotals.sgstAmountPaise,
                igstAmountPaise: voucherTotals.igstAmountPaise,
                roundOffPaise: voucherTotals.roundOffPaise,
                totalAmountPaise: voucherTotals.totalAmountPaise,
                inputCgstLedgerId: findLedgerId(['led_in_cgst', 'led_input_cgst'], '%Input CGST%'),
                inputSgstLedgerId: findLedgerId(['led_in_sgst', 'led_input_sgst'], '%Input SGST%'),
                inputIgstLedgerId: findLedgerId(['led_in_igst', 'led_input_igst'], '%Input IGST%'),
                roundOffLedgerId: findLedgerId(['led_roundoff', 'led_round_off'], '%Round Off%')
            });
        }
        // 4. Validate Fundamental Double-Entry Invariant
        if (ledgerLines.length > 0) {
            const balanceCheck = double_entry_js_1.DoubleEntryEngine.validateBalancedEntries(ledgerLines);
            if (!balanceCheck.isValid) {
                throw new Error(balanceCheck.errorMessage);
            }
        }
        // 5. ATOMIC DATABASE TRANSACTION
        const fyId = input.fyId || input.financialYearId || 'fy_2026_27';
        const referenceNumber = input.referenceNumber || input.referenceNo || input.supplierInvoiceNo || null;
        const referenceDate = input.referenceDate || input.supplierInvoiceDate || null;
        const paymentMode = input.paymentMode || input.paymentTerms || null;
        const termsConditions = input.termsConditions || input.termsAndConditions || null;
        db.exec('BEGIN TRANSACTION;');
        try {
            // A. Insert Voucher Header
            db.prepare(`
        INSERT INTO vouchers (
          voucher_id, company_id, fy_id, voucher_type, voucher_number,
          voucher_date, reference_number, reference_date, payment_mode, terms_conditions,
          party_id, narration, status,
          taxable_amount_paise, cgst_amount_paise, sgst_amount_paise, igst_amount_paise,
          round_off_paise, total_amount_paise, created_by
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, 'POSTED',
          ?, ?, ?, ?,
          ?, ?, ?
        )
      `).run(voucherId, input.companyId, fyId, input.voucherType, voucherNumber, input.voucherDate, referenceNumber, referenceDate, paymentMode, termsConditions, input.partyId || null, input.narration || null, voucherTotals.taxableAmountPaise, voucherTotals.cgstAmountPaise, voucherTotals.sgstAmountPaise, voucherTotals.igstAmountPaise, voucherTotals.roundOffPaise, finalVoucherTotal, input.createdBy || 'admin');
            // B. Insert Voucher Lines
            let lineNum = 1;
            for (const pl of processedLines) {
                const lineId = 'ln_' + Date.now().toString(36) + (lineNum++);
                const lineGodownId = pl.lineInput.itemId ? resolveValidGodownId(pl.lineInput.godownId) : null;
                db.prepare(`
          INSERT INTO voucher_lines (
            line_id, voucher_id, line_number, item_id, ledger_id, godown_id, description,
            quantity, rate_paise, discount_percent, discount_amount_paise,
            taxable_amount_paise, gst_rate, cgst_amount_paise, sgst_amount_paise,
            igst_amount_paise, total_amount_paise, serial_number
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?
          )
        `).run(lineId, voucherId, lineNum, pl.lineInput.itemId || null, pl.lineInput.ledgerId || null, lineGodownId, pl.lineInput.description || null, pl.lineInput.quantity || 0, pl.lineInput.ratePaise, pl.lineInput.discountPercent || 0, pl.taxResult.discountAmountPaise, pl.taxResult.taxableAmountPaise, pl.taxResult.cgstRate + pl.taxResult.sgstRate + pl.taxResult.igstRate, pl.taxResult.cgstAmountPaise, pl.taxResult.sgstAmountPaise, pl.taxResult.igstAmountPaise, pl.taxResult.totalAmountPaise, pl.lineInput.serialNumber || null);
                if (pl.lineInput.itemId && pl.lineInput.serialNumber) {
                    const s = pl.lineInput.serialNumber.trim();
                    if (input.voucherType === 'SALES' || input.voucherType === 'PURCHASE_RETURN') {
                        db.prepare(`UPDATE stock_item_serials SET status = 'SOLD' WHERE item_id = ? AND serial_number = ?`).run(pl.lineInput.itemId, s);
                    }
                    else if (input.voucherType === 'PURCHASE' || input.voucherType === 'SALES_RETURN') {
                        db.prepare(`INSERT OR REPLACE INTO stock_item_serials (serial_id, item_id, serial_number, status) VALUES (?, ?, ?, 'AVAILABLE')`)
                            .run('ser_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6), pl.lineInput.itemId, s);
                    }
                }
            }
            // C. Insert Ledger Entries
            for (const le of ledgerLines) {
                const entryId = 'le_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
                db.prepare(`
          INSERT INTO ledger_entries (
            entry_id, voucher_id, ledger_id, entry_date, debit_paise, credit_paise, particulars
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(entryId, voucherId, le.ledgerId, input.voucherDate, le.debitPaise, le.creditPaise, le.particulars || null);
            }
            // D. Insert Stock Entries
            for (const se of stockMovements) {
                const stockEntryId = 'se_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
                const validGodownId = resolveValidGodownId(se.godownId);
                db.prepare(`
          INSERT INTO stock_entries (
            stock_entry_id, voucher_id, item_id, godown_id, entry_date,
            movement_type, quantity, rate_paise, value_paise
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(stockEntryId, voucherId, se.itemId, validGodownId, input.voucherDate, se.movementType, se.quantity, se.ratePaise, se.valuePaise);
            }
            // E. Insert Statutory Tax Entries
            if (voucherTotals.cgstAmountPaise > 0) {
                const taxType = input.voucherType === 'PURCHASE' ? 'INPUT_CGST' : 'OUTPUT_CGST';
                db.prepare(`
          INSERT INTO tax_entries (tax_entry_id, voucher_id, tax_type, rate, taxable_amount_paise, tax_amount_paise, place_of_supply)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('te_' + Date.now().toString(36) + '1', voucherId, taxType, 9.00, voucherTotals.taxableAmountPaise, voucherTotals.cgstAmountPaise, placeOfSupplyStateCode);
            }
            if (voucherTotals.sgstAmountPaise > 0) {
                const taxType = input.voucherType === 'PURCHASE' ? 'INPUT_SGST' : 'OUTPUT_SGST';
                db.prepare(`
          INSERT INTO tax_entries (tax_entry_id, voucher_id, tax_type, rate, taxable_amount_paise, tax_amount_paise, place_of_supply)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('te_' + Date.now().toString(36) + '2', voucherId, taxType, 9.00, voucherTotals.taxableAmountPaise, voucherTotals.sgstAmountPaise, placeOfSupplyStateCode);
            }
            if (voucherTotals.igstAmountPaise > 0) {
                const taxType = input.voucherType === 'PURCHASE' ? 'INPUT_IGST' : 'OUTPUT_IGST';
                db.prepare(`
          INSERT INTO tax_entries (tax_entry_id, voucher_id, tax_type, rate, taxable_amount_paise, tax_amount_paise, place_of_supply)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('te_' + Date.now().toString(36) + '3', voucherId, taxType, 18.00, voucherTotals.taxableAmountPaise, voucherTotals.igstAmountPaise, placeOfSupplyStateCode);
            }
            // F. Bill-Wise Allocations
            if (partyLedgerId && finalVoucherTotal > 0) {
                const allocId = 'ba_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
                const allocType = input.billAllocation?.allocationType || 'NEW_REF';
                let refVoucher = voucherId;
                if (allocType === 'AGAINST_REF' && input.billAllocation?.referenceVoucherId) {
                    const refExists = db.prepare(`SELECT voucher_id FROM vouchers WHERE voucher_id = ?`).get(input.billAllocation.referenceVoucherId);
                    if (refExists) {
                        refVoucher = input.billAllocation.referenceVoucherId;
                    }
                }
                db.prepare(`
          INSERT INTO bill_allocations (
            allocation_id, voucher_id, ledger_id, reference_voucher_id,
            allocation_type, amount_paise, due_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(allocId, voucherId, partyLedgerId, refVoucher, allocType, finalVoucherTotal, input.billAllocation?.dueDate || null);
            }
            // G. Audit Log Entry
            db.prepare(`
        INSERT INTO audit_logs (log_id, company_id, user_id, action, entity_name, entity_id, details)
        VALUES (?, ?, ?, ?, 'VOUCHER', ?, ?)
      `).run('aud_' + Date.now().toString(36), input.companyId, input.createdBy || 'admin', `POST_${input.voucherType}`, voucherId, JSON.stringify({
                voucherNumber,
                totalAmountPaise: finalVoucherTotal,
                linesCount: input.lines.length
            }));
            db.exec('COMMIT;');
            return {
                voucherId,
                voucherNumber,
                totalAmountPaise: finalVoucherTotal
            };
        }
        catch (err) {
            db.exec('ROLLBACK;');
            throw new Error(`Posting transaction failed and was rolled back: ${err.message}`);
        }
    }
    /**
     * Cancel an existing posted voucher with complete audit trail
     */
    static cancelVoucher(db, voucherId, cancelledBy, reason) {
        const vch = db.prepare('SELECT status, voucher_number, company_id FROM vouchers WHERE voucher_id = ?')
            .get(voucherId);
        if (!vch)
            throw new Error(`Voucher with ID '${voucherId}' does not exist.`);
        if (vch.status === 'CANCELLED')
            throw new Error(`Voucher '${vch.voucher_number}' is already cancelled.`);
        db.exec('BEGIN TRANSACTION;');
        try {
            // 1. Mark voucher header as CANCELLED
            db.prepare(`
        UPDATE vouchers
        SET status = 'CANCELLED', cancelled_by = ?, cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = ?
        WHERE voucher_id = ?
      `).run(cancelledBy, reason, voucherId);
            // 2. Remove downstream accounting, inventory, and tax effects
            // Note: We remove the derived postings so reports immediately reverse effects
            db.prepare('DELETE FROM ledger_entries WHERE voucher_id = ?').run(voucherId);
            db.prepare('DELETE FROM stock_entries WHERE voucher_id = ?').run(voucherId);
            db.prepare('DELETE FROM tax_entries WHERE voucher_id = ?').run(voucherId);
            db.prepare('DELETE FROM bill_allocations WHERE voucher_id = ?').run(voucherId);
            // 3. Record Audit Log
            db.prepare(`
        INSERT INTO audit_logs (log_id, company_id, user_id, action, entity_name, entity_id, details)
        VALUES (?, ?, ?, 'CANCEL_VOUCHER', 'VOUCHER', ?, ?)
      `).run('aud_' + Date.now().toString(36), vch.company_id, cancelledBy, voucherId, JSON.stringify({ voucherNumber: vch.voucher_number, reason }));
            db.exec('COMMIT;');
        }
        catch (err) {
            db.exec('ROLLBACK;');
            throw new Error(`Cancellation failed: ${err.message}`);
        }
    }
}
exports.PostingEngine = PostingEngine;
