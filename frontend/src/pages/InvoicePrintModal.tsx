import React, { useEffect, useState } from 'react';
import { api, Company } from '../api/client';
import { Printer, X, Download } from 'lucide-react';

interface InvoicePrintModalProps {
  voucherId: string;
  company: Company | null;
  onClose: () => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  voucherId,
  company,
  onClose
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getVoucherById(voucherId)
      .then(res => setData(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [voucherId]);

  const formatPaise = (paise: number) => {
    return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const numberToWords = (num: number): string => {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n: number): string => {
      if (n === 0) return '';
      if (n < 20) return a[n] + ' ';
      if (n < 100) return b[Math.floor(n / 10)] + ' ' + a[n % 10] + ' ';
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + inWords(n % 100);
      if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand ' + inWords(n % 1000);
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh ' + inWords(n % 100000);
      return inWords(Math.floor(n / 10000000)) + ' Crore ' + inWords(n % 10000000);
    };

    const rupees = Math.floor(num / 100);
    const paise = num % 100;
    let str = 'Rupees ' + inWords(rupees).trim();
    if (paise > 0) {
      str += ' and ' + inWords(paise).trim() + ' Paise';
    }
    return str + ' Only';
  };

  if (loading || !data) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, color: '#fff' }}>
        Rendering Tax Invoice...
      </div>
    );
  }

  const { voucher, lines } = data;
  const isPurchase = voucher.voucher_type === 'PURCHASE';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 110,
      padding: '20px'
    }}>
      {/* Action Bar (Not Printed) */}
      <div className="no-print" style={{
        width: '850px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px'
      }}>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: '15px' }}>
          {isPurchase ? 'Purchase Voucher Record: ' : 'Document Preview: '}{voucher.voucher_number}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-primary" onClick={() => window.print()}>
            <Printer size={14} /> Print {isPurchase ? 'Purchase Note' : 'Tax Invoice'}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            <X size={14} /> Close
          </button>
        </div>
      </div>

      {/* Printable Invoice Container */}
      <div className="invoice-paper" style={{
        width: '850px',
        maxHeight: '90vh',
        overflowY: 'auto',
        backgroundColor: '#ffffff',
        color: '#000000',
        padding: '30px',
        borderRadius: '6px',
        fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
        fontSize: '12px',
        lineHeight: 1.4,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{ borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, textTransform: 'uppercase', color: '#000' }}>
              {company?.company_name}
            </h1>
            <div style={{ fontSize: '12px', fontWeight: 600 }}>{company?.legal_name}</div>
            <div>{company?.address_line1}, {company?.city} - {company?.pincode}</div>
            <div>State: {company?.state} (Code: {company?.state_code})</div>
            <div>Phone: {company?.phone} | Email: {company?.email}</div>
            <div style={{ fontWeight: 700, marginTop: '2px' }}>GSTIN: {company?.gstin} | PAN: {company?.pan}</div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{
              display: 'inline-block',
              border: '2px solid #000',
              padding: '4px 14px',
              fontWeight: 800,
              fontSize: '15px',
              marginBottom: '6px',
              textTransform: 'uppercase'
            }}>
              {isPurchase ? 'PURCHASE VOUCHER' : 'TAX INVOICE'}
            </div>
            <div style={{ fontSize: '11px', color: '#555' }}>
              {isPurchase ? '(Goods Receipt & Stock Inward Record)' : '(Under Section 31 of GST Act)'}
            </div>
            <div style={{ marginTop: '6px', fontWeight: 700, fontSize: '14px' }}>
              Voucher #: {voucher.voucher_number}
            </div>
            {isPurchase && voucher.reference_number && (
              <div style={{ fontWeight: 600, color: '#000' }}>
                Supplier Inv #: <strong>{voucher.reference_number}</strong>
              </div>
            )}
            <div>Date: <strong>{voucher.voucher_date}</strong></div>
            <div>Place of Supply: <strong>{voucher.state || company?.state}</strong></div>
          </div>
        </div>

        {/* Billed To & Shipped To / Supplier Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #000', marginBottom: '14px' }}>
          <div style={{ padding: '10px', borderRight: '1px solid #000' }}>
            <div style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #ccc', paddingBottom: '2px' }}>
              {isPurchase ? 'SUPPLIER / VENDOR DETAILS:' : 'BILLED TO:'}
            </div>
            <div style={{ fontWeight: 700, fontSize: '13px' }}>{voucher.party_name || (isPurchase ? 'Cash Supplier' : 'Counter Customer')}</div>
            <div>{voucher.address_line1 || 'Main Business Address'}</div>
            <div>{voucher.city} {voucher.pincode}</div>
            <div>State: {voucher.state || company?.state} (Code: {voucher.state_code || company?.state_code})</div>
            <div style={{ fontWeight: 700 }}>GSTIN: {voucher.party_gstin || 'URP (Unregistered Person)'}</div>
          </div>

          <div style={{ padding: '10px' }}>
            <div style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #ccc', paddingBottom: '2px' }}>
              {isPurchase ? 'CONSIGNEE / BILLED TO:' : 'DISPATCH / SHIPPING DETAILS:'}
            </div>
            {isPurchase ? (
              <>
                <div style={{ fontWeight: 700 }}>{company?.company_name}</div>
                <div>{company?.address_line1}, {company?.city}</div>
                <div>GSTIN: {company?.gstin}</div>
                <div>State: {company?.state} ({company?.state_code})</div>
              </>
            ) : (
              <>
                <div>Dispatched through: Road Logistics</div>
                <div>Reverse Charge: <strong>NO</strong></div>
                <div>Payment Terms: Immediate / 30 Days</div>
                <div>Contact: {voucher.party_phone || '-'}</div>
              </>
            )}
          </div>
        </div>

        {/* Itemized Line Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '14px', fontSize: '11.5px' }}>
          <thead>
            <tr style={{ background: '#f0f0f0', borderBottom: '1px solid #000' }}>
              <th style={{ border: '1px solid #000', padding: '6px 4px', width: '30px', textAlign: 'center' }}>#</th>
              <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left' }}>Description of Goods / Services</th>
              <th style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', width: '70px' }}>HSN/SAC</th>
              <th style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'right', width: '50px' }}>Qty</th>
              <th style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', width: '40px' }}>Unit</th>
              <th style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', width: '80px' }}>
                {isPurchase ? 'Cost Rate (₹)' : 'Rate (₹)'}
              </th>
              <th style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', width: '90px' }}>Taxable Value</th>
              <th style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', width: '50px' }}>GST%</th>
              <th style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', width: '90px' }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((ln: any, idx: number) => (
              <tr key={ln.line_id}>
                <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: 600 }}>{ln.item_name}</td>
                <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', fontFamily: 'monospace' }}>{ln.hsn_sac}</td>
                <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'right' }}>{ln.quantity}</td>
                <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center' }}>{ln.unit_symbol}</td>
                <td style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{(ln.rate_paise / 100).toFixed(2)}</td>
                <td style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{(ln.taxable_amount_paise / 100).toFixed(2)}</td>
                <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center' }}>{ln.gst_rate}%</td>
                <td style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{(ln.total_amount_paise / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals & Tax Breakup */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div>
            <div style={{ border: '1px solid #000', padding: '8px', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: '#333' }}>Total Amount in Words:</div>
              <div style={{ fontWeight: 700, fontSize: '12px', marginTop: '2px' }}>
                {numberToWords(voucher.total_amount_paise)}
              </div>
            </div>

            {isPurchase ? (
              <div style={{ border: '1px solid #000', padding: '8px', background: '#f9f9f9' }}>
                <div style={{ fontWeight: 700, fontSize: '11px', color: '#059669', marginBottom: '2px' }}>
                  ✓ INPUT TAX CREDIT (ITC) ELIGIBILITY
                </div>
                <div style={{ fontSize: '11px', color: '#333' }}>
                  Statutory GST input credits accrued and mapped to supplier invoice #{voucher.reference_number || voucher.voucher_number} for GSTR-2B reconciliation.
                </div>
              </div>
            ) : (
              <div style={{ border: '1px solid #000', padding: '8px' }}>
                <div style={{ fontWeight: 700, fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase' }}>Bank Remittance Details:</div>
                <div>Bank: <strong>{company?.bank_name}</strong></div>
                <div>A/c No: <strong>{company?.bank_account_no}</strong></div>
                <div>IFSC Code: <strong>{company?.bank_ifsc}</strong></div>
                <div>Branch: <strong>{company?.bank_branch}</strong></div>
              </div>
            )}
          </div>

          <div style={{ border: '1px solid #000', padding: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Total Taxable Value:</span>
              <span style={{ fontFamily: 'monospace' }}>{formatPaise(voucher.taxable_amount_paise)}</span>
            </div>
            {voucher.cgst_amount_paise > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>{isPurchase ? 'Input CGST (9%):' : 'Output CGST (9%):'}</span>
                <span style={{ fontFamily: 'monospace' }}>{formatPaise(voucher.cgst_amount_paise)}</span>
              </div>
            )}
            {voucher.sgst_amount_paise > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>{isPurchase ? 'Input SGST (9%):' : 'Output SGST (9%):'}</span>
                <span style={{ fontFamily: 'monospace' }}>{formatPaise(voucher.sgst_amount_paise)}</span>
              </div>
            )}
            {voucher.igst_amount_paise > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>{isPurchase ? 'Input IGST (18%):' : 'Output IGST (18%):'}</span>
                <span style={{ fontFamily: 'monospace' }}>{formatPaise(voucher.igst_amount_paise)}</span>
              </div>
            )}
            {voucher.round_off_paise !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#555' }}>
                <span>Round Off:</span>
                <span style={{ fontFamily: 'monospace' }}>{formatPaise(voucher.round_off_paise)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #000', paddingTop: '6px', fontWeight: 800, fontSize: '15px' }}>
              <span>{isPurchase ? 'Total Payable (INR):' : 'Invoice Total (INR):'}</span>
              <span style={{ fontFamily: 'monospace' }}>{formatPaise(voucher.total_amount_paise)}</span>
            </div>
          </div>
        </div>

        {/* Declarations and Signatory */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', border: '1px solid #000', marginTop: '10px' }}>
          <div style={{ padding: '10px', borderRight: '1px solid #000', fontSize: '10px', color: '#333' }}>
            <div style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Terms & Conditions:</div>
            <div>1. Goods once sold will not be taken back.</div>
            <div>2. Interest @ 18% p.a. will be levied on delayed payments beyond credit period.</div>
            <div>3. Disputes subject to local jurisdiction only.</div>
            <div style={{ marginTop: '6px', fontStyle: 'italic' }}>This is a computer generated invoice and follows Indian GST statutory guidelines.</div>
          </div>

          <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100px' }}>
            <div style={{ fontWeight: 700, fontSize: '11px', textAlign: 'right' }}>
              For {company?.company_name}
            </div>
            <div style={{ textAlign: 'right', fontSize: '11px', fontWeight: 600 }}>
              Authorized Signatory
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};
