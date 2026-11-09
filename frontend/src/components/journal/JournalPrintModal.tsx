import React, { useRef, useEffect, useState } from 'react';
import { Company, api } from '../../api/client';
import { numberToIndianWords } from '../invoice/InvoiceAdapter';
import { Printer, X } from 'lucide-react';

export interface JournalPrintModalProps {
  voucherId: string | null;
  company: Company | null;
  onClose: () => void;
}

export const JournalPrintModal: React.FC<JournalPrintModalProps> = ({
  voucherId,
  company,
  onClose
}) => {
  const [loading, setLoading] = useState(true);
  const [voucherData, setVoucherData] = useState<any>(null);
  const printContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!voucherId) return;
    setLoading(true);
    api
      .getVoucherById(voucherId)
      .then((data) => {
        setVoucherData(data);
      })
      .catch((err) => {
        console.error('Failed to load voucher for printing:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [voucherId]);

  if (!voucherId) return null;

  const voucher = voucherData?.voucher;
  const ledgerEntries = voucherData?.ledgerEntries || [];
  const lines = voucherData?.lines || [];

  // Parse lines for printout
  let printLines: Array<{
    idx: number;
    ledgerName: string;
    particulars: string;
    debitPaise: number;
    creditPaise: number;
  }> = [];

  if (ledgerEntries.length > 0) {
    printLines = ledgerEntries.map((le: any, i: number) => ({
      idx: i + 1,
      ledgerName: le.ledger_name || 'Ledger Account',
      particulars: le.particulars || voucher?.narration || '',
      debitPaise: Number(le.debit_paise) || 0,
      creditPaise: Number(le.credit_paise) || 0
    }));
  } else if (lines.length > 0) {
    printLines = lines.map((l: any, i: number) => ({
      idx: i + 1,
      ledgerName: l.ledger_name || 'Ledger Account',
      particulars: l.description || voucher?.narration || '',
      debitPaise: l.serial_number === 'DR' ? Number(l.total_amount_paise) || 0 : 0,
      creditPaise: l.serial_number === 'CR' ? Number(l.total_amount_paise) || 0 : 0
    }));
  }

  let totalDebitPaise = printLines.reduce((acc, l) => acc + l.debitPaise, 0);
  let totalCreditPaise = printLines.reduce((acc, l) => acc + l.creditPaise, 0);

  if (totalDebitPaise === 0 && voucher?.total_amount_paise) {
    totalDebitPaise = Number(voucher.total_amount_paise) || 0;
    totalCreditPaise = totalDebitPaise;
  }

  const formatCurrency = (paise: number) => {
    const rs = Math.abs(paise) / 100;
    return '₹ ' + rs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatAmountNoSymbol = (paise: number) => {
    const rs = Math.abs(paise) / 100;
    return rs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Controls (Not printed) */}
        <div
          className="no-print"
          style={{
            padding: '12px 20px',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
            Print Preview — {voucher?.voucher_number || 'Journal Voucher'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#F97316',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Printer size={14} /> Print Document
            </button>
            <button
              onClick={onClose}
              style={{
                border: 'none',
                background: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: '#64748B'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div style={{ overflowY: 'auto', padding: '32px', backgroundColor: '#F1F5F9', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>Loading document...</div>
          ) : (
            <div
              ref={printContentRef}
              id="printable-journal-area"
              style={{
                backgroundColor: '#FFFFFF',
                padding: '36px',
                margin: '0 auto',
                maxWidth: '750px',
                border: '1px solid #CBD5E1',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                color: '#0F172A',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
            >
              {/* Company Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0F172A', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 700, color: '#0F172A' }}>
                    {company?.legal_name || company?.company_name || 'Dream Tech Solutions LLP'}
                  </h2>
                  <div style={{ fontSize: '11.5px', color: '#475569', lineHeight: 1.4 }}>
                    <div>{company?.address_line1 || '123 Business Avenue'}</div>
                    <div>
                      {company?.city || 'Bengaluru'}, {company?.state || 'Karnataka'} - {company?.pincode || '560100'}
                    </div>
                    {company?.gstin && <div>GSTIN: <strong>{company.gstin}</strong></div>}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#F97316', letterSpacing: '0.05em' }}>
                    JOURNAL VOUCHER
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                    {voucher?.voucher_number}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px' }}>
                    Date: <strong>{formatDate(voucher?.voucher_date)}</strong>
                  </div>
                </div>
              </div>

              {/* Metadata Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: '#64748B' }}>Entry Type:</span>{' '}
                  <strong style={{ color: '#0F172A' }}>{voucher?.payment_mode || 'Adjustment Entry'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Reference Number:</span>{' '}
                  <strong style={{ color: '#0F172A' }}>{voucher?.reference_number || '—'}</strong>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: '#64748B' }}>Narration:</span>{' '}
                  <span style={{ color: '#0F172A', fontStyle: 'italic' }}>{voucher?.narration || '—'}</span>
                </div>
              </div>

              {/* Table of Ledger Entries */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F1F5F9', borderTop: '1px solid #0F172A', borderBottom: '1px solid #0F172A' }}>
                    <th style={{ padding: '8px', textAlign: 'center', width: '36px' }}>#</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Ledger Account</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Particulars / Narration</th>
                    <th style={{ padding: '8px', textAlign: 'right', width: '130px' }}>Debit (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'right', width: '130px' }}>Credit (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {printLines.map((row) => (
                    <tr key={row.idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#64748B' }}>{row.idx}</td>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{row.ledgerName}</td>
                      <td style={{ padding: '8px', color: '#475569' }}>{row.particulars || '—'}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {row.debitPaise > 0 ? formatAmountNoSymbol(row.debitPaise) : '—'}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {row.creditPaise > 0 ? formatAmountNoSymbol(row.creditPaise) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #0F172A', borderBottom: '2px solid #0F172A', fontWeight: 700, backgroundColor: '#F8FAFC' }}>
                    <td colSpan={3} style={{ padding: '10px 8px', textAlign: 'right' }}>Total:</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCurrency(totalDebitPaise)}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCurrency(totalCreditPaise)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Amount in words */}
              <div style={{ backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '4px', border: '1px solid #E2E8F0', marginBottom: '32px', fontSize: '12px' }}>
                <span style={{ color: '#64748B' }}>Amount in Words:</span>{' '}
                <strong style={{ color: '#0F172A' }}>
                  {numberToIndianWords(Math.round(totalDebitPaise / 100))} Only
                </strong>
              </div>

              {/* Signatory Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '40px', paddingTop: '16px' }}>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  Prepared By: <strong>{voucher?.created_by || 'Admin'}</strong>
                </div>

                <div style={{ textAlign: 'center', width: '200px' }}>
                  <div style={{ borderTop: '1px solid #0F172A', paddingTop: '6px', fontSize: '12px', fontWeight: 600 }}>
                    Authorized Signatory
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '2px' }}>
                    {company?.company_name || 'Dream Tech Solutions'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print CSS rules */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          #printable-journal-area, #printable-journal-area * {
            visibility: visible;
          }
          #printable-journal-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            box-shadow: none;
            border: none;
          }
        }
      `}</style>
    </div>
  );
};
