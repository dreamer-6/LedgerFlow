import React from 'react';
import { Company } from '../api/client';
import { QuotationRecord } from '../utils/quotationStorage';
import { InvoicePrintModal } from './InvoicePrintModal';

export interface QuotationPrintModalProps {
  quotation: QuotationRecord | null;
  company: Company | null;
  onClose: () => void;
}

export type PaperFormat = 'A4' | 'A5_LANDSCAPE' | 'A5_PORTRAIT' | 'THERMAL';

/**
 * QuotationPrintModal renders the unified LedgerFlow print preview workspace
 * for quotations using the shared normalization and rendering engine.
 */
export const QuotationPrintModal: React.FC<QuotationPrintModalProps> = ({
  quotation,
  company,
  onClose
}) => {
  return (
    <InvoicePrintModal
      quotation={quotation}
      company={company}
      onClose={onClose}
    />
  );
};
