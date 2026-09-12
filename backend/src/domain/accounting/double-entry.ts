export interface LedgerPostingLine {
  ledgerId: string;
  debitPaise: number;
  creditPaise: number;
  particulars?: string;
}

export interface DoubleEntryValidationResult {
  isValid: boolean;
  totalDebitPaise: number;
  totalCreditPaise: number;
  differencePaise: number;
  errorMessage?: string;
}

export class DoubleEntryEngine {
  /**
   * Enforce the fundamental accounting invariant: Total Debit === Total Credit
   */
  public static validateBalancedEntries(lines: LedgerPostingLine[]): DoubleEntryValidationResult {
    if (!lines || lines.length === 0) {
      return {
        isValid: false,
        totalDebitPaise: 0,
        totalCreditPaise: 0,
        differencePaise: 0,
        errorMessage: 'Voucher contains no accounting entries.'
      };
    }

    let totalDebitPaise = 0;
    let totalCreditPaise = 0;

    for (const line of lines) {
      const dr = Math.round(Number(line.debitPaise) || 0);
      const cr = Math.round(Number(line.creditPaise) || 0);

      if (dr < 0 || cr < 0) {
        return {
          isValid: false,
          totalDebitPaise,
          totalCreditPaise,
          differencePaise: Math.abs(totalDebitPaise - totalCreditPaise),
          errorMessage: 'Debit or Credit values cannot be negative.'
        };
      }

      if (dr > 0 && cr > 0) {
        return {
          isValid: false,
          totalDebitPaise,
          totalCreditPaise,
          differencePaise: Math.abs(totalDebitPaise - totalCreditPaise),
          errorMessage: 'A single posting line cannot contain both Debit and Credit amounts.'
        };
      }

      totalDebitPaise += dr;
      totalCreditPaise += cr;
    }

    const differencePaise = Math.abs(totalDebitPaise - totalCreditPaise);

    if (differencePaise !== 0) {
      return {
        isValid: false,
        totalDebitPaise,
        totalCreditPaise,
        differencePaise,
        errorMessage: `Accounting Invariant Violated: Total Debit (₹${(totalDebitPaise / 100).toFixed(2)}) != Total Credit (₹${(totalCreditPaise / 100).toFixed(2)}). Discrepancy: ₹${(differencePaise / 100).toFixed(2)}`
      };
    }

    return {
      isValid: true,
      totalDebitPaise,
      totalCreditPaise,
      differencePaise: 0
    };
  }

  /**
   * Helper to construct balanced lines for a Sales Voucher
   */
  public static buildSalesEntries(params: {
    customerLedgerId: string;
    salesLedgerId: string;
    taxableAmountPaise: number;
    cgstAmountPaise: number;
    sgstAmountPaise: number;
    igstAmountPaise: number;
    roundOffPaise: number;
    totalAmountPaise: number;
    outputCgstLedgerId?: string;
    outputSgstLedgerId?: string;
    outputIgstLedgerId?: string;
    roundOffLedgerId?: string;
    // Optional COGS integration
    cogsAmountPaise?: number;
    cogsLedgerId?: string;
    inventoryLedgerId?: string;
  }): LedgerPostingLine[] {
    const lines: LedgerPostingLine[] = [];

    // 1. Customer DR for Total Invoice Amount
    lines.push({
      ledgerId: params.customerLedgerId,
      debitPaise: params.totalAmountPaise,
      creditPaise: 0,
      particulars: 'To Sales'
    });

    // 2. Sales CR for Taxable Amount
    lines.push({
      ledgerId: params.salesLedgerId,
      debitPaise: 0,
      creditPaise: params.taxableAmountPaise,
      particulars: 'By Customer'
    });

    // 3. GST Outputs CR
    if (params.cgstAmountPaise > 0 && params.outputCgstLedgerId) {
      lines.push({
        ledgerId: params.outputCgstLedgerId,
        debitPaise: 0,
        creditPaise: params.cgstAmountPaise,
        particulars: 'Output CGST'
      });
    }

    if (params.sgstAmountPaise > 0 && params.outputSgstLedgerId) {
      lines.push({
        ledgerId: params.outputSgstLedgerId,
        debitPaise: 0,
        creditPaise: params.sgstAmountPaise,
        particulars: 'Output SGST'
      });
    }

    if (params.igstAmountPaise > 0 && params.outputIgstLedgerId) {
      lines.push({
        ledgerId: params.outputIgstLedgerId,
        debitPaise: 0,
        creditPaise: params.igstAmountPaise,
        particulars: 'Output IGST'
      });
    }

    // 4. Round Off
    if (params.roundOffPaise !== 0 && params.roundOffLedgerId) {
      if (params.roundOffPaise > 0) {
        // Rounded UP: Credit round-off income
        lines.push({
          ledgerId: params.roundOffLedgerId,
          debitPaise: 0,
          creditPaise: params.roundOffPaise,
          particulars: 'Round Off'
        });
      } else {
        // Rounded DOWN: Debit round-off expense
        lines.push({
          ledgerId: params.roundOffLedgerId,
          debitPaise: Math.abs(params.roundOffPaise),
          creditPaise: 0,
          particulars: 'Round Off'
        });
      }
    }

    // 5. Cost of Goods Sold (COGS) entries if inventory valuation provided
    if (params.cogsAmountPaise && params.cogsAmountPaise > 0 && params.cogsLedgerId && params.inventoryLedgerId) {
      lines.push({
        ledgerId: params.cogsLedgerId,
        debitPaise: params.cogsAmountPaise,
        creditPaise: 0,
        particulars: 'Cost of Goods Sold'
      });
      lines.push({
        ledgerId: params.inventoryLedgerId,
        debitPaise: 0,
        creditPaise: params.cogsAmountPaise,
        particulars: 'Inventory Outward at Cost'
      });
    }

    return lines;
  }

  /**
   * Helper to construct balanced lines for a Purchase Voucher
   */
  public static buildPurchaseEntries(params: {
    supplierLedgerId: string;
    purchaseLedgerId: string;
    taxableAmountPaise: number;
    cgstAmountPaise: number;
    sgstAmountPaise: number;
    igstAmountPaise: number;
    roundOffPaise: number;
    totalAmountPaise: number;
    inputCgstLedgerId?: string;
    inputSgstLedgerId?: string;
    inputIgstLedgerId?: string;
    roundOffLedgerId?: string;
  }): LedgerPostingLine[] {
    const lines: LedgerPostingLine[] = [];

    // 1. Purchase A/c DR for Taxable Amount
    lines.push({
      ledgerId: params.purchaseLedgerId,
      debitPaise: params.taxableAmountPaise,
      creditPaise: 0,
      particulars: 'Purchase of Goods'
    });

    // 2. Input GST DR
    if (params.cgstAmountPaise > 0 && params.inputCgstLedgerId) {
      lines.push({
        ledgerId: params.inputCgstLedgerId,
        debitPaise: params.cgstAmountPaise,
        creditPaise: 0,
        particulars: 'Input CGST'
      });
    }

    if (params.sgstAmountPaise > 0 && params.inputSgstLedgerId) {
      lines.push({
        ledgerId: params.inputSgstLedgerId,
        debitPaise: params.sgstAmountPaise,
        creditPaise: 0,
        particulars: 'Input SGST'
      });
    }

    if (params.igstAmountPaise > 0 && params.inputIgstLedgerId) {
      lines.push({
        ledgerId: params.inputIgstLedgerId,
        debitPaise: params.igstAmountPaise,
        creditPaise: 0,
        particulars: 'Input IGST'
      });
    }

    // 3. Round Off
    if (params.roundOffPaise !== 0 && params.roundOffLedgerId) {
      if (params.roundOffPaise > 0) {
        lines.push({
          ledgerId: params.roundOffLedgerId,
          debitPaise: params.roundOffPaise,
          creditPaise: 0,
          particulars: 'Round Off'
        });
      } else {
        lines.push({
          ledgerId: params.roundOffLedgerId,
          debitPaise: 0,
          creditPaise: Math.abs(params.roundOffPaise),
          particulars: 'Round Off'
        });
      }
    }

    // 4. Supplier CR for Total Invoice Amount
    lines.push({
      ledgerId: params.supplierLedgerId,
      debitPaise: 0,
      creditPaise: params.totalAmountPaise,
      particulars: 'To Supplier'
    });

    return lines;
  }
}
