import React, { useEffect, useState, useMemo } from 'react';
import { Company, FinancialYear, Party, LedgerMaster as Ledger, api } from '../api/client';
import {
  Wallet,
  Package,
  FileText,
  Layers,
  Calendar,
  CreditCard,
  Building,
  CheckCircle2,
  Save,
  Eye,
  Printer,
  ArrowLeft,
  Search,
  Settings,
  AlertCircle,
  HelpCircle,
  Check,
  RefreshCw
} from 'lucide-react';

export interface RecordPaymentViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  currentDate: string;
  preselectedPartyId?: string | null;
  onBack: () => void;
  onSaveSuccess: (voucherId: string, isPosted: boolean) => void;
  onPreview?: (paymentPayload: any) => void;
  onPrint?: (paymentPayload: any) => void;
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

export const RecordPaymentView: React.FC<RecordPaymentViewProps> = ({
  company,
  activeFy,
  currentDate,
  preselectedPartyId,
  onBack,
  onSaveSuccess,
  onPreview,
  onPrint
}) => {
  // ── PAYMENT TYPE STATE ──
  const [paymentType, setPaymentType] = useState<'PURCHASE' | 'EXPENSE' | 'OTHER'>('PURCHASE');

  // Masters
  const [parties, setParties] = useState<Party[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [allPurchaseInvoices, setAllPurchaseInvoices] = useState<any[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(true);

  // Supplier selection (For Purchase Payment)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(preselectedPartyId || '');

  // Expense / Other selection
  const [selectedExpenseLedgerId, setSelectedExpenseLedgerId] = useState<string>('');
  const [selectedOtherLedgerId, setSelectedOtherLedgerId] = useState<string>('');

  // Payment Details
  const [paymentNumber, setPaymentNumber] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(currentDate || new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [referenceDate, setReferenceDate] = useState<string>(currentDate || new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState<string>('Payment towards purchase invoices.');

  // Payment Mode
  const [paidFromLedgerId, setPaidFromLedgerId] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('Bank Transfer');

  // Amount & Allocations
  const [enteredPaymentAmount, setEnteredPaymentAmount] = useState<string>('');
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingInvoiceRow[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState<string>('');
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(false);

  // Terms & Notes
  const [termsText, setTermsText] = useState<string>(
    '1. Payment towards purchase invoices.\n2. Kindly confirm receipt of payment.\n3. Subject to bank realization.'
  );
  const [internalNotes, setInternalNotes] = useState<string>('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Load Initial Masters & Next Payment Voucher Number
  useEffect(() => {
    let isMounted = true;
    const loadMasters = async () => {
      if (!company) return;
      setLoadingMasters(true);
      try {
        const [partyList, ledgerList, purchaseList, nextNum] = await Promise.all([
          api.getParties('SUPPLIER').catch(() => []),
          api.getLedgers().catch(() => []),
          api.getVouchers(company.company_id, 'PURCHASE', undefined, undefined).catch(() => []),
          api.getNextVoucherNumber(company.company_id, activeFy?.fy_id, 'PAYMENT').catch(() => null)
        ]);

        if (isMounted) {
          setParties(Array.isArray(partyList) ? partyList : []);
          const validLedgers = Array.isArray(ledgerList) ? ledgerList : [];
          setLedgers(validLedgers);
          setAllPurchaseInvoices(Array.isArray(purchaseList) ? purchaseList : []);

          if (nextNum?.nextVoucherNumber) {
            setPaymentNumber(nextNum.nextVoucherNumber);
          } else {
            setPaymentNumber(`PMT-${new Date().getFullYear()}-0001`);
          }

          // Auto-select first Bank or Cash ledger for Paid From
          const defaultBank = validLedgers.find(l => {
            const name = l.ledger_name.toLowerCase();
            const grp = (l.group_name || '').toLowerCase();
            return grp.includes('bank') || name.includes('bank') || grp.includes('cash') || name.includes('cash');
          });
          if (defaultBank) {
            setPaidFromLedgerId(defaultBank.ledger_id);
          } else if (validLedgers.length > 0) {
            setPaidFromLedgerId(validLedgers[0].ledger_id);
          }

          // Auto-select first Expense ledger
          const defaultExp = validLedgers.find(l => {
            const grp = (l.group_name || '').toLowerCase();
            return grp.includes('expense') || grp.includes('expenditure');
          });
          if (defaultExp) {
            setSelectedExpenseLedgerId(defaultExp.ledger_id);
          }
        }
      } catch (err) {
        console.error('Failed to load initial masters for payment:', err);
      } finally {
        if (isMounted) setLoadingMasters(false);
      }
    };

    loadMasters();
    return () => {
      isMounted = false;
    };
  }, [company, activeFy]);

  // 2. Load Outstanding Invoices for Selected Supplier
  const loadSupplierOutstanding = (supId: string) => {
    if (!supId) {
      setOutstandingInvoices([]);
      setSelectedInvoiceIds([]);
      return;
    }

    setLoadingInvoices(true);
    const matchedInvoices = allPurchaseInvoices.filter(v =>
      v.party_id === supId && v.status === 'POSTED'
    );

    const rows: OutstandingInvoiceRow[] = [];
    matchedInvoices.forEach(inv => {
      const totalPaise = Number(inv.total_amount_paise) || 0;
      const paidPaise = Number(inv.paid_amount_paise) || 0;
      const outstandingPaise = Math.max(0, totalPaise - paidPaise);

      if (outstandingPaise > 0) {
        rows.push({
          voucherId: inv.voucher_id,
          voucherNumber: inv.voucher_number,
          voucherDate: inv.voucher_date,
          totalAmountPaise: totalPaise,
          paidAmountPaise: paidPaise,
          outstandingPaise,
          allocatedPaise: 0
        });
      }
    });

    setOutstandingInvoices(rows);
    setSelectedInvoiceIds([]);
    setLoadingInvoices(false);
  };

  useEffect(() => {
    if (paymentType === 'PURCHASE') {
      loadSupplierOutstanding(selectedSupplierId);
    }
  }, [selectedSupplierId, allPurchaseInvoices, paymentType]);

  // Selected Supplier Party Object
  const selectedSupplier = useMemo(() => {
    return parties.find(p => p.party_id === selectedSupplierId);
  }, [parties, selectedSupplierId]);

  // Filtered Expense Ledgers
  const expenseLedgers = useMemo(() => {
    return ledgers.filter(l => {
      const grp = (l.group_name || '').toLowerCase();
      const gid = (l.group_id || '').toLowerCase();
      return grp.includes('expense') || grp.includes('expenditure') || gid.includes('exp');
    });
  }, [ledgers]);

  // Bank & Cash Ledgers for Paid From
  const bankAndCashLedgers = useMemo(() => {
    return ledgers.filter(l => {
      const grp = (l.group_name || '').toLowerCase();
      const name = l.ledger_name.toLowerCase();
      return grp.includes('bank') || grp.includes('cash') || name.includes('bank') || name.includes('cash');
    });
  }, [ledgers]);

  // Currency Formatter
  const formatINR = (paise: number) => {
    const rupees = (paise / 100).toFixed(2);
    const parts = rupees.split('.');
    const integerPart = parseInt(parts[0], 10);
    return '₹ ' + (isNaN(integerPart) ? '0.00' : integerPart.toLocaleString('en-IN') + '.' + parts[1]);
  };

  // 3. Amount & Allocation Calculations
  const paymentAmountPaise = useMemo(() => {
    const parsed = parseFloat(enteredPaymentAmount.replace(/,/g, ''));
    if (isNaN(parsed) || parsed < 0) return 0;
    return Math.round(parsed * 100);
  }, [enteredPaymentAmount]);

  const totalAllocatedPaise = useMemo(() => {
    if (paymentType !== 'PURCHASE') return 0;
    return outstandingInvoices
      .filter(inv => selectedInvoiceIds.includes(inv.voucherId))
      .reduce((sum, inv) => sum + (inv.allocatedPaise || 0), 0);
  }, [outstandingInvoices, selectedInvoiceIds, paymentType]);

  const unallocatedPaise = useMemo(() => {
    if (paymentType !== 'PURCHASE') return 0;
    return Math.max(0, paymentAmountPaise - totalAllocatedPaise);
  }, [paymentAmountPaise, totalAllocatedPaise, paymentType]);

  const totalOutstandingPaise = useMemo(() => {
    return outstandingInvoices.reduce((sum, inv) => sum + inv.outstandingPaise, 0);
  }, [outstandingInvoices]);

  // Handle invoice toggle
  const handleToggleInvoice = (voucherId: string) => {
    if (selectedInvoiceIds.includes(voucherId)) {
      setSelectedInvoiceIds(prev => prev.filter(id => id !== voucherId));
      setOutstandingInvoices(prev =>
        prev.map(row => (row.voucherId === voucherId ? { ...row, allocatedPaise: 0 } : row))
      );
    } else {
      setSelectedInvoiceIds(prev => [...prev, voucherId]);
      // Auto-fill available remaining payment pool or entire outstanding
      setOutstandingInvoices(prev =>
        prev.map(row => {
          if (row.voucherId === voucherId) {
            const currentAllocated = prev
              .filter(r => selectedInvoiceIds.includes(r.voucherId))
              .reduce((sum, r) => sum + r.allocatedPaise, 0);
            const remainingPool = Math.max(0, paymentAmountPaise - currentAllocated);
            const autoAlloc = paymentAmountPaise > 0 ? Math.min(row.outstandingPaise, remainingPool) : row.outstandingPaise;
            return { ...row, allocatedPaise: autoAlloc };
          }
          return row;
        })
      );
    }
  };

  // Handle manual allocation amount change
  const handleAllocateAmountChange = (voucherId: string, valStr: string) => {
    const parsed = parseFloat(valStr);
    const newPaise = isNaN(parsed) ? 0 : Math.round(parsed * 100);

    setOutstandingInvoices(prev =>
      prev.map(row => {
        if (row.voucherId === voucherId) {
          const clamped = Math.max(0, Math.min(row.outstandingPaise, newPaise));
          return { ...row, allocatedPaise: clamped };
        }
        return row;
      })
    );

    if (!selectedInvoiceIds.includes(voucherId) && newPaise > 0) {
      setSelectedInvoiceIds(prev => [...prev, voucherId]);
    }
  };

  // Auto-allocate sequentially across all or selected invoices
  const handleAutoAllocate = () => {
    let pool = paymentAmountPaise;
    const targetIds = selectedInvoiceIds.length > 0 ? selectedInvoiceIds : outstandingInvoices.map(i => i.voucherId);

    if (selectedInvoiceIds.length === 0) {
      setSelectedInvoiceIds(targetIds);
    }

    setOutstandingInvoices(prev =>
      prev.map(row => {
        if (targetIds.includes(row.voucherId)) {
          const alloc = Math.min(row.outstandingPaise, pool);
          pool = Math.max(0, pool - alloc);
          return { ...row, allocatedPaise: alloc };
        }
        return row;
      })
    );
  };

  // Filtered displayed invoices based on search
  const displayedInvoices = useMemo(() => {
    if (!invoiceSearch.trim()) return outstandingInvoices;
    const q = invoiceSearch.toLowerCase();
    return outstandingInvoices.filter(
      inv => inv.voucherNumber.toLowerCase().includes(q) || inv.voucherDate.includes(q)
    );
  }, [outstandingInvoices, invoiceSearch]);

  // Selected Debited Ledger / Account Name for Accounting Preview
  const debitAccountName = useMemo(() => {
    if (paymentType === 'PURCHASE') {
      return selectedSupplier?.party_name || 'Select Supplier';
    }
    if (paymentType === 'EXPENSE') {
      const l = ledgers.find(x => x.ledger_id === selectedExpenseLedgerId);
      return l?.ledger_name || 'Select Expense Ledger';
    }
    const l = ledgers.find(x => x.ledger_id === selectedOtherLedgerId);
    return l?.ledger_name || 'Select Target Ledger';
  }, [paymentType, selectedSupplier, selectedExpenseLedgerId, selectedOtherLedgerId, ledgers]);

  // Selected Credited Ledger (Paid From)
  const creditAccountName = useMemo(() => {
    const l = ledgers.find(x => x.ledger_id === paidFromLedgerId);
    return l?.ledger_name || 'Select Paid From Ledger';
  }, [paidFromLedgerId, ledgers]);

  // 4. Save & Post / Save as Draft Handler
  const handleSave = async (isPosting: boolean) => {
    setFormError(null);

    if (!company) {
      setFormError('Company context is required.');
      return;
    }

    if (!paymentDate) {
      setFormError('Please select a payment date.');
      return;
    }

    if (!paidFromLedgerId) {
      setFormError('Please select a "Paid From" bank or cash ledger.');
      return;
    }

    if (paymentAmountPaise <= 0) {
      setFormError('Please enter a valid payment amount greater than zero.');
      return;
    }

    // Validate debit ledger
    let debitLedgerId = '';
    if (paymentType === 'PURCHASE') {
      if (!selectedSupplierId || !selectedSupplier) {
        setFormError('Please select a supplier for Purchase Payment.');
        return;
      }
      debitLedgerId = selectedSupplier.ledger_id || `${company.company_id}_party_${selectedSupplier.party_id}`;
    } else if (paymentType === 'EXPENSE') {
      if (!selectedExpenseLedgerId) {
        setFormError('Please select an Expense Ledger.');
        return;
      }
      debitLedgerId = selectedExpenseLedgerId;
    } else {
      if (!selectedOtherLedgerId) {
        setFormError('Please select a Target Ledger.');
        return;
      }
      debitLedgerId = selectedOtherLedgerId;
    }

    // Verify allocation doesn't exceed payment amount
    if (paymentType === 'PURCHASE' && totalAllocatedPaise > paymentAmountPaise) {
      setFormError('Total allocated amount cannot exceed total payment amount.');
      return;
    }

    setSubmitting(true);
    try {
      // Build Double-Entry Ledger Lines
      // Debit: Supplier or Expense or Other
      // Credit: Bank or Cash (Paid From)
      const customLedgerLines = [
        {
          ledgerId: debitLedgerId,
          debitPaise: paymentAmountPaise,
          creditPaise: 0,
          particulars: narration || `Payment via ${paymentMode}`
        },
        {
          ledgerId: paidFromLedgerId,
          debitPaise: 0,
          creditPaise: paymentAmountPaise,
          particulars: narration || `Paid to ${debitAccountName}`
        }
      ];

      // Build bill allocations array for Purchase Payment
      const billAllocations: Array<{
        referenceVoucherId?: string;
        allocationType: 'AGAINST_REF' | 'ON_ACCOUNT';
        amountPaise: number;
      }> = [];

      if (paymentType === 'PURCHASE') {
        outstandingInvoices
          .filter(inv => selectedInvoiceIds.includes(inv.voucherId) && inv.allocatedPaise > 0)
          .forEach(inv => {
            billAllocations.push({
              referenceVoucherId: inv.voucherId,
              allocationType: 'AGAINST_REF',
              amountPaise: inv.allocatedPaise
            });
          });

        // If unallocated remainder exists, assign as ON_ACCOUNT (Supplier Advance)
        if (unallocatedPaise > 0) {
          billAllocations.push({
            referenceVoucherId: undefined,
            allocationType: 'ON_ACCOUNT',
            amountPaise: unallocatedPaise
          });
        }
      }

      const draftMetadata = {
        paymentType,
        originalTerms: termsText,
        notes: internalNotes || undefined
      };

      const payload = {
        companyId: company.company_id,
        fyId: activeFy?.fy_id,
        voucherType: 'PAYMENT',
        voucherNumber: paymentNumber || undefined,
        voucherDate: paymentDate,
        referenceNumber: referenceNumber || undefined,
        referenceDate: referenceDate || undefined,
        paymentMode,
        termsConditions: JSON.stringify(draftMetadata),
        partyId: paymentType === 'PURCHASE' ? selectedSupplierId : undefined,
        narration: narration || `Payment towards ${debitAccountName}`,
        lines: [],
        customLedgerLines,
        billAllocations: billAllocations.length > 0 ? billAllocations : undefined,
        status: isPosting ? ('POSTED' as const) : ('DRAFT' as const),
        notes: internalNotes || undefined
      };

      const result = await api.postVoucher(payload);
      onSaveSuccess(result.voucherId || result.voucher_id, isPosting);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save payment voucher');
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
            <span onClick={onBack} style={{ cursor: 'pointer', color: '#F97316' }}>Payments</span>
            <span>&gt;</span>
            <span>Record Payment</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#FFF7ED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EA580C'
              }}
            >
              <Wallet size={18} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--color-text, #0F172A)' }}>
              Record Payment
            </h1>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--color-text-secondary, #64748B)' }}>
            Make payments to suppliers, record expenses or other business payments.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSave(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              border: '1px solid var(--color-border, #CBD5E1)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Save size={15} />
            Save as Draft
          </button>

          {onPreview && (
            <button
              type="button"
              onClick={() => onPreview({ paymentAmountPaise, paymentNumber, paymentDate, debitAccountName, creditAccountName })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                color: 'var(--color-text, #0F172A)',
                border: '1px solid var(--color-border, #CBD5E1)',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Eye size={15} />
              Preview
            </button>
          )}

          {onPrint && (
            <button
              type="button"
              onClick={() => onPrint({ paymentAmountPaise, paymentNumber, paymentDate, debitAccountName, creditAccountName })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                color: 'var(--color-text, #0F172A)',
                border: '1px solid var(--color-border, #CBD5E1)',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Printer size={15} />
              Print / PDF
            </button>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSave(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#F97316',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 18px',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(249, 115, 22, 0.3)'
            }}
          >
            {submitting ? <RefreshCw size={15} className="animate-spin" /> : <Check size={16} />}
            Save & Post
          </button>
        </div>
      </div>

      {formError && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#B91C1C',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertCircle size={16} />
          <span>{formError}</span>
        </div>
      )}

      {/* ── SECTION 1: PAYMENT TYPE SELECTOR (3 CARDS) ── */}
      <div
        style={{
          background: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)', marginBottom: '12px' }}>
          Payment Type <span style={{ color: '#EF4444' }}>*</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          {/* 1. Purchase Payment */}
          <div
            onClick={() => {
              setPaymentType('PURCHASE');
              setNarration('Payment towards purchase invoices.');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              border: paymentType === 'PURCHASE' ? '2px solid #F97316' : '1px solid var(--color-border, #E2E8F0)',
              background: paymentType === 'PURCHASE' ? 'var(--color-surface-secondary, #FFF7ED)' : 'var(--color-surface, #FFFFFF)',
              transition: 'all 0.2s ease'
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: paymentType === 'PURCHASE' ? '#FED7AA' : 'var(--color-surface-secondary, #F1F5F9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: paymentType === 'PURCHASE' ? '#C2410C' : '#64748B'
              }}
            >
              <Package size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                Purchase Payment
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)', marginTop: '2px' }}>
                Pay supplier and allocate against purchase invoices
              </div>
            </div>
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: paymentType === 'PURCHASE' ? '5px solid #F97316' : '2px solid var(--color-border, #CBD5E1)',
                backgroundColor: '#FFFFFF'
              }}
            />
          </div>

          {/* 2. Expense Payment */}
          <div
            onClick={() => {
              setPaymentType('EXPENSE');
              setNarration('Office operational expense.');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              border: paymentType === 'EXPENSE' ? '2px solid #F97316' : '1px solid var(--color-border, #E2E8F0)',
              background: paymentType === 'EXPENSE' ? 'var(--color-surface-secondary, #FFF7ED)' : 'var(--color-surface, #FFFFFF)',
              transition: 'all 0.2s ease'
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: paymentType === 'EXPENSE' ? '#FED7AA' : 'var(--color-surface-secondary, #F1F5F9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: paymentType === 'EXPENSE' ? '#C2410C' : '#64748B'
              }}
            >
              <FileText size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                Expense Payment
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)', marginTop: '2px' }}>
                Pay for business expenses (e.g., rent, electricity)
              </div>
            </div>
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: paymentType === 'EXPENSE' ? '5px solid #F97316' : '2px solid var(--color-border, #CBD5E1)',
                backgroundColor: '#FFFFFF'
              }}
            />
          </div>

          {/* 3. Other Payment */}
          <div
            onClick={() => {
              setPaymentType('OTHER');
              setNarration('Other corporate payout / advance.');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              border: paymentType === 'OTHER' ? '2px solid #F97316' : '1px solid var(--color-border, #E2E8F0)',
              background: paymentType === 'OTHER' ? 'var(--color-surface-secondary, #FFF7ED)' : 'var(--color-surface, #FFFFFF)',
              transition: 'all 0.2s ease'
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: paymentType === 'OTHER' ? '#FED7AA' : 'var(--color-surface-secondary, #F1F5F9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: paymentType === 'OTHER' ? '#C2410C' : '#64748B'
              }}
            >
              <Layers size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                Other Payment
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)', marginTop: '2px' }}>
                Other business payments (e.g., advance, deposit)
              </div>
            </div>
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: paymentType === 'OTHER' ? '5px solid #F97316' : '2px solid var(--color-border, #CBD5E1)',
                backgroundColor: '#FFFFFF'
              }}
            />
          </div>
        </div>
      </div>

      {/* ── SECTION 2: FORM CARDS (GRID OF 3) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px'
        }}
      >
        {/* Card 1: Supplier / Expense / Target Account Details */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={17} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              {paymentType === 'PURCHASE' ? 'Supplier / Party Details' : paymentType === 'EXPENSE' ? 'Expense Account Details' : 'Target Account Details'}
            </span>
          </div>

          {paymentType === 'PURCHASE' ? (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
                  Supplier <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #CBD5E1)',
                    backgroundColor: 'var(--input-bg, #FFFFFF)',
                    color: 'var(--color-text, #0F172A)',
                    fontSize: '13px'
                  }}
                >
                  <option value="">Select Supplier...</option>
                  {parties.map(p => (
                    <option key={p.party_id} value={p.party_id}>
                      {p.party_name} {p.gstin ? `(${p.gstin})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSupplier ? (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-surface-secondary, #F8FAFC)',
                    border: '1px solid var(--color-border, #E2E8F0)',
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                    {selectedSupplier.party_name}
                  </div>
                  {selectedSupplier.address_line1 && (
                    <div style={{ color: 'var(--color-text-secondary, #64748B)' }}>
                      {selectedSupplier.address_line1}, {selectedSupplier.city} {selectedSupplier.state}
                    </div>
                  )}
                  {selectedSupplier.gstin && (
                    <div style={{ color: 'var(--color-text-secondary, #64748B)' }}>
                      GSTIN: <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>{selectedSupplier.gstin}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #94A3B8)', fontStyle: 'italic' }}>
                  Select a supplier to look up pending purchase bills and contact details.
                </div>
              )}
            </>
          ) : paymentType === 'EXPENSE' ? (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
                  Expense Ledger <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={selectedExpenseLedgerId}
                  onChange={(e) => setSelectedExpenseLedgerId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #CBD5E1)',
                    backgroundColor: 'var(--input-bg, #FFFFFF)',
                    color: 'var(--color-text, #0F172A)',
                    fontSize: '13px'
                  }}
                >
                  <option value="">Select Expense Ledger...</option>
                  {(expenseLedgers.length > 0 ? expenseLedgers : ledgers).map(l => (
                    <option key={l.ledger_id} value={l.ledger_id}>
                      {l.ledger_name} ({l.group_name || 'Expense'})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', padding: '6px 0' }}>
                Operational expenses will be debited directly to the selected ledger account.
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
                  Target Ledger <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={selectedOtherLedgerId}
                  onChange={(e) => setSelectedOtherLedgerId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #CBD5E1)',
                    backgroundColor: 'var(--input-bg, #FFFFFF)',
                    color: 'var(--color-text, #0F172A)',
                    fontSize: '13px'
                  }}
                >
                  <option value="">Select Target Ledger...</option>
                  {ledgers.map(l => (
                    <option key={l.ledger_id} value={l.ledger_id}>
                      {l.ledger_name} ({l.group_name || 'General'})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', padding: '6px 0' }}>
                Used for fixed assets, capital withdrawals, loans, advances, or inter-company transfers.
              </div>
            </>
          )}
        </div>

        {/* Card 2: Payment Details */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={17} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Payment Details
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
                Payment No. <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={paymentNumber}
                  onChange={(e) => setPaymentNumber(e.target.value)}
                  placeholder="PMT-2026-0001"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #CBD5E1)',
                    backgroundColor: 'var(--input-bg, #FFFFFF)',
                    color: 'var(--color-text, #0F172A)',
                    fontSize: '13px',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontWeight: 600
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
                Payment Date <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--input-bg, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)',
                  fontSize: '13px'
                }}
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
              placeholder="e.g. UTR1234567890 / Cheque No."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #CBD5E1)',
                backgroundColor: 'var(--input-bg, #FFFFFF)',
                color: 'var(--color-text, #0F172A)',
                fontSize: '13px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
              Narration (Optional)
            </label>
            <input
              type="text"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="Payment remarks or invoice details..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #CBD5E1)',
                backgroundColor: 'var(--input-bg, #FFFFFF)',
                color: 'var(--color-text, #0F172A)',
                fontSize: '13px'
              }}
            />
          </div>
        </div>

        {/* Card 3: Payment Mode */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={17} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Payment Mode
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
              Paid From (Ledger) <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              value={paidFromLedgerId}
              onChange={(e) => setPaidFromLedgerId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #CBD5E1)',
                backgroundColor: 'var(--input-bg, #FFFFFF)',
                color: 'var(--color-text, #0F172A)',
                fontSize: '13px'
              }}
            >
              <option value="">Select Bank / Cash Ledger...</option>
              {(bankAndCashLedgers.length > 0 ? bankAndCashLedgers : ledgers).map(l => (
                <option key={l.ledger_id} value={l.ledger_id}>
                  {l.ledger_name} ({l.group_name || 'Bank/Cash'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
              Payment Mode <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #CBD5E1)',
                backgroundColor: 'var(--input-bg, #FFFFFF)',
                color: 'var(--color-text, #0F172A)',
                fontSize: '13px'
              }}
            >
              <option value="Bank Transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
              <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
              Reference Date (Optional)
            </label>
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #CBD5E1)',
                backgroundColor: 'var(--input-bg, #FFFFFF)',
                color: 'var(--color-text, #0F172A)',
                fontSize: '13px'
              }}
            />
          </div>
        </div>
      </div>

      {/* ── SECTION 3: INVOICE ALLOCATION (FOR PURCHASE PAYMENT) ── */}
      {paymentType === 'PURCHASE' && (
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '20px 24px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} style={{ color: '#F97316' }} />
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                  Invoice Allocation
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                Select outstanding purchase invoices to allocate this payment.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Search invoice no..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 30px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border, #CBD5E1)',
                    backgroundColor: 'var(--input-bg, #FFFFFF)',
                    color: 'var(--color-text, #0F172A)',
                    fontSize: '12px'
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleAutoAllocate}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Auto Allocate
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={displayedInvoices.length > 0 && selectedInvoiceIds.length === displayedInvoices.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInvoiceIds(displayedInvoices.map(i => i.voucherId));
                        } else {
                          setSelectedInvoiceIds([]);
                        }
                      }}
                    />
                  </th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>INVOICE NO.</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>INVOICE DATE</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>INVOICE AMOUNT (₹)</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>OUTSTANDING (₹)</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', width: '160px' }}>ALLOCATE AMOUNT (₹)</th>
                </tr>
              </thead>
              <tbody>
                {displayedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted, #94A3B8)' }}>
                      {selectedSupplierId
                        ? 'No unpaid purchase invoices found for this supplier. Any payment will be recorded as Supplier Advance (On Account).'
                        : 'Please select a supplier above to see unpaid purchase bills.'}
                    </td>
                  </tr>
                ) : (
                  displayedInvoices.map(inv => {
                    const isSelected = selectedInvoiceIds.includes(inv.voucherId);

                    return (
                      <tr
                        key={inv.voucherId}
                        style={{
                          borderBottom: '1px solid var(--color-border, #F1F5F9)',
                          backgroundColor: isSelected ? 'var(--color-surface-secondary, #FFF7ED)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '10px 10px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleInvoice(inv.voucherId)}
                          />
                        </td>
                        <td style={{ padding: '10px 10px', fontWeight: 600, color: '#EA580C' }}>
                          {inv.voucherNumber}
                        </td>
                        <td style={{ padding: '10px 10px', color: 'var(--color-text, #0F172A)' }}>
                          {inv.voucherDate
                            ? new Date(inv.voucherDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 500, color: 'var(--color-text, #0F172A)' }}>
                          {formatINR(inv.totalAmountPaise)}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                          {formatINR(inv.outstandingPaise)}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={(inv.allocatedPaise / 100).toFixed(2)}
                            onChange={(e) => handleAllocateAmountChange(inv.voucherId, e.target.value)}
                            style={{
                              width: '130px',
                              padding: '5px 8px',
                              textAlign: 'right',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border, #CBD5E1)',
                              backgroundColor: 'var(--input-bg, #FFFFFF)',
                              color: 'var(--color-text, #0F172A)',
                              fontSize: '12.5px',
                              fontWeight: 600
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

          {/* Allocation Footer Summary */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              backgroundColor: 'var(--color-surface-secondary, #F8FAFC)',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--color-text, #0F172A)'
            }}
          >
            <div>
              Selected: <span style={{ color: '#F97316' }}>{selectedInvoiceIds.length} Invoices</span>
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div>
                Total Outstanding: <span style={{ color: '#0F172A' }}>{formatINR(totalOutstandingPaise)}</span>
              </div>
              <div>
                Total Allocated: <span style={{ color: '#16A34A' }}>{formatINR(totalAllocatedPaise)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 4: AMOUNT SUMMARY & ACCOUNTING PREVIEW (GRID OF 2) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
          gap: '16px'
        }}
      >
        {/* Left: Amount Summary */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '20px 24px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={18} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Amount Summary
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
              Payment Amount <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={enteredPaymentAmount}
              onChange={(e) => setEnteredPaymentAmount(e.target.value)}
              placeholder="0.00"
              style={{
                width: '180px',
                padding: '8px 12px',
                textAlign: 'right',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #CBD5E1)',
                backgroundColor: 'var(--input-bg, #FFFFFF)',
                color: 'var(--color-text, #0F172A)',
                fontSize: '15px',
                fontWeight: 700
              }}
            />
          </div>

          {paymentType === 'PURCHASE' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Allocated Amount</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                  {formatINR(totalAllocatedPaise)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Unallocated (Advance)</span>
                <span style={{ fontWeight: 600, color: unallocatedPaise > 0 ? '#F97316' : 'var(--color-text, #0F172A)' }}>
                  {formatINR(unallocatedPaise)}
                </span>
              </div>
            </>
          )}

          {/* Prominent Total Payment highlight bar */}
          <div
            style={{
              marginTop: '4px',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#FFF7ED',
              border: '1px solid #FFEDD5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#EA580C' }}>
              Total Payment
            </span>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#EA580C' }}>
              {formatINR(paymentAmountPaise)}
            </span>
          </div>
        </div>

        {/* Right: Accounting Preview */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '20px 24px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Accounting Preview
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', marginTop: '6px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', fontWeight: 600, width: '45px' }}>TYPE</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>LEDGER</th>
                <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>AMOUNT (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--color-border, #F1F5F9)' }}>
                <td style={{ padding: '8px 8px', fontWeight: 700, color: '#2563EB' }}>Dr</td>
                <td style={{ padding: '8px 8px', color: 'var(--color-text, #0F172A)', fontWeight: 500 }}>
                  {debitAccountName}
                </td>
                <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                  {formatINR(paymentAmountPaise).replace('₹ ', '')}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px 8px', fontWeight: 700, color: '#16A34A' }}>Cr</td>
                <td style={{ padding: '8px 8px', color: 'var(--color-text, #0F172A)', fontWeight: 500 }}>
                  {creditAccountName}
                </td>
                <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                  {formatINR(paymentAmountPaise).replace('₹ ', '')}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 'auto', paddingTop: '10px', fontSize: '11.5px', color: 'var(--color-text-muted, #94A3B8)', fontStyle: 'italic' }}>
            Balances will be posted atomically upon clicking "Save & Post".
          </div>
        </div>
      </div>

      {/* ── SECTION 5: TERMS AND NOTES ── */}
      <div
        style={{
          background: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '20px 24px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={17} style={{ color: '#F97316' }} />
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
            Terms and Notes
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
              Standard Terms & Conditions
            </label>
            <textarea
              rows={3}
              value={termsText}
              onChange={(e) => setTermsText(e.target.value)}
              placeholder="Enter terms, notes or additional details..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #CBD5E1)',
                backgroundColor: 'var(--input-bg, #FFFFFF)',
                color: 'var(--color-text, #0F172A)',
                fontSize: '12.5px',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
              Internal Notes (Not shown on print vouchers)
            </label>
            <textarea
              rows={3}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Internal tracking notes, approvals, or reconciliation remarks..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #CBD5E1)',
                backgroundColor: 'var(--input-bg, #FFFFFF)',
                color: 'var(--color-text, #0F172A)',
                fontSize: '12.5px',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
