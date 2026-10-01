import { DatabaseSync } from 'node:sqlite';
import { InventoryEngine } from '../domain/inventory/valuation.js';

export interface DayBookEntry {
  voucherId: string;
  voucherNumber: string;
  voucherDate: string;
  voucherType: string;
  partyName?: string;
  particulars: string;
  totalAmountPaise: number;
  status: string;
}

export interface LedgerStatementLine {
  date: string;
  voucherNumber: string;
  voucherType: string;
  particulars: string;
  debitPaise: number;
  creditPaise: number;
  runningBalancePaise: number;
  balanceType: 'DR' | 'CR';
}

export interface TrialBalanceItem {
  ledgerId: string;
  ledgerName: string;
  groupName: string;
  nature: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  debitPaise: number;
  creditPaise: number;
}

export class ReportEngine {
  /**
   * Day Book: All transactions within date range (active POSTED vouchers only)
   * DEF-REP-18: Expose primary opposing ledgers for non-party vouchers (JOURNAL, CONTRA, etc.)
   */
  public static getDayBook(db: DatabaseSync, companyId: string, fromDate: string, toDate: string): DayBookEntry[] {
    const rows = db.prepare(`
      SELECT 
        v.voucher_id, v.voucher_number, v.voucher_date, v.voucher_type,
        v.narration, v.total_amount_paise, v.status,
        p.party_name,
        (
          SELECT GROUP_CONCAT(l.ledger_name, ' / ')
          FROM (
            SELECT l.ledger_name
            FROM ledger_entries le
            JOIN ledgers l ON le.ledger_id = l.ledger_id
            WHERE le.voucher_id = v.voucher_id
            ORDER BY le.debit_paise DESC, le.credit_paise DESC
            LIMIT 2
          ) l
        ) AS ledger_particulars
      FROM vouchers v
      LEFT JOIN parties p ON v.party_id = p.party_id
      WHERE v.company_id = ? AND v.voucher_date >= ? AND v.voucher_date <= ? AND v.status = 'POSTED'
      ORDER BY v.voucher_date ASC, v.created_at ASC
    `).all(companyId, fromDate, toDate) as any[];

    return rows.map(r => ({
      voucherId: r.voucher_id,
      voucherNumber: r.voucher_number,
      voucherDate: r.voucher_date,
      voucherType: r.voucher_type,
      partyName: r.party_name || undefined,
      particulars: r.party_name || r.ledger_particulars || r.narration || r.voucher_type,
      totalAmountPaise: Number(r.total_amount_paise),
      status: r.status
    }));
  }

  /**
   * Ledger Statement with Opening Balance, Transaction Stream, and Running Balance
   * DEF-REP-16: Tenant Hardening — Validate ledgerId belongs to companyId
   */
  public static getLedgerStatement(
    db: DatabaseSync,
    companyId: string,
    ledgerId: string,
    fromDate: string,
    toDate: string
  ): {
    ledgerName: string;
    openingBalancePaise: number;
    openingBalanceType: 'DR' | 'CR';
    closingBalancePaise: number;
    closingBalanceType: 'DR' | 'CR';
    lines: LedgerStatementLine[];
  } {
    const ledger = db.prepare('SELECT ledger_name, opening_balance_paise, opening_balance_type FROM ledgers WHERE ledger_id = ? AND company_id = ?')
      .get(ledgerId, companyId) as { ledger_name: string; opening_balance_paise: number; opening_balance_type: 'DR' | 'CR' } | undefined;

    if (!ledger) throw new Error(`Ledger '${ledgerId}' not found for company '${companyId}'.`);

    // 1. Calculate opening balance prior to fromDate (DEF-REP-12: POSTED vouchers only)
    const priorEntries = db.prepare(`
      SELECT 
        COALESCE(SUM(le.debit_paise), 0) AS total_dr,
        COALESCE(SUM(le.credit_paise), 0) AS total_cr
      FROM ledger_entries le
      JOIN vouchers v ON le.voucher_id = v.voucher_id
      WHERE le.ledger_id = ? AND le.entry_date < ? AND v.status = 'POSTED'
    `).get(ledgerId, fromDate) as { total_dr: number; total_cr: number };

    let netOpeningDr = (ledger.opening_balance_type === 'DR' ? ledger.opening_balance_paise : -ledger.opening_balance_paise)
      + (Number(priorEntries.total_dr) - Number(priorEntries.total_cr));

    const openingBalancePaise = Math.abs(netOpeningDr);
    const openingBalanceType: 'DR' | 'CR' = netOpeningDr >= 0 ? 'DR' : 'CR';

    // 2. Fetch active entries between fromDate and toDate (DEF-REP-12: POSTED vouchers only)
    const entries = db.prepare(`
      SELECT 
        le.entry_date, le.debit_paise, le.credit_paise, le.particulars,
        v.voucher_number, v.voucher_type
      FROM ledger_entries le
      JOIN vouchers v ON le.voucher_id = v.voucher_id
      WHERE le.ledger_id = ? AND le.entry_date >= ? AND le.entry_date <= ? AND v.status = 'POSTED'
      ORDER BY le.entry_date ASC, le.created_at ASC
    `).all(ledgerId, fromDate, toDate) as any[];

    let currentBalanceDr = netOpeningDr;
    const lines: LedgerStatementLine[] = [];

    for (const e of entries) {
      const dr = Number(e.debit_paise);
      const cr = Number(e.credit_paise);
      currentBalanceDr += (dr - cr);

      lines.push({
        date: e.entry_date,
        voucherNumber: e.voucher_number,
        voucherType: e.voucher_type,
        particulars: e.particulars || e.voucher_type,
        debitPaise: dr,
        creditPaise: cr,
        runningBalancePaise: Math.abs(currentBalanceDr),
        balanceType: currentBalanceDr >= 0 ? 'DR' : 'CR'
      });
    }

    return {
      ledgerName: ledger.ledger_name,
      openingBalancePaise,
      openingBalanceType,
      closingBalancePaise: Math.abs(currentBalanceDr),
      closingBalanceType: currentBalanceDr >= 0 ? 'DR' : 'CR',
      lines
    };
  }

  /**
   * Trial Balance: Must strictly evaluate sum(DR) === sum(CR)
   */
  public static getTrialBalance(
    db: DatabaseSync,
    companyId: string,
    asOnDate: string
  ): {
    rows: TrialBalanceItem[];
    totalDebitPaise: number;
    totalCreditPaise: number;
    differencePaise: number;
    isBalanced: boolean;
  } {
    // DEF-REP-12: Defensive POSTED voucher filtering
    const query = `
      SELECT 
        l.ledger_id, l.ledger_name, l.opening_balance_paise, l.opening_balance_type,
        g.group_name, g.nature,
        COALESCE(SUM(le.debit_paise), 0) AS total_dr,
        COALESCE(SUM(le.credit_paise), 0) AS total_cr
      FROM ledgers l
      JOIN ledger_groups g ON l.group_id = g.group_id
      LEFT JOIN (
        SELECT le.ledger_id, le.debit_paise, le.credit_paise
        FROM ledger_entries le
        JOIN vouchers v ON le.voucher_id = v.voucher_id
        WHERE v.status = 'POSTED' AND le.entry_date <= ?
      ) le ON l.ledger_id = le.ledger_id
      WHERE l.company_id = ?
      GROUP BY l.ledger_id
      ORDER BY g.nature, g.group_name, l.ledger_name
    `;

    const rawLedgers = db.prepare(query).all(asOnDate, companyId) as any[];

    let totalDebitPaise = 0;
    let totalCreditPaise = 0;
    const rows: TrialBalanceItem[] = [];

    for (const l of rawLedgers) {
      const openingDr = l.opening_balance_type === 'DR' ? Number(l.opening_balance_paise) : -Number(l.opening_balance_paise);
      const netBalance = openingDr + (Number(l.total_dr) - Number(l.total_cr));

      let debitPaise = 0;
      let creditPaise = 0;

      if (netBalance > 0) {
        debitPaise = netBalance;
        totalDebitPaise += debitPaise;
      } else if (netBalance < 0) {
        creditPaise = Math.abs(netBalance);
        totalCreditPaise += creditPaise;
      }

      if (debitPaise > 0 || creditPaise > 0) {
        rows.push({
          ledgerId: l.ledger_id,
          ledgerName: l.ledger_name,
          groupName: l.group_name,
          nature: l.nature,
          debitPaise,
          creditPaise
        });
      }
    }

    const differencePaise = Math.abs(totalDebitPaise - totalCreditPaise);

    return {
      rows,
      totalDebitPaise,
      totalCreditPaise,
      differencePaise,
      isBalanced: differencePaise === 0
    };
  }

  /**
   * Profit & Loss Statement
   */
  public static getProfitAndLoss(
    db: DatabaseSync,
    companyId: string,
    fromDate: string,
    toDate: string
  ): {
    tradingIncomePaise: number;
    tradingExpensePaise: number;
    grossProfitPaise: number;
    indirectIncomePaise: number;
    indirectExpensePaise: number;
    netProfitPaise: number;
    incomeLedgers: Array<{ ledgerName: string; amountPaise: number }>;
    expenseLedgers: Array<{ ledgerName: string; amountPaise: number }>;
  } {
    // DEF-REP-12: Defensive POSTED voucher filtering
    const entries = db.prepare(`
      SELECT 
        l.ledger_name, g.nature, g.affects_gross_profit,
        COALESCE(SUM(le.debit_paise), 0) AS dr,
        COALESCE(SUM(le.credit_paise), 0) AS cr
      FROM ledgers l
      JOIN ledger_groups g ON l.group_id = g.group_id
      JOIN ledger_entries le ON l.ledger_id = le.ledger_id
      JOIN vouchers v ON le.voucher_id = v.voucher_id
      WHERE l.company_id = ? AND le.entry_date >= ? AND le.entry_date <= ?
        AND v.status = 'POSTED'
        AND g.nature IN ('INCOME', 'EXPENSE')
      GROUP BY l.ledger_id
    `).all(companyId, fromDate, toDate) as any[];

    let tradingIncomePaise = 0;
    let tradingExpensePaise = 0;
    let indirectIncomePaise = 0;
    let indirectExpensePaise = 0;

    const incomeLedgers: Array<{ ledgerName: string; amountPaise: number }> = [];
    const expenseLedgers: Array<{ ledgerName: string; amountPaise: number }> = [];

    for (const e of entries) {
      const dr = Number(e.dr);
      const cr = Number(e.cr);

      if (e.nature === 'INCOME') {
        const netIncome = cr - dr;
        if (e.affects_gross_profit === 1) {
          tradingIncomePaise += netIncome;
        } else {
          indirectIncomePaise += netIncome;
        }
        incomeLedgers.push({ ledgerName: e.ledger_name, amountPaise: netIncome });
      } else if (e.nature === 'EXPENSE') {
        const netExpense = dr - cr;
        if (e.affects_gross_profit === 1) {
          tradingExpensePaise += netExpense;
        } else {
          indirectExpensePaise += netExpense;
        }
        expenseLedgers.push({ ledgerName: e.ledger_name, amountPaise: netExpense });
      }
    }

    const grossProfitPaise = tradingIncomePaise - tradingExpensePaise;
    const netProfitPaise = grossProfitPaise + indirectIncomePaise - indirectExpensePaise;

    return {
      tradingIncomePaise,
      tradingExpensePaise,
      grossProfitPaise,
      indirectIncomePaise,
      indirectExpensePaise,
      netProfitPaise,
      incomeLedgers,
      expenseLedgers
    };
  }

  /**
   * Balance Sheet
   */
  public static getBalanceSheet(
    db: DatabaseSync,
    companyId: string,
    asOnDate: string
  ): {
    totalAssetsPaise: number;
    totalLiabilitiesEquityPaise: number;
    assets: Array<{ ledgerName: string; amountPaise: number }>;
    liabilities: Array<{ ledgerName: string; amountPaise: number }>;
    equity: Array<{ ledgerName: string; amountPaise: number }>;
    netProfitPaise: number;
    retainedEarningsPaise?: number;
    isBalanced: boolean;
  } {
    const tb = this.getTrialBalance(db, companyId, asOnDate);
    // DEF-REP-01 / F-1: Scope Net Profit to active Financial Year, and dynamically compute prior periods' Retained Earnings
    const activeFy = db.prepare(`
      SELECT start_date FROM financial_years 
      WHERE company_id = ? AND start_date <= ? AND end_date >= ?
      ORDER BY start_date DESC LIMIT 1
    `).get(companyId, asOnDate, asOnDate) as { start_date: string } | undefined;
    const fyStartDate = activeFy?.start_date || '2000-01-01';
    const pnl = this.getProfitAndLoss(db, companyId, fyStartDate, asOnDate);

    let retainedEarningsPaise = 0;
    if (activeFy && fyStartDate > '2000-01-01') {
      const prevDate = new Date(fyStartDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const priorEndDate = prevDate.toISOString().split('T')[0];
      const priorPnl = this.getProfitAndLoss(db, companyId, '2000-01-01', priorEndDate);
      retainedEarningsPaise = priorPnl.netProfitPaise;
    }

    const assets: Array<{ ledgerName: string; amountPaise: number }> = [];
    const liabilities: Array<{ ledgerName: string; amountPaise: number }> = [];
    const equity: Array<{ ledgerName: string; amountPaise: number }> = [];

    let totalAssetsPaise = 0;
    let totalLiabEquityPaise = 0;

    for (const row of tb.rows) {
      if (row.nature === 'ASSET') {
        const amt = row.debitPaise - row.creditPaise;
        assets.push({ ledgerName: row.ledgerName, amountPaise: amt });
        totalAssetsPaise += amt;
      } else if (row.nature === 'LIABILITY') {
        const amt = row.creditPaise - row.debitPaise;
        liabilities.push({ ledgerName: row.ledgerName, amountPaise: amt });
        totalLiabEquityPaise += amt;
      } else if (row.nature === 'EQUITY') {
        const amt = row.creditPaise - row.debitPaise;
        equity.push({ ledgerName: row.ledgerName, amountPaise: amt });
        totalLiabEquityPaise += amt;
      }
    }

    // Add Prior Periods' Retained Earnings to Equity
    if (retainedEarningsPaise !== 0) {
      equity.push({ ledgerName: 'Retained Earnings (Prior Years)', amountPaise: retainedEarningsPaise });
      totalLiabEquityPaise += retainedEarningsPaise;
    }

    // Add Current Year Net Profit to Equity
    totalLiabEquityPaise += pnl.netProfitPaise;

    return {
      totalAssetsPaise,
      totalLiabilitiesEquityPaise: totalLiabEquityPaise,
      assets,
      liabilities,
      equity,
      netProfitPaise: pnl.netProfitPaise,
      retainedEarningsPaise,
      isBalanced: Math.abs(totalAssetsPaise - totalLiabEquityPaise) === 0
    };
  }

  /**
   * Stock Summary Report — C-1: Evaluated at true Weighted Average Rate
   * DEF-REP-15: Support optional asOfDate for historical stock valuation
   * DEF-REP-09: Expose reorderLevel for dashboard alerts
   */
  public static getStockSummary(
    db: DatabaseSync,
    companyId: string,
    asOfDate?: string
  ): Array<{
    itemId: string;
    item_id: string;
    itemName: string;
    item_name: string;
    sku: string;
    hsn: string;
    hsn_sac: string;
    unit: string;
    unit_symbol: string;
    quantity: number;
    closing_qty: number;
    currentStock: number;
    reorderLevel: number;
    reorder_level: number;
    avgRatePaise: number;
    avg_rate_paise: number;
    totalValuePaise: number;
    total_value_paise: number;
  }> {
    const items = db.prepare(`
      SELECT 
        si.item_id, si.item_name, si.sku, si.hsn_sac, si.reorder_level, COALESCE(u.symbol, 'Nos') as unit_symbol, si.purchase_rate_paise
      FROM stock_items si
      LEFT JOIN units u ON si.unit_id = u.unit_id
      WHERE si.company_id = ? AND si.is_active = 1
      ORDER BY si.item_name ASC
    `).all(companyId) as any[];

    return items.map(i => {
      const summary = InventoryEngine.getItemStockSummary(db, i.item_id, asOfDate);
      const qty = summary.totalQuantity;
      const rate = summary.weightedAverageRatePaise > 0
        ? summary.weightedAverageRatePaise
        : Math.round(Number(i.purchase_rate_paise) || 0);
      const totalVal = summary.totalValuePaise > 0
        ? summary.totalValuePaise
        : Math.round(qty * rate);

      const reorderLvl = Number(i.reorder_level) || 0;

      return {
        itemId: i.item_id,
        item_id: i.item_id,
        itemName: i.item_name,
        item_name: i.item_name,
        sku: i.sku || '',
        hsn: i.hsn_sac || '',
        hsn_sac: i.hsn_sac || '',
        unit: i.unit_symbol || 'Nos',
        unit_symbol: i.unit_symbol || 'Nos',
        quantity: qty,
        closing_qty: qty,
        currentStock: qty,
        reorderLevel: reorderLvl,
        reorder_level: reorderLvl,
        avgRatePaise: rate,
        avg_rate_paise: rate,
        totalValuePaise: totalVal,
        total_value_paise: totalVal
      };
    });
  }

  /**
   * Outstanding Receivables and Payables with Ageing (0-30, 31-60, 61-90, 90+)
   * Outstanding Receivables / Payables Report with Aging Analysis
   * DEF-REP-02: Party opening balances in oldest bucket
   * DEF-REP-03: ON_ACCOUNT / ADVANCE settlement via LedgerFlow FIFO policy
   * DEF-REP-04: Strict CUSTOMER vs SUPPLIER separation (party_type = BOTH isolation)
   * DEF-REP-05: Returns (SALES_RETURN, PURCHASE_RETURN) and Notes (CREDIT_NOTE, DEBIT_NOTE) integration
   * DEF-REP-14: Historical asOnDate filtering and point-in-time aging
   */
  public static getOutstandingReport(
    db: DatabaseSync,
    companyId: string,
    type: 'CUSTOMER' | 'SUPPLIER',
    asOnDate?: string
  ): Array<{
    partyId: string;
    partyName: string;
    phone?: string;
    totalOutstandingPaise: number;
    bucket0to30Paise: number;
    bucket31to60Paise: number;
    bucket61to90Paise: number;
    bucket90PlusPaise: number;
  }> {
    const parties = db.prepare(`
      SELECT p.party_id, p.party_name, p.phone, p.ledger_id,
             COALESCE(l.opening_balance_paise, 0) AS opening_balance_paise,
             COALESCE(l.opening_balance_type, 'DR') AS opening_balance_type
      FROM parties p
      JOIN ledgers l ON p.ledger_id = l.ledger_id
      WHERE p.company_id = ? AND (p.party_type = ? OR p.party_type = 'BOTH')
    `).all(companyId, type) as any[];

    const result = [];
    const referenceDate = asOnDate ? new Date(asOnDate) : new Date();

    const invoiceVoucherType = type === 'CUSTOMER' ? 'SALES' : 'PURCHASE';
    const settlementVoucherTypes = type === 'CUSTOMER'
      ? ['RECEIPT', 'SALES_RETURN', 'CREDIT_NOTE']
      : ['PAYMENT', 'PURCHASE_RETURN', 'DEBIT_NOTE'];

    for (const p of parties) {
      const openingPaise = Number(p.opening_balance_paise || 0);
      const openingType = p.opening_balance_type || 'DR';

      let openingInvoicePaise = 0;
      let unallocatedPool = 0;

      // DEF-REP-02: For CUSTOMER: DR is receivable (invoice), CR is unallocated advance
      // For SUPPLIER: CR is payable (invoice), DR is unallocated advance
      if (type === 'CUSTOMER') {
        if (openingType === 'DR') {
          openingInvoicePaise = openingPaise;
        } else {
          unallocatedPool += openingPaise;
        }
      } else {
        if (openingType === 'CR') {
          openingInvoicePaise = openingPaise;
        } else {
          unallocatedPool += openingPaise;
        }
      }

      // 1. Fetch posted invoices up to asOnDate (chronological order)
      let invoiceQuery = `
        SELECT v.voucher_id, v.voucher_date, v.total_amount_paise
        FROM vouchers v
        WHERE v.company_id = ? AND v.party_id = ? AND v.status = 'POSTED'
          AND v.voucher_type = ?
      `;
      const invoiceParams: any[] = [companyId, p.party_id, invoiceVoucherType];
      if (asOnDate) {
        invoiceQuery += ` AND v.voucher_date <= ?`;
        invoiceParams.push(asOnDate);
      }
      invoiceQuery += ` ORDER BY v.voucher_date ASC, v.created_at ASC`;
      const rawInvoices = db.prepare(invoiceQuery).all(...invoiceParams) as any[];

      interface BillItem {
        id: string;
        date: string;
        isOpening: boolean;
        totalPaise: number;
        settledPaise: number;
      }

      const bills: BillItem[] = [];
      if (openingInvoicePaise > 0) {
        bills.push({
          id: 'OPENING_BAL',
          date: '1970-01-01',
          isOpening: true,
          totalPaise: openingInvoicePaise,
          settledPaise: 0
        });
      }

      for (const inv of rawInvoices) {
        bills.push({
          id: inv.voucher_id,
          date: inv.voucher_date,
          isOpening: false,
          totalPaise: Number(inv.total_amount_paise),
          settledPaise: 0
        });
      }

      // 2. Fetch explicit AGAINST_REF allocations
      let allocQuery = `
        SELECT ba.reference_voucher_id, SUM(ba.amount_paise) AS total_settled
        FROM bill_allocations ba
        JOIN vouchers v ON ba.voucher_id = v.voucher_id
        WHERE v.company_id = ? AND ba.ledger_id = ? AND ba.allocation_type = 'AGAINST_REF'
          AND v.status = 'POSTED'
      `;
      const allocParams: any[] = [companyId, p.ledger_id];
      if (asOnDate) {
        allocQuery += ` AND v.voucher_date <= ?`;
        allocParams.push(asOnDate);
      }
      allocQuery += ` GROUP BY ba.reference_voucher_id`;
      const explicitAllocs = db.prepare(allocQuery).all(...allocParams) as any[];

      const allocMap = new Map<string, number>();
      for (const a of explicitAllocs) {
        if (a.reference_voucher_id) {
          allocMap.set(a.reference_voucher_id, Number(a.total_settled));
        }
      }

      for (const b of bills) {
        if (!b.isOpening && allocMap.has(b.id)) {
          const againstRefAmount = allocMap.get(b.id)!;
          b.settledPaise += Math.min(againstRefAmount, b.totalPaise);
        }
      }

      // 3. Fetch settlement vouchers and compute unallocated pool
      const placeholders = settlementVoucherTypes.map(() => '?').join(',');
      let stlQuery = `
        SELECT v.voucher_id, v.total_amount_paise,
               COALESCE((
                 SELECT SUM(ba.amount_paise)
                 FROM bill_allocations ba
                 JOIN vouchers rv ON ba.reference_voucher_id = rv.voucher_id
                 WHERE ba.voucher_id = v.voucher_id AND ba.allocation_type = 'AGAINST_REF'
                   AND rv.status = 'POSTED'
               ), 0) AS against_ref_paise
        FROM vouchers v
        WHERE v.company_id = ? AND v.party_id = ? AND v.status = 'POSTED'
          AND v.voucher_type IN (${placeholders})
      `;
      const stlParams: any[] = [companyId, p.party_id, ...settlementVoucherTypes];
      if (asOnDate) {
        stlQuery += ` AND v.voucher_date <= ?`;
        stlParams.push(asOnDate);
      }
      stlQuery += ` ORDER BY v.voucher_date ASC, v.created_at ASC`;
      const settlementVouchers = db.prepare(stlQuery).all(...stlParams) as any[];

      for (const sv of settlementVouchers) {
        const totalVch = Number(sv.total_amount_paise);
        const allocatedAgainstRef = Number(sv.against_ref_paise);
        const unallocatedFromVch = Math.max(0, totalVch - allocatedAgainstRef);
        unallocatedPool += unallocatedFromVch;
      }

      // 4. Apply unallocated pool via FIFO to oldest bills first
      if (unallocatedPool > 0) {
        for (const b of bills) {
          const remainingUnpaid = b.totalPaise - b.settledPaise;
          if (remainingUnpaid > 0) {
            const deduct = Math.min(remainingUnpaid, unallocatedPool);
            b.settledPaise += deduct;
            unallocatedPool -= deduct;
            if (unallocatedPool <= 0) break;
          }
        }
      }

      // 5. Calculate aging buckets
      let totalOutstanding = 0;
      let b0_30 = 0;
      let b31_60 = 0;
      let b61_90 = 0;
      let b90_plus = 0;

      for (const b of bills) {
        const pending = b.totalPaise - b.settledPaise;
        if (pending > 0) {
          totalOutstanding += pending;
          if (b.isOpening) {
            b90_plus += pending;
          } else {
            const billDate = new Date(b.date);
            const diffDays = Math.floor((referenceDate.getTime() - billDate.getTime()) / (1000 * 3600 * 24));
            if (diffDays <= 30) b0_30 += pending;
            else if (diffDays <= 60) b31_60 += pending;
            else if (diffDays <= 90) b61_90 += pending;
            else b90_plus += pending;
          }
        }
      }

      if (totalOutstanding > 0) {
        result.push({
          partyId: p.party_id,
          partyName: p.party_name,
          phone: p.phone || undefined,
          totalOutstandingPaise: totalOutstanding,
          bucket0to30Paise: b0_30,
          bucket31to60Paise: b31_60,
          bucket61to90Paise: b61_90,
          bucket90PlusPaise: b90_plus
        });
      }
    }

    return result;
  }

  /**
   * GST Tax Registers (GSTR-1 Outward & GSTR-2 Inward Summary)
   * DEF-REP-06: Include and separate CESS tax entries (output, input, net)
   * DEF-REP-08: Safe default date fallbacks
   * DEF-REP-13: Reconcile zero-tax / 0% turnover
   */
  public static getGstSummary(
    db: DatabaseSync,
    companyId: string,
    fromDate?: string,
    toDate?: string
  ): {
    outwardTaxablePaise: number;
    outputCgstPaise: number;
    outputSgstPaise: number;
    outputIgstPaise: number;
    outputCessPaise: number;
    totalOutputTaxPaise: number;
    outwardZeroTaxTurnoverPaise: number;
    totalOutwardTurnoverPaise: number;
    inwardTaxablePaise: number;
    inputCgstPaise: number;
    inputSgstPaise: number;
    inputIgstPaise: number;
    inputCessPaise: number;
    totalInputTaxPaise: number;
    inwardZeroTaxTurnoverPaise: number;
    totalInwardTurnoverPaise: number;
    netGstPayablePaise: number;
    netCessPayablePaise: number;
  } {
    const effectiveFromDate = fromDate || '2000-01-01';
    const effectiveToDate = toDate || new Date().toISOString().split('T')[0];

    const rows = db.prepare(`
      SELECT 
        te.tax_type,
        v.voucher_type,
        SUM(te.taxable_amount_paise) as taxable,
        SUM(te.tax_amount_paise) as tax
      FROM tax_entries te
      JOIN vouchers v ON te.voucher_id = v.voucher_id
      WHERE v.company_id = ? AND v.voucher_date >= ? AND v.voucher_date <= ? AND v.status = 'POSTED'
      GROUP BY te.tax_type, v.voucher_type
    `).all(companyId, effectiveFromDate, effectiveToDate) as any[];

    let outTaxable = 0;
    let outCgst = 0;
    let outSgst = 0;
    let outIgst = 0;
    let outCess = 0;
    let inTaxable = 0;
    let inCgst = 0;
    let inSgst = 0;
    let inIgst = 0;
    let inCess = 0;

    for (const r of rows) {
      const taxable = Number(r.taxable || 0);
      const tax = Number(r.tax || 0);

      switch (r.tax_type) {
        case 'OUTPUT_CGST':
          outTaxable += taxable;
          outCgst += tax;
          break;
        case 'OUTPUT_SGST':
          outSgst += tax;
          break;
        case 'OUTPUT_IGST':
          outTaxable += taxable;
          outIgst += tax;
          break;
        case 'INPUT_CGST':
          inTaxable += taxable;
          inCgst += tax;
          break;
        case 'INPUT_SGST':
          inSgst += tax;
          break;
        case 'INPUT_IGST':
          inTaxable += taxable;
          inIgst += tax;
          break;
        case 'CESS':
          if (['SALES', 'SALES_RETURN', 'CREDIT_NOTE'].includes(r.voucher_type)) {
            outCess += tax;
          } else if (['PURCHASE', 'PURCHASE_RETURN', 'DEBIT_NOTE'].includes(r.voucher_type)) {
            inCess += tax;
          }
          break;
      }
    }

    // DEF-REP-13: Reconcile zero-tax / 0% turnover from voucher_lines
    const zeroTaxRows = db.prepare(`
      SELECT 
        v.voucher_type,
        SUM(vl.taxable_amount_paise) as zero_taxable
      FROM voucher_lines vl
      JOIN vouchers v ON vl.voucher_id = v.voucher_id
      WHERE v.company_id = ? AND v.voucher_date >= ? AND v.voucher_date <= ? AND v.status = 'POSTED'
        AND vl.gst_rate = 0
      GROUP BY v.voucher_type
    `).all(companyId, effectiveFromDate, effectiveToDate) as any[];

    let outZeroTax = 0;
    let inZeroTax = 0;

    for (const z of zeroTaxRows) {
      const amt = Number(z.zero_taxable || 0);
      if (z.voucher_type === 'SALES') {
        outZeroTax += amt;
      } else if (z.voucher_type === 'SALES_RETURN' || z.voucher_type === 'CREDIT_NOTE') {
        outZeroTax -= amt;
      } else if (z.voucher_type === 'PURCHASE') {
        inZeroTax += amt;
      } else if (z.voucher_type === 'PURCHASE_RETURN' || z.voucher_type === 'DEBIT_NOTE') {
        inZeroTax -= amt;
      }
    }

    const totalOutput = outCgst + outSgst + outIgst + outCess;
    const totalInput = inCgst + inSgst + inIgst + inCess;

    return {
      outwardTaxablePaise: outTaxable,
      outputCgstPaise: outCgst,
      outputSgstPaise: outSgst,
      outputIgstPaise: outIgst,
      outputCessPaise: outCess,
      totalOutputTaxPaise: totalOutput,
      outwardZeroTaxTurnoverPaise: outZeroTax,
      totalOutwardTurnoverPaise: outTaxable + outZeroTax,
      inwardTaxablePaise: inTaxable,
      inputCgstPaise: inCgst,
      inputSgstPaise: inSgst,
      inputIgstPaise: inIgst,
      inputCessPaise: inCess,
      totalInputTaxPaise: totalInput,
      inwardZeroTaxTurnoverPaise: inZeroTax,
      totalInwardTurnoverPaise: inTaxable + inZeroTax,
      netGstPayablePaise: totalOutput - totalInput,
      netCessPayablePaise: outCess - inCess
    };
  }
}
