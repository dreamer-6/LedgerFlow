import React, { useState, useEffect } from 'react';
import { api, Company, FinancialYear } from '../api/client';
import { Plus, Trash2, Check, UserPlus, FileText, ChevronDown, ChevronUp, Building2, MapPin, ShieldCheck, Boxes, PackagePlus, AlertCircle } from 'lucide-react';

interface VoucherEntryViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  initialType?: string;
  onPostSuccess: (voucherId: string) => void;
}

export const VoucherEntryView: React.FC<VoucherEntryViewProps> = ({
  company,
  activeFy,
  initialType = 'SALES',
  onPostSuccess
}) => {
  const [voucherType, setVoucherType] = useState<string>(initialType);
  const [voucherNumber, setVoucherNumber] = useState<string>('');
  const [voucherDate, setVoucherDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState<string>('');
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [partyId, setPartyId] = useState<string>('');
  const [narration, setNarration] = useState<string>('');

  // Tally Party Details (Supplier / Buyer Subform)
  const [showPartyDetails, setShowPartyDetails] = useState<boolean>(true);
  const [supplierDetails, setSupplierDetails] = useState({
    partyName: '',
    mailingName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: 'Tamil Nadu',
    stateCode: '33',
    pincode: '',
    gstin: '',
    gstType: 'Regular',
    placeOfSupply: '33 - Tamil Nadu'
  });

  const [parties, setParties] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [godowns, setGodowns] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  // Multi-line Items for Trading Vouchers (Sales / Purchase)
  const [lines, setLines] = useState<any[]>([
    { itemId: '', godownId: 'godown_main', quantity: 1, rate: 0, discountPercent: 0, gstRate: 18 }
  ]);

  // Financial Voucher Lines (Receipt / Payment / Contra / Journal)
  const [ledgerLines, setLedgerLines] = useState<any[]>([
    { ledgerId: '', type: 'DR', amount: 0, particulars: '' },
    { ledgerId: '', type: 'CR', amount: 0, particulars: '' }
  ]);

  // Quick Party Modal State (Tally Alt+C)
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyType, setNewPartyType] = useState<'CUSTOMER' | 'SUPPLIER'>('SUPPLIER');
  const [newPartyGstin, setNewPartyGstin] = useState('');
  const [newPartyPan, setNewPartyPan] = useState('');
  const [newPartyAddress1, setNewPartyAddress1] = useState('');
  const [newPartyAddress2, setNewPartyAddress2] = useState('');
  const [newPartyCity, setNewPartyCity] = useState('Chennai');
  const [newPartyState, setNewPartyState] = useState('Tamil Nadu');
  const [newPartyStateCode, setNewPartyStateCode] = useState('33');
  const [newPartyPincode, setNewPartyPincode] = useState('600001');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyEmail, setNewPartyEmail] = useState('');
  const [newPartyOpeningBal, setNewPartyOpeningBal] = useState(0);

  // Quick Stock Item Modal State (Tally Alt+I / Alt+C on item line)
  const [showQuickItemModal, setShowQuickItemModal] = useState(false);
  const [targetLineIndexForItem, setTargetLineIndexForItem] = useState<number>(0);
  const [newItemName, setNewItemName] = useState('');
  const [newItemHsn, setNewItemHsn] = useState('8471');
  const [newItemUnitId, setNewItemUnitId] = useState('');
  const [newItemGstRate, setNewItemGstRate] = useState<number>(18);
  const [newItemSellingPrice, setNewItemSellingPrice] = useState<number>(0);
  const [newItemPurchasePrice, setNewItemPurchasePrice] = useState<number>(0);
  const [newItemOpeningQty, setNewItemOpeningQty] = useState<number>(0);
  const [quickItemError, setQuickItemError] = useState<string | null>(null);
  const [isCreatingItem, setIsCreatingItem] = useState(false);

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

      // Default first party for current voucher type
      const suitableParties = pty.filter((p: any) => {
        if (voucherType === 'PURCHASE' || voucherType === 'PAYMENT') return p.party_type === 'SUPPLIER' || p.party_type === 'BOTH';
        if (voucherType === 'SALES' || voucherType === 'RECEIPT') return p.party_type === 'CUSTOMER' || p.party_type === 'BOTH';
        return true;
      });

      if (suitableParties.length > 0 && !partyId) {
        selectParty(suitableParties[0]);
      }

      if (items.length > 0 && lines[0].itemId === '') {
        const rate = voucherType === 'PURCHASE' ? items[0].purchase_rate_paise / 100 : items[0].selling_rate_paise / 100;
        setLines([{ itemId: items[0].item_id, godownId: gd[0]?.godown_id || 'godown_main', quantity: 1, rate, discountPercent: 0, gstRate: items[0].gst_rate }]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadMasters();
  }, []);

  // Update voucher number & party filter on type change
  useEffect(() => {
    if (company && activeFy) {
      api.getNextVoucherNumber(company.company_id, activeFy.fy_id, voucherType)
        .then(res => setVoucherNumber(res.nextVoucherNumber))
        .catch(console.error);
    }

    // Switch default party type for quick create
    setNewPartyType(voucherType === 'PURCHASE' || voucherType === 'PAYMENT' ? 'SUPPLIER' : 'CUSTOMER');

    // Auto-select matching party
    const suitableParties = parties.filter(p => {
      if (voucherType === 'PURCHASE' || voucherType === 'PAYMENT') return p.party_type === 'SUPPLIER' || p.party_type === 'BOTH';
      if (voucherType === 'SALES' || voucherType === 'RECEIPT') return p.party_type === 'CUSTOMER' || p.party_type === 'BOTH';
      return true;
    });
    if (suitableParties.length > 0) {
      selectParty(suitableParties[0]);
    } else {
      setPartyId('');
    }

    // Update lines to purchase or selling rate
    if (stockItems.length > 0) {
      const updatedLines = lines.map(line => {
        const itm = stockItems.find(i => i.item_id === line.itemId);
        if (itm) {
          const rate = voucherType === 'PURCHASE' ? itm.purchase_rate_paise / 100 : itm.selling_rate_paise / 100;
          return { ...line, rate };
        }
        return line;
      });
      setLines(updatedLines);
    }
  }, [voucherType, company, activeFy]);

  // Helper to select party and load Tally-style Party Details
  const selectParty = (pty: any) => {
    if (!pty) return;
    setPartyId(pty.party_id);
    setSupplierDetails({
      partyName: pty.party_name,
      mailingName: pty.party_name,
      addressLine1: pty.address_line1 || 'Main Business Address',
      addressLine2: pty.address_line2 || '',
      city: pty.city || 'Chennai',
      state: pty.state || 'Tamil Nadu',
      stateCode: pty.state_code || '33',
      pincode: pty.pincode || '',
      gstin: pty.gstin || '',
      gstType: pty.gstin ? 'Regular' : 'Unregistered',
      placeOfSupply: `${pty.state_code || '33'} - ${pty.state || 'Tamil Nadu'}`
    });
  };

  const handlePartyDropdownChange = (id: string) => {
    const pty = parties.find(p => p.party_id === id);
    selectParty(pty);
  };

  // Item Line helpers
  const handleItemChange = (index: number, itemId: string) => {
    const item = stockItems.find(i => i.item_id === itemId);
    const updated = [...lines];
    updated[index].itemId = itemId;
    if (item) {
      const rate = voucherType === 'PURCHASE' ? item.purchase_rate_paise / 100 : item.selling_rate_paise / 100;
      updated[index].rate = rate;
      updated[index].gstRate = item.gst_rate;
    }
    setLines(updated);
  };

  const handleLineFieldChange = (index: number, field: string, value: any) => {
    const updated = [...lines];
    updated[index][field] = value;
    setLines(updated);
  };

  const addLine = () => {
    const defaultItem = stockItems[0];
    setLines([
      ...lines,
      {
        itemId: defaultItem ? defaultItem.item_id : '',
        godownId: godowns[0]?.godown_id || 'godown_main',
        quantity: 1,
        rate: defaultItem ? (voucherType === 'PURCHASE' ? defaultItem.purchase_rate_paise / 100 : defaultItem.selling_rate_paise / 100) : 0,
        discountPercent: 0,
        gstRate: defaultItem ? defaultItem.gst_rate : 18
      }
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  // Open Quick Stock Item Modal
  const openQuickItemModal = (lineIdx: number) => {
    setTargetLineIndexForItem(lineIdx);
    setNewItemName('');
    setNewItemHsn('8471');
    setNewItemUnitId(units[0]?.unit_id || 'unit_nos');
    setNewItemGstRate(18);
    setNewItemSellingPrice(0);
    setNewItemPurchasePrice(0);
    setNewItemOpeningQty(0);
    setQuickItemError(null);
    setShowQuickItemModal(true);
  };

  // Global Keyboard shortcuts: Alt+C (Customer/Supplier) and Alt+I (Stock Item)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setNewPartyType(voucherType === 'PURCHASE' || voucherType === 'PAYMENT' ? 'SUPPLIER' : 'CUSTOMER');
        setShowPartyModal(true);
      } else if (e.altKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        openQuickItemModal(lines.length > 0 && lines[0].itemId ? lines.length : 0);
      } else if (e.key === 'Escape') {
        if (showPartyModal) setShowPartyModal(false);
        if (showQuickItemModal) setShowQuickItemModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [voucherType, lines, showPartyModal, showQuickItemModal, units]);

  // Compute live tax totals for Trading Vouchers
  const isTrading = ['SALES', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'SALES_RETURN', 'PURCHASE_RETURN'].includes(voucherType);
  const selectedParty = parties.find(p => p.party_id === partyId);
  const sellerStateCode = company?.state_code || '33';
  const posStateCode = supplierDetails.stateCode || selectedParty?.state_code || sellerStateCode;
  const isInterState = sellerStateCode.trim() !== posStateCode.trim();

  const isSalesTaxInclusive = voucherType === 'SALES';

  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const calculatedLines = lines.map(line => {
    const qty = Number(line.quantity) || 0;
    const rate = Number(line.rate) || 0;
    const gross = qty * rate;
    const discount = (gross * (Number(line.discountPercent) || 0)) / 100;
    const net = gross - discount;
    const gstRate = Number(line.gstRate) || 0;

    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let lineTotal = 0;

    if (isSalesTaxInclusive) {
      // Selling price is inclusive of tax: do NOT add 18% on top!
      // Back-calculate taxable base and GST from net selling price:
      taxable = gstRate > 0 ? net / (1 + gstRate / 100) : net;
      const totalTax = net - taxable;
      if (isInterState) {
        igst = totalTax;
      } else {
        cgst = totalTax / 2;
        sgst = totalTax / 2;
      }
      lineTotal = net; // Customer pays exactly the selling price!
    } else {
      // Standard exclusive calculation (e.g. Purchase):
      taxable = net;
      if (isInterState) {
        igst = (taxable * gstRate) / 100;
      } else {
        cgst = (taxable * (gstRate / 2)) / 100;
        sgst = (taxable * (gstRate / 2)) / 100;
      }
      lineTotal = taxable + cgst + sgst + igst;
    }

    totalTaxable += taxable;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;

    return { ...line, taxable, cgst, sgst, igst, lineTotal };
  });

  const subTotal = isSalesTaxInclusive
    ? calculatedLines.reduce((sum, l) => sum + l.lineTotal, 0)
    : (totalTaxable + totalCgst + totalSgst + totalIgst);
  const grandTotal = Math.round(subTotal);
  const roundOff = grandTotal - subTotal;

  // Financial voucher balancing check
  const totalFinancialDebit = ledgerLines.reduce((sum, l) => sum + (l.type === 'DR' ? Number(l.amount) || 0 : 0), 0);
  const totalFinancialCredit = ledgerLines.reduce((sum, l) => sum + (l.type === 'CR' ? Number(l.amount) || 0 : 0), 0);
  const isFinancialBalanced = Math.abs(totalFinancialDebit - totalFinancialCredit) < 0.01;

  // Handle Quick Party Creation (Tally Alt+C)
  const handleQuickCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!company) return;
      const res = await api.createParty({
        companyId: company.company_id,
        partyName: newPartyName,
        partyType: newPartyType,
        gstin: newPartyGstin,
        pan: newPartyPan,
        addressLine1: newPartyAddress1 || 'Main Business Address',
        addressLine2: newPartyAddress2,
        city: newPartyCity,
        state: newPartyState,
        stateCode: newPartyStateCode,
        pincode: newPartyPincode,
        phone: newPartyPhone,
        email: newPartyEmail,
        openingBalancePaise: Math.round(newPartyOpeningBal * 100)
      });
      const updatedParties = await api.getParties();
      setParties(updatedParties);
      const created = updatedParties.find((p: any) => p.party_id === res.partyId);
      selectParty(created);
      setShowPartyModal(false);
      setNewPartyName('');
      setNewPartyGstin('');
      setNewPartyOpeningBal(0);
    } catch (err: any) {
      alert('Error creating party: ' + err.message);
    }
  };

  // Handle Quick Stock Item Creation (Tally Alt+I / Alt+C on Item)
  const handleQuickCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!newItemName.trim()) {
      setQuickItemError('Please enter an item name.');
      return;
    }
    setIsCreatingItem(true);
    setQuickItemError(null);
    try {
      const res = await api.createStockItem({
        companyId: company.company_id,
        itemName: newItemName.trim(),
        hsnSac: newItemHsn.trim() || '8471',
        unitId: newItemUnitId || units[0]?.unit_id || 'unit_nos',
        gstRate: Number(newItemGstRate),
        purchaseRatePaise: Math.round(Number(newItemPurchasePrice) * 100),
        sellingRatePaise: Math.round(Number(newItemSellingPrice) * 100),
        openingQty: Number(newItemOpeningQty) || 0,
        openingRatePaise: Math.round(Number(newItemPurchasePrice) * 100)
      });

      const updatedItems = await api.getStockItems();
      setStockItems(updatedItems);

      const createdItem = updatedItems.find((i: any) => i.item_id === res.itemId) || {
        item_id: res.itemId,
        item_name: newItemName.trim(),
        gst_rate: Number(newItemGstRate),
        hsn_sac: newItemHsn.trim() || '8471',
        selling_rate_paise: Math.round(Number(newItemSellingPrice) * 100),
        purchase_rate_paise: Math.round(Number(newItemPurchasePrice) * 100)
      };

      const rate = voucherType === 'PURCHASE'
        ? (createdItem.purchase_rate_paise ? createdItem.purchase_rate_paise / 100 : Number(newItemPurchasePrice))
        : (createdItem.selling_rate_paise ? createdItem.selling_rate_paise / 100 : Number(newItemSellingPrice));

      const updatedLines = [...lines];
      if (targetLineIndexForItem < updatedLines.length) {
        updatedLines[targetLineIndexForItem] = {
          ...updatedLines[targetLineIndexForItem],
          itemId: createdItem.item_id,
          rate: rate || (voucherType === 'PURCHASE' ? Number(newItemPurchasePrice) : Number(newItemSellingPrice)),
          gstRate: createdItem.gst_rate
        };
      } else {
        updatedLines.push({
          itemId: createdItem.item_id,
          godownId: godowns[0]?.godown_id || 'godown_main',
          quantity: 1,
          rate: rate || (voucherType === 'PURCHASE' ? Number(newItemPurchasePrice) : Number(newItemSellingPrice)),
          discountPercent: 0,
          gstRate: createdItem.gst_rate
        });
      }

      setLines(updatedLines);
      setShowQuickItemModal(false);
    } catch (err: any) {
      setQuickItemError(err.message || 'Error creating stock item');
    } finally {
      setIsCreatingItem(false);
    }
  };

  // Submit Voucher Posting
  const handlePostVoucher = async () => {
    setErrorMessage(null);
    setIsPosting(true);
    try {
      if (!company || !activeFy) throw new Error('Company or Financial Year not loaded.');

      let payload: any = {
        companyId: company.company_id,
        fyId: activeFy.fy_id,
        voucherType,
        voucherNumber,
        voucherDate,
        referenceNumber: supplierInvoiceNo || undefined,
        narration: supplierInvoiceDate 
          ? (narration ? `${narration} (Supplier Date: ${supplierInvoiceDate})` : `Supplier Inv Date: ${supplierInvoiceDate}`)
          : narration
      };

      if (isTrading) {
        if (!partyId) throw new Error(`Please select a ${voucherType === 'PURCHASE' ? 'Supplier' : 'Customer'}.`);
        payload.partyId = partyId;
        payload.lines = lines.map(l => ({
          itemId: l.itemId,
          godownId: (voucherType === 'SALES' ? (l.godownId || godowns[0]?.godown_id || 'godown_main') : (l.godownId || 'godown_main')),
          quantity: Number(l.quantity),
          ratePaise: Math.round(Number(l.rate) * 100),
          discountPercent: Number(l.discountPercent) || 0,
          gstRate: Number(l.gstRate),
          isTaxInclusive: voucherType === 'SALES'
        }));

        if (voucherType === 'PURCHASE') {
          payload.billAllocation = {
            allocationType: 'NEW_REF'
          };
        }
      } else {
        // Financial entries
        if (!isFinancialBalanced) {
          throw new Error(`Total Debit (₹${totalFinancialDebit.toFixed(2)}) must equal Total Credit (₹${totalFinancialCredit.toFixed(2)}).`);
        }
        if (partyId) payload.partyId = partyId;
        payload.lines = [];
        payload.customLedgerLines = ledgerLines.map(l => ({
          ledgerId: l.ledgerId,
          debitPaise: l.type === 'DR' ? Math.round(Number(l.amount) * 100) : 0,
          creditPaise: l.type === 'CR' ? Math.round(Number(l.amount) * 100) : 0,
          particulars: l.particulars || undefined
        }));
      }

      const res = await api.postVoucher(payload);
      onPostSuccess(res.voucherId);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsPosting(false);
    }
  };

  // Calculate live party balance for Tally display
  const partyCurrentBalance = selectedParty ? Number(selectedParty.current_balance_paise || 0) : 0;
  const partyBalanceType = partyCurrentBalance >= 0 ? 'Dr' : 'Cr';
  const partyBalanceFormatted = '₹' + (Math.abs(partyCurrentBalance) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div style={{ padding: '24px', maxWidth: '1250px', margin: '0 auto' }}>
      {/* Header & Mode Switcher */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {voucherType === 'PURCHASE' ? 'Purchase Voucher Entry' : 'Voucher Entry Studio'}
          </h1>
          <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-blue)', fontSize: '12px' }}>
            {voucherNumber || 'FETCHING...'}
          </span>
          {voucherType === 'PURCHASE' && (
            <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-blue)' }}>
              Inward Stock & ITC Booking
            </span>
          )}
        </div>

        {/* Voucher Type Buttons */}
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
          {['SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'CONTRA', 'JOURNAL'].map(type => (
            <button
              key={type}
              onClick={() => setVoucherType(type)}
              style={{
                backgroundColor: voucherType === type ? (type === 'PURCHASE' ? '#0284c7' : 'var(--accent-blue)') : 'transparent',
                color: voucherType === type ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '4px'
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div style={{
          backgroundColor: 'rgba(244, 63, 94, 0.12)',
          border: '1px solid var(--accent-rose)',
          borderRadius: '6px',
          padding: '12px 16px',
          color: 'var(--accent-rose)',
          marginBottom: '16px',
          fontSize: '13px'
        }}>
          <strong>Posting Invariant Error:</strong> {errorMessage}
        </div>
      )}

      {/* Main Voucher Card */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '20px'
      }}>
        {/* Top Header Fields (Tally Invoice Headers) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          {/* Supplier Invoice No & Date for Purchases */}
          {voucherType === 'PURCHASE' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: '4px' }}>
                  SUPPLIER INVOICE NO. *
                </label>
                <input
                  type="text"
                  placeholder="e.g. SUP/2026/8912"
                  value={supplierInvoiceNo}
                  onChange={e => setSupplierInvoiceNo(e.target.value)}
                  style={{ width: '100%', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  SUPPLIER INVOICE DATE
                </label>
                <input
                  type="date"
                  value={supplierInvoiceDate}
                  onChange={e => setSupplierInvoiceDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              VOUCHER DATE
            </label>
            <input
              type="date"
              value={voucherDate}
              onChange={e => setVoucherDate(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {voucherType === 'PURCHASE' ? 'PARTY A/C NAME (SUPPLIER)' : 'PARTY A/C NAME (CUSTOMER)'}
              </label>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setNewPartyType(voucherType === 'PURCHASE' || voucherType === 'PAYMENT' ? 'SUPPLIER' : 'CUSTOMER');
                  setShowPartyModal(true);
                }}
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  color: 'var(--accent-blue)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 600,
                  borderRadius: '4px',
                  borderColor: 'rgba(56, 189, 248, 0.3)'
                }}
                title="Quick Create Party (Alt+C)"
              >
                <UserPlus size={12} />
                <span>{voucherType === 'PURCHASE' ? '+ New Supplier (Alt+C)' : '+ New Customer (Alt+C)'}</span>
              </button>
            </div>
            <select
              value={partyId}
              onChange={e => handlePartyDropdownChange(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">-- Select Party A/c --</option>
              {parties
                .filter(p => {
                  if (voucherType === 'SALES' || voucherType === 'RECEIPT') return p.party_type === 'CUSTOMER' || p.party_type === 'BOTH';
                  if (voucherType === 'PURCHASE' || voucherType === 'PAYMENT') return p.party_type === 'SUPPLIER' || p.party_type === 'BOTH';
                  return true;
                })
                .map(p => (
                  <option key={p.party_id} value={p.party_id}>
                    {p.party_name} ({p.state || 'Local'})
                  </option>
                ))}
            </select>
            {selectedParty && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                Current Balance: <strong style={{ color: partyBalanceType === 'Cr' ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>{partyBalanceFormatted} {partyBalanceType}</strong>
              </div>
            )}
          </div>
        </div>

        {/* TALLY-STYLE PARTY DETAILS (SUPPLIER / BUYER SUB-FORM) */}
        {isTrading && (
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '14px 16px',
            marginBottom: '20px'
          }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setShowPartyDetails(!showPartyDetails)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={16} color="var(--accent-blue)" />
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>
                  {voucherType === 'PURCHASE' ? 'Supplier Details (Tally Party Details)' : 'Buyer / Consignee Details'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  (Mailing Name, Address, GSTIN, Place of Supply)
                </span>
              </div>
              <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }}>
                {showPartyDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>{showPartyDetails ? 'Collapse' : 'Expand'}</span>
              </button>
            </div>

            {showPartyDetails && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                <div>
                  <label style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>MAILING NAME</label>
                  <input
                    type="text"
                    value={supplierDetails.mailingName}
                    onChange={e => setSupplierDetails({ ...supplierDetails, mailingName: e.target.value })}
                    style={{ width: '100%', marginTop: '3px', fontSize: '12px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>ADDRESS LINE 1</label>
                  <input
                    type="text"
                    value={supplierDetails.addressLine1}
                    onChange={e => setSupplierDetails({ ...supplierDetails, addressLine1: e.target.value })}
                    style={{ width: '100%', marginTop: '3px', fontSize: '12px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>CITY & PINCODE</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px', marginTop: '3px' }}>
                    <input
                      type="text"
                      placeholder="City"
                      value={supplierDetails.city}
                      onChange={e => setSupplierDetails({ ...supplierDetails, city: e.target.value })}
                      style={{ fontSize: '12px' }}
                    />
                    <input
                      type="text"
                      placeholder="Pincode"
                      value={supplierDetails.pincode}
                      onChange={e => setSupplierDetails({ ...supplierDetails, pincode: e.target.value })}
                      style={{ fontSize: '12px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>STATE & STATE CODE</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '6px', marginTop: '3px' }}>
                    <input
                      type="text"
                      value={supplierDetails.state}
                      onChange={e => setSupplierDetails({ ...supplierDetails, state: e.target.value })}
                      style={{ fontSize: '12px' }}
                    />
                    <input
                      type="text"
                      value={supplierDetails.stateCode}
                      onChange={e => setSupplierDetails({ ...supplierDetails, stateCode: e.target.value })}
                      style={{ fontSize: '12px', textAlign: 'center' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>GSTIN / UIN</label>
                  <input
                    type="text"
                    placeholder="e.g. 29XYZAB9876C1Z3"
                    value={supplierDetails.gstin}
                    onChange={e => setSupplierDetails({ ...supplierDetails, gstin: e.target.value.toUpperCase() })}
                    style={{ width: '100%', marginTop: '3px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>TAX REGIME</label>
                  <div style={{
                    marginTop: '3px',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    background: 'var(--bg-tertiary)',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: isInterState ? 'var(--accent-amber)' : 'var(--accent-emerald)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span>{isInterState ? 'INTER-STATE (IGST 18%)' : 'INTRA-STATE (CGST 9% + SGST 9%)'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TRADING VOUCHER: MULTI-LINE ITEM TABLE */}
        {isTrading ? (
          <div>
            {voucherType === 'SALES' && (
              <div style={{
                marginBottom: '14px',
                padding: '8px 14px',
                borderRadius: '6px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.22)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: 'var(--accent-blue)',
                fontSize: '12px',
                fontWeight: 500
              }}>
                <ShieldCheck size={16} color="var(--accent-blue)" />
                <span>
                  <strong>Tax-Inclusive Sales Mode:</strong> Selling price includes 18% GST. Taxable amount is automatically back-calculated so no additional tax is added to your customer's bill total. Godown is auto-routed to primary storage.
                </span>
              </div>
            )}

            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table className="acc-table">
                <thead>
                  <tr>
                    <th style={{ width: voucherType === 'SALES' ? '36%' : '26%' }}>Stock Item Name</th>
                    {voucherType !== 'SALES' && (
                      <th style={{ width: '15%' }}>Godown / Location</th>
                    )}
                    <th style={{ width: '10%', textAlign: 'right' }}>Quantity</th>
                    <th style={{ width: voucherType === 'SALES' ? '18%' : '14%', textAlign: 'right' }}>
                      {voucherType === 'PURCHASE' ? 'Purchase Rate (₹)' : 'Selling Rate (₹, Tax Incl.)'}
                    </th>
                    <th style={{ width: '8%', textAlign: 'right' }}>Disc %</th>
                    <th style={{ width: '9%', textAlign: 'right' }}>GST %</th>
                    <th style={{ width: '14%', textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ width: '5%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedLines.map((line, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                          <select
                            value={line.itemId}
                            onChange={e => handleItemChange(idx, e.target.value)}
                            style={{ flex: 1 }}
                          >
                            <option value="">-- Choose Item --</option>
                            {stockItems.map(item => (
                              <option key={item.item_id} value={item.item_id}>
                                {item.item_name} (HSN: {item.hsn_sac})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => openQuickItemModal(idx)}
                            style={{
                              padding: '4px 7px',
                              fontSize: '11px',
                              color: 'var(--accent-cyan)',
                              borderColor: 'rgba(6, 182, 212, 0.35)',
                              whiteSpace: 'nowrap',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                            title="Quick Create Item (Alt+I)"
                          >
                            <Plus size={11} />
                            <span>New</span>
                          </button>
                        </div>
                      </td>
                      {voucherType !== 'SALES' && (
                        <td>
                          <select
                            value={line.godownId}
                            onChange={e => handleLineFieldChange(idx, 'godownId', e.target.value)}
                            style={{ width: '100%' }}
                          >
                            {godowns.map(g => (
                              <option key={g.godown_id} value={g.godown_id}>{g.godown_name}</option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td>
                        <input
                          type="number"
                          className="num-input"
                          value={line.quantity}
                          onChange={e => handleLineFieldChange(idx, 'quantity', e.target.value)}
                          style={{ width: '100%' }}
                          min="1"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="num-input"
                          value={line.rate}
                          onChange={e => handleLineFieldChange(idx, 'rate', e.target.value)}
                          style={{ width: '100%' }}
                          step="0.01"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="num-input"
                          value={line.discountPercent}
                          onChange={e => handleLineFieldChange(idx, 'discountPercent', e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td>
                        <select
                          value={line.gstRate}
                          onChange={e => handleLineFieldChange(idx, 'gstRate', Number(e.target.value))}
                          style={{ width: '100%' }}
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>
                      <td className="amount-col">
                        ₹{line.lineTotal.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-danger"
                          onClick={() => removeLine(idx)}
                          style={{ padding: '3px 6px' }}
                          title="Delete line"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px' }}>
              <button className="btn-secondary" onClick={addLine} style={{ fontSize: '12px' }}>
                <Plus size={14} /> Add Line (Enter)
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => openQuickItemModal(lines.length)}
                style={{
                  fontSize: '12px',
                  color: 'var(--accent-cyan)',
                  borderColor: 'rgba(6, 182, 212, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Quick Create New Stock Item (Alt+I)"
              >
                <PackagePlus size={14} />
                <span>Quick Create Item (Alt+I)</span>
              </button>
            </div>

            {/* Statutory Totals Breakdown */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '16px'
            }}>
              <div style={{ width: '360px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>{voucherType === 'PURCHASE' ? 'Taxable Purchase Value:' : 'Taxable Value (Base):'}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>₹{totalTaxable.toFixed(2)}</span>
                </div>

                {!isInterState ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>{voucherType === 'PURCHASE' ? 'Input CGST (9%):' : 'Output CGST (9%):'}</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>₹{totalCgst.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>{voucherType === 'PURCHASE' ? 'Input SGST (9%):' : 'Output SGST (9%):'}</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>₹{totalSgst.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>{voucherType === 'PURCHASE' ? 'Input IGST (18%):' : 'Output IGST (18%):'}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>₹{totalIgst.toFixed(2)}</span>
                  </div>
                )}

                {voucherType === 'SALES' && (
                  <div style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    fontSize: '11px',
                    color: 'var(--accent-blue)',
                    fontWeight: 600,
                    textAlign: 'center',
                    marginTop: '2px'
                  }}>
                    ✓ 18% GST is included in Selling Price (No extra tax added)
                  </div>
                )}

                {voucherType === 'PURCHASE' && (
                  <div style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    fontSize: '11px',
                    color: 'var(--accent-emerald)',
                    fontWeight: 600,
                    textAlign: 'center',
                    marginTop: '2px'
                  }}>
                    ✓ Eligible for GSTR-2B Input Tax Credit (ITC)
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '12px' }}>
                  <span>Round Off:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>₹{roundOff.toFixed(2)}</span>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '2px solid var(--border-strong)',
                  paddingTop: '8px',
                  fontWeight: 700,
                  fontSize: '16px',
                  color: 'var(--text-primary)'
                }}>
                  <span>{voucherType === 'PURCHASE' ? 'Total Payable (Supplier):' : 'Total Invoice Amount:'}</span>
                  <span style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                    ₹{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* FINANCIAL VOUCHER: BALANCED DOUBLE ENTRY LINES */
          <div>
            <table className="acc-table" style={{ marginBottom: '16px' }}>
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Dr / Cr</th>
                  <th style={{ width: '40%' }}>Account (Ledger)</th>
                  <th style={{ width: '25%' }}>Particulars</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ width: '5%' }}></th>
                </tr>
              </thead>
              <tbody>
                {ledgerLines.map((ll, idx) => (
                  <tr key={idx}>
                    <td>
                      <select
                        value={ll.type}
                        onChange={e => {
                          const upd = [...ledgerLines];
                          upd[idx].type = e.target.value;
                          setLedgerLines(upd);
                        }}
                        style={{ width: '100%', fontWeight: 700, color: ll.type === 'DR' ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}
                      >
                        <option value="DR">DR</option>
                        <option value="CR">CR</option>
                      </select>
                    </td>
                    <td>
                      <select
                        value={ll.ledgerId}
                        onChange={e => {
                          const upd = [...ledgerLines];
                          upd[idx].ledgerId = e.target.value;
                          setLedgerLines(upd);
                        }}
                        style={{ width: '100%' }}
                      >
                        <option value="">-- Select Ledger Account --</option>
                        {ledgers.map(l => (
                          <option key={l.ledger_id} value={l.ledger_id}>
                            {l.ledger_name} ({l.group_name})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="Narration per line"
                        value={ll.particulars}
                        onChange={e => {
                          const upd = [...ledgerLines];
                          upd[idx].particulars = e.target.value;
                          setLedgerLines(upd);
                        }}
                        style={{ width: '100%' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="num-input"
                        value={ll.amount}
                        onChange={e => {
                          const upd = [...ledgerLines];
                          upd[idx].amount = e.target.value;
                          setLedgerLines(upd);
                        }}
                        style={{ width: '100%' }}
                        step="0.01"
                      />
                    </td>
                    <td>
                      {ledgerLines.length > 2 && (
                        <button
                          className="btn-danger"
                          style={{ padding: '3px 6px' }}
                          onClick={() => setLedgerLines(ledgerLines.filter((_, i) => i !== idx))}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn-secondary"
                style={{ fontSize: '12px' }}
                onClick={() => setLedgerLines([...ledgerLines, { ledgerId: '', type: 'CR', amount: 0, particulars: '' }])}
              >
                <Plus size={14} /> Add Posting Line
              </button>

              <div style={{ display: 'flex', gap: '16px', fontSize: '13px', alignItems: 'center' }}>
                <div>Total DR: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-rose)' }}>₹{totalFinancialDebit.toFixed(2)}</span></div>
                <div>Total CR: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-emerald)' }}>₹{totalFinancialCredit.toFixed(2)}</span></div>
                <div style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  fontSize: '11px',
                  background: isFinancialBalanced ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  color: isFinancialBalanced ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                }}>
                  {isFinancialBalanced ? 'BALANCED' : 'UNBALANCED'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Narration and Actions */}
        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            NARRATION / REMARKS
          </label>
          <input
            type="text"
            placeholder="e.g. Goods purchased against supplier invoice..."
            value={narration}
            onChange={e => setNarration(e.target.value)}
            style={{ width: '100%', marginBottom: '16px' }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              className="btn-primary"
              disabled={isPosting}
              onClick={handlePostVoucher}
              style={{ padding: '8px 22px', fontSize: '14px', fontWeight: 600 }}
            >
              <Check size={16} />
              <span>{isPosting ? 'Posting Transaction...' : (voucherType === 'PURCHASE' ? 'Post Purchase & Update Stock' : 'Post Voucher Atomically')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* QUICK CREATE PARTY MODAL (TALLY ALT+C) */}
      {showPartyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--modal-overlay)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-strong)',
            borderRadius: '8px',
            width: '540px',
            padding: '24px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: 'var(--card-shadow)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <UserPlus size={18} color="var(--accent-blue)" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {newPartyType === 'SUPPLIER' ? 'Quick Create Supplier Master (Sundry Creditor)' : 'Quick Create Customer Master (Sundry Debtor)'}
              </h3>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Creates the ledger account, contact profile, and statutory GST address.
            </p>

            <form onSubmit={handleQuickCreateParty} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>PARTY TYPE</label>
                  <select
                    value={newPartyType}
                    onChange={e => setNewPartyType(e.target.value as any)}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    <option value="CUSTOMER">Customer (Sundry Debtor)</option>
                    <option value="SUPPLIER">Supplier (Sundry Creditor)</option>
                    <option value="BOTH">Both (Customer & Supplier)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>GSTIN / UIN</label>
                  <input
                    type="text"
                    placeholder="29XYZAB9876C1Z3"
                    value={newPartyGstin}
                    onChange={e => {
                      const val = e.target.value.toUpperCase();
                      setNewPartyGstin(val);
                      if (val.length >= 2) {
                        setNewPartyStateCode(val.substring(0, 2));
                      }
                      if (val.length >= 12) {
                        setNewPartyPan(val.substring(2, 12));
                      }
                    }}
                    style={{ width: '100%', marginTop: '4px', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>LEGAL BUSINESS NAME *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Industries Private Limited"
                  value={newPartyName}
                  onChange={e => setNewPartyName(e.target.value)}
                  style={{ width: '100%', marginTop: '4px' }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>ADDRESS LINE 1</label>
                  <input
                    type="text"
                    placeholder="Plot No. 45, Industrial Zone"
                    value={newPartyAddress1}
                    onChange={e => setNewPartyAddress1(e.target.value)}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>ADDRESS LINE 2</label>
                  <input
                    type="text"
                    placeholder="Phase 2, Outer Ring Road"
                    value={newPartyAddress2}
                    onChange={e => setNewPartyAddress2(e.target.value)}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>CITY</label>
                  <input
                    type="text"
                    value={newPartyCity}
                    onChange={e => setNewPartyCity(e.target.value)}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>PINCODE</label>
                  <input
                    type="text"
                    value={newPartyPincode}
                    onChange={e => setNewPartyPincode(e.target.value)}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>STATE</label>
                  <input
                    type="text"
                    value={newPartyState}
                    onChange={e => setNewPartyState(e.target.value)}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>STATE CODE</label>
                  <input
                    type="text"
                    value={newPartyStateCode}
                    onChange={e => setNewPartyStateCode(e.target.value)}
                    style={{ width: '100%', marginTop: '4px', textAlign: 'center' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>PHONE / MOBILE</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={newPartyPhone}
                    onChange={e => setNewPartyPhone(e.target.value)}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>OPENING BALANCE (₹)</label>
                  <input
                    type="number"
                    className="num-input"
                    value={newPartyOpeningBal}
                    onChange={e => setNewPartyOpeningBal(Number(e.target.value))}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowPartyModal(false)}>
                  Cancel (Esc)
                </button>
                <button type="submit" className="btn-primary">
                  <Check size={14} />
                  <span>Save & Select Party</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK CREATE STOCK ITEM MODAL (TALLY ALT+I) */}
      {showQuickItemModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--modal-overlay)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-strong)',
            borderRadius: '8px',
            width: '520px',
            padding: '24px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: 'var(--card-shadow)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Boxes size={18} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Quick Create Stock Item Master
              </h3>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Creates inventory master and inserts it directly into line {targetLineIndexForItem + 1} of this voucher.
            </p>

            {quickItemError && (
              <div style={{
                marginBottom: '14px',
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: 'var(--accent-rose)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={14} />
                <span>{quickItemError}</span>
              </div>
            )}

            <form onSubmit={handleQuickCreateItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>ITEM NAME / DESCRIPTION *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ergonomic Wireless Mouse"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  style={{ width: '100%', marginTop: '4px' }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>HSN / SAC CODE *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 8471"
                    value={newItemHsn}
                    onChange={e => setNewItemHsn(e.target.value)}
                    style={{ width: '100%', marginTop: '4px', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>UNIT OF MEASURE *</label>
                  <select
                    value={newItemUnitId}
                    onChange={e => setNewItemUnitId(e.target.value)}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    {units.map((u: any) => (
                      <option key={u.unit_id} value={u.unit_id}>{u.unit_name} ({u.symbol})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>GST TAX SLAB</label>
                  <select
                    value={newItemGstRate}
                    onChange={e => setNewItemGstRate(Number(e.target.value))}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    <option value="0">0% (Nil / Exempted)</option>
                    <option value="5">5% (Essential Goods)</option>
                    <option value="12">12% (Standard Concessional)</option>
                    <option value="18">18% (Standard Rate)</option>
                    <option value="28">28% (Luxury / De-merit)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    SELLING PRICE (₹, TAX INCL.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="num-input"
                    placeholder="0.00"
                    value={newItemSellingPrice}
                    onChange={e => setNewItemSellingPrice(Number(e.target.value))}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    PURCHASE COST RATE (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="num-input"
                    placeholder="0.00"
                    value={newItemPurchasePrice}
                    onChange={e => setNewItemPurchasePrice(Number(e.target.value))}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    INITIAL OPENING STOCK (QTY)
                  </label>
                  <input
                    type="number"
                    className="num-input"
                    placeholder="0"
                    value={newItemOpeningQty}
                    onChange={e => setNewItemOpeningQty(Number(e.target.value))}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              </div>

              {voucherType === 'SALES' && (
                <div style={{
                  padding: '6px 10px',
                  borderRadius: '5px',
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  fontSize: '11px',
                  color: 'var(--accent-blue)'
                }}>
                  💡 In Sales mode, the Selling Price is treated as <strong>Tax-Inclusive</strong> (18% GST extracted, not added).
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowQuickItemModal(false)}
                >
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isCreatingItem}
                >
                  <Check size={14} />
                  <span>{isCreatingItem ? 'Creating...' : 'Save & Insert Into Line'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
