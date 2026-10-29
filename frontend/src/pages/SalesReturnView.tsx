/**
 * SalesReturnView — Sales Return & Credit Note Management
 *
 * Implements the Sales Return Entry & Register matching "LedgerFlow Sales Return Entry.png"
 * as visual source of truth.
 *
 * Capabilities:
 *   - Dual tab view: "Create Sales Return" and "Sales Return Register"
 *   - Auto-fetch next sequential Return No (SLR-...)
 *   - Customer selection linked to customer's posted sales invoices
 *   - Original invoice selection auto-populates original line items, units, rates, GST, and serial numbers
 *   - Exact return quantity validation preventing over-returns
 *   - Return reason selection (Defective, Damaged, Wrong Item, etc.)
 *   - Real-time Return Summary: items count, return quantity, subtotal, reversed GST, net credit
 *   - Save as Draft or Post Sales Return (with double-entry and inventory restoration)
 *   - Integrated Return Register with status badges, safe cancellation, and print preview
 */

import React, { useEffect, useState, useMemo } from 'react';
import { api, Company, FinancialYear } from '../api/client';
import { VoucherDeleteOptionsModal } from '../components/accounting/VoucherDeleteOptionsModal';
import { InvoicePrintModal } from './InvoicePrintModal';
import { QuickCustomerModal } from '../components/accounting/QuickCustomerModal';
import {
  RotateCcw,
  Plus,
  Trash2,
  Search,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Clock,
  ShieldCheck,
  Tag,
  Eye,
  MoreVertical,
  X,
  Layers,
  ArrowRight
} from 'lucide-react';

export interface SalesReturnViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  currentDate?: string;
  onPostSuccess?: (voucherId: string) => void;
  onNavigateTab?: (tab: string, subTab?: string) => void;
}

interface ReturnLineItem {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  hsnSac: string;
  godownId: string;
  originalSoldQty: number;
  returnQty: number;
  unit: string;
  ratePaise: number;
  discountPercent: number;
  gstRate: number;
  soldSerials: string[];
  selectedSerials: string[];
  warrantyMonths: number;
}

const RETURN_REASONS = [
  'Defective Goods / Manufacturing Defect',
  'Damaged in Transit',
  'Incorrect Item Shipped',
  'Quality Not as Expected',
  'Excess Delivery / Duplicate Order',
  'Customer Order Cancellation',
  'Other / Mutual Agreement'
];

function formatINR(paise: number | undefined | null): string {
  if (paise == null || isNaN(paise)) return '₹ 0.00';
  const rupees = paise / 100;
  return '₹ ' + rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getFullYear()}`;
}

export const SalesReturnView: React.FC<SalesReturnViewProps> = ({
  company,
  activeFy,
  currentDate,
  onPostSuccess,
  onNavigateTab
}) => {
  // Top tab: 'create' vs 'register'
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'register'>('create');

  // Masters
  const [customers, setCustomers] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [godowns, setGodowns] = useState<any[]>([]);
  const [mastersLoading, setMastersLoading] = useState(true);

  // Return Form State
  const [voucherNumber, setVoucherNumber] = useState('');
  const [returnDate, setReturnDate] = useState(currentDate || new Date().toISOString().split('T')[0]);
  const [partyId, setPartyId] = useState('');
  const [originalInvoices, setOriginalInvoices] = useState<any[]>([]);
  const [selectedOriginalInvoiceId, setSelectedOriginalInvoiceId] = useState('');
  const [originalInvoiceDate, setOriginalInvoiceDate] = useState('');
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0]);
  const [salesLedger, setSalesLedger] = useState('Sales Return');
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<ReturnLineItem[]>([]);

  // Submitting
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Quick Customer Modal
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);

  // Register State
  const [registerVouchers, setRegisterVouchers] = useState<any[]>([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSearch, setRegisterSearch] = useState('');
  const [registerCustomerFilter, setRegisterCustomerFilter] = useState('ALL');
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [activePrintVoucherId, setActivePrintVoucherId] = useState<string | null>(null);
  const [deleteModalVoucher, setDeleteModalVoucher] = useState<any | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch Return No & Masters
  const loadMasters = async () => {
    setMastersLoading(true);
    try {
      const [pts, items, gds] = await Promise.all([
        api.getParties('CUSTOMER').catch(() => []),
        api.getStockItems().catch(() => []),
        api.getGodowns().catch(() => [])
      ]);
      setCustomers(Array.isArray(pts) ? pts : []);
      setStockItems(Array.isArray(items) ? items : []);
      setGodowns(Array.isArray(gds) ? gds : []);

      if (company && activeFy) {
        const nextNum = await api.getNextVoucherNumber(company.company_id, activeFy.fy_id, 'SALES_RETURN');
        if (nextNum?.nextVoucherNumber) {
          setVoucherNumber(nextNum.nextVoucherNumber);
        }
      }
    } catch (err) {
      console.error('Failed to load return entry masters:', err);
    } finally {
      setMastersLoading(false);
    }
  };

  useEffect(() => {
    loadMasters();
  }, [company?.company_id, activeFy?.fy_id]);

  // Load Sales Return Register vouchers
  const loadRegister = async () => {
    setRegisterLoading(true);
    try {
      const vchs = await api.getSalesReturnVouchers(undefined, undefined, { includeHidden: true, showCancelled: true });
      setRegisterVouchers(Array.isArray(vchs) ? vchs : []);
    } catch (err: any) {
      console.error('Failed to load sales return register:', err);
    } finally {
      setRegisterLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'register') {
      loadRegister();
    }
  }, [activeSubTab]);

  // When customer is selected, fetch their posted sales invoices
  useEffect(() => {
    if (!partyId) {
      setOriginalInvoices([]);
      setSelectedOriginalInvoiceId('');
      setOriginalInvoiceDate('');
      setLines([]);
      return;
    }

    api.getSalesVouchers(undefined, undefined, { partyId, showCancelled: false })
      .then(invoices => {
        const posted = (invoices || []).filter((v: any) => v.status === 'POSTED' && v.party_id === partyId);
        setOriginalInvoices(posted);
      })
      .catch(console.error);
  }, [partyId]);

  // When original invoice is selected, load its items into the return table
  const handleSelectOriginalInvoice = async (invoiceId: string) => {
    setSelectedOriginalInvoiceId(invoiceId);
    if (!invoiceId) {
      setOriginalInvoiceDate('');
      setLines([]);
      return;
    }

    try {
      const { voucher: origVch, lines: origLines } = await api.getVoucherById(invoiceId);
      setOriginalInvoiceDate(origVch.voucher_date || '');

      // Transform original lines into return lines
      const returnLines: ReturnLineItem[] = origLines
        .filter((l: any) => l.item_id && Number(l.quantity) > 0)
        .map((l: any, idx: number) => {
          const serials = l.serial_number ? l.serial_number.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          return {
            id: 'ret_ln_' + idx,
            itemId: l.item_id,
            itemName: l.item_name || l.description || 'Item',
            description: l.description || '',
            hsnSac: l.hsn_sac || '',
            godownId: l.godown_id || (godowns[0]?.godown_id || ''),
            originalSoldQty: Number(l.quantity),
            returnQty: 1, // default to 1 for convenience
            unit: l.unit_symbol || 'Nos',
            ratePaise: Number(l.rate_paise || 0),
            discountPercent: Number(l.discount_percent || 0),
            gstRate: Number(l.gst_rate || 18),
            soldSerials: serials,
            selectedSerials: serials.slice(0, 1),
            warrantyMonths: Number(l.warranty_months || 0)
          };
        });

      setLines(returnLines);
      setFormError(null);
    } catch (err: any) {
      console.error('Failed to load original invoice lines:', err);
      setFormError('Failed to load original invoice items');
    }
  };

  // Add blank item line if not linked to an invoice
  const handleAddManualLine = () => {
    setLines(prev => [
      ...prev,
      {
        id: 'ret_manual_' + Date.now().toString(36),
        itemId: stockItems[0]?.item_id || '',
        itemName: stockItems[0]?.item_name || '',
        description: '',
        hsnSac: stockItems[0]?.hsn_sac || '',
        godownId: godowns[0]?.godown_id || '',
        originalSoldQty: 9999,
        returnQty: 1,
        unit: 'Nos',
        ratePaise: (stockItems[0]?.selling_rate_paise || 0),
        discountPercent: 0,
        gstRate: stockItems[0]?.gst_rate || 18,
        soldSerials: [],
        selectedSerials: [],
        warrantyMonths: stockItems[0]?.warranty_months || 0
      }
    ]);
  };

  const handleRemoveLine = (id: string) => {
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const handleUpdateLine = (id: string, updates: Partial<ReturnLineItem>) => {
    setLines(prev => prev.map(l => (l.id === id ? { ...l, ...updates } : l)));
  };

  // Calculate totals
  const summary = useMemo(() => {
    let totalItems = 0;
    let totalQty = 0;
    let taxablePaise = 0;
    let totalTaxPaise = 0;

    for (const l of lines) {
      if (!l.itemId || l.returnQty <= 0) continue;
      totalItems += 1;
      totalQty += l.returnQty;

      const gross = Math.round(l.returnQty * l.ratePaise);
      const discount = Math.round(gross * (l.discountPercent / 100));
      const lineTaxable = gross - discount;
      const lineTax = Math.round(lineTaxable * (l.gstRate / 100));

      taxablePaise += lineTaxable;
      totalTaxPaise += lineTax;
    }

    const netCreditPaise = taxablePaise + totalTaxPaise;

    return {
      totalItems,
      totalQty,
      taxablePaise,
      totalTaxPaise,
      netCreditPaise
    };
  }, [lines]);

  // Form Submission
  const handleSubmitReturn = async (status: 'DRAFT' | 'POSTED') => {
    setFormError(null);

    if (!partyId) {
      setFormError('Please select a customer for this return.');
      return;
    }
    if (lines.length === 0) {
      setFormError('Please add at least one item to return.');
      return;
    }
    for (const l of lines) {
      if (!l.itemId) {
        setFormError('Each line must specify a valid stock item.');
        return;
      }
      if (l.returnQty <= 0) {
        setFormError(`Return quantity for '${l.itemName}' must be greater than zero.`);
        return;
      }
      if (selectedOriginalInvoiceId && l.returnQty > l.originalSoldQty) {
        setFormError(`Return quantity for '${l.itemName}' cannot exceed original sold quantity (${l.originalSoldQty}).`);
        return;
      }
      if (l.soldSerials.length > 0 && l.selectedSerials.length !== l.returnQty) {
        setFormError(`Please select exactly ${l.returnQty} serial number(s) for '${l.itemName}'.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        companyId: company?.company_id,
        fyId: activeFy?.fy_id,
        voucherType: 'SALES_RETURN',
        voucherNumber: voucherNumber || undefined,
        voucherDate: returnDate,
        referenceNumber: selectedOriginalInvoiceId || undefined,
        referenceDate: originalInvoiceDate || undefined,
        partyId,
        narration: narration ? `[Return Reason: ${returnReason}] ${narration}` : `Return Reason: ${returnReason}`,
        status,
        billAllocation: selectedOriginalInvoiceId
          ? {
              referenceVoucherId: selectedOriginalInvoiceId,
              allocationType: 'AGAINST_REF' as const
            }
          : undefined,
        lines: lines.map(l => ({
          itemId: l.itemId,
          description: l.description || l.itemName,
          godownId: l.godownId || godowns[0]?.godown_id,
          quantity: l.returnQty,
          ratePaise: l.ratePaise,
          discountPercent: l.discountPercent,
          gstRate: l.gstRate,
          serialNumber: l.selectedSerials.length > 0 ? l.selectedSerials.join(', ') : undefined,
          warrantyMonths: l.warrantyMonths
        }))
      };

      const result = await api.postVoucher(payload);
      showToast(status === 'POSTED' ? 'Sales Return posted and inventory restored!' : 'Draft Return saved successfully.');

      if (status === 'POSTED') {
        setActivePrintVoucherId(result.voucherId);
        if (onPostSuccess) onPostSuccess(result.voucherId);
      }

      // Reset form
      setPartyId('');
      setSelectedOriginalInvoiceId('');
      setOriginalInvoiceDate('');
      setLines([]);
      setNarration('');

      // Refresh Return No
      if (company && activeFy) {
        api.getNextVoucherNumber(company.company_id, activeFy.fy_id, 'SALES_RETURN').then(res => {
          if (res?.nextVoucherNumber) setVoucherNumber(res.nextVoucherNumber);
        });
      }

      setActiveSubTab('register');
    } catch (err: any) {
      console.error('Failed to post sales return:', err);
      setFormError(err?.message || 'Failed to record sales return');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Register filter
  const filteredRegister = useMemo(() => {
    return registerVouchers.filter(v => {
      if (registerCustomerFilter !== 'ALL' && v.party_id !== registerCustomerFilter) return false;
      if (registerSearch.trim()) {
        const q = registerSearch.toLowerCase().trim();
        const vNum = (v.voucher_number || '').toLowerCase();
        const pName = (v.party_name || '').toLowerCase();
        const refNo = (v.reference_number || '').toLowerCase();
        if (!vNum.includes(q) && !pName.includes(q) && !refNo.includes(q)) return false;
      }
      return true;
    });
  }, [registerVouchers, registerCustomerFilter, registerSearch]);

  const handleSafeDeleteFromModal = async (reason: string) => {
    if (!deleteModalVoucher) return;
    const v = deleteModalVoucher;
    if (v.status === 'POSTED') {
      await api.cancelVoucher(v.voucher_id, reason);
      showToast(`Return ${v.voucher_number} cancelled.`);
    } else if (v.status === 'DRAFT') {
      await api.deleteVoucher(v.voucher_id);
      showToast(`Draft ${v.voucher_number} deleted.`);
    } else {
      await api.hideVoucher(v.voucher_id);
      showToast(`Return ${v.voucher_number} hidden.`);
    }
    setDeleteModalVoucher(null);
    await loadRegister();
  };

  const handlePermanentDeleteFromModal = async (reason: string) => {
    if (!deleteModalVoucher) return;
    const v = deleteModalVoucher;
    await api.deleteVoucher(v.voucher_id, {
      permanentDelete: true,
      cancelReason: reason
    });
    showToast(`Return ${v.voucher_number} permanently deleted.`);
    setDeleteModalVoucher(null);
    await loadRegister();
  };

  return (
    <div className="view-container" style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 9999,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <CheckCircle2 size={16} color="#10B981" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary, #0F172A)', margin: 0, letterSpacing: '-0.02em' }}>
              Sales Return & Credit Notes
            </h1>
            <span
              style={{
                backgroundColor: 'rgba(234,88,12,0.1)',
                color: '#EA580C',
                padding: '3px 9px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 700
              }}
            >
              GST Inward Reversal
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted, #64748B)' }}>
            Process customer returns against original tax invoices with automatic stock and GST reversal.
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div
          style={{
            display: 'inline-flex',
            backgroundColor: 'var(--bg-subtle, #F1F5F9)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle, #E2E8F0)'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveSubTab('create')}
            style={{
              padding: '6px 14px',
              fontSize: '12.5px',
              fontWeight: activeSubTab === 'create' ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeSubTab === 'create' ? '#EA580C' : 'transparent',
              color: activeSubTab === 'create' ? '#FFFFFF' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            + Create Return
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('register')}
            style={{
              padding: '6px 14px',
              fontSize: '12.5px',
              fontWeight: activeSubTab === 'register' ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeSubTab === 'register' ? '#EA580C' : 'transparent',
              color: activeSubTab === 'register' ? '#FFFFFF' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Return Register ({registerVouchers.length})
          </button>
        </div>
      </div>

      {formError && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '8px',
            color: '#B91C1C',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertCircle size={16} color="#DC2626" />
          {formError}
        </div>
      )}

      {/* =========================================================
          TAB 1: CREATE SALES RETURN
         ========================================================= */}
      {activeSubTab === 'create' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '22px', alignItems: 'start' }}>
          
          {/* Main Form Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Return Details Card */}
            <div
              className="ledger-card"
              style={{
                padding: '22px 24px',
                borderRadius: '12px',
                backgroundColor: 'var(--surface, #FFFFFF)',
                border: '1px solid var(--border, #E2E8F0)'
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Return Header Details
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {/* Customer Selection */}
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Customer Name <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowQuickCustomerModal(true)}
                      style={{ background: 'none', border: 'none', color: '#EA580C', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      + New Customer
                    </button>
                  </div>
                  <select
                    value={partyId}
                    onChange={e => setPartyId(e.target.value)}
                    className="lf-input"
                    style={{ width: '100%', height: '36px', fontSize: '13px' }}
                  >
                    <option value="">Select customer to return goods from…</option>
                    {customers.map(c => (
                      <option key={c.party_id} value={c.party_id}>
                        {c.party_name} {c.city ? `(${c.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Return Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' }}>
                    Return Date <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={e => setReturnDate(e.target.value)}
                    className="lf-input"
                    style={{ width: '100%', height: '36px', fontSize: '13px' }}
                  />
                </div>

                {/* Original Invoice Selector */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' }}>
                    Original Sales Invoice # (Optional Link)
                  </label>
                  <select
                    value={selectedOriginalInvoiceId}
                    onChange={e => handleSelectOriginalInvoice(e.target.value)}
                    disabled={!partyId}
                    className="lf-input"
                    style={{ width: '100%', height: '36px', fontSize: '13px', opacity: partyId ? 1 : 0.6 }}
                  >
                    <option value="">
                      {!partyId ? 'Select customer first to view invoices' : originalInvoices.length === 0 ? 'No posted invoices found for this customer' : 'Select original invoice to auto-fill items…'}
                    </option>
                    {originalInvoices.map(inv => (
                      <option key={inv.voucher_id} value={inv.voucher_id}>
                        {inv.voucher_number} — Date: {inv.voucher_date} — Amt: {formatINR(inv.total_amount_paise)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Return Reason */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' }}>
                    Reason for Return <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <select
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                    className="lf-input"
                    style={{ width: '100%', height: '36px', fontSize: '13px' }}
                  >
                    {RETURN_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Return Items Table Card */}
            <div
              className="ledger-card"
              style={{
                padding: '22px 24px',
                borderRadius: '12px',
                backgroundColor: 'var(--surface, #FFFFFF)',
                border: '1px solid var(--border, #E2E8F0)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Returned Item Lines
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Items returned will be immediately credited to inventory stock and customer account.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddManualLine}
                  className="lf-btn lf-btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '32px', fontSize: '12px', padding: '0 10px' }}
                >
                  <Plus size={13} /> Add Item Row
                </button>
              </div>

              {lines.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-subtle, #F8FAFC)', borderRadius: '8px' }}>
                  <Layers size={28} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>No items selected for return</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Select an original invoice above to auto-populate lines, or click "+ Add Item Row".
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-subtle, #F8FAFC)', borderBottom: '1px solid var(--border-subtle, #E2E8F0)' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Item</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Sold Qty</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', width: '90px' }}>Return Qty</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Rate</th>
                        <th style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>GST %</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Credit Amt</th>
                        <th style={{ padding: '10px 10px', textAlign: 'center', width: '40px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, idx) => {
                        const lineGross = Math.round(l.returnQty * l.ratePaise);
                        const lineDiscount = Math.round(lineGross * (l.discountPercent / 100));
                        const lineTaxable = lineGross - lineDiscount;
                        const lineTax = Math.round(lineTaxable * (l.gstRate / 100));
                        const lineTotal = lineTaxable + lineTax;

                        return (
                          <tr key={l.id} style={{ borderBottom: '1px solid var(--border-subtle, #F1F5F9)' }}>
                            {/* Item Name & Serials */}
                            <td style={{ padding: '12px 10px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{l.itemName}</div>
                              {l.hsnSac && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  HSN: {l.hsnSac}
                                </div>
                              )}

                              {/* Serial Number Picker for Return */}
                              {l.soldSerials.length > 0 && (
                                <div style={{ marginTop: '6px' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                                    Select returned serial(s):
                                  </span>
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {l.soldSerials.map(sn => {
                                      const isChosen = l.selectedSerials.includes(sn);
                                      return (
                                        <button
                                          key={sn}
                                          type="button"
                                          onClick={() => {
                                            const next = isChosen
                                              ? l.selectedSerials.filter(s => s !== sn)
                                              : [...l.selectedSerials, sn];
                                            handleUpdateLine(l.id, { selectedSerials: next, returnQty: next.length });
                                          }}
                                          style={{
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            border: isChosen ? '1px solid #EA580C' : '1px solid var(--border-subtle, #CBD5E1)',
                                            backgroundColor: isChosen ? 'rgba(234,88,12,0.1)' : 'var(--surface, #FFFFFF)',
                                            color: isChosen ? '#EA580C' : 'var(--text-secondary)'
                                          }}
                                        >
                                          {isChosen ? '✓ ' : ''}{sn}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Original Sold Qty */}
                            <td style={{ padding: '12px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>
                              {l.originalSoldQty === 9999 ? '—' : `${l.originalSoldQty} ${l.unit}`}
                            </td>

                            {/* Return Qty Input */}
                            <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                              <input
                                type="number"
                                min={1}
                                max={l.originalSoldQty}
                                value={l.returnQty}
                                onChange={e => {
                                  const val = Math.max(1, Number(e.target.value) || 1);
                                  handleUpdateLine(l.id, { returnQty: val });
                                }}
                                className="lf-input"
                                style={{ width: '70px', height: '32px', textAlign: 'right', fontSize: '12.5px' }}
                              />
                            </td>

                            {/* Rate */}
                            <td style={{ padding: '12px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                              {formatINR(l.ratePaise)}
                            </td>

                            {/* GST % */}
                            <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              {l.gstRate}%
                            </td>

                            {/* Credit Total */}
                            <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#EA580C' }}>
                              {formatINR(lineTotal)}
                            </td>

                            {/* Delete line */}
                            <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(l.id)}
                                style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                                title="Remove item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Narration & Notes Card */}
            <div
              className="ledger-card"
              style={{
                padding: '18px 24px',
                borderRadius: '12px',
                backgroundColor: 'var(--surface, #FFFFFF)',
                border: '1px solid var(--border, #E2E8F0)'
              }}
            >
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Return Remarks & Audit Notes
              </label>
              <textarea
                value={narration}
                onChange={e => setNarration(e.target.value)}
                placeholder="Specific return inspection remarks, defect details, RMA serial verification notes…"
                rows={3}
                className="lf-input"
                style={{ width: '100%', fontSize: '12.5px', padding: '8px 12px' }}
              />
            </div>
          </div>

          {/* Right Column: Return Summary & Post Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* Return Summary Card */}
            <div className="ledger-card" style={{ padding: '20px 22px', borderRadius: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
                Return Summary
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Return Voucher #:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{voucherNumber || 'SLR-…'}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Total Items:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{summary.totalItems}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Total Return Qty:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{summary.totalQty} Units</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Return Subtotal:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatINR(summary.taxablePaise)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Reverse GST Tax:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatINR(summary.totalTaxPaise)}</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    marginTop: '6px',
                    borderTop: '2px solid var(--border-subtle, #E2E8F0)',
                    fontSize: '16px',
                    fontWeight: 800,
                    color: 'var(--text-primary)'
                  }}
                >
                  <span>Credit Note Value:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#EA580C' }}>{formatINR(summary.netCreditPaise)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleSubmitReturn('POSTED')}
                  disabled={isSubmitting || summary.totalItems === 0}
                  className="lf-btn lf-btn-primary"
                  style={{
                    width: '100%',
                    height: '40px',
                    backgroundColor: '#EA580C',
                    borderColor: '#EA580C',
                    fontSize: '13px',
                    fontWeight: 700
                  }}
                >
                  {isSubmitting ? 'Posting Return…' : 'Post Sales Return / Credit Note'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmitReturn('DRAFT')}
                  disabled={isSubmitting || summary.totalItems === 0}
                  className="lf-btn lf-btn-secondary"
                  style={{ width: '100%', height: '36px', fontSize: '12.5px' }}
                >
                  Save as Draft
                </button>
              </div>
            </div>

            {/* Statutory Invariant Info */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(234,88,12,0.05)',
                border: '1px solid rgba(234,88,12,0.2)',
                fontSize: '11.5px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5
              }}
            >
              <strong style={{ color: '#EA580C' }}>Accounting & Inventory Impact:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: '16px' }}>
                <li>Sales account debited with return value</li>
                <li>Output GST debited (statutory tax reversal)</li>
                <li>Customer ledger credited with net credit note</li>
                <li>Physical inventory restored at original acquisition cost</li>
                <li>Serialized units returned to AVAILABLE stock</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 2: SALES RETURN REGISTER
         ========================================================= */}
      {activeSubTab === 'register' && (
        <div
          className="ledger-card"
          style={{
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: 'var(--surface, #FFFFFF)',
            border: '1px solid var(--border, #E2E8F0)'
          }}
        >
          {/* Register Filter Strip */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle, #E2E8F0)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={registerSearch}
                onChange={e => setRegisterSearch(e.target.value)}
                placeholder="Search return #, customer, inv #…"
                className="lf-input"
                style={{ width: '100%', height: '34px', paddingLeft: '32px', fontSize: '12.5px' }}
              />
            </div>

            <select
              value={registerCustomerFilter}
              onChange={e => setRegisterCustomerFilter(e.target.value)}
              className="lf-input"
              style={{ width: '200px', height: '34px', fontSize: '12.5px' }}
            >
              <option value="ALL">All Customers</option>
              {customers.map(c => (
                <option key={c.party_id} value={c.party_id}>{c.party_name}</option>
              ))}
            </select>
          </div>

          {/* Register Table */}
          <div style={{ overflowX: 'auto', minHeight: '300px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-subtle, #F8FAFC)', borderBottom: '1px solid var(--border-subtle, #E2E8F0)' }}>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '11.5px' }}>Date</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '11.5px' }}>Return No.</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '11.5px' }}>Customer</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '11.5px' }}>Original Inv #</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: '11.5px' }}>Credit Amount</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: '11.5px' }}>Stock Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: '11.5px' }}>Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: '11.5px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {registerLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle, #E2E8F0)' }}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} style={{ padding: '14px' }}>
                          <div style={{ height: '14px', borderRadius: '4px', backgroundColor: 'var(--bg-hover, #F1F5F9)' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredRegister.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <RotateCcw size={32} style={{ opacity: 0.3, margin: '0 auto 10px', display: 'block' }} />
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>No sales returns found</div>
                      <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                        Click "+ Create Return" tab above to process your first customer return.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRegister.map(v => (
                    <tr key={v.voucher_id} style={{ borderBottom: '1px solid var(--border-subtle, #E2E8F0)' }}>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {formatDateDisplay(v.voucher_date)}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#EA580C', whiteSpace: 'nowrap' }}>
                        {v.voucher_number || 'SLR-…'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v.party_name || 'Customer'}</div>
                        {v.party_city && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.party_city}</div>}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {v.reference_number || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {formatINR(v.total_amount_paise)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '4px' }}>
                          ✓ Restored
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: v.status === 'POSTED' ? '#ECFDF5' : v.status === 'DRAFT' ? '#FEF3C7' : '#FEE2E2',
                            color: v.status === 'POSTED' ? '#059669' : v.status === 'DRAFT' ? '#D97706' : '#DC2626'
                          }}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setActivePrintVoucherId(v.voucher_id)}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle, #CBD5E1)', backgroundColor: 'var(--surface)', cursor: 'pointer', fontSize: '11.5px' }}
                            title="Print Credit Note"
                          >
                            <Printer size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteModalVoucher(v)}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle, #CBD5E1)', backgroundColor: 'var(--surface)', color: '#EF4444', cursor: 'pointer', fontSize: '11.5px' }}
                            title="Cancel / Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Customer Modal */}
      {showQuickCustomerModal && (
        <QuickCustomerModal
          isOpen={showQuickCustomerModal}
          onClose={() => setShowQuickCustomerModal(false)}
          onSuccess={newCustomer => {
            setShowQuickCustomerModal(false);
            setCustomers(prev => [...prev, newCustomer]);
            setPartyId(newCustomer.party_id);
            showToast(`Customer '${newCustomer.party_name}' created!`);
          }}
        />
      )}

      {/* Print Credit Note Modal */}
      {activePrintVoucherId && (
        <InvoicePrintModal
          voucherId={activePrintVoucherId}
          company={company}
          onClose={() => setActivePrintVoucherId(null)}
        />
      )}

      {/* Delete / Cancel Modal */}
      <VoucherDeleteOptionsModal
        isOpen={!!deleteModalVoucher}
        voucher={
          deleteModalVoucher
            ? {
                voucher_id: deleteModalVoucher.voucher_id,
                voucher_number: deleteModalVoucher.voucher_number || 'SLR-…',
                voucher_type: deleteModalVoucher.voucher_type || 'SALES_RETURN',
                status: deleteModalVoucher.status,
                party_name: deleteModalVoucher.party_name,
                total_amount_paise: deleteModalVoucher.total_amount_paise
              }
            : null
        }
        userRole="ADMIN"
        onClose={() => setDeleteModalVoucher(null)}
        onSafeDelete={handleSafeDeleteFromModal}
        onPermanentDelete={handlePermanentDeleteFromModal}
      />
    </div>
  );
};
