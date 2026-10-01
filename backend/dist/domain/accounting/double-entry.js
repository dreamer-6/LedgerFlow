"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoubleEntryEngine = void 0;
class DoubleEntryEngine {
    /**
     * Enforce the fundamental accounting invariant: Total Debit === Total Credit
     */
    static validateBalancedEntries(lines) {
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
    static buildSalesEntries(params) {
        const lines = [];
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
        if (params.cessAmountPaise && params.cessAmountPaise > 0 && params.outputCessLedgerId) {
            lines.push({
                ledgerId: params.outputCessLedgerId,
                debitPaise: 0,
                creditPaise: params.cessAmountPaise,
                particulars: 'Output CESS'
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
            }
            else {
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
    static buildPurchaseEntries(params) {
        const lines = [];
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
        if (params.cessAmountPaise && params.cessAmountPaise > 0 && params.inputCessLedgerId) {
            lines.push({
                ledgerId: params.inputCessLedgerId,
                debitPaise: params.cessAmountPaise,
                creditPaise: 0,
                particulars: 'Input CESS'
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
            }
            else {
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
    /**
     * Helper to construct balanced lines for a Sales Return / Credit Note voucher.
     *
     * Journal:
     *   Sales Return A/c   DR  (taxable amount)
     *   Output CGST        DR  (cgst)
     *   Output SGST        DR  (sgst)   [OR Output IGST]
     *   Round Off          DR/CR
     *       Customer A/c       CR  (total)
     */
    static buildSalesReturnEntries(params) {
        const lines = [];
        // 1. Sales Return A/c DR for Taxable Amount
        lines.push({
            ledgerId: params.salesReturnLedgerId,
            debitPaise: params.taxableAmountPaise,
            creditPaise: 0,
            particulars: 'Sales Return'
        });
        // 2. Reverse Output GST (DR — reduces tax liability)
        if (params.cgstAmountPaise > 0 && params.outputCgstLedgerId) {
            lines.push({
                ledgerId: params.outputCgstLedgerId,
                debitPaise: params.cgstAmountPaise,
                creditPaise: 0,
                particulars: 'Reverse Output CGST'
            });
        }
        if (params.sgstAmountPaise > 0 && params.outputSgstLedgerId) {
            lines.push({
                ledgerId: params.outputSgstLedgerId,
                debitPaise: params.sgstAmountPaise,
                creditPaise: 0,
                particulars: 'Reverse Output SGST'
            });
        }
        if (params.igstAmountPaise > 0 && params.outputIgstLedgerId) {
            lines.push({
                ledgerId: params.outputIgstLedgerId,
                debitPaise: params.igstAmountPaise,
                creditPaise: 0,
                particulars: 'Reverse Output IGST'
            });
        }
        if (params.cessAmountPaise && params.cessAmountPaise > 0 && params.outputCessLedgerId) {
            lines.push({
                ledgerId: params.outputCessLedgerId,
                debitPaise: params.cessAmountPaise,
                creditPaise: 0,
                particulars: 'Reverse Output CESS'
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
            }
            else {
                lines.push({
                    ledgerId: params.roundOffLedgerId,
                    debitPaise: 0,
                    creditPaise: Math.abs(params.roundOffPaise),
                    particulars: 'Round Off'
                });
            }
        }
        // 4. Customer CR for Total Return Amount (reduces receivable)
        lines.push({
            ledgerId: params.customerLedgerId,
            debitPaise: 0,
            creditPaise: params.totalAmountPaise,
            particulars: 'Customer Return'
        });
        // 5. Perpetual Inventory: Restore Inventory Asset DR, Reverse COGS CR
        if (params.cogsAmountPaise && params.cogsAmountPaise > 0 && params.inventoryLedgerId && params.cogsLedgerId) {
            lines.push({
                ledgerId: params.inventoryLedgerId,
                debitPaise: params.cogsAmountPaise,
                creditPaise: 0,
                particulars: 'Inventory Restock'
            });
            lines.push({
                ledgerId: params.cogsLedgerId,
                debitPaise: 0,
                creditPaise: params.cogsAmountPaise,
                particulars: 'Reverse Cost of Goods Sold'
            });
        }
        return lines;
    }
    /**
     * Helper to construct balanced lines for a Purchase Return / Debit Note voucher.
     *
     * Journal:
     *   Supplier A/c          DR  (total)
     *       Purchase Return A/c   CR  (taxable amount)
     *       Input CGST            CR  (cgst)
     *       Input SGST            CR  (sgst)  [OR Input IGST]
     *       Round Off             CR/DR
     */
    static buildPurchaseReturnEntries(params) {
        const lines = [];
        // 1. Supplier DR (reduces payable)
        lines.push({
            ledgerId: params.supplierLedgerId,
            debitPaise: params.totalAmountPaise,
            creditPaise: 0,
            particulars: 'Supplier Return'
        });
        // 2. Purchase Return CR for Taxable Amount
        lines.push({
            ledgerId: params.purchaseReturnLedgerId,
            debitPaise: 0,
            creditPaise: params.taxableAmountPaise,
            particulars: 'Purchase Return'
        });
        // 3. Reverse Input GST (CR — reduces input credit claimed)
        if (params.cgstAmountPaise > 0 && params.inputCgstLedgerId) {
            lines.push({
                ledgerId: params.inputCgstLedgerId,
                debitPaise: 0,
                creditPaise: params.cgstAmountPaise,
                particulars: 'Reverse Input CGST'
            });
        }
        if (params.sgstAmountPaise > 0 && params.inputSgstLedgerId) {
            lines.push({
                ledgerId: params.inputSgstLedgerId,
                debitPaise: 0,
                creditPaise: params.sgstAmountPaise,
                particulars: 'Reverse Input SGST'
            });
        }
        if (params.igstAmountPaise > 0 && params.inputIgstLedgerId) {
            lines.push({
                ledgerId: params.inputIgstLedgerId,
                debitPaise: 0,
                creditPaise: params.igstAmountPaise,
                particulars: 'Reverse Input IGST'
            });
        }
        if (params.cessAmountPaise && params.cessAmountPaise > 0 && params.inputCessLedgerId) {
            lines.push({
                ledgerId: params.inputCessLedgerId,
                debitPaise: 0,
                creditPaise: params.cessAmountPaise,
                particulars: 'Reverse Input CESS'
            });
        }
        // 4. Round Off
        if (params.roundOffPaise !== 0 && params.roundOffLedgerId) {
            if (params.roundOffPaise > 0) {
                lines.push({
                    ledgerId: params.roundOffLedgerId,
                    debitPaise: 0,
                    creditPaise: params.roundOffPaise,
                    particulars: 'Round Off'
                });
            }
            else {
                lines.push({
                    ledgerId: params.roundOffLedgerId,
                    debitPaise: Math.abs(params.roundOffPaise),
                    creditPaise: 0,
                    particulars: 'Round Off'
                });
            }
        }
        return lines;
    }
}
exports.DoubleEntryEngine = DoubleEntryEngine;
