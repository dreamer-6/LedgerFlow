export interface LineTaxCalculationInput {
  quantity: number;
  ratePaise: number; // e.g. ₹1,000.00 = 100000 paise
  discountPercent?: number; // e.g. 10 for 10%
  discountAmountPaise?: number; // fixed discount in paise
  isTaxInclusive?: boolean;
  gstRate: number; // e.g. 18 for 18%
  cessRate?: number; // e.g. 0
  sellerStateCode: string; // e.g. "33" (Tamil Nadu)
  placeOfSupplyStateCode: string; // e.g. "33" or "29"
}

export interface LineTaxCalculationResult {
  grossAmountPaise: number;
  discountAmountPaise: number;
  taxableAmountPaise: number;
  isInterState: boolean;
  cgstRate: number;
  cgstAmountPaise: number;
  sgstRate: number;
  sgstAmountPaise: number;
  igstRate: number;
  igstAmountPaise: number;
  cessRate: number;
  cessAmountPaise: number;
  totalTaxPaise: number;
  totalAmountPaise: number;
}

export interface VoucherTotalsResult {
  taxableAmountPaise: number;
  cgstAmountPaise: number;
  sgstAmountPaise: number;
  igstAmountPaise: number;
  cessAmountPaise: number;
  subTotalPaise: number; // Taxable + Tax
  roundOffPaise: number; // +/- difference to round to nearest rupee
  totalAmountPaise: number; // Exact integer rupee amount
}

export class GstEngine {
  /**
   * Validate Indian GSTIN format
   */
  public static isValidGstin(gstin: string): boolean {
    if (!gstin) return false;
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin.trim());
  }

  /**
   * Extract state code from GSTIN
   */
  public static getStateCodeFromGstin(gstin: string): string | null {
    if (!this.isValidGstin(gstin)) return null;
    return gstin.trim().substring(0, 2);
  }

  /**
   * Calculate statutory taxes for a single voucher line
   */
  public static calculateLineTax(input: LineTaxCalculationInput): LineTaxCalculationResult {
    const qty = Number(input.quantity) || 0;
    const ratePaise = Math.round(Number(input.ratePaise) || 0);
    const gstRate = Number(input.gstRate) || 0;
    const cessRate = Number(input.cessRate) || 0;
    const isInterState = input.sellerStateCode.trim() !== input.placeOfSupplyStateCode.trim();

    let grossAmountPaise = Math.round(qty * ratePaise);
    let discountAmountPaise = 0;

    if (input.discountPercent && input.discountPercent > 0) {
      discountAmountPaise = Math.round((grossAmountPaise * input.discountPercent) / 100);
    } else if (input.discountAmountPaise && input.discountAmountPaise > 0) {
      discountAmountPaise = Math.min(grossAmountPaise, Math.round(input.discountAmountPaise));
    }

    const netLineAmountPaise = grossAmountPaise - discountAmountPaise;

    let taxableAmountPaise = 0;
    let cgstRate = 0;
    let cgstAmountPaise = 0;
    let sgstRate = 0;
    let sgstAmountPaise = 0;
    let igstRate = 0;
    let igstAmountPaise = 0;
    let cessAmountPaise = 0;
    let totalTaxPaise = 0;
    let totalAmountPaise = 0;

    if (input.isTaxInclusive) {
      // Tax Inclusive formula:
      // Taxable = Net / (1 + (GST + Cess) / 100)
      const combinedRate = gstRate + cessRate;
      taxableAmountPaise = Math.round(netLineAmountPaise / (1 + combinedRate / 100));
      totalTaxPaise = netLineAmountPaise - taxableAmountPaise;

      if (isInterState) {
        igstRate = gstRate;
        igstAmountPaise = totalTaxPaise;
      } else {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        cgstAmountPaise = Math.floor(totalTaxPaise / 2);
        sgstAmountPaise = totalTaxPaise - cgstAmountPaise;
      }

      if (cessRate > 0) {
        cessAmountPaise = Math.round((taxableAmountPaise * cessRate) / 100);
      }

      totalAmountPaise = netLineAmountPaise; // Exact match to selling price!
    } else {
      taxableAmountPaise = netLineAmountPaise;

      if (isInterState) {
        igstRate = gstRate;
        igstAmountPaise = Math.round((taxableAmountPaise * igstRate) / 100);
      } else {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        cgstAmountPaise = Math.round((taxableAmountPaise * cgstRate) / 100);
        sgstAmountPaise = Math.round((taxableAmountPaise * sgstRate) / 100);
      }

      if (cessRate > 0) {
        cessAmountPaise = Math.round((taxableAmountPaise * cessRate) / 100);
      }

      totalTaxPaise = cgstAmountPaise + sgstAmountPaise + igstAmountPaise + cessAmountPaise;
      totalAmountPaise = taxableAmountPaise + totalTaxPaise;
    }

    return {
      grossAmountPaise,
      discountAmountPaise,
      taxableAmountPaise,
      isInterState,
      cgstRate,
      cgstAmountPaise,
      sgstRate,
      sgstAmountPaise,
      igstRate,
      igstAmountPaise,
      cessRate,
      cessAmountPaise,
      totalTaxPaise,
      totalAmountPaise
    };
  }

  /**
   * Aggregate line taxes and compute configurable round-off to nearest rupee
   */
  public static calculateVoucherTotals(lines: LineTaxCalculationResult[]): VoucherTotalsResult {
    let taxableAmountPaise = 0;
    let cgstAmountPaise = 0;
    let sgstAmountPaise = 0;
    let igstAmountPaise = 0;
    let cessAmountPaise = 0;

    for (const l of lines) {
      taxableAmountPaise += l.taxableAmountPaise;
      cgstAmountPaise += l.cgstAmountPaise;
      sgstAmountPaise += l.sgstAmountPaise;
      igstAmountPaise += l.igstAmountPaise;
      cessAmountPaise += l.cessAmountPaise;
    }

    const subTotalPaise = taxableAmountPaise + cgstAmountPaise + sgstAmountPaise + igstAmountPaise + cessAmountPaise;

    // Round off to nearest ₹1.00 (100 paise)
    // 50 paise and above rounds up, below rounds down
    const roundedTotalRupees = Math.round(subTotalPaise / 100);
    const totalAmountPaise = roundedTotalRupees * 100;
    const roundOffPaise = totalAmountPaise - subTotalPaise;

    return {
      taxableAmountPaise,
      cgstAmountPaise,
      sgstAmountPaise,
      igstAmountPaise,
      cessAmountPaise,
      subTotalPaise,
      roundOffPaise,
      totalAmountPaise
    };
  }
}
