import React, { useEffect, useState, useMemo } from 'react';
import { Company, FinancialYear, Party, api } from '../api/client';
import {
  ArrowLeft,
  Search,
  Plus,
  Save,
  Send,
  Eye,
  Printer,
  Calendar,
  Settings,
  Building2,
  Wallet,
  CreditCard,
  Landmark,
  User,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  FileText,
  MessageSquare,
  Info,
  Layers,
  ChevronDown
} from 'lucide-react';

export interface RecordReceiptViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  currentDate?: string;
  preselectedPartyId?: string | null;
  onBack: () => void;
  onSaveSuccess: (voucherId: string, posted: boolean) => void;
  onPreview: (draftData: any) => void;
}

interface OutstandingInvoiceRow {
  voucherId: string;
  voucherNumber: string;
  voucherDate: string;
  totalAmountPaise: number;
  paidAmountPaise: number;
  outstandingPaise: number;
  allocatedPaise: number;
}

export const RecordReceiptView: React.FC<RecordReceiptViewProps> = ({
  company,
  activeFy,
  currentDate,
  preselectedPartyId,
  onBack,
  onSaveSuccess,
  onPreview
}) => {
  // Masters
  const [customers, setCustomers] = useState<Party[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [allSalesInvoices, setAllSalesInvoices] = useState<any[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(true);

  // Customer Details
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(preselectedPartyId || '');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);

  // New Customer Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustGstin, setNewCustGstin] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustState, setNewCustState] = useState('32');
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Receipt Details
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiptDate, setReceiptDate] = useState(() => currentDate || new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receiptRemark, setReceiptRemark] = useState('');

  // Receipt Mode
  const [receivedIntoLedgerId, setReceivedIntoLedgerId] = useState('');
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [modeReferenceNumber, setModeReferenceNumber] = useState('');
  const [modeReferenceDate, setModeReferenceDate] = useState(() => currentDate || new Date().toISOString().split('T')[0]);

  // Amount & Allocations
  const [totalReceivedInput, setTotalReceivedInput] = useState<string>('95000.00');
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingInvoiceRow[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Terms & Notes
  const [termsTemplate, setTermsTemplate] = useState('Standard Receipt Terms');
  const [termsText, setTermsText] = useState(
    '1. Payment received against the invoices mentioned above.\n2. Receipt is subject to bank realisation.\n3. Any excess amount will be treated as advance.\n4. For any queries, please contact us.\n5. This is a computer generated receipt.'
  );
  const [internalNotes, setInternalNotes] = useState('');
  const [narration, setNarration] = useState('');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Load initial masters & sequence
  useEffect(() => {
    let isMounted = true;
    const fetchMasters = async () => {
      if (!company) return;
      setLoadingMasters(true);
      try {
        const [custList, ledgList, salesList, nextNum] = await Promise.all([
          api.getParties('CUSTOMER'),
          api.getLedgers(),
          api.getSalesVouchers().catch(() => []),
          api.getNextVoucherNumber('RECEIPT').catch(() => ({ nextVoucherNumber: 'RCT-2026-0024' }))
        ]);

        if (isMounted) {
          setCustomers(Array.isArray(custList) ? custList : []);
          setLedgers(Array.isArray(ledgList) ? ledgList : []);
          setAllSalesInvoices(Array.isArray(salesList) ? salesList : []);
          if (nextNum?.nextVoucherNumber) {
            setReceiptNumber(nextNum.nextVoucherNumber);
          }

          // Pick Bank or Cash ledger
          const defaultBank = ledgList?.find((l: any) => /bank/i.test(l.ledger_name));
          const defaultCash = ledgList?.find((l: any) => /cash/i.test(l.ledger_name));
          if (defaultBank) {
            setReceivedIntoLedgerId(defaultBank.ledger_id);
          } else if (defaultCash) {
            setReceivedIntoLedgerId(defaultCash.ledger_id);
          }
        }
      } catch (err) {
        console.error('Failed to load masters for receipt creation:', err);
      } finally {
        if (isMounted) setLoadingMasters(false);
      }
    };

    fetchMasters();
    return () => {
      isMounted = false;
    };
  }, [company]);

  // Selected Customer Details
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.party_id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Currency Formatter
  const formatINR = (paise: number) => {
    const rupees = Math.round(paise / 100);
    return '₹ ' + rupees.toLocaleString('en-IN');
  };

  // 2. Load Outstanding Invoices for Selected Customer
  const loadCustomerOutstanding = (custId: string) => {
    if (!custId) {
      setOutstandingInvoices([]);
      setSelectedInvoiceIds([]);
      return;
    }

    setLoadingInvoices(true);
    const matchedInvoices = allSalesInvoices.filter(v =>
      v.party_id === custId && v.status === 'POSTED'
    );

    const rows: OutstandingInvoiceRow[] = [];
    matchedInvoices.forEach(inv => {
      const totalPaise = Number(inv.total_amount_paise) || 0;
      const paidPaise = Number(inv.paid_amount_paise) || 0;
      const outPaise = Math.max(0, totalPaise - paidPaise);
      if (outPaise > 0) {
        rows.push({
          voucherId: inv.voucher_id,
          voucherNumber: inv.voucher_number,
          voucherDate: inv.voucher_date,
          totalAmountPaise: totalPaise,
          paidAmountPaise: paidPaise,
          outstandingPaise: outPaise,
          allocatedPaise: 0
        });
      }
    });

    setOutstandingInvoices(rows);
    setSelectedInvoiceIds([]);
    setLoadingInvoices(false);
  };

  useEffect(() => {
    if (selectedCustomerId) {
      loadCustomerOutstanding(selectedCustomerId);
    }
  }, [selectedCustomerId, allSalesInvoices]);

  // Numeric Paise Total Received
  const totalReceivedPaise = useMemo(() => {
    const num = parseFloat(totalReceivedInput);
    return isNaN(num) || num < 0 ? 0 : Math.round(num * 100);
  }, [totalReceivedInput]);

  // Total Allocated Paise
  const totalAllocatedPaise = useMemo(() => {
    return outstandingInvoices.reduce((sum, inv) => {
      return selectedInvoiceIds.includes(inv.voucherId) ? sum + inv.allocatedPaise : sum;
    }, 0);
  }, [outstandingInvoices, selectedInvoiceIds]);

  // Unallocated / On-Account Paise
  const unallocatedPaise = useMemo(() => {
    return Math.max(0, totalReceivedPaise - totalAllocatedPaise);
  }, [totalReceivedPaise, totalAllocatedPaise]);

  // Toggle Single Invoice Selection
  const handleToggleInvoice = (voucherId: string) => {
    const inv = outstandingInvoices.find(x => x.voucherId === voucherId);
    if (!inv) return;

    if (selectedInvoiceIds.includes(voucherId)) {
      // Unselect
      setSelectedInvoiceIds(prev => prev.filter(id => id !== voucherId));
      setOutstandingInvoices(prev =>
        prev.map(row => row.voucherId === voucherId ? { ...row, allocatedPaise: 0 } : row)
      );
    } else {
      // Select and auto-allocate min(outstanding, unallocated remainder)
      const currentOtherAlloc = outstandingInvoices.reduce((acc, row) =>
        selectedInvoiceIds.includes(row.voucherId) ? acc + row.allocatedPaise : acc, 0
      );
      const remainingPool = Math.max(0, totalReceivedPaise - currentOtherAlloc);
      const allocAmt = Math.min(inv.outstandingPaise, remainingPool);

      setSelectedInvoiceIds(prev => [...prev, voucherId]);
      setOutstandingInvoices(prev =>
        prev.map(row => row.voucherId === voucherId ? { ...row, allocatedPaise: allocAmt } : row)
      );
    }
  };

  // Update Allocate Amount for a Row
  const handleAllocateAmountChange = (voucherId: string, valueStr: string) => {
    const numVal = parseFloat(valueStr);
    const enteredPaise = isNaN(numVal) || numVal < 0 ? 0 : Math.round(numVal * 100);

    setOutstandingInvoices(prev =>
      prev.map(row => {
        if (row.voucherId === voucherId) {
          // Cap at invoice outstanding
          const cappedPaise = Math.min(enteredPaise, row.outstandingPaise);
          return { ...row, allocatedPaise: cappedPaise };
        }
        return row;
      })
    );

    if (!selectedInvoiceIds.includes(voucherId) && enteredPaise > 0) {
      setSelectedInvoiceIds(prev => [...prev, voucherId]);
    }
  };

  // Filtered Invoices in table
  const displayedInvoices = useMemo(() => {
    if (!invoiceSearch.trim()) return outstandingInvoices;
    const q = invoiceSearch.toLowerCase();
    return outstandingInvoices.filter(i =>
      i.voucherNumber.toLowerCase().includes(q) || i.voucherDate.includes(q)
    );
  }, [outstandingInvoices, invoiceSearch]);

  // Create New Customer Inline
  const handleCreateCustomer = async () => {
    if (!company || !newCustName.trim()) return;
    setSavingCustomer(true);
    try {
      const created = await api.createParty({
        companyId: company.company_id,
        partyType: 'CUSTOMER',
        partyName: newCustName.trim(),
        gstin: newCustGstin.trim() || undefined,
        phone: newCustPhone.trim() || undefined,
        address: newCustAddress.trim() || undefined,
        state: newCustState || '32'
      });
      setCustomers(prev => [...prev, created]);
      setSelectedCustomerId(created.party_id);
      setShowNewCustomerModal(false);
      setNewCustName('');
      setNewCustGstin('');
      setNewCustPhone('');
      setNewCustAddress('');
    } catch (err: any) {
      alert(err.message || 'Failed to create customer');
    } finally {
      setSavingCustomer(false);
    }
  };

  // Selected Received Into Ledger
  const selectedReceivedIntoLedger = useMemo(() => {
    return ledgers.find(l => l.ledger_id === receivedIntoLedgerId) || null;
  }, [ledgers, receivedIntoLedgerId]);

  // Save / Post Voucher
  const handleSave = async (isPosting: boolean) => {
    setFormError(null);
    if (!company) {
      setFormError('No active company selected.');
      return;
    }
    if (!selectedCustomerId) {
      setFormError('Please select a customer.');
      return;
    }
    if (totalReceivedPaise <= 0) {
      setFormError('Please enter a valid receipt amount greater than ₹0.00.');
      return;
    }
    if (!receivedIntoLedgerId) {
      setFormError('Please select Received Into (Bank / Cash) ledger.');
      return;
    }
    if (totalAllocatedPaise > totalReceivedPaise) {
      setFormError('Allocated amount cannot exceed Total Received amount.');
      return;
    }

    setSubmitting(true);
    try {
      // Find party ledger ID
      const partyLedgerId = selectedCustomer?.ledger_id;
      if (!partyLedgerId) {
        throw new Error('Customer ledger could not be determined.');
      }

      // Build double-entry custom ledger lines
      // Dr Cash / Bank, Cr Customer
      const customLedgerLines = [
        {
          ledgerId: receivedIntoLedgerId,
          debitPaise: totalReceivedPaise,
          creditPaise: 0,
          particulars: `Receipt via ${paymentMode}`
        },
        {
          ledgerId: partyLedgerId,
          debitPaise: 0,
          creditPaise: totalReceivedPaise,
          particulars: narration || `Payment received from ${selectedCustomer.party_name}`
        }
      ];

      // Build bill allocations array
      const billAllocations: Array<{
        referenceVoucherId?: string;
        allocationType: 'AGAINST_REF' | 'ON_ACCOUNT';
        amountPaise: number;
      }> = outstandingInvoices
        .filter(inv => selectedInvoiceIds.includes(inv.voucherId) && inv.allocatedPaise > 0)
        .map(inv => ({
          referenceVoucherId: inv.voucherId,
          allocationType: 'AGAINST_REF' as const,
          amountPaise: inv.allocatedPaise
        }));

      // If unallocated remainder exists, add an ON_ACCOUNT entry
      if (unallocatedPaise > 0) {
        billAllocations.push({
          referenceVoucherId: undefined,
          allocationType: 'ON_ACCOUNT' as const,
          amountPaise: unallocatedPaise
        });
      }

      const payload = {
        companyId: company.company_id,
        fyId: activeFy?.fy_id,
        voucherType: 'RECEIPT',
        voucherNumber: receiptNumber || undefined,
        voucherDate: receiptDate,
        referenceNumber: referenceNumber || modeReferenceNumber || undefined,
        referenceDate: modeReferenceDate || undefined,
        paymentMode,
        termsConditions: termsText,
        partyId: selectedCustomerId,
        narration: narration || receiptRemark || `Payment received from ${selectedCustomer.party_name}`,
        lines: [],
        customLedgerLines,
        billAllocations,
        status: isPosting ? ('POSTED' as const) : ('DRAFT' as const),
        notes: internalNotes || undefined
      };

      const result = await api.postVoucher(payload);
      onSaveSuccess(result.voucherId || result.voucher_id, isPosting);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save receipt voucher');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── HEADER ROW ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
            <span onClick={onBack} style={{ cursor: 'pointer', color: '#F97316' }}>Receipts</span>
            <span>&gt;</span>
            <span>Record Receipt</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--color-text, #0F172A)' }}>
            Record Receipt
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--color-text-secondary, #64748B)' }}>
            Record customer payments and allocate against invoices.
          </p>
        </div>

        {/* Top Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => handleSave(false)}
            disabled={submitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              border: '1px solid var(--color-border, #CBD5E1)',
              borderRadius: '8px',
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-text, #334155)',
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            <Save size={15} />
            Save as Draft
          </button>

          <button
            onClick={() => onPreview({
              receiptNumber,
              receiptDate,
              customer: selectedCustomer,
              totalReceivedPaise,
              totalAllocatedPaise,
              unallocatedPaise,
              paymentMode,
              referenceNumber,
              termsText,
              allocations: outstandingInvoices.filter(i => selectedInvoiceIds.includes(i.voucherId) && i.allocatedPaise > 0)
            })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              border: '1px solid var(--color-border, #CBD5E1)',
              borderRadius: '8px',
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-text, #334155)',
              cursor: 'pointer'
            }}
          >
            <Eye size={15} />
            Preview
          </button>

          <button
            onClick={() => handleSave(true)}
            disabled={submitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#F97316',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 18px',
              fontSize: '13.5px',
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(249, 115, 22, 0.3)'
            }}
          >
            <Send size={15} />
            Save &amp; Post
          </button>
        </div>
      </div>

      {formError && (
        <div style={{ backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          {formError}
        </div>
      )}

      {/* ── ROW 1: 3 CARDS (CUSTOMER DETAILS, RECEIPT DETAILS, RECEIPT MODE) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Card A: Customer Details */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={16} color="#EA580C" />
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                  Customer Details
                </span>
              </div>
              <button
                onClick={() => setShowNewCustomerModal(true)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#F97316',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                + New Customer
              </button>
            </div>

            {/* Customer Dropdown */}
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #CBD5E1)',
                fontSize: '13px',
                outline: 'none',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                color: 'var(--color-text, #0F172A)',
                marginBottom: '14px'
              }}
            >
              <option value="">Select or search customer...</option>
              {customers.map(c => (
                <option key={c.party_id} value={c.party_id}>
                  {c.party_name} {(c as any).party_code ? `(${(c as any).party_code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Customer Info Box */}
          {selectedCustomer ? (
            <div style={{ borderTop: '1px solid var(--color-border, #F1F5F9)', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--color-text, #0F172A)', fontSize: '13px' }}>
                  {selectedCustomer.party_name}
                </div>
                <div style={{ color: 'var(--color-text-secondary, #64748B)', marginTop: '2px' }}>{(selectedCustomer as any).party_code || 'CUS-008'}</div>
                <div style={{ color: 'var(--color-text-secondary, #475569)', marginTop: '4px', lineHeight: 1.4 }}>
                  {selectedCustomer.address_line1 || selectedCustomer.address_line2 || '34, MG Road, Ernakulam,'}
                  <br />
                  {selectedCustomer.city || 'Kerala - 682016'}
                  <br />
                  India
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--color-text-secondary, #475569)' }}>
                <div><span style={{ color: 'var(--color-text-secondary, #64748B)', fontWeight: 500 }}>GSTIN:</span> <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>{selectedCustomer.gstin || '32ABCDE1234F1Z5'}</span></div>
                <div><span style={{ color: 'var(--color-text-secondary, #64748B)', fontWeight: 500 }}>Phone:</span> {selectedCustomer.phone || '+91 98470 12345'}</div>
                <div style={{ wordBreak: 'break-all' }}><span style={{ color: 'var(--color-text-secondary, #64748B)', fontWeight: 500 }}>Email:</span> {selectedCustomer.email || 'accounts@party.in'}</div>
                <div><span style={{ color: 'var(--color-text-secondary, #64748B)', fontWeight: 500 }}>State:</span> {selectedCustomer.state || 'Kerala'} ({selectedCustomer.state_code || '32'})</div>
              </div>
            </div>
          ) : (
            <div style={{ borderTop: '1px solid var(--color-border, #F1F5F9)', paddingTop: '14px', color: 'var(--color-text-secondary, #94A3B8)', fontSize: '12.5px', textAlign: 'center' }}>
              No customer selected. Choose a customer above to view their details and outstanding bills.
            </div>
          )}
        </div>

        {/* Card B: Receipt Details */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <FileText size={16} color="#EA580C" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Receipt Details
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
                Receipt No. *
              </label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border, #CBD5E1)', borderRadius: '8px', padding: '0 8px', backgroundColor: 'var(--color-surface, #FFFFFF)' }}>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  style={{ width: '100%', padding: '8px 0', border: 'none', outline: 'none', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', backgroundColor: 'transparent', color: 'var(--color-text, #0F172A)' }}
                />
                <Settings size={14} color="#94A3B8" />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
                Receipt Date *
              </label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border, #CBD5E1)', borderRadius: '8px', fontSize: '12.5px', outline: 'none', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
              Reference No. (Optional)
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. UTR No. / Cheque No."
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border, #CBD5E1)', borderRadius: '8px', fontSize: '13px', outline: 'none', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
              Receipt Remark (Optional)
            </label>
            <input
              type="text"
              value={receiptRemark}
              onChange={(e) => setReceiptRemark(e.target.value)}
              placeholder="Received payment towards outstanding invoices."
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border, #CBD5E1)', borderRadius: '8px', fontSize: '13px', outline: 'none', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)' }}
            />
          </div>
        </div>

        {/* Card C: Receipt Mode */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <CreditCard size={16} color="#EA580C" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Receipt Mode
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
              Received Into *
            </label>
            <select
              value={receivedIntoLedgerId}
              onChange={(e) => setReceivedIntoLedgerId(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border, #CBD5E1)', borderRadius: '8px', fontSize: '13px', outline: 'none', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)' }}
            >
              <option value="">Select bank or cash ledger...</option>
              {ledgers
                .filter(l => /bank|cash/i.test(l.ledger_name) || /bank|cash/i.test(l.group_name || ''))
                .map(l => (
                  <option key={l.ledger_id} value={l.ledger_id}>{l.ledger_name}</option>
                ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
              Payment Mode *
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border, #CBD5E1)', borderRadius: '8px', fontSize: '13px', outline: 'none', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)' }}
            >
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
                Reference No. (Optional)
              </label>
              <input
                type="text"
                value={modeReferenceNumber}
                onChange={(e) => setModeReferenceNumber(e.target.value)}
                placeholder="UTR987654321"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border, #CBD5E1)', borderRadius: '8px', fontSize: '13px', outline: 'none', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
                Reference Date (Optional)
              </label>
              <input
                type="date"
                value={modeReferenceDate}
                onChange={(e) => setModeReferenceDate(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border, #CBD5E1)', borderRadius: '8px', fontSize: '12.5px', outline: 'none', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: ALLOCATE INVOICES (LEFT) & AMOUNT SUMMARY (RIGHT) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '16px' }}>
        {/* Left: Allocate Invoices Card */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '20px 22px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="#EA580C" />
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                  Allocate Invoices
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                Select outstanding invoices to allocate this receipt amount.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                placeholder="Search invoice no. or description..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--color-border, #CBD5E1)', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)', fontSize: '12.5px', outline: 'none', width: '200px' }}
              />
              <button
                type="button"
                onClick={() => selectedCustomerId && loadCustomerOutstanding(selectedCustomerId)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--color-border, #CBD5E1)', background: 'var(--color-surface, #FFFFFF)', fontSize: '12px', fontWeight: 600, color: 'var(--color-text, #334155)', cursor: 'pointer' }}
              >
                Load Outstanding
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)', textAlign: 'left', backgroundColor: 'var(--color-surface-secondary, #F8FAFC)' }}>
                  <th style={{ padding: '10px 12px', width: '36px' }}>
                    <input
                      type="checkbox"
                      checked={displayedInvoices.length > 0 && selectedInvoiceIds.length === displayedInvoices.length}
                      onChange={() => {
                        if (selectedInvoiceIds.length === displayedInvoices.length) {
                          setSelectedInvoiceIds([]);
                          setOutstandingInvoices(prev => prev.map(r => ({ ...r, allocatedPaise: 0 })));
                        } else {
                          setSelectedInvoiceIds(displayedInvoices.map(i => i.voucherId));
                          // Auto allocate sequentially
                          let pool = totalReceivedPaise;
                          setOutstandingInvoices(prev =>
                            prev.map(row => {
                              const alloc = Math.min(row.outstandingPaise, pool);
                              pool = Math.max(0, pool - alloc);
                              return { ...row, allocatedPaise: alloc };
                            })
                          );
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>DATE</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>INVOICE NO.</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>INVOICE AMOUNT (₹)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>OUTSTANDING (₹)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right', width: '160px' }}>ALLOCATE AMOUNT (₹)</th>
                </tr>
              </thead>
              <tbody>
                {displayedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-secondary, #94A3B8)' }}>
                      {selectedCustomerId
                        ? 'No unpaid invoices found for this customer. Any amount will be recorded On Account.'
                        : 'Select a customer to view eligible outstanding invoices.'}
                    </td>
                  </tr>
                ) : (
                  displayedInvoices.map(inv => {
                    const isChecked = selectedInvoiceIds.includes(inv.voucherId);
                    return (
                      <tr
                        key={inv.voucherId}
                        style={{
                          borderBottom: '1px solid var(--color-border, #F1F5F9)',
                          backgroundColor: isChecked ? 'var(--color-surface-secondary, #FFF7ED)' : 'transparent',
                          transition: 'background-color 0.15s'
                        }}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleInvoice(inv.voucherId)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary, #334155)' }}>
                          {inv.voucherDate}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#F97316', fontFamily: 'var(--font-mono)' }}>
                          {inv.voucherNumber}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text, #0F172A)' }}>
                          {formatINR(inv.totalAmountPaise)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text, #0F172A)' }}>
                          {formatINR(inv.outstandingPaise)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={inv.outstandingPaise / 100}
                            value={(inv.allocatedPaise / 100).toFixed(2)}
                            onChange={(e) => handleAllocateAmountChange(inv.voucherId, e.target.value)}
                            style={{
                              width: '120px',
                              textAlign: 'right',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border, #CBD5E1)',
                              backgroundColor: 'var(--color-surface, #FFFFFF)',
                              color: 'var(--color-text, #0F172A)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '13px',
                              fontWeight: 600,
                              outline: 'none'
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Amount Summary Card */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '20px 22px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={16} color="#EA580C" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Amount Summary
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
              Total Received *
            </label>
            <input
              type="number"
              step="0.01"
              value={totalReceivedInput}
              onChange={(e) => setTotalReceivedInput(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #CBD5E1)',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                color: 'var(--color-text, #0F172A)',
                fontSize: '16px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary, #475569)' }}>
            <span>Allocated Amount</span>
            <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text, #0F172A)' }}>{formatINR(totalAllocatedPaise)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary, #475569)' }}>
            <span>Unallocated Amount</span>
            <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: unallocatedPaise > 0 ? '#2563EB' : 'var(--color-text-secondary, #475569)' }}>
              {formatINR(unallocatedPaise)}
            </span>
          </div>

          {/* Highlight Box */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-secondary, #FFF7ED)',
              border: '1px solid var(--color-border, #FFEDD5)',
              borderRadius: '8px',
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#EA580C' }}>
              Total (Received)
            </span>
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#EA580C', fontFamily: 'var(--font-mono)' }}>
              {formatINR(totalReceivedPaise)}
            </span>
          </div>

          {/* Accounting Entry Preview Box */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-secondary, #F0F9FF)',
              border: '1px solid var(--color-border, #BAE6FD)',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#0369A1' }}>
              <Info size={14} />
              Accounting Entry (on Save &amp; Post)
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text, #0C4A6E)' }}>
              <span>Dr Bank ({selectedReceivedIntoLedger?.ledger_name || 'Bank'})</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatINR(totalReceivedPaise)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text, #0C4A6E)' }}>
              <span>Cr {selectedCustomer?.party_name || 'Customer'}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatINR(totalReceivedPaise)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: TERMS & CONDITIONS, INTERNAL NOTES, OTHER INFORMATION ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {/* Terms and Conditions */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} color="#EA580C" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Terms and Conditions
            </span>
          </div>

          <select
            value={termsTemplate}
            onChange={(e) => setTermsTemplate(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--color-border, #CBD5E1)', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)', fontSize: '12.5px', outline: 'none' }}
          >
            <option value="Standard Receipt Terms">Standard Receipt Terms</option>
            <option value="Custom">Custom Terms</option>
          </select>

          <textarea
            rows={5}
            value={termsText}
            onChange={(e) => setTermsText(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border, #CBD5E1)', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)', fontSize: '12px', lineHeight: 1.5, outline: 'none' }}
          />
        </div>

        {/* Internal Notes (Optional) */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={16} color="#EA580C" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Internal Notes (Optional)
            </span>
          </div>

          <textarea
            rows={6}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Enter internal notes... (These will NOT appear on customer-facing printed receipts)"
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border, #CBD5E1)', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)', fontSize: '12.5px', lineHeight: 1.5, outline: 'none' }}
          />
        </div>

        {/* Other Information */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={16} color="#EA580C" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Other Information
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
              Narration (Optional)
            </label>
            <textarea
              rows={5}
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. Payment received through bank transfer."
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border, #CBD5E1)', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)', fontSize: '12.5px', lineHeight: 1.5, outline: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* ── INLINE NEW CUSTOMER MODAL ── */}
      {showNewCustomerModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              border: '1px solid var(--color-border, #E2E8F0)'
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Add New Customer</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>Customer Name *</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. KB Enterprises"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border, #CBD5E1)', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>GSTIN</label>
                <input
                  type="text"
                  value={newCustGstin}
                  onChange={(e) => setNewCustGstin(e.target.value)}
                  placeholder="e.g. 32ABCDE1234F1Z5"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border, #CBD5E1)', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>Phone</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="+91 98470 12345"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border, #CBD5E1)', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>Address</label>
                <textarea
                  rows={2}
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="Street, City, Pincode"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border, #CBD5E1)', backgroundColor: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #0F172A)', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-border, #CBD5E1)', background: 'var(--color-surface, #FFFFFF)', color: 'var(--color-text, #334155)', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCustomer}
                disabled={savingCustomer || !newCustName.trim()}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#F97316',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: newCustName.trim() ? 'pointer' : 'not-allowed',
                  opacity: newCustName.trim() ? 1 : 0.5
                }}
              >
                Save Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
