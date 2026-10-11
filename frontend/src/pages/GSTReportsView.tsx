import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Percent,
  TrendingUp,
  FileText,
  Wallet,
  Receipt,
  Download,
  Printer,
  Calendar,
  Search,
  ChevronDown,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  ExternalLink,
  Building,
  Boxes,
  Users
} from 'lucide-react';
import { api, Company, FinancialYear } from '../api/client';

interface GSTReportsViewProps {
  company: Company | null;
  activeFy?: FinancialYear | null;
  onViewVoucher?: (voucherId: string) => void;
  onNavigateReports?: (subTab: string) => void;
}

// 36 Indian States and Union Territories with State Codes
const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' }
];

export const GSTReportsView: React.FC<GSTReportsViewProps> = ({
  company,
  activeFy,
  onViewVoucher,
  onNavigateReports
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    'summary' | 'gstr1' | 'gstr2b' | 'gstr3b' | 'hsn' | 'party' | 'item'
  >('summary');

  // Date Filters
  const [fromDate, setFromDate] = useState<string>(() => {
    if (activeFy?.start_date) return activeFy.start_date;
    const now = new Date();
    return `${now.getFullYear()}-04-01`;
  });
  const [toDate, setToDate] = useState<string>(() => {
    if (activeFy?.end_date) {
      const todayStr = new Date().toISOString().split('T')[0];
      return activeFy.end_date < todayStr ? activeFy.end_date : todayStr;
    }
    return new Date().toISOString().split('T')[0];
  });

  // Filter Toolbar States
  const [returnType, setReturnType] = useState<string>('GSTR-3B (Quarterly)');
  const [fromState, setFromState] = useState<string>(company?.state || 'Tamil Nadu');
  const [toState, setToState] = useState<string>('All States');
  const [rateSearch, setRateSearch] = useState<string>('');

  // GST Summary from Backend (Authoritative)
  const [gstSummary, setGstSummary] = useState<{
    outwardTaxablePaise: number;
    outputCgstPaise: number;
    outputSgstPaise: number;
    outputIgstPaise: number;
    outputCessPaise: number;
    totalOutputTaxPaise: number;
    outwardZeroTaxTurnoverPaise: number;
    totalOutwardTurnoverPaise: number;
    inwardTaxablePaise: number;
    inputCgstPaise: number;
    inputSgstPaise: number;
    inputIgstPaise: number;
    inputCessPaise: number;
    totalInputTaxPaise: number;
    inwardZeroTaxTurnoverPaise: number;
    totalInwardTurnoverPaise: number;
    netGstPayablePaise: number;
    netCessPayablePaise: number;
  } | null>(null);

  // Vouchers for detailed registers
  const [salesVouchers, setSalesVouchers] = useState<any[]>([]);
  const [purchaseVouchers, setPurchaseVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Export Dropdown UI state
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Fetch Authoritative GST Data
  const loadGstData = async () => {
    if (!company?.company_id) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, salesRes, purchaseRes] = await Promise.all([
        api.getGstSummary(company.company_id, fromDate, toDate).catch(() => null),
        api.getVouchers(company.company_id, 'SALES', fromDate, toDate).catch(() => []),
        api.getVouchers(company.company_id, 'PURCHASE', fromDate, toDate).catch(() => [])
      ]);

      setGstSummary(summaryRes);
      setSalesVouchers(Array.isArray(salesRes) ? salesRes.filter((v: any) => v.status === 'POSTED') : []);
      setPurchaseVouchers(Array.isArray(purchaseRes) ? purchaseRes.filter((v: any) => v.status === 'POSTED') : []);
    } catch (err: any) {
      console.error('GST fetch failed:', err);
      setError(err.message || 'Failed to load GST reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGstData();
  }, [company?.company_id, fromDate, toDate]);

  // Format currency helper
  const formatPaise = (paise: number) => {
    const rupees = (paise || 0) / 100;
    return rupees.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    if (activeFy?.start_date && activeFy?.end_date) {
      setFromDate(activeFy.start_date);
      const todayStr = new Date().toISOString().split('T')[0];
      setToDate(activeFy.end_date < todayStr ? activeFy.end_date : todayStr);
    }
    setReturnType('GSTR-3B (Quarterly)');
    setFromState(company?.state || 'Tamil Nadu');
    setToState('All States');
    setRateSearch('');
  };

  // Build Tax Slab Breakup
  const taxBreakup = useMemo(() => {
    const slabs = [
      { rate: 0, label: '0%' },
      { rate: 5, label: '5%' },
      { rate: 12, label: '12%' },
      { rate: 18, label: '18%' },
      { rate: 28, label: '28%' }
    ];

    return slabs.map((slab, idx) => {
      let salesTaxable = 0;
      let salesCgst = 0;
      let salesSgst = 0;
      let salesIgst = 0;
      let purchaseTaxable = 0;
      let purchaseCgst = 0;
      let purchaseSgst = 0;
      let purchaseIgst = 0;

      // Extract from posted sales vouchers
      for (const v of salesVouchers) {
        const taxable = Number(v.taxable_amount_paise || 0);
        const cgst = Number(v.cgst_amount_paise || 0);
        const sgst = Number(v.sgst_amount_paise || 0);
        const igst = Number(v.igst_amount_paise || 0);
        const totalTax = cgst + sgst + igst;

        if (slab.rate === 0 && totalTax === 0 && taxable > 0) {
          salesTaxable += taxable;
        } else if (slab.rate > 0 && totalTax > 0) {
          const effectiveRate = taxable > 0 ? Math.round((totalTax / taxable) * 100) : 0;
          if (effectiveRate === slab.rate || (slab.rate === 18 && (effectiveRate === 18 || effectiveRate === 0))) {
            salesTaxable += taxable;
            salesCgst += cgst;
            salesSgst += sgst;
            salesIgst += igst;
          }
        }
      }

      // Extract from posted purchase vouchers
      for (const v of purchaseVouchers) {
        const taxable = Number(v.taxable_amount_paise || 0);
        const cgst = Number(v.cgst_amount_paise || 0);
        const sgst = Number(v.sgst_amount_paise || 0);
        const igst = Number(v.igst_amount_paise || 0);
        const totalTax = cgst + sgst + igst;

        if (slab.rate === 0 && totalTax === 0 && taxable > 0) {
          purchaseTaxable += taxable;
        } else if (slab.rate > 0 && totalTax > 0) {
          const effectiveRate = taxable > 0 ? Math.round((totalTax / taxable) * 100) : 0;
          if (effectiveRate === slab.rate || (slab.rate === 18 && (effectiveRate === 18 || effectiveRate === 0))) {
            purchaseTaxable += taxable;
            purchaseCgst += cgst;
            purchaseSgst += sgst;
            purchaseIgst += igst;
          }
        }
      }

      // Reconcile with authoritative summary if total matches
      if (slab.rate === 18 && gstSummary) {
        if (salesTaxable === 0 && gstSummary.outwardTaxablePaise > 0) {
          salesTaxable = gstSummary.outwardTaxablePaise;
          salesCgst = gstSummary.outputCgstPaise;
          salesSgst = gstSummary.outputSgstPaise;
          salesIgst = gstSummary.outputIgstPaise;
        }
        if (purchaseTaxable === 0 && gstSummary.inwardTaxablePaise > 0) {
          purchaseTaxable = gstSummary.inwardTaxablePaise;
          purchaseCgst = gstSummary.inputCgstPaise;
          purchaseSgst = gstSummary.inputSgstPaise;
          purchaseIgst = gstSummary.inputIgstPaise;
        }
      } else if (slab.rate === 0 && gstSummary) {
        if (salesTaxable === 0 && gstSummary.outwardZeroTaxTurnoverPaise > 0) {
          salesTaxable = gstSummary.outwardZeroTaxTurnoverPaise;
        }
      }

      const salesTotalTax = salesCgst + salesSgst + salesIgst;
      const purchaseTotalTax = purchaseCgst + purchaseSgst + purchaseIgst;
      const netTax = salesTotalTax - purchaseTotalTax;

      return {
        id: idx + 1,
        rate: slab.rate,
        label: slab.label,
        salesTaxable,
        salesCgst,
        salesSgst,
        salesIgst,
        salesTotalTax,
        purchaseTaxable,
        purchaseCgst,
        purchaseSgst,
        purchaseIgst,
        purchaseTotalTax,
        netTax
      };
    });
  }, [salesVouchers, purchaseVouchers, gstSummary]);

  // Totals of all slabs
  const totals = useMemo(() => {
    return taxBreakup.reduce(
      (acc, curr) => ({
        salesTaxable: acc.salesTaxable + curr.salesTaxable,
        salesCgst: acc.salesCgst + curr.salesCgst,
        salesSgst: acc.salesSgst + curr.salesSgst,
        salesIgst: acc.salesIgst + curr.salesIgst,
        salesTotalTax: acc.salesTotalTax + curr.salesTotalTax,
        purchaseTaxable: acc.purchaseTaxable + curr.purchaseTaxable,
        purchaseCgst: acc.purchaseCgst + curr.purchaseCgst,
        purchaseSgst: acc.purchaseSgst + curr.purchaseSgst,
        purchaseIgst: acc.purchaseIgst + curr.purchaseIgst,
        purchaseTotalTax: acc.purchaseTotalTax + curr.purchaseTotalTax,
        netTax: acc.netTax + curr.netTax
      }),
      {
        salesTaxable: 0,
        salesCgst: 0,
        salesSgst: 0,
        salesIgst: 0,
        salesTotalTax: 0,
        purchaseTaxable: 0,
        purchaseCgst: 0,
        purchaseSgst: 0,
        purchaseIgst: 0,
        purchaseTotalTax: 0,
        netTax: 0
      }
    );
  }, [taxBreakup]);

  // Filtered Tax Breakup by rate search
  const filteredBreakup = useMemo(() => {
    if (!rateSearch.trim()) return taxBreakup;
    const q = rateSearch.toLowerCase().trim();
    return taxBreakup.filter(b => b.label.toLowerCase().includes(q) || String(b.rate).includes(q));
  }, [taxBreakup, rateSearch]);

  // HSN Summary aggregation
  const hsnSummaryList = useMemo(() => {
    const map = new Map<string, {
      hsn: string;
      desc: string;
      uqc: string;
      qty: number;
      taxable: number;
      cgst: number;
      sgst: number;
      igst: number;
      totalTax: number;
    }>();

    for (const v of salesVouchers) {
      const hsn = v.hsn_code || '8471';
      const desc = v.item_name || 'Goods / Services';
      const existing = map.get(hsn) || {
        hsn,
        desc,
        uqc: 'NOS',
        qty: 0,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0
      };
      existing.qty += Number(v.quantity || 1);
      existing.taxable += Number(v.taxable_amount_paise || 0);
      existing.cgst += Number(v.cgst_amount_paise || 0);
      existing.sgst += Number(v.sgst_amount_paise || 0);
      existing.igst += Number(v.igst_amount_paise || 0);
      existing.totalTax += Number(v.cgst_amount_paise || 0) + Number(v.sgst_amount_paise || 0) + Number(v.igst_amount_paise || 0);
      map.set(hsn, existing);
    }

    if (map.size === 0 && gstSummary && gstSummary.outwardTaxablePaise > 0) {
      return [{
        hsn: '8471',
        desc: 'General Supplies & Machinery',
        uqc: 'NOS',
        qty: 1,
        taxable: gstSummary.outwardTaxablePaise,
        cgst: gstSummary.outputCgstPaise,
        sgst: gstSummary.outputSgstPaise,
        igst: gstSummary.outputIgstPaise,
        totalTax: gstSummary.totalOutputTaxPaise
      }];
    }

    return Array.from(map.values());
  }, [salesVouchers, gstSummary]);

  // Party-wise aggregation
  const partyWiseList = useMemo(() => {
    const map = new Map<string, {
      partyName: string;
      gstin: string;
      state: string;
      type: 'Customer' | 'Vendor';
      count: number;
      taxable: number;
      cgst: number;
      sgst: number;
      igst: number;
      totalTax: number;
    }>();

    for (const v of salesVouchers) {
      const name = v.party_name || 'Cash Customer';
      const existing = map.get(name) || {
        partyName: name,
        gstin: v.party_gstin || 'Unregistered',
        state: v.place_of_supply || 'Tamil Nadu',
        type: 'Customer',
        count: 0,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0
      };
      existing.count += 1;
      existing.taxable += Number(v.taxable_amount_paise || 0);
      existing.cgst += Number(v.cgst_amount_paise || 0);
      existing.sgst += Number(v.sgst_amount_paise || 0);
      existing.igst += Number(v.igst_amount_paise || 0);
      existing.totalTax += Number(v.cgst_amount_paise || 0) + Number(v.sgst_amount_paise || 0) + Number(v.igst_amount_paise || 0);
      map.set(name, existing);
    }

    for (const v of purchaseVouchers) {
      const name = v.party_name || 'Cash Vendor';
      const existing = map.get(name) || {
        partyName: name,
        gstin: v.party_gstin || 'Unregistered',
        state: v.place_of_supply || 'Tamil Nadu',
        type: 'Vendor',
        count: 0,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0
      };
      existing.count += 1;
      existing.taxable += Number(v.taxable_amount_paise || 0);
      existing.cgst += Number(v.cgst_amount_paise || 0);
      existing.sgst += Number(v.sgst_amount_paise || 0);
      existing.igst += Number(v.igst_amount_paise || 0);
      existing.totalTax += Number(v.cgst_amount_paise || 0) + Number(v.sgst_amount_paise || 0) + Number(v.igst_amount_paise || 0);
      map.set(name, existing);
    }

    return Array.from(map.values());
  }, [salesVouchers, purchaseVouchers]);

  // Export CSV
  const handleExportCsv = () => {
    let rows: string[][] = [];

    if (activeTab === 'summary') {
      rows = [
        ['GST SUMMARY & BREAKUP REPORT', `Period: ${fromDate} to ${toDate}`],
        ['Company', company?.company_name || 'LedgerFlow'],
        ['GSTIN', company?.gstin || 'Not Configured'],
        [],
        ['#', 'Tax Rate', 'Sales Taxable (INR)', 'Sales CGST', 'Sales SGST', 'Sales IGST', 'Sales Total Tax', 'Purchase Taxable (INR)', 'Purchase CGST', 'Purchase SGST', 'Purchase IGST', 'Purchase Total Tax', 'Net Tax Payable (INR)'],
        ...taxBreakup.map(b => [
          String(b.id),
          b.label,
          ((b.salesTaxable || 0) / 100).toFixed(2),
          ((b.salesCgst || 0) / 100).toFixed(2),
          ((b.salesSgst || 0) / 100).toFixed(2),
          ((b.salesIgst || 0) / 100).toFixed(2),
          ((b.salesTotalTax || 0) / 100).toFixed(2),
          ((b.purchaseTaxable || 0) / 100).toFixed(2),
          ((b.purchaseCgst || 0) / 100).toFixed(2),
          ((b.purchaseSgst || 0) / 100).toFixed(2),
          ((b.purchaseIgst || 0) / 100).toFixed(2),
          ((b.purchaseTotalTax || 0) / 100).toFixed(2),
          ((b.netTax || 0) / 100).toFixed(2)
        ]),
        [
          'TOTAL',
          '',
          ((totals.salesTaxable || 0) / 100).toFixed(2),
          ((totals.salesCgst || 0) / 100).toFixed(2),
          ((totals.salesSgst || 0) / 100).toFixed(2),
          ((totals.salesIgst || 0) / 100).toFixed(2),
          ((totals.salesTotalTax || 0) / 100).toFixed(2),
          ((totals.purchaseTaxable || 0) / 100).toFixed(2),
          ((totals.purchaseCgst || 0) / 100).toFixed(2),
          ((totals.purchaseSgst || 0) / 100).toFixed(2),
          ((totals.purchaseIgst || 0) / 100).toFixed(2),
          ((totals.purchaseTotalTax || 0) / 100).toFixed(2),
          ((totals.netTax || 0) / 100).toFixed(2)
        ]
      ];
    } else if (activeTab === 'gstr1') {
      rows = [
        ['GSTR-1 OUTWARD SUPPLIES REGISTER', `Period: ${fromDate} to ${toDate}`],
        ['Date', 'Invoice No', 'Party Name', 'GSTIN', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Invoice'],
        ...salesVouchers.map(v => [
          v.voucher_date,
          v.voucher_number,
          v.party_name || 'Cash Sale',
          v.party_gstin || 'Unregistered',
          ((v.taxable_amount_paise || 0) / 100).toFixed(2),
          ((v.cgst_amount_paise || 0) / 100).toFixed(2),
          ((v.sgst_amount_paise || 0) / 100).toFixed(2),
          ((v.igst_amount_paise || 0) / 100).toFixed(2),
          ((v.total_amount_paise || 0) / 100).toFixed(2)
        ])
      ];
    } else if (activeTab === 'gstr2b') {
      rows = [
        ['GSTR-2B INWARD PURCHASES REGISTER', `Period: ${fromDate} to ${toDate}`],
        ['Date', 'Bill No', 'Supplier Name', 'GSTIN', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total ITC'],
        ...purchaseVouchers.map(v => [
          v.voucher_date,
          v.voucher_number,
          v.party_name || 'Cash Vendor',
          v.party_gstin || 'Unregistered',
          ((v.taxable_amount_paise || 0) / 100).toFixed(2),
          ((v.cgst_amount_paise || 0) / 100).toFixed(2),
          ((v.sgst_amount_paise || 0) / 100).toFixed(2),
          ((v.igst_amount_paise || 0) / 100).toFixed(2),
          (((v.cgst_amount_paise || 0) + (v.sgst_amount_paise || 0) + (v.igst_amount_paise || 0)) / 100).toFixed(2)
        ])
      ];
    } else {
      rows = [
        ['GST REPORT', `Tab: ${activeTab}`, `Period: ${fromDate} to ${toDate}`],
        ['Taxable Sales', ((totals.salesTaxable || 0) / 100).toFixed(2)],
        ['Taxable Purchase', ((totals.purchaseTaxable || 0) / 100).toFixed(2)],
        ['Output Tax', ((totals.salesTotalTax || 0) / 100).toFixed(2)],
        ['Input Tax (ITC)', ((totals.purchaseTotalTax || 0) / 100).toFixed(2)],
        ['Net Tax Payable', ((totals.netTax || 0) / 100).toFixed(2)]
      ];
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GST_Report_${activeTab}_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="page-container"
      style={{
        padding: '24px 32px',
        backgroundColor: 'var(--color-background, #f8f7f4)',
        minHeight: '100%',
        boxSizing: 'border-box',
        color: 'var(--color-text, #0f172a)',
        fontFamily: 'var(--font-family, Inter, sans-serif)'
      }}
    >
      {/* ─── 1. Header Section ─── */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          paddingBottom: '16px',
          marginBottom: '16px',
          borderBottom: '1px solid var(--color-border, #e2e8f0)'
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              color: 'var(--color-text-secondary, #64748b)',
              marginBottom: '6px'
            }}
          >
            <span
              style={{ cursor: 'pointer', transition: 'color 0.15s ease' }}
              onClick={() => onNavigateReports?.('daybook')}
            >
              Reports
            </span>
            <span style={{ color: 'var(--color-text-muted, #94a3b8)' }}>&rsaquo;</span>
            <span style={{ color: 'var(--color-text, #0f172a)', fontWeight: 600 }}>GST Report</span>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--color-text, #0f172a)',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <Percent size={24} color="#ff6b00" />
            GST Report
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary, #64748b)' }}>
            View and analyze your GST liability, input tax credit and statutory filings.
          </p>
        </div>

        {/* Top-Right Quick Actions: Export & Print */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }} ref={exportDropdownRef}>
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                backgroundColor: '#ff6b00',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(255, 107, 0, 0.25)',
                transition: 'background-color 0.15s ease'
              }}
            >
              <Download size={14} />
              <span>Export</span>
              <ChevronDown size={13} />
            </button>
            {showExportMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                  padding: '6px',
                  minWidth: '160px',
                  zIndex: 60
                }}
              >
                <button
                  type="button"
                  onClick={handleExportCsv}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'var(--color-text, #0f172a)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <FileText size={14} color="#16a34a" />
                  <span>Export as CSV</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              backgroundColor: 'var(--color-surface, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '8px',
              color: 'var(--color-text, #0f172a)',
              fontSize: '12.5px',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <Printer size={14} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Top Navigation Tabs ─── */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          borderBottom: '1px solid var(--color-border, #e2e8f0)',
          marginBottom: '20px',
          fontSize: '13px',
          fontWeight: 500,
          overflowX: 'auto'
        }}
      >
        {[
          { key: 'summary', label: 'Summary' },
          { key: 'gstr1', label: 'GSTR-1 (Sales)' },
          { key: 'gstr2b', label: 'GSTR-2B (Purchase)' },
          { key: 'gstr3b', label: 'GSTR-3B (Return)' },
          { key: 'hsn', label: 'HSN Summary' },
          { key: 'party', label: 'Party-wise' },
          { key: 'item', label: 'Item-wise' }
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              paddingBottom: '10px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #ff6b00' : '2px solid transparent',
              color: activeTab === tab.key ? '#ff6b00' : 'var(--color-text-secondary, #64748b)',
              fontWeight: activeTab === tab.key ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── 3. Analytical Filter Toolbar ─── */}
      <div
        className="no-print"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          alignItems: 'flex-end',
          padding: '16px',
          backgroundColor: 'var(--color-surface, #ffffff)',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: '12px',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))'
        }}
      >
        {/* Period Range */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', textTransform: 'uppercase', marginBottom: '6px' }}>
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            style={{
              width: '100%',
              height: '36px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #e2e8f0)',
              backgroundColor: 'var(--color-surface-secondary, #f8f7f4)',
              color: 'var(--color-text, #0f172a)',
              fontSize: '12.5px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', textTransform: 'uppercase', marginBottom: '6px' }}>
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            style={{
              width: '100%',
              height: '36px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #e2e8f0)',
              backgroundColor: 'var(--color-surface-secondary, #f8f7f4)',
              color: 'var(--color-text, #0f172a)',
              fontSize: '12.5px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Return Type */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Return Type
          </label>
          <select
            value={returnType}
            onChange={e => setReturnType(e.target.value)}
            style={{
              width: '100%',
              height: '36px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #e2e8f0)',
              backgroundColor: 'var(--color-surface-secondary, #f8f7f4)',
              color: 'var(--color-text, #0f172a)',
              fontSize: '12.5px'
            }}
          >
            <option value="GSTR-3B (Quarterly)">GSTR-3B (Quarterly)</option>
            <option value="GSTR-1 (Monthly)">GSTR-1 (Monthly)</option>
            <option value="Annual Summary">Annual Summary</option>
          </select>
        </div>

        {/* From State */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', textTransform: 'uppercase', marginBottom: '6px' }}>
            From State
          </label>
          <select
            value={fromState}
            onChange={e => setFromState(e.target.value)}
            style={{
              width: '100%',
              height: '36px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #e2e8f0)',
              backgroundColor: 'var(--color-surface-secondary, #f8f7f4)',
              color: 'var(--color-text, #0f172a)',
              fontSize: '12.5px'
            }}
          >
            {INDIAN_STATES.map(s => (
              <option key={s.code} value={s.name}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        {/* To State */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', textTransform: 'uppercase', marginBottom: '6px' }}>
            To State
          </label>
          <select
            value={toState}
            onChange={e => setToState(e.target.value)}
            style={{
              width: '100%',
              height: '36px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #e2e8f0)',
              backgroundColor: 'var(--color-surface-secondary, #f8f7f4)',
              color: 'var(--color-text, #0f172a)',
              fontSize: '12.5px'
            }}
          >
            <option value="All States">All States</option>
            {INDIAN_STATES.map(s => (
              <option key={s.code} value={s.name}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons: Apply & Reset */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={loadGstData}
            style={{
              flex: 1,
              height: '36px',
              backgroundColor: '#ff6b00',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(255, 107, 0, 0.2)'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Apply</span>
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            style={{
              height: '36px',
              padding: '0 14px',
              backgroundColor: 'var(--color-surface, #ffffff)',
              color: 'var(--color-text-secondary, #64748b)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="Reset Filters"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#b91c1c',
            fontSize: '13px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} color="#dc2626" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadGstData}
            style={{
              padding: '4px 10px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ─── 4. Five KPI Summary Cards ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '24px'
        }}
      >
        {/* Card 1: Total Sales (Taxable) */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #e2e8f0)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(22, 163, 74, 0.12)',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)' }}>
              Total Sales (Taxable)
            </div>
            <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text, #0f172a)', marginTop: '2px' }}>
              ₹ {formatPaise(totals.salesTaxable)}
            </div>
          </div>
        </div>

        {/* Card 2: Total Purchase (Taxable) */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #e2e8f0)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <FileText size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)' }}>
              Total Purchase (Taxable)
            </div>
            <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text, #0f172a)', marginTop: '2px' }}>
              ₹ {formatPaise(totals.purchaseTaxable)}
            </div>
          </div>
        </div>

        {/* Card 3: Output Tax (Liability) */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #e2e8f0)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 107, 0, 0.12)',
              color: '#ff6b00',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Wallet size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)' }}>
              Output Tax (Liability)
            </div>
            <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 700, color: '#ff6b00', marginTop: '2px' }}>
              ₹ {formatPaise(totals.salesTotalTax)}
            </div>
          </div>
        </div>

        {/* Card 4: Input Tax (ITC) */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #e2e8f0)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(147, 51, 234, 0.12)',
              color: '#9333ea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Percent size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)' }}>
              Input Tax (ITC)
            </div>
            <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 700, color: '#9333ea', marginTop: '2px' }}>
              ₹ {formatPaise(totals.purchaseTotalTax)}
            </div>
          </div>
        </div>

        {/* Card 5: Net GST Payable */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #e2e8f0)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: totals.netTax >= 0 ? 'rgba(225, 29, 72, 0.12)' : 'rgba(22, 163, 74, 0.12)',
              color: totals.netTax >= 0 ? '#e11d48' : '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Receipt size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)' }}>
              Net GST Payable
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: totals.netTax >= 0 ? '#e11d48' : '#16a34a',
                marginTop: '2px'
              }}
            >
              ₹ {formatPaise(Math.abs(totals.netTax))}
              {totals.netTax < 0 && (
                <span style={{ fontSize: '10px', fontWeight: 500, marginLeft: '4px', color: '#16a34a' }}>
                  (Credit)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 5. Tab Content ─── */}
      {activeTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Main Card: GST Breakup Table */}
          <div
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              borderRadius: '12px',
              border: '1px solid var(--color-border, #e2e8f0)',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--color-border, #e2e8f0)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                GST Breakup
              </h2>
              <div style={{ position: 'relative', width: '240px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-muted, #94a3b8)' }} />
                <input
                  type="text"
                  placeholder="Search by tax rate..."
                  value={rateSearch}
                  onChange={e => setRateSearch(e.target.value)}
                  style={{
                    width: '100%',
                    height: '32px',
                    paddingLeft: '32px',
                    paddingRight: '10px',
                    fontSize: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    backgroundColor: 'var(--color-surface-secondary, #f8f7f4)',
                    color: 'var(--color-text, #0f172a)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-surface-secondary, #f8f7f4)', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
                    <th rowSpan={2} style={{ width: '40px', textAlign: 'center', padding: '8px 10px' }}>#</th>
                    <th rowSpan={2} style={{ width: '90px', padding: '8px 10px' }}>Tax Rate</th>
                    <th colSpan={5} style={{ textAlign: 'center', backgroundColor: 'rgba(249, 115, 22, 0.05)', borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', padding: '6px 8px' }}>
                      Sales (Output)
                    </th>
                    <th colSpan={5} style={{ textAlign: 'center', backgroundColor: 'rgba(37, 99, 235, 0.05)', borderRight: '1px solid var(--color-border)', padding: '6px 8px' }}>
                      Purchase (Input)
                    </th>
                    <th rowSpan={2} style={{ textAlign: 'right', width: '130px', padding: '8px 12px', backgroundColor: 'rgba(225, 29, 72, 0.05)' }}>
                      Net Tax<br />(Payable / Refund)
                    </th>
                  </tr>
                  <tr style={{ backgroundColor: 'var(--color-surface-secondary, #f8f7f4)', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontSize: '11px' }}>
                    {/* Sales Subheaders */}
                    <th style={{ textAlign: 'right', padding: '6px 8px', borderLeft: '1px solid var(--color-border)' }}>Taxable Value</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>CGST</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>SGST</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>IGST</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', borderRight: '1px solid var(--color-border)', fontWeight: 700 }}>Total Tax</th>

                    {/* Purchase Subheaders */}
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>Taxable Value</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>CGST</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>SGST</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px' }}>IGST</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', borderRight: '1px solid var(--color-border)', fontWeight: 700 }}>Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBreakup.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
                      <td style={{ textAlign: 'center', color: 'var(--color-text-muted, #94a3b8)', padding: '8px 10px' }}>{row.id}</td>
                      <td style={{ fontWeight: 600, color: 'var(--color-text, #0f172a)', padding: '8px 10px' }}>{row.label}</td>

                      {/* Sales Cells */}
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 8px', borderLeft: '1px solid var(--color-border)' }}>
                        {formatPaise(row.salesTaxable)}
                      </td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 8px' }}>{formatPaise(row.salesCgst)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 8px' }}>{formatPaise(row.salesSgst)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 8px' }}>{formatPaise(row.salesIgst)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 8px', borderRight: '1px solid var(--color-border)', fontWeight: 600, color: '#ff6b00' }}>
                        {formatPaise(row.salesTotalTax)}
                      </td>

                      {/* Purchase Cells */}
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 8px' }}>
                        {formatPaise(row.purchaseTaxable)}
                      </td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 8px' }}>{formatPaise(row.purchaseCgst)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 8px' }}>{formatPaise(row.purchaseSgst)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 8px' }}>{formatPaise(row.purchaseIgst)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 8px', borderRight: '1px solid var(--color-border)', fontWeight: 600, color: '#9333ea' }}>
                        {formatPaise(row.purchaseTotalTax)}
                      </td>

                      {/* Net Tax Cell */}
                      <td
                        className="tabular-nums"
                        style={{
                          textAlign: 'right',
                          padding: '8px 12px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(225, 29, 72, 0.02)',
                          color: row.netTax >= 0 ? '#e11d48' : '#16a34a'
                        }}
                      >
                        {formatPaise(row.netTax)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--color-surface-secondary, #f8f7f4)', fontWeight: 700, borderTop: '2px solid var(--color-border, #e2e8f0)' }}>
                    <td colSpan={2} style={{ padding: '10px 14px', textTransform: 'uppercase', fontSize: '11.5px', color: 'var(--color-text)' }}>
                      Total
                    </td>

                    {/* Sales Totals */}
                    <td className="tabular-nums" style={{ textAlign: 'right', padding: '10px 8px', borderLeft: '1px solid var(--color-border)' }}>
                      {formatPaise(totals.salesTaxable)}
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right', padding: '10px 8px' }}>{formatPaise(totals.salesCgst)}</td>
                    <td className="tabular-nums" style={{ textAlign: 'right', padding: '10px 8px' }}>{formatPaise(totals.salesSgst)}</td>
                    <td className="tabular-nums" style={{ textAlign: 'right', padding: '10px 8px' }}>{formatPaise(totals.salesIgst)}</td>
                    <td className="tabular-nums" style={{ textAlign: 'right', padding: '10px 8px', borderRight: '1px solid var(--color-border)', color: '#ff6b00' }}>
                      ₹ {formatPaise(totals.salesTotalTax)}
                    </td>

                    {/* Purchase Totals */}
                    <td className="tabular-nums" style={{ textAlign: 'right', padding: '10px 8px' }}>
                      {formatPaise(totals.purchaseTaxable)}
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right', padding: '10px 8px' }}>{formatPaise(totals.purchaseCgst)}</td>
                    <td className="tabular-nums" style={{ textAlign: 'right', padding: '10px 8px' }}>{formatPaise(totals.purchaseSgst)}</td>
                    <td className="tabular-nums" style={{ textAlign: 'right', padding: '10px 8px' }}>{formatPaise(totals.purchaseIgst)}</td>
                    <td className="tabular-nums" style={{ textAlign: 'right', padding: '10px 8px', borderRight: '1px solid var(--color-border)', color: '#9333ea' }}>
                      ₹ {formatPaise(totals.purchaseTotalTax)}
                    </td>

                    {/* Net Tax Total */}
                    <td
                      className="tabular-nums"
                      style={{
                        textAlign: 'right',
                        padding: '10px 12px',
                        fontSize: '13px',
                        color: totals.netTax >= 0 ? '#e11d48' : '#16a34a'
                      }}
                    >
                      ₹ {formatPaise(totals.netTax)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Bottom 2 Cards: Output vs Input Bar Chart & GSTR-3B Summary Table */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '20px'
            }}
          >
            {/* Left Card: Output vs Input Tax Chart */}
            <div
              style={{
                backgroundColor: 'var(--color-surface, #ffffff)',
                borderRadius: '12px',
                border: '1px solid var(--color-border, #e2e8f0)',
                padding: '18px',
                boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                  Output vs Input Tax Analysis
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#ff6b00' }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>Output Tax</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#3b82f6' }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>Input Tax (ITC)</span>
                  </div>
                </div>
              </div>

              {/* Bar Comparison Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
                {[
                  { label: 'CGST', output: totals.salesCgst, input: totals.purchaseCgst },
                  { label: 'SGST', output: totals.salesSgst, input: totals.purchaseSgst },
                  { label: 'IGST', output: totals.salesIgst, input: totals.purchaseIgst }
                ].map((tax, i) => {
                  const maxAmt = Math.max(totals.salesTotalTax, totals.purchaseTotalTax, 1);
                  const outPct = Math.min(100, Math.round((tax.output / maxAmt) * 100));
                  const inPct = Math.min(100, Math.round((tax.input / maxAmt) * 100));

                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                        <span>{tax.label}</span>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '11.5px' }} className="tabular-nums">
                          <span style={{ color: '#ff6b00' }}>₹{formatPaise(tax.output)}</span>
                          <span style={{ color: '#3b82f6' }}>₹{formatPaise(tax.input)}</span>
                        </div>
                      </div>

                      {/* Visual Bars */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-surface-secondary, #f8f7f4)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${outPct}%`, height: '100%', backgroundColor: '#ff6b00', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-surface-secondary, #f8f7f4)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${inPct}%`, height: '100%', backgroundColor: '#3b82f6', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Net Summary Footer */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: 'var(--color-surface-secondary, #f8f7f4)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px'
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Net Liability Balance</span>
                <span className="tabular-nums" style={{ fontSize: '14px', fontWeight: 700, color: totals.netTax >= 0 ? '#e11d48' : '#16a34a' }}>
                  ₹ {formatPaise(totals.netTax)}
                </span>
              </div>
            </div>

            {/* Right Card: GSTR-3B Summary Table */}
            <div
              style={{
                backgroundColor: 'var(--color-surface, #ffffff)',
                borderRadius: '12px',
                border: '1px solid var(--color-border, #e2e8f0)',
                padding: '18px',
                boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <h3 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                GSTR-3B Statutory Return Summary
              </h3>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  {
                    code: '3.1',
                    desc: 'Outward Taxable Supplies (other than zero rated/nil)',
                    taxable: totals.salesTaxable,
                    tax: totals.salesTotalTax
                  },
                  {
                    code: '3.2',
                    desc: 'Inter-State Supplies to Unregistered / Composition',
                    taxable: taxBreakup.find(b => b.rate === 18)?.salesIgst ? totals.salesTaxable : 0,
                    tax: totals.salesIgst
                  },
                  {
                    code: '3.3',
                    desc: 'Zero-Rated / Nil-Rated Outward Supplies',
                    taxable: taxBreakup.find(b => b.rate === 0)?.salesTaxable || 0,
                    tax: 0
                  },
                  {
                    code: '4.0',
                    desc: 'Eligible ITC (All other ITC on purchases)',
                    taxable: totals.purchaseTaxable,
                    tax: totals.purchaseTotalTax
                  }
                ].map((row, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-surface-secondary, #f8f7f4)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12px'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 700, color: '#ff6b00', marginRight: '6px' }}>{row.code}</span>
                      <span style={{ color: 'var(--color-text, #0f172a)' }}>{row.desc}</span>
                    </div>
                    <div style={{ textAlign: 'right' }} className="tabular-nums">
                      <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>₹{formatPaise(row.tax)}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--color-text-secondary)' }}>Taxable: ₹{formatPaise(row.taxable)}</div>
                    </div>
                  </div>
                ))}

                {/* Total Return Box */}
                <div
                  style={{
                    marginTop: 'auto',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 107, 0, 0.08)',
                    border: '1px solid rgba(255, 107, 0, 0.25)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#ff6b00' }}>
                      5.1 Net Tax Payable in Cash (Post-ITC)
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Total Output Tax minus Eligible Input Tax Credit
                    </div>
                  </div>
                  <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 800, color: '#ff6b00' }}>
                    ₹ {formatPaise(totals.netTax > 0 ? totals.netTax : 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab 2: GSTR-1 (Sales Register) ─── */}
      {activeTab === 'gstr1' && (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #e2e8f0)',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
              GSTR-1 Outward Supplies Register
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              All B2B and B2C sales invoices for reporting under Section 37 of CGST Act.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-secondary, #f8f7f4)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '8px 12px' }}>Date</th>
                  <th style={{ padding: '8px 12px' }}>Invoice No</th>
                  <th style={{ padding: '8px 12px' }}>Customer Name</th>
                  <th style={{ padding: '8px 12px' }}>GSTIN</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Taxable Value (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>CGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>SGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>IGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700 }}>Total Value (₹)</th>
                </tr>
              </thead>
              <tbody>
                {salesVouchers.length > 0 ? (
                  salesVouchers.map((v, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 12px' }}>{v.voucher_date}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#ff6b00', cursor: 'pointer' }} onClick={() => onViewVoucher?.(v.voucher_id)}>
                        {v.voucher_number}
                      </td>
                      <td style={{ padding: '8px 12px' }}>{v.party_name || 'Cash Sale'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{v.party_gstin || 'Unregistered'}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(v.taxable_amount_paise)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(v.cgst_amount_paise)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(v.sgst_amount_paise)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(v.igst_amount_paise)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>{formatPaise(v.total_amount_paise)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                      No sales vouchers recorded in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Tab 3: GSTR-2B (Purchase / ITC Register) ─── */}
      {activeTab === 'gstr2b' && (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #e2e8f0)',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
              GSTR-2B Inward Purchase &amp; ITC Register
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Inward taxable supplies eligible for Input Tax Credit under Section 16 of CGST Act.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-secondary, #f8f7f4)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '8px 12px' }}>Date</th>
                  <th style={{ padding: '8px 12px' }}>Bill / Ref No</th>
                  <th style={{ padding: '8px 12px' }}>Supplier Name</th>
                  <th style={{ padding: '8px 12px' }}>GSTIN</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Taxable Value (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>CGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>SGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>IGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700 }}>Total ITC (₹)</th>
                </tr>
              </thead>
              <tbody>
                {purchaseVouchers.length > 0 ? (
                  purchaseVouchers.map((v, i) => {
                    const itc = (v.cgst_amount_paise || 0) + (v.sgst_amount_paise || 0) + (v.igst_amount_paise || 0);
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px 12px' }}>{v.voucher_date}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#ff6b00', cursor: 'pointer' }} onClick={() => onViewVoucher?.(v.voucher_id)}>
                          {v.voucher_number}
                        </td>
                        <td style={{ padding: '8px 12px' }}>{v.party_name || 'Cash Vendor'}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{v.party_gstin || 'Unregistered'}</td>
                        <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(v.taxable_amount_paise)}</td>
                        <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(v.cgst_amount_paise)}</td>
                        <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(v.sgst_amount_paise)}</td>
                        <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(v.igst_amount_paise)}</td>
                        <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: '#9333ea' }}>{formatPaise(itc)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                      No purchase vouchers recorded in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Tab 4: GSTR-3B (Statutory Return View) ─── */}
      {activeTab === 'gstr3b' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              borderRadius: '12px',
              border: '1px solid var(--color-border, #e2e8f0)',
              padding: '18px',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))'
            }}
          >
            <h2 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
              3.1 Details of Outward Supplies and Inward Supplies Liable to Reverse Charge
            </h2>
            <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-secondary, #f8f7f4)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '8px 12px' }}>Nature of Supplies</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Total Taxable (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>IGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>CGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>SGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Cess (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                    (a) Outward taxable supplies (other than zero rated, nil rated and exempted)
                  </td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(totals.salesTaxable)}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(totals.salesIgst)}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(totals.salesCgst)}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(totals.salesSgst)}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>₹0.00</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px 12px' }}>(b) Outward taxable supplies (zero rated)</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(taxBreakup.find(b => b.rate === 0)?.salesTaxable || 0)}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>₹0.00</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>₹0.00</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>₹0.00</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>₹0.00</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px 12px' }}>(c) Other outward supplies (Nil rated, exempted)</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>₹0.00</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>₹0.00</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>₹0.00</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>₹0.00</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>₹0.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              borderRadius: '12px',
              border: '1px solid var(--color-border, #e2e8f0)',
              padding: '18px',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))'
            }}
          >
            <h2 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
              4. Eligible Input Tax Credit (ITC)
            </h2>
            <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-secondary, #f8f7f4)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '8px 12px' }}>Details</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>IGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>CGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>SGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Cess (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                    (A) ITC Available (whether in full or part) - All other ITC
                  </td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(totals.purchaseIgst)}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(totals.purchaseCgst)}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(totals.purchaseSgst)}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>₹0.00</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-secondary, #f8f7f4)', fontWeight: 700 }}>
                  <td style={{ padding: '8px 12px' }}>Net ITC Available (A) - (B)</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px', color: '#9333ea' }}>{formatPaise(totals.purchaseIgst)}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px', color: '#9333ea' }}>{formatPaise(totals.purchaseCgst)}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px', color: '#9333ea' }}>{formatPaise(totals.purchaseSgst)}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>₹0.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Tab 5: HSN Summary ─── */}
      {activeTab === 'hsn' && (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #e2e8f0)',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
              HSN / SAC Summary of Outward Supplies
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Mandatory Table 12 disclosure for B2B and B2C supply transactions.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-secondary, #f8f7f4)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '8px 12px' }}>HSN / SAC</th>
                  <th style={{ padding: '8px 12px' }}>Description</th>
                  <th style={{ padding: '8px 12px' }}>UQC</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Total Qty</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Taxable Value (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Integrated Tax (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Central Tax (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>State Tax (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700 }}>Total Tax (₹)</th>
                </tr>
              </thead>
              <tbody>
                {hsnSummaryList.length > 0 ? (
                  hsnSummaryList.map((h, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#ff6b00', fontFamily: 'monospace' }}>{h.hsn}</td>
                      <td style={{ padding: '8px 12px' }}>{h.desc}</td>
                      <td style={{ padding: '8px 12px' }}>{h.uqc}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{h.qty}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(h.taxable)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(h.igst)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(h.cgst)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(h.sgst)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>{formatPaise(h.totalTax)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                      No HSN items recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Tab 6: Party-wise ─── */}
      {activeTab === 'party' && (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #e2e8f0)',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
              Party-Wise Tax Summary
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Consolidated GST figures grouped by customer and vendor accounts.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-secondary, #f8f7f4)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '8px 12px' }}>Party Name</th>
                  <th style={{ padding: '8px 12px' }}>Type</th>
                  <th style={{ padding: '8px 12px' }}>GSTIN</th>
                  <th style={{ padding: '8px 12px' }}>State</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Invoices</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Taxable Value (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>CGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>SGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>IGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700 }}>Total Tax (₹)</th>
                </tr>
              </thead>
              <tbody>
                {partyWiseList.length > 0 ? (
                  partyWiseList.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-text)' }}>{p.partyName}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          backgroundColor: p.type === 'Customer' ? 'rgba(22, 163, 74, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                          color: p.type === 'Customer' ? '#16a34a' : '#2563eb'
                        }}>
                          {p.type}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{p.gstin}</td>
                      <td style={{ padding: '8px 12px' }}>{p.state}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{p.count}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(p.taxable)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(p.cgst)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(p.sgst)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(p.igst)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>{formatPaise(p.totalTax)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                      No party tax transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Tab 7: Item-wise ─── */}
      {activeTab === 'item' && (
        <div
          style={{
            backgroundColor: 'var(--color-surface, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #e2e8f0)',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
              Item-Wise GST Summary
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Tax collected and paid categorized by inventory item and services.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-secondary, #f8f7f4)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '8px 12px' }}>Item / Description</th>
                  <th style={{ padding: '8px 12px' }}>HSN / SAC</th>
                  <th style={{ padding: '8px 12px' }}>Tax Rate</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Units</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Taxable Value (₹)</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700 }}>Total Tax (₹)</th>
                </tr>
              </thead>
              <tbody>
                {hsnSummaryList.length > 0 ? (
                  hsnSummaryList.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.desc}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{item.hsn}</td>
                      <td style={{ padding: '8px 12px' }}>18%</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{item.qty} {item.uqc}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px' }}>{formatPaise(item.taxable)}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: '#ff6b00' }}>
                        {formatPaise(item.totalTax)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                      No item GST records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
