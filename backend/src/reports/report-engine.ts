import { DatabaseSync } from 'node:sqlite';

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
   * Day Book: All transactions within date range
   */
  public static getDayBook(db: DatabaseSync, companyId: string, fromDate: string, toDate: string): DayBookEntry[] {
    const rows = db.prepare(`
      SELECT 
        v.voucher_id, v.voucher_number, v.voucher_date, v.voucher_type,
        v.narration, v.total_amount_paise, v.status,
        p.party_name
      FROM vouchers v
      LEFT JOIN parties p ON v.party_id = p.party_id
      WHERE v.company_id = ? AND v.voucher_date >= ? AND v.voucher_date <= ?
      ORDER BY v.voucher_date ASC, v.created_at ASC
    `).all(companyId, fromDate, toDate) as any[];

    return rows.map(r => ({
      voucherId: r.voucher_id,
      voucherNumber: r.voucher_number,
      voucherDate: r.voucher_date,
      voucherType: r.voucher_type,
      partyName: r.party_name || undefined,
      particulars: r.party_name || r.narration || r.voucher_type,
      totalAmountPaise: Number(r.total_amount_paise),
      status: r.status
    }));
  }

  /**
   * Ledger Statement with Opening Balance, Transaction Stream, and Running Balance
   */
  public static getLedgerStatement(
    db: DatabaseSync,
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
    const ledger = db.prepare('SELECT ledger_name, opening_balance_paise, opening_balance_type FROM ledgers WHERE ledger_id = ?')
      .get(ledgerId) as { ledger_name: string; opening_balance_paise: number; opening_balance_type: 'DR' | 'CR' } | undefined;

    if (!ledger) throw new Error(`Ledger '${ledgerId}' not found.`);

    // 1. Calculate opening balance prior to fromDate
    const priorEntries = db.prepare(`
      SELECT 
        COALESCE(SUM(debit_paise), 0) AS total_dr,
        COALESCE(SUM(credit_paise), 0) AS total_cr
      FROM ledger_entries
      WHERE ledger_id = ? AND entry_date < ?
    `).get(ledgerId, fromDate) as { total_dr: number; total_cr: number };

    let netOpeningDr = (ledger.opening_balance_type === 'DR' ? ledger.opening_balance_paise : -ledger.opening_balance_paise)
      + (Number(priorEntries.total_dr) - Number(priorEntries.total_cr));

    const openingBalancePaise = Math.abs(netOpeningDr);
    const openingBalanceType: 'DR' | 'CR' = netOpeningDr >= 0 ? 'DR' : 'CR';

    // 2. Fetch active entries between fromDate and toDate
    const entries = db.prepare(`
      SELECT 
        le.entry_date, le.debit_paise, le.credit_paise, le.particulars,
        v.voucher_number, v.voucher_type
      FROM ledger_entries le
      JOIN vouchers v ON le.voucher_id = v.voucher_id
      WHERE le.ledger_id = ? AND le.entry_date >= ? AND le.entry_date <= ?
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
    const query = `
      SELECT 
        l.ledger_id, l.ledger_name, l.opening_balance_paise, l.opening_balance_type,
        g.group_name, g.nature,
        COALESCE(SUM(le.debit_paise), 0) AS total_dr,
        COALESCE(SUM(le.credit_paise), 0) AS total_cr
      FROM ledgers l
      JOIN ledger_groups g ON l.group_id = g.group_id
      LEFT JOIN ledger_entries le ON l.ledger_id = le.ledger_id AND le.entry_date <= ?
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
    const entries = db.prepare(`
      SELECT 
        l.ledger_name, g.nature, g.affects_gross_profit,
        COALESCE(SUM(le.debit_paise), 0) AS dr,
        COALESCE(SUM(le.credit_paise), 0) AS cr
      FROM ledgers l
      JOIN ledger_groups g ON l.group_id = g.group_id
      JOIN ledger_entries le ON l.ledger_id = le.ledger_id
      WHERE l.company_id = ? AND le.entry_date >= ? AND le.entry_date <= ?
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
    isBalanced: boolean;
  } {
    const tb = this.getTrialBalance(db, companyId, asOnDate);
    const pnl = this.getProfitAndLoss(db, companyId, '2000-01-01', asOnDate);

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

    // Add Net Profit to Equity
    totalLiabEquityPaise += pnl.netProfitPaise;

    return {
      totalAssetsPaise,
      totalLiabilitiesEquityPaise: totalLiabEquityPaise,
      assets,
      liabilities,
      equity,
      netProfitPaise: pnl.netProfitPaise,
      isBalanced: Math.abs(totalAssetsPaise - totalLiabEquityPaise) === 0
    };
  }

  /**
   * Stock Summary Report
   */
  public static getStockSummary(db: DatabaseSync, companyId: string): Array<{
    itemId: string;
    itemName: string;
    sku: string;
    hsn: string;
    unit: string;
    quantity: number;
    avgRatePaise: number;
    totalValuePaise: number;
  }> {
    const items = db.prepare(`
      SELECT 
        si.item_id, si.item_name, si.sku, si.hsn_sac, u.symbol as unit_symbol,
        COALESCE(SUM(CASE WHEN se.movement_type = 'IN' THEN se.quantity ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN se.movement_type = 'OUT' THEN se.quantity ELSE 0 END), 0) AS current_qty,
        COALESCE(AVG(CASE WHEN se.movement_type = 'IN' THEN se.rate_paise ELSE NULL END), si.purchase_rate_paise) AS avg_rate
      FROM stock_items si
      JOIN units u ON si.unit_id = u.unit_id
      LEFT JOIN stock_entries se ON si.item_id = se.item_id
      WHERE si.company_id = ? AND si.is_active = 1
      GROUP BY si.item_id
      ORDER BY si.item_name
    `).all(companyId) as any[];

    return items.map(i => {
      const qty = Math.max(0, Number(i.current_qty));
      const rate = Math.round(Number(i.avg_rate) || 0);
      return {
        itemId: i.item_id,
        itemName: i.item_name,
        sku: i.sku || '',
        hsn: i.hsn_sac,
        unit: i.unit_symbol,
        quantity: qty,
        avgRatePaise: rate,
        totalValuePaise: Math.round(qty * rate)
      };
    });
  }

  /**
   * Outstanding Receivables and Payables with Ageing (0-30, 31-60, 61-90, 90+)
   */
  public static getOutstandingReport(
    db: DatabaseSync,
    companyId: string,
    type: 'CUSTOMER' | 'SUPPLIER'
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
      SELECT p.party_id, p.party_name, p.phone, p.ledger_id
      FROM parties p
      WHERE p.company_id = ? AND (p.party_type = ? OR p.party_type = 'BOTH')
    `).all(companyId, type) as any[];

    const result = [];
    const today = new Date();

    for (const p of parties) {
      // Find all invoices (vouchers) and receipts/payments
      const bills = db.prepare(`
        SELECT 
          v.voucher_id, v.voucher_date, v.total_amount_paise,
          COALESCE((
            SELECT SUM(ba2.amount_paise)
            FROM bill_allocations ba2
            WHERE ba2.reference_voucher_id = v.voucher_id AND ba2.allocation_type = 'AGAINST_REF'
          ), 0) AS settled_paise
        FROM vouchers v
        WHERE v.company_id = ? AND v.party_id = ? AND v.status = 'POSTED'
          AND v.voucher_type IN ('SALES', 'PURCHASE')
      `).all(companyId, p.party_id) as any[];

      let totalOutstanding = 0;
      let b0_30 = 0;
      let b31_60 = 0;
      let b61_90 = 0;
      let b90_plus = 0;

      for (const b of bills) {
        const invTotal = Number(b.total_amount_paise);
        const settled = Number(b.settled_paise);
        const pending = invTotal - settled;

        if (pending > 0) {
          totalOutstanding += pending;
          const billDate = new Date(b.voucher_date);
          const diffDays = Math.floor((today.getTime() - billDate.getTime()) / (1000 * 3600 * 24));

          if (diffDays <= 30) b0_30 += pending;
          else if (diffDays <= 60) b31_60 += pending;
          else if (diffDays <= 90) b61_90 += pending;
          else b90_plus += pending;
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
   */
  public static getGstSummary(
    db: DatabaseSync,
    companyId: string,
    fromDate: string,
    toDate: string
  ): {
    outwardTaxablePaise: number;
    outputCgstPaise: number;
    outputSgstPaise: number;
    outputIgstPaise: number;
    totalOutputTaxPaise: number;
    inwardTaxablePaise: number;
    inputCgstPaise: number;
    inputSgstPaise: number;
    inputIgstPaise: number;
    totalInputTaxPaise: number;
    netGstPayablePaise: number;
  } {
    const rows = db.prepare(`
      SELECT 
        te.tax_type,
        SUM(te.taxable_amount_paise) as taxable,
        SUM(te.tax_amount_paise) as tax
      FROM tax_entries te
      JOIN vouchers v ON te.voucher_id = v.voucher_id
      WHERE v.company_id = ? AND v.voucher_date >= ? AND v.voucher_date <= ? AND v.status = 'POSTED'
      GROUP BY te.tax_type
    `).all(companyId, fromDate, toDate) as any[];

    let outTaxable = 0;
    let outCgst = 0;
    let outSgst = 0;
    let outIgst = 0;
    let inTaxable = 0;
    let inCgst = 0;
    let inSgst = 0;
    let inIgst = 0;

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
      }
    }

    const totalOutput = outCgst + outSgst + outIgst;
    const totalInput = inCgst + inSgst + inIgst;

    return {
      outwardTaxablePaise: outTaxable,
      outputCgstPaise: outCgst,
      outputSgstPaise: outSgst,
      outputIgstPaise: outIgst,
      totalOutputTaxPaise: totalOutput,
      inwardTaxablePaise: inTaxable,
      inputCgstPaise: inCgst,
      inputSgstPaise: inSgst,
      inputIgstPaise: inIgst,
      totalInputTaxPaise: totalInput,
      netGstPayablePaise: totalOutput - totalInput
    };
  }
}
