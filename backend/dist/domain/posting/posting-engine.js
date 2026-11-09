"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostingEngine = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const gst_engine_js_1 = require("../tax/gst-engine.js");
const double_entry_js_1 = require("../accounting/double-entry.js");
const valuation_js_1 = require("../inventory/valuation.js");
class PostingEngine {
    /**
     * Generates the next sequential voucher number
     *
     * NUMBERING LIFECYCLE & STATUTORY ACCOUNTING POLICY:
     * 1. Official statutory numbers are consumed strictly upon POSTING or CANCELLATION history.
     * 2. Unposted DRAFT vouchers use temporary 'DFT-...' numbers and do NOT consume statutory sequence numbers.
     * 3. Deleting an eligible unposted draft releases its temporary identifier with ZERO impact on sequence;
     *    the statutory sequence continues without gaps (e.g., if draft 001 is deleted, next voucher is 001).
     * 4. A POSTED or CANCELLED voucher's number is PERMANENTLY CONSUMED and must NEVER be reused, even if
     *    the voucher is purged with an audit tombstone in audit_logs (statutory tax/audit preservation).
     * 5. Sequence is strictly tenant-isolated (by company_id), scoped by financial year (fy_id), and voucher_type.
     * 6. Configured company numbering rules (prefix, startNumber, format) in invoice_settings are respected.
     */
    static getNextVoucherNumber(db, companyId, fyId, voucherType) {
        const prefixes = {
            SALES: 'INV',
            PURCHASE: 'PUR',
            RECEIPT: 'REC',
            PAYMENT: 'PAY',
            CONTRA: 'CON',
            JOURNAL: 'JRN',
            CREDIT_NOTE: 'CRN',
            DEBIT_NOTE: 'DBN',
            SALES_RETURN: 'SLR',
            PURCHASE_RETURN: 'PRR',
            STOCK_JOURNAL: 'STK'
        };
        let defaultPrefix = prefixes[voucherType] || 'VCH';
        // 1. Resolve Financial Year code (e.g. 2026-2027 -> 2627)
        let fyCode = '2627';
        if (fyId) {
            const fy = db.prepare('SELECT name, start_date, end_date FROM financial_years WHERE fy_id = ? AND company_id = ?').get(fyId, companyId)
                || db.prepare('SELECT name, start_date, end_date FROM financial_years WHERE fy_id = ?').get(fyId);
            if (fy?.start_date && fy?.end_date) {
                const sY = fy.start_date.substring(2, 4);
                const eY = fy.end_date.substring(2, 4);
                fyCode = `${sY}${eY}`;
            }
            else if (fy?.name) {
                const digits = fy.name.replace(/\D/g, '');
                if (digits.length >= 4)
                    fyCode = digits.slice(-4);
            }
        }
        else {
            const openFy = db.prepare(`
        SELECT start_date, end_date, name FROM financial_years
        WHERE company_id = ? AND status = 'OPEN'
        ORDER BY start_date DESC LIMIT 1
      `).get(companyId);
            if (openFy?.start_date && openFy?.end_date) {
                fyCode = `${openFy.start_date.substring(2, 4)}${openFy.end_date.substring(2, 4)}`;
            }
        }
        // 2. Check for configured voucher numbering rules in company invoice_settings
        let configuredPrefix = null;
        let configuredStartNumber = 1;
        let configuredFormat = null;
        const comp = db.prepare('SELECT company_name, invoice_settings FROM companies WHERE company_id = ?').get(companyId);
        if (comp?.invoice_settings) {
            try {
                const settings = JSON.parse(comp.invoice_settings);
                const numConfig = settings.voucherNumbering?.[voucherType] || settings.voucherNumbering?.[voucherType.toLowerCase()];
                if (numConfig) {
                    if (typeof numConfig.prefix === 'string' && numConfig.prefix.trim()) {
                        configuredPrefix = numConfig.prefix.trim().toUpperCase();
                    }
                    if (numConfig.startNumber !== undefined && !isNaN(Number(numConfig.startNumber))) {
                        configuredStartNumber = Math.max(1, parseInt(String(numConfig.startNumber), 10));
                    }
                    if (typeof numConfig.format === 'string' && numConfig.format.trim()) {
                        configuredFormat = numConfig.format.trim();
                    }
                }
            }
            catch { }
        }
        // 3. Determine active prefix
        let prefix = '';
        if (configuredPrefix) {
            prefix = configuredPrefix.includes(fyCode) ? configuredPrefix : `${configuredPrefix}-${fyCode}`;
        }
        else if (voucherType === 'SALES') {
            let compAcronym = 'DTS';
            if (comp && comp.company_name) {
                const words = comp.company_name.trim().split(/[\s_-]+/).filter(w => w.length > 0);
                if (words.length > 1) {
                    compAcronym = words.map(w => w[0].toUpperCase()).join('');
                }
                else if (words.length === 1) {
                    compAcronym = words[0].substring(0, 3).toUpperCase();
                }
            }
            prefix = `${compAcronym}-${fyCode}`;
        }
        else if (voucherType === 'STOCK_JOURNAL') {
            prefix = 'STK';
        }
        else {
            prefix = `${defaultPrefix}-${fyCode}`;
        }
        // 4. Retrieve ALL consumed numbers for this company, FY, and voucher type:
        // (a) From active vouchers table: ONLY POSTED, CANCELLED, AMENDED vouchers consume statutory numbers!
        //     Unposted DRAFT vouchers (status = 'DRAFT') DO NOT consume statutory numbers.
        const activeRows = db.prepare(`
      SELECT voucher_number FROM vouchers
      WHERE company_id = ? AND fy_id = ? AND voucher_type = ?
        AND status IN ('POSTED', 'CANCELLED', 'AMENDED')
    `).all(companyId, fyId, voucherType);
        // (b) From audit_logs: Permanently purged vouchers with tombstone
        //     Even if purged from vouchers table, cancelled/posted numbers MUST NEVER be reused!
        const purgedRows = db.prepare(`
      SELECT details FROM audit_logs
      WHERE company_id = ? AND action = 'VOUCHER_PERMANENT_PURGE'
    `).all(companyId);
        const consumedNumbers = new Set();
        for (const r of activeRows) {
            if (r.voucher_number && !r.voucher_number.startsWith('DFT-')) {
                consumedNumbers.add(r.voucher_number.trim());
            }
        }
        for (const pr of purgedRows) {
            try {
                const d = JSON.parse(pr.details);
                if (d.voucher_type === voucherType && d.voucher_number && !d.voucher_number.startsWith('DFT-')) {
                    if (!d.fy_id || d.fy_id === fyId || d.voucher_number.includes(fyCode)) {
                        consumedNumbers.add(d.voucher_number.trim());
                    }
                }
            }
            catch { }
        }
        // 5. Determine maximum used numeric counter
        let maxCounter = configuredStartNumber - 1;
        for (const num of consumedNumbers) {
            const match = num.match(/(\d+)$/);
            if (match) {
                const parsed = parseInt(match[1], 10);
                if (!isNaN(parsed) && parsed > maxCounter) {
                    maxCounter = parsed;
                }
            }
        }
        let nextCounter = maxCounter + 1;
        const padLength = (configuredFormat && configuredFormat.includes('0001')) ? 4 : 3;
        let candidate = `${prefix}-${nextCounter.toString().padStart(padLength, '0')}`;
        if (configuredFormat && !configuredFormat.includes('-') && !configuredFormat.includes('/')) {
            candidate = `${prefix}${nextCounter.toString().padStart(padLength, '0')}`;
        }
        // 6. Guarantee candidate collision resistance against consumed numbers and any existing db row
        while (consumedNumbers.has(candidate) ||
            db.prepare('SELECT 1 FROM vouchers WHERE company_id = ? AND fy_id = ? AND voucher_type = ? AND voucher_number = ?').get(companyId, fyId, voucherType, candidate)) {
            nextCounter++;
            candidate = configuredFormat && !configuredFormat.includes('-') && !configuredFormat.includes('/')
                ? `${prefix}${nextCounter.toString().padStart(padLength, '0')}`
                : `${prefix}-${nextCounter.toString().padStart(padLength, '0')}`;
        }
        return candidate;
    }
    /**
     * Atomic Posting Function
     * Guarantees rollback on any error and enforces accounting invariants
     */
    /**
     * Atomic Posting Function
     * Guarantees rollback on any error and enforces accounting invariants
     */
    static postVoucher(db, input, options) {
        return this._postVoucherInternal(db, input, options || { skipTransaction: false });
    }
    /**
     * Internal Posting Function
     * Supports execution inside an existing transaction (skipTransaction: true) or standalone with retry loop
     */
    static _postVoucherInternal(db, input, options) {
        // DEF-VCH-12: AMENDED status is reserved and cannot be set directly
        if (input.status === 'AMENDED') {
            throw new Error("Status 'AMENDED' is reserved and cannot be set directly.");
        }
        // 1. Basic Validations
        // Verify financial year belongs to THIS company (cross-company FY injection prevention)
        const fy = db.prepare('SELECT status, start_date, end_date FROM financial_years WHERE fy_id = ? AND company_id = ?')
            .get(input.fyId, input.companyId);
        if (!fy)
            throw new Error(`Financial Year '${input.fyId}' not found for this company.`);
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
            // SECURITY: Verify party belongs to this company (cross-company party injection prevention)
            const party = db.prepare(`
        SELECT p.ledger_id, p.company_id, pa.state_code
        FROM parties p
        LEFT JOIN party_addresses pa ON p.party_id = pa.party_id
        WHERE p.party_id = ?
      `).get(input.partyId);
            if (!party)
                throw new Error(`Party with ID '${input.partyId}' not found.`);
            if (party.company_id !== input.companyId) {
                throw new Error(`Security violation: Party '${input.partyId}' does not belong to company '${input.companyId}'.`);
            }
            partyLedgerId = party.ledger_id;
            if (party.state_code) {
                placeOfSupplyStateCode = party.state_code;
            }
        }
        const voucherId = options?.voucherId || ('vch_' + node_crypto_1.default.randomUUID().replace(/-/g, ''));
        const fyIdToUse = input.fyId || input.financialYearId || 'fy_2026_27';
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
                // If requested godown exists for another company, throw security violation
                const foreign = db.prepare('SELECT company_id FROM godowns WHERE godown_id = ?').get(requestedGodownId);
                if (foreign) {
                    throw new Error(`Security violation: Godown '${requestedGodownId}' does not belong to company '${input.companyId}'.`);
                }
                throw new Error(`Godown '${requestedGodownId}' not found for company '${input.companyId}'.`);
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
            // P1-1: Reject zero or negative item line quantities before financial posting begins
            if (line.itemId !== undefined && line.itemId !== null && String(line.itemId).trim() !== '') {
                if (line.quantity === undefined || line.quantity === null || Number(line.quantity) <= 0) {
                    throw new Error(`Item line for '${line.itemId}' must have quantity greater than zero.`);
                }
            }
            let gstRate = line.gstRate ?? 18;
            let cessRate = line.cessRate ?? 0;
            // SECURITY: If line specifies a ledgerId, verify it belongs to this company
            if (line.ledgerId) {
                const ledger = db.prepare('SELECT company_id FROM ledgers WHERE ledger_id = ?').get(line.ledgerId);
                if (!ledger) {
                    throw new Error(`Ledger '${line.ledgerId}' not found.`);
                }
                if (ledger.company_id && ledger.company_id !== input.companyId) {
                    throw new Error(`Security violation: Ledger '${line.ledgerId}' does not belong to company '${input.companyId}'.`);
                }
            }
            // If item provided, retrieve item's default GST rate if not explicitly passed
            let isServiceItem = false;
            if (line.itemId) {
                const item = db.prepare('SELECT gst_rate, cess_rate, item_name, company_id, hsn_sac FROM stock_items WHERE item_id = ?')
                    .get(line.itemId);
                if (!item) {
                    throw new Error(`Stock item '${line.itemId}' not found.`);
                }
                // SECURITY: Verify stock item belongs to this company
                if (item.company_id !== input.companyId) {
                    throw new Error(`Security violation: Stock item '${line.itemId}' does not belong to company '${input.companyId}'.`);
                }
                if (line.gstRate === undefined) {
                    gstRate = item.gst_rate;
                    cessRate = item.cess_rate;
                }
                // Service items (SAC starting with 99, or name containing service, or explicit isService flag) do not track physical inventory
                isServiceItem = Boolean(line.isService ||
                    (item.hsn_sac && String(item.hsn_sac).trim().startsWith('99')) ||
                    (item.item_name && item.item_name.toLowerCase().includes('service')));
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
            // Calculate Stock Movements only for physical inventory items (services do not move stock)
            if (line.itemId && !isServiceItem && resolvedGodownId && (line.quantity || 0) > 0) {
                const qty = Number(line.quantity);
                // UI-045: For serialized items, validate serial numbers prior to stock movement & availability checks
                const isPostingStatus = (input.status || 'POSTED') === 'POSTED';
                if (isPostingStatus) {
                    // If SALES_RETURN with reference voucher, enforce over-return guard prior to serial/stock checks
                    if ((input.voucherType === 'SALES_RETURN' || input.voucherType === 'CREDIT_NOTE') && input.referenceNumber) {
                        const origVch = db.prepare(`
              SELECT voucher_id, voucher_number, company_id FROM vouchers
              WHERE (voucher_number = ? OR voucher_id = ?) AND company_id = ?
            `).get(input.referenceNumber, input.referenceNumber, input.companyId);
                        if (origVch) {
                            const origItemLine = db.prepare(`
                SELECT SUM(quantity) as total_sold_qty
                FROM voucher_lines
                WHERE voucher_id = ? AND item_id = ?
              `).get(origVch.voucher_id, line.itemId);
                            const soldQty = Number(origItemLine?.total_sold_qty || 0);
                            if (soldQty > 0) {
                                const excludeVchId = options?.excludeVoucherId || options?.voucherId;
                                const prevRetRow = db.prepare(`
                  SELECT SUM(vl.quantity) as total_returned_qty
                  FROM voucher_lines vl
                  JOIN vouchers v ON vl.voucher_id = v.voucher_id
                  WHERE (v.voucher_type = 'SALES_RETURN' OR v.voucher_type = 'CREDIT_NOTE')
                    AND v.status != 'CANCELLED'
                    AND (v.reference_number = ? OR v.reference_number = ? OR v.voucher_id IN (
                      SELECT ba.voucher_id FROM bill_allocations ba WHERE ba.reference_voucher_id = ?
                    ))
                    AND vl.item_id = ?
                    ${excludeVchId ? `AND v.voucher_id != '${excludeVchId}'` : ''}
                `).get(origVch.voucher_id, origVch.voucher_number, origVch.voucher_id, line.itemId);
                                const prevReturned = Number(prevRetRow?.total_returned_qty || 0);
                                const maxReturnable = soldQty - prevReturned;
                                if (qty > maxReturnable) {
                                    throw new Error(`Cannot return ${qty} units of item '${line.itemId}'. Original invoice '${origVch.voucher_number}' sold ${soldQty} units, of which ${prevReturned} units were already returned (maximum returnable: ${maxReturnable}).`);
                                }
                            }
                        }
                    }
                    const itemMeta = db.prepare('SELECT has_serial_no, item_name FROM stock_items WHERE item_id = ?').get(line.itemId);
                    const isSerialTracked = itemMeta?.has_serial_no === 1;
                    const itemDisplayName = itemMeta?.item_name || line.itemId;
                    if (isSerialTracked) {
                        if (input.voucherType === 'PURCHASE' || input.voucherType === 'SALES_RETURN') {
                            if (!line.serialNumber || !line.serialNumber.trim()) {
                                throw new Error(`Item '${itemDisplayName}' requires serial numbers. None provided for quantity ${qty}.`);
                            }
                            const serialsArr = line.serialNumber.split(',').map((s) => s.trim()).filter(Boolean);
                            if (serialsArr.length !== qty) {
                                throw new Error(`Serial count (${serialsArr.length}) does not match quantity (${qty}) for item '${itemDisplayName}'.`);
                            }
                            const uniqueSet = new Set(serialsArr);
                            if (uniqueSet.size !== serialsArr.length) {
                                throw new Error(`Duplicate serial numbers found in line for item '${itemDisplayName}'.`);
                            }
                            if (input.voucherType === 'PURCHASE') {
                                for (const s of serialsArr) {
                                    const existingSerial = db.prepare(`
                    SELECT serial_id, status FROM stock_item_serials
                    WHERE (company_id = ? OR company_id IS NULL) AND item_id = ? AND serial_number = ?
                  `).get(input.companyId, line.itemId, s);
                                    if (existingSerial && existingSerial.status !== 'CANCELLED') {
                                        throw new Error(`Serial number '${s}' already exists for item '${itemDisplayName}' in this company (current status: ${existingSerial.status}).`);
                                    }
                                }
                            }
                        }
                        else if (input.voucherType === 'SALES' || input.voucherType === 'PURCHASE_RETURN') {
                            if (!line.serialNumber || !line.serialNumber.trim()) {
                                throw new Error(`Item '${itemDisplayName}' requires serial numbers. None provided for quantity ${qty}.`);
                            }
                            const serialsArr = line.serialNumber.split(',').map((s) => s.trim()).filter(Boolean);
                            if (serialsArr.length !== qty) {
                                throw new Error(`Serial count (${serialsArr.length}) does not match quantity (${qty}) for item '${itemDisplayName}'.`);
                            }
                            const uniqueSet = new Set(serialsArr);
                            if (uniqueSet.size !== serialsArr.length) {
                                throw new Error(`Duplicate serial numbers found in line for item '${itemDisplayName}'.`);
                            }
                            for (const s of serialsArr) {
                                const existingSerial = db.prepare(`
                  SELECT serial_id, status, godown_id, company_id FROM stock_item_serials
                  WHERE (company_id = ? OR company_id IS NULL) AND item_id = ? AND serial_number = ?
                `).get(input.companyId, line.itemId, s);
                                if (!existingSerial) {
                                    throw new Error(`Serial '${s}' does not exist for item '${itemDisplayName}' in this company.`);
                                }
                                if (existingSerial.status !== 'AVAILABLE') {
                                    throw new Error(`Serial '${s}' for item '${itemDisplayName}' is not AVAILABLE (current status: ${existingSerial.status}).`);
                                }
                                if (resolvedGodownId && existingSerial.godown_id && existingSerial.godown_id !== resolvedGodownId) {
                                    throw new Error(`Serial '${s}' is located in a different godown, not '${resolvedGodownId}'.`);
                                }
                            }
                        }
                    }
                }
                if (input.voucherType === 'SALES' || input.voucherType === 'PURCHASE_RETURN') {
                    // C-4: Validate stock availability prior to outward posting
                    const allowNegative = input.allowNegativeStock === true;
                    const availability = valuation_js_1.InventoryEngine.validateStockAvailability(db, line.itemId, resolvedGodownId, qty, allowNegative);
                    if (!availability.isValid) {
                        throw new Error(`Insufficient stock for item '${line.itemId}' in godown '${resolvedGodownId}'. Available: ${availability.currentQty}, Requested: ${qty}. Set allowNegativeStock: true to override if business policy permits.`);
                    }
                    // C-2: Validate stock and cost at Weighted Average (throw on zero-stock, do not fall back to selling price)
                    const stockSummary = valuation_js_1.InventoryEngine.getItemStockSummary(db, line.itemId, input.voucherDate);
                    let unitCost;
                    if (input.voucherType === 'SALES') {
                        const item = db.prepare('SELECT purchase_rate_paise FROM stock_items WHERE item_id = ?').get(line.itemId);
                        unitCost = stockSummary.weightedAverageRatePaise > 0
                            ? stockSummary.weightedAverageRatePaise
                            : (item?.purchase_rate_paise && item.purchase_rate_paise > 0 ? item.purchase_rate_paise : 0);
                        if (unitCost === 0 && !allowNegative) {
                            throw new Error(`Cannot determine COGS for item '${line.itemId}' — no stock or purchase rate available.`);
                        }
                    }
                    else {
                        // PURCHASE_RETURN: cost is exact line taxable net acquisition cost
                        const returnCost = taxRes.taxableAmountPaise;
                        unitCost = qty > 0 ? Math.round(returnCost / qty) : (line.ratePaise > 0 ? line.ratePaise : (stockSummary.weightedAverageRatePaise || 0));
                    }
                    const costValue = input.voucherType === 'PURCHASE_RETURN' ? taxRes.taxableAmountPaise : Math.round(qty * unitCost);
                    if (input.voucherType === 'SALES') {
                        cogsAmountPaise += costValue;
                    }
                    stockMovements.push({
                        itemId: line.itemId,
                        godownId: resolvedGodownId,
                        movementType: 'OUT',
                        quantity: qty,
                        ratePaise: unitCost,
                        valuePaise: costValue
                    });
                }
                else if (input.voucherType === 'PURCHASE') {
                    // DEF-008-02: Inventory valuation must use exact line-level net acquisition cost in paise
                    // (taxRes.taxableAmountPaise), reflecting discounts and net-of-tax values, to reconcile
                    // exactly with the debit to Inventory Asset.
                    const inwardCostPaise = taxRes.taxableAmountPaise;
                    const effectiveRatePaise = qty > 0 ? Math.round(inwardCostPaise / qty) : 0;
                    stockMovements.push({
                        itemId: line.itemId,
                        godownId: resolvedGodownId,
                        movementType: 'IN',
                        quantity: qty,
                        ratePaise: effectiveRatePaise,
                        valuePaise: inwardCostPaise
                    });
                }
                else if (input.voucherType === 'SALES_RETURN') {
                    // P0-1: Restore returned inventory at COST basis, NOT customer selling price
                    let returnUnitCost = 0;
                    // 1. Try to find the cost basis from original sales voucher if referenced
                    const refVchId = input.billAllocation?.referenceVoucherId || input.referenceNumber;
                    if (refVchId) {
                        const origVch = db.prepare(`
              SELECT voucher_id, voucher_number, voucher_type FROM vouchers
              WHERE (voucher_id = ? OR voucher_number = ?) AND company_id = ?
            `).get(refVchId, refVchId, input.companyId);
                        if (origVch && origVch.voucher_type === 'SALES') {
                            // Validate return quantity does not exceed sold quantity minus prior returns
                            const origItemLine = db.prepare(`
                SELECT SUM(quantity) as total_sold_qty FROM voucher_lines
                WHERE voucher_id = ? AND item_id = ?
              `).get(origVch.voucher_id, line.itemId);
                            const soldQty = Number(origItemLine?.total_sold_qty || 0);
                            if (soldQty > 0) {
                                const excludeVchId = options?.excludeVoucherId || options?.voucherId;
                                const prevRetRow = db.prepare(`
                  SELECT SUM(vl.quantity) as total_returned_qty
                  FROM voucher_lines vl
                  JOIN vouchers v ON vl.voucher_id = v.voucher_id
                  WHERE (v.voucher_type = 'SALES_RETURN' OR v.voucher_type = 'CREDIT_NOTE')
                    AND v.status != 'CANCELLED'
                    AND (v.reference_number = ? OR v.reference_number = ? OR v.voucher_id IN (
                      SELECT ba.voucher_id FROM bill_allocations ba WHERE ba.reference_voucher_id = ?
                    ))
                    AND vl.item_id = ?
                    ${excludeVchId ? `AND v.voucher_id != '${excludeVchId}'` : ''}
                `).get(origVch.voucher_id, origVch.voucher_number, origVch.voucher_id, line.itemId);
                                const prevReturned = Number(prevRetRow?.total_returned_qty || 0);
                                const maxReturnable = soldQty - prevReturned;
                                if (qty > maxReturnable) {
                                    throw new Error(`Cannot return ${qty} units of item '${line.itemId}'. Original invoice '${origVch.voucher_number}' sold ${soldQty} units, of which ${prevReturned} units were already returned (maximum returnable: ${maxReturnable}).`);
                                }
                            }
                        }
                        const refStock = db.prepare(`
              SELECT rate_paise FROM stock_entries
              WHERE voucher_id = ? AND item_id = ? AND movement_type = 'OUT'
              LIMIT 1
            `).get(origVch.voucher_id, line.itemId);
                        if (refStock && refStock.rate_paise > 0) {
                            returnUnitCost = refStock.rate_paise;
                        }
                    }
                    // 2. Otherwise use the item's current/appropriate WAVG cost basis
                    if (returnUnitCost === 0) {
                        const stockSummary = valuation_js_1.InventoryEngine.getItemStockSummary(db, line.itemId, input.voucherDate);
                        if (stockSummary.weightedAverageRatePaise > 0) {
                            returnUnitCost = stockSummary.weightedAverageRatePaise;
                        }
                    }
                    // 3. Fallback to purchase_rate_paise
                    if (returnUnitCost === 0) {
                        const item = db.prepare('SELECT purchase_rate_paise FROM stock_items WHERE item_id = ?').get(line.itemId);
                        if (item?.purchase_rate_paise && item.purchase_rate_paise > 0) {
                            returnUnitCost = item.purchase_rate_paise;
                        }
                    }
                    // Final safeguard: if no cost basis exists at all, fall back to line.ratePaise
                    if (returnUnitCost === 0) {
                        returnUnitCost = line.ratePaise;
                    }
                    const costValue = Math.round(qty * returnUnitCost);
                    stockMovements.push({
                        itemId: line.itemId,
                        godownId: resolvedGodownId,
                        movementType: 'IN',
                        quantity: qty,
                        ratePaise: returnUnitCost,
                        valuePaise: costValue
                    });
                }
                else if (input.voucherType === 'STOCK_JOURNAL') {
                    // P1-2: Add STOCK_JOURNAL stock movement support
                    const movType = line.movementType === 'OUT' ? 'OUT' : 'IN';
                    if (movType === 'OUT') {
                        const allowNegative = input.allowNegativeStock === true;
                        const availability = valuation_js_1.InventoryEngine.validateStockAvailability(db, line.itemId, resolvedGodownId, qty, allowNegative);
                        if (!availability.isValid) {
                            throw new Error(`Insufficient stock for item '${line.itemId}' in godown '${resolvedGodownId}'. Available: ${availability.currentQty}, Requested: ${qty}. Set allowNegativeStock: true to override if business policy permits.`);
                        }
                        let unitRate = line.ratePaise;
                        if (!unitRate || unitRate <= 0) {
                            const stockSummary = valuation_js_1.InventoryEngine.getItemStockSummary(db, line.itemId, input.voucherDate);
                            unitRate = stockSummary.weightedAverageRatePaise > 0
                                ? stockSummary.weightedAverageRatePaise
                                : db.prepare('SELECT purchase_rate_paise FROM stock_items WHERE item_id = ?').get(line.itemId)?.purchase_rate_paise || 0;
                        }
                        const costValue = Math.round(qty * unitRate);
                        stockMovements.push({
                            itemId: line.itemId,
                            godownId: resolvedGodownId,
                            movementType: 'OUT',
                            quantity: qty,
                            ratePaise: unitRate,
                            valuePaise: costValue
                        });
                    }
                    else {
                        // IN movement
                        let unitRate = line.ratePaise;
                        if (!unitRate || unitRate <= 0) {
                            const stockSummary = valuation_js_1.InventoryEngine.getItemStockSummary(db, line.itemId, input.voucherDate);
                            unitRate = stockSummary.weightedAverageRatePaise > 0
                                ? stockSummary.weightedAverageRatePaise
                                : db.prepare('SELECT purchase_rate_paise FROM stock_items WHERE item_id = ?').get(line.itemId)?.purchase_rate_paise || 0;
                        }
                        const costValue = Math.round(qty * unitRate);
                        stockMovements.push({
                            itemId: line.itemId,
                            godownId: resolvedGodownId,
                            movementType: 'IN',
                            quantity: qty,
                            ratePaise: unitRate,
                            valuePaise: costValue
                        });
                    }
                }
            }
        }
        const voucherTotals = gst_engine_js_1.GstEngine.calculateVoucherTotals(taxResults);
        let finalVoucherTotal = voucherTotals.totalAmountPaise;
        if (finalVoucherTotal === 0 && input.customLedgerLines && input.customLedgerLines.length > 0) {
            finalVoucherTotal = input.customLedgerLines.reduce((sum, l) => sum + (l.debitPaise || 0), 0);
        }
        if (finalVoucherTotal === 0 && input.voucherType === 'STOCK_JOURNAL') {
            finalVoucherTotal = stockMovements.reduce((sum, sm) => sum + (sm.valuePaise || 0), 0);
        }
        // 3. Assemble Accounting Lines
        let ledgerLines = [];
        // I-1: Fail-fast ledger lookup — never return an unverified candidate ID.
        const findLedgerId = (possibleIds, nameMatch) => {
            for (const id of possibleIds) {
                const scoped = `${input.companyId}_${id}`;
                if (db.prepare('SELECT 1 FROM ledgers WHERE ledger_id = ? AND company_id = ?').get(scoped, input.companyId))
                    return scoped;
                if (db.prepare('SELECT 1 FROM ledgers WHERE ledger_id = ? AND (company_id = ? OR company_id IS NULL)').get(id, input.companyId))
                    return id;
            }
            if (nameMatch) {
                const row = db.prepare('SELECT ledger_id FROM ledgers WHERE company_id = ? AND ledger_name LIKE ? LIMIT 1').get(input.companyId, nameMatch);
                if (row)
                    return row.ledger_id;
            }
            // Amendment 7: Throw — never silently post to an unverified ledger ID.
            throw new Error(`Required system ledger not found for company '${input.companyId}'. Tried: [${possibleIds.join(', ')}]${nameMatch ? ` or name matching '${nameMatch}'` : ''}. Please verify the chart of accounts.`);
        };
        const voucherStatus = input.status === 'DRAFT' ? 'DRAFT' : 'POSTED';
        const isPosted = voucherStatus === 'POSTED';
        if (isPosted) {
            if (input.customLedgerLines && input.customLedgerLines.length > 0) {
                // SECURITY: Verify all custom ledger IDs belong to this company
                for (const cl of input.customLedgerLines) {
                    if (cl.ledgerId) {
                        const ledger = db.prepare('SELECT company_id FROM ledgers WHERE ledger_id = ?').get(cl.ledgerId);
                        if (ledger && ledger.company_id && ledger.company_id !== input.companyId) {
                            throw new Error(`Security violation: Ledger '${cl.ledgerId}' does not belong to company '${input.companyId}'.`);
                        }
                    }
                }
                // B-2 & DEF-VCH-11: For RECEIPT / PAYMENT vouchers:
                // If partyId is provided, ensure customLedgerLines includes the party ledger
                // If partyId is NOT provided, verify customLedgerLines does NOT affect a debtor/creditor or party ledger
                if (input.voucherType === 'RECEIPT' || input.voucherType === 'PAYMENT') {
                    if (partyLedgerId) {
                        const hasPartyLine = input.customLedgerLines.some(l => l.ledgerId === partyLedgerId);
                        if (!hasPartyLine) {
                            throw new Error(`${input.voucherType} voucher references party '${input.partyId}', but customLedgerLines does not contain party ledger '${partyLedgerId}'.`);
                        }
                    }
                    else {
                        // DEF-VCH-11: Party is mandatory if transaction affects a party/debtor/creditor ledger
                        for (const cl of input.customLedgerLines) {
                            if (cl.ledgerId) {
                                const ledgerCheck = db.prepare(`
                  SELECT l.is_party, lg.group_name, p.party_id
                  FROM ledgers l
                  JOIN ledger_groups lg ON l.group_id = lg.group_id
                  LEFT JOIN parties p ON l.ledger_id = p.ledger_id
                  WHERE l.ledger_id = ?
                `).get(cl.ledgerId);
                                if (ledgerCheck) {
                                    const isPartyLedger = ledgerCheck.is_party === 1 ||
                                        !!ledgerCheck.party_id ||
                                        /debtor|creditor/i.test(ledgerCheck.group_name);
                                    if (isPartyLedger) {
                                        throw new Error(`Party is mandatory for ${input.voucherType} voucher affecting party/debtor/creditor ledger '${cl.ledgerId}'.`);
                                    }
                                }
                            }
                        }
                    }
                }
                ledgerLines = input.customLedgerLines;
            }
            else if (input.voucherType === 'SALES') {
                if (!partyLedgerId)
                    throw new Error('Party (Customer) is mandatory for Sales voucher.');
                // UI-046/UI-047: Extract dedicated non-item charge lines (Freight, Delivery, Packaging, Discount, etc.)
                const chargePostingLines = [];
                for (const pl of processedLines) {
                    if (!pl.lineInput.itemId && (pl.lineInput.ledgerId || pl.taxResult.taxableAmountPaise !== 0)) {
                        let resolvedLedgerId = pl.lineInput.ledgerId;
                        if (!resolvedLedgerId) {
                            try {
                                resolvedLedgerId = findLedgerId(['led_freight_income', 'led_freight', 'led_other_income'], '%Freight%');
                            }
                            catch {
                                resolvedLedgerId = findLedgerId(['led_sales'], '%Sales%');
                            }
                        }
                        chargePostingLines.push({
                            ledgerId: resolvedLedgerId,
                            taxableAmountPaise: pl.taxResult.taxableAmountPaise,
                            description: pl.lineInput.description
                        });
                    }
                }
                ledgerLines = double_entry_js_1.DoubleEntryEngine.buildSalesEntries({
                    customerLedgerId: partyLedgerId,
                    salesLedgerId: findLedgerId(['led_sales'], '%Sales%'),
                    taxableAmountPaise: voucherTotals.taxableAmountPaise,
                    cgstAmountPaise: voucherTotals.cgstAmountPaise,
                    sgstAmountPaise: voucherTotals.sgstAmountPaise,
                    igstAmountPaise: voucherTotals.igstAmountPaise,
                    cessAmountPaise: voucherTotals.cessAmountPaise,
                    roundOffPaise: voucherTotals.roundOffPaise,
                    totalAmountPaise: voucherTotals.totalAmountPaise,
                    outputCgstLedgerId: findLedgerId(['led_out_cgst', 'led_output_cgst'], '%Output CGST%'),
                    outputSgstLedgerId: findLedgerId(['led_out_sgst', 'led_output_sgst'], '%Output SGST%'),
                    outputIgstLedgerId: findLedgerId(['led_out_igst', 'led_output_igst'], '%Output IGST%'),
                    outputCessLedgerId: findLedgerId(['led_out_cess', 'led_output_cess'], '%Output CESS%') || findLedgerId(['led_out_igst', 'led_output_igst'], '%Output IGST%'),
                    roundOffLedgerId: findLedgerId(['led_roundoff', 'led_round_off'], '%Round Off%'),
                    cogsAmountPaise,
                    cogsLedgerId: findLedgerId(['led_cogs'], '%Cost of Goods%'),
                    inventoryLedgerId: findLedgerId(['led_inventory'], '%Inventory%'),
                    chargeLines: chargePostingLines
                });
            }
            else if (input.voucherType === 'PURCHASE') {
                // A-4: Perpetual Inventory Model — Purchase increases Inventory Asset
                if (!partyLedgerId)
                    throw new Error('Party (Supplier) is mandatory for Purchase voucher.');
                // UI-046/UI-047: Extract dedicated non-item charge lines for purchase (Freight Inward, Direct Expenses, Discount Received)
                const chargePostingLines = [];
                for (const pl of processedLines) {
                    if (!pl.lineInput.itemId && (pl.lineInput.ledgerId || pl.taxResult.taxableAmountPaise !== 0)) {
                        let resolvedLedgerId = pl.lineInput.ledgerId;
                        if (!resolvedLedgerId) {
                            try {
                                resolvedLedgerId = findLedgerId(['led_freight', 'led_direct_expense', 'led_other_charges'], '%Freight%');
                            }
                            catch {
                                resolvedLedgerId = findLedgerId(['led_inventory', 'led_purchase'], '%Inventory%');
                            }
                        }
                        chargePostingLines.push({
                            ledgerId: resolvedLedgerId,
                            taxableAmountPaise: pl.taxResult.taxableAmountPaise,
                            description: pl.lineInput.description
                        });
                    }
                }
                ledgerLines = double_entry_js_1.DoubleEntryEngine.buildPurchaseEntries({
                    supplierLedgerId: partyLedgerId,
                    purchaseLedgerId: findLedgerId(['led_inventory', 'led_purchase'], '%Inventory%'),
                    taxableAmountPaise: voucherTotals.taxableAmountPaise,
                    cgstAmountPaise: voucherTotals.cgstAmountPaise,
                    sgstAmountPaise: voucherTotals.sgstAmountPaise,
                    igstAmountPaise: voucherTotals.igstAmountPaise,
                    cessAmountPaise: voucherTotals.cessAmountPaise,
                    roundOffPaise: voucherTotals.roundOffPaise,
                    totalAmountPaise: voucherTotals.totalAmountPaise,
                    inputCgstLedgerId: findLedgerId(['led_in_cgst', 'led_input_cgst'], '%Input CGST%'),
                    inputSgstLedgerId: findLedgerId(['led_in_sgst', 'led_input_sgst'], '%Input SGST%'),
                    inputIgstLedgerId: findLedgerId(['led_in_igst', 'led_input_igst'], '%Input IGST%'),
                    inputCessLedgerId: findLedgerId(['led_in_cess', 'led_input_cess'], '%Input CESS%') || findLedgerId(['led_in_igst', 'led_input_igst'], '%Input IGST%'),
                    roundOffLedgerId: findLedgerId(['led_roundoff', 'led_round_off'], '%Round Off%'),
                    chargeLines: chargePostingLines
                });
            }
            else if (input.voucherType === 'SALES_RETURN' || input.voucherType === 'CREDIT_NOTE') {
                // A-1 / A-3 / A-4: SALES_RETURN and CREDIT_NOTE — reverse the sales journal.
                // CREDIT_NOTE is a SALES_RETURN without mandatory stock movement (handled above).
                if (!partyLedgerId)
                    throw new Error('Party (Customer) is mandatory for Sales Return / Credit Note voucher.');
                let returnCogsPaise = 0;
                if (input.voucherType === 'SALES_RETURN') {
                    returnCogsPaise = stockMovements.reduce((sum, sm) => sum + (sm.valuePaise || 0), 0);
                }
                ledgerLines = double_entry_js_1.DoubleEntryEngine.buildSalesReturnEntries({
                    customerLedgerId: partyLedgerId,
                    salesReturnLedgerId: findLedgerId(['led_sales_return'], '%Sales Return%'),
                    taxableAmountPaise: voucherTotals.taxableAmountPaise,
                    cgstAmountPaise: voucherTotals.cgstAmountPaise,
                    sgstAmountPaise: voucherTotals.sgstAmountPaise,
                    igstAmountPaise: voucherTotals.igstAmountPaise,
                    cessAmountPaise: voucherTotals.cessAmountPaise,
                    roundOffPaise: voucherTotals.roundOffPaise,
                    totalAmountPaise: voucherTotals.totalAmountPaise,
                    outputCgstLedgerId: findLedgerId(['led_out_cgst', 'led_output_cgst'], '%Output CGST%'),
                    outputSgstLedgerId: findLedgerId(['led_out_sgst', 'led_output_sgst'], '%Output SGST%'),
                    outputIgstLedgerId: findLedgerId(['led_out_igst', 'led_output_igst'], '%Output IGST%'),
                    outputCessLedgerId: findLedgerId(['led_out_cess', 'led_output_cess'], '%Output CESS%') || findLedgerId(['led_out_igst', 'led_output_igst'], '%Output IGST%'),
                    roundOffLedgerId: findLedgerId(['led_roundoff', 'led_round_off'], '%Round Off%'),
                    cogsAmountPaise: returnCogsPaise,
                    cogsLedgerId: returnCogsPaise > 0 ? findLedgerId(['led_cogs'], '%Cost of Goods%') : undefined,
                    inventoryLedgerId: returnCogsPaise > 0 ? findLedgerId(['led_inventory'], '%Inventory%') : undefined
                });
            }
            else if (input.voucherType === 'PURCHASE_RETURN' || input.voucherType === 'DEBIT_NOTE') {
                // A-2 / A-3 / A-4: PURCHASE_RETURN and DEBIT_NOTE — reverse the purchase journal and reduce Inventory Asset.
                if (!partyLedgerId)
                    throw new Error('Party (Supplier) is mandatory for Purchase Return / Debit Note voucher.');
                ledgerLines = double_entry_js_1.DoubleEntryEngine.buildPurchaseReturnEntries({
                    supplierLedgerId: partyLedgerId,
                    purchaseReturnLedgerId: findLedgerId(['led_inventory', 'led_purchase_return'], '%Inventory%'),
                    taxableAmountPaise: voucherTotals.taxableAmountPaise,
                    cgstAmountPaise: voucherTotals.cgstAmountPaise,
                    sgstAmountPaise: voucherTotals.sgstAmountPaise,
                    igstAmountPaise: voucherTotals.igstAmountPaise,
                    cessAmountPaise: voucherTotals.cessAmountPaise,
                    roundOffPaise: voucherTotals.roundOffPaise,
                    totalAmountPaise: voucherTotals.totalAmountPaise,
                    inputCgstLedgerId: findLedgerId(['led_in_cgst', 'led_input_cgst'], '%Input CGST%'),
                    inputSgstLedgerId: findLedgerId(['led_in_sgst', 'led_input_sgst'], '%Input SGST%'),
                    inputIgstLedgerId: findLedgerId(['led_in_igst', 'led_input_igst'], '%Input IGST%'),
                    inputCessLedgerId: findLedgerId(['led_in_cess', 'led_input_cess'], '%Input CESS%') || findLedgerId(['led_in_igst', 'led_input_igst'], '%Input IGST%'),
                    roundOffLedgerId: findLedgerId(['led_roundoff', 'led_round_off'], '%Round Off%')
                });
            }
            // 4. Validate Fundamental Double-Entry Invariant.
            // B-1: All posted vouchers (except STOCK_JOURNAL which has no ledger entries by design)
            // must produce at least one ledger line. Catching this early prevents silent no-op posts.
            if (ledgerLines.length === 0 && input.voucherType !== 'STOCK_JOURNAL') {
                throw new Error(`Voucher type '${input.voucherType}' produced no ledger entries. Either supply customLedgerLines or verify party, items, and chart of accounts.`);
            }
            if (ledgerLines.length > 0) {
                const balanceCheck = double_entry_js_1.DoubleEntryEngine.validateBalancedEntries(ledgerLines);
                if (!balanceCheck.isValid) {
                    throw new Error(balanceCheck.errorMessage);
                }
            }
        }
        // DEF-VCH-08: Validate bill allocation reference if supplied
        if (input.billAllocation?.referenceVoucherId) {
            const refRow = db.prepare('SELECT voucher_id, company_id, status FROM vouchers WHERE voucher_id = ?')
                .get(input.billAllocation.referenceVoucherId);
            if (!refRow) {
                throw new Error(`Referenced voucher '${input.billAllocation.referenceVoucherId}' not found.`);
            }
            if (refRow.company_id !== input.companyId) {
                throw new Error(`Security violation: Referenced voucher '${input.billAllocation.referenceVoucherId}' does not belong to company '${input.companyId}'.`);
            }
            if (refRow.status === 'CANCELLED') {
                throw new Error(`Referenced voucher '${input.billAllocation.referenceVoucherId}' is cancelled and cannot be allocated against.`);
            }
        }
        // UI-042: Validate multiple bill allocations if supplied
        if (input.billAllocations && Array.isArray(input.billAllocations)) {
            for (const alloc of input.billAllocations) {
                if (alloc.referenceVoucherId) {
                    const refRow = db.prepare('SELECT voucher_id, voucher_number, total_amount_paise, company_id, status FROM vouchers WHERE voucher_id = ?')
                        .get(alloc.referenceVoucherId);
                    if (!refRow) {
                        throw new Error(`Referenced voucher '${alloc.referenceVoucherId}' not found.`);
                    }
                    if (refRow.company_id !== input.companyId) {
                        throw new Error(`Security violation: Referenced voucher '${alloc.referenceVoucherId}' does not belong to company '${input.companyId}'.`);
                    }
                    if (refRow.status === 'CANCELLED') {
                        throw new Error(`Referenced voucher '${refRow.voucher_number || alloc.referenceVoucherId}' is cancelled and cannot be allocated against.`);
                    }
                    const allocPaise = Number(alloc.amountPaise) || 0;
                    if (allocPaise > 0) {
                        const paidRow = db.prepare(`
              SELECT COALESCE(SUM(ba.amount_paise), 0) as paid_paise
              FROM bill_allocations ba
              JOIN vouchers rv ON ba.voucher_id = rv.voucher_id
              WHERE ba.reference_voucher_id = ? AND rv.status != 'CANCELLED'
            `).get(alloc.referenceVoucherId);
                        const alreadyPaidPaise = Number(paidRow?.paid_paise || 0);
                        const outstandingPaise = Math.max(0, refRow.total_amount_paise - alreadyPaidPaise);
                        if (allocPaise > outstandingPaise) {
                            throw new Error(`Allocation amount ₹${(allocPaise / 100).toFixed(2)} exceeds outstanding balance ₹${(outstandingPaise / 100).toFixed(2)} on invoice '${refRow.voucher_number}'.`);
                        }
                    }
                }
            }
        }
        // 5. ATOMIC DATABASE TRANSACTION (H-1: Concurrency-safe atomic transaction with retry)
        const fyId = input.fyId || input.financialYearId || 'fy_2026_27';
        const referenceNumber = input.referenceNumber || input.referenceNo || input.supplierInvoiceNo || null;
        const referenceDate = input.referenceDate || input.supplierInvoiceDate || null;
        const paymentMode = input.paymentMode || input.paymentTerms || null;
        const termsConditions = input.termsConditions || input.termsAndConditions || null;
        let postedVoucherNumber = '';
        const introducedSerials = [];
        const executePostingDb = () => {
            // DEF-VCH-10: Draft vouchers use manual number if provided, or temporary DFT-... number without consuming statutory sequences
            if (voucherStatus === 'DRAFT') {
                const explicitDraftNum = input.voucherNumber?.trim();
                if (explicitDraftNum) {
                    const excludeId = options?.voucherId || options?.excludeVoucherId;
                    let checkQuery = "SELECT 1 FROM vouchers WHERE company_id = ? AND fy_id = ? AND voucher_type = ? AND voucher_number = ? AND status != 'DRAFT'";
                    const checkParams = [input.companyId, fyId, input.voucherType, explicitDraftNum];
                    if (excludeId) {
                        checkQuery += " AND voucher_id != ?";
                        checkParams.push(excludeId);
                    }
                    const alreadyExists = db.prepare(checkQuery).get(...checkParams);
                    if (alreadyExists) {
                        throw new Error(`Voucher number '${explicitDraftNum}' already exists for this company, financial year, and voucher type.`);
                    }
                    postedVoucherNumber = explicitDraftNum;
                }
                else {
                    postedVoucherNumber = `DFT-${node_crypto_1.default.randomUUID().substring(0, 8).toUpperCase()}`;
                }
            }
            else {
                // DEF-VCH-09: Explicit voucher number collision prevention (recognizes own voucher identity)
                const explicitVNum = input.voucherNumber?.trim();
                if (explicitVNum && !explicitVNum.startsWith('DFT-')) {
                    const excludeId = options?.voucherId || options?.excludeVoucherId;
                    let checkQuery = "SELECT 1 FROM vouchers WHERE company_id = ? AND fy_id = ? AND voucher_type = ? AND voucher_number = ? AND status != 'DRAFT'";
                    const checkParams = [input.companyId, fyId, input.voucherType, explicitVNum];
                    if (excludeId) {
                        checkQuery += " AND voucher_id != ?";
                        checkParams.push(excludeId);
                    }
                    const alreadyExists = db.prepare(checkQuery).get(...checkParams);
                    const inAudit = db.prepare(`
            SELECT 1 FROM audit_logs
            WHERE company_id = ? AND action = 'VOUCHER_PERMANENT_PURGE'
              AND json_extract(details, '$.voucher_number') = ?
              AND json_extract(details, '$.voucher_type') = ?
          `).get(input.companyId, explicitVNum, input.voucherType);
                    if (alreadyExists || inAudit) {
                        throw new Error(`Voucher number '${explicitVNum}' already exists for this company, financial year, and voucher type.`);
                    }
                    postedVoucherNumber = explicitVNum;
                }
                else {
                    postedVoucherNumber = this.getNextVoucherNumber(db, input.companyId, fyId, input.voucherType);
                }
                // If an existing unposted draft holds this exact voucher number, re-key it with DFT- so the posted voucher can claim its statutory sequence
                db.prepare(`
          UPDATE vouchers
          SET voucher_number = 'DFT-' || UPPER(SUBSTR(voucher_id, 5, 8))
          WHERE company_id = ? AND fy_id = ? AND voucher_type = ? AND voucher_number = ? AND status = 'DRAFT' AND voucher_id != ?
        `).run(input.companyId, fyId, input.voucherType, postedVoucherNumber, voucherId);
            }
            // DEF-008-03 / DEF-008-13: Store canonical draft metadata in terms_conditions for 100% round-trip fidelity
            let storedTermsConditions = termsConditions;
            if (voucherStatus === 'DRAFT') {
                const draftMeta = {
                    _draftMeta: {
                        customLedgerLines: input.customLedgerLines || undefined,
                        billAllocation: input.billAllocation || undefined,
                        billAllocations: input.billAllocations || undefined,
                        originalTerms: termsConditions || undefined,
                        lines: input.lines?.map(l => ({
                            itemId: l.itemId,
                            ledgerId: l.ledgerId,
                            godownId: l.godownId,
                            description: l.description,
                            quantity: l.quantity,
                            ratePaise: l.ratePaise,
                            discountPercent: l.discountPercent,
                            discountAmountPaise: l.discountAmountPaise,
                            gstRate: l.gstRate,
                            cessRate: l.cessRate,
                            isTaxInclusive: l.isTaxInclusive,
                            serialNumber: l.serialNumber,
                            movementType: l.movementType
                        }))
                    }
                };
                storedTermsConditions = JSON.stringify(draftMeta);
            }
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
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?
        )
      `).run(voucherId, input.companyId, fyId, input.voucherType, postedVoucherNumber, input.voucherDate, referenceNumber, referenceDate, paymentMode, storedTermsConditions, input.partyId || null, input.narration || null, voucherStatus, voucherTotals.taxableAmountPaise, voucherTotals.cgstAmountPaise, voucherTotals.sgstAmountPaise, voucherTotals.igstAmountPaise, voucherTotals.roundOffPaise, finalVoucherTotal, input.createdBy || 'system');
            // B. Insert Voucher Lines
            let lineNum = 1;
            for (const pl of processedLines) {
                const lineId = 'ln_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16);
                const lineGodownId = pl.lineInput.itemId ? resolveValidGodownId(pl.lineInput.godownId) : null;
                const lineSerial = pl.lineInput.serialNumber || (input.voucherType === 'STOCK_JOURNAL' ? pl.lineInput.movementType : null) || null;
                let lineWarranty = 0;
                let isSerialTracked = false;
                let itemDisplayName = pl.lineInput.description || 'Item';
                if (pl.lineInput.itemId) {
                    const itemMeta = db.prepare('SELECT item_name, warranty_months, has_serial_no FROM stock_items WHERE item_id = ?').get(pl.lineInput.itemId);
                    lineWarranty = pl.lineInput.warrantyMonths !== undefined
                        ? Number(pl.lineInput.warrantyMonths)
                        : Number(itemMeta?.warranty_months || 0);
                    isSerialTracked = Boolean(itemMeta?.has_serial_no === 1);
                    if (itemMeta?.item_name)
                        itemDisplayName = itemMeta.item_name;
                }
                // UI-045: Strict validation for serial-tracked items
                if (isSerialTracked && isPosted && Number(pl.lineInput.quantity) > 0) {
                    if (input.voucherType === 'PURCHASE' || input.voucherType === 'SALES_RETURN') {
                        if (!pl.lineInput.serialNumber || !pl.lineInput.serialNumber.trim()) {
                            throw new Error(`Item '${itemDisplayName}' requires serial numbers. None provided for quantity ${pl.lineInput.quantity}.`);
                        }
                        const serialsArr = pl.lineInput.serialNumber.split(',').map((s) => s.trim()).filter(Boolean);
                        if (serialsArr.length !== Number(pl.lineInput.quantity)) {
                            throw new Error(`Serial count (${serialsArr.length}) does not match quantity (${pl.lineInput.quantity}) for item '${itemDisplayName}'.`);
                        }
                        const uniqueSet = new Set(serialsArr);
                        if (uniqueSet.size !== serialsArr.length) {
                            throw new Error(`Duplicate serial numbers found in line for item '${itemDisplayName}'.`);
                        }
                        if (input.voucherType === 'PURCHASE') {
                            for (const s of serialsArr) {
                                const existingSerial = db.prepare(`
                  SELECT serial_id, status FROM stock_item_serials
                  WHERE (company_id = ? OR company_id IS NULL) AND item_id = ? AND serial_number = ?
                `).get(input.companyId, pl.lineInput.itemId, s);
                                if (existingSerial && existingSerial.status !== 'CANCELLED') {
                                    throw new Error(`Serial number '${s}' already exists for item '${itemDisplayName}' in this company (current status: ${existingSerial.status}).`);
                                }
                            }
                        }
                    }
                    else if (input.voucherType === 'SALES' || input.voucherType === 'PURCHASE_RETURN') {
                        if (!pl.lineInput.serialNumber || !pl.lineInput.serialNumber.trim()) {
                            throw new Error(`Item '${itemDisplayName}' requires serial numbers. None selected for quantity ${pl.lineInput.quantity}.`);
                        }
                        const serialsArr = pl.lineInput.serialNumber.split(',').map((s) => s.trim()).filter(Boolean);
                        if (serialsArr.length !== Number(pl.lineInput.quantity)) {
                            throw new Error(`Serial count (${serialsArr.length}) does not match quantity (${pl.lineInput.quantity}) for item '${itemDisplayName}'.`);
                        }
                        const uniqueSet = new Set(serialsArr);
                        if (uniqueSet.size !== serialsArr.length) {
                            throw new Error(`Duplicate serial numbers selected for item '${itemDisplayName}'.`);
                        }
                        for (const s of serialsArr) {
                            const serialRecord = db.prepare(`
                SELECT serial_id, item_id, godown_id, status FROM stock_item_serials
                WHERE (company_id = ? OR company_id IS NULL) AND item_id = ? AND serial_number = ?
              `).get(input.companyId, pl.lineInput.itemId, s);
                            if (!serialRecord) {
                                throw new Error(`Serial '${s}' does not exist for item '${itemDisplayName}' in this company.`);
                            }
                            if (serialRecord.status !== 'AVAILABLE') {
                                throw new Error(`Serial '${s}' for item '${itemDisplayName}' is not AVAILABLE (current status: ${serialRecord.status}).`);
                            }
                            if (lineGodownId && serialRecord.godown_id && serialRecord.godown_id !== lineGodownId) {
                                throw new Error(`Serial '${s}' is located in a different godown, not '${lineGodownId}'.`);
                            }
                        }
                    }
                }
                db.prepare(`
          INSERT INTO voucher_lines (
            line_id, voucher_id, line_number, item_id, ledger_id, godown_id, description,
            quantity, rate_paise, discount_percent, discount_amount_paise,
            taxable_amount_paise, gst_rate, cgst_amount_paise, sgst_amount_paise,
            igst_amount_paise, total_amount_paise, serial_number, warranty_months
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?
          )
        `).run(lineId, voucherId, lineNum++, pl.lineInput.itemId || null, pl.lineInput.ledgerId || null, lineGodownId, pl.lineInput.description || null, pl.lineInput.quantity || 0, pl.lineInput.ratePaise, pl.lineInput.discountPercent || 0, pl.taxResult.discountAmountPaise, pl.taxResult.taxableAmountPaise, pl.taxResult.cgstRate + pl.taxResult.sgstRate + pl.taxResult.igstRate, pl.taxResult.cgstAmountPaise, pl.taxResult.sgstAmountPaise, pl.taxResult.igstAmountPaise, pl.taxResult.totalAmountPaise, lineSerial, lineWarranty);
                // DEF-VCH-06, DEF-008-07 & UI-045: Authoritative serial lifecycle tracking and mutation
                if (isPosted && pl.lineInput.itemId && pl.lineInput.serialNumber) {
                    const serialsArr = pl.lineInput.serialNumber.split(',').map((s) => s.trim()).filter(Boolean);
                    for (const s of serialsArr) {
                        if (input.voucherType === 'SALES' || input.voucherType === 'PURCHASE_RETURN') {
                            const serialRecord = db.prepare(`
                SELECT serial_id, item_id, godown_id, status FROM stock_item_serials
                WHERE (company_id = ? OR company_id IS NULL) AND item_id = ? AND serial_number = ?
              `).get(input.companyId, pl.lineInput.itemId, s);
                            if (!serialRecord) {
                                const foreign = db.prepare(`
                  SELECT item_id FROM stock_item_serials WHERE (company_id = ? OR company_id IS NULL) AND serial_number = ?
                `).get(input.companyId, s);
                                if (foreign) {
                                    throw new Error(`Serial '${s}' belongs to another item ('${foreign.item_id}'), not '${pl.lineInput.itemId}'.`);
                                }
                                throw new Error(`Serial '${s}' does not exist for item '${pl.lineInput.itemId}'.`);
                            }
                            if (serialRecord.status !== 'AVAILABLE') {
                                throw new Error(`Serial '${s}' for item '${pl.lineInput.itemId}' is not AVAILABLE (current status: ${serialRecord.status}).`);
                            }
                            if (lineGodownId && serialRecord.godown_id && serialRecord.godown_id !== lineGodownId) {
                                throw new Error(`Serial '${s}' is located in a different godown, not '${lineGodownId}'.`);
                            }
                            let saleWarrantyExpiry = null;
                            if (lineWarranty > 0 && input.voucherDate) {
                                try {
                                    const [y, m, d] = input.voucherDate.split('-').map(Number);
                                    const exp = new Date(y, m - 1 + lineWarranty, d);
                                    saleWarrantyExpiry = `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, '0')}-${String(exp.getDate()).padStart(2, '0')}`;
                                }
                                catch { }
                            }
                            db.prepare(`
                UPDATE stock_item_serials
                SET status = ?,
                    company_id = COALESCE(company_id, ?),
                    sales_voucher_id = ?,
                    sales_voucher_line_id = ?,
                    customer_id = ?,
                    sales_date = ?,
                    warranty_expiry_date = COALESCE(?, warranty_expiry_date),
                    updated_at = CURRENT_TIMESTAMP
                WHERE (company_id = ? OR company_id IS NULL) AND item_id = ? AND serial_number = ?
              `).run(input.voucherType === 'PURCHASE_RETURN' ? 'RETURNED' : 'SOLD', input.companyId, voucherId, lineId, input.partyId || null, input.voucherDate, saleWarrantyExpiry, input.companyId, pl.lineInput.itemId, s);
                        }
                        else if (input.voucherType === 'PURCHASE' || input.voucherType === 'SALES_RETURN') {
                            let expiryDate = null;
                            if (lineWarranty > 0 && input.voucherDate) {
                                try {
                                    const [y, m, d] = input.voucherDate.split('-').map(Number);
                                    const exp = new Date(y, m - 1 + lineWarranty, d);
                                    expiryDate = `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, '0')}-${String(exp.getDate()).padStart(2, '0')}`;
                                }
                                catch { }
                            }
                            const existingSerial = db.prepare('SELECT serial_id, status FROM stock_item_serials WHERE (company_id = ? OR company_id IS NULL) AND item_id = ? AND serial_number = ?')
                                .get(input.companyId, pl.lineInput.itemId, s);
                            if (!existingSerial) {
                                db.prepare(`
                  INSERT INTO stock_item_serials (
                    serial_id, company_id, item_id, godown_id, serial_number, status,
                    purchase_voucher_id, purchase_voucher_line_id, supplier_id, purchase_date,
                    warranty_expiry_date, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, 'AVAILABLE', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `).run('ser_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16), input.companyId, pl.lineInput.itemId, lineGodownId, s, voucherId, lineId, input.partyId || null, input.voucherDate, expiryDate);
                                introducedSerials.push({ itemId: pl.lineInput.itemId, serialNumber: s });
                            }
                            else if (input.voucherType === 'SALES_RETURN') {
                                // Customer returning goods restores unit to AVAILABLE
                                db.prepare(`
                  UPDATE stock_item_serials
                  SET status = 'AVAILABLE',
                      company_id = COALESCE(company_id, ?),
                      godown_id = COALESCE(?, godown_id),
                      warranty_expiry_date = COALESCE(warranty_expiry_date, ?),
                      sales_voucher_id = NULL,
                      sales_voucher_line_id = NULL,
                      customer_id = NULL,
                      sales_date = NULL,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE (company_id = ? OR company_id IS NULL) AND item_id = ? AND serial_number = ?
                `).run(input.companyId, lineGodownId, expiryDate, input.companyId, pl.lineInput.itemId, s);
                            }
                            else {
                                // PURCHASE: update record
                                if (existingSerial.status !== 'SOLD') {
                                    db.prepare(`
                    UPDATE stock_item_serials
                    SET status = 'AVAILABLE',
                        company_id = COALESCE(company_id, ?),
                        godown_id = COALESCE(?, godown_id),
                        purchase_voucher_id = ?,
                        purchase_voucher_line_id = ?,
                        supplier_id = COALESCE(?, supplier_id),
                        purchase_date = COALESCE(?, purchase_date),
                        warranty_expiry_date = COALESCE(?, warranty_expiry_date),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE (company_id = ? OR company_id IS NULL) AND item_id = ? AND serial_number = ?
                  `).run(input.companyId, lineGodownId, voucherId, lineId, input.partyId || null, input.voucherDate, expiryDate, input.companyId, pl.lineInput.itemId, s);
                                }
                            }
                        }
                    }
                }
            }
            // DEF-008-03: Secondary fallback representation in voucher_lines for financial draft vouchers
            if (voucherStatus === 'DRAFT' && input.customLedgerLines && input.customLedgerLines.length > 0 && processedLines.length === 0) {
                for (const cl of input.customLedgerLines) {
                    const lineId = 'ln_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16);
                    const amount = (cl.debitPaise || 0) > 0 ? (cl.debitPaise || 0) : (cl.creditPaise || 0);
                    const drCr = (cl.debitPaise || 0) > 0 ? 'DR' : 'CR';
                    db.prepare(`
            INSERT INTO voucher_lines (
              line_id, voucher_id, line_number, item_id, ledger_id, godown_id, description,
              quantity, rate_paise, discount_percent, discount_amount_paise,
              taxable_amount_paise, gst_rate, cgst_amount_paise, sgst_amount_paise,
              igst_amount_paise, total_amount_paise, serial_number
            ) VALUES (
              ?, ?, ?, NULL, ?, NULL, ?,
              1, ?, 0, 0,
              ?, 0, 0, 0,
              0, ?, ?
            )
          `).run(lineId, voucherId, lineNum++, cl.ledgerId, cl.particulars || null, amount, amount, amount, drCr);
                }
            }
            if (isPosted) {
                // C. Insert Ledger Entries
                for (const le of ledgerLines) {
                    const entryId = 'le_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16);
                    db.prepare(`
            INSERT INTO ledger_entries (
              entry_id, voucher_id, ledger_id, entry_date, debit_paise, credit_paise, particulars
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(entryId, voucherId, le.ledgerId, input.voucherDate, le.debitPaise, le.creditPaise, le.particulars || null);
                }
                // D. Insert Stock Entries
                for (const se of stockMovements) {
                    const stockEntryId = 'se_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16);
                    const validGodownId = resolveValidGodownId(se.godownId);
                    db.prepare(`
            INSERT INTO stock_entries (
              stock_entry_id, voucher_id, item_id, godown_id, entry_date,
              movement_type, quantity, rate_paise, value_paise
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(stockEntryId, voucherId, se.itemId, validGodownId, input.voucherDate, se.movementType, se.quantity, se.ratePaise, se.valuePaise);
                }
                // E. Insert Statutory Tax Entries
                // DEF-008-05: Group line taxes by exact statutory rate slab instead of hardcoding 9%/18%
                const teId = () => 'te_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16);
                const isReturn = input.voucherType === 'SALES_RETURN' || input.voucherType === 'CREDIT_NOTE' ||
                    input.voucherType === 'PURCHASE_RETURN' || input.voucherType === 'DEBIT_NOTE';
                const isPurchaseType = input.voucherType === 'PURCHASE' || input.voucherType === 'PURCHASE_RETURN' || input.voucherType === 'DEBIT_NOTE';
                const cgstSlabs = new Map();
                const sgstSlabs = new Map();
                const igstSlabs = new Map();
                const cessSlabs = new Map();
                for (const pl of processedLines) {
                    const tr = pl.taxResult;
                    if (tr.cgstAmountPaise > 0) {
                        const current = cgstSlabs.get(tr.cgstRate) || { taxablePaise: 0, taxPaise: 0 };
                        current.taxablePaise += tr.taxableAmountPaise;
                        current.taxPaise += tr.cgstAmountPaise;
                        cgstSlabs.set(tr.cgstRate, current);
                    }
                    if (tr.sgstAmountPaise > 0) {
                        const current = sgstSlabs.get(tr.sgstRate) || { taxablePaise: 0, taxPaise: 0 };
                        current.taxablePaise += tr.taxableAmountPaise;
                        current.taxPaise += tr.sgstAmountPaise;
                        sgstSlabs.set(tr.sgstRate, current);
                    }
                    if (tr.igstAmountPaise > 0) {
                        const current = igstSlabs.get(tr.igstRate) || { taxablePaise: 0, taxPaise: 0 };
                        current.taxablePaise += tr.taxableAmountPaise;
                        current.taxPaise += tr.igstAmountPaise;
                        igstSlabs.set(tr.igstRate, current);
                    }
                    if (tr.cessAmountPaise > 0) {
                        const current = cessSlabs.get(tr.cessRate) || { taxablePaise: 0, taxPaise: 0 };
                        current.taxablePaise += tr.taxableAmountPaise;
                        current.taxPaise += tr.cessAmountPaise;
                        cessSlabs.set(tr.cessRate, current);
                    }
                }
                const insertTaxStmt = db.prepare(`
          INSERT INTO tax_entries (tax_entry_id, voucher_id, tax_type, rate, taxable_amount_paise, tax_amount_paise, place_of_supply)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
                if (cgstSlabs.size > 0 || sgstSlabs.size > 0 || igstSlabs.size > 0 || cessSlabs.size > 0) {
                    for (const [rate, slab] of cgstSlabs.entries()) {
                        const taxType = isPurchaseType ? 'INPUT_CGST' : 'OUTPUT_CGST';
                        const taxable = isReturn ? -slab.taxablePaise : slab.taxablePaise;
                        const tax = isReturn ? -slab.taxPaise : slab.taxPaise;
                        insertTaxStmt.run(teId(), voucherId, taxType, rate, taxable, tax, placeOfSupplyStateCode);
                    }
                    for (const [rate, slab] of sgstSlabs.entries()) {
                        const taxType = isPurchaseType ? 'INPUT_SGST' : 'OUTPUT_SGST';
                        const taxable = isReturn ? -slab.taxablePaise : slab.taxablePaise;
                        const tax = isReturn ? -slab.taxPaise : slab.taxPaise;
                        insertTaxStmt.run(teId(), voucherId, taxType, rate, taxable, tax, placeOfSupplyStateCode);
                    }
                    for (const [rate, slab] of igstSlabs.entries()) {
                        const taxType = isPurchaseType ? 'INPUT_IGST' : 'OUTPUT_IGST';
                        const taxable = isReturn ? -slab.taxablePaise : slab.taxablePaise;
                        const tax = isReturn ? -slab.taxPaise : slab.taxPaise;
                        insertTaxStmt.run(teId(), voucherId, taxType, rate, taxable, tax, placeOfSupplyStateCode);
                    }
                    for (const [rate, slab] of cessSlabs.entries()) {
                        const taxable = isReturn ? -slab.taxablePaise : slab.taxablePaise;
                        const tax = isReturn ? -slab.taxPaise : slab.taxPaise;
                        insertTaxStmt.run(teId(), voucherId, 'CESS', rate, taxable, tax, placeOfSupplyStateCode);
                    }
                }
                else {
                    // Fallback for non-line vouchers with statutory totals
                    if (voucherTotals.cgstAmountPaise > 0) {
                        const taxType = isPurchaseType ? 'INPUT_CGST' : 'OUTPUT_CGST';
                        const taxAmount = isReturn ? -voucherTotals.cgstAmountPaise : voucherTotals.cgstAmountPaise;
                        insertTaxStmt.run(teId(), voucherId, taxType, 9.00, isReturn ? -voucherTotals.taxableAmountPaise : voucherTotals.taxableAmountPaise, taxAmount, placeOfSupplyStateCode);
                    }
                    if (voucherTotals.sgstAmountPaise > 0) {
                        const taxType = isPurchaseType ? 'INPUT_SGST' : 'OUTPUT_SGST';
                        const taxAmount = isReturn ? -voucherTotals.sgstAmountPaise : voucherTotals.sgstAmountPaise;
                        insertTaxStmt.run(teId(), voucherId, taxType, 9.00, isReturn ? -voucherTotals.taxableAmountPaise : voucherTotals.taxableAmountPaise, taxAmount, placeOfSupplyStateCode);
                    }
                    if (voucherTotals.igstAmountPaise > 0) {
                        const taxType = isPurchaseType ? 'INPUT_IGST' : 'OUTPUT_IGST';
                        const taxAmount = isReturn ? -voucherTotals.igstAmountPaise : voucherTotals.igstAmountPaise;
                        insertTaxStmt.run(teId(), voucherId, taxType, 18.00, isReturn ? -voucherTotals.taxableAmountPaise : voucherTotals.taxableAmountPaise, taxAmount, placeOfSupplyStateCode);
                    }
                    if (voucherTotals.cessAmountPaise > 0) {
                        const cessTaxAmount = isReturn ? -voucherTotals.cessAmountPaise : voucherTotals.cessAmountPaise;
                        insertTaxStmt.run(teId(), voucherId, 'CESS', 0, isReturn ? -voucherTotals.taxableAmountPaise : voucherTotals.taxableAmountPaise, cessTaxAmount, placeOfSupplyStateCode);
                    }
                }
                // F. Bill-Wise Allocations
                // DEF-008-06: Allocate exact party amount in compound vouchers instead of full voucher sum
                if (partyLedgerId && finalVoucherTotal > 0) {
                    const partyLines = ledgerLines.filter(l => l.ledgerId === partyLedgerId);
                    let partyAmountPaise = 0;
                    for (const pl of partyLines) {
                        partyAmountPaise += (pl.creditPaise || 0) + (pl.debitPaise || 0);
                    }
                    if (partyAmountPaise === 0) {
                        partyAmountPaise = finalVoucherTotal;
                    }
                    if (partyAmountPaise > 0) {
                        const allocId = 'ba_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16);
                        const isSettlement = input.voucherType === 'RECEIPT' || input.voucherType === 'PAYMENT' ||
                            input.voucherType === 'CREDIT_NOTE' || input.voucherType === 'DEBIT_NOTE' ||
                            input.voucherType === 'SALES_RETURN' || input.voucherType === 'PURCHASE_RETURN';
                        // UI-042: Support multi-invoice allocation breakdown alongside singular allocation
                        if (input.billAllocations && Array.isArray(input.billAllocations) && input.billAllocations.length > 0) {
                            let totalAllocatedPaise = 0;
                            for (const alloc of input.billAllocations) {
                                const amt = Number(alloc.amountPaise) || 0;
                                if (amt <= 0)
                                    continue;
                                const mAllocId = 'ba_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16);
                                const allocType = alloc.allocationType || (alloc.referenceVoucherId ? 'AGAINST_REF' : 'ON_ACCOUNT');
                                db.prepare(`
                  INSERT INTO bill_allocations (
                    allocation_id, voucher_id, ledger_id, reference_voucher_id,
                    allocation_type, amount_paise, due_date
                  ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(mAllocId, voucherId, partyLedgerId, alloc.referenceVoucherId || null, allocType, amt, alloc.dueDate || null);
                                totalAllocatedPaise += amt;
                            }
                            // If settlement voucher and unallocated remainder remains, auto-assign as ON_ACCOUNT
                            if (isSettlement && totalAllocatedPaise < partyAmountPaise) {
                                const unallocPaise = partyAmountPaise - totalAllocatedPaise;
                                const unallocId = 'ba_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16);
                                db.prepare(`
                  INSERT INTO bill_allocations (
                    allocation_id, voucher_id, ledger_id, reference_voucher_id,
                    allocation_type, amount_paise, due_date
                  ) VALUES (?, ?, ?, NULL, 'ON_ACCOUNT', ?, NULL)
                `).run(unallocId, voucherId, partyLedgerId, unallocPaise);
                            }
                        }
                        else if (input.billAllocation?.referenceVoucherId) {
                            const allocType = input.billAllocation.allocationType || 'AGAINST_REF';
                            let refVoucher = input.billAllocation.referenceVoucherId;
                            db.prepare(`
                INSERT INTO bill_allocations (
                  allocation_id, voucher_id, ledger_id, reference_voucher_id,
                  allocation_type, amount_paise, due_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
              `).run(allocId, voucherId, partyLedgerId, refVoucher, allocType, partyAmountPaise, input.billAllocation?.dueDate || null);
                        }
                        else if (isSettlement) {
                            const allocType = input.billAllocation?.allocationType === 'ADVANCE' ? 'ADVANCE' : 'ON_ACCOUNT';
                            // E-1: Auto ON_ACCOUNT / ADVANCE allocation when billAllocation/referenceVoucherId is omitted for settlement
                            db.prepare(`
                INSERT INTO bill_allocations (
                  allocation_id, voucher_id, ledger_id, reference_voucher_id,
                  allocation_type, amount_paise, due_date
                ) VALUES (?, ?, ?, NULL, ?, ?, NULL)
              `).run(allocId, voucherId, partyLedgerId, allocType, partyAmountPaise);
                        }
                        else {
                            // Standard invoice new reference
                            db.prepare(`
                INSERT INTO bill_allocations (
                  allocation_id, voucher_id, ledger_id, reference_voucher_id,
                  allocation_type, amount_paise, due_date
                ) VALUES (?, ?, ?, ?, 'NEW_REF', ?, ?)
              `).run(allocId, voucherId, partyLedgerId, voucherId, partyAmountPaise, input.billAllocation?.dueDate || null);
                        }
                    }
                }
            }
            // G. Audit Log Entry
            db.prepare(`
        INSERT INTO audit_logs (log_id, company_id, user_id, action, entity_name, entity_id, details)
        VALUES (?, ?, ?, ?, 'VOUCHER', ?, ?)
      `).run('aud_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16), input.companyId, input.createdBy || 'system', isPosted ? `POST_${input.voucherType}` : `DRAFT_${input.voucherType}`, voucherId, JSON.stringify({
                voucherNumber: postedVoucherNumber,
                totalAmountPaise: finalVoucherTotal,
                linesCount: input.lines.length,
                status: voucherStatus,
                introducedSerials
            }));
            // H. Immediate Payment Settlement (UI-030 Phase 4)
            if (isPosted &&
                input.immediatePayment &&
                typeof input.immediatePayment.amountPaise === 'number' &&
                input.immediatePayment.amountPaise > 0 &&
                partyLedgerId &&
                (input.voucherType === 'SALES' || input.voucherType === 'PURCHASE')) {
                const payMode = (input.immediatePayment.mode || 'CASH').toUpperCase();
                const payAmountPaise = Math.min(input.immediatePayment.amountPaise, finalVoucherTotal);
                if (payAmountPaise > 0) {
                    let paymentLedgerId = input.immediatePayment.ledgerId;
                    if (!paymentLedgerId) {
                        try {
                            if (payMode === 'CASH') {
                                paymentLedgerId = findLedgerId(['led_cash'], '%Cash%');
                            }
                            else {
                                paymentLedgerId = findLedgerId(['led_bank'], '%Bank%');
                            }
                        }
                        catch {
                            // Fallback to cash if bank not found
                            paymentLedgerId = findLedgerId(['led_cash'], '%Cash%');
                        }
                    }
                    if (paymentLedgerId) {
                        if (input.voucherType === 'SALES') {
                            const res = PostingEngine.postVoucher(db, {
                                companyId: input.companyId,
                                fyId: input.fyId,
                                voucherType: 'RECEIPT',
                                voucherDate: input.voucherDate,
                                paymentMode: payMode,
                                partyId: input.partyId,
                                referenceNumber: input.immediatePayment.referenceNumber || postedVoucherNumber,
                                narration: `Immediate ${payMode} settlement for invoice ${postedVoucherNumber}`,
                                status: 'POSTED',
                                createdBy: input.createdBy,
                                lines: [],
                                customLedgerLines: [
                                    { ledgerId: paymentLedgerId, debitPaise: payAmountPaise, creditPaise: 0 },
                                    { ledgerId: partyLedgerId, debitPaise: 0, creditPaise: payAmountPaise }
                                ],
                                billAllocation: {
                                    referenceVoucherId: voucherId,
                                    allocationType: 'AGAINST_REF'
                                }
                            }, { skipTransaction: true });
                            settlementVoucherNumber = res.voucherNumber;
                        }
                        else if (input.voucherType === 'PURCHASE') {
                            const res = PostingEngine.postVoucher(db, {
                                companyId: input.companyId,
                                fyId: input.fyId,
                                voucherType: 'PAYMENT',
                                voucherDate: input.voucherDate,
                                paymentMode: payMode,
                                partyId: input.partyId,
                                referenceNumber: input.immediatePayment.referenceNumber || postedVoucherNumber,
                                narration: `Immediate ${payMode} settlement for purchase ${postedVoucherNumber}`,
                                status: 'POSTED',
                                createdBy: input.createdBy,
                                lines: [],
                                customLedgerLines: [
                                    { ledgerId: partyLedgerId, debitPaise: payAmountPaise, creditPaise: 0 },
                                    { ledgerId: paymentLedgerId, debitPaise: 0, creditPaise: payAmountPaise }
                                ],
                                billAllocation: {
                                    referenceVoucherId: voucherId,
                                    allocationType: 'AGAINST_REF'
                                }
                            }, { skipTransaction: true });
                            settlementVoucherNumber = res.voucherNumber;
                        }
                    }
                }
            }
        };
        let settlementVoucherNumber;
        if (options?.skipTransaction) {
            executePostingDb();
        }
        else {
            const maxRetries = 10;
            let attempt = 0;
            while (attempt < maxRetries) {
                try {
                    db.exec('BEGIN IMMEDIATE;');
                    executePostingDb();
                    db.exec('COMMIT;');
                    break;
                }
                catch (err) {
                    try {
                        db.exec('ROLLBACK;');
                    }
                    catch (_) { }
                    if (attempt < maxRetries - 1 && err.message && (err.message.includes('UNIQUE constraint') || err.message.includes('database is locked') || err.message.includes('busy'))) {
                        attempt++;
                        continue;
                    }
                    throw new Error(`Posting transaction failed and was rolled back: ${err.message}`);
                }
            }
        }
        return {
            voucherId,
            voucherNumber: postedVoucherNumber,
            totalAmountPaise: finalVoucherTotal,
            status: voucherStatus,
            ...(settlementVoucherNumber ? { settlementVoucherNumber } : {})
        };
    }
    /**
     * Internal Cancellation Function
     * Executes without its own transaction when called from amendVoucher
     */
    static _cancelVoucherInternal(db, companyId, voucherId, cancelledBy = 'system', reason = 'Cancelled', options) {
        const vch = db.prepare(`
      SELECT v.*, fy.status as fy_status
      FROM vouchers v
      JOIN financial_years fy ON v.fy_id = fy.fy_id
      WHERE v.voucher_id = ?
    `).get(voucherId);
        if (!vch) {
            const vchNoFy = db.prepare('SELECT voucher_id, company_id, status FROM vouchers WHERE voucher_id = ?').get(voucherId);
            if (!vchNoFy) {
                throw new Error(`Voucher with ID '${voucherId}' does not exist.`);
            }
            throw new Error(`Financial year not found for voucher '${voucherId}'.`);
        }
        // DEF-VCH-07: Domain-level tenant hardening
        if (companyId && vch.company_id !== companyId) {
            throw new Error(`Security violation: Voucher '${voucherId}' does not belong to company '${companyId}'.`);
        }
        // DEF-VCH-01 / Invariant: Double cancellation prevention
        if (vch.status === 'CANCELLED') {
            throw new Error(`Voucher '${vch.voucher_number}' is already cancelled.`);
        }
        // DEF-VCH-03: Closed financial year cancellation rejection
        if (vch.fy_status !== 'OPEN') {
            throw new Error(`Cannot cancel voucher '${vch.voucher_number}': Financial Year status is ${vch.fy_status}. Cancellation prohibited.`);
        }
        // UI-045: Check purchase serialized sold guard first - fail fast with exact serial if any unit was sold
        if (vch.voucher_type === 'PURCHASE') {
            const soldUnit = db.prepare(`
        SELECT serial_number FROM stock_item_serials
        WHERE company_id = ? AND purchase_voucher_id = ? AND status = 'SOLD'
        LIMIT 1
      `).get(vch.company_id, voucherId);
            if (soldUnit) {
                throw new Error(`Cannot cancel purchase voucher '${vch.voucher_number}': Serial '${soldUnit.serial_number}' has already been sold to a customer. Reverse the sales voucher first.`);
            }
        }
        // DEF-VCH-05: Inward stock cancellation integrity check (PURCHASE, SALES_RETURN, STOCK_JOURNAL with IN)
        const inwardEntries = db.prepare(`
      SELECT item_id, godown_id, quantity
      FROM stock_entries
      WHERE voucher_id = ? AND movement_type = 'IN'
    `).all(voucherId);
        if (inwardEntries.length > 0 && !options?.allowNegativeStock) {
            for (const entry of inwardEntries) {
                const row = db.prepare(`
          SELECT 
            COALESCE(SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN movement_type = 'OUT' THEN quantity ELSE 0 END), 0) AS balance_qty
          FROM stock_entries
          WHERE item_id = ? AND godown_id = ?
        `).get(entry.item_id, entry.godown_id);
                let currentQty = Number(row?.balance_qty || 0);
                if (currentQty < entry.quantity) {
                    throw new Error(`Cannot cancel inward voucher '${vch.voucher_number}': Cancelling ${entry.quantity} units of item '${entry.item_id}' in godown '${entry.godown_id}' would result in negative stock (${currentQty} available). Dependent outward vouchers have consumed this stock and must be reversed first.`);
                }
            }
        }
        // DEF-VCH-06 & UI-045: Serial safety and lifecycle restoration
        if (vch.voucher_type === 'SALES' || vch.voucher_type === 'PURCHASE_RETURN') {
            // Outward voucher cancelled: restore SOLD serials belonging to this voucher to AVAILABLE
            db.prepare(`
        UPDATE stock_item_serials
        SET status = 'AVAILABLE',
            sales_voucher_id = NULL,
            sales_voucher_line_id = NULL,
            customer_id = NULL,
            sales_date = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE company_id = ? AND sales_voucher_id = ?
      `).run(vch.company_id, voucherId);
            const soldSerials = db.prepare(`
        SELECT item_id, serial_number
        FROM voucher_lines
        WHERE voucher_id = ? AND item_id IS NOT NULL AND serial_number IS NOT NULL
      `).all(voucherId);
            for (const s of soldSerials) {
                const serialsArr = s.serial_number.split(',').map((sn) => sn.trim()).filter(Boolean);
                for (const sn of serialsArr) {
                    db.prepare(`
            UPDATE stock_item_serials
            SET status = 'AVAILABLE',
                sales_voucher_id = NULL,
                sales_voucher_line_id = NULL,
                customer_id = NULL,
                sales_date = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE company_id = ? AND item_id = ? AND serial_number = ? AND (status = 'SOLD' OR status = 'RETURNED')
          `).run(vch.company_id, s.item_id, sn);
                }
            }
        }
        else if (vch.voucher_type === 'SALES_RETURN') {
            // Sales Return cancelled: serials that were returned to stock should be reverted to SOLD
            const returnedSerials = db.prepare(`
        SELECT item_id, serial_number
        FROM voucher_lines
        WHERE voucher_id = ? AND item_id IS NOT NULL AND serial_number IS NOT NULL
      `).all(voucherId);
            for (const s of returnedSerials) {
                const serialsArr = s.serial_number.split(',').map((sn) => sn.trim()).filter(Boolean);
                for (const sn of serialsArr) {
                    db.prepare(`
            UPDATE stock_item_serials
            SET status = 'SOLD',
                updated_at = CURRENT_TIMESTAMP
            WHERE company_id = ? AND item_id = ? AND serial_number = ? AND status = 'AVAILABLE'
          `).run(vch.company_id, s.item_id, sn);
                }
            }
        }
        else if (vch.voucher_type === 'PURCHASE') {
            // Inward voucher cancelled:
            // Guard check: Reject cancellation if ANY unit from this purchase has already been SOLD to a customer!
            const soldUnit = db.prepare(`
        SELECT serial_number FROM stock_item_serials
        WHERE company_id = ? AND purchase_voucher_id = ? AND status = 'SOLD'
        LIMIT 1
      `).get(vch.company_id, voucherId);
            if (soldUnit) {
                throw new Error(`Cannot cancel purchase voucher '${vch.voucher_number}': Serial '${soldUnit.serial_number}' has already been sold to a customer. Reverse the sales voucher first.`);
            }
            let introducedSerials = [];
            const auditRow = db.prepare(`
        SELECT details FROM audit_logs
        WHERE entity_id = ? AND action LIKE 'POST_%'
        ORDER BY created_at DESC LIMIT 1
      `).get(voucherId);
            if (auditRow?.details) {
                try {
                    const parsed = JSON.parse(auditRow.details);
                    if (Array.isArray(parsed.introducedSerials)) {
                        introducedSerials = parsed.introducedSerials;
                    }
                }
                catch (_) { }
            }
            for (const is of introducedSerials) {
                // Verify no other POSTED voucher references this serial
                const otherRef = db.prepare(`
          SELECT 1 FROM voucher_lines vl
          JOIN vouchers v ON vl.voucher_id = v.voucher_id
          WHERE vl.item_id = ? AND (vl.serial_number = ? OR vl.serial_number LIKE ? OR vl.serial_number LIKE ? OR vl.serial_number LIKE ?) AND v.voucher_id != ? AND v.status = 'POSTED'
          LIMIT 1
        `).get(is.itemId, is.serialNumber, `%, ${is.serialNumber}%`, `${is.serialNumber}, %`, `%${is.serialNumber}%`);
                if (!otherRef) {
                    // QA-012: Transition serials to CANCELLED instead of hard-deleting, preserving transaction history
                    db.prepare(`
            UPDATE stock_item_serials
            SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
            WHERE company_id = ? AND item_id = ? AND serial_number = ? AND status = 'AVAILABLE'
          `).run(vch.company_id, is.itemId, is.serialNumber);
                }
            }
            // QA-012: Safeguard all serial units introduced by this purchase voucher to CANCELLED
            db.prepare(`
        UPDATE stock_item_serials
        SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
        WHERE company_id = ? AND purchase_voucher_id = ? AND status = 'AVAILABLE'
      `).run(vch.company_id, voucherId);
        }
        // 1. Mark voucher header as CANCELLED
        db.prepare(`
      UPDATE vouchers
      SET status = 'CANCELLED', cancelled_by = ?, cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = ?
      WHERE voucher_id = ?
    `).run(cancelledBy, reason, voucherId);
        // 2. Remove downstream voucher-owned accounting, inventory, and tax effects
        db.prepare('DELETE FROM ledger_entries WHERE voucher_id = ?').run(voucherId);
        db.prepare('DELETE FROM stock_entries WHERE voucher_id = ?').run(voucherId);
        db.prepare('DELETE FROM tax_entries WHERE voucher_id = ?').run(voucherId);
        db.prepare('DELETE FROM bill_allocations WHERE voucher_id = ?').run(voucherId);
        // 3. Record Audit Log
        db.prepare(`
      INSERT INTO audit_logs (log_id, company_id, user_id, action, entity_name, entity_id, details)
      VALUES (?, ?, ?, 'CANCEL_VOUCHER', 'VOUCHER', ?, ?)
    `).run('aud_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16), vch.company_id, cancelledBy, voucherId, JSON.stringify({ voucherNumber: vch.voucher_number, reason }));
    }
    /**
     * 006-B / DEF-VCH-07: Cancel an existing voucher with complete audit trail and tenant enforcement
     * Supports both modern signature: (db, companyId, voucherId, cancelledBy, reason, options)
     * and legacy signature: (db, voucherId, cancelledByOrReason?, reason?)
     */
    static cancelVoucher(db, companyIdOrVoucherId, voucherIdOrCancelledBy, cancelledByOrReason, reasonParam, options) {
        let companyId;
        let voucherId;
        let cancelledBy = 'system';
        let reason = 'Cancelled';
        if (reasonParam !== undefined) {
            // Unambiguous 5/6-argument modern signature: (db, companyId, voucherId, cancelledBy, reason, options)
            companyId = companyIdOrVoucherId;
            voucherId = voucherIdOrCancelledBy || '';
            cancelledBy = cancelledByOrReason || 'system';
            reason = reasonParam;
        }
        else {
            const vchDirect = db.prepare('SELECT voucher_id, company_id FROM vouchers WHERE voucher_id = ?').get(companyIdOrVoucherId);
            if (vchDirect && (!voucherIdOrCancelledBy || !db.prepare('SELECT 1 FROM vouchers WHERE voucher_id = ?').get(voucherIdOrCancelledBy))) {
                // Legacy signature: (db, voucherId, cancelledBy?, reason?) or (db, voucherId, reason)
                voucherId = companyIdOrVoucherId;
                companyId = vchDirect.company_id;
                if (voucherIdOrCancelledBy && !cancelledByOrReason) {
                    reason = voucherIdOrCancelledBy;
                }
                else {
                    cancelledBy = voucherIdOrCancelledBy || 'system';
                    reason = cancelledByOrReason || 'Cancelled';
                }
            }
            else {
                // Modern signature: (db, companyId, voucherId, cancelledBy?, reason?)
                companyId = companyIdOrVoucherId;
                voucherId = voucherIdOrCancelledBy || '';
                cancelledBy = cancelledByOrReason || 'system';
                reason = reasonParam || 'Cancelled';
            }
        }
        db.exec('BEGIN TRANSACTION;');
        try {
            this._cancelVoucherInternal(db, companyId, voucherId, cancelledBy, reason, options);
            db.exec('COMMIT;');
        }
        catch (err) {
            try {
                db.exec('ROLLBACK;');
            }
            catch (_) { }
            throw err;
        }
    }
    /**
     * 006-A: Atomic Voucher Amendment
     * Atomically cancels original and posts replacement inside single BEGIN IMMEDIATE transaction
     */
    static amendVoucher(db, originalVoucherId, replacementInput) {
        db.exec('BEGIN IMMEDIATE;');
        try {
            // 1. Validate original voucher before mutation
            const original = db.prepare(`
        SELECT v.*, fy.status as fy_status
        FROM vouchers v
        JOIN financial_years fy ON v.fy_id = fy.fy_id
        WHERE v.voucher_id = ?
      `).get(originalVoucherId);
            if (!original) {
                throw new Error(`Original voucher with ID '${originalVoucherId}' not found.`);
            }
            if (original.company_id !== replacementInput.companyId) {
                throw new Error(`Security violation: Original voucher '${originalVoucherId}' does not belong to company '${replacementInput.companyId}'.`);
            }
            if (original.status !== 'POSTED') {
                throw new Error(`Cannot amend voucher '${original.voucher_number}': current status is ${original.status}. Only POSTED vouchers can be amended.`);
            }
            if (original.fy_status !== 'OPEN') {
                throw new Error(`Cannot amend voucher '${original.voucher_number}': Financial Year status is ${original.fy_status}. Amendment prohibited.`);
            }
            // 2. Validate replacement payload prerequisites before destructive cancellation
            const repFy = db.prepare('SELECT status, start_date, end_date FROM financial_years WHERE fy_id = ? AND company_id = ?')
                .get(replacementInput.fyId, replacementInput.companyId);
            if (!repFy)
                throw new Error(`Financial Year '${replacementInput.fyId}' not found for replacement voucher.`);
            if (repFy.status !== 'OPEN')
                throw new Error(`Replacement Financial Year status is ${repFy.status}. Amendment prohibited.`);
            if (replacementInput.voucherDate < repFy.start_date || replacementInput.voucherDate > repFy.end_date) {
                throw new Error(`Replacement voucher date ${replacementInput.voucherDate} is outside the active Financial Year (${repFy.start_date} to ${repFy.end_date}).`);
            }
            // 3. Cancel original internally (within this immediate transaction)
            // DEF-008-07: Allow transient negative stock inside the atomic amendment transaction
            this._cancelVoucherInternal(db, replacementInput.companyId, originalVoucherId, replacementInput.createdBy || 'system', 'Edited — replaced by amended voucher', { allowNegativeStock: true });
            // 4. Post replacement internally (within this immediate transaction)
            // If the amendment input forwarded the original voucher's number (common in UI form submissions),
            // clear it so the replacement voucher is automatically allocated the next sequential statutory number.
            let replacementVoucherNumber = replacementInput.voucherNumber;
            if (replacementVoucherNumber && replacementVoucherNumber.trim() === original.voucher_number) {
                replacementVoucherNumber = undefined;
            }
            const replacementPayload = {
                ...replacementInput,
                voucherNumber: replacementVoucherNumber,
                status: 'POSTED',
                referenceNumber: replacementInput.referenceNumber || `AMEND-${original.voucher_number}`
            };
            const result = this._postVoucherInternal(db, replacementPayload, {
                skipTransaction: true,
                excludeVoucherId: originalVoucherId
            });
            // 5. Invariant check: Assert net post-amendment balance >= 0 for all affected items/godowns
            if (replacementInput.allowNegativeStock !== true) {
                const affectedPairs = db.prepare(`
          SELECT DISTINCT item_id, godown_id FROM stock_entries
          WHERE voucher_id = ? OR voucher_id = ?
        `).all(originalVoucherId, result.voucherId);
                for (const pair of affectedPairs) {
                    const balRow = db.prepare(`
            SELECT 
              COALESCE(SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE 0 END), 0) -
              COALESCE(SUM(CASE WHEN movement_type = 'OUT' THEN quantity ELSE 0 END), 0) AS balance_qty
            FROM stock_entries
            WHERE item_id = ? AND godown_id = ?
          `).get(pair.item_id, pair.godown_id);
                    let finalBal = Number(balRow?.balance_qty || 0);
                    const hasIn = db.prepare("SELECT 1 FROM stock_entries WHERE item_id = ? AND movement_type = 'IN' LIMIT 1").get(pair.item_id);
                    if (!hasIn) {
                        const itemRow = db.prepare('SELECT opening_qty FROM stock_items WHERE item_id = ?').get(pair.item_id);
                        if (itemRow && Number(itemRow.opening_qty) > 0) {
                            finalBal += Number(itemRow.opening_qty);
                        }
                    }
                    if (finalBal < 0) {
                        throw new Error(`Amendment resulted in negative stock balance (${finalBal}) for item '${pair.item_id}' in godown '${pair.godown_id}'. Dependent transactions have consumed this stock.`);
                    }
                }
            }
            db.exec('COMMIT;');
            return {
                originalVoucherId,
                replacementVoucherId: result.voucherId,
                replacementVoucherNumber: result.voucherNumber,
                totalAmountPaise: result.totalAmountPaise,
                status: 'POSTED'
            };
        }
        catch (err) {
            try {
                db.exec('ROLLBACK;');
            }
            catch (_) { }
            throw new Error(`Amendment failed and was rolled back: ${err.message}`);
        }
    }
    /**
     * 006-E: Draft Promotion
     * Promotes DRAFT to POSTED, assigns statutory number, and creates accounting rows
     */
    static postDraftVoucher(db, companyId, voucherId, userId = 'system') {
        db.exec('BEGIN IMMEDIATE;');
        try {
            const vch = db.prepare(`
        SELECT v.*, fy.status as fy_status, fy.start_date, fy.end_date
        FROM vouchers v
        JOIN financial_years fy ON v.fy_id = fy.fy_id
        WHERE v.voucher_id = ?
      `).get(voucherId);
            if (!vch) {
                throw new Error(`Voucher with ID '${voucherId}' does not exist.`);
            }
            if (vch.company_id !== companyId) {
                throw new Error(`Security violation: Voucher '${voucherId}' does not belong to company '${companyId}'.`);
            }
            if (vch.status === 'POSTED') {
                throw new Error(`Voucher '${vch.voucher_number}' is already POSTED.`);
            }
            if (vch.status === 'CANCELLED') {
                throw new Error(`Cannot post CANCELLED voucher '${vch.voucher_number}'.`);
            }
            if (vch.status !== 'DRAFT') {
                throw new Error(`Only DRAFT vouchers can be posted. Current status: ${vch.status}.`);
            }
            if (vch.fy_status !== 'OPEN') {
                throw new Error(`Cannot post draft voucher: Financial Year status is ${vch.fy_status}. Posting prohibited.`);
            }
            // DEF-008-03 / DEF-008-13: Restore canonical draft intent from terms_conditions JSON metadata
            let customLedgerLines;
            let billAllocation;
            let billAllocations;
            let termsConditions = vch.terms_conditions || undefined;
            let lines = [];
            let parsedMeta = null;
            if (vch.terms_conditions) {
                try {
                    const parsed = JSON.parse(vch.terms_conditions);
                    if (parsed && parsed._draftMeta) {
                        parsedMeta = parsed._draftMeta;
                    }
                }
                catch (_) { }
            }
            if (parsedMeta) {
                // Canonical draft representation
                customLedgerLines = parsedMeta.customLedgerLines;
                billAllocation = parsedMeta.billAllocation;
                billAllocations = parsedMeta.billAllocations;
                termsConditions = parsedMeta.originalTerms || undefined;
                if (Array.isArray(parsedMeta.lines)) {
                    lines = parsedMeta.lines;
                }
            }
            // If lines was not populated from canonical metadata, use voucher_lines as recovery fallback
            if (lines.length === 0) {
                const dbLines = db.prepare(`
          SELECT * FROM voucher_lines WHERE voucher_id = ? ORDER BY line_number ASC
        `).all(voucherId);
                lines = dbLines.map(l => ({
                    itemId: l.item_id || undefined,
                    ledgerId: l.ledger_id || undefined,
                    godownId: l.godown_id || undefined,
                    description: l.description || undefined,
                    quantity: l.quantity !== null ? Number(l.quantity) : undefined,
                    ratePaise: Number(l.rate_paise || 0),
                    discountPercent: Number(l.discount_percent || 0),
                    discountAmountPaise: Number(l.discount_amount_paise || 0),
                    gstRate: Number(l.gst_rate || 0),
                    serialNumber: (l.serial_number && l.serial_number !== 'IN' && l.serial_number !== 'OUT' && l.serial_number !== 'DR' && l.serial_number !== 'CR') ? l.serial_number : undefined,
                    movementType: (l.serial_number === 'IN' || l.serial_number === 'OUT') ? l.serial_number : undefined
                }));
                // If financial voucher without customLedgerLines in metadata, fallback from voucher_lines
                if (!customLedgerLines && lines.length > 0 && lines.some(l => l.ledgerId && !l.itemId)) {
                    customLedgerLines = dbLines.filter(l => l.ledger_id && !l.item_id).map(l => ({
                        ledgerId: l.ledger_id,
                        debitPaise: l.serial_number === 'DR' ? Number(l.total_amount_paise || 0) : 0,
                        creditPaise: l.serial_number === 'CR' ? Number(l.total_amount_paise || 0) : 0,
                        particulars: l.description || undefined
                    }));
                    lines = [];
                }
            }
            // Reconstruct payload
            const payload = {
                companyId: vch.company_id,
                fyId: vch.fy_id,
                voucherType: vch.voucher_type,
                voucherDate: vch.voucher_date,
                referenceNumber: vch.reference_number || undefined,
                referenceDate: vch.reference_date || undefined,
                paymentMode: vch.payment_mode || undefined,
                termsConditions,
                partyId: vch.party_id || undefined,
                narration: vch.narration || undefined,
                lines,
                customLedgerLines,
                billAllocation,
                billAllocations,
                status: 'POSTED',
                createdBy: userId
            };
            // Clean out draft lines and header so _postVoucherInternal can re-create them with official number
            db.prepare('DELETE FROM voucher_lines WHERE voucher_id = ?').run(voucherId);
            db.prepare('DELETE FROM vouchers WHERE voucher_id = ?').run(voucherId);
            const result = this._postVoucherInternal(db, payload, { skipTransaction: true, voucherId });
            db.exec('COMMIT;');
            return {
                ...result,
                status: 'POSTED'
            };
        }
        catch (err) {
            try {
                db.exec('ROLLBACK;');
            }
            catch (_) { }
            throw new Error(`Draft promotion failed and was rolled back: ${err.message}`);
        }
    }
    /**
     * DEF-REP-07: Atomic Opening Stock Recording
     * Creates STOCK_JOURNAL, stock_entries record, updates item opening values,
     * and synchronizes the Inventory Asset ledger opening balance without inventing counterparts.
     */
    static recordOpeningStock(db, params, options) {
        const qty = Number(params.quantity);
        const rate = Math.round(Number(params.ratePaise));
        if (qty <= 0 || rate <= 0) {
            throw new Error('Opening stock quantity and rate must be greater than zero.');
        }
        const openingVal = Math.round(qty * rate);
        const entryDate = params.date || new Date().toISOString().split('T')[0];
        let fyId;
        if (params.fyId) {
            const explicitFy = db.prepare('SELECT status, start_date, end_date FROM financial_years WHERE fy_id = ? AND company_id = ?')
                .get(params.fyId, params.companyId);
            if (!explicitFy) {
                throw new Error(`Cannot record opening stock: Financial Year '${params.fyId}' not found for company '${params.companyId}'.`);
            }
            if (explicitFy.status !== 'OPEN') {
                throw new Error(`Cannot record opening stock: Financial Year '${params.fyId}' is ${explicitFy.status}. Posting prohibited.`);
            }
            fyId = params.fyId;
        }
        else {
            const dateFy = db.prepare(`
        SELECT fy_id, status FROM financial_years 
        WHERE company_id = ? AND ? BETWEEN start_date AND end_date AND status = 'OPEN' 
        LIMIT 1
      `).get(params.companyId, entryDate);
            if (!dateFy) {
                throw new Error(`Cannot record opening stock: No open financial year found for company '${params.companyId}' covering date '${entryDate}'.`);
            }
            fyId = dateFy.fy_id;
        }
        const inOuterTx = options?.skipTransaction === true;
        if (!inOuterTx) {
            db.exec('SAVEPOINT sp_record_opening_stock;');
        }
        try {
            const voucherId = 'vch_' + node_crypto_1.default.randomUUID().replace(/-/g, '');
            const voucherNumber = PostingEngine.getNextVoucherNumber(db, params.companyId, fyId, 'STOCK_JOURNAL');
            const itemName = params.itemName || db.prepare('SELECT item_name FROM stock_items WHERE item_id = ?').get(params.itemId)?.item_name || 'Item';
            // 1. Create STOCK_JOURNAL voucher
            db.prepare(`
        INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, narration, status, total_amount_paise, created_by)
        VALUES (?, ?, ?, 'STOCK_JOURNAL', ?, ?, ?, 'POSTED', ?, ?)
      `).run(voucherId, params.companyId, fyId, voucherNumber, entryDate, `Opening Stock for '${itemName}'`, openingVal, params.userId || 'system');
            // 2. Create stock_entries record
            const entryId = 'se_opn_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16);
            const defGodown = db.prepare('SELECT godown_id FROM godowns WHERE company_id = ? LIMIT 1').get(params.companyId);
            const godownId = params.godownId || defGodown?.godown_id || `${params.companyId}_godown_main`;
            db.prepare(`
        INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
        VALUES (?, ?, ?, ?, ?, 'IN', ?, ?, ?)
      `).run(entryId, voucherId, params.itemId, godownId, entryDate, qty, rate, openingVal);
            // 3. Update stock_items opening_qty and opening_rate_paise if not already set
            const itemRow = db.prepare('SELECT opening_qty FROM stock_items WHERE item_id = ?').get(params.itemId);
            if (!itemRow || Number(itemRow.opening_qty) === 0) {
                db.prepare('UPDATE stock_items SET opening_qty = ?, opening_rate_paise = ? WHERE item_id = ?').run(qty, rate, params.itemId);
            }
            // 4. DEF-REP-07: Synchronize Inventory Asset ledger opening balance
            const invLedger = db.prepare(`
        SELECT ledger_id, opening_balance_paise, opening_balance_type FROM ledgers
        WHERE company_id = ? AND (ledger_id = ? OR ledger_name LIKE '%Inventory%')
        LIMIT 1
      `).get(params.companyId, `${params.companyId}_led_inventory`);
            if (invLedger) {
                const currentBal = invLedger.opening_balance_type === 'DR'
                    ? Number(invLedger.opening_balance_paise || 0)
                    : -Number(invLedger.opening_balance_paise || 0);
                const newBal = currentBal + openingVal;
                db.prepare(`
          UPDATE ledgers
          SET opening_balance_paise = ?,
              opening_balance_type = ?
          WHERE ledger_id = ?
        `).run(Math.abs(newBal), newBal >= 0 ? 'DR' : 'CR', invLedger.ledger_id);
            }
            // 5. Register opening stock serialized units if provided
            if (params.serialNumbers) {
                const serialsArr = Array.isArray(params.serialNumbers)
                    ? params.serialNumbers.map(s => s.trim()).filter(Boolean)
                    : params.serialNumbers.split(',').map((s) => s.trim()).filter(Boolean);
                for (const s of serialsArr) {
                    const existing = db.prepare(`
            SELECT serial_id FROM stock_item_serials
            WHERE company_id = ? AND item_id = ? AND serial_number = ?
          `).get(params.companyId, params.itemId, s);
                    if (!existing) {
                        db.prepare(`
              INSERT INTO stock_item_serials (
                serial_id, company_id, item_id, godown_id, serial_number, status,
                purchase_voucher_id, purchase_date, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, 'AVAILABLE', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run('ser_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16), params.companyId, params.itemId, godownId, s, voucherId, entryDate);
                    }
                    else {
                        db.prepare(`
              UPDATE stock_item_serials
              SET status = 'AVAILABLE', godown_id = ?, purchase_date = ?, updated_at = CURRENT_TIMESTAMP
              WHERE company_id = ? AND item_id = ? AND serial_number = ?
            `).run(godownId, entryDate, params.companyId, params.itemId, s);
                    }
                }
            }
            if (!inOuterTx) {
                db.exec('RELEASE SAVEPOINT sp_record_opening_stock;');
            }
            return { voucherId, stockEntryId: entryId, openingValPaise: openingVal };
        }
        catch (err) {
            if (!inOuterTx) {
                try {
                    db.exec('ROLLBACK TO SAVEPOINT sp_record_opening_stock;');
                    db.exec('RELEASE SAVEPOINT sp_record_opening_stock;');
                }
                catch (_) { }
            }
            throw err;
        }
    }
    /**
     * UI-031: Update Draft Voucher in-place
     * Updates an unposted draft without consuming a new sequence number.
     */
    static updateDraftVoucher(db, voucherId, input) {
        db.exec('BEGIN IMMEDIATE;');
        try {
            const vch = db.prepare(`
        SELECT v.*, fy.status as fy_status, fy.start_date, fy.end_date
        FROM vouchers v
        JOIN financial_years fy ON v.fy_id = fy.fy_id
        WHERE v.voucher_id = ?
      `).get(voucherId);
            if (!vch) {
                throw new Error(`Voucher with ID '${voucherId}' not found.`);
            }
            if (vch.company_id !== input.companyId) {
                throw new Error(`Security violation: Voucher '${voucherId}' does not belong to company '${input.companyId}'.`);
            }
            if (vch.status !== 'DRAFT') {
                throw new Error(`Cannot update voucher '${vch.voucher_number}': current status is ${vch.status}. Only DRAFT vouchers can be updated in-place.`);
            }
            if (vch.fy_status !== 'OPEN') {
                throw new Error(`Cannot update draft voucher: Financial Year status is ${vch.fy_status}. Updating prohibited.`);
            }
            // Company state for GST Place of Supply
            const company = db.prepare('SELECT state_code, company_name FROM companies WHERE company_id = ?')
                .get(input.companyId);
            if (!company)
                throw new Error(`Company '${input.companyId}' not found.`);
            let placeOfSupplyStateCode = company.state_code;
            if (input.partyId) {
                const party = db.prepare(`
          SELECT p.ledger_id, p.company_id, pa.state_code
          FROM parties p
          LEFT JOIN party_addresses pa ON p.party_id = pa.party_id
          WHERE p.party_id = ?
        `).get(input.partyId);
                if (party && party.state_code) {
                    placeOfSupplyStateCode = party.state_code;
                }
            }
            // Process lines & compute taxes
            const taxResults = [];
            const processedLines = [];
            for (const line of input.lines) {
                let gstRate = line.gstRate ?? 18;
                let cessRate = line.cessRate ?? 0;
                if (line.itemId) {
                    const item = db.prepare('SELECT gst_rate, cess_rate FROM stock_items WHERE item_id = ?')
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
            }
            const voucherTotals = gst_engine_js_1.GstEngine.calculateVoucherTotals(taxResults);
            let finalVoucherTotal = voucherTotals.totalAmountPaise;
            if (finalVoucherTotal === 0 && input.customLedgerLines && input.customLedgerLines.length > 0) {
                finalVoucherTotal = input.customLedgerLines.reduce((sum, l) => sum + (l.debitPaise || 0), 0);
            }
            // Metadata to preserve draft reconstitution fidelity
            let storedTermsConditions = input.termsConditions || null;
            const draftMeta = {
                _draftMeta: {
                    originalTerms: input.termsConditions,
                    billAllocation: input.billAllocation,
                    customLedgerLines: input.customLedgerLines,
                    lines: input.lines.map(l => ({
                        itemId: l.itemId,
                        ledgerId: l.ledgerId,
                        godownId: l.godownId,
                        description: l.description,
                        quantity: l.quantity,
                        ratePaise: l.ratePaise,
                        discountPercent: l.discountPercent,
                        discountAmountPaise: l.discountAmountPaise,
                        gstRate: l.gstRate,
                        cessRate: l.cessRate,
                        isTaxInclusive: l.isTaxInclusive,
                        serialNumber: l.serialNumber,
                        movementType: l.movementType
                    }))
                }
            };
            storedTermsConditions = JSON.stringify(draftMeta);
            // Validate candidate voucher number if updated, recognizing own voucher identity
            let targetVoucherNumber = vch.voucher_number;
            if (input.voucherNumber && input.voucherNumber.trim() && input.voucherNumber.trim() !== vch.voucher_number) {
                const candidate = input.voucherNumber.trim();
                const existing = db.prepare("SELECT 1 FROM vouchers WHERE company_id = ? AND fy_id = ? AND voucher_type = ? AND voucher_number = ? AND voucher_id != ?").get(input.companyId, vch.fy_id, vch.voucher_type, candidate, voucherId);
                const inAudit = db.prepare(`
          SELECT 1 FROM audit_logs
          WHERE company_id = ? AND action = 'VOUCHER_PERMANENT_PURGE'
            AND json_extract(details, '$.voucher_number') = ?
            AND json_extract(details, '$.voucher_type') = ?
        `).get(input.companyId, candidate, vch.voucher_type);
                if (existing || inAudit) {
                    throw new Error(`Voucher number '${candidate}' already exists for this company, financial year, and voucher type.`);
                }
                targetVoucherNumber = candidate;
            }
            // Update vouchers table in-place (recognizing existing voucher identity)
            db.prepare(`
        UPDATE vouchers SET
          voucher_number = ?,
          voucher_date = ?,
          reference_number = ?,
          reference_date = ?,
          payment_mode = ?,
          terms_conditions = ?,
          party_id = ?,
          narration = ?,
          taxable_amount_paise = ?,
          cgst_amount_paise = ?,
          sgst_amount_paise = ?,
          igst_amount_paise = ?,
          round_off_paise = ?,
          total_amount_paise = ?
        WHERE voucher_id = ?
      `).run(targetVoucherNumber, input.voucherDate || vch.voucher_date, input.referenceNumber || null, input.referenceDate || null, input.paymentMode || vch.payment_mode || null, storedTermsConditions, input.partyId || null, input.narration || null, voucherTotals.taxableAmountPaise, voucherTotals.cgstAmountPaise, voucherTotals.sgstAmountPaise, voucherTotals.igstAmountPaise, voucherTotals.roundOffPaise, finalVoucherTotal, voucherId);
            // Delete old voucher lines
            db.prepare('DELETE FROM voucher_lines WHERE voucher_id = ?').run(voucherId);
            // Insert new voucher lines
            let lineNum = 1;
            for (const pl of processedLines) {
                const lineId = 'ln_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16);
                const lineSerial = pl.lineInput.serialNumber || (input.voucherType === 'STOCK_JOURNAL' ? pl.lineInput.movementType : null) || null;
                let lineWarranty = 0;
                if (pl.lineInput.itemId) {
                    const itemMeta = db.prepare('SELECT warranty_months FROM stock_items WHERE item_id = ?').get(pl.lineInput.itemId);
                    lineWarranty = Number(itemMeta?.warranty_months || 0);
                }
                db.prepare(`
          INSERT INTO voucher_lines (
            line_id, voucher_id, line_number, item_id, ledger_id, godown_id, description,
            quantity, rate_paise, discount_percent, discount_amount_paise,
            taxable_amount_paise, gst_rate, cgst_amount_paise, sgst_amount_paise,
            igst_amount_paise, total_amount_paise, serial_number, warranty_months
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?
          )
        `).run(lineId, voucherId, lineNum++, pl.lineInput.itemId || null, pl.lineInput.ledgerId || null, pl.lineInput.godownId || null, pl.lineInput.description || null, pl.lineInput.quantity || 0, pl.lineInput.ratePaise, pl.lineInput.discountPercent || 0, pl.taxResult.discountAmountPaise, pl.taxResult.taxableAmountPaise, pl.taxResult.cgstRate + pl.taxResult.sgstRate + pl.taxResult.igstRate, pl.taxResult.cgstAmountPaise, pl.taxResult.sgstAmountPaise, pl.taxResult.igstAmountPaise, pl.taxResult.totalAmountPaise, lineSerial, lineWarranty);
            }
            // Audit log entry
            db.prepare(`
        INSERT INTO audit_logs (log_id, company_id, user_id, action, entity_name, entity_id, details)
        VALUES (?, ?, ?, 'UPDATE_DRAFT_VOUCHER', 'VOUCHER', ?, ?)
      `).run('aud_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16), input.companyId, input.createdBy || 'system', voucherId, JSON.stringify({
                voucherNumber: vch.voucher_number,
                totalAmountPaise: finalVoucherTotal,
                linesCount: input.lines.length,
                status: 'DRAFT'
            }));
            db.exec('COMMIT;');
            return {
                voucherId,
                voucherNumber: vch.voucher_number,
                totalAmountPaise: finalVoucherTotal,
                status: 'DRAFT'
            };
        }
        catch (err) {
            try {
                db.exec('ROLLBACK;');
            }
            catch (_) { }
            throw err;
        }
    }
}
exports.PostingEngine = PostingEngine;
