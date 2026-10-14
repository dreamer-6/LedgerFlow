import React, { useState, useMemo } from 'react';
import { api, Company } from '../../api/client';
import {
  Coins,
  Calculator,
  BookOpen,
  FileText,
  CreditCard,
  BarChart2,
  Info,
  HelpCircle,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';

export interface AccountingPreferencesTabProps {
  company?: Company | null;
  formData: any;
  onChange: (field: string, val: any) => void;
  ledgers?: any[];
  onCompanyUpdated?: () => void;
}

export const AccountingPreferencesTab: React.FC<AccountingPreferencesTabProps> = ({
  company,
  formData,
  onChange,
  ledgers = [],
  onCompanyUpdated
}) => {
  const parsedPrefs = useMemo(() => {
    try {
      const raw = formData.accounting_preferences || company?.accounting_preferences;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [formData.accounting_preferences, company?.accounting_preferences]);

  // Local state for interactive preferences with sensible accounting defaults
  const [baseCurrency, setBaseCurrency] = useState(
    parsedPrefs?.baseCurrency || (formData.currency ? `${formData.currency} - Indian Rupee (₹)` : 'INR - Indian Rupee (₹)')
  );
  const [currencySymbol, setCurrencySymbol] = useState(
    parsedPrefs?.currencySymbol || formData.currency_symbol || '₹'
  );
  const [numberFormat, setNumberFormat] = useState(parsedPrefs?.numberFormat || '1,00,000.00 (Indian)');
  const [decimalPlaces, setDecimalPlaces] = useState(parsedPrefs?.decimalPlaces || '2');
  const [dateFormat, setDateFormat] = useState(parsedPrefs?.dateFormat || 'DD MMM YYYY (30 Sep 2026)');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState(parsedPrefs?.firstDayOfWeek || 'Monday');

  const [roundingMethod, setRoundingMethod] = useState(parsedPrefs?.roundingMethod || 'Nearest Rupee');
  const [roundingThreshold, setRoundingThreshold] = useState(parsedPrefs?.roundingThreshold || '0.50');
  const [useRoundingLedger, setUseRoundingLedger] = useState(parsedPrefs?.useRoundingLedger ?? false);
  const [roundingLedger, setRoundingLedger] = useState(parsedPrefs?.roundingLedger || '');

  const [billWise, setBillWise] = useState(parsedPrefs?.billWise ?? true);
  const [costCentres, setCostCentres] = useState(parsedPrefs?.costCentres ?? true);
  const [allowNarration, setAllowNarration] = useState(parsedPrefs?.allowNarration ?? true);
  const [multiCurrency, setMultiCurrency] = useState(parsedPrefs?.multiCurrency ?? false);
  const [auditTrail, setAuditTrail] = useState(parsedPrefs?.auditTrail ?? true);

  const [defaultSalesLedger, setDefaultSalesLedger] = useState(parsedPrefs?.defaultSalesLedger || 'Sales');
  const [defaultPurchaseLedger, setDefaultPurchaseLedger] = useState(parsedPrefs?.defaultPurchaseLedger || 'Purchase');
  const [defaultCashLedger, setDefaultCashLedger] = useState(parsedPrefs?.defaultCashLedger || 'Cash in Hand');
  const [defaultBankLedger, setDefaultBankLedger] = useState(parsedPrefs?.defaultBankLedger || 'SBI Main');
  const [defaultSalesTaxLedger, setDefaultSalesTaxLedger] = useState(parsedPrefs?.defaultSalesTaxLedger || 'Output CGST');
  const [defaultPurchaseTaxLedger, setDefaultPurchaseTaxLedger] = useState(parsedPrefs?.defaultPurchaseTaxLedger || 'Input CGST');

  const [chequePrinting, setChequePrinting] = useState(parsedPrefs?.chequePrinting ?? true);
  const [chequeFormat, setChequeFormat] = useState(parsedPrefs?.chequeFormat || 'Standard');
  const [warnPostDated, setWarnPostDated] = useState(parsedPrefs?.warnPostDated ?? true);

  const [showZeroBalance, setShowZeroBalance] = useState(parsedPrefs?.showZeroBalance ?? false);
  const [showGroupTotals, setShowGroupTotals] = useState(parsedPrefs?.showGroupTotals ?? true);
  const [showPrevYear, setShowPrevYear] = useState(parsedPrefs?.showPrevYear ?? false);

  // Persistence State
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    const currentObj = {
      baseCurrency,
      currencySymbol,
      numberFormat,
      decimalPlaces,
      dateFormat,
      firstDayOfWeek,
      roundingMethod,
      roundingThreshold,
      useRoundingLedger,
      roundingLedger,
      billWise,
      costCentres,
      allowNarration,
      multiCurrency,
      auditTrail,
      defaultSalesLedger,
      defaultPurchaseLedger,
      defaultCashLedger,
      defaultBankLedger,
      defaultSalesTaxLedger,
      defaultPurchaseTaxLedger,
      chequePrinting,
      chequeFormat,
      warnPostDated,
      showZeroBalance,
      showGroupTotals,
      showPrevYear
    };
    const origObj = {
      baseCurrency: parsedPrefs?.baseCurrency || (formData.currency ? `${formData.currency} - Indian Rupee (₹)` : 'INR - Indian Rupee (₹)'),
      currencySymbol: parsedPrefs?.currencySymbol || formData.currency_symbol || '₹',
      numberFormat: parsedPrefs?.numberFormat || '1,00,000.00 (Indian)',
      decimalPlaces: parsedPrefs?.decimalPlaces || '2',
      dateFormat: parsedPrefs?.dateFormat || 'DD MMM YYYY (30 Sep 2026)',
      firstDayOfWeek: parsedPrefs?.firstDayOfWeek || 'Monday',
      roundingMethod: parsedPrefs?.roundingMethod || 'Nearest Rupee',
      roundingThreshold: parsedPrefs?.roundingThreshold || '0.50',
      useRoundingLedger: parsedPrefs?.useRoundingLedger ?? false,
      roundingLedger: parsedPrefs?.roundingLedger || '',
      billWise: parsedPrefs?.billWise ?? true,
      costCentres: parsedPrefs?.costCentres ?? true,
      allowNarration: parsedPrefs?.allowNarration ?? true,
      multiCurrency: parsedPrefs?.multiCurrency ?? false,
      auditTrail: parsedPrefs?.auditTrail ?? true,
      defaultSalesLedger: parsedPrefs?.defaultSalesLedger || 'Sales',
      defaultPurchaseLedger: parsedPrefs?.defaultPurchaseLedger || 'Purchase',
      defaultCashLedger: parsedPrefs?.defaultCashLedger || 'Cash in Hand',
      defaultBankLedger: parsedPrefs?.defaultBankLedger || 'SBI Main',
      defaultSalesTaxLedger: parsedPrefs?.defaultSalesTaxLedger || 'Output CGST',
      defaultPurchaseTaxLedger: parsedPrefs?.defaultPurchaseTaxLedger || 'Input CGST',
      chequePrinting: parsedPrefs?.chequePrinting ?? true,
      chequeFormat: parsedPrefs?.chequeFormat || 'Standard',
      warnPostDated: parsedPrefs?.warnPostDated ?? true,
      showZeroBalance: parsedPrefs?.showZeroBalance ?? false,
      showGroupTotals: parsedPrefs?.showGroupTotals ?? true,
      showPrevYear: parsedPrefs?.showPrevYear ?? false
    };

    return JSON.stringify(currentObj) !== JSON.stringify(origObj);
  }, [
    baseCurrency,
    currencySymbol,
    numberFormat,
    decimalPlaces,
    dateFormat,
    firstDayOfWeek,
    roundingMethod,
    roundingThreshold,
    useRoundingLedger,
    roundingLedger,
    billWise,
    costCentres,
    allowNarration,
    multiCurrency,
    auditTrail,
    defaultSalesLedger,
    defaultPurchaseLedger,
    defaultCashLedger,
    defaultBankLedger,
    defaultSalesTaxLedger,
    defaultPurchaseTaxLedger,
    chequePrinting,
    chequeFormat,
    warnPostDated,
    showZeroBalance,
    showGroupTotals,
    showPrevYear,
    parsedPrefs,
    formData.currency,
    formData.currency_symbol
  ]);

  const handleApplyChanges = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const prefsPayload = {
        baseCurrency,
        currencySymbol,
        numberFormat,
        decimalPlaces,
        dateFormat,
        firstDayOfWeek,
        roundingMethod,
        roundingThreshold,
        useRoundingLedger,
        roundingLedger,
        billWise,
        costCentres,
        allowNarration,
        multiCurrency,
        auditTrail,
        defaultSalesLedger,
        defaultPurchaseLedger,
        defaultCashLedger,
        defaultBankLedger,
        defaultSalesTaxLedger,
        defaultPurchaseTaxLedger,
        chequePrinting,
        chequeFormat,
        warnPostDated,
        showZeroBalance,
        showGroupTotals,
        showPrevYear
      };

      const jsonStr = JSON.stringify(prefsPayload);
      const currCode = baseCurrency.substring(0, 3);
      onChange('currency', currCode);
      onChange('currency_symbol', currencySymbol);
      onChange('accounting_preferences', jsonStr);

      await api.updateCompany({
        ...formData,
        currency: currCode,
        currency_symbol: currencySymbol,
        accounting_preferences: jsonStr
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (onCompanyUpdated) onCompanyUpdated();
    } catch (err: any) {
      console.error('Failed to save accounting preferences:', err);
      setSaveError(err.message || 'Failed to save accounting preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    if (parsedPrefs) {
      setBaseCurrency(parsedPrefs.baseCurrency || 'INR - Indian Rupee (₹)');
      setCurrencySymbol(parsedPrefs.currencySymbol || '₹');
      setNumberFormat(parsedPrefs.numberFormat || '1,00,000.00 (Indian)');
      setDecimalPlaces(parsedPrefs.decimalPlaces || '2');
      setDateFormat(parsedPrefs.dateFormat || 'DD MMM YYYY (30 Sep 2026)');
      setFirstDayOfWeek(parsedPrefs.firstDayOfWeek || 'Monday');
      setRoundingMethod(parsedPrefs.roundingMethod || 'Nearest Rupee');
      setRoundingThreshold(parsedPrefs.roundingThreshold || '0.50');
      setUseRoundingLedger(parsedPrefs.useRoundingLedger ?? false);
      setRoundingLedger(parsedPrefs.roundingLedger || '');
      setBillWise(parsedPrefs.billWise ?? true);
      setCostCentres(parsedPrefs.costCentres ?? true);
      setAllowNarration(parsedPrefs.allowNarration ?? true);
      setMultiCurrency(parsedPrefs.multiCurrency ?? false);
      setAuditTrail(parsedPrefs.auditTrail ?? true);
      setDefaultSalesLedger(parsedPrefs.defaultSalesLedger || 'Sales');
      setDefaultPurchaseLedger(parsedPrefs.defaultPurchaseLedger || 'Purchase');
      setDefaultCashLedger(parsedPrefs.defaultCashLedger || 'Cash in Hand');
      setDefaultBankLedger(parsedPrefs.defaultBankLedger || 'SBI Main');
      setDefaultSalesTaxLedger(parsedPrefs.defaultSalesTaxLedger || 'Output CGST');
      setDefaultPurchaseTaxLedger(parsedPrefs.defaultPurchaseTaxLedger || 'Input CGST');
      setChequePrinting(parsedPrefs.chequePrinting ?? true);
      setChequeFormat(parsedPrefs.chequeFormat || 'Standard');
      setWarnPostDated(parsedPrefs.warnPostDated ?? true);
      setShowZeroBalance(parsedPrefs.showZeroBalance ?? false);
      setShowGroupTotals(parsedPrefs.showGroupTotals ?? true);
      setShowPrevYear(parsedPrefs.showPrevYear ?? false);
    }
    setSaveError(null);
  };

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
                <option value="100,000.00 (International)">100,000.00 (International)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Decimal Places
              </label>
              <select className="form-control" value={decimalPlaces} onChange={e => setDecimalPlaces(e.target.value)}>
                <option value="2">2 Decimals (Standard)</option>
                <option value="0">0 Decimals (Rounded)</option>
                <option value="3">3 Decimals</option>
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

        {/* Card 2: Rounding Off Rules */}
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
                Rounding Off Rules
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
                Configure automatic invoice and voucher amount rounding.
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
              Rounding Method
            </label>
            <select className="form-control" value={roundingMethod} onChange={e => setRoundingMethod(e.target.value)}>
              <option value="Nearest Rupee">Nearest Rupee (Standard)</option>
              <option value="Upward Rounding">Upward Rounding (Ceil)</option>
              <option value="Downward Rounding">Downward Rounding (Floor)</option>
              <option value="No Rounding">No Rounding (Exact Paise)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
              Rounding Limit (₹)
            </label>
            <input type="text" className="form-control" value={roundingThreshold} onChange={e => setRoundingThreshold(e.target.value)} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input type="checkbox" id="useRoundLedger" checked={useRoundingLedger} onChange={e => setUseRoundingLedger(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            <label htmlFor="useRoundLedger" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text, #0F172A)', cursor: 'pointer' }}>
              Post rounding difference to dedicated Round Off ledger
            </label>
          </div>
        </div>

        {/* Card 3: Accounting Features */}
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
                Accounting Features
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
                Enable or disable core double-entry accounting options.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Bill-wise Accounting</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Track outstanding bills against payments and receipts.</div>
              </div>
              <input type="checkbox" checked={billWise} onChange={e => setBillWise(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Cost Centres & Profit Tracking</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Allocate income and expenses to projects or departments.</div>
              </div>
              <input type="checkbox" checked={costCentres} onChange={e => setCostCentres(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Detailed Voucher Narrations</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Allow line-level or header-level remarks on vouchers.</div>
              </div>
              <input type="checkbox" checked={allowNarration} onChange={e => setAllowNarration(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Strict Audit Trail (MCA Compliant)</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Log all ledger postings and cancellation records immutably.</div>
              </div>
              <input type="checkbox" checked={auditTrail} onChange={e => setAuditTrail(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>
          </div>
        </div>

        {/* Card 4: Reporting Preferences */}
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
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Include ledgers with zero balance in trial balance and reports.</div>
              </div>
              <input type="checkbox" checked={showZeroBalance} onChange={e => setShowZeroBalance(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Show Group Totals</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Display group-wise sub-totals in financial statements.</div>
              </div>
              <input type="checkbox" checked={showGroupTotals} onChange={e => setShowGroupTotals(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Show Previous Year Comparison</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Include prior period columns where available.</div>
              </div>
              <input type="checkbox" checked={showPrevYear} onChange={e => setShowPrevYear(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM APPLY ACTION BAR ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)'
        }}
      >
        <div>
          {isDirty && (
            <span style={{ fontSize: '12px', color: '#EA580C', fontWeight: 700 }}>
              ● Unsaved changes pending
            </span>
          )}
          {saved && (
            <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> Accounting preferences saved successfully
            </span>
          )}
          {saveError && (
            <span style={{ fontSize: '12px', color: '#DC2626', fontWeight: 600 }}>
              {saveError}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleDiscardChanges}
            disabled={!isDirty || saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid var(--color-border, #CBD5E1)',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text-secondary, #64748B)',
              cursor: !isDirty || saving ? 'not-allowed' : 'pointer',
              opacity: !isDirty || saving ? 0.6 : 1
            }}
          >
            <RotateCcw size={13} /> Discard
          </button>

          <button
            type="button"
            onClick={handleApplyChanges}
            disabled={saving || !isDirty}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 18px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#EA580C',
              color: '#FFFFFF',
              cursor: saving || !isDirty ? 'not-allowed' : 'pointer',
              opacity: saving || !isDirty ? 0.6 : 1
            }}
          >
            {saving ? 'Saving...' : 'Apply Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
