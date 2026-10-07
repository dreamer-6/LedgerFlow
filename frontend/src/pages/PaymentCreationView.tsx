/**
 * PaymentCreationView — UI-008: New Payment Creation
 *
 * Implements the New Payment Creation form matching the visual source of truth mockups:
 * - Payment Details: Auto-sequenced Payment No. (GET /vouchers/next-number?type=PAYMENT), Date, Ref No., Ref Date, Narration.
 * - Payment Type: Purchase / Expense / Other.
 * - Conditional Accounting UI:
 *     - WHEN PURCHASE: Supplier * (searchable, details card, inline + New Supplier modal), Against Ledger * (Sundry Creditors), Purchase Invoice Allocation table with selection & adjustment capping.
 *     - WHEN EXPENSE: Expense Ledger * (Indirect/Direct Expense dropdown/search), Party optional. (Supplier NOT mandatory, no invoice allocation).
 *     - WHEN OTHER: Ledger * (All Ledgers dropdown/search), Party optional.
 * - Payment Source & Mode: Paid From * (Cash/Bank), Payment Mode * (Bank Transfer, Cash, Cheque, UPI, NEFT, RTGS), Amount *.
 * - Summary: Allocation Summary (Payment Amount, Total Adjusted, Unallocated / Advance), Additional Notes.
 * - Lifecycle: Save as Draft (0 accounting/allocation impact), Save & Post (atomic DR Supplier/Expense/Ledger, CR Bank/Cash).
 */

import React, { useEffect, useState, useMemo } from 'react';
import { api, Company, FinancialYear, Party } from '../api/client';
import { InvoicePrintModal } from './InvoicePrintModal';
import {
  ArrowLeft,
  Search,
  Plus,
  X,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building2,
  Wallet,
  Landmark,
  Eye,
  Save,
  Send,
  Truck,
  Receipt,
  Layers,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';

export interface PaymentCreationViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  currentDate?: string;
  onBack: () => void;
  onPostSuccess?: (voucherId: string) => void;
}

type PaymentType = 'PURCHASE' | 'EXPENSE' | 'OTHER';

interface PurchaseInvoiceRow {
  voucherId: string;
  voucherNumber: string;
  voucherDate: string;
  totalAmountPaise: number;
  pendingAmountPaise: number;
  allocatedAmountPaise: number;
  dueDate?: string;
}

export const PaymentCreationView: React.FC<PaymentCreationViewProps> = ({
  company,
  activeFy,
  currentDate,
  onBack,
  onPostSuccess
}) => {
  // Master lists
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [allParties, setAllParties] = useState<Party[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [mastersLoading, setMastersLoading] = useState(true);

  // Voucher Details
  const [voucherNumber, setVoucherNumber] = useState('');
  const [voucherDate, setVoucherDate] = useState(() => currentDate || new Date().toISOString().split('T')[0]);
  const [referenceNo, setReferenceNo] = useState('');
  const [referenceDate, setReferenceDate] = useState('');
  const [narration, setNarration] = useState('');
  const [remarks, setRemarks] = useState('');

  // Payment Type
  const [paymentType, setPaymentType] = useState<PaymentType>('PURCHASE');

  // Supplier & Ledger Selection (when Purchase)
  const [supplierId, setSupplierId] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [againstLedgerId, setAgainstLedgerId] = useState('');
  const [supplierOutstandingPaise, setSupplierOutstandingPaise] = useState(0);

  // Expense/Other selection
  const [expenseLedgerId, setExpenseLedgerId] = useState('');
  const [otherLedgerId, setOtherLedgerId] = useState('');
  const [optionalPartyId, setOptionalPartyId] = useState('');

  // Source & Mode
  const [paidFromLedgerId, setPaidFromLedgerId] = useState('');
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [paymentAmount, setPaymentAmount] = useState<string>('');

  // Purchase Invoice Allocation State
  const [unpaidBills, setUnpaidBills] = useState<PurchaseInvoiceRow[]>([]);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [billAllocations, setBillAllocations] = useState<{ [id: string]: number }>({});
  const [isOnAccount, setIsOnAccount] = useState(false);

  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [printPaymentVoucherId, setPrintPaymentVoucherId] = useState<string | null>(null);
  const [printAfterSaving, setPrintAfterSaving] = useState(false);

  // New Supplier Modal
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [newSuppName, setNewSuppName] = useState('');
  const [newSuppPhone, setNewSuppPhone] = useState('');
  const [newSuppGstin, setNewSuppGstin] = useState('');
  const [newSuppAddress, setNewSuppAddress] = useState('');
  const [isCreatingSupp, setIsCreatingSupp] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch Masters & Next Number
  useEffect(() => {
    if (!company) return;
    const fetchMasters = async () => {
      setMastersLoading(true);
      try {
        const [suppList, allPList, ledgerList, nextNumData, pinvList] = await Promise.all([
          api.getParties('SUPPLIER'),
          api.getParties().catch(() => []),
          api.getLedgers(),
          api.getNextVoucherNumber(company.company_id, activeFy?.fy_id || '', 'PAYMENT').catch(() => ({ next_number: 'PMT-0001' })),
          api.getPurchaseVouchers().catch(() => [])
        ]);

        setSuppliers(Array.isArray(suppList) ? suppList : []);
        setAllParties(Array.isArray(allPList) ? allPList : []);
        setPurchaseInvoices(Array.isArray(pinvList) ? pinvList : []);

        const validLedgers = Array.isArray(ledgerList) ? ledgerList : [];
        setLedgers(validLedgers);

        if (nextNumData && nextNumData.next_number) {
          setVoucherNumber(nextNumData.next_number);
        }

        // Set default Paid From (Bank account or first Cash account)
        const bankOrCash = validLedgers.find(l => {
          const gn = (l.group_name || '').toLowerCase();
          const ln = (l.ledger_name || '').toLowerCase();
          return gn.includes('bank') || gn.includes('cash') || ln.includes('bank') || ln.includes('cash');
        });
        if (bankOrCash) {
          setPaidFromLedgerId(bankOrCash.ledger_id);
        }

        // Set default expense ledger if available
        const expLedger = validLedgers.find(l => {
          const gn = (l.group_name || '').toLowerCase();
          return gn.includes('expense');
        });
        if (expLedger) {
          setExpenseLedgerId(expLedger.ledger_id);
        }
      } catch (err) {
        console.error('Failed to load payment masters:', err);
        setError('Failed to load masters from server.');
      } finally {
        setMastersLoading(false);
      }
    };

    fetchMasters();
  }, [company]);

  // Cash / Bank ledgers for "Paid From"
  const cashBankLedgers = useMemo(() => {
    return ledgers.filter(l => {
      const gn = (l.group_name || '').toLowerCase();
      const ln = (l.ledger_name || '').toLowerCase();
      return gn.includes('bank') || gn.includes('cash') || ln.includes('bank') || ln.includes('cash');
    });
  }, [ledgers]);

  // Expense ledgers
  const expenseLedgers = useMemo(() => {
    return ledgers.filter(l => {
      const gn = (l.group_name || '').toLowerCase();
      const ln = (l.ledger_name || '').toLowerCase();
      return gn.includes('expense') || ln.includes('expense') || ln.includes('rent') || ln.includes('salary');
    });
  }, [ledgers]);

  // Selected supplier details
  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.party_id === supplierId);
  }, [suppliers, supplierId]);

  // On Supplier change, fetch outstanding and unpaid purchase invoices
  useEffect(() => {
    if (!supplierId || !company) {
      setAgainstLedgerId('');
      setSupplierOutstandingPaise(0);
      setUnpaidBills([]);
      setSelectedBillIds([]);
      setBillAllocations({});
      return;
    }

    const supp = suppliers.find(s => s.party_id === supplierId);
    if (supp) {
      setSupplierSearch(supp.party_name);
      if (supp.ledger_id) {
        setAgainstLedgerId(supp.ledger_id);
      } else {
        const credLedger = ledgers.find(l => (l.group_name || '').toLowerCase().includes('creditor'));
        if (credLedger) setAgainstLedgerId(credLedger.ledger_id);
      }
    }

    // Fetch supplier outstanding
    api.getOutstanding(company.company_id, 'SUPPLIER')
      .then((outList: any[]) => {
        if (Array.isArray(outList)) {
          const suppOut = outList.find(o => o.partyId === supplierId || o.party_id === supplierId);
          if (suppOut) {
            setSupplierOutstandingPaise(suppOut.totalOutstandingPaise || suppOut.outstanding_paise || 0);
          } else {
            setSupplierOutstandingPaise(supp?.current_balance_paise || 0);
          }
        }
      })
      .catch(() => {
        setSupplierOutstandingPaise(supp?.current_balance_paise || 0);
      });

    // Filter posted purchase invoices for this supplier
    const suppInvoices = purchaseInvoices.filter(v => {
      return (v.party_id === supplierId || v.partyName === supp?.party_name) && v.status === 'POSTED';
    });

    const bills: PurchaseInvoiceRow[] = suppInvoices.map((inv: any) => {
      const tot = Number(inv.total_amount_paise) || 0;
      return {
        voucherId: inv.voucher_id,
        voucherNumber: inv.voucher_number || 'PINV-0000',
        voucherDate: inv.voucher_date || '',
        totalAmountPaise: tot,
        pendingAmountPaise: tot,
        allocatedAmountPaise: 0,
        dueDate: inv.due_date
      };
    });

    setUnpaidBills(bills);
    setSelectedBillIds([]);
    setBillAllocations({});
  }, [supplierId, company, suppliers, ledgers, purchaseInvoices]);

  // Parse entered payment amount in paise
  const paymentAmountPaise = useMemo(() => {
    const val = parseFloat(paymentAmount);
    return isNaN(val) || val <= 0 ? 0 : Math.round(val * 100);
  }, [paymentAmount]);

  // Calculate Total Allocated & Unallocated
  const totalAllocatedPaise = useMemo(() => {
    if (paymentType !== 'PURCHASE') return paymentAmountPaise;
    return Object.values(billAllocations).reduce((acc, v) => acc + (v || 0), 0);
  }, [billAllocations, paymentType, paymentAmountPaise]);

  const unallocatedAmountPaise = useMemo(() => {
    return Math.max(0, paymentAmountPaise - totalAllocatedPaise);
  }, [paymentAmountPaise, totalAllocatedPaise]);

  // Toggle invoice selection
  const handleToggleBillSelect = (bill: PurchaseInvoiceRow) => {
    const isSelected = selectedBillIds.includes(bill.voucherId);
    if (isSelected) {
      setSelectedBillIds(prev => prev.filter(id => id !== bill.voucherId));
      setBillAllocations(prev => {
        const next = { ...prev };
        delete next[bill.voucherId];
        return next;
      });
    } else {
      setSelectedBillIds(prev => [...prev, bill.voucherId]);
      const currentlyAllocated = Object.entries(billAllocations)
        .filter(([id]) => id !== bill.voucherId)
        .reduce((sum, [, v]) => sum + (v || 0), 0);
      const remainingPmt = Math.max(0, paymentAmountPaise - currentlyAllocated);
      const toAllocate = Math.min(bill.pendingAmountPaise, remainingPmt > 0 ? remainingPmt : bill.pendingAmountPaise);

      setBillAllocations(prev => ({
        ...prev,
        [bill.voucherId]: toAllocate
      }));
    }
  };

  // Update allocation for a specific invoice
  const handleAllocationChange = (billId: string, valStr: string) => {
    const bill = unpaidBills.find(b => b.voucherId === billId);
    if (!bill) return;

    const val = parseFloat(valStr);
    const paise = isNaN(val) || val < 0 ? 0 : Math.round(val * 100);

    const otherAllocations = Object.entries(billAllocations)
      .filter(([id]) => id !== billId)
      .reduce((sum, [, v]) => sum + (v || 0), 0);

    const maxAllowedFromPmt = paymentAmountPaise > 0 ? paymentAmountPaise - otherAllocations : bill.pendingAmountPaise;
    const capped = Math.min(paise, bill.pendingAmountPaise, Math.max(0, maxAllowedFromPmt));

    setBillAllocations(prev => ({
      ...prev,
      [billId]: capped
    }));

    if (!selectedBillIds.includes(billId)) {
      setSelectedBillIds(prev => [...prev, billId]);
    }
  };

  // Currency Formatter
  const formatINR = (paise: number) => {
    return '₹ ' + (paise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Create Supplier Inline
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuppName.trim()) return;
    setIsCreatingSupp(true);
    try {
      const payload: any = {
        partyType: 'SUPPLIER',
        partyName: newSuppName.trim(),
        phone: newSuppPhone.trim() || undefined,
        gstin: newSuppGstin.trim().toUpperCase() || undefined,
        addressLine1: newSuppAddress.trim() || undefined,
        creditPeriodDays: 30
      };
      const newParty = await api.createParty(payload);
      const freshList = await api.getParties('SUPPLIER');
      setSuppliers(freshList);
      setSupplierId(newParty.party_id);
      setSupplierSearch(newParty.party_name);
      setShowNewSupplierModal(false);
      setNewSuppName('');
      setNewSuppPhone('');
      setNewSuppGstin('');
      setNewSuppAddress('');
      showToast(`Supplier "${newParty.party_name}" created successfully.`);
    } catch (err: any) {
      console.error('Failed to create supplier:', err);
      setError(err.message || 'Failed to create supplier.');
    } finally {
      setIsCreatingSupp(false);
    }
  };

  // Submit Payment Voucher
  const handleSavePayment = async (asDraft: boolean) => {
    if (paymentAmountPaise <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }
    if (!paidFromLedgerId) {
      setError('Please select a Cash or Bank account in Paid From.');
      return;
    }

    let debitLedgerId = '';
    let partyIdToUse: string | undefined = undefined;
    let againstPartyName = '';

    if (paymentType === 'PURCHASE') {
      if (!supplierId) {
        setError('Please select a Supplier for purchase payment.');
        return;
      }
      debitLedgerId = againstLedgerId || selectedSupplier?.ledger_id || '';
      if (!debitLedgerId) {
        setError('Supplier does not have an attached ledger.');
        return;
      }
      partyIdToUse = supplierId;
      againstPartyName = selectedSupplier?.party_name || 'Supplier';
    } else if (paymentType === 'EXPENSE') {
      if (!expenseLedgerId) {
        setError('Please select an Expense Ledger account.');
        return;
      }
      debitLedgerId = expenseLedgerId;
      partyIdToUse = optionalPartyId || undefined;
      const expLedger = ledgers.find(l => l.ledger_id === expenseLedgerId);
      againstPartyName = expLedger?.ledger_name || 'Expense';
    } else {
      if (!otherLedgerId) {
        setError('Please select a Ledger account.');
        return;
      }
      debitLedgerId = otherLedgerId;
      partyIdToUse = optionalPartyId || undefined;
      const othLedger = ledgers.find(l => l.ledger_id === otherLedgerId);
      againstPartyName = othLedger?.ledger_name || 'Account';
    }

    setIsSaving(true);
    setError(null);

    try {
      const bankCashLedger = ledgers.find(l => l.ledger_id === paidFromLedgerId);
      const bankCashName = bankCashLedger?.ledger_name || 'Bank/Cash';

      // Assemble Balanced Double-Entry customLedgerLines
      // DR Supplier/Expense/Other, CR Bank/Cash
      const customLedgerLines = [
        {
          ledgerId: debitLedgerId,
          debitPaise: paymentAmountPaise,
          creditPaise: 0,
          particulars: `Payment to ${againstPartyName}`
        },
        {
          ledgerId: paidFromLedgerId,
          debitPaise: 0,
          creditPaise: paymentAmountPaise,
          particulars: `Paid from ${bankCashName}`
        }
      ];

      // Bill Allocation (for Purchase only)
      let billAllocation: any = undefined;
      if (paymentType === 'PURCHASE') {
        const firstSelectedBill = unpaidBills.find(b => selectedBillIds.includes(b.voucherId));
        if (firstSelectedBill) {
          billAllocation = {
            referenceVoucherId: firstSelectedBill.voucherId,
            allocationType: 'AGAINST_REF',
            dueDate: firstSelectedBill.dueDate
          };
        } else {
          billAllocation = {
            allocationType: isOnAccount ? 'ADVANCE' : 'ON_ACCOUNT'
          };
        }
      }

      // Add tag to narration for unambiguous classification
      const typeTag = `[type:${paymentType.toLowerCase()}]`;
      const baseNarration = narration.trim() || remarks.trim() || `Payment to ${againstPartyName}`;
      const finalNarration = baseNarration.includes(typeTag) ? baseNarration : `${baseNarration} ${typeTag}`;

      const payload: any = {
        voucherType: 'PAYMENT',
        paymentType,
        voucherDate,
        voucherNumber: voucherNumber || undefined,
        partyId: partyIdToUse,
        status: asDraft ? 'DRAFT' : 'POSTED',
        referenceNo: referenceNo.trim() || undefined,
        referenceDate: referenceDate || undefined,
        paymentMode,
        narration: finalNarration,
        customLedgerLines,
        billAllocation,
        lines: []
      };

      const res = await api.postVoucher(payload);
      const savedVoucherId = res.voucherId || res.voucher_id;

      if (asDraft) {
        showToast('Payment voucher saved as DRAFT successfully.');
        onBack();
      } else {
        showToast(`Payment voucher ${res.voucherNumber || voucherNumber} posted successfully.`);
        if (printAfterSaving && savedVoucherId) {
          setPrintPaymentVoucherId(savedVoucherId);
        } else {
          onPostSuccess ? onPostSuccess(savedVoucherId) : onBack();
        }
      }
    } catch (err: any) {
      console.error('Failed to post payment:', err);
      setError(err.message || 'Failed to record payment voucher.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          background: 'var(--surface-elevated, #1D1D1D)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '12px 20px', boxShadow: 'var(--modal-shadow)',
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600,
          color: 'var(--text-primary)'
        }}>
          <CheckCircle2 size={16} color="#10B981" />
          {toast}
        </div>
      )}

      {/* Top Header & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            <span style={{ cursor: 'pointer' }} onClick={onBack}>Payments</span>
            <span>&gt;</span>
            <span style={{ color: '#FF641F', fontWeight: 600 }}>New Payment</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            New Payment
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Record money paid to a supplier, expense, or other party.
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border, #292929)',
              background: 'transparent', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSavePayment(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border, #292929)',
              background: 'var(--surface-inner, #191919)', color: 'var(--text-primary)',
              fontSize: '13px', fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer'
            }}
          >
            <Save size={15} />
            Save as Draft
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSavePayment(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '9px 20px', borderRadius: '8px', border: 'none',
              background: '#FF641F', color: '#FFFFFF',
              fontSize: '13px', fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(255, 100, 31, 0.25)'
            }}
          >
            <Send size={15} />
            {isSaving ? 'Posting...' : 'Save & Post'}
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444',
          color: '#EF4444', padding: '12px 16px', borderRadius: '8px',
          fontSize: '13px', marginBottom: '20px'
        }}>
          <AlertCircle size={18} />
          <div style={{ flex: 1 }}>{error}</div>
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top 3 Columns Grid: Payment Details | Payment Type | Conditional Party Details */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Card 1: Payment Details */}
        <div style={{
          background: 'var(--surface-card, #151515)',
          border: '1px solid var(--border, #292929)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 600, fontSize: '14px' }}>
            <span style={{ color: '#FF641F' }}>📄</span> Payment Details
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Payment No.
              </label>
              <input
                type="text"
                value={voucherNumber || 'Auto (PMT-XXXX)'}
                readOnly
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                  borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-secondary)',
                  outline: 'none', cursor: 'not-allowed'
                }}
              />
              <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                Auto-generated
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Date <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="date"
                value={voucherDate}
                onChange={e => setVoucherDate(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                  borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Reference No. (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Cheque No., UTR No."
                value={referenceNo}
                onChange={e => setReferenceNo(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                  borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Reference Date (Optional)
              </label>
              <input
                type="date"
                value={referenceDate}
                onChange={e => setReferenceDate(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                  borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
              Narration (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Payment made to supplier/account..."
              value={narration}
              onChange={e => setNarration(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                outline: 'none', resize: 'vertical'
              }}
            />
          </div>
        </div>

        {/* Card 2: Payment Type Selection */}
        <div style={{
          background: 'var(--surface-card, #151515)',
          border: '1px solid var(--border, #292929)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 600, fontSize: '14px' }}>
            <span style={{ color: '#FF641F' }}>🔘</span> Payment Type
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Purchase Radio */}
            <div
              onClick={() => setPaymentType('PURCHASE')}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '12px', borderRadius: '8px', cursor: 'pointer',
                border: paymentType === 'PURCHASE' ? '1px solid #FF641F' : '1px solid var(--border, #292929)',
                background: paymentType === 'PURCHASE' ? 'rgba(255, 100, 31, 0.08)' : 'var(--surface-inner, #191919)',
                transition: 'all 0.15s ease'
              }}
            >
              <input
                type="radio"
                name="paymentType"
                checked={paymentType === 'PURCHASE'}
                onChange={() => setPaymentType('PURCHASE')}
                style={{ marginTop: '3px', accentColor: '#FF641F', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Purchase
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Payment to a supplier for purchase invoices.
                </div>
              </div>
            </div>

            {/* Expense Radio */}
            <div
              onClick={() => setPaymentType('EXPENSE')}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '12px', borderRadius: '8px', cursor: 'pointer',
                border: paymentType === 'EXPENSE' ? '1px solid #FF641F' : '1px solid var(--border, #292929)',
                background: paymentType === 'EXPENSE' ? 'rgba(255, 100, 31, 0.08)' : 'var(--surface-inner, #191919)',
                transition: 'all 0.15s ease'
              }}
            >
              <input
                type="radio"
                name="paymentType"
                checked={paymentType === 'EXPENSE'}
                onChange={() => setPaymentType('EXPENSE')}
                style={{ marginTop: '3px', accentColor: '#FF641F', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Expense
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Payment for business expense (e.g., Rent, Salary).
                </div>
              </div>
            </div>

            {/* Other Radio */}
            <div
              onClick={() => setPaymentType('OTHER')}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '12px', borderRadius: '8px', cursor: 'pointer',
                border: paymentType === 'OTHER' ? '1px solid #FF641F' : '1px solid var(--border, #292929)',
                background: paymentType === 'OTHER' ? 'rgba(255, 100, 31, 0.08)' : 'var(--surface-inner, #191919)',
                transition: 'all 0.15s ease'
              }}
            >
              <input
                type="radio"
                name="paymentType"
                checked={paymentType === 'OTHER'}
                onChange={() => setPaymentType('OTHER')}
                style={{ marginTop: '3px', accentColor: '#FF641F', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Other
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Payment to other parties or ledger accounts.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Conditional Details (Supplier or Expense/Ledger) */}
        <div style={{
          background: 'var(--surface-card, #151515)',
          border: '1px solid var(--border, #292929)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          {paymentType === 'PURCHASE' ? (
            /* Supplier Details */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px' }}>
                  <Building2 size={16} color="#FF641F" /> Supplier Details
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewSupplierModal(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: 'transparent', border: 'none', color: '#FF641F',
                    fontSize: '12.5px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  <Plus size={14} /> New Supplier
                </button>
              </div>

              {/* Supplier Search Dropdown */}
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Supplier <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                  borderRadius: '6px', padding: '0 8px'
                }}>
                  <input
                    type="text"
                    placeholder="Search supplier by name or GSTIN..."
                    value={supplierSearch}
                    onChange={e => {
                      setSupplierSearch(e.target.value);
                      setIsSupplierDropdownOpen(true);
                    }}
                    onFocus={() => setIsSupplierDropdownOpen(true)}
                    style={{
                      width: '100%', background: 'transparent', border: 'none',
                      padding: '8px 0', fontSize: '13px', color: 'var(--text-primary)', outline: 'none'
                    }}
                  />
                  {supplierId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSupplierId('');
                        setSupplierSearch('');
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                  <ChevronDown size={14} color="var(--text-secondary)" />
                </div>

                {isSupplierDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--surface-elevated, #1D1D1D)', border: '1px solid var(--border, #292929)',
                    borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', marginTop: '4px',
                    boxShadow: 'var(--modal-shadow)'
                  }}>
                    {suppliers
                      .filter(s => s.party_name.toLowerCase().includes(supplierSearch.toLowerCase()))
                      .map(s => (
                        <div
                          key={s.party_id}
                          onClick={() => {
                            setSupplierId(s.party_id);
                            setSupplierSearch(s.party_name);
                            setIsSupplierDropdownOpen(false);
                          }}
                          style={{
                            padding: '8px 12px', cursor: 'pointer', fontSize: '12.5px',
                            borderBottom: '1px solid var(--border, #292929)',
                            display: 'flex', justifyContent: 'space-between'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-inner, #191919)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.party_name}</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>{s.gstin || s.phone || ''}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Selected Supplier Details Panel */}
              {selectedSupplier ? (
                <div style={{
                  background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                  borderRadius: '8px', padding: '12px', fontSize: '12px', color: 'var(--text-secondary)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                      {selectedSupplier.party_name}
                    </span>
                    <span style={{
                      background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6',
                      padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600
                    }}>
                      Supplier
                    </span>
                  </div>
                  {(selectedSupplier.address_line1 || selectedSupplier.city) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <MapPin size={12} /> {[selectedSupplier.address_line1, selectedSupplier.city, selectedSupplier.state].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {selectedSupplier.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Phone size={12} /> {selectedSupplier.phone}
                    </div>
                  )}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
                    marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border, #292929)'
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>GSTIN: </span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedSupplier.gstin || '-'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Outstanding: </span>
                      <span style={{ color: '#EF4444', fontWeight: 600 }}>{formatINR(supplierOutstandingPaise)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '24px', textAlign: 'center', border: '1px dashed var(--border, #292929)',
                  borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '12.5px'
                }}>
                  Select a supplier to view details and pending invoices
                </div>
              )}
            </div>
          ) : paymentType === 'EXPENSE' ? (
            /* Expense Details */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 600, fontSize: '14px' }}>
                <Receipt size={16} color="#FF641F" /> Expense Details
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Expense Ledger <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={expenseLedgerId}
                  onChange={e => setExpenseLedgerId(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                    borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                    outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="">-- Select Expense Ledger --</option>
                  {expenseLedgers.map(l => (
                    <option key={l.ledger_id} value={l.ledger_id}>
                      {l.ledger_name} ({l.group_name || 'Expenses'})
                    </option>
                  ))}
                  {/* Fallback all ledgers if not found */}
                  {ledgers.filter(l => !expenseLedgers.includes(l)).map(l => (
                    <option key={l.ledger_id} value={l.ledger_id}>
                      {l.ledger_name} ({l.group_name || 'General'})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Expense will be debited to this account.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Party (Optional)
                </label>
                <select
                  value={optionalPartyId}
                  onChange={e => setOptionalPartyId(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                    borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                    outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="">-- None / Direct Expense --</option>
                  {allParties.map(p => (
                    <option key={p.party_id} value={p.party_id}>
                      {p.party_name} ({p.party_type})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            /* Other Details */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 600, fontSize: '14px' }}>
                <Layers size={16} color="#FF641F" /> Ledger Details
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Ledger Account <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={otherLedgerId}
                  onChange={e => setOtherLedgerId(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                    borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                    outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="">-- Select Ledger Account --</option>
                  {ledgers.map(l => (
                    <option key={l.ledger_id} value={l.ledger_id}>
                      {l.ledger_name} ({l.group_name || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Party (Optional)
                </label>
                <select
                  value={optionalPartyId}
                  onChange={e => setOptionalPartyId(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                    borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                    outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="">-- None --</option>
                  {allParties.map(p => (
                    <option key={p.party_id} value={p.party_id}>
                      {p.party_name} ({p.party_type})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Source & Mode Card */}
      <div style={{
        background: 'var(--surface-card, #151515)',
        border: '1px solid var(--border, #292929)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 600, fontSize: '14px' }}>
          <Wallet size={16} color="#FF641F" /> Payment Source & Mode
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Paid From */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
              Paid From <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              value={paidFromLedgerId}
              onChange={e => setPaidFromLedgerId(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="">-- Select Cash/Bank Ledger --</option>
              {cashBankLedgers.map(l => (
                <option key={l.ledger_id} value={l.ledger_id}>
                  {l.ledger_name} ({l.group_name || 'Bank/Cash'})
                </option>
              ))}
              {/* Fallback to all ledgers if empty */}
              {cashBankLedgers.length === 0 && ledgers.map(l => (
                <option key={l.ledger_id} value={l.ledger_id}>{l.ledger_name}</option>
              ))}
            </select>
          </div>

          {/* Payment Mode */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
              Payment Mode <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              value={paymentMode}
              onChange={e => setPaymentMode(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>

          {/* Amount */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
              Amount (₹) <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{
              display: 'flex', alignItems: 'center',
              background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
              borderRadius: '6px', padding: '0 10px'
            }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px', marginRight: '6px' }}>₹</span>
              <input
                id="payment-amount-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  padding: '8px 0', fontSize: '14px', fontWeight: 600,
                  color: 'var(--text-primary)', outline: 'none'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Allocation Section (FOR PURCHASE ONLY!) */}
      {paymentType === 'PURCHASE' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.8fr) minmax(280px, 1fr)',
          gap: '20px',
          marginBottom: '20px'
        }}>
          {/* Left: Invoice Allocation Table */}
          <div style={{
            background: 'var(--surface-card, #151515)',
            border: '1px solid var(--border, #292929)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Invoice Allocation
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Select and allocate this payment to supplier invoices.
                </div>
              </div>

              {/* Search Invoice */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                borderRadius: '6px', padding: '4px 10px', width: '220px'
              }}>
                <Search size={13} color="var(--text-secondary)" />
                <input
                  type="text"
                  placeholder="Search purchase invoices..."
                  value={invoiceSearchQuery}
                  onChange={e => setInvoiceSearchQuery(e.target.value)}
                  style={{
                    width: '100%', background: 'transparent', border: 'none',
                    fontSize: '12px', color: 'var(--text-primary)', outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--border, #292929)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-inner, #191919)', borderBottom: '1px solid var(--border, #292929)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', width: '32px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={unpaidBills.length > 0 && selectedBillIds.length === unpaidBills.length}
                        onChange={() => {
                          if (selectedBillIds.length === unpaidBills.length) {
                            setSelectedBillIds([]);
                            setBillAllocations({});
                          } else {
                            setSelectedBillIds(unpaidBills.map(b => b.voucherId));
                            const newAlloc: { [id: string]: number } = {};
                            let rem = paymentAmountPaise;
                            unpaidBills.forEach(b => {
                              const alloc = Math.min(b.pendingAmountPaise, rem);
                              newAlloc[b.voucherId] = alloc;
                              rem = Math.max(0, rem - alloc);
                            });
                            setBillAllocations(newAlloc);
                          }
                        }}
                      />
                    </th>
                    <th style={{ padding: '8px 10px' }}>Invoice No.</th>
                    <th style={{ padding: '8px 10px' }}>Date</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Amount (₹)</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Pending Amount (₹)</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount to Adjust (₹)</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Balance (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidBills.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No pending purchase invoices found for this supplier.
                      </td>
                    </tr>
                  ) : (
                    unpaidBills
                      .filter(b => b.voucherNumber.toLowerCase().includes(invoiceSearchQuery.toLowerCase()))
                      .map(bill => {
                        const isSelected = selectedBillIds.includes(bill.voucherId);
                        const allocated = billAllocations[bill.voucherId] || 0;
                        const balance = Math.max(0, bill.pendingAmountPaise - allocated);

                        return (
                          <tr
                            key={bill.voucherId}
                            style={{
                              borderBottom: '1px solid var(--border, #292929)',
                              background: isSelected ? 'rgba(255, 100, 31, 0.05)' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleBillSelect(bill)}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: '#3B82F6' }}>
                              {bill.voucherNumber}
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                              {formatDate(bill.voucherDate)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-primary)' }}>
                              {(bill.totalAmountPaise / 100).toFixed(2)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#EF4444' }}>
                              {(bill.pendingAmountPaise / 100).toFixed(2)}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={(bill.pendingAmountPaise / 100).toFixed(2)}
                                value={allocated > 0 ? (allocated / 100).toFixed(2) : ''}
                                onChange={e => handleAllocationChange(bill.voucherId, e.target.value)}
                                placeholder="0.00"
                                style={{
                                  width: '100px', textAlign: 'right', padding: '4px 6px',
                                  background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                                  borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none'
                                }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {(balance / 100).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setIsOnAccount(!isOnAccount)}
                style={{
                  background: 'transparent', border: '1px dashed var(--border, #292929)',
                  borderRadius: '6px', padding: '6px 12px', fontSize: '12px',
                  color: isOnAccount ? '#10B981' : 'var(--text-secondary)', cursor: 'pointer'
                }}
              >
                + Add Advance / On Account {isOnAccount && '✓'}
              </button>
            </div>
          </div>

          {/* Right: Allocation Summary & Additional Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Allocation Summary Card */}
            <div style={{
              background: 'var(--surface-card, #151515)',
              border: '1px solid var(--border, #292929)',
              borderRadius: '12px',
              padding: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontWeight: 600, fontSize: '14px' }}>
                <span style={{ color: '#10B981' }}>📊</span> Allocation Summary
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', borderBottom: '1px solid var(--border, #292929)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Payment Amount</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatINR(paymentAmountPaise)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', borderBottom: '1px solid var(--border, #292929)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Adjusted</span>
                <span style={{ fontWeight: 600, color: '#3B82F6' }}>{formatINR(totalAllocatedPaise)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Unallocated / Advance</span>
                <span style={{
                  fontWeight: 700,
                  color: unallocatedAmountPaise === 0 ? '#10B981' : '#F59E0B'
                }}>
                  {formatINR(unallocatedAmountPaise)}
                </span>
              </div>
            </div>

            {/* Additional Notes Card */}
            <div style={{
              background: 'var(--surface-card, #151515)',
              border: '1px solid var(--border, #292929)',
              borderRadius: '12px',
              padding: '20px'
            }}>
              <div style={{ fontSize: '13.5px', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>
                Additional Notes (Optional)
              </div>
              <textarea
                rows={3}
                placeholder="Enter any additional notes, remarks, or reference information..."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                  borderRadius: '6px', padding: '8px 10px', fontSize: '12.5px', color: 'var(--text-primary)',
                  outline: 'none', resize: 'vertical'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* When Expense or Other: Notes Card */}
      {paymentType !== 'PURCHASE' && (
        <div style={{
          background: 'var(--surface-card, #151515)',
          border: '1px solid var(--border, #292929)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '13.5px', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>
            Additional Notes (Optional)
          </div>
          <textarea
            rows={3}
            placeholder="Enter any additional notes, remarks, or reference information..."
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
              borderRadius: '6px', padding: '8px 10px', fontSize: '12.5px', color: 'var(--text-primary)',
              outline: 'none', resize: 'vertical'
            }}
          />
        </div>
      )}

      {/* Modal: New Supplier */}
      {showNewSupplierModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--surface-elevated, #1D1D1D)', border: '1px solid var(--border, #292929)',
            borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '440px',
            boxShadow: 'var(--modal-shadow)', color: 'var(--text-primary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                Create New Supplier
              </h3>
              <button
                type="button"
                onClick={() => setShowNewSupplierModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                  Supplier Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newSuppName}
                  onChange={e => setNewSuppName(e.target.value)}
                  placeholder="e.g. Acme Supplies"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                    borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Phone</label>
                <input
                  type="text"
                  value={newSuppPhone}
                  onChange={e => setNewSuppPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                    borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>GSTIN</label>
                <input
                  type="text"
                  value={newSuppGstin}
                  onChange={e => setNewSuppGstin(e.target.value)}
                  placeholder="22AAAAA0000A1Z5"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                    borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Address</label>
                <textarea
                  rows={2}
                  value={newSuppAddress}
                  onChange={e => setNewSuppAddress(e.target.value)}
                  placeholder="Street address, city, state"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--surface-inner, #191919)', border: '1px solid var(--border, #292929)',
                    borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewSupplierModal(false)}
                  style={{
                    background: 'transparent', border: '1px solid var(--border, #292929)',
                    color: 'var(--text-primary)', padding: '8px 14px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSupp || !newSuppName.trim()}
                  style={{
                    background: '#FF641F', color: '#fff', border: 'none',
                    padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                    cursor: isCreatingSupp || !newSuppName.trim() ? 'not-allowed' : 'pointer',
                    opacity: isCreatingSupp || !newSuppName.trim() ? 0.6 : 1
                  }}
                >
                  {isCreatingSupp ? 'Creating...' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Print Modal for Voucher Details */}
      {printPaymentVoucherId && (
        <InvoicePrintModal
          voucherId={printPaymentVoucherId}
          company={company}
          onClose={() => {
            setPrintPaymentVoucherId(null);
            onPostSuccess ? onPostSuccess(printPaymentVoucherId) : onBack();
          }}
        />
      )}
    </div>
  );
};
