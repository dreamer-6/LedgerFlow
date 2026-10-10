/**
 * quotationStorage.ts — Multi-Tenant Client Persistence for Quotation Management
 *
 * Provides safe, isolated, company-scoped persistence for Quotations without
 * altering the frozen backend schema or polluting the double-entry accounting engine.
 */

export interface QuotationLineItem {
  id: string;
  itemId?: string;
  description: string;
  subtext?: string;
  hsnSac: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPercent: number;
  gstRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  isService?: boolean;
}

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';

export interface QuotationRecord {
  id: string;
  companyId: string;
  fyId: string;
  quotationNumber: string; // e.g. QTN-2024-00056
  quotationDate: string;   // YYYY-MM-DD
  validTill: string;       // YYYY-MM-DD
  salesPerson: string;
  referenceNumber?: string;
  placeOfSupply: string;   // State name or code
  subject?: string;
  customerId: string;
  customerDetails: {
    name: string;
    code?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstin?: string;
    phone?: string;
    email?: string;
  };
  taxMode: 'EXCLUSIVE' | 'INCLUSIVE';
  items: QuotationLineItem[];
  termsConditions: string;
  notes?: string;
  transportMode?: string;
  vehicleNo?: string;
  deliveryPeriod?: string;
  remark?: string;
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  roundOff: number;
  grandTotal: number;
  status: QuotationStatus;
  convertedInvoiceNumber?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_PREFIX = 'lf_quotations_';

function getStorageKey(companyId: string): string {
  return `${STORAGE_PREFIX}${companyId || 'default'}`;
}

export const quotationStorage = {
  /**
   * Retrieves all quotations for a given company.
   */
  getAll(companyId: string): QuotationRecord[] {
    try {
      const raw = localStorage.getItem(getStorageKey(companyId));
      if (!raw) return [];
      const list: QuotationRecord[] = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (err) {
      console.error('Failed to load quotations from storage:', err);
      return [];
    }
  },

  /**
   * Retrieves a single quotation by ID.
   */
  getById(companyId: string, id: string): QuotationRecord | null {
    const all = this.getAll(companyId);
    return all.find((q) => q.id === id) || null;
  },

  /**
   * Generates the next sequential quotation number in the format QTN-[YYYY]-[00001].
   */
  getNextNumber(companyId: string, yearStr?: string): string {
    const currentYear = yearStr || new Date().getFullYear().toString();
    const all = this.getAll(companyId);
    const prefix = `QTN-${currentYear}-`;
    const matching = all
      .map((q) => q.quotationNumber)
      .filter((num) => num && num.startsWith(prefix));

    let maxSeq = 0;
    for (const num of matching) {
      const parts = num.split('-');
      const seqStr = parts[parts.length - 1];
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
    const nextSeq = maxSeq + 1;
    const padded = String(nextSeq).padStart(5, '0');
    return `${prefix}${padded}`;
  },

  /**
   * Saves (inserts or updates) a quotation record.
   */
  save(quotation: QuotationRecord): QuotationRecord {
    const all = this.getAll(quotation.companyId);
    const now = new Date().toISOString();
    const existingIndex = all.findIndex((q) => q.id === quotation.id);

    let updated: QuotationRecord;
    if (existingIndex >= 0) {
      updated = {
        ...all[existingIndex],
        ...quotation,
        updatedAt: now
      };
      all[existingIndex] = updated;
    } else {
      updated = {
        ...quotation,
        id: quotation.id || 'qtn_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        createdAt: quotation.createdAt || now,
        updatedAt: now
      };
      all.unshift(updated);
    }

    try {
      localStorage.setItem(getStorageKey(quotation.companyId), JSON.stringify(all));
    } catch (err) {
      console.error('Failed to save quotation to storage:', err);
    }
    return updated;
  },

  /**
   * Deletes a quotation by ID.
   */
  delete(companyId: string, id: string): boolean {
    const all = this.getAll(companyId);
    const filtered = all.filter((q) => q.id !== id);
    if (filtered.length === all.length) return false;
    try {
      localStorage.setItem(getStorageKey(companyId), JSON.stringify(filtered));
      return true;
    } catch (err) {
      console.error('Failed to delete quotation from storage:', err);
      return false;
    }
  },

  /**
   * Marks a quotation as converted to a Sales Invoice.
   */
  markConverted(companyId: string, id: string, invoiceNumber: string): QuotationRecord | null {
    const qtn = this.getById(companyId, id);
    if (!qtn) return null;
    qtn.status = 'CONVERTED';
    qtn.convertedInvoiceNumber = invoiceNumber;
    return this.save(qtn);
  },

  /**
   * Duplicates an existing quotation, generating a new ID and quotation number.
   */
  duplicate(companyId: string, id: string): QuotationRecord | null {
    const original = this.getById(companyId, id);
    if (!original) return null;

    const nextNumber = this.getNextNumber(companyId);
    const today = new Date().toISOString().split('T')[0];
    const validDate = new Date();
    validDate.setDate(validDate.getDate() + 7);
    const validTill = validDate.toISOString().split('T')[0];

    const copy: QuotationRecord = {
      ...original,
      id: 'qtn_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      quotationNumber: nextNumber,
      quotationDate: today,
      validTill: validTill,
      status: 'DRAFT',
      convertedInvoiceNumber: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return this.save(copy);
  }
};
