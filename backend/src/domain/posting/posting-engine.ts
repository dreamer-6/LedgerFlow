import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { GstEngine, LineTaxCalculationResult } from '../tax/gst-engine.js';
import { DoubleEntryEngine, LedgerPostingLine } from '../accounting/double-entry.js';
import { InventoryEngine } from '../inventory/valuation.js';

export interface CreateVoucherLineInput {
  itemId?: string;
  ledgerId?: string;
  godownId?: string;
  description?: string;
  quantity?: number;
  ratePaise: number;
  discountPercent?: number;
  discountAmountPaise?: number;
  gstRate?: number;
  cessRate?: number;
  isTaxInclusive?: boolean;
  serialNumber?: string;
  movementType?: 'IN' | 'OUT';
}

export interface CreateVoucherInput {
  companyId: string;
  fyId: string;
  voucherType:
    | 'SALES'
    | 'PURCHASE'
    | 'RECEIPT'
    | 'PAYMENT'
    | 'CONTRA'
    | 'JOURNAL'
    | 'CREDIT_NOTE'
    | 'DEBIT_NOTE'
    | 'SALES_RETURN'
    | 'PURCHASE_RETURN'
    | 'STOCK_JOURNAL';
  voucherDate: string; // YYYY-MM-DD
  voucherNumber?: string;
  referenceNumber?: string;
  referenceDate?: string;
  paymentMode?: string;
  termsConditions?: string;
  partyId?: string;
  narration?: string;
  lines: CreateVoucherLineInput[];
  status?: 'DRAFT' | 'POSTED';
  // For financial vouchers (Receipt, Payment, Contra, Journal)
  customLedgerLines?: LedgerPostingLine[];
  // Bill allocation settlement
  billAllocation?: {
    referenceVoucherId?: string;
    allocationType: 'NEW_REF' | 'AGAINST_REF' | 'ADVANCE' | 'ON_ACCOUNT';
    dueDate?: string;
  };
  createdBy?: string;
  allowNegativeStock?: boolean;
}

export class PostingEngine {
  /**
   * Generates the next sequential voucher number
   */
  public static getNextVoucherNumber(
    db: DatabaseSync,
    companyId: string,
    fyId: string,
    voucherType: string
  ): string {
    const prefixes: Record<string, string> = {
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

    // Extract FY code (e.g. 2026-2027 -> 2627)
    let fyCode = '2627';
    if (fyId) {
      const fy = db.prepare('SELECT name, start_date, end_date FROM financial_years WHERE fy_id = ?').get(fyId) as any;
      if (fy?.start_date && fy?.end_date) {
        const sY = fy.start_date.substring(2, 4);
        const eY = fy.end_date.substring(2, 4);
        fyCode = `${sY}${eY}`;
      } else if (fy?.name) {
        const digits = fy.name.replace(/\D/g, '');
        if (digits.length >= 4) fyCode = digits.slice(-4);
      }
    }

    // For Sales Invoices, use company name initials/acronym (e.g., Dream Tech Solutions -> DTS)
    // Formatted strictly like: DTS-2627-000
    if (voucherType === 'SALES') {
      let compAcronym = 'DTS';
      const comp = db.prepare('SELECT company_name FROM companies WHERE company_id = ?').get(companyId) as { company_name: string } | undefined;
      if (comp && comp.company_name) {
        const words = comp.company_name.trim().split(/[\s_-]+/).filter(w => w.length > 0);
        if (words.length > 1) {
          compAcronym = words.map(w => w[0].toUpperCase()).join('');
        } else if (words.length === 1) {
          compAcronym = words[0].substring(0, 3).toUpperCase();
        }
      }
      prefix = `${compAcronym}-${fyCode}`;
    }

    const row = db.prepare(`
      SELECT voucher_number FROM vouchers
      WHERE company_id = ? AND fy_id = ? AND voucher_type = ?
      ORDER BY rowid DESC LIMIT 1
    `).get(companyId, fyId, voucherType) as { voucher_number: string } | undefined;

    let nextCounter = 0;
    if (row && row.voucher_number) {
      const parts = row.voucher_number.split(/[-/]/);
      const lastNumStr = parts[parts.length - 1];
      const parsed = parseInt(lastNumStr, 10);
      if (!isNaN(parsed)) {
        nextCounter = parsed + 1;
      }
    }

    let candidate = `${prefix}-${nextCounter.toString().padStart(3, '0')}`;
    while (
      db.prepare(
        'SELECT 1 FROM vouchers WHERE company_id = ? AND fy_id = ? AND voucher_type = ? AND voucher_number = ?'
      ).get(companyId, fyId, voucherType, candidate)
    ) {
      nextCounter++;
      candidate = `${prefix}-${nextCounter.toString().padStart(3, '0')}`;
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
  public static postVoucher(db: DatabaseSync, input: CreateVoucherInput): {
    voucherId: string;
    voucherNumber: string;
    totalAmountPaise: number;
    status: 'DRAFT' | 'POSTED';
  } {
    return this._postVoucherInternal(db, input, { skipTransaction: false });
  }

  /**
   * Internal Posting Function
   * Supports execution inside an existing transaction (skipTransaction: true) or standalone with retry loop
   */
  private static _postVoucherInternal(
    db: DatabaseSync,
    input: CreateVoucherInput,
    options?: { skipTransaction?: boolean; voucherId?: string }
  ): {
    voucherId: string;
    voucherNumber: string;
    totalAmountPaise: number;
    status: 'DRAFT' | 'POSTED';
  } {
    // DEF-VCH-12: AMENDED status is reserved and cannot be set directly
    if ((input.status as any) === 'AMENDED') {
      throw new Error("Status 'AMENDED' is reserved and cannot be set directly.");
    }

    // 1. Basic Validations
    // Verify financial year belongs to THIS company (cross-company FY injection prevention)
    const fy = db.prepare('SELECT status, start_date, end_date FROM financial_years WHERE fy_id = ? AND company_id = ?')
      .get(input.fyId, input.companyId) as { status: string; start_date: string; end_date: string } | undefined;

    if (!fy) throw new Error(`Financial Year '${input.fyId}' not found for this company.`);
    if (fy.status !== 'OPEN') throw new Error(`Financial Year status is ${fy.status}. Posting prohibited.`);
    if (input.voucherDate < fy.start_date || input.voucherDate > fy.end_date) {
      throw new Error(`Voucher date ${input.voucherDate} is outside the active Financial Year (${fy.start_date} to ${fy.end_date}).`);
    }

    // Company state for GST Place of Supply
    const company = db.prepare('SELECT state_code, company_name FROM companies WHERE company_id = ?')
      .get(input.companyId) as { state_code: string; company_name: string } | undefined;
    if (!company) throw new Error(`Company '${input.companyId}' not found.`);

    let placeOfSupplyStateCode = company.state_code;
    let partyLedgerId: string | null = null;

    if (input.partyId) {
      // SECURITY: Verify party belongs to this company (cross-company party injection prevention)
      const party = db.prepare(`
        SELECT p.ledger_id, p.company_id, pa.state_code
        FROM parties p
        LEFT JOIN party_addresses pa ON p.party_id = pa.party_id
        WHERE p.party_id = ?
      `).get(input.partyId) as { ledger_id: string; company_id: string; state_code?: string } | undefined;

      if (!party) throw new Error(`Party with ID '${input.partyId}' not found.`);
      if (party.company_id !== input.companyId) {
        throw new Error(`Security violation: Party '${input.partyId}' does not belong to company '${input.companyId}'.`);
      }
      partyLedgerId = party.ledger_id;
      if (party.state_code) {
        placeOfSupplyStateCode = party.state_code;
      }
    }

    const voucherId = options?.voucherId || ('vch_' + crypto.randomUUID().replace(/-/g, ''));
    const fyIdToUse = input.fyId || (input as any).financialYearId || 'fy_2026_27';

    // 2. Perform Calculations Based on Voucher Type
    const processedLines: Array<{
      lineInput: CreateVoucherLineInput;
      taxResult: LineTaxCalculationResult;
    }> = [];

    const taxResults: LineTaxCalculationResult[] = [];
    const stockMovements: Array<{
      itemId: string;
      godownId: string;
      movementType: 'IN' | 'OUT';
      quantity: number;
      ratePaise: number;
      valuePaise: number;
    }> = [];

    let cogsAmountPaise = 0;

    // Helper to resolve valid godown for company
    const resolveValidGodownId = (requestedGodownId?: string | null): string => {
      if (requestedGodownId) {
        const check = db.prepare('SELECT godown_id FROM godowns WHERE godown_id = ? AND (company_id = ? OR company_id IS NULL)').get(requestedGodownId, input.companyId) as any;
        if (check) return check.godown_id;

        // If requested godown exists for another company, throw security violation
        const foreign = db.prepare('SELECT company_id FROM godowns WHERE godown_id = ?').get(requestedGodownId) as any;
        if (foreign) {
          throw new Error(`Security violation: Godown '${requestedGodownId}' does not belong to company '${input.companyId}'.`);
        }
        throw new Error(`Godown '${requestedGodownId}' not found for company '${input.companyId}'.`);
      }
      const defaultGodown = db.prepare('SELECT godown_id FROM godowns WHERE company_id = ? ORDER BY is_default DESC LIMIT 1').get(input.companyId) as { godown_id: string } | undefined;
      if (defaultGodown) return defaultGodown.godown_id;

      const anyGodown = db.prepare('SELECT godown_id FROM godowns WHERE company_id = ? LIMIT 1').get(input.companyId) as { godown_id: string } | undefined;
      if (anyGodown) return anyGodown.godown_id;

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
        const ledger = db.prepare('SELECT company_id FROM ledgers WHERE ledger_id = ?').get(line.ledgerId) as any;
        if (!ledger) {
          throw new Error(`Ledger '${line.ledgerId}' not found.`);
        }
        if (ledger.company_id && ledger.company_id !== input.companyId) {
          throw new Error(`Security violation: Ledger '${line.ledgerId}' does not belong to company '${input.companyId}'.`);
        }
      }

      // If item provided, retrieve item's default GST rate if not explicitly passed
      if (line.itemId) {
        const item = db.prepare('SELECT gst_rate, cess_rate, item_name, company_id FROM stock_items WHERE item_id = ?')
          .get(line.itemId) as { gst_rate: number; cess_rate: number; item_name: string; company_id: string } | undefined;
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
      }

      const taxRes = GstEngine.calculateLineTax({
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
          // C-4: Validate stock availability prior to outward posting
          const allowNegative = input.allowNegativeStock === true;
          const availability = InventoryEngine.validateStockAvailability(db, line.itemId, resolvedGodownId, qty, allowNegative);
          if (!availability.isValid) {
            throw new Error(`Insufficient stock for item '${line.itemId}' in godown '${resolvedGodownId}'. Available: ${availability.currentQty}, Requested: ${qty}. Set allowNegativeStock: true to override if business policy permits.`);
          }

          // C-2: Validate stock and cost at Weighted Average (throw on zero-stock, do not fall back to selling price)
          const stockSummary = InventoryEngine.getItemStockSummary(db, line.itemId, input.voucherDate);
          let unitCost: number;
          if (input.voucherType === 'SALES') {
            const item = db.prepare('SELECT purchase_rate_paise FROM stock_items WHERE item_id = ?').get(line.itemId) as { purchase_rate_paise?: number } | undefined;
            unitCost = stockSummary.weightedAverageRatePaise > 0
              ? stockSummary.weightedAverageRatePaise
              : (item?.purchase_rate_paise && item.purchase_rate_paise > 0 ? item.purchase_rate_paise : 0);

            if (unitCost === 0 && !allowNegative) {
              throw new Error(`Cannot determine COGS for item '${line.itemId}' — no stock or purchase rate available.`);
            }
          } else {
            // PURCHASE_RETURN: cost is return rate (line.ratePaise) or weighted average
            unitCost = line.ratePaise > 0 ? line.ratePaise : (stockSummary.weightedAverageRatePaise || 0);
          }

          const costValue = Math.round(qty * unitCost);
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
        } else if (input.voucherType === 'PURCHASE') {
          const costValue = Math.round(qty * line.ratePaise);
          stockMovements.push({
            itemId: line.itemId,
            godownId: resolvedGodownId,
            movementType: 'IN',
            quantity: qty,
            ratePaise: line.ratePaise,
            valuePaise: costValue
          });
        } else if (input.voucherType === 'SALES_RETURN') {
          // P0-1: Restore returned inventory at COST basis, NOT customer selling price
          let returnUnitCost = 0;

          // 1. Try to find the cost basis from original sales voucher if referenced
          const refVchId = input.billAllocation?.referenceVoucherId || input.referenceNumber;
          if (refVchId) {
            const refStock = db.prepare(`
              SELECT rate_paise FROM stock_entries
              WHERE voucher_id = ? AND item_id = ? AND movement_type = 'OUT'
              LIMIT 1
            `).get(refVchId, line.itemId) as { rate_paise: number } | undefined;
            if (refStock && refStock.rate_paise > 0) {
              returnUnitCost = refStock.rate_paise;
            }
          }

          // 2. Otherwise use the item's current/appropriate WAVG cost basis
          if (returnUnitCost === 0) {
            const stockSummary = InventoryEngine.getItemStockSummary(db, line.itemId, input.voucherDate);
            if (stockSummary.weightedAverageRatePaise > 0) {
              returnUnitCost = stockSummary.weightedAverageRatePaise;
            }
          }

          // 3. Fallback to purchase_rate_paise
          if (returnUnitCost === 0) {
            const item = db.prepare('SELECT purchase_rate_paise FROM stock_items WHERE item_id = ?').get(line.itemId) as { purchase_rate_paise?: number } | undefined;
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
        } else if (input.voucherType === 'STOCK_JOURNAL') {
          // P1-2: Add STOCK_JOURNAL stock movement support
          const movType: 'IN' | 'OUT' = line.movementType === 'OUT' ? 'OUT' : 'IN';

          if (movType === 'OUT') {
            const allowNegative = input.allowNegativeStock === true;
            const availability = InventoryEngine.validateStockAvailability(db, line.itemId, resolvedGodownId, qty, allowNegative);
            if (!availability.isValid) {
              throw new Error(`Insufficient stock for item '${line.itemId}' in godown '${resolvedGodownId}'. Available: ${availability.currentQty}, Requested: ${qty}. Set allowNegativeStock: true to override if business policy permits.`);
            }

            let unitRate = line.ratePaise;
            if (!unitRate || unitRate <= 0) {
              const stockSummary = InventoryEngine.getItemStockSummary(db, line.itemId, input.voucherDate);
              unitRate = stockSummary.weightedAverageRatePaise > 0
                ? stockSummary.weightedAverageRatePaise
                : (db.prepare('SELECT purchase_rate_paise FROM stock_items WHERE item_id = ?').get(line.itemId) as any)?.purchase_rate_paise || 0;
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
          } else {
            // IN movement
            let unitRate = line.ratePaise;
            if (!unitRate || unitRate <= 0) {
              const stockSummary = InventoryEngine.getItemStockSummary(db, line.itemId, input.voucherDate);
              unitRate = stockSummary.weightedAverageRatePaise > 0
                ? stockSummary.weightedAverageRatePaise
                : (db.prepare('SELECT purchase_rate_paise FROM stock_items WHERE item_id = ?').get(line.itemId) as any)?.purchase_rate_paise || 0;
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

    const voucherTotals = GstEngine.calculateVoucherTotals(taxResults);

    let finalVoucherTotal = voucherTotals.totalAmountPaise;
    if (finalVoucherTotal === 0 && input.customLedgerLines && input.customLedgerLines.length > 0) {
      finalVoucherTotal = input.customLedgerLines.reduce((sum, l) => sum + (l.debitPaise || 0), 0);
    }
    if (finalVoucherTotal === 0 && input.voucherType === 'STOCK_JOURNAL') {
      finalVoucherTotal = stockMovements.reduce((sum, sm) => sum + (sm.valuePaise || 0), 0);
    }

    // 3. Assemble Accounting Lines
    let ledgerLines: LedgerPostingLine[] = [];

    // I-1: Fail-fast ledger lookup — never return an unverified candidate ID.
    const findLedgerId = (possibleIds: string[], nameMatch?: string): string => {
      for (const id of possibleIds) {
        const scoped = `${input.companyId}_${id}`;
        if (db.prepare('SELECT 1 FROM ledgers WHERE ledger_id = ? AND company_id = ?').get(scoped, input.companyId)) return scoped;
        if (db.prepare('SELECT 1 FROM ledgers WHERE ledger_id = ? AND (company_id = ? OR company_id IS NULL)').get(id, input.companyId)) return id;
      }
      if (nameMatch) {
        const row = db.prepare('SELECT ledger_id FROM ledgers WHERE company_id = ? AND ledger_name LIKE ? LIMIT 1').get(input.companyId, nameMatch) as any;
        if (row) return row.ledger_id as string;
      }
      // Amendment 7: Throw — never silently post to an unverified ledger ID.
      throw new Error(`Required system ledger not found for company '${input.companyId}'. Tried: [${possibleIds.join(', ')}]${nameMatch ? ` or name matching '${nameMatch}'` : ''}. Please verify the chart of accounts.`);
    };

    const voucherStatus: 'DRAFT' | 'POSTED' = input.status === 'DRAFT' ? 'DRAFT' : 'POSTED';
    const isPosted = voucherStatus === 'POSTED';

    if (isPosted) {
      if (input.customLedgerLines && input.customLedgerLines.length > 0) {
        // SECURITY: Verify all custom ledger IDs belong to this company
        for (const cl of input.customLedgerLines) {
          if (cl.ledgerId) {
            const ledger = db.prepare('SELECT company_id FROM ledgers WHERE ledger_id = ?').get(cl.ledgerId) as any;
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
          } else {
            // DEF-VCH-11: Party is mandatory if transaction affects a party/debtor/creditor ledger
            for (const cl of input.customLedgerLines) {
              if (cl.ledgerId) {
                const ledgerCheck = db.prepare(`
                  SELECT l.is_party, lg.group_name, p.party_id
                  FROM ledgers l
                  JOIN ledger_groups lg ON l.group_id = lg.group_id
                  LEFT JOIN parties p ON l.ledger_id = p.ledger_id
                  WHERE l.ledger_id = ?
                `).get(cl.ledgerId) as { is_party: number; group_name: string; party_id?: string } | undefined;

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
      } else if (input.voucherType === 'SALES') {
        if (!partyLedgerId) throw new Error('Party (Customer) is mandatory for Sales voucher.');
        ledgerLines = DoubleEntryEngine.buildSalesEntries({
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
          inventoryLedgerId: findLedgerId(['led_inventory'], '%Inventory%')
        });
      } else if (input.voucherType === 'PURCHASE') {
        // A-4: Perpetual Inventory Model — Purchase increases Inventory Asset
        if (!partyLedgerId) throw new Error('Party (Supplier) is mandatory for Purchase voucher.');
        ledgerLines = DoubleEntryEngine.buildPurchaseEntries({
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
          roundOffLedgerId: findLedgerId(['led_roundoff', 'led_round_off'], '%Round Off%')
        });
      } else if (input.voucherType === 'SALES_RETURN' || input.voucherType === 'CREDIT_NOTE') {
        // A-1 / A-3 / A-4: SALES_RETURN and CREDIT_NOTE — reverse the sales journal.
        // CREDIT_NOTE is a SALES_RETURN without mandatory stock movement (handled above).
        if (!partyLedgerId) throw new Error('Party (Customer) is mandatory for Sales Return / Credit Note voucher.');
        let returnCogsPaise = 0;
        if (input.voucherType === 'SALES_RETURN') {
          returnCogsPaise = stockMovements.reduce((sum, sm) => sum + (sm.valuePaise || 0), 0);
        }
        ledgerLines = DoubleEntryEngine.buildSalesReturnEntries({
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
      } else if (input.voucherType === 'PURCHASE_RETURN' || input.voucherType === 'DEBIT_NOTE') {
        // A-2 / A-3 / A-4: PURCHASE_RETURN and DEBIT_NOTE — reverse the purchase journal and reduce Inventory Asset.
        if (!partyLedgerId) throw new Error('Party (Supplier) is mandatory for Purchase Return / Debit Note voucher.');
        ledgerLines = DoubleEntryEngine.buildPurchaseReturnEntries({
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
        const balanceCheck = DoubleEntryEngine.validateBalancedEntries(ledgerLines);
        if (!balanceCheck.isValid) {
          throw new Error(balanceCheck.errorMessage);
        }
      }
    }

    // DEF-VCH-08: Validate bill allocation reference if supplied
    if (input.billAllocation?.referenceVoucherId) {
      const refRow = db.prepare('SELECT voucher_id, company_id, status FROM vouchers WHERE voucher_id = ?')
        .get(input.billAllocation.referenceVoucherId) as { voucher_id: string; company_id: string; status: string } | undefined;

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

    // 5. ATOMIC DATABASE TRANSACTION (H-1: Concurrency-safe atomic transaction with retry)
    const fyId = input.fyId || (input as any).financialYearId || 'fy_2026_27';
    const referenceNumber = input.referenceNumber || (input as any).referenceNo || (input as any).supplierInvoiceNo || null;
    const referenceDate = input.referenceDate || (input as any).supplierInvoiceDate || null;
    const paymentMode = input.paymentMode || (input as any).paymentTerms || null;
    const termsConditions = input.termsConditions || (input as any).termsAndConditions || null;

    let postedVoucherNumber = '';
    const introducedSerials: Array<{ itemId: string; serialNumber: string }> = [];

    const executePostingDb = () => {
      // DEF-VCH-10: Draft vouchers use temporary DFT-... number without consuming statutory sequences
      if (voucherStatus === 'DRAFT') {
        if (input.voucherNumber?.trim()) {
          postedVoucherNumber = input.voucherNumber.trim();
        } else {
          postedVoucherNumber = `DFT-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
        }
      } else {
        // DEF-VCH-09: Explicit voucher number collision prevention
        const explicitVNum = input.voucherNumber?.trim();
        if (explicitVNum) {
          const alreadyExists = db.prepare(
            'SELECT 1 FROM vouchers WHERE company_id = ? AND fy_id = ? AND voucher_type = ? AND voucher_number = ?'
          ).get(input.companyId, fyIdToUse, input.voucherType, explicitVNum);
          if (alreadyExists) {
            throw new Error(`Voucher number '${explicitVNum}' already exists for this company, financial year, and voucher type.`);
          }
          postedVoucherNumber = explicitVNum;
        } else {
          postedVoucherNumber = this.getNextVoucherNumber(db, input.companyId, fyIdToUse, input.voucherType);
        }
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
      `).run(
        voucherId, input.companyId, fyId, input.voucherType, postedVoucherNumber,
        input.voucherDate, referenceNumber, referenceDate, paymentMode, termsConditions,
        input.partyId || null, input.narration || null, voucherStatus,
        voucherTotals.taxableAmountPaise, voucherTotals.cgstAmountPaise, voucherTotals.sgstAmountPaise, voucherTotals.igstAmountPaise,
        voucherTotals.roundOffPaise, finalVoucherTotal, input.createdBy || 'system'
      );

      // B. Insert Voucher Lines
      let lineNum = 1;
      for (const pl of processedLines) {
        const lineId = 'ln_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
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
        `).run(
          lineId, voucherId, lineNum++, pl.lineInput.itemId || null, pl.lineInput.ledgerId || null, lineGodownId, pl.lineInput.description || null,
          pl.lineInput.quantity || 0, pl.lineInput.ratePaise, pl.lineInput.discountPercent || 0, pl.taxResult.discountAmountPaise,
          pl.taxResult.taxableAmountPaise, pl.taxResult.cgstRate + pl.taxResult.sgstRate + pl.taxResult.igstRate,
          pl.taxResult.cgstAmountPaise, pl.taxResult.sgstAmountPaise, pl.taxResult.igstAmountPaise, pl.taxResult.totalAmountPaise,
          pl.lineInput.serialNumber || null
        );

        // DEF-VCH-06: Accurate serial lifecycle tracking
        if (isPosted && pl.lineInput.itemId && pl.lineInput.serialNumber) {
          const s = pl.lineInput.serialNumber.trim();
          if (input.voucherType === 'SALES' || input.voucherType === 'PURCHASE_RETURN') {
            db.prepare(`UPDATE stock_item_serials SET status = 'SOLD' WHERE item_id = ? AND serial_number = ?`).run(pl.lineInput.itemId, s);
          } else if (input.voucherType === 'PURCHASE' || input.voucherType === 'SALES_RETURN') {
            const existingSerial = db.prepare('SELECT serial_id FROM stock_item_serials WHERE item_id = ? AND serial_number = ?').get(pl.lineInput.itemId, s);
            if (!existingSerial) {
              db.prepare(`INSERT INTO stock_item_serials (serial_id, item_id, serial_number, status) VALUES (?, ?, ?, 'AVAILABLE')`)
                .run('ser_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16), pl.lineInput.itemId, s);
              introducedSerials.push({ itemId: pl.lineInput.itemId, serialNumber: s });
            } else {
              db.prepare(`UPDATE stock_item_serials SET status = 'AVAILABLE' WHERE item_id = ? AND serial_number = ?`).run(pl.lineInput.itemId, s);
            }
          }
        }
      }

      if (isPosted) {
        // C. Insert Ledger Entries
        for (const le of ledgerLines) {
          const entryId = 'le_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
          db.prepare(`
            INSERT INTO ledger_entries (
              entry_id, voucher_id, ledger_id, entry_date, debit_paise, credit_paise, particulars
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            entryId, voucherId, le.ledgerId, input.voucherDate,
            le.debitPaise, le.creditPaise, le.particulars || null
          );
        }

        // D. Insert Stock Entries
        for (const se of stockMovements) {
          const stockEntryId = 'se_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
          const validGodownId = resolveValidGodownId(se.godownId);
          db.prepare(`
            INSERT INTO stock_entries (
              stock_entry_id, voucher_id, item_id, godown_id, entry_date,
              movement_type, quantity, rate_paise, value_paise
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            stockEntryId, voucherId, se.itemId, validGodownId, input.voucherDate,
            se.movementType, se.quantity, se.ratePaise, se.valuePaise
          );
        }

        // E. Insert Statutory Tax Entries
        const teId = () => 'te_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
        const isReturn = input.voucherType === 'SALES_RETURN' || input.voucherType === 'CREDIT_NOTE' ||
                         input.voucherType === 'PURCHASE_RETURN' || input.voucherType === 'DEBIT_NOTE';
        const isPurchaseType = input.voucherType === 'PURCHASE' || input.voucherType === 'PURCHASE_RETURN' || input.voucherType === 'DEBIT_NOTE';

        if (voucherTotals.cgstAmountPaise > 0) {
          const taxType = isPurchaseType ? 'INPUT_CGST' : 'OUTPUT_CGST';
          const taxAmount = isReturn ? -voucherTotals.cgstAmountPaise : voucherTotals.cgstAmountPaise;
          db.prepare(`
            INSERT INTO tax_entries (tax_entry_id, voucher_id, tax_type, rate, taxable_amount_paise, tax_amount_paise, place_of_supply)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            teId(), voucherId, taxType, 9.00,
            isReturn ? -voucherTotals.taxableAmountPaise : voucherTotals.taxableAmountPaise,
            taxAmount, placeOfSupplyStateCode
          );
        }

        if (voucherTotals.sgstAmountPaise > 0) {
          const taxType = isPurchaseType ? 'INPUT_SGST' : 'OUTPUT_SGST';
          const taxAmount = isReturn ? -voucherTotals.sgstAmountPaise : voucherTotals.sgstAmountPaise;
          db.prepare(`
            INSERT INTO tax_entries (tax_entry_id, voucher_id, tax_type, rate, taxable_amount_paise, tax_amount_paise, place_of_supply)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            teId(), voucherId, taxType, 9.00,
            isReturn ? -voucherTotals.taxableAmountPaise : voucherTotals.taxableAmountPaise,
            taxAmount, placeOfSupplyStateCode
          );
        }

        if (voucherTotals.igstAmountPaise > 0) {
          const taxType = isPurchaseType ? 'INPUT_IGST' : 'OUTPUT_IGST';
          const taxAmount = isReturn ? -voucherTotals.igstAmountPaise : voucherTotals.igstAmountPaise;
          db.prepare(`
            INSERT INTO tax_entries (tax_entry_id, voucher_id, tax_type, rate, taxable_amount_paise, tax_amount_paise, place_of_supply)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            teId(), voucherId, taxType, 18.00,
            isReturn ? -voucherTotals.taxableAmountPaise : voucherTotals.taxableAmountPaise,
            taxAmount, placeOfSupplyStateCode
          );
        }

        if (voucherTotals.cessAmountPaise > 0) {
          const cessTaxAmount = isReturn ? -voucherTotals.cessAmountPaise : voucherTotals.cessAmountPaise;
          db.prepare(`
            INSERT INTO tax_entries (tax_entry_id, voucher_id, tax_type, rate, taxable_amount_paise, tax_amount_paise, place_of_supply)
            VALUES (?, ?, 'CESS', ?, ?, ?, ?)
          `).run(
            teId(), voucherId, 0,
            isReturn ? -voucherTotals.taxableAmountPaise : voucherTotals.taxableAmountPaise,
            cessTaxAmount, placeOfSupplyStateCode
          );
        }

        // F. Bill-Wise Allocations
        if (partyLedgerId && finalVoucherTotal > 0) {
          const allocId = 'ba_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
          const isSettlement = input.voucherType === 'RECEIPT' || input.voucherType === 'PAYMENT' ||
                               input.voucherType === 'CREDIT_NOTE' || input.voucherType === 'DEBIT_NOTE' ||
                               input.voucherType === 'SALES_RETURN' || input.voucherType === 'PURCHASE_RETURN';

          if (input.billAllocation?.referenceVoucherId) {
            const allocType = input.billAllocation.allocationType || 'AGAINST_REF';
            let refVoucher = input.billAllocation.referenceVoucherId;
            db.prepare(`
              INSERT INTO bill_allocations (
                allocation_id, voucher_id, ledger_id, reference_voucher_id,
                allocation_type, amount_paise, due_date
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              allocId, voucherId, partyLedgerId, refVoucher,
              allocType, finalVoucherTotal, input.billAllocation?.dueDate || null
            );
          } else if (isSettlement) {
            const allocType = input.billAllocation?.allocationType === 'ADVANCE' ? 'ADVANCE' : 'ON_ACCOUNT';
            // E-1: Auto ON_ACCOUNT / ADVANCE allocation when billAllocation/referenceVoucherId is omitted for settlement
            db.prepare(`
              INSERT INTO bill_allocations (
                allocation_id, voucher_id, ledger_id, reference_voucher_id,
                allocation_type, amount_paise, due_date
              ) VALUES (?, ?, ?, NULL, ?, ?, NULL)
            `).run(allocId, voucherId, partyLedgerId, allocType, finalVoucherTotal);
          } else {
            // Standard invoice new reference
            db.prepare(`
              INSERT INTO bill_allocations (
                allocation_id, voucher_id, ledger_id, reference_voucher_id,
                allocation_type, amount_paise, due_date
              ) VALUES (?, ?, ?, ?, 'NEW_REF', ?, ?)
            `).run(
              allocId, voucherId, partyLedgerId, voucherId,
              finalVoucherTotal, input.billAllocation?.dueDate || null
            );
          }
        }
      }

      // G. Audit Log Entry
      db.prepare(`
        INSERT INTO audit_logs (log_id, company_id, user_id, action, entity_name, entity_id, details)
        VALUES (?, ?, ?, ?, 'VOUCHER', ?, ?)
      `).run(
        'aud_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16),
        input.companyId,
        input.createdBy || 'system',
        isPosted ? `POST_${input.voucherType}` : `DRAFT_${input.voucherType}`,
        voucherId,
        JSON.stringify({
          voucherNumber: postedVoucherNumber,
          totalAmountPaise: finalVoucherTotal,
          linesCount: input.lines.length,
          status: voucherStatus,
          introducedSerials
        })
      );
    };

    if (options?.skipTransaction) {
      executePostingDb();
    } else {
      const maxRetries = 10;
      let attempt = 0;
      while (attempt < maxRetries) {
        try {
          db.exec('BEGIN IMMEDIATE;');
          executePostingDb();
          db.exec('COMMIT;');
          break;
        } catch (err: any) {
          try { db.exec('ROLLBACK;'); } catch (_) {}
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
      status: voucherStatus
    };
  }

  /**
   * Internal Cancellation Function
   * Executes without its own transaction when called from amendVoucher
   */
  private static _cancelVoucherInternal(
    db: DatabaseSync,
    companyId: string | undefined,
    voucherId: string,
    cancelledBy: string = 'system',
    reason: string = 'Cancelled',
    options?: { allowNegativeStock?: boolean }
  ): void {
    const vch = db.prepare(`
      SELECT v.*, fy.status as fy_status
      FROM vouchers v
      JOIN financial_years fy ON v.fy_id = fy.fy_id
      WHERE v.voucher_id = ?
    `).get(voucherId) as any;

    if (!vch) {
      const vchNoFy = db.prepare('SELECT voucher_id, company_id, status FROM vouchers WHERE voucher_id = ?').get(voucherId) as any;
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

    // DEF-VCH-05: Inward stock cancellation integrity check (PURCHASE, SALES_RETURN, STOCK_JOURNAL with IN)
    const inwardEntries = db.prepare(`
      SELECT item_id, godown_id, quantity
      FROM stock_entries
      WHERE voucher_id = ? AND movement_type = 'IN'
    `).all(voucherId) as Array<{ item_id: string; godown_id: string; quantity: number }>;

    if (inwardEntries.length > 0 && !options?.allowNegativeStock) {
      for (const entry of inwardEntries) {
        const row = db.prepare(`
          SELECT 
            COALESCE(SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN movement_type = 'OUT' THEN quantity ELSE 0 END), 0) AS balance_qty
          FROM stock_entries
          WHERE item_id = ? AND godown_id = ?
        `).get(entry.item_id, entry.godown_id) as { balance_qty: number } | undefined;

        let currentQty = Number(row?.balance_qty || 0);
        if (currentQty < entry.quantity) {
          throw new Error(
            `Cannot cancel inward voucher '${vch.voucher_number}': Cancelling ${entry.quantity} units of item '${entry.item_id}' in godown '${entry.godown_id}' would result in negative stock (${currentQty} available). Dependent outward vouchers have consumed this stock and must be reversed first.`
          );
        }
      }
    }

    // DEF-VCH-06: Serial safety and lifecycle restoration
    if (vch.voucher_type === 'SALES' || vch.voucher_type === 'PURCHASE_RETURN') {
      // Outward voucher cancelled: restore SOLD serials belonging to this voucher to AVAILABLE
      const soldSerials = db.prepare(`
        SELECT item_id, serial_number
        FROM voucher_lines
        WHERE voucher_id = ? AND item_id IS NOT NULL AND serial_number IS NOT NULL
      `).all(voucherId) as Array<{ item_id: string; serial_number: string }>;

      for (const s of soldSerials) {
        db.prepare(`UPDATE stock_item_serials SET status = 'AVAILABLE' WHERE item_id = ? AND serial_number = ? AND status = 'SOLD'`)
          .run(s.item_id, s.serial_number.trim());
      }
    } else if (vch.voucher_type === 'PURCHASE' || vch.voucher_type === 'SALES_RETURN') {
      // Inward voucher cancelled: only remove serial records introduced by this voucher
      let introducedSerials: Array<{ itemId: string; serialNumber: string }> = [];
      const auditRow = db.prepare(`
        SELECT details FROM audit_logs
        WHERE entity_id = ? AND action LIKE 'POST_%'
        ORDER BY created_at DESC LIMIT 1
      `).get(voucherId) as { details?: string } | undefined;

      if (auditRow?.details) {
        try {
          const parsed = JSON.parse(auditRow.details);
          if (Array.isArray(parsed.introducedSerials)) {
            introducedSerials = parsed.introducedSerials;
          }
        } catch (_) {}
      }

      for (const is of introducedSerials) {
        // Verify no other POSTED voucher references this serial
        const otherRef = db.prepare(`
          SELECT 1 FROM voucher_lines vl
          JOIN vouchers v ON vl.voucher_id = v.voucher_id
          WHERE vl.item_id = ? AND vl.serial_number = ? AND v.voucher_id != ? AND v.status = 'POSTED'
          LIMIT 1
        `).get(is.itemId, is.serialNumber);

        if (!otherRef) {
          db.prepare(`DELETE FROM stock_item_serials WHERE item_id = ? AND serial_number = ? AND status = 'AVAILABLE'`)
            .run(is.itemId, is.serialNumber);
        }
      }
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
    `).run(
      'aud_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16),
      vch.company_id,
      cancelledBy,
      voucherId,
      JSON.stringify({ voucherNumber: vch.voucher_number, reason })
    );
  }

  /**
   * 006-B / DEF-VCH-07: Cancel an existing voucher with complete audit trail and tenant enforcement
   * Supports both modern signature: (db, companyId, voucherId, cancelledBy, reason, options)
   * and legacy signature: (db, voucherId, cancelledByOrReason?, reason?)
   */
  public static cancelVoucher(
    db: DatabaseSync,
    companyIdOrVoucherId: string,
    voucherIdOrCancelledBy?: string,
    cancelledByOrReason?: string,
    reasonParam?: string,
    options?: { allowNegativeStock?: boolean }
  ): void {
    let companyId: string | undefined;
    let voucherId: string;
    let cancelledBy = 'system';
    let reason = 'Cancelled';

    if (reasonParam !== undefined) {
      // Unambiguous 5/6-argument modern signature: (db, companyId, voucherId, cancelledBy, reason, options)
      companyId = companyIdOrVoucherId;
      voucherId = voucherIdOrCancelledBy || '';
      cancelledBy = cancelledByOrReason || 'system';
      reason = reasonParam;
    } else {
      const vchDirect = db.prepare('SELECT voucher_id, company_id FROM vouchers WHERE voucher_id = ?').get(companyIdOrVoucherId) as any;
      if (vchDirect && (!voucherIdOrCancelledBy || !db.prepare('SELECT 1 FROM vouchers WHERE voucher_id = ?').get(voucherIdOrCancelledBy))) {
        // Legacy signature: (db, voucherId, cancelledBy?, reason?) or (db, voucherId, reason)
        voucherId = companyIdOrVoucherId;
        companyId = vchDirect.company_id;
        if (voucherIdOrCancelledBy && !cancelledByOrReason) {
          reason = voucherIdOrCancelledBy;
        } else {
          cancelledBy = voucherIdOrCancelledBy || 'system';
          reason = cancelledByOrReason || 'Cancelled';
        }
      } else {
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
    } catch (err: any) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      throw err;
    }
  }

  /**
   * 006-A: Atomic Voucher Amendment
   * Atomically cancels original and posts replacement inside single BEGIN IMMEDIATE transaction
   */
  public static amendVoucher(
    db: DatabaseSync,
    originalVoucherId: string,
    replacementInput: CreateVoucherInput
  ): {
    originalVoucherId: string;
    replacementVoucherId: string;
    replacementVoucherNumber: string;
    totalAmountPaise: number;
    status: 'POSTED';
  } {
    db.exec('BEGIN IMMEDIATE;');
    try {
      // 1. Validate original voucher before mutation
      const original = db.prepare(`
        SELECT v.*, fy.status as fy_status
        FROM vouchers v
        JOIN financial_years fy ON v.fy_id = fy.fy_id
        WHERE v.voucher_id = ?
      `).get(originalVoucherId) as any;

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
        .get(replacementInput.fyId, replacementInput.companyId) as { status: string; start_date: string; end_date: string } | undefined;
      if (!repFy) throw new Error(`Financial Year '${replacementInput.fyId}' not found for replacement voucher.`);
      if (repFy.status !== 'OPEN') throw new Error(`Replacement Financial Year status is ${repFy.status}. Amendment prohibited.`);
      if (replacementInput.voucherDate < repFy.start_date || replacementInput.voucherDate > repFy.end_date) {
        throw new Error(`Replacement voucher date ${replacementInput.voucherDate} is outside the active Financial Year (${repFy.start_date} to ${repFy.end_date}).`);
      }

      // 3. Cancel original internally (within this immediate transaction)
      this._cancelVoucherInternal(
        db,
        replacementInput.companyId,
        originalVoucherId,
        replacementInput.createdBy || 'system',
        'Edited — replaced by amended voucher'
      );

      // 4. Post replacement internally (within this immediate transaction)
      const replacementPayload: CreateVoucherInput = {
        ...replacementInput,
        status: 'POSTED',
        referenceNumber: replacementInput.referenceNumber || `AMEND-${original.voucher_number}`
      };

      const result = this._postVoucherInternal(db, replacementPayload, { skipTransaction: true });

      db.exec('COMMIT;');

      return {
        originalVoucherId,
        replacementVoucherId: result.voucherId,
        replacementVoucherNumber: result.voucherNumber,
        totalAmountPaise: result.totalAmountPaise,
        status: 'POSTED'
      };
    } catch (err: any) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      throw new Error(`Amendment failed and was rolled back: ${err.message}`);
    }
  }

  /**
   * 006-E: Draft Promotion
   * Promotes DRAFT to POSTED, assigns statutory number, and creates accounting rows
   */
  public static postDraftVoucher(
    db: DatabaseSync,
    companyId: string,
    voucherId: string,
    userId: string = 'system'
  ): {
    voucherId: string;
    voucherNumber: string;
    totalAmountPaise: number;
    status: 'POSTED';
  } {
    db.exec('BEGIN IMMEDIATE;');
    try {
      const vch = db.prepare(`
        SELECT v.*, fy.status as fy_status, fy.start_date, fy.end_date
        FROM vouchers v
        JOIN financial_years fy ON v.fy_id = fy.fy_id
        WHERE v.voucher_id = ?
      `).get(voucherId) as any;

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

      // Read lines
      const dbLines = db.prepare(`
        SELECT * FROM voucher_lines WHERE voucher_id = ? ORDER BY line_number ASC
      `).all(voucherId) as any[];

      const lines: CreateVoucherLineInput[] = dbLines.map(l => ({
        itemId: l.item_id || undefined,
        ledgerId: l.ledger_id || undefined,
        godownId: l.godown_id || undefined,
        description: l.description || undefined,
        quantity: l.quantity !== null ? Number(l.quantity) : undefined,
        ratePaise: Number(l.rate_paise || 0),
        discountPercent: Number(l.discount_percent || 0),
        discountAmountPaise: Number(l.discount_amount_paise || 0),
        gstRate: Number(l.gst_rate || 0),
        serialNumber: l.serial_number || undefined
      }));

      // Reconstruct payload
      const payload: CreateVoucherInput = {
        companyId: vch.company_id,
        fyId: vch.fy_id,
        voucherType: vch.voucher_type,
        voucherDate: vch.voucher_date,
        referenceNumber: vch.reference_number || undefined,
        referenceDate: vch.reference_date || undefined,
        paymentMode: vch.payment_mode || undefined,
        termsConditions: vch.terms_conditions || undefined,
        partyId: vch.party_id || undefined,
        narration: vch.narration || undefined,
        lines,
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
        status: 'POSTED' as const
      };
    } catch (err: any) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      throw new Error(`Draft promotion failed and was rolled back: ${err.message}`);
    }
  }

  /**
   * DEF-REP-07: Atomic Opening Stock Recording
   * Creates STOCK_JOURNAL, stock_entries record, updates item opening values,
   * and synchronizes the Inventory Asset ledger opening balance without inventing counterparts.
   */
  public static recordOpeningStock(
    db: DatabaseSync,
    params: {
      companyId: string;
      fyId?: string;
      itemId: string;
      itemName?: string;
      godownId?: string;
      quantity: number;
      ratePaise: number;
      date?: string;
      userId?: string;
    }
  ): { voucherId: string; stockEntryId: string; openingValPaise: number } {
    const qty = Number(params.quantity);
    const rate = Math.round(Number(params.ratePaise));
    if (qty <= 0 || rate <= 0) {
      throw new Error('Opening stock quantity and rate must be greater than zero.');
    }
    const openingVal = Math.round(qty * rate);
    const entryDate = params.date || new Date().toISOString().split('T')[0];

    let fyId: string;
    if (params.fyId) {
      const explicitFy = db.prepare('SELECT status, start_date, end_date FROM financial_years WHERE fy_id = ? AND company_id = ?')
        .get(params.fyId, params.companyId) as any;
      if (!explicitFy) {
        throw new Error(`Cannot record opening stock: Financial Year '${params.fyId}' not found for company '${params.companyId}'.`);
      }
      if (explicitFy.status !== 'OPEN') {
        throw new Error(`Cannot record opening stock: Financial Year '${params.fyId}' is ${explicitFy.status}. Posting prohibited.`);
      }
      fyId = params.fyId;
    } else {
      const dateFy = db.prepare(`
        SELECT fy_id, status FROM financial_years 
        WHERE company_id = ? AND ? BETWEEN start_date AND end_date AND status = 'OPEN' 
        LIMIT 1
      `).get(params.companyId, entryDate) as any;

      if (!dateFy) {
        throw new Error(`Cannot record opening stock: No open financial year found for company '${params.companyId}' covering date '${entryDate}'.`);
      }
      fyId = dateFy.fy_id;
    }

    const voucherId = 'vch_' + crypto.randomUUID().replace(/-/g, '');
    const voucherNumber = PostingEngine.getNextVoucherNumber(db, params.companyId, fyId, 'STOCK_JOURNAL');

    const itemName = params.itemName || (db.prepare('SELECT item_name FROM stock_items WHERE item_id = ?').get(params.itemId) as any)?.item_name || 'Item';

    // 1. Create STOCK_JOURNAL voucher
    db.prepare(`
      INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, narration, status, total_amount_paise, created_by)
      VALUES (?, ?, ?, 'STOCK_JOURNAL', ?, ?, ?, 'POSTED', ?, ?)
    `).run(voucherId, params.companyId, fyId, voucherNumber, entryDate, `Opening Stock for '${itemName}'`, openingVal, params.userId || 'system');

    // 2. Create stock_entries record
    const entryId = 'se_opn_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    const defGodown = db.prepare('SELECT godown_id FROM godowns WHERE company_id = ? LIMIT 1').get(params.companyId) as any;
    const godownId = params.godownId || defGodown?.godown_id || `${params.companyId}_godown_main`;

    db.prepare(`
      INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
      VALUES (?, ?, ?, ?, ?, 'IN', ?, ?, ?)
    `).run(entryId, voucherId, params.itemId, godownId, entryDate, qty, rate, openingVal);

    // 3. Update stock_items opening_qty and opening_rate_paise if not already set
    const itemRow = db.prepare('SELECT opening_qty FROM stock_items WHERE item_id = ?').get(params.itemId) as any;
    if (!itemRow || Number(itemRow.opening_qty) === 0) {
      db.prepare('UPDATE stock_items SET opening_qty = ?, opening_rate_paise = ? WHERE item_id = ?').run(qty, rate, params.itemId);
    }

    // 4. DEF-REP-07: Synchronize Inventory Asset ledger opening balance
    const invLedger = db.prepare(`
      SELECT ledger_id, opening_balance_paise, opening_balance_type FROM ledgers
      WHERE company_id = ? AND (ledger_id = ? OR ledger_name LIKE '%Inventory%')
      LIMIT 1
    `).get(params.companyId, `${params.companyId}_led_inventory`) as any;
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

    return { voucherId, stockEntryId: entryId, openingValPaise: openingVal };
  }
}
