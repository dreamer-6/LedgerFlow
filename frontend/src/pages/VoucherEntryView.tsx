import React, { useState, useEffect } from 'react';
import { api, Company, FinancialYear } from '../api/client';
import { InvoicePrintModal } from './InvoicePrintModal';
import {
  Plus,
  Trash2,
  Check,
  UserPlus,
  Building2,
  PackagePlus,
  AlertCircle,
  MoreVertical,
  ChevronDown,
  Printer,
  Eye,
  Maximize2,
  Minimize2
} from 'lucide-react';


interface VoucherEntryViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  initialType?: string;
  currentDate?: string;
  editVoucherId?: string | null;
  onPostSuccess: (voucherId: string) => void;
}

export const VoucherEntryView: React.FC<VoucherEntryViewProps> = ({
  company,
  activeFy,
  initialType = 'SALES',
  currentDate,
  editVoucherId,
  onPostSuccess
}) => {
  const getInitialVoucherNumber = () => {
    if (!company?.company_name) return 'DTS-0001';
    const words = company.company_name.trim().split(/[\s_-]+/).filter((w: string) => w.length > 0);
    const pfx = words.length > 1 ? words.map((w: string) => w[0].toUpperCase()).join('') : words[0]?.substring(0, 3).toUpperCase() || 'DTS';
    return `${pfx}-0001`;
  };

  const [voucherType, setVoucherType] = useState<string>(initialType);
  const [voucherNumber, setVoucherNumber] = useState<string>(getInitialVoucherNumber);
  const [voucherDate, setVoucherDate] = useState<string>(currentDate || new Date().toISOString().split('T')[0]);
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState<string>(currentDate || new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (currentDate) {
      setVoucherDate(currentDate);
      setSupplierInvoiceDate(currentDate);
    }
  }, [currentDate]);
  const [voucherStatus, setVoucherStatus] = useState<'Draft' | 'Posted'>('Draft');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState<string>('');
  const [partyId, setPartyId] = useState<string>('');
  const [placeOfSupply, setPlaceOfSupply] = useState<string>('33 - Tamil Nadu');
  const [narration, setNarration] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('GPAY');
  const [paymentTerms, setPaymentTerms] = useState<string>('Net 30 Days');
  const [orderRef, setOrderRef] = useState<string>('');
  const [termsAndConditions, setTermsAndConditions] = useState<string>(
    '01-Once product sold no cancel or return. 02=Product warranty is from service center only. 03=for physical damage'
  );
  const [taxMode, setTaxMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('EXCLUSIVE');
  const [isSummaryExpanded, setIsSummaryExpanded] = useState<boolean>(true);
  const [showLivePreview, setShowLivePreview] = useState<boolean>(false);

  // Selected Party details for compact card
  const [selectedParty, setSelectedParty] = useState<any>(null);

  // Masters
  const [parties, setParties] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [godowns, setGodowns] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  // Multi-line Items for Trading Vouchers (Sales / Purchase)
  const [lines, setLines] = useState<any[]>([
    {
      itemId: '',
      description: '',
      godownId: '',
      quantity: 1,
      unit: 'Nos',
      hsnSac: '85044029',
      rate: 0,
      rateInclTax: 0,
      discountPercent: 0,
      gstRate: 18,
      serialNumber: '',
      availableSerials: [] as string[]
    }
  ]);

  // Financial Voucher Lines (Receipt / Payment / Contra / Journal)
  const [ledgerLines, setLedgerLines] = useState<any[]>([
    { ledgerId: '', type: 'DR', amount: 0, particulars: '' },
    { ledgerId: '', type: 'CR', amount: 0, particulars: '' }
  ]);

  // Quick Party Modal State
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyType, setNewPartyType] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [newPartyGstin, setNewPartyGstin] = useState('');
  const [newPartyPan, setNewPartyPan] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyEmail, setNewPartyEmail] = useState('');
  const [newPartyBankName, setNewPartyBankName] = useState('');
  const [newPartyAddress1, setNewPartyAddress1] = useState('');
  const [newPartyCity, setNewPartyCity] = useState('Chennai');
  const [newPartyState, setNewPartyState] = useState('Tamil Nadu');
  const [newPartyPincode, setNewPartyPincode] = useState('600001');

  // Quick Stock Item Modal State
  const [showQuickItemModal, setShowQuickItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemHsn, setNewItemHsn] = useState('85044029');
  const [newItemUnitId, setNewItemUnitId] = useState('');
  const [newItemGstRate, setNewItemGstRate] = useState<number>(18);
  const [newItemPurchaseCost, setNewItemPurchaseCost] = useState<number>(0);
  const [newItemPurchaseCostIncl, setNewItemPurchaseCostIncl] = useState<number>(0);
  const [newItemSellingPrice, setNewItemSellingPrice] = useState<number>(0);

  const [isPosting, setIsPosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load Masters
  const loadMasters = async () => {
    try {
      const [pty, items, gd, led, un] = await Promise.all([
        api.getParties(),
        api.getStockItems(),
        api.getGodowns(),
        api.getLedgers(),
        api.getUnits()
      ]);
      setParties(pty);
      setStockItems(items);
      setGodowns(gd);
      setLedgers(led);
      setUnits(un);

      if (gd && gd.length > 0) {
        setLines(prev => prev.map(l => ({ ...l, godownId: l.godownId || gd[0].godown_id })));
      }

      // Select default party
      const filteredParties = pty.filter((p: any) =>
        voucherType === 'PURCHASE' || voucherType === 'PAYMENT'
          ? p.party_type === 'SUPPLIER' || p.party_type === 'BOTH'
          : p.party_type === 'CUSTOMER' || p.party_type === 'BOTH'
      );
      if (filteredParties.length > 0 && !partyId) {
        handleSelectParty(filteredParties[0].party_id, filteredParties[0]);
      }

    } catch (err) {
      console.error('Failed to load masters:', err);
    }
  };

  // Dynamically fetch next available voucher number from backend
  const fetchNextVoucherNumber = async () => {
    if (!company) return;
    try {
      const fyId = activeFy?.fy_id || 'fy_2026_27';
      const res = await api.getNextVoucherNumber(company.company_id, fyId, voucherType);
      if (res?.nextVoucherNumber) {
        setVoucherNumber(res.nextVoucherNumber);
      }
    } catch (err) {
      console.error('Failed to fetch next voucher number:', err);
    }
  };

  useEffect(() => {
    loadMasters();
    if (!editVoucherId) {
      fetchNextVoucherNumber();
    }
  }, [voucherType, company, activeFy, editVoucherId]);

  useEffect(() => {
    if (editVoucherId) {
      api.getVoucherById(editVoucherId).then(({ voucher, lines: vLines }) => {
        setVoucherType(voucher.voucher_type);
        setVoucherNumber(voucher.voucher_number);
        setVoucherDate(voucher.voucher_date);
        setSupplierInvoiceNo(voucher.supplier_invoice_no || '');
        setSupplierInvoiceDate(voucher.supplier_invoice_date || voucher.voucher_date);
        setPartyId(voucher.party_id);
        setPlaceOfSupply(voucher.place_of_supply || '33 - Tamil Nadu');
        setNarration(voucher.narration || '');
        setPaymentMode(voucher.payment_mode || 'GPAY');
        setPaymentTerms(voucher.payment_terms || 'Net 30 Days');
        setOrderRef(voucher.order_ref || '');
        setTermsAndConditions(voucher.terms_and_conditions || '');

        if (voucher.voucher_type === 'SALES' || voucher.voucher_type === 'PURCHASE') {
          setLines(vLines.map((l: any) => ({
            itemId: l.item_id,
            description: l.description || '',
            godownId: l.godown_id,
            quantity: l.quantity,
            unit: l.unit || 'Nos',
            hsnSac: l.hsn_sac || '',
            rate: l.rate_paise / 100,
            rateInclTax: l.rate_paise / 100, // naive approx, actual computation depends on taxMode
            discountPercent: l.discount_percent || 0,
            gstRate: l.gst_rate || 18,
            serialNumber: l.serial_number || '',
            availableSerials: []
          })));
        } else {
          setLedgerLines(vLines.map((l: any) => ({
            ledgerId: l.ledger_id,
            type: l.debit_paise > 0 ? 'DR' : 'CR',
            amount: (l.debit_paise + l.credit_paise) / 100,
            particulars: l.particulars || ''
          })));
        }
      }).catch(console.error);
    }
  }, [editVoucherId]);

  const switchVoucherType = (newType: string) => {
    setVoucherType(newType);
    setLines((prevLines) =>
      prevLines.map((l) => {
        if (!l.itemId) return l;
        const item = stockItems.find((s) => s.item_id === l.itemId);
        if (!item) return l;
        const rate = newType === 'PURCHASE' ? (item.purchase_rate_paise || 0) / 100 : (item.selling_rate_paise || 0) / 100;
        return { ...l, rate };
      })
    );
  };

  // Tally Prime Function Keys Global Listener (F4-F9, F2, Alt+P, Ctrl+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if quick party or item modal is open
      if (showPartyModal || showQuickItemModal) return;

      // F4: Contra
      if (e.key === 'F4') {
        e.preventDefault();
        switchVoucherType('CONTRA');
        return;
      }
      // F5: Payment
      if (e.key === 'F5') {
        e.preventDefault();
        switchVoucherType('PAYMENT');
        return;
      }
      // F6: Receipt
      if (e.key === 'F6') {
        e.preventDefault();
        switchVoucherType('RECEIPT');
        return;
      }
      // F7: Journal
      if (e.key === 'F7') {
        e.preventDefault();
        switchVoucherType('JOURNAL');
        return;
      }
      // F8: Sales
      if (e.key === 'F8') {
        e.preventDefault();
        switchVoucherType('SALES');
        return;
      }
      // F9: Purchase
      if (e.key === 'F9') {
        e.preventDefault();
        switchVoucherType('PURCHASE');
        return;
      }
      // F2: Date shortcut
      if (e.key === 'F2') {
        e.preventDefault();
        const dateInput = document.getElementById('voucher-date-input');
        if (dateInput) {
          dateInput.focus();
        }
        return;
      }
      // Alt + P: Print Preview
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setShowLivePreview((prev) => !prev);
        return;
      }
      // Ctrl + A: Quick Post Voucher
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handlePostVoucher(false);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPartyModal, showQuickItemModal, stockItems, company, activeFy, lines, ledgerLines, voucherType]);

  const handleSelectParty = (id: string, partyObj?: any) => {
    setPartyId(id);
    const p = partyObj || parties.find((item) => item.party_id === id);
    if (p) {
      setSelectedParty(p);
      if (p.state) {
        setPlaceOfSupply(p.state_code ? `${p.state_code} - ${p.state}` : p.state);
      }
    }
  };

  const isTrading = voucherType === 'SALES' || voucherType === 'PURCHASE';

  // Handle Item Row Changes
  const updateLine = (idx: number, field: string, value: any) => {
    const updated = [...lines];
    const cur = { ...updated[idx], [field]: value };

    if (field === 'itemId') {
      const item = stockItems.find((s) => s.item_id === value);
      if (item) {
        const u = units.find((un) => un.unit_id === item.unit_id);
        cur.unit = u?.symbol || 'Nos';
        cur.gstRate = item.gst_rate;
        cur.hsnSac = item.hsn_sac || '85044029';
        const cost = (item.purchase_rate_paise || 0) / 100;
        const sp = (item.selling_rate_paise || 0) / 100;
        const baseRate = voucherType === 'PURCHASE' ? cost : sp;
        cur.rate = baseRate;
        cur.rateInclTax = Math.round(baseRate * (1 + (item.gst_rate || 18) / 100) * 100) / 100;
        
        // Fetch serials asynchronously
        if (item.has_serial_no) {
          api.getAvailableSerials(item.item_id).then((serials: string[]) => {
            setLines(prev => {
              const newLines = [...prev];
              newLines[idx].availableSerials = serials;
              return newLines;
            });
          }).catch(console.error);
        } else {
          cur.availableSerials = [];
          cur.serialNumber = '';
        }
      }
    } else if (field === 'rate') {
      const r = Number(value) || 0;
      const gst = Number(cur.gstRate) || 18;
      cur.rate = value;
      cur.rateInclTax = Math.round(r * (1 + gst / 100) * 100) / 100;
    } else if (field === 'rateInclTax') {
      const rIncl = Number(value) || 0;
      const gst = Number(cur.gstRate) || 18;
      cur.rateInclTax = value;
      cur.rate = Math.round((rIncl / (1 + gst / 100)) * 100) / 100;
    } else if (field === 'gstRate') {
      const gst = Number(value) || 0;
      const r = Number(cur.rate) || 0;
      cur.gstRate = gst;
      cur.rateInclTax = Math.round(r * (1 + gst / 100) * 100) / 100;
    }

    updated[idx] = cur;
    setLines(updated);
  };

  const addLine = () => {
    const defaultItem = stockItems[0];
    const gst = defaultItem ? defaultItem.gst_rate : 18;
    const cost = defaultItem ? (defaultItem.purchase_rate_paise || 0) / 100 : 0;
    const sp = defaultItem ? (defaultItem.selling_rate_paise || 0) / 100 : 0;
    const baseRate = voucherType === 'PURCHASE' ? cost : sp;

    setLines([
      ...lines,
      {
        itemId: defaultItem ? defaultItem.item_id : '',
        description: '',
        godownId: godowns[0]?.godown_id || '',
        quantity: 1,
        unit: 'Nos',
        hsnSac: defaultItem ? defaultItem.hsn_sac : '85044029',
        rate: baseRate,
        rateInclTax: Math.round(baseRate * (1 + gst / 100) * 100) / 100,
        discountPercent: 0,
        gstRate: gst,
        serialNumber: '',
        availableSerials: []
      }
    ]);
  };

  const removeLine = (idx: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== idx));
    }
  };

  // Calculations: Taxable, CGST, SGST, IGST, Round Off, Grand Total
  const calculateTotals = () => {
    let taxableTotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const isInterState = company?.state_code && selectedParty?.state_code && company.state_code !== selectedParty.state_code;

    lines.forEach((l) => {
      const qty = Number(l.quantity) || 0;
      const gst = Number(l.gstRate) || 18;
      const discPercent = Number(l.discountPercent) || 0;

      let taxable = 0;
      let lineCgst = 0;
      let lineSgst = 0;
      let lineIgst = 0;

      if (taxMode === 'EXCLUSIVE') {
        const rate = Number(l.rate) || 0;
        const gross = qty * rate;
        const disc = gross * (discPercent / 100);
        taxable = gross - disc;

        if (isInterState) {
          lineIgst = Math.round(taxable * gst) / 100;
        } else {
          lineCgst = Math.round(taxable * (gst / 2)) / 100;
          lineSgst = Math.round(taxable * (gst / 2)) / 100;
        }
      } else {
        const rateIncl = Number(l.rateInclTax || l.rate) || 0;
        const gross = qty * rateIncl;
        const disc = gross * (discPercent / 100);
        const net = gross - disc;
        taxable = Math.round((net / (1 + gst / 100)) * 100) / 100;
        const taxTotal = net - taxable;

        if (isInterState) {
          lineIgst = taxTotal;
        } else {
          lineCgst = Math.floor((taxTotal / 2) * 100) / 100;
          lineSgst = Math.round((taxTotal - lineCgst) * 100) / 100;
        }
      }

      taxableTotal += taxable;
      totalCgst += lineCgst;
      totalSgst += lineSgst;
      totalIgst += lineIgst;
    });

    const subTotal = taxableTotal + totalCgst + totalSgst + totalIgst;
    const roundedGrand = Math.round(subTotal);
    const roundOff = roundedGrand - subTotal;

    return {
      taxableValue: taxableTotal,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      totalTax: totalCgst + totalSgst + totalIgst,
      roundOff,
      grandTotal: roundedGrand
    };
  };

  const totals = calculateTotals();

  // Prepare Live Data for Instant Print Preview
  const prepareLiveVoucherData = () => {
    const calc = calculateTotals();
    return {
      voucher: {
        voucher_id: 'live_preview',
        voucher_type: voucherType,
        voucher_number: voucherNumber,
        voucher_date: voucherDate,
        reference_number: supplierInvoiceNo || voucherNumber,
        reference_date: supplierInvoiceDate || voucherDate,
        payment_mode: paymentMode,
        terms_conditions: termsAndConditions,
        party_name: selectedParty?.party_name || (voucherType === 'PURCHASE' ? 'Supplier Account' : 'Counter Cash Customer'),
        party_gstin: selectedParty?.gstin || '',
        party_phone: selectedParty?.phone || '',
        address_line1: selectedParty?.address_line1 || '',
        city: selectedParty?.city || '',
        state: selectedParty?.state || placeOfSupply.replace(/^[0-9]+\s*-\s*/, ''),
        state_code: selectedParty?.state_code || placeOfSupply.split(' ')[0] || '33',
        narration: narration,
        taxable_amount_paise: Math.round(calc.taxableValue * 100),
        cgst_amount_paise: Math.round(calc.cgst * 100),
        sgst_amount_paise: Math.round(calc.sgst * 100),
        igst_amount_paise: Math.round(calc.igst * 100),
        round_off_paise: Math.round(calc.roundOff * 100),
        total_amount_paise: Math.round(calc.grandTotal * 100)
      },
      lines: isTrading
        ? lines.map((l) => {
            const item = stockItems.find((s) => s.item_id === l.itemId);
            const qty = Number(l.quantity) || 0;
            const rate = Number(l.rate) || 0;
            const disc = Number(l.discountPercent) || 0;
            const gross = qty * rate;
            const taxable = gross - gross * (disc / 100);
            return {
              item_name: item?.item_name || l.description || 'Stock Item',
              description: l.description,
              serial_number: l.serialNumber || undefined,
              hsn_sac: l.hsnSac || item?.hsn_sac || '85044029',
              quantity: qty,
              unit_symbol: l.unit || 'Nos',
              rate_paise: Math.round(rate * 100),
              taxable_amount_paise: Math.round(taxable * 100),
              gst_rate: Number(l.gstRate) || 18
            };
          })
        : ledgerLines.map((ll) => {
            const led = ledgers.find((ld) => ld.ledger_id === ll.ledgerId);
            return {
              item_name: led?.ledger_name || 'Ledger Account',
              description: ll.particulars || '',
              hsn_sac: '998311',
              quantity: 1,
              unit_symbol: 'Entry',
              rate_paise: Math.round(Number(ll.amount || 0) * 100),
              taxable_amount_paise: Math.round(Number(ll.amount || 0) * 100),
              gst_rate: 0
            };
          })
    };
  };

  // Amount in words generator
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

    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
    let str = 'INR ' + inWords(rupees).trim();
    if (paise > 0) {
      str += ' and ' + inWords(paise).trim() + ' paise';
    }
    return str + ' Only';
  };

  // Submit Voucher
  const handlePostVoucher = async (andPrint: boolean = false) => {
    if (isPosting) return;
    if (!company) {
      setErrorMessage('Active company required.');
      return;
    }

    setIsPosting(true);
    setErrorMessage(null);

    try {
      let payload: any = {
        companyId: company.company_id,
        fyId: activeFy?.fy_id,
        financialYearId: activeFy?.fy_id,
        voucherType,
        voucherDate,
        voucherNumber,
        referenceNumber: supplierInvoiceNo,
        referenceNo: supplierInvoiceNo,
        referenceDate: supplierInvoiceDate,
        supplierInvoiceDate,
        paymentMode,
        paymentTerms,
        orderRef,
        termsConditions: termsAndConditions,
        termsAndConditions,
        narration
      };

      if (isTrading) {
        payload.partyId = partyId;
        payload.lines = lines.map((l) => ({
          itemId: l.itemId || undefined,
          description: l.description || null,
          godownId: l.godownId || godowns[0]?.godown_id || undefined,
          quantity: Number(l.quantity),
          ratePaise: Math.round(Number(l.rate) * 100),
          discountPercent: Number(l.discountPercent) || 0,
          gstRate: Number(l.gstRate) || 18,
          isTaxInclusive: taxMode === 'INCLUSIVE',
          serialNumber: l.serialNumber || undefined
        }));
      } else {
        // Financial vouchers: convert DR/CR ledger lines to debitPaise/creditPaise format
        payload.lines = [];
        payload.customLedgerLines = ledgerLines
          .filter((l) => l.ledgerId && Number(l.amount) > 0)
          .map((l) => ({
            ledgerId: l.ledgerId,
            debitPaise: l.type === 'DR' ? Math.round(Number(l.amount) * 100) : 0,
            creditPaise: l.type === 'CR' ? Math.round(Number(l.amount) * 100) : 0,
            particulars: l.particulars || null
          }));
      }

      let res: any;
      if (editVoucherId) {
        res = await api.updateVoucher(editVoucherId, payload);
      } else {
        res = await api.postVoucher(payload);
      }
      setVoucherStatus('Posted');
      if (!editVoucherId) await fetchNextVoucherNumber();
      if (andPrint) {
        onPostSuccess(res.voucherId);
      } else {
        alert(`Voucher ${res.voucherNumber || voucherNumber} ${editVoucherId ? 'updated' : 'posted'} successfully!`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to post voucher.');
    } finally {
      setIsPosting(false);
    }
  };

  // Quick Party Creation Modal Save
  const handleCreateQuickParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      const res = await api.createParty({
        companyId: company.company_id,
        partyName: newPartyName,
        partyType: newPartyType,
        gstin: newPartyGstin,
        pan: newPartyPan,
        phone: newPartyPhone,
        email: newPartyEmail,
        bankName: newPartyBankName,
        addressLine1: newPartyAddress1,
        city: newPartyCity,
        state: newPartyState,
        stateCode: '33',
        pincode: newPartyPincode,
        openingBalancePaise: 0
      });
      const updated = await api.getParties();
      setParties(updated);
      handleSelectParty(res.partyId, res);
      setShowPartyModal(false);
    } catch (err: any) {
      alert('Failed to create party: ' + err.message);
    }
  };

  // Quick Item Creation Modal Save
  const handleCreateQuickItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      const res = await api.createStockItem({
        companyId: company.company_id,
        itemName: newItemName.trim(),
        hsnSac: newItemHsn.trim(),
        unitId: newItemUnitId || units[0]?.unit_id || 'unit_nos',
        gstRate: newItemGstRate,
        purchaseRatePaise: Math.round(newItemPurchaseCost * 100),
        sellingRatePaise: Math.round(newItemSellingPrice * 100),
        openingQty: 0,
        openingValuationPaise: 0,
        reorderLevel: 5
      });
      const updated = await api.getStockItems();
      setStockItems(updated);
      // Select newly created item on current line with rate appropriate for voucherType
      const activeRate = voucherType === 'PURCHASE' ? newItemPurchaseCost : newItemSellingPrice;
      const updatedLines = [...lines];
      if (updatedLines.length > 0) {
        const u = units.find((un) => un.unit_id === (newItemUnitId || units[0]?.unit_id));
        updatedLines[0] = {
          ...updatedLines[0],
          itemId: res.itemId,
          unit: u?.symbol || 'Nos',
          hsnSac: newItemHsn.trim(),
          gstRate: newItemGstRate,
          rate: activeRate,
          rateInclTax: Math.round(activeRate * (1 + newItemGstRate / 100) * 100) / 100
        };
        setLines(updatedLines);
      }
      setShowQuickItemModal(false);
      setNewItemName('');
      setNewItemPurchaseCost(0);
      setNewItemPurchaseCostIncl(0);
      setNewItemSellingPrice(0);
    } catch (err: any) {
      alert('Failed to create item: ' + err.message);
    }
  };

  return (
    <div className="page-container" style={{ padding: '16px 20px', maxWidth: '100%', minHeight: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header Area & Voucher Dock Slidebar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '14px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Voucher Type Slidebar / Dock */}
          <div className="voucher-dock-bar" role="tablist">
            {[
              { type: 'SALES', label: 'Sales', fkey: 'F8' },
              { type: 'PURCHASE', label: 'Purchase', fkey: 'F9' },
              { type: 'RECEIPT', label: 'Receipt', fkey: 'F6' },
              { type: 'PAYMENT', label: 'Payment', fkey: 'F5' },
              { type: 'CONTRA', label: 'Contra', fkey: 'F4' },
              { type: 'JOURNAL', label: 'Journal', fkey: 'F7' },
            ].map((item) => (
              <button
                key={item.type}
                type="button"
                className={`voucher-dock-btn ${voucherType === item.type ? 'active' : ''}`}
                onClick={() => switchVoucherType(item.type)}
                title={`Switch to ${item.label} (${item.fkey})`}
              >
                <span className="voucher-dock-fkey">{item.fkey}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Voucher Number Pill */}
          <div
            className="tabular-nums"
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-subtle)',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>NO:</span>
            <span>{voucherNumber}</span>
          </div>

          {/* Status Badge */}
          <span
            className={`badge-status ${voucherStatus === 'Posted' ? 'badge-success' : 'badge-warning'}`}
            style={{ fontSize: '11px', textTransform: 'uppercase' }}
          >
            {voucherStatus}
          </span>
        </div>

        {/* Top Actions: Print Preview, Save, Save & Print */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowLivePreview(true)}
            title="Print Preview (Alt+P)"
          >
            <Eye size={14} />
            <span>Print Preview</span>
            <kbd style={{ fontSize: '10px', padding: '1px 4px' }}>Alt+P</kbd>
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handlePostVoucher(false)}
            disabled={isPosting}
            title="Save Voucher (Ctrl+A)"
          >
            <span>Save</span>
            <kbd style={{ fontSize: '10px', padding: '1px 4px' }}>Ctrl+A</kbd>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => handlePostVoucher(true)}
            disabled={isPosting}
          >
            <Printer size={14} />
            <span>Save & Print</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger-red)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '12.5px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertCircle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Form Layout: 2 Columns (Form on left, Summary on right) */}
      <div className={`voucher-main-layout ${!isTrading || !isSummaryExpanded ? 'no-summary' : ''}`}>
        {/* Left Column: Voucher Metadata, Customer Info, Item Grid, Footer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Metadata Card: Date, Party, Bill No, Tax Mode, Place of Supply */}
          <div className="ledger-card" style={{ padding: '18px 20px' }}>
            <div className={voucherType === 'PURCHASE' ? 'voucher-meta-grid-purchase' : 'voucher-meta-grid-sales'}>
              {/* Supplier Invoice No & Date for Purchase */}
              {voucherType === 'PURCHASE' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--primary-accent)', marginBottom: '5px' }}>
                    Supplier Invoice No. *
                  </label>
                  <input
                    type="text"
                    value={supplierInvoiceNo}
                    onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                    placeholder="e.g. CL/26-27/1126"
                    style={{ width: '100%', fontWeight: 600, borderColor: supplierInvoiceNo ? 'var(--primary-accent)' : undefined }}
                  />
                </div>
              )}

              {voucherType === 'PURCHASE' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Supplier Bill Date *
                  </label>
                  <input
                    type="date"
                    value={supplierInvoiceDate}
                    onChange={(e) => setSupplierInvoiceDate(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {/* Party Selector */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {voucherType === 'PURCHASE' ? 'Supplier Party *' : 'Customer Party *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPartyType(voucherType === 'PURCHASE' ? 'SUPPLIER' : 'CUSTOMER');
                      setShowPartyModal(true);
                    }}
                    style={{
                      background: 'none',
                      color: 'var(--primary-accent)',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: 0
                    }}
                  >
                    + New Party
                  </button>
                </div>
                <select
                  value={partyId}
                  onChange={(e) => handleSelectParty(e.target.value)}
                  style={{ width: '100%', fontWeight: 500 }}
                >
                  <option value="">-- Select Party --</option>
                  {parties.map((p) => (
                    <option key={p.party_id} value={p.party_id}>
                      {p.party_name} ({p.party_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Place of Supply */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Place of Supply
                </label>
                <input
                  type="text"
                  value={placeOfSupply}
                  onChange={(e) => setPlaceOfSupply(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Sub-row: Entry Date, Reference No, and Tax Calculation Mode */}
            <div className="voucher-subrow-grid">
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Book Entry Date
                </label>
                <input
                  type="date"
                  id="voucher-date-input"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Order / Ref No. & Date
                </label>
                <input
                  type="text"
                  value={orderRef}
                  onChange={(e) => setOrderRef(e.target.value)}
                  placeholder="e.g. 1126 dt. 7-May-26"
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Tax Calculation Mode
                </label>
                <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setTaxMode('EXCLUSIVE')}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      fontSize: '11.5px',
                      fontWeight: taxMode === 'EXCLUSIVE' ? 700 : 500,
                      borderRadius: '5px',
                      border: '1px solid',
                      borderColor: taxMode === 'EXCLUSIVE' ? 'var(--primary-accent)' : 'var(--border-subtle)',
                      backgroundColor: taxMode === 'EXCLUSIVE' ? 'var(--bg-card)' : 'transparent',
                      color: taxMode === 'EXCLUSIVE' ? 'var(--primary-accent)' : 'var(--text-secondary)'
                    }}
                  >
                    Tax Exclusive (GST Added)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxMode('INCLUSIVE')}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      fontSize: '11.5px',
                      fontWeight: taxMode === 'INCLUSIVE' ? 700 : 500,
                      borderRadius: '5px',
                      border: '1px solid',
                      borderColor: taxMode === 'INCLUSIVE' ? 'var(--primary-accent)' : 'var(--border-subtle)',
                      backgroundColor: taxMode === 'INCLUSIVE' ? 'var(--bg-card)' : 'transparent',
                      color: taxMode === 'INCLUSIVE' ? 'var(--primary-accent)' : 'var(--text-secondary)'
                    }}
                  >
                    Tax Inclusive (MRP)
                  </button>
                </div>
              </div>
            </div>

            {/* Compact Customer / Supplier Information Panel */}
            {selectedParty && (
              <div
                style={{
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: '1px dashed var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: selectedParty.pan ? '1.8fr 1.2fr 1fr 1fr 1fr' : '2fr 1.4fr 1.2fr 1fr',
                  gap: '12px',
                  fontSize: '11.5px'
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Address</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    {selectedParty.address_line1 || selectedParty.city || 'Counter Party'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>GSTIN / UIN</span>
                  <span className="tabular-nums" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {selectedParty.gstin || 'Unregistered'}
                  </span>
                </div>
                {selectedParty.pan && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>PAN</span>
                    <span className="tabular-nums" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {selectedParty.pan}
                    </span>
                  </div>
                )}
                {selectedParty.bank_name && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Bank</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {selectedParty.bank_name}
                    </span>
                  </div>
                )}
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Ledger Balance</span>
                  <span
                    className="tabular-nums"
                    style={{
                      color: selectedParty.current_balance_paise >= 0 ? 'var(--success-emerald)' : 'var(--danger-red)',
                      fontWeight: 700
                    }}
                  >
                    ₹{((selectedParty.current_balance_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {selectedParty.current_balance_paise >= 0 ? 'Dr' : 'Cr'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Item Grid (Spreadsheet-Style Table) */}
          {isTrading ? (
            <div className="ledger-card" style={{ padding: '20px 22px', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Item Details & Bill Breakdown
                  </h3>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    ({taxMode === 'EXCLUSIVE' ? 'Tax Exclusive — GST added on taxable value' : 'Tax Inclusive — GST extracted from gross'})
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                    className="btn-secondary"
                    style={{ fontSize: '11.5px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    title={isSummaryExpanded ? 'Collapse summary panel to give maximum space to table' : 'Show summary panel'}
                  >
                    {isSummaryExpanded ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                    <span>{isSummaryExpanded ? 'Full Width Grid' : 'Dock Summary'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuickItemModal(true)}
                    style={{
                      background: 'none',
                      color: 'var(--primary-accent)',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <PackagePlus size={14} />
                    <span>+ New Item Master</span>
                  </button>
                </div>
              </div>

              {/* Spreadsheet Table (Desktop View) */}
              <div className="voucher-table-desktop" style={{ overflowX: 'auto', flex: 1, minHeight: '280px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <table className="voucher-grid-table" style={{ width: '100%', minWidth: '1380px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '38px', minWidth: '38px', textAlign: 'center' }}>#</th>
                      <th style={{ minWidth: '340px', width: '380px' }}>Item Name & Line Details (Serial / Warranty / Notes)</th>
                      <th style={{ width: '110px', minWidth: '110px', textAlign: 'center' }}>HSN / SAC</th>
                      <th style={{ width: '85px', minWidth: '85px', textAlign: 'right' }}>Qty</th>
                      <th style={{ width: '70px', minWidth: '70px', textAlign: 'center' }}>Unit</th>
                      <th style={{ width: '140px', minWidth: '140px', textAlign: 'right' }}>
                        Rate Excl. (₹) {taxMode === 'EXCLUSIVE' && <span style={{ color: 'var(--primary-accent)', fontSize: '10px' }}>● BASE</span>}
                      </th>
                      <th style={{ width: '140px', minWidth: '140px', textAlign: 'right' }}>
                        Rate Incl. (₹) {taxMode === 'INCLUSIVE' && <span style={{ color: 'var(--primary-accent)', fontSize: '10px' }}>● BASE</span>}
                      </th>
                      <th style={{ width: '75px', minWidth: '75px', textAlign: 'right' }}>Disc %</th>
                      <th style={{ width: '90px', minWidth: '90px', textAlign: 'center' }}>GST %</th>
                      <th style={{ width: '125px', minWidth: '125px', textAlign: 'right' }}>Taxable (₹)</th>
                      <th style={{ width: '135px', minWidth: '135px', textAlign: 'right' }}>Amount (₹)</th>
                      <th style={{ width: '44px', minWidth: '44px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((row, idx) => {
                      const qty = Number(row.quantity) || 0;
                      const gst = Number(row.gstRate) || 18;
                      const discPercent = Number(row.discountPercent) || 0;

                      let lineTaxable = 0;
                      let lineTotal = 0;

                      if (taxMode === 'EXCLUSIVE') {
                        const r = Number(row.rate) || 0;
                        const gross = qty * r;
                        const disc = gross * (discPercent / 100);
                        lineTaxable = gross - disc;
                        const tax = lineTaxable * (gst / 100);
                        lineTotal = lineTaxable + tax;
                      } else {
                        const rIncl = Number(row.rateInclTax || row.rate) || 0;
                        const gross = qty * rIncl;
                        const disc = gross * (discPercent / 100);
                        lineTotal = gross - disc;
                        lineTaxable = lineTotal / (1 + gst / 100);
                      }

                      return (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '12px' }} className="tabular-nums">
                            {idx + 1}
                          </td>
                          <td>
                            <select
                              value={row.itemId}
                              onChange={(e) => updateLine(idx, 'itemId', e.target.value)}
                              style={{ width: '100%', height: '34px', padding: '5px 8px', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}
                            >
                              <option value="">-- Select Stock Item --</option>
                              {stockItems.map((stk) => (
                                <option key={stk.item_id} value={stk.item_id}>
                                  {stk.item_name}
                                </option>
                              ))}
                            </select>
                            {/* Serial Number Selection */}
                            {stockItems.find(s => s.item_id === row.itemId)?.has_serial_no ? (
                              <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                                {voucherType === 'SALES' || (voucherType as string) === 'PURCHASE_RETURN' ? (
                                  <select
                                    value={row.serialNumber || ''}
                                    onChange={(e) => updateLine(idx, 'serialNumber', e.target.value)}
                                    style={{ width: '100%', height: '28px', padding: '4px 8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}
                                  >
                                    <option value="">-- Select Available Serial No --</option>
                                    {row.availableSerials?.map((s: string) => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={row.serialNumber || ''}
                                    onChange={(e) => updateLine(idx, 'serialNumber', e.target.value)}
                                    placeholder="Enter New Serial Number"
                                    style={{ width: '100%', height: '28px', padding: '4px 8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}
                                  />
                                )}
                              </div>
                            ) : null}
                            {/* Serial Number / Warranty / Line Remarks */}
                            <input
                              type="text"
                              value={row.description || ''}
                              onChange={(e) => updateLine(idx, 'description', e.target.value)}
                              placeholder="Line Remarks / Warranty Notes (e.g. 1YR WRNTY)"
                              style={{ width: '100%', height: '28px', padding: '4px 8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={row.hsnSac || ''}
                              onChange={(e) => updateLine(idx, 'hsnSac', e.target.value)}
                              placeholder="85044029"
                              style={{ width: '100%', height: '34px', textAlign: 'center', padding: '6px 8px', fontSize: '12.5px', fontFamily: 'var(--font-mono)' }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={row.quantity}
                              onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                              style={{ width: '100%', height: '34px', textAlign: 'right', padding: '6px 8px', fontSize: '13px', fontWeight: 600 }}
                              className="tabular-nums"
                            />
                          </td>
                          <td style={{ textAlign: 'center', paddingTop: '14px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                              {row.unit || 'nos'}
                            </span>
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={row.rate}
                              onChange={(e) => updateLine(idx, 'rate', e.target.value)}
                              style={{
                                width: '100%',
                                height: '34px',
                                textAlign: 'right',
                                padding: '6px 8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                backgroundColor: taxMode === 'EXCLUSIVE' ? 'var(--bg-app)' : undefined,
                                borderColor: taxMode === 'EXCLUSIVE' ? 'var(--primary-accent)' : undefined
                              }}
                              className="tabular-nums"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={row.rateInclTax}
                              onChange={(e) => updateLine(idx, 'rateInclTax', e.target.value)}
                              style={{
                                width: '100%',
                                height: '34px',
                                textAlign: 'right',
                                padding: '6px 8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                backgroundColor: taxMode === 'INCLUSIVE' ? 'var(--bg-app)' : undefined,
                                borderColor: taxMode === 'INCLUSIVE' ? 'var(--primary-accent)' : undefined
                              }}
                              className="tabular-nums"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.1"
                              value={row.discountPercent}
                              onChange={(e) => updateLine(idx, 'discountPercent', e.target.value)}
                              style={{ width: '100%', height: '34px', textAlign: 'right', padding: '6px 8px', fontSize: '13px' }}
                              className="tabular-nums"
                            />
                          </td>
                          <td>
                            <select
                              value={row.gstRate || 18}
                              onChange={(e) => updateLine(idx, 'gstRate', Number(e.target.value))}
                              style={{ width: '100%', height: '34px', padding: '6px 6px', fontSize: '12.5px', textAlign: 'center' }}
                            >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={12}>12%</option>
                              <option value={18}>18%</option>
                              <option value={28}>28%</option>
                            </select>
                          </td>
                          <td style={{ textAlign: 'right', paddingTop: '14px' }} className="tabular-nums">
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              ₹{lineTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', paddingTop: '14px' }} className="tabular-nums">
                            <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', paddingTop: '10px' }}>
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              disabled={lines.length === 1}
                              style={{
                                background: 'none',
                                color: lines.length === 1 ? 'var(--text-muted)' : 'var(--danger-red)',
                                padding: '6px',
                                borderRadius: '4px',
                                opacity: lines.length === 1 ? 0.3 : 1
                              }}
                              title="Delete Line"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Touch Cards View (Responsive < 860px) */}
              <div className="voucher-cards-mobile">
                {lines.map((row, idx) => {
                  const qty = Number(row.quantity) || 0;
                  const gst = Number(row.gstRate) || 18;
                  const discPercent = Number(row.discountPercent) || 0;

                  let lineTaxable = 0;
                  let lineTotal = 0;

                  if (taxMode === 'EXCLUSIVE') {
                    const r = Number(row.rate) || 0;
                    const gross = qty * r;
                    const disc = gross * (discPercent / 100);
                    lineTaxable = gross - disc;
                    const tax = lineTaxable * (gst / 100);
                    lineTotal = lineTaxable + tax;
                  } else {
                    const rIncl = Number(row.rateInclTax || row.rate) || 0;
                    const gross = qty * rIncl;
                    const disc = gross * (discPercent / 100);
                    lineTotal = gross - disc;
                    lineTaxable = lineTotal / (1 + gst / 100);
                  }

                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        background: 'var(--surface)', 
                        border: '1px solid var(--border)', 
                        borderRadius: 'var(--radius-lg)', 
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary-accent)' }}>
                          ITEM #{idx + 1}
                        </span>
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            style={{
                              background: 'rgba(255, 119, 126, 0.1)',
                              border: '1px solid rgba(255, 119, 126, 0.25)',
                              color: 'var(--danger)',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px'
                            }}
                          >
                            <Trash2 size={12} />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>

                      {/* Stock Item Selector */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          STOCK ITEM *
                        </label>
                        <select
                          value={row.itemId}
                          onChange={(e) => updateLine(idx, 'itemId', e.target.value)}
                          style={{ width: '100%', height: '36px', fontSize: '13px', fontWeight: 600 }}
                        >
                          <option value="">-- Select Stock Item --</option>
                          {stockItems.map((stk) => (
                            <option key={stk.item_id} value={stk.item_id}>
                              {stk.item_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Line Remarks / S/N */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                          SERIAL / NOTES / WARRANTY
                        </label>
                        <input
                          type="text"
                          value={row.description || ''}
                          onChange={(e) => updateLine(idx, 'description', e.target.value)}
                          placeholder="e.g. SN-8921, 1 Yr Warranty"
                          style={{ width: '100%', height: '32px', fontSize: '12px' }}
                        />
                      </div>

                      {/* Qty, Unit, HSN */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            QTY
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                            style={{ width: '100%', height: '34px', textAlign: 'right', fontWeight: 600 }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            UNIT
                          </label>
                          <div style={{ height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-elevated)', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                            {row.unit || 'nos'}
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            HSN / SAC
                          </label>
                          <input
                            type="text"
                            value={row.hsnSac || ''}
                            onChange={(e) => updateLine(idx, 'hsnSac', e.target.value)}
                            style={{ width: '100%', height: '34px', textAlign: 'center', fontSize: '12px' }}
                          />
                        </div>
                      </div>

                      {/* Rates: Excl and Incl */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            RATE EXCL. (₹) {taxMode === 'EXCLUSIVE' && '●'}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={row.rate}
                            onChange={(e) => updateLine(idx, 'rate', e.target.value)}
                            style={{ width: '100%', height: '34px', textAlign: 'right', fontWeight: 600 }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            RATE INCL. (₹) {taxMode === 'INCLUSIVE' && '●'}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={row.rateInclTax}
                            onChange={(e) => updateLine(idx, 'rateInclTax', e.target.value)}
                            style={{ width: '100%', height: '34px', textAlign: 'right', fontWeight: 600 }}
                          />
                        </div>
                      </div>

                      {/* Discount and GST Rate */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            DISCOUNT %
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={row.discountPercent}
                            onChange={(e) => updateLine(idx, 'discountPercent', e.target.value)}
                            style={{ width: '100%', height: '34px', textAlign: 'right' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            GST %
                          </label>
                          <select
                            value={row.gstRate || 18}
                            onChange={(e) => updateLine(idx, 'gstRate', Number(e.target.value))}
                            style={{ width: '100%', height: '34px' }}
                          >
                            <option value={0}>0% (Nil)</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </div>
                      </div>

                      {/* Card Summary Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px dashed var(--border-subtle)', marginTop: '2px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Taxable: <strong style={{ color: 'var(--text-primary)' }}>₹{lineTaxable.toFixed(2)}</strong>
                        </span>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--green)' }}>
                          Line Total: ₹{lineTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Line Button & Inline Bottom Summary when sidebar collapsed */}
              <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <button
                  type="button"
                  onClick={addLine}
                  className="btn-secondary"
                  style={{ fontSize: '12.5px', padding: '7px 16px', fontWeight: 600 }}
                >
                  <Plus size={14} />
                  <span>+ Add Item Row</span>
                </button>

                {!isSummaryExpanded && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '18px',
                      padding: '8px 16px',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      fontSize: '12.5px'
                    }}
                  >
                    <span>Taxable: <strong className="tabular-nums">₹{totals.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                    <span>CGST: <strong className="tabular-nums">₹{totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                    <span>SGST: <strong className="tabular-nums">₹{totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                    {totals.roundOff !== 0 && (
                      <span style={{ color: totals.roundOff < 0 ? 'var(--danger-red)' : 'var(--text-primary)' }}>
                        Round Off: <strong className="tabular-nums">{totals.roundOff < 0 ? `(-)₹${Math.abs(totals.roundOff).toFixed(2)}` : `₹${totals.roundOff.toFixed(2)}`}</strong>
                      </span>
                    )}
                    <div style={{ paddingLeft: '10px', borderLeft: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginRight: '6px' }}>Total:</span>
                      <strong className="tabular-nums" style={{ fontSize: '16px', color: 'var(--primary-accent)' }}>
                        ₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Financial Voucher Lines (Receipt / Payment / Contra / Journal) */
            <div className="ledger-card" style={{ padding: '16px 18px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                Accounting Ledger Postings (Double Entry)
              </h3>
              <div className="voucher-table-desktop">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>Type</th>
                      <th>Account Ledger</th>
                      <th style={{ width: '140px', textAlign: 'right' }}>Amount (₹)</th>
                      <th>Particulars</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerLines.map((row, idx) => (
                      <tr key={idx}>
                        <td>
                          <select
                            value={row.type}
                            onChange={(e) => {
                              const updated = [...ledgerLines];
                              updated[idx].type = e.target.value;
                              setLedgerLines(updated);
                            }}
                            style={{ padding: '4px 6px', fontWeight: 700 }}
                          >
                            <option value="DR">Dr</option>
                            <option value="CR">Cr</option>
                          </select>
                        </td>
                        <td>
                          <select
                            value={row.ledgerId}
                            onChange={(e) => {
                              const updated = [...ledgerLines];
                              updated[idx].ledgerId = e.target.value;
                              setLedgerLines(updated);
                            }}
                            style={{ width: '100%' }}
                          >
                            <option value="">-- Select Account Ledger --</option>
                            {ledgers.map((l) => (
                              <option key={l.ledger_id} value={l.ledger_id}>
                                {l.ledger_name} ({l.group_name})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => {
                              const updated = [...ledgerLines];
                              updated[idx].amount = Number(e.target.value);
                              setLedgerLines(updated);
                            }}
                            style={{ width: '100%', textAlign: 'right' }}
                            className="tabular-nums"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={row.particulars}
                            onChange={(e) => {
                              const updated = [...ledgerLines];
                              updated[idx].particulars = e.target.value;
                              setLedgerLines(updated);
                            }}
                            placeholder="Reference note"
                            style={{ width: '100%' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Touch Cards View for Financial Vouchers */}
              <div className="voucher-cards-mobile">
                {ledgerLines.map((row, idx) => (
                  <div 
                    key={idx}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        value={row.type}
                        onChange={(e) => {
                          const updated = [...ledgerLines];
                          updated[idx].type = e.target.value;
                          setLedgerLines(updated);
                        }}
                        style={{ width: '80px', height: '34px', fontWeight: 700 }}
                      >
                        <option value="DR">Dr</option>
                        <option value="CR">Cr</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount (₹)"
                        value={row.amount}
                        onChange={(e) => {
                          const updated = [...ledgerLines];
                          updated[idx].amount = Number(e.target.value);
                          setLedgerLines(updated);
                        }}
                        style={{ flex: 1, height: '34px', textAlign: 'right', fontWeight: 600 }}
                      />
                    </div>
                    <div>
                      <select
                        value={row.ledgerId}
                        onChange={(e) => {
                          const updated = [...ledgerLines];
                          updated[idx].ledgerId = e.target.value;
                          setLedgerLines(updated);
                        }}
                        style={{ width: '100%', height: '34px' }}
                      >
                        <option value="">-- Select Account Ledger --</option>
                        {ledgers.map((l) => (
                          <option key={l.ledger_id} value={l.ledger_id}>
                            {l.ledger_name} ({l.group_name})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input
                        type="text"
                        value={row.particulars}
                        onChange={(e) => {
                          const updated = [...ledgerLines];
                          updated[idx].particulars = e.target.value;
                          setLedgerLines(updated);
                        }}
                        placeholder="Reference note / particulars"
                        style={{ width: '100%', height: '32px', fontSize: '12px' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Voucher Footer: Narration, Payment Details, Terms */}
          <div className="ledger-card" style={{ padding: '16px 18px' }}>
            <div className="voucher-footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Narration & Notes
                </label>
                <textarea
                  rows={3}
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="e.g. Purchase of HP 65W Blue Adapter, Serial: 3cb0720r3y, 1Yr Dealer Wrnty..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Payment Mode & Reference
                </label>
                <input
                  type="text"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  placeholder="e.g. GPAY / ICICI Bank / NEFT"
                  style={{ width: '100%', marginBottom: '8px' }}
                />
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="Terms: e.g. Immediate / Net 30 Days"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Declaration / Terms & Conditions
                </label>
                <textarea
                  rows={3}
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  placeholder="e.g. 01-Once product sold no cancel or return. 02=Product warranty is from service center only..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Invoice Summary (Compact Panel) */}
        {isTrading && isSummaryExpanded && (
          <div>
            <div
              className="ledger-card"
              style={{
                padding: '18px 20px',
                position: 'sticky',
                top: '78px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    margin: 0
                  }}
                >
                  Bill Summary
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSummaryExpanded(false)}
                  style={{
                    background: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '11px',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                  title="Hide summary panel to expand item grid"
                >
                  Hide ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Taxable Value</span>
                  <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    ₹{totals.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>CGST (9%)</span>
                  <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    ₹{totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>SGST (9%)</span>
                  <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    ₹{totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {totals.igst > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>IGST (18%)</span>
                    <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      ₹{totals.igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Round Off</span>
                  <span className="tabular-nums" style={{ fontWeight: 600, color: totals.roundOff < 0 ? 'var(--danger-red)' : 'var(--text-primary)' }}>
                    {totals.roundOff < 0 ? `(-)₹${Math.abs(totals.roundOff).toFixed(2)}` : `₹${totals.roundOff.toFixed(2)}`}
                  </span>
                </div>

                {/* Grand Total (Highlighted) */}
                <div
                  style={{
                    margin: '12px 0',
                    padding: '12px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline'
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Total Amount
                  </span>
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: '20px',
                      fontWeight: 800,
                      color: 'var(--primary-accent)'
                    }}
                  >
                    ₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Amount in Words */}
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-subtle)',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    lineHeight: 1.4
                  }}
                >
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
                    Amount Chargeable (in words):
                  </strong>
                  {numberToWords(totals.grandTotal)}
                </div>

                {/* Tax Amount in Words */}
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-subtle)',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    lineHeight: 1.4
                  }}
                >
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
                    Tax Amount (in words):
                  </strong>
                  {numberToWords(totals.totalTax)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div
        style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <button
          className="btn-secondary"
          onClick={() => {
            if (confirm('Cancel voucher entry?')) {
              setLines([{ itemId: '', description: '', quantity: 1, unit: 'Nos', hsnSac: '85044029', rate: 0, rateInclTax: 0, discountPercent: 0, gstRate: 18 }]);
            }
          }}
        >
          Cancel
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowLivePreview(true)}
            title="Print Preview (Alt+P)"
          >
            <Eye size={14} />
            <span>Print Preview</span>
            <kbd style={{ fontSize: '10px', padding: '1px 4px' }}>Alt+P</kbd>
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handlePostVoucher(false)}
            disabled={isPosting}
          >
            Save (Ctrl+A)
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => handlePostVoucher(true)}
            disabled={isPosting}
            style={{ padding: '9px 20px', fontSize: '13.5px' }}
          >
            <Printer size={15} />
            <span>Save & Print</span>
          </button>
        </div>
      </div>

      {/* Quick Party Creation Modal */}
      {showPartyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--modal-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
        >
          <div className="ledger-card" style={{ width: '560px', padding: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Create New {newPartyType === 'CUSTOMER' ? 'Customer' : 'Supplier'}
            </h3>
            <form onSubmit={handleCreateQuickParty}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Party / Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPartyName}
                    onChange={(e) => setNewPartyName(e.target.value)}
                    placeholder="e.g. CLARITY INFOTECH (2026-2027)"
                    style={{ width: '100%', padding: '8px 10px' }}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: newPartyType === 'SUPPLIER' ? '1fr 1fr' : '1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      value={newPartyGstin}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setNewPartyGstin(val);
                        if (val.length === 15 && !newPartyPan) {
                          setNewPartyPan(val.substring(2, 12));
                        }
                      }}
                      placeholder="e.g. 33DZAPP8546J2ZY"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                  {/* PAN Details: Only shown for Supplier */}
                  {newPartyType === 'SUPPLIER' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                        PAN (Auto-extracted from GSTIN)
                      </label>
                      <input
                        type="text"
                        value={newPartyPan}
                        onChange={(e) => setNewPartyPan(e.target.value.toUpperCase())}
                        placeholder="e.g. DZAPP8546J"
                        style={{ width: '100%', padding: '8px 10px' }}
                      />
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Phone / Mobile
                    </label>
                    <input
                      type="text"
                      value={newPartyPhone}
                      onChange={(e) => setNewPartyPhone(e.target.value)}
                      placeholder="+91 93600 34774"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={newPartyEmail}
                      onChange={(e) => setNewPartyEmail(e.target.value)}
                      placeholder="clarityinfo20@gmail.com"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Address
                  </label>
                  <input
                    type="text"
                    value={newPartyAddress1}
                    onChange={(e) => setNewPartyAddress1(e.target.value)}
                    placeholder="SECOND FLOOR, ROOM NO 001, KPRS Towers, TENNURE HIGH ROAD"
                    style={{ width: '100%', padding: '8px 10px' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      City
                    </label>
                    <input
                      type="text"
                      value={newPartyCity}
                      onChange={(e) => setNewPartyCity(e.target.value)}
                      placeholder="Tiruchirappalli"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Pincode
                    </label>
                    <input
                      type="text"
                      value={newPartyPincode}
                      onChange={(e) => setNewPartyPincode(e.target.value)}
                      placeholder="620017"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={newPartyBankName}
                      onChange={(e) => setNewPartyBankName(e.target.value)}
                      placeholder="ICICI BANK"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowPartyModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 18px' }}>
                  Create Party
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Item Creation Modal */}
      {showQuickItemModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--modal-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
        >
          <div className="ledger-card" style={{ width: '560px', padding: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Create Stock Item
            </h3>
            <form onSubmit={handleCreateQuickItem}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Item Description / Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="e.g. ADT OEM OG HP 65W BLUE"
                    style={{ width: '100%', padding: '8px 10px' }}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      HSN / SAC Code
                    </label>
                    <input
                      type="text"
                      value={newItemHsn}
                      onChange={(e) => setNewItemHsn(e.target.value)}
                      placeholder="85044029"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Unit
                    </label>
                    <select
                      value={newItemUnitId}
                      onChange={(e) => setNewItemUnitId(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px' }}
                    >
                      {units.map((u) => (
                        <option key={u.unit_id} value={u.unit_id}>
                          {u.symbol} ({u.unit_name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      GST Rate %
                    </label>
                    <select
                      value={newItemGstRate}
                      onChange={(e) => {
                        const rate = Number(e.target.value);
                        setNewItemGstRate(rate);
                        if (newItemPurchaseCost > 0) {
                          setNewItemPurchaseCostIncl(Math.round(newItemPurchaseCost * (1 + rate / 100) * 100) / 100);
                        }
                      }}
                      style={{ width: '100%', padding: '8px 10px' }}
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Cost Excl. Tax (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newItemPurchaseCost}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setNewItemPurchaseCost(val);
                        setNewItemPurchaseCostIncl(Math.round(val * (1 + newItemGstRate / 100) * 100) / 100);
                        if (newItemSellingPrice === 0) {
                          setNewItemSellingPrice(Math.round(val * (1 + newItemGstRate / 100) * 100) / 100);
                        }
                      }}
                      placeholder="550.85"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Cost Incl. Tax (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newItemPurchaseCostIncl}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setNewItemPurchaseCostIncl(val);
                        setNewItemPurchaseCost(Math.round((val / (1 + newItemGstRate / 100)) * 100) / 100);
                        if (newItemSellingPrice === 0) {
                          setNewItemSellingPrice(val);
                        }
                      }}
                      placeholder="650.00"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Selling Price (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newItemSellingPrice}
                      onChange={(e) => setNewItemSellingPrice(Number(e.target.value))}
                      placeholder="650.00"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowQuickItemModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 18px' }}>
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Print Preview Modal */}
      {showLivePreview && (
        <InvoicePrintModal
          liveVoucherData={prepareLiveVoucherData()}
          company={company}
          onClose={() => setShowLivePreview(false)}
        />
      )}
    </div>
  );
};
