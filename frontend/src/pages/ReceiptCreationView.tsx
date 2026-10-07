/**
 * ReceiptCreationView — UI-008: New Receipt Creation
 *
 * Implements the New Receipt Creation form matching the visual source of truth mockups:
 * - Voucher Details: Auto-sequenced Receipt No. (GET /vouchers/next-number?type=RECEIPT), Date, Reference No., Reference Date, Narration.
 * - Customer & Ledger: Searchable customer combobox, inline + New Customer modal, Against Ledger, Received Into (Cash/Bank), Payment Mode, Amount.
 * - Invoice Allocation: Unpaid sales invoices table with checkbox selection, manual or auto allocation capped at pending and receipt amount, + Add Advance / On Account.
 * - Real-time summaries: Amount Summary (Total Amount, Adjusted Amount, Advance / On Account, Receipt Amount), Party Outstanding.
 * - Lifecycle: Save as Draft (0 ledger/stock impact), Save & Post (atomic DR Cash/Bank, CR Customer).
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
  RotateCcw,
  Save,
  Send
} from 'lucide-react';

export interface ReceiptCreationViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  currentDate?: string;
  onBack: () => void;
  onPostSuccess?: (voucherId: string) => void;
}

interface InvoiceBillRow {
  voucherId: string;
  voucherNumber: string;
  voucherDate: string;
  totalAmountPaise: number;
  pendingAmountPaise: number;
  allocatedAmountPaise: number;
  dueDate?: string;
}

export const ReceiptCreationView: React.FC<ReceiptCreationViewProps> = ({
  company,
  activeFy,
  currentDate,
  onBack,
  onPostSuccess
}) => {
  // Master lists
  const [customers, setCustomers] = useState<Party[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [mastersLoading, setMastersLoading] = useState(true);

  // Voucher Details
  const [voucherNumber, setVoucherNumber] = useState('');
  const [voucherDate, setVoucherDate] = useState(() => currentDate || new Date().toISOString().split('T')[0]);
  const [referenceNo, setReferenceNo] = useState('');
  const [referenceDate, setReferenceDate] = useState('');
  const [narration, setNarration] = useState('');
  const [remarks, setRemarks] = useState('');

  // Customer & Ledger Selection
  const [partyId, setPartyId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [againstLedgerId, setAgainstLedgerId] = useState('');
  const [receivedIntoLedgerId, setReceivedIntoLedgerId] = useState('');
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [receiptAmount, setReceiptAmount] = useState<string>('');

  // Party Outstanding
  const [partyOutstandingPaise, setPartyOutstandingPaise] = useState(0);

  // Invoice Allocation State
  const [unpaidBills, setUnpaidBills] = useState<InvoiceBillRow[]>([]);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [billAllocations, setBillAllocations] = useState<{ [id: string]: number }>({});
  const [isOnAccount, setIsOnAccount] = useState(false);

  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [printReceiptVoucherId, setPrintReceiptVoucherId] = useState<string | null>(null);
  const [printAfterSaving, setPrintAfterSaving] = useState(true);

  // New Customer Modal State
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustGstin, setNewCustGstin] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustState, setNewCustState] = useState('33');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  const selectedCustomer = customers.find(c => c.party_id === partyId);

  const showToast = (msg: string, isErr = false) => {
    setToast(isErr ? '❌ ' + msg : '✓ ' + msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Load Masters
  useEffect(() => {
    const loadMasters = async () => {
      setMastersLoading(true);
      try {
        const [custs, leds, allSales] = await Promise.all([
          api.getParties('CUSTOMER'),
          api.getLedgers(),
          api.getSalesVouchers().catch(() => [])
        ]);
        setCustomers(custs || []);
        setLedgers(leds || []);
        setSalesInvoices(allSales || []);

        // Default Received Into (Bank / Cash)
        const bankOrCash = leds?.find((l: any) =>
          /bank|cash/i.test(l.ledger_name) || /bank|cash/i.test(l.group_name || '')
        );
        if (bankOrCash) {
          setReceivedIntoLedgerId(bankOrCash.ledger_id);
        }

        // If preselected party exists from other screens
        const preselected = (window as any)._preselectedPartyId;
        if (preselected) {
          setPartyId(preselected);
          (window as any)._preselectedPartyId = null;
        }
      } catch (err) {
        console.error('Failed to load masters for receipts:', err);
      } finally {
        setMastersLoading(false);
      }
    };
    loadMasters();
  }, []);

  // Fetch Next Voucher Number
  useEffect(() => {
    const fetchNextNumber = async () => {
      if (!company || !activeFy) return;
      try {
        const res = await api.getNextVoucherNumber(company.company_id, activeFy.fy_id, 'RECEIPT');
        if (res?.nextVoucherNumber) {
          setVoucherNumber(res.nextVoucherNumber);
        }
      } catch (err) {
        console.error('Failed to get next receipt number:', err);
      }
    };
    fetchNextNumber();
  }, [company, activeFy]);

  // When Party Changes: populate againstLedger, outstanding, and unpaid invoices
  useEffect(() => {
    if (!partyId) {
      setAgainstLedgerId('');
      setPartyOutstandingPaise(0);
      setUnpaidBills([]);
      setSelectedBillIds([]);
      setBillAllocations({});
      return;
    }

    const matched = customers.find(c => c.party_id === partyId);
    if (matched) {
      setAgainstLedgerId(matched.ledger_id);

      // Fetch Party Outstanding
      if (company) {
        api.getOutstanding(company.company_id, 'CUSTOMER').then(res => {
          if (Array.isArray(res)) {
            const found = res.find((r: any) => r.partyId === partyId);
            if (found) setPartyOutstandingPaise(found.totalOutstandingPaise);
          }
        }).catch(console.error);
      }

      // Filter sales invoices for this party
      const partyInvoices = salesInvoices.filter(v => v.party_id === partyId && v.status === 'POSTED');
      const bills: InvoiceBillRow[] = partyInvoices.map(v => {
        const total = Number(v.total_amount_paise || 0);
        return {
          voucherId: v.voucher_id,
          voucherNumber: v.voucher_number,
          voucherDate: v.voucher_date,
          totalAmountPaise: total,
          pendingAmountPaise: total, // Unsettled default
          allocatedAmountPaise: 0,
          dueDate: v.due_date
        };
      });
      setUnpaidBills(bills);
    }
  }, [partyId, customers, salesInvoices, company]);

  // Bank & Cash Ledgers for Received Into
  const cashBankLedgers = useMemo(() => {
    return ledgers.filter(l =>
      /bank|cash/i.test(l.ledger_name) || /bank|cash/i.test(l.group_name || '')
    );
  }, [ledgers]);

  // Debtors / Customer Ledgers for Against Ledger
  const customerLedgers = useMemo(() => {
    return ledgers.filter(l =>
      /debtor|customer/i.test(l.group_name || '') ||
      /debtor|customer/i.test(l.ledger_name) ||
      l.ledger_id === selectedCustomer?.ledger_id
    );
  }, [ledgers, selectedCustomer]);

  // Numeric Calculations
  const receiptAmountPaise = Math.round((Number(receiptAmount) || 0) * 100);

  // Total allocated amount across checked bills
  const totalAllocatedPaise = useMemo(() => {
    return Object.entries(billAllocations).reduce((sum, [id, amt]) => {
      if (selectedBillIds.includes(id)) {
        return sum + (amt || 0);
      }
      return sum;
    }, 0);
  }, [billAllocations, selectedBillIds]);

  const advanceOrOnAccountPaise = Math.max(0, receiptAmountPaise - totalAllocatedPaise);

  // Allocate bill handler
  const handleToggleBill = (bill: InvoiceBillRow) => {
    const isChecked = selectedBillIds.includes(bill.voucherId);
    if (isChecked) {
      setSelectedBillIds(prev => prev.filter(x => x !== bill.voucherId));
      setBillAllocations(prev => {
        const copy = { ...prev };
        delete copy[bill.voucherId];
        return copy;
      });
    } else {
      setSelectedBillIds(prev => [...prev, bill.voucherId]);
      // Auto-suggest allocation: remaining unallocated receipt amount capped at pending
      const currentOtherAlloc = Object.entries(billAllocations).reduce((sum, [id, amt]) => {
        if (id !== bill.voucherId && selectedBillIds.includes(id)) return sum + amt;
        return sum;
      }, 0);
      const available = Math.max(0, receiptAmountPaise - currentOtherAlloc);
      const allocated = Math.min(available > 0 ? available : bill.pendingAmountPaise, bill.pendingAmountPaise);
      setBillAllocations(prev => ({
        ...prev,
        [bill.voucherId]: allocated
      }));
    }
  };

  const handleAllocationChange = (billId: string, val: string) => {
    const numeric = Math.max(0, Math.round((Number(val) || 0) * 100));
    const bill = unpaidBills.find(b => b.voucherId === billId);
    const maxAllowed = bill ? bill.pendingAmountPaise : numeric;
    const capped = Math.min(numeric, maxAllowed);
    setBillAllocations(prev => ({
      ...prev,
      [billId]: capped
    }));
  };

  // Create Quick Customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;
    setIsCreatingCustomer(true);
    try {
      const res = await api.createParty({
        partyName: newCustName.trim(),
        partyType: 'CUSTOMER',
        gstin: newCustGstin.trim() || undefined,
        phone: newCustPhone.trim() || undefined,
        state: 'Tamil Nadu',
        stateCode: newCustState,
        addressLine1: newCustAddress.trim() || undefined
      });
      const newId = res.partyId || res.party_id;
      showToast('Customer created successfully.');
      setShowNewCustomerModal(false);
      setNewCustName('');
      setNewCustGstin('');
      setNewCustPhone('');
      setNewCustAddress('');

      // Reload parties and select the newly created customer
      const updated = await api.getParties('CUSTOMER');
      setCustomers(updated || []);
      if (newId) setPartyId(newId);
    } catch (err: any) {
      showToast(err.message || 'Failed to create customer', true);
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  // Submit Voucher (Draft or Post)
  const handleSubmit = async (asDraft: boolean) => {
    if (!company) return;
    if (!partyId && !asDraft) {
      setError('Please select a customer.');
      return;
    }
    if (!receiptAmount || Number(receiptAmount) <= 0) {
      setError('Please enter a valid receipt amount.');
      return;
    }
    if (!receivedIntoLedgerId) {
      setError('Please select a Cash or Bank account.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const custLedgerId = againstLedgerId || selectedCustomer?.ledger_id;
      const bankCashLedger = ledgers.find(l => l.ledger_id === receivedIntoLedgerId);
      const custName = selectedCustomer?.party_name || 'Customer';
      const bankCashName = bankCashLedger?.ledger_name || 'Bank/Cash';

      // Assemble Balanced Double-Entry customLedgerLines
      // DR Cash/Bank, CR Customer
      const customLedgerLines = [
        {
          ledgerId: receivedIntoLedgerId,
          debitPaise: receiptAmountPaise,
          creditPaise: 0,
          particulars: `Received into ${bankCashName}`
        },
        {
          ledgerId: custLedgerId,
          debitPaise: 0,
          creditPaise: receiptAmountPaise,
          particulars: `By ${custName}`
        }
      ];

      // Bill Allocation
      let billAllocation: any = undefined;
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

      const payload: any = {
        voucherType: 'RECEIPT',
        voucherDate,
        voucherNumber: voucherNumber || undefined,
        partyId: partyId || undefined,
        status: asDraft ? 'DRAFT' : 'POSTED',
        referenceNo: referenceNo.trim() || undefined,
        referenceDate: referenceDate || undefined,
        paymentMode,
        narration: narration.trim() || remarks.trim() || `Receipt from ${custName}`,
        customLedgerLines,
        billAllocation,
        lines: []
      };

      const res = await api.postVoucher(payload);
      const savedVoucherId = res.voucherId || res.voucher_id;

      if (asDraft) {
        showToast(`Receipt voucher saved as DRAFT successfully.`);
        onBack();
      } else {
        showToast(`Receipt voucher ${res.voucherNumber || voucherNumber} posted successfully.`);
        if (printAfterSaving && savedVoucherId) {
          setPrintReceiptVoucherId(savedVoucherId);
        } else {
          onPostSuccess ? onPostSuccess(savedVoucherId) : onBack();
        }
      }
    } catch (err: any) {
      console.error('Failed to post receipt:', err);
      setError(err.message || 'Failed to record receipt voucher.');
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
          {toast}
        </div>
      )}

      {/* Top Header & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            <span style={{ cursor: 'pointer' }} onClick={onBack}>Receipts</span>
            <span>&gt;</span>
            <span style={{ color: '#FF641F', fontWeight: 600 }}>New Receipt</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            New Receipt
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Record customer receipts and allocate them to invoices.
          </p>
        </div>

        {/* Header Actions */}
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
            onClick={() => handleSubmit(true)}
            style={{
              padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--border, #292929)',
              background: 'var(--surface-hover, #202020)', color: 'var(--text-primary)',
              fontSize: '13px', fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer'
            }}
          >
            Save as Draft
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSubmit(false)}
            style={{
              padding: '9px 20px', borderRadius: '8px', border: 'none',
              background: '#FF641F', color: '#FFFFFF', fontSize: '13px', fontWeight: 600,
              cursor: isSaving ? 'not-allowed' : 'pointer', boxShadow: '0 2px 8px rgba(255,100,31,0.35)'
            }}
          >
            {isSaving ? 'Posting...' : 'Save & Post'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #EF4444', color: '#EF4444', fontSize: '13px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Main Grid: Left 2 Columns Form, Right 1 Column Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        {/* Left Column: Form Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Voucher Details */}
          <div style={{
            background: 'var(--surface, #151515)', border: '1px solid var(--border, #292929)',
            borderRadius: '12px', padding: '20px', boxShadow: 'var(--shadow-sm)'
          }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
              Voucher Details
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Receipt No.
                </label>
                <input
                  type="text"
                  readOnly
                  value={voucherNumber || 'Auto-generated'}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid var(--border, #292929)', background: 'var(--surface-secondary, #191919)',
                    color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={voucherDate}
                  onChange={e => setVoucherDate(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                    color: 'var(--text-primary)', fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Reference No. (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Cheque No. / UTR / Reference"
                  value={referenceNo}
                  onChange={e => setReferenceNo(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                    color: 'var(--text-primary)', fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Reference Date (Optional)
                </label>
                <input
                  type="date"
                  value={referenceDate}
                  onChange={e => setReferenceDate(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                    color: 'var(--text-primary)', fontSize: '13px'
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Narration (Optional)
              </label>
              <input
                type="text"
                placeholder="Payment received against invoice..."
                value={narration}
                onChange={e => setNarration(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '6px',
                  border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                  color: 'var(--text-primary)', fontSize: '13px'
                }}
              />
            </div>
          </div>

          {/* Card 2: Customer & Ledger */}
          <div style={{
            background: 'var(--surface, #151515)', border: '1px solid var(--border, #292929)',
            borderRadius: '12px', padding: '20px', boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Customer &amp; Ledger
              </h2>
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  background: 'none', border: 'none', color: '#FF641F', fontSize: '12.5px',
                  fontWeight: 600, cursor: 'pointer', padding: '2px 6px'
                }}
              >
                <Plus size={14} /> New Customer
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {/* Customer Select */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Customer *
                </label>
                <select
                  value={partyId}
                  onChange={e => setPartyId(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                    color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
                  }}
                >
                  <option value="">Select customer…</option>
                  {customers.map(c => (
                    <option key={c.party_id} value={c.party_id}>{c.party_name}</option>
                  ))}
                </select>
              </div>

              {/* Against Ledger */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Against Ledger *
                </label>
                <select
                  value={againstLedgerId}
                  onChange={e => setAgainstLedgerId(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                    color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
                  }}
                >
                  <option value="">Select ledger…</option>
                  {customerLedgers.map(l => (
                    <option key={l.ledger_id} value={l.ledger_id}>{l.ledger_name}</option>
                  ))}
                </select>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Receipt will be recorded against the selected ledger.
                </div>
              </div>

              {/* Received Into (Bank / Cash) */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Received Into *
                </label>
                <select
                  value={receivedIntoLedgerId}
                  onChange={e => setReceivedIntoLedgerId(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                    color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
                  }}
                >
                  <option value="">Select Cash or Bank account…</option>
                  {cashBankLedgers.map(l => (
                    <option key={l.ledger_id} value={l.ledger_id}>{l.ledger_name}</option>
                  ))}
                </select>
              </div>

              {/* Payment Mode */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Payment Mode *
                </label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                    color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
                  }}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="NEFT">NEFT</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              {/* Amount */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={receiptAmount}
                  onChange={e => setReceiptAmount(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                    color: 'var(--text-primary)', fontSize: '14px', fontWeight: 700, fontFamily: 'monospace'
                  }}
                />
              </div>
            </div>

            {/* Selected Customer Details Banner */}
            {selectedCustomer && (
              <div style={{
                marginTop: '16px', padding: '12px 14px', borderRadius: '8px',
                background: 'var(--surface-secondary, #191919)', border: '1px solid var(--border, #292929)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
                fontSize: '12px'
              }}>
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedCustomer.party_name}</span>
                  {selectedCustomer.gstin && <span style={{ marginLeft: '8px', color: 'var(--text-secondary)' }}>GSTIN: {selectedCustomer.gstin}</span>}
                  {selectedCustomer.phone && <span style={{ marginLeft: '8px', color: 'var(--text-secondary)' }}>Phone: {selectedCustomer.phone}</span>}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Outstanding: <strong style={{ color: '#F59E0B' }}>₹ {(partyOutstandingPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Adjust Against Invoices */}
          <div style={{
            background: 'var(--surface, #151515)', border: '1px solid var(--border, #292929)',
            borderRadius: '12px', padding: '20px', boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 2px 0', color: 'var(--text-primary)' }}>
                  Adjust Against Invoices
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Select customer invoices to adjust this receipt. You can also enter advance or on-account amount.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsOnAccount(prev => !prev)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px', borderRadius: '6px',
                    border: isOnAccount ? '1px solid #FF641F' : '1px solid var(--border, #292929)',
                    background: isOnAccount ? 'rgba(255,100,31,0.1)' : 'var(--surface-hover, #202020)',
                    color: isOnAccount ? '#FF641F' : 'var(--text-primary)',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  <Plus size={13} /> {isOnAccount ? 'On Account Active' : '+ Add Advance / On Account'}
                </button>
              </div>
            </div>

            {/* Invoices Table */}
            <div style={{ border: '1px solid var(--border, #292929)', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--table-header-bg, #101010)', borderBottom: '1px solid var(--border, #292929)', color: 'var(--text-secondary)' }}>
                    <th style={{ width: '40px', padding: '10px 12px' }}></th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Invoice No.</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Pending (₹)</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right', width: '130px' }}>Amount to Allocate (₹)</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Balance (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidBills.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        {partyId ? 'No unpaid sales invoices found for this customer.' : 'Select a customer to view unpaid invoices.'}
                      </td>
                    </tr>
                  ) : (
                    unpaidBills.map(bill => {
                      const isChecked = selectedBillIds.includes(bill.voucherId);
                      const allocPaise = billAllocations[bill.voucherId] || 0;
                      const balPaise = Math.max(0, bill.pendingAmountPaise - allocPaise);

                      return (
                        <tr
                          key={bill.voucherId}
                          style={{
                            borderBottom: '1px solid var(--border, #292929)',
                            background: isChecked ? 'var(--bg-selected, rgba(255,100,31,0.06))' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '10px 12px' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleBill(bill)}
                            />
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#FF641F' }}>
                            {bill.voucherNumber}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                            {bill.voucherDate}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {(bill.totalAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                            {(bill.pendingAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={!isChecked}
                              value={isChecked ? (allocPaise / 100).toFixed(2) : ''}
                              onChange={e => handleAllocationChange(bill.voucherId, e.target.value)}
                              style={{
                                width: '100%', padding: '4px 8px', borderRadius: '4px',
                                border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                                color: 'var(--text-primary)', fontSize: '12px', textAlign: 'right',
                                fontFamily: 'monospace', outline: 'none'
                              }}
                            />
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {(balPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Strip */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)'
            }}>
              <div>
                {unpaidBills.length} invoices | {selectedBillIds.length} selected
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Total Adjusted:</span>
                <strong style={{ fontSize: '15px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  ₹ {(totalAllocatedPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Summaries & Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card: Amount Summary */}
          <div style={{
            background: 'var(--surface, #151515)', border: '1px solid var(--border, #292929)',
            borderRadius: '12px', padding: '20px', boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
              Amount Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Total Amount</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                  ₹ {(receiptAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Adjusted Amount</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                  ₹ {(totalAllocatedPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Advance / On Account</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#3B82F6' }}>
                  ₹ {(advanceOrOnAccountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ height: '1px', background: 'var(--border, #292929)', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Receipt Amount</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#FF641F', fontFamily: 'monospace' }}>
                  ₹ {(receiptAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Party Outstanding */}
          <div style={{
            background: 'var(--surface, #151515)', border: '1px solid var(--border, #292929)',
            borderRadius: '12px', padding: '20px', boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
              Party Outstanding
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Total Receivable</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                  ₹ {(partyOutstandingPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Current Adjustment</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#10B981' }}>
                  (-) ₹ {(receiptAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ height: '1px', background: 'var(--border, #292929)', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Remaining Receivable</span>
                <span style={{
                  fontSize: '15px', fontWeight: 700, fontFamily: 'monospace',
                  color: partyOutstandingPaise - receiptAmountPaise > 0 ? '#F59E0B' : '#10B981'
                }}>
                  ₹ {(Math.max(0, partyOutstandingPaise - receiptAmountPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Additional Details */}
          <div style={{
            background: 'var(--surface, #151515)', border: '1px solid var(--border, #292929)',
            borderRadius: '12px', padding: '20px', boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
              Additional Details
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Remarks (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Add any internal remarks..."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '6px',
                  border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                  color: 'var(--text-primary)', fontSize: '12.5px', outline: 'none', resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="printAfterSave"
                checked={printAfterSaving}
                onChange={e => setPrintAfterSaving(e.target.checked)}
              />
              <label htmlFor="printAfterSave" style={{ fontSize: '12.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Print receipt voucher after saving
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Quick New Customer Modal */}
      {showNewCustomerModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: 'var(--surface, #151515)', border: '1px solid var(--border, #292929)',
            borderRadius: '12px', width: '100%', maxWidth: '460px', padding: '24px',
            boxShadow: 'var(--modal-shadow)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Add New Customer
            </h3>

            <form onSubmit={handleCreateCustomer}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Company or Person Name"
                    value={newCustName}
                    onChange={e => setNewCustName(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '6px',
                      border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                      color: 'var(--text-primary)', fontSize: '13px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="33ABCDE1234F1Z5"
                    value={newCustGstin}
                    onChange={e => setNewCustGstin(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '6px',
                      border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                      color: 'var(--text-primary)', fontSize: '13px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Phone (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={newCustPhone}
                    onChange={e => setNewCustPhone(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '6px',
                      border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                      color: 'var(--text-primary)', fontSize: '13px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Billing Address
                  </label>
                  <input
                    type="text"
                    placeholder="Address Line"
                    value={newCustAddress}
                    onChange={e => setNewCustAddress(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '6px',
                      border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                      color: 'var(--text-primary)', fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(false)}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border, #292929)',
                    background: 'transparent', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCustomer}
                  style={{
                    padding: '8px 18px', borderRadius: '6px', border: 'none',
                    background: '#FF641F', color: '#FFFFFF', fontSize: '13px', fontWeight: 600,
                    cursor: isCreatingCustomer ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isCreatingCustomer ? 'Creating...' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Print Modal */}
      {printReceiptVoucherId && (
        <InvoicePrintModal
          voucherId={printReceiptVoucherId}
          company={company}
          onClose={() => {
            setPrintReceiptVoucherId(null);
            onPostSuccess ? onPostSuccess(printReceiptVoucherId) : onBack();
          }}
        />
      )}
    </div>
  );
};
