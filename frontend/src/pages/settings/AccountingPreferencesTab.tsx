import React, { useState } from 'react';
import {
  Coins,
  Calculator,
  BookOpen,
  FileText,
  CreditCard,
  BarChart2,
  Info,
  HelpCircle
} from 'lucide-react';

export interface AccountingPreferencesTabProps {
  formData: any;
  onChange: (field: string, val: any) => void;
  ledgers?: any[];
}

export const AccountingPreferencesTab: React.FC<AccountingPreferencesTabProps> = ({
  formData,
  onChange,
  ledgers = []
}) => {
  // Local state for interactive preferences with sensible accounting defaults
  const [baseCurrency, setBaseCurrency] = useState(formData.currency ? `${formData.currency} - Indian Rupee (₹)` : 'INR - Indian Rupee (₹)');
  const [currencySymbol, setCurrencySymbol] = useState(formData.currency_symbol || '₹');
  const [numberFormat, setNumberFormat] = useState('1,00,000.00 (Indian)');
  const [decimalPlaces, setDecimalPlaces] = useState('2');
  const [dateFormat, setDateFormat] = useState('DD MMM YYYY (30 Sep 2026)');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState('Monday');

  const [roundingMethod, setRoundingMethod] = useState('Nearest Rupee');
  const [roundingThreshold, setRoundingThreshold] = useState('0.50');
  const [useRoundingLedger, setUseRoundingLedger] = useState(false);
  const [roundingLedger, setRoundingLedger] = useState('');

  const [billWise, setBillWise] = useState(true);
  const [costCentres, setCostCentres] = useState(true);
  const [allowNarration, setAllowNarration] = useState(true);
  const [multiCurrency, setMultiCurrency] = useState(false);
  const [auditTrail, setAuditTrail] = useState(true);

  const [defaultSalesLedger, setDefaultSalesLedger] = useState('Sales');
  const [defaultPurchaseLedger, setDefaultPurchaseLedger] = useState('Purchase');
  const [defaultCashLedger, setDefaultCashLedger] = useState('Cash in Hand');
  const [defaultBankLedger, setDefaultBankLedger] = useState('SBI Main');
  const [defaultSalesTaxLedger, setDefaultSalesTaxLedger] = useState('Output CGST');
  const [defaultPurchaseTaxLedger, setDefaultPurchaseTaxLedger] = useState('Input CGST');

  const [chequePrinting, setChequePrinting] = useState(true);
  const [chequeFormat, setChequeFormat] = useState('Standard');
  const [warnPostDated, setWarnPostDated] = useState(true);

  const [showZeroBalance, setShowZeroBalance] = useState(false);
  const [showGroupTotals, setShowGroupTotals] = useState(true);
  const [showPrevYear, setShowPrevYear] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 2-Column Grid of 6 Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>
        {/* Card 1: Currency & Display */}
        <div
          style={{
            padding: '22px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
              <Coins size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Currency & Display
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
                Configure base currency, number and date formats.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Base Currency <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={baseCurrency}
                onChange={e => {
                  setBaseCurrency(e.target.value);
                  onChange('currency', e.target.value.substring(0, 3));
                }}
              >
                <option value="INR - Indian Rupee (₹)">INR - Indian Rupee (₹)</option>
                <option value="USD - US Dollar ($)">USD - US Dollar ($)</option>
                <option value="EUR - Euro (€)">EUR - Euro (€)</option>
                <option value="GBP - British Pound (£)">GBP - British Pound (£)</option>
                <option value="AED - UAE Dirham (د.إ)">AED - UAE Dirham (د.إ)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Currency Symbol
              </label>
              <input
                type="text"
                className="form-control"
                value={currencySymbol}
                onChange={e => {
                  setCurrencySymbol(e.target.value);
                  onChange('currency_symbol', e.target.value);
                }}
                placeholder="₹"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Number Format
              </label>
              <select className="form-control" value={numberFormat} onChange={e => setNumberFormat(e.target.value)}>
                <option value="1,00,000.00 (Indian)">1,00,000.00 (Indian)</option>
                <option value="100,000.00 (Million/Billion)">100,000.00 (Million/Billion)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Decimal Places
              </label>
              <select className="form-control" value={decimalPlaces} onChange={e => setDecimalPlaces(e.target.value)}>
                <option value="2">2</option>
                <option value="0">0 (Integer)</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Date Format
              </label>
              <select className="form-control" value={dateFormat} onChange={e => setDateFormat(e.target.value)}>
                <option value="DD MMM YYYY (30 Sep 2026)">DD MMM YYYY (30 Sep 2026)</option>
                <option value="DD/MM/YYYY (30/09/2026)">DD/MM/YYYY (30/09/2026)</option>
                <option value="YYYY-MM-DD (2026-09-30)">YYYY-MM-DD (2026-09-30)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                First Day of Week
              </label>
              <select className="form-control" value={firstDayOfWeek} onChange={e => setFirstDayOfWeek(e.target.value)}>
                <option value="Monday">Monday</option>
                <option value="Sunday">Sunday</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 2: Rounding & Amount Handling */}
        <div
          style={{
            padding: '22px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
              <Calculator size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Rounding & Amount Handling
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
                Control how amounts are rounded and displayed in vouchers and reports.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Rounding Method
              </label>
              <select className="form-control" value={roundingMethod} onChange={e => setRoundingMethod(e.target.value)}>
                <option value="Nearest Rupee">Nearest Rupee</option>
                <option value="Normal Rounding (Half Up)">Normal Rounding (Half Up)</option>
                <option value="Round Down (Floor)">Round Down (Floor)</option>
                <option value="Round Up (Ceil)">Round Up (Ceil)</option>
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)' }}>
                  Rounding Threshold
                </label>
                <HelpCircle size={13} style={{ color: '#94A3B8' }} />
              </div>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={roundingThreshold}
                onChange={e => setRoundingThreshold(e.target.value)}
              />
            </div>
          </div>

          <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '12px', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={15} />
            <span>Amounts will be rounded to the nearest rupee based on the above method.</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '16px', alignItems: 'center', paddingTop: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useRoundingLedger}
                onChange={e => setUseRoundingLedger(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#F97316' }}
              />
              <span>Use Separate Rounding Ledger (if supported)</span>
            </label>

            <div>
              <select
                className="form-control"
                disabled={!useRoundingLedger}
                value={roundingLedger}
                onChange={e => setRoundingLedger(e.target.value)}
                style={{ fontSize: '12px', opacity: useRoundingLedger ? 1 : 0.6 }}
              >
                <option value="">Select ledger...</option>
                <option value="Round Off Account">Round Off Account</option>
                {ledgers.map(l => (
                  <option key={l.ledger_id} value={l.ledger_name}>{l.ledger_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Card 3: Accounting Behaviour */}
        <div
          style={{
            padding: '22px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
              <BookOpen size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Accounting Behaviour
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
                Configure core accounting behaviour and defaults.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Enable Bill-wise Details</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Maintain outstanding by reference to individual bills.</div>
              </div>
              <input type="checkbox" checked={billWise} onChange={e => setBillWise(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Enable Cost Centre / Project</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Track transactions by cost centre or project.</div>
              </div>
              <input type="checkbox" checked={costCentres} onChange={e => setCostCentres(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Allow Narration in Reports</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Show voucher narration in reports and financial statements.</div>
              </div>
              <input type="checkbox" checked={allowNarration} onChange={e => setAllowNarration(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Allow Multi-Currency (if supported)</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Enable transactions in multiple currencies.</div>
              </div>
              <input type="checkbox" checked={multiCurrency} onChange={e => setMultiCurrency(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Maintain Audit Trail</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Track changes made to vouchers and masters.</div>
              </div>
              <input type="checkbox" checked={auditTrail} onChange={e => setAuditTrail(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>
          </div>
        </div>

        {/* Card 4: Transaction Defaults */}
        <div
          style={{
            padding: '22px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
              <FileText size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Transaction Defaults
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
                Set default values for new vouchers.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Default Sales Ledger
              </label>
              <select className="form-control" value={defaultSalesLedger} onChange={e => setDefaultSalesLedger(e.target.value)}>
                <option value="Sales">Sales</option>
                <option value="Services">Services</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Default Purchase Ledger
              </label>
              <select className="form-control" value={defaultPurchaseLedger} onChange={e => setDefaultPurchaseLedger(e.target.value)}>
                <option value="Purchase">Purchase</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Default Cash Ledger
              </label>
              <select className="form-control" value={defaultCashLedger} onChange={e => setDefaultCashLedger(e.target.value)}>
                <option value="Cash in Hand">Cash in Hand</option>
                <option value="Petty Cash">Petty Cash</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Default Bank Ledger
              </label>
              <select className="form-control" value={defaultBankLedger} onChange={e => setDefaultBankLedger(e.target.value)}>
                <option value="SBI Main">SBI Main</option>
                <option value="State Bank of India">State Bank of India</option>
                <option value="HDFC Bank">HDFC Bank</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Default Sales Tax Ledger (if supported)
              </label>
              <select className="form-control" value={defaultSalesTaxLedger} onChange={e => setDefaultSalesTaxLedger(e.target.value)}>
                <option value="Output CGST">Output CGST</option>
                <option value="Output SGST">Output SGST</option>
                <option value="Output IGST">Output IGST</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Default Purchase Tax Ledger (if supported)
              </label>
              <select className="form-control" value={defaultPurchaseTaxLedger} onChange={e => setDefaultPurchaseTaxLedger(e.target.value)}>
                <option value="Input CGST">Input CGST</option>
                <option value="Input SGST">Input SGST</option>
                <option value="Input IGST">Input IGST</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 5: Cheque / Payment Preferences */}
        <div
          style={{
            padding: '22px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
              <CreditCard size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Cheque / Payment Preferences
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
                Control cheque and payment behaviour.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Enable Cheque Printing (if supported)</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Configure layout coordinates for printer feeding.</div>
              </div>
              <input type="checkbox" checked={chequePrinting} onChange={e => setChequePrinting(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)' }}>
                  Default Cheque Format
                </label>
              </div>
              <select className="form-control" value={chequeFormat} onChange={e => setChequeFormat(e.target.value)}>
                <option value="Standard">Standard</option>
                <option value="CTS-2010">CTS-2010</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Warn on Post-dated Cheques</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Show warning for future-dated cheques.</div>
              </div>
              <input type="checkbox" checked={warnPostDated} onChange={e => setWarnPostDated(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>
          </div>
        </div>

        {/* Card 6: Reporting Preferences */}
        <div
          style={{
            padding: '22px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
              <BarChart2 size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Reporting Preferences
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
                Set display preferences for reports and statements.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Show Zero Balance Ledgers</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Include ledgers with zero balance in reports.</div>
              </div>
              <input type="checkbox" checked={showZeroBalance} onChange={e => setShowZeroBalance(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Show Group Totals</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Display group-wise totals in reports.</div>
              </div>
              <input type="checkbox" checked={showGroupTotals} onChange={e => setShowGroupTotals(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Show Previous Year Comparison</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Include previous financial year figures where available.</div>
              </div>
              <input type="checkbox" checked={showPrevYear} onChange={e => setShowPrevYear(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
