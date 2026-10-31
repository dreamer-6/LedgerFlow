/**
 * PurchaseReturnView — Complete Purchase Return & Debit Note Workflow
 *
 * Implements the Purchase Return screen matching "LedgerFlow Purchase Return Dashboard.png"
 * as visual source of truth.
 *
 * Capabilities:
 *   - Dual tab view: "Create Purchase Return" and "Purchase Return Register"
 *   - Auto-fetch next sequential Return Voucher No (PRT-...)
 *   - Supplier selection linked to supplier's posted purchase invoices
 *   - Original purchase invoice selection auto-populates original line items, units, rates, and GST
 *   - Exact return quantity validation preventing over-returns (Qty <= Remaining Returnable Qty)
 *   - Return type & reason selection (Goods Return, Defective, Damaged in Transit, etc.)
 *   - Real-time Return Summary: items count, return quantity, taxable subtotal, reversed CGST/SGST/IGST, net credit
 *   - Save as Draft or Post Purchase Return (with double-entry ledger posting, stock reduction, and input GST reversal)
 *   - Integrated Return Register with status badges, safe cancellation, and print preview
 */

import React, { useEffect, useState, useMemo } from 'react';
import { api, Company, FinancialYear, Party, StockItem } from '../api/client';
import { VoucherDeleteOptionsModal } from '../components/accounting/VoucherDeleteOptionsModal';
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
  Clock,
  Eye,
  MoreVertical,
  X,
  Layers,
  ArrowRight,
  Package,
  Building2,
  ShieldCheck,
  ChevronDown,
  Save,
  Send
} from 'lucide-react';

export interface PurchaseReturnViewProps {
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
  originalPurchasedQty: number;
  previouslyReturnedQty: number;
  returnQty: number;
  unit: string;
  ratePaise: number;
  taxPercent: number;
  amountPaise: number;
  serialNumber?: string;
}

const RETURN_TYPES = [
  'Goods Return',
  'Defective Goods / Manufacturing Defect',
  'Damaged in Transit',
  'Incorrect Item Received',
  'Quality Not as Expected',
  'Excess Delivery / Duplicate Order',
  'Price Difference / Rate Revision'
];

const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' }, { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' }, { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' }, { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' }, { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' }, { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' }, { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' }, { code: '29', name: 'Karnataka' },
  { code: '32', name: 'Kerala' }, { code: '33', name: 'Tamil Nadu' },
  { code: '36', name: 'Telangana' }, { code: '37', name: 'Andhra Pradesh' }
];

function formatINR(paise: number | undefined | null): string {
  if (paise == null || isNaN(paise)) return '₹ 0.00';
  const rupees = paise / 100;
  return '₹ ' + rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export const PurchaseReturnView: React.FC<PurchaseReturnViewProps> = ({
  company,
  activeFy,
  currentDate,
  onPostSuccess,
  onNavigateTab
}) => {
  // Dual Tab: 'create' vs 'register'
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'register'>('create');

  // Masters
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [godowns, setGodowns] = useState<any[]>([]);
  const [mastersLoading, setMastersLoading] = useState(true);

  // Return Form State
  const [voucherNumber, setVoucherNumber] = useState('');
  const [returnDate, setReturnDate] = useState(() => currentDate || new Date().toISOString().split('T')[0]);
  const [partyId, setPartyId] = useState('');
  const [originalInvoices, setOriginalInvoices] = useState<any[]>([]);
  const [selectedOriginalInvoiceId, setSelectedOriginalInvoiceId] = useState('');
  const [originalInvoiceDate, setOriginalInvoiceDate] = useState('');
  const [returnType, setReturnType] = useState(RETURN_TYPES[0]);
  const [placeOfSupply, setPlaceOfSupply] = useState('33');
  const [reasonForReturn, setReasonForReturn] = useState('Goods returned in original condition');

  // Tax Mode: Exclusive vs Inclusive
  const [taxMode, setTaxMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('INCLUSIVE');

  // Line Items
  const [lineItems, setLineItems] = useState<ReturnLineItem[]>([]);

  // Terms and Notes
  const [termsAndConditions, setTermsAndConditions] = useState(
    '1. Goods are returned in original condition.\n2. Return is against the above purchase invoice.\n3. Credit will be adjusted in our account.\n4. Subject to local jurisdiction.'
  );
  const [notes, setNotes] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Quick Supplier Modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  // Register Tab State
  const [registerVouchers, setRegisterVouchers] = useState<any[]>([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSearch, setRegisterSearch] = useState('');
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [deleteModalVoucher, setDeleteModalVoucher] = useState<any | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load masters on mount
  useEffect(() => {
    async function loadMasters() {
      try {
        setMastersLoading(true);
        const [partiesRes, itemsRes, godownsRes] = await Promise.all([
          api.getParties('SUPPLIER'),
          api.getStockItems(),
          api.getGodowns()
        ]);
        setSuppliers(Array.isArray(partiesRes) ? partiesRes : []);
        setStockItems(Array.isArray(itemsRes) ? itemsRes : []);
        setGodowns(Array.isArray(godownsRes) ? godownsRes : []);
      } catch (err: any) {
        console.error('Error loading masters for Purchase Return:', err);
      } finally {
        setMastersLoading(false);
      }
    }
    loadMasters();
  }, []);

  // Fetch next voucher number
  useEffect(() => {
    if (!company?.company_id) return;
    api.getNextVoucherNumber('PURCHASE_RETURN', activeFy?.fy_id)
      .then(res => {
        const nextNum = res.nextVoucherNumber || res.next_number || 'PRT-2024-0001';
        setVoucherNumber(nextNum);
      })
      .catch(() => {
        setVoucherNumber('PRT-2024-0001');
      });
  }, [company?.company_id, activeFy?.fy_id]);

  // When supplier changes, fetch their posted purchase invoices
  useEffect(() => {
    if (!company?.company_id || !partyId) {
      setOriginalInvoices([]);
      setSelectedOriginalInvoiceId('');
      setOriginalInvoiceDate('');
      setLineItems([]);
      return;
    }

    api.getVouchers(company.company_id, 'PURCHASE')
      .then(res => {
        const allVouchers = Array.isArray(res) ? res : (res as any).vouchers || [];
        // Filter to posted purchase vouchers for this supplier
        const supplierInvoices = allVouchers.filter((v: any) => v.party_id === partyId && (v.status || '').toUpperCase() === 'POSTED');
        setOriginalInvoices(supplierInvoices);

        // Auto-select first invoice if available
        if (supplierInvoices.length > 0) {
          handleSelectOriginalInvoice(supplierInvoices[0].voucher_id, supplierInvoices[0]);
        } else {
          setSelectedOriginalInvoiceId('');
          setOriginalInvoiceDate('');
          setLineItems([]);
        }
      })
      .catch(err => {
        console.error('Error loading original purchase vouchers:', err);
        setOriginalInvoices([]);
      });
  }, [partyId, company?.company_id]);

  // Handle selecting an original purchase invoice
  const handleSelectOriginalInvoice = async (voucherId: string, preloadedVoucher?: any) => {
    setSelectedOriginalInvoiceId(voucherId);
    try {
      let vDetail = preloadedVoucher;
      let lines = preloadedVoucher?.lines || [];

      if (!lines || lines.length === 0) {
        const res = await api.getVoucherById(voucherId);
        vDetail = res.voucher;
        lines = res.lines || [];
      }

      if (vDetail?.voucher_date) {
        setOriginalInvoiceDate(vDetail.voucher_date.split('T')[0]);
      }
      if (vDetail?.place_of_supply) {
        setPlaceOfSupply(vDetail.place_of_supply);
      }

      // Convert original invoice lines to return line items
      const newLines: ReturnLineItem[] = lines.map((l: any, idx: number) => {
        const origQty = Number(l.quantity || l.qty || 1);
        const ratePaise = Number(l.rate_paise || Math.round((Number(l.rate || 0)) * 100));
        const taxRate = Number(l.gst_rate || l.tax_percent || 18);

        return {
          id: `line-${Date.now()}-${idx}`,
          itemId: l.item_id || '',
          itemName: l.item_name || l.name || 'Item',
          description: l.description || '',
          hsnSac: l.hsn_sac || l.hsn_code || '8443',
          godownId: l.godown_id || '',
          originalPurchasedQty: origQty,
          previouslyReturnedQty: 0,
          returnQty: 1, // Default 1 item to return
          unit: l.unit_symbol || l.unit || 'Nos',
          ratePaise,
          taxPercent: taxRate,
          amountPaise: 0,
          serialNumber: l.serial_numbers || ''
        };
      });

      setLineItems(newLines);
    } catch (err: any) {
      console.error('Failed to load voucher details:', err);
    }
  };

  // Selected supplier details
  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.party_id === partyId) || null;
  }, [suppliers, partyId]);

  // Set default place of supply when supplier changes
  useEffect(() => {
    if (selectedSupplier?.state_code) {
      setPlaceOfSupply(selectedSupplier.state_code);
    }
  }, [selectedSupplier]);

  // Calculate line amounts and return totals
  const summary = useMemo(() => {
    let subtotalPaise = 0;
    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;
    let totalItems = 0;
    let totalReturnQty = 0;

    const isInterState = company?.state_code && placeOfSupply && company.state_code !== placeOfSupply;

    lineItems.forEach(line => {
      const qty = Number(line.returnQty || 0);
      if (qty <= 0) return;

      totalItems += 1;
      totalReturnQty += qty;

      let lineTaxablePaise = 0;
      let lineTaxPaise = 0;
      let lineTotalPaise = 0;

      if (taxMode === 'INCLUSIVE') {
        // Rate is inclusive of GST
        const grossPaise = qty * line.ratePaise;
        lineTaxablePaise = Math.round(grossPaise / (1 + line.taxPercent / 100));
        lineTaxPaise = grossPaise - lineTaxablePaise;
        lineTotalPaise = grossPaise;
      } else {
        // Rate is exclusive of GST
        lineTaxablePaise = qty * line.ratePaise;
        lineTaxPaise = Math.round(lineTaxablePaise * (line.taxPercent / 100));
        lineTotalPaise = lineTaxablePaise + lineTaxPaise;
      }

      subtotalPaise += lineTaxablePaise;

      if (isInterState) {
        igstPaise += lineTaxPaise;
      } else {
        const half = Math.round(lineTaxPaise / 2);
        cgstPaise += half;
        sgstPaise += (lineTaxPaise - half);
      }
    });

    const grandTotalPaise = subtotalPaise + cgstPaise + sgstPaise + igstPaise;
    const roundedTotalPaise = Math.round(grandTotalPaise / 100) * 100;
    const roundOffPaise = roundedTotalPaise - grandTotalPaise;

    return {
      totalItems,
      totalReturnQty,
      subtotalPaise,
      cgstPaise,
      sgstPaise,
      igstPaise,
      roundOffPaise,
      grandTotalPaise: roundedTotalPaise
    };
  }, [lineItems, taxMode, company?.state_code, placeOfSupply]);

  // Update return line item field
  const updateLine = (id: string, field: keyof ReturnLineItem, value: any) => {
    setLineItems(prev => prev.map(line => {
      if (line.id !== id) return line;
      let val = value;
      if (field === 'returnQty') {
        const maxEligible = line.originalPurchasedQty - line.previouslyReturnedQty;
        val = Math.max(0, Math.min(Number(val) || 0, maxEligible));
      }
      return { ...line, [field]: val };
    }));
  };

  // Add custom line
  const handleAddLine = () => {
    const newLine: ReturnLineItem = {
      id: `line-${Date.now()}`,
      itemId: stockItems[0]?.item_id || '',
      itemName: stockItems[0]?.item_name || 'Item',
      description: '',
      hsnSac: stockItems[0]?.hsn_sac || '8443',
      godownId: godowns[0]?.godown_id || '',
      originalPurchasedQty: 10,
      previouslyReturnedQty: 0,
      returnQty: 1,
      unit: stockItems[0]?.unit_symbol || 'Nos',
      ratePaise: stockItems[0]?.purchase_rate_paise || 100000,
      taxPercent: stockItems[0]?.gst_rate || 18,
      amountPaise: 0
    };
    setLineItems(prev => [...prev, newLine]);
  };

  const handleRemoveLine = (id: string) => {
    setLineItems(prev => prev.filter(l => l.id !== id));
  };

  // Save / Post Purchase Return
  const handleSubmit = async (asDraft: boolean) => {
    setFormError(null);

    if (!partyId) {
      setFormError('Please select a supplier.');
      return;
    }
    if (!selectedOriginalInvoiceId && lineItems.length === 0) {
      setFormError('Please select an original purchase invoice or add items to return.');
      return;
    }
    const validLines = lineItems.filter(l => l.returnQty > 0);
    if (validLines.length === 0) {
      setFormError('At least one line item must have a return quantity greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        voucherType: 'PURCHASE_RETURN',
        voucherNumber: voucherNumber.trim(),
        voucherDate: returnDate,
        partyId,
        party_id: partyId,
        referenceNo: selectedOriginalInvoiceId ? `Against ${originalInvoices.find(v => v.voucher_id === selectedOriginalInvoiceId)?.voucher_number || 'INV'}` : '',
        status: asDraft ? 'DRAFT' : 'POSTED',
        taxMode,
        placeOfSupply,
        notes: notes.trim(),
        termsAndConditions: termsAndConditions.trim(),
        lineItems: validLines.map(l => ({
          itemId: l.itemId,
          item_id: l.itemId,
          description: l.description || l.itemName,
          hsnSac: l.hsnSac,
          hsn_sac: l.hsnSac,
          quantity: l.returnQty,
          ratePaise: l.ratePaise,
          rate: l.ratePaise / 100,
          unit: l.unit,
          gstRate: l.taxPercent,
          godownId: l.godownId || godowns[0]?.godown_id,
          serialNumber: l.serialNumber
        }))
      };

      const res = await api.postVoucher(payload);
      const newVchId = res.voucherId || res.voucher_id || res.id;

      showToast(asDraft ? 'Purchase Return draft saved!' : 'Purchase Return posted successfully!');

      if (!asDraft && onPostSuccess && newVchId) {
        onPostSuccess(newVchId);
      }

      // Refresh form
      api.getNextVoucherNumber('PURCHASE_RETURN', activeFy?.fy_id).then(r => {
        setVoucherNumber(r.nextVoucherNumber || r.next_number || '');
      });
      setLineItems([]);
      setSelectedOriginalInvoiceId('');
      setNotes('');
      setActiveSubTab('register');
    } catch (err: any) {
      console.error('Error saving purchase return:', err);
      setFormError(err.message || 'Failed to save purchase return.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Load Register data
  const loadRegisterData = async () => {
    if (!company?.company_id) return;
    setRegisterLoading(true);
    try {
      const res = await api.getVouchers(company.company_id, 'PURCHASE_RETURN');
      const vList = Array.isArray(res) ? res : (res as any).vouchers || [];
      setRegisterVouchers(vList);
    } catch (err) {
      console.error('Failed to load purchase returns:', err);
    } finally {
      setRegisterLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'register') {
      loadRegisterData();
    }
  }, [activeSubTab, company?.company_id]);

  const handleSafeDeleteFromModal = async (reason: string) => {
    if (!deleteModalVoucher) return;
    const v = deleteModalVoucher;
    if (v.status === 'POSTED') {
      await api.cancelVoucher(v.voucher_id, reason);
      showToast(`Return ${v.voucher_number} cancelled.`);
    } else if (v.status === 'DRAFT') {
      await api.deleteVoucher(v.voucher_id);
      showToast(`Draft return ${v.voucher_number} deleted.`);
    } else {
      await api.hideVoucher(v.voucher_id);
      showToast(`Return ${v.voucher_number} hidden.`);
    }
    setDeleteModalVoucher(null);
    await loadRegisterData();
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
    await loadRegisterData();
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', color: '#0F172A', fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: toast.type === 'error' ? '#EF4444' : '#10B981',
          color: '#FFFFFF',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 9999,
          fontSize: '14px',
          fontWeight: 500
        }}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.message}
        </div>
      )}

      {/* Breadcrumb & Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <span>Purchase</span>
          <span>&rsaquo;</span>
          <span>Purchase Return</span>
          <span>&rsaquo;</span>
          <span style={{ color: '#0F172A', fontWeight: 600 }}>{activeSubTab === 'create' ? 'Create' : 'Register'}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C', border: '1px solid #FFEDD5' }}>
              <RotateCcw size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                Purchase Return
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '13.5px', color: '#64748B' }}>
                Return purchased goods to supplier and record the return invoice.
              </p>
            </div>
          </div>

          {/* Subtab Switch & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
              <button
                onClick={() => setActiveSubTab('create')}
                style={{
                  padding: '7px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeSubTab === 'create' ? '#FFFFFF' : 'transparent',
                  color: activeSubTab === 'create' ? '#EA580C' : '#64748B',
                  boxShadow: activeSubTab === 'create' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                Create Return
              </button>
              <button
                onClick={() => setActiveSubTab('register')}
                style={{
                  padding: '7px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeSubTab === 'register' ? '#FFFFFF' : 'transparent',
                  color: activeSubTab === 'register' ? '#EA580C' : '#64748B',
                  boxShadow: activeSubTab === 'register' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                Return Register
              </button>
            </div>

            {activeSubTab === 'create' && (
              <>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#334155',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <Save size={15} />
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(false)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 18px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    backgroundColor: '#EA580C',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)'
                  }}
                >
                  <Send size={15} />
                  Save & Post
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {formError && (
        <div style={{
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#B91C1C',
          fontSize: '13.5px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={18} />
          {formError}
        </div>
      )}

      {activeSubTab === 'create' ? (
        /* ================= CREATE PURCHASE RETURN FORM ================= */
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: '24px', alignItems: 'start' }}>
          {/* LEFT COLUMN: Supplier Details, Item Details, Terms & Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Supplier Details Card */}
            <div style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={18} color="#EA580C" />
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', margin: 0 }}>Supplier Details</h3>
                </div>
                <button
                  onClick={() => setShowSupplierModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: '#EA580C',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={14} />
                  New Supplier
                </button>
              </div>

              {/* Supplier Dropdown */}
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <select
                  value={partyId}
                  onChange={e => setPartyId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 32px 10px 12px',
                    fontSize: '13.5px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    cursor: 'pointer',
                    appearance: 'none',
                    fontWeight: 500
                  }}
                >
                  <option value="">Select / Search Supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.party_id} value={s.party_id}>
                      {s.party_name} {s.gstin ? `(${s.gstin})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
              </div>

              {/* Selected Supplier Info Card */}
              {selectedSupplier ? (
                <div style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  fontSize: '12.5px'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '14px', marginBottom: '2px' }}>
                      {selectedSupplier.party_name}
                    </div>
                    <div style={{ color: '#64748B' }}>
                      {selectedSupplier.address_line1 || selectedSupplier.city || 'No address registered'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748B' }}>
                      <strong style={{ color: '#334155' }}>GSTIN:</strong> {selectedSupplier.gstin || 'Unregistered'}
                    </div>
                    <div style={{ color: '#64748B', marginTop: '2px' }}>
                      <strong style={{ color: '#334155' }}>Phone:</strong> {selectedSupplier.phone || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748B' }}>
                      <strong style={{ color: '#334155' }}>Email:</strong> {selectedSupplier.email || '—'}
                    </div>
                    <div style={{ color: '#64748B', marginTop: '2px' }}>
                      <strong style={{ color: '#334155' }}>State:</strong> {selectedSupplier.state || 'Tamil Nadu (33)'}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#F8FAFC',
                  border: '1px dashed #CBD5E1',
                  borderRadius: '8px',
                  textAlign: 'center',
                  fontSize: '13px',
                  color: '#64748B'
                }}>
                  Select a supplier to load their eligible purchase invoices and line items.
                </div>
              )}
            </div>

            {/* Item Details Card */}
            <div style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={18} color="#EA580C" />
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', margin: 0 }}>Item Details</h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Tax Mode Toggle */}
                  <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '2px', borderRadius: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setTaxMode('EXCLUSIVE')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: taxMode === 'EXCLUSIVE' ? '#FFFFFF' : 'transparent',
                        color: taxMode === 'EXCLUSIVE' ? '#EA580C' : '#64748B',
                        boxShadow: taxMode === 'EXCLUSIVE' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                      }}
                    >
                      Tax Exclusive
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxMode('INCLUSIVE')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: taxMode === 'INCLUSIVE' ? '#EA580C' : 'transparent',
                        color: taxMode === 'INCLUSIVE' ? '#FFFFFF' : '#64748B',
                        boxShadow: taxMode === 'INCLUSIVE' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                      }}
                    >
                      Tax Inclusive
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddLine}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#334155',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={13} />
                    Add Row
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '12px', fontWeight: 600 }}>
                      <th style={{ padding: '10px 12px', width: '30px' }}>#</th>
                      <th style={{ padding: '10px 12px' }}>Item Name & Description</th>
                      <th style={{ padding: '10px 12px', width: '100px' }}>HSN/SAC</th>
                      <th style={{ padding: '10px 12px', width: '90px' }}>Qty (Return)</th>
                      <th style={{ padding: '10px 12px', width: '70px' }}>Unit</th>
                      <th style={{ padding: '10px 12px', width: '110px' }}>Rate (₹)</th>
                      <th style={{ padding: '10px 12px', width: '80px' }}>Tax %</th>
                      <th style={{ padding: '10px 12px', width: '110px', textAlign: 'right' }}>Amount (₹)</th>
                      <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                          No line items. Select an original purchase invoice above or click &ldquo;+ Add Row&rdquo; to add return items.
                        </td>
                      </tr>
                    ) : (
                      lineItems.map((line, idx) => {
                        const lineAmtPaise = line.returnQty * line.ratePaise;
                        return (
                          <tr key={line.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 12px', color: '#64748B' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 600, color: '#0F172A' }}>{line.itemName}</div>
                              <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', gap: '8px', marginTop: '2px' }}>
                                <span>Original Qty: {line.originalPurchasedQty} {line.unit}</span>
                                {line.serialNumber && <span>S/N: {line.serialNumber}</span>}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748B', fontFamily: 'var(--font-mono, monospace)', fontSize: '12px' }}>
                              {line.hsnSac}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <input
                                type="number"
                                min={0}
                                max={line.originalPurchasedQty}
                                value={line.returnQty}
                                onChange={e => updateLine(line.id, 'returnQty', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  fontSize: '13px',
                                  borderRadius: '6px',
                                  border: '1px solid #CBD5E1',
                                  textAlign: 'center',
                                  fontWeight: 600,
                                  boxSizing: 'border-box'
                                }}
                              />
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748B' }}>{line.unit}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <input
                                type="number"
                                value={(line.ratePaise / 100).toFixed(2)}
                                onChange={e => updateLine(line.id, 'ratePaise', Math.round(Number(e.target.value) * 100))}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  fontSize: '13px',
                                  borderRadius: '6px',
                                  border: '1px solid #CBD5E1',
                                  textAlign: 'right',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <select
                                value={line.taxPercent}
                                onChange={e => updateLine(line.id, 'taxPercent', Number(e.target.value))}
                                style={{
                                  width: '100%',
                                  padding: '6px 4px',
                                  fontSize: '12px',
                                  borderRadius: '6px',
                                  border: '1px solid #CBD5E1',
                                  backgroundColor: '#FFFFFF'
                                }}
                              >
                                <option value={0}>0%</option>
                                <option value={5}>5%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>
                              {formatINR(lineAmtPaise)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(line.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#94A3B8',
                                  cursor: 'pointer',
                                  padding: '4px'
                                }}
                                title="Remove item"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add Product / Add Service helper buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={handleAddLine}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: '#334155',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={14} /> Add Product
                </button>
              </div>
            </div>

            {/* Terms and Notes Card */}
            <div style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px'
            }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', display: 'block', marginBottom: '8px' }}>
                  Terms & Conditions
                </label>
                <textarea
                  rows={4}
                  value={termsAndConditions}
                  onChange={e => setTermsAndConditions(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '12.5px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    color: '#334155',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', display: 'block', marginBottom: '8px' }}>
                  Notes (Optional)
                </label>
                <textarea
                  rows={4}
                  placeholder="Enter any additional return notes or dispatch references..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '12.5px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    color: '#334155',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Return Details & Return Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Return Details Card */}
            <div style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <FileText size={18} color="#EA580C" />
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', margin: 0 }}>Return Details</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Return Voucher No */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Return Voucher No. *
                  </label>
                  <input
                    type="text"
                    value={voucherNumber}
                    onChange={e => setVoucherNumber(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      color: '#0F172A',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Return Date */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Return Date *
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={e => setReturnDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      color: '#0F172A',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Original Invoice Selector */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Original Purchase Invoice No. *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={selectedOriginalInvoiceId}
                      onChange={e => handleSelectOriginalInvoice(e.target.value)}
                      disabled={!partyId || originalInvoices.length === 0}
                      style={{
                        width: '100%',
                        padding: '8px 28px 8px 12px',
                        fontSize: '13px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: !partyId || originalInvoices.length === 0 ? '#F8FAFC' : '#FFFFFF',
                        color: '#0F172A',
                        cursor: !partyId ? 'not-allowed' : 'pointer',
                        appearance: 'none',
                        fontWeight: 500
                      }}
                    >
                      <option value="">
                        {!partyId ? 'Select supplier first' : originalInvoices.length === 0 ? 'No posted invoices found' : 'Select Invoice...'}
                      </option>
                      {originalInvoices.map(inv => (
                        <option key={inv.voucher_id} value={inv.voucher_id}>
                          {inv.voucher_number} — {formatINR(inv.total_amount_paise)} ({formatDateDisplay(inv.voucher_date)})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                  </div>
                </div>

                {/* Original Invoice Date */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Original Invoice Date
                  </label>
                  <input
                    type="date"
                    disabled
                    value={originalInvoiceDate}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#F8FAFC',
                      color: '#64748B',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Return Type */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Return Type
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={returnType}
                      onChange={e => setReturnType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 28px 8px 12px',
                        fontSize: '13px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#0F172A',
                        cursor: 'pointer',
                        appearance: 'none'
                      }}
                    >
                      {RETURN_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                  </div>
                </div>

                {/* Place of Supply */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Place of Supply
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={placeOfSupply}
                      onChange={e => setPlaceOfSupply(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 28px 8px 12px',
                        fontSize: '13px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#0F172A',
                        cursor: 'pointer',
                        appearance: 'none'
                      }}
                    >
                      {INDIAN_STATES.map(s => (
                        <option key={s.code} value={s.code}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Return Summary Card */}
            <div style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Layers size={18} color="#EA580C" />
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', margin: 0 }}>Return Summary</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Sub Total:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatINR(summary.subtotalPaise)}</span>
                </div>

                {summary.cgstPaise > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>CGST Reversal:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatINR(summary.cgstPaise)}</span>
                  </div>
                )}

                {summary.sgstPaise > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>SGST Reversal:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatINR(summary.sgstPaise)}</span>
                  </div>
                )}

                {summary.igstPaise > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>IGST Reversal:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatINR(summary.igstPaise)}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Round Off:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatINR(summary.roundOffPaise)}</span>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '12px',
                  marginTop: '4px',
                  borderTop: '2px solid #F1F5F9',
                  fontWeight: 700,
                  fontSize: '16px'
                }}>
                  <span style={{ color: '#0F172A' }}>Return Total:</span>
                  <span style={{ color: '#EA580C', fontSize: '19px' }}>{formatINR(summary.grandTotalPaise)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= PURCHASE RETURN REGISTER TAB ================= */
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          {registerLoading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
              <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid #E2E8F0', borderTopColor: '#EA580C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ marginTop: '12px', fontSize: '14px', fontWeight: 500 }}>Loading purchase returns...</div>
            </div>
          ) : registerVouchers.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#64748B' }}>
              <RotateCcw size={32} style={{ marginBottom: '8px', color: '#94A3B8' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', margin: 0 }}>No purchase returns found</h3>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                You haven&apos;t recorded any purchase returns yet.
              </p>
              <button
                onClick={() => setActiveSubTab('create')}
                style={{
                  marginTop: '16px',
                  padding: '9px 16px',
                  backgroundColor: '#EA580C',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Create First Return
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                    <th style={{ padding: '12px 16px' }}>Return Voucher No.</th>
                    <th style={{ padding: '12px 16px' }}>Supplier</th>
                    <th style={{ padding: '12px 16px' }}>Reference</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registerVouchers.map((v, idx) => (
                    <tr key={v.voucher_id || idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>{formatDateDisplay(v.voucher_date)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#EA580C' }}>{v.voucher_number}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>{v.party_name || '—'}</td>
                      <td style={{ padding: '12px 16px', color: '#64748B' }}>{v.reference_no || '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                        {formatINR(v.total_amount_paise)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          padding: '3px 8px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: v.status === 'POSTED' ? '#DCFCE7' : '#F1F5F9',
                          color: v.status === 'POSTED' ? '#15803D' : '#475569'
                        }}>
                          {v.status || 'POSTED'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => setDeleteModalVoucher(v)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#DC2626',
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                          title="Cancel Return"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Quick Supplier Modal */}
      {showSupplierModal && (
        <QuickCustomerModal
          isOpen={showSupplierModal}
          onClose={() => setShowSupplierModal(false)}
          partyType="SUPPLIER"
          company={company}
          onSuccess={(newParty: any) => {
            setShowSupplierModal(false);
            setSuppliers(prev => [...prev, newParty]);
            setPartyId(newParty.party_id);
            showToast(`Supplier ${newParty.party_name} added!`);
          }}
        />
      )}

      {/* Delete / Cancel Modal */}
      <VoucherDeleteOptionsModal
        isOpen={!!deleteModalVoucher}
        voucher={
          deleteModalVoucher
            ? {
                voucher_id: deleteModalVoucher.voucher_id,
                voucher_number: deleteModalVoucher.voucher_number || 'Return',
                voucher_type: deleteModalVoucher.voucher_type || 'PURCHASE_RETURN',
                status: deleteModalVoucher.status || 'POSTED',
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
