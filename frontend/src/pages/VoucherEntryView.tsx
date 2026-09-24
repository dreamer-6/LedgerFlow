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
  ChevronRight,
  Printer,
  Eye,
  Maximize2,
  Minimize2,
  Pencil,
  Search,
  X,
  Copy,
  RotateCcw,
  RefreshCw,
  Percent
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────
   Searchable Combobox for Customer / Supplier (Type & Select)
   ────────────────────────────────────────────────────────── */
interface PartySearchSelectProps {
  partyId: string;
  parties: any[];
  placeholder?: string;
  onSelect: (party: any) => void;
  onAddNew?: (typedName: string) => void;
}

const PartySearchSelect: React.FC<PartySearchSelectProps> = ({
  partyId,
  parties,
  placeholder = 'Type or search party…',
  onSelect,
  onAddNew
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedParty = parties.find((p) => p.party_id === partyId);

  const filtered = parties.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (p.party_name && p.party_name.toLowerCase().includes(q)) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      (p.gstin && p.gstin.toLowerCase().includes(q)) ||
      (p.city && p.city.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightIndex]) {
        onSelect(filtered[highlightIndex]);
        setIsOpen(false);
        setQuery('');
      } else if (onAddNew && query.trim()) {
        onAddNew(query.trim());
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="vev2-combobox-wrap" ref={containerRef}>
      <div className="vev2-combobox-input-wrap">
        <span className="vev2-combobox-icon-left">
          <Search size={14} />
        </span>
        <input
          type="text"
          className="vev2-combobox-input"
          style={{ paddingLeft: '36px', paddingRight: '32px', height: '38px' }}
          placeholder={placeholder}
          value={isOpen ? query : (selectedParty?.party_name || '')}
          onFocus={() => {
            setIsOpen(true);
            setQuery('');
            setHighlightIndex(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        {selectedParty && !isOpen ? (
          <button
            type="button"
            className="vev2-combobox-clear-btn"
            title="Change party"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
              setQuery('');
            }}
          >
            <ChevronDown size={14} />
          </button>
        ) : query ? (
          <button
            type="button"
            className="vev2-combobox-clear-btn"
            title="Clear search"
            onClick={(e) => {
              e.stopPropagation();
              setQuery('');
            }}
          >
            <X size={13} />
          </button>
        ) : null}
      </div>

      {isOpen && (
        <div className="vev2-combobox-dropdown">
          {filtered.length > 0 ? (
            filtered.slice(0, 30).map((p, idx) => {
              const isSelected = p.party_id === partyId;
              const isHighlighted = idx === highlightIndex;
              return (
                <div
                  key={p.party_id}
                  className={`vev2-combobox-option ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                  onClick={() => {
                    onSelect(p);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  onMouseEnter={() => setHighlightIndex(idx)}
                >
                  <div className="vev2-combobox-option-title">
                    <span>{p.party_name}</span>
                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: p.party_type === 'SUPPLIER' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', color: p.party_type === 'SUPPLIER' ? '#d97706' : '#059669', fontWeight: 700 }}>
                      {p.party_type}
                    </span>
                  </div>
                  <div className="vev2-combobox-option-meta">
                    {p.phone && <span>📞 {p.phone}</span>}
                    {p.gstin && <span>GSTIN: <strong style={{ fontFamily: 'var(--font-mono)' }}>{p.gstin}</strong></span>}
                    {p.city && <span>📍 {p.city}</span>}
                    {p.current_balance !== undefined && (
                      <span style={{ marginLeft: 'auto', fontWeight: 600, color: (p.current_balance || 0) > 0 ? 'var(--danger-red)' : 'var(--success-emerald)' }}>
                        Bal: ₹{Math.abs(p.current_balance || 0).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="vev2-combobox-empty">
              No parties found matching "{query}".
            </div>
          )}

          {onAddNew && query.trim() && (
            <button
              type="button"
              className="vev2-combobox-add-btn"
              onClick={() => {
                onAddNew(query.trim());
                setIsOpen(false);
              }}
            >
              <Plus size={14} />
              Add "{query.trim()}" as New Party
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────
   Searchable Combobox for Stock Items in Line Items
   ────────────────────────────────────────────────────────── */
interface ItemSearchSelectProps {
  itemId: string;
  stockItems: any[];
  voucherType: string;
  placeholder?: string;
  onSelect: (item: any) => void;
  onAddNew?: (typedName: string) => void;
}

const ItemSearchSelect: React.FC<ItemSearchSelectProps> = ({
  itemId,
  stockItems,
  voucherType,
  placeholder = 'Type to search item…',
  onSelect,
  onAddNew
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedItem = stockItems.find((s) => s.item_id === itemId);

  const filtered = stockItems.filter((s) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (s.item_name && s.item_name.toLowerCase().includes(q)) ||
      (s.hsn_sac && s.hsn_sac.toLowerCase().includes(q)) ||
      (s.sku && s.sku.toLowerCase().includes(q)) ||
      (s.item_code && s.item_code.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightIndex]) {
        onSelect(filtered[highlightIndex]);
        setIsOpen(false);
        setQuery('');
      } else if (onAddNew && query.trim()) {
        onAddNew(query.trim());
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="vev2-combobox-wrap" ref={containerRef}>
      <div className="vev2-combobox-input-wrap">
        <span className="vev2-combobox-icon-left">
          <Search size={13} />
        </span>
        <input
          type="text"
          className="vev2-combobox-input"
          style={{ height: '36px', fontSize: '13.5px', fontWeight: selectedItem ? 600 : 400, paddingLeft: '36px', paddingRight: '32px' }}
          placeholder={placeholder}
          value={isOpen ? query : (selectedItem?.item_name || '')}
          onFocus={() => {
            setIsOpen(true);
            setQuery('');
            setHighlightIndex(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        {selectedItem && !isOpen ? (
          <button
            type="button"
            className="vev2-combobox-clear-btn"
            title="Change item"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
              setQuery('');
            }}
          >
            <ChevronDown size={13} />
          </button>
        ) : query ? (
          <button
            type="button"
            className="vev2-combobox-clear-btn"
            title="Clear search"
            onClick={(e) => {
              e.stopPropagation();
              setQuery('');
            }}
          >
            <X size={12} />
          </button>
        ) : null}
      </div>

      {isOpen && (
        <div className="vev2-combobox-dropdown" style={{ minWidth: '320px' }}>
          {filtered.length > 0 ? (
            filtered.slice(0, 30).map((s, idx) => {
              const isSelected = s.item_id === itemId;
              const isHighlighted = idx === highlightIndex;
              const isSerialized = Boolean(s.has_serial_no || s.serial_numbers);
              const price = voucherType === 'PURCHASE' ? (s.purchase_rate_paise || 0) / 100 : (s.selling_rate_paise || 0) / 100;
              return (
                <div
                  key={s.item_id}
                  className={`vev2-combobox-option ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                  onClick={() => {
                    onSelect(s);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  onMouseEnter={() => setHighlightIndex(idx)}
                >
                  <div className="vev2-combobox-option-title">
                    <span>{s.item_name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {isSerialized && (
                        <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(59,130,246,0.15)', color: '#2563eb', fontWeight: 700 }}>
                          🏷️ S/N
                        </span>
                      )}
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ₹{price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="vev2-combobox-option-meta">
                    {s.hsn_sac && <span>HSN: <strong style={{ fontFamily: 'var(--font-mono)' }}>{s.hsn_sac}</strong></span>}
                    {s.unit_symbol && <span>Unit: {s.unit_symbol}</span>}
                    {s.gst_rate !== undefined && <span>GST: {s.gst_rate}%</span>}
                    {s.closing_qty !== undefined && (
                      <span style={{ marginLeft: 'auto', fontWeight: 600, color: s.closing_qty > 0 ? 'var(--success-emerald)' : 'var(--text-muted)' }}>
                        Stock: {s.closing_qty}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="vev2-combobox-empty">
              No stock items found matching "{query}".
            </div>
          )}

          {onAddNew && query.trim() && (
            <button
              type="button"
              className="vev2-combobox-add-btn"
              onClick={() => {
                onAddNew(query.trim());
                setIsOpen(false);
              }}
            >
              <Plus size={14} />
              Create "{query.trim()}" as New Item
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface VoucherEntryViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  initialType?: string;
  currentDate?: string;
  editVoucherId?: string | null;
  onPostSuccess: (voucherId: string) => void;
  onNavigate?: (tab: string, subTab?: string) => void;
}

export const VoucherEntryView: React.FC<VoucherEntryViewProps> = ({
  company,
  activeFy,
  initialType = 'SALES',
  currentDate,
  editVoucherId,
  onPostSuccess,
  onNavigate
}) => {
  const getInitialVoucherNumber = () => {
    let pfx = 'DTS';
    if (company?.company_name) {
      const words = company.company_name.trim().split(/[\s_-]+/).filter((w: string) => w.length > 0);
      pfx = words.length > 1 ? words.map((w: string) => w[0].toUpperCase()).join('') : words[0]?.substring(0, 3).toUpperCase() || 'DTS';
    }
    let fyCode = '2627';
    if (activeFy?.start_date && activeFy?.end_date) {
      const sY = activeFy.start_date.substring(2, 4);
      const eY = activeFy.end_date.substring(2, 4);
      fyCode = `${sY}${eY}`;
    } else if (activeFy?.name) {
      const digits = activeFy.name.replace(/\D/g, '');
      if (digits.length >= 4) fyCode = digits.slice(-4);
    }
    return `${pfx}-${fyCode}-000`;
  };

  const [voucherType, setVoucherType] = useState<string>(initialType);
  const [voucherNumber, setVoucherNumber] = useState<string>(getInitialVoucherNumber);
  const [isEditingVoucherNumber, setIsEditingVoucherNumber] = useState(false);
  const [tempVoucherNumber, setTempVoucherNumber] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showMoreMenu]);

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
  const [newItemHasSerialNo, setNewItemHasSerialNo] = useState<boolean>(false);
  const [newItemSerialNumbers, setNewItemSerialNumbers] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const isPosting = isSaving; // alias for backwards compatibility
  const setIsPosting = setIsSaving;
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastSavedVoucherId, setLastSavedVoucherId] = useState<string | null>(null);
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

  // Auto-fetch available serial numbers for any line item that has serial tracking
  useEffect(() => {
    if (stockItems.length > 0 && lines.length > 0) {
      lines.forEach((l, idx) => {
        if (l.itemId && (!l.availableSerials || l.availableSerials.length === 0)) {
          const item = stockItems.find((s) => s.item_id === l.itemId);
          if (item && (item.has_serial_no || item.serial_numbers)) {
            api.getAvailableSerials(item.item_id).then((serials: string[]) => {
              let finalSerials = Array.isArray(serials) ? serials : [];
              if (finalSerials.length === 0 && item.serial_numbers) {
                finalSerials = item.serial_numbers.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
              }
              setLines((prev) => {
                if (!prev[idx] || (prev[idx].availableSerials && prev[idx].availableSerials.length > 0)) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx], availableSerials: finalSerials };
                return next;
              });
            }).catch(console.error);
          }
        }
      });
    }
  }, [stockItems, lines.map(l => l.itemId).join(',')]);

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
      // Ctrl + S, Ctrl + A, or F10: Save Voucher
      if (((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 's')) || e.key === 'F10') {
        e.preventDefault();
        handleSaveVoucher(false);
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
        cur.serialNumber = '';
        
        // Fetch serials asynchronously
        if (item.has_serial_no || item.serial_numbers) {
          api.getAvailableSerials(item.item_id).then((serials: string[]) => {
            let finalSerials = Array.isArray(serials) ? serials : [];
            if (finalSerials.length === 0 && item.serial_numbers) {
              finalSerials = item.serial_numbers.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
            }
            setLines(prev => {
              const newLines = [...prev];
              if (newLines[idx]) {
                newLines[idx].availableSerials = finalSerials;
              }
              return newLines;
            });
          }).catch((err) => {
            console.error('Error fetching available serials:', err);
            if (item.serial_numbers) {
              const fallback = item.serial_numbers.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
              setLines(prev => {
                const newLines = [...prev];
                if (newLines[idx]) {
                  newLines[idx].availableSerials = fallback;
                }
                return newLines;
              });
            }
          });
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
        itemId: '',
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
          lineIgst = taxable * (gst / 100);
        } else {
          lineCgst = taxable * (gst / 200);
          lineSgst = taxable * (gst / 200);
        }
      } else {
        const rateIncl = Number(l.rateInclTax || l.rate) || 0;
        const grossIncl = qty * rateIncl;
        const disc = grossIncl * (discPercent / 100);
        const netIncl = grossIncl - disc;

        taxable = netIncl / (1 + gst / 100);
        const taxAmount = netIncl - taxable;

        if (isInterState) {
          lineIgst = taxAmount;
        } else {
          lineCgst = taxAmount / 2;
          lineSgst = taxAmount / 2;
        }
      }

      taxableTotal += taxable;
      totalCgst += lineCgst;
      totalSgst += lineSgst;
      totalIgst += lineIgst;
    });

    const rawGrandTotal = taxableTotal + totalCgst + totalSgst + totalIgst;
    const roundedGrandTotal = Math.round(rawGrandTotal);
    const roundOff = Math.round((roundedGrandTotal - rawGrandTotal) * 100) / 100;

    return {
      taxableValue: Math.round(taxableTotal * 100) / 100,
      taxableTotal: Math.round(taxableTotal * 100) / 100,
      cgst: Math.round(totalCgst * 100) / 100,
      sgst: Math.round(totalSgst * 100) / 100,
      igst: Math.round(totalIgst * 100) / 100,
      totalTax: Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100,
      roundOff,
      grandTotal: roundedGrandTotal
    };
  };

  // Financial voucher calculations
  const calculateFinancialTotals = () => {
    let totalDebit = 0;
    let totalCredit = 0;

    ledgerLines.forEach((l) => {
      const amt = Number(l.amount) || 0;
      if (l.type === 'DR') totalDebit += amt;
      if (l.type === 'CR') totalCredit += amt;
    });

    return {
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    };
  };

  // Helper: Prepare live voucher data for InvoicePrintModal
  const prepareLiveVoucherData = () => {
    const calc = isTrading ? calculateTotals() : { grandTotal: 0, taxableValue: 0, taxableTotal: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, roundOff: 0 };
    return {
      voucher: {
        voucher_id: editVoucherId || 'live_preview',
        voucher_type: voucherType,
        voucher_number: voucherNumber,
        voucher_date: voucherDate,
        reference_number: supplierInvoiceNo || voucherNumber,
        reference_date: supplierInvoiceDate || voucherDate,
        payment_mode: paymentMode,
        payment_terms: paymentTerms,
        order_ref: orderRef,
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

  // Submit / Save Voucher
  const handleSaveVoucher = async (andPrint: boolean = false) => {
    if (isSaving) return;
    if (!company) {
      setErrorMessage('Active company required.');
      return;
    }

    // Validation 1: Party required for trading vouchers
    if (isTrading && !partyId) {
      setErrorMessage(`Please select a ${voucherType === 'PURCHASE' ? 'supplier' : 'customer'} party.`);
      return;
    }

    // Validation 2: At least one item required for trading vouchers
    const filled = lines.filter((l) => l.itemId);
    if (isTrading && filled.length === 0) {
      setErrorMessage('Please add at least one stock item to the voucher.');
      return;
    }

    // Validation 3: Positive quantity
    for (const l of filled) {
      if ((Number(l.quantity) || 0) <= 0) {
        setErrorMessage('Item quantity must be greater than zero.');
        return;
      }
    }

    setIsSaving(true);
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
        narration
      };

      if (isTrading) {
        payload.partyId = partyId;
        payload.lines = lines.map((l) => ({
          itemId: l.itemId || undefined,
          description: l.description || null,
          godownId: l.godownId || godowns[0]?.godown_id || undefined,
          quantity: Number(l.quantity) || 1,
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
      setLastSavedVoucherId(res.voucherId);

      if (!editVoucherId) {
        await fetchNextVoucherNumber();
      }

      if (andPrint) {
        onPostSuccess(res.voucherId);
      } else {
        setSuccessMessage(`Voucher ${res.voucherNumber || voucherNumber} ${editVoucherId ? 'updated' : 'saved'} successfully!`);
        if (!editVoucherId) {
          // Reset lines for next entry
          setLines([
            {
              itemId: '',
              description: '',
              godownId: godowns[0]?.godown_id || '',
              quantity: 1,
              unit: 'Nos',
              hsnSac: '85044029',
              rate: 0,
              rateInclTax: 0,
              discountPercent: 0,
              gstRate: 18,
              serialNumber: '',
              availableSerials: []
            }
          ]);
          setNarration('');
          setOrderRef('');
          setSupplierInvoiceNo('');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save voucher.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePostVoucher = handleSaveVoucher; // keep backward compatibility

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
      const serialsList = newItemHasSerialNo
        ? newItemSerialNumbers.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean)
        : [];

      const res = await api.createStockItem({
        companyId: company.company_id,
        itemName: newItemName.trim(),
        hsnSac: newItemHsn.trim(),
        unitId: newItemUnitId || units[0]?.unit_id || 'unit_nos',
        gstRate: newItemGstRate,
        purchaseRatePaise: Math.round(newItemPurchaseCost * 100),
        sellingRatePaise: Math.round(newItemSellingPrice * 100),
        openingQty: serialsList.length,
        openingValuationPaise: Math.round(newItemPurchaseCost * 100) * serialsList.length,
        reorderLevel: 5,
        hasSerialNo: newItemHasSerialNo,
        serialNumbers: newItemHasSerialNo ? newItemSerialNumbers.trim() : undefined
      } as any);

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
          rateInclTax: Math.round(activeRate * (1 + newItemGstRate / 100) * 100) / 100,
          availableSerials: serialsList,
          serialNumber: serialsList.length > 0 && voucherType === 'SALES' ? serialsList[0] : ''
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

  // Helper: get voucher type meta
  const voucherMeta: Record<string, { label: string; subtitle: string; icon: string; iconClass: string }> = {
    SALES:    { label: 'Sales Invoice',    subtitle: 'Create and record your sales transaction',      icon: '🧾', iconClass: 'sales' },
    PURCHASE: { label: 'Purchase Invoice', subtitle: 'Record supplier bills and stock purchases',      icon: '📦', iconClass: 'purchase' },
    RECEIPT:  { label: 'Receipt',          subtitle: 'Record payments received from customers',        icon: '💰', iconClass: 'receipt' },
    PAYMENT:  { label: 'Payment',          subtitle: 'Record payments made to suppliers/vendors',      icon: '💸', iconClass: 'payment' },
    CONTRA:   { label: 'Contra',           subtitle: 'Transfer between cash and bank accounts',        icon: '↔️', iconClass: 'contra' },
    JOURNAL:  { label: 'Journal',          subtitle: 'Manual double-entry accounting adjustment',      icon: '📓', iconClass: 'journal' },
  };
  const meta = voucherMeta[voucherType] || voucherMeta.SALES;

  // State for sidebar accordions
  const [paymentOpen, setPaymentOpen] = React.useState(true);
  const [termsOpen, setTermsOpen] = React.useState(true);
  const [itemSearch, setItemSearch] = React.useState('');

  // Filtered lines for search (search applies to display only)
  const filteredLineIndices = lines.map((l: any, i: number) => {
    if (!itemSearch.trim()) return i;
    const item = stockItems.find((s: any) => s.item_id === l.itemId);
    const name = item?.item_name || l.description || '';
    return name.toLowerCase().includes(itemSearch.toLowerCase()) ? i : -1;
  }).filter((i: number) => i >= 0);

  const totalQty = lines.reduce((sum: number, l: any) => sum + (Number(l.quantity) || 0), 0);
  const filledLines = lines.filter((l: any) => l.itemId || l.description);
  const totals = calculateTotals();

  return (
    <div className="vev2-page">

      {/* ── Breadcrumb (Interactive & Working) ── */}
      <div className="vev2-breadcrumb">
        <button
          type="button"
          className="vev2-bc-btn"
          onClick={() => onNavigate ? onNavigate('dashboard') : null}
          title="Go to Dashboard"
        >
          <span>Dashboard</span>
        </button>
        <ChevronRight size={13} className="vev2-bc-sep" />
        <button
          type="button"
          className="vev2-bc-btn"
          onClick={() => onNavigate ? onNavigate('reports', 'daybook') : null}
          title="View Daybook / All Vouchers"
        >
          <span>Daybook (All Vouchers)</span>
        </button>
        <ChevronRight size={13} className="vev2-bc-sep" />
        <span className="vev2-bc-current">{meta.label}</span>
      </div>

      {/* ── Title Row ── */}
      <div className="vev2-title-row">
        {/* Left: Icon + Title */}
        <div className="vev2-title-left">
          <div className={`vev2-type-icon ${meta.iconClass}`} style={{ fontSize: '22px' }}>
            {meta.icon}
          </div>
          <div className="vev2-title-text">
            <div className="vev2-page-title">{meta.label}</div>
            <div className="vev2-page-subtitle">{meta.subtitle}</div>
          </div>
        </div>

        {/* Center: Voucher type switcher dock */}
        <div className="vev2-type-dock" role="tablist">
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
              className={`vev2-type-dock-btn ${voucherType === item.type ? 'active' : ''}`}
              onClick={() => switchVoucherType(item.type)}
              title={`${item.label} (${item.fkey})`}
            >
              <span className="vev2-fkey">{item.fkey}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Right: Number pill + status + actions */}
        <div className="vev2-title-pills">
          {isEditingVoucherNumber ? (
            <div className="vev2-number-edit-box">
              <input
                type="text"
                autoFocus
                value={tempVoucherNumber}
                onChange={(e) => setTempVoucherNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (tempVoucherNumber.trim()) setVoucherNumber(tempVoucherNumber.trim());
                    setIsEditingVoucherNumber(false);
                  } else if (e.key === 'Escape') {
                    setIsEditingVoucherNumber(false);
                  }
                }}
                className="vev2-number-edit-input"
                placeholder="e.g. DTS-2627-000"
              />
              <button
                type="button"
                className="vev2-number-save-btn"
                onClick={() => {
                  if (tempVoucherNumber.trim()) setVoucherNumber(tempVoucherNumber.trim());
                  setIsEditingVoucherNumber(false);
                }}
                title="Save Invoice Number"
              >
                <Check size={13} />
              </button>
              <button
                type="button"
                className="vev2-number-cancel-btn"
                onClick={() => setIsEditingVoucherNumber(false)}
                title="Cancel"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <div
              className="vev2-number-pill"
              onClick={() => {
                setTempVoucherNumber(voucherNumber);
                setIsEditingVoucherNumber(true);
              }}
              title="Click to edit Invoice / Voucher Number"
            >
              <span>{voucherNumber}</span>
              <Pencil size={11} className="vev2-pill-edit-icon" />
            </div>
          )}

          <span className={`vev2-status-badge ${voucherStatus === 'Posted' ? 'posted' : ''}`}>
            {voucherStatus === 'Posted' ? 'Saved' : 'Draft'}
            <ChevronDown size={12} />
          </span>

          <button
            type="button"
            className="vev2-post-btn"
            onClick={() => handleSaveVoucher(false)}
            disabled={isSaving}
            title="Save Voucher (Ctrl+A or F10)"
          >
            <Check size={15} />
            {isSaving ? 'Saving…' : 'Save'}
          </button>

          <div ref={moreMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className={`vev2-more-btn ${showMoreMenu ? 'active' : ''}`}
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              title="Voucher Options & Actions"
              aria-label="More actions"
            >
              <MoreVertical size={16} />
            </button>

            {showMoreMenu && (
              <div className="vev2-dropdown-menu">
                <div className="vev2-dropdown-header">Voucher Actions</div>
                <button
                  type="button"
                  className="vev2-dropdown-item"
                  onClick={() => {
                    setTempVoucherNumber(voucherNumber);
                    setIsEditingVoucherNumber(true);
                    setShowMoreMenu(false);
                  }}
                >
                  <Pencil size={13} />
                  <span>Edit Invoice Number</span>
                </button>
                <button
                  type="button"
                  className="vev2-dropdown-item"
                  onClick={() => {
                    setShowLivePreview(true);
                    setShowMoreMenu(false);
                  }}
                >
                  <Printer size={13} />
                  <span>Print / PDF Preview</span>
                  <kbd>Alt+P</kbd>
                </button>
                <button
                  type="button"
                  className="vev2-dropdown-item"
                  onClick={() => {
                    navigator.clipboard?.writeText(voucherNumber);
                    setSuccessMessage(`Invoice Number "${voucherNumber}" copied to clipboard.`);
                    setShowMoreMenu(false);
                  }}
                >
                  <Copy size={13} />
                  <span>Copy Invoice Number</span>
                </button>
                <button
                  type="button"
                  className="vev2-dropdown-item"
                  onClick={() => {
                    setTaxMode(taxMode === 'EXCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE');
                    setShowMoreMenu(false);
                  }}
                >
                  <Percent size={13} />
                  <span>Switch Tax to {taxMode === 'EXCLUSIVE' ? 'Inclusive' : 'Exclusive'}</span>
                </button>
                <button
                  type="button"
                  className="vev2-dropdown-item"
                  onClick={() => {
                    fetchNextVoucherNumber();
                    setShowMoreMenu(false);
                  }}
                >
                  <RefreshCw size={13} />
                  <span>Reset to Auto Invoice No</span>
                </button>
                <div className="vev2-dropdown-divider" />
                <button
                  type="button"
                  className="vev2-dropdown-item text-danger"
                  onClick={() => {
                    if (confirm('Reset voucher entry lines and fields?')) {
                      setLines([
                        {
                          itemId: '',
                          description: '',
                          godownId: godowns[0]?.godown_id || '',
                          quantity: 1,
                          unit: 'Nos',
                          hsnSac: '85044029',
                          rate: 0,
                          rateInclTax: 0,
                          discountPercent: 0,
                          gstRate: 18,
                          serialNumber: '',
                          availableSerials: []
                        }
                      ]);
                      setNarration('');
                      setOrderRef('');
                      setSupplierInvoiceNo('');
                    }
                    setShowMoreMenu(false);
                  }}
                >
                  <RotateCcw size={13} />
                  <span>Reset Form</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Success Toast Banner ── */}
      {successMessage && (
        <div className="vev2-success-toast">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✓</span>
            <span>{successMessage}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {lastSavedVoucherId && (
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => onPostSuccess(lastSavedVoucherId)}
              >
                <Printer size={13} />
                Print Voucher
              </button>
            )}
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '4px' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Error Banner ── */}
      {errorMessage && (
        <div className="vev2-error">
          <AlertCircle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Main 2-Col Layout ── */}
      <div className="vev2-layout">

        {/* ════ LEFT: Form ════ */}
        <div className="vev2-form">

          {isTrading ? (
            <>
              {/* ── Meta Card ── */}
              <div className="vev2-meta-card">

                {/* Row 1: Invoice Date | Customer | Place of Supply */}
                <div className={voucherType === 'PURCHASE' ? 'vev2-meta-row-purchase' : 'vev2-meta-row'}>
                  {/* Supplier Invoice No (Purchase only) */}
                  {voucherType === 'PURCHASE' && (
                    <div className="vev2-field">
                      <label>Supplier Invoice No. *</label>
                      <input
                        type="text"
                        value={supplierInvoiceNo}
                        onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                        placeholder="e.g. CL/26-27/1126"
                        style={{ width: '100%', fontWeight: 600, borderColor: supplierInvoiceNo ? 'var(--primary-accent)' : undefined }}
                      />
                    </div>
                  )}

                  {/* Invoice Date */}
                  <div className="vev2-field">
                    <label>Invoice Date *</label>
                    <input
                      type="date"
                      id="voucher-date-input"
                      value={voucherDate}
                      onChange={(e) => setVoucherDate(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Customer / Supplier */}
                  <div className="vev2-field">
                    <label>{voucherType === 'PURCHASE' ? 'Supplier *' : 'Customer *'}</label>
                    <div className="vev2-customer-row">
                      <PartySearchSelect
                        partyId={partyId}
                        parties={parties.filter((p: any) =>
                          (voucherType as string) === 'PURCHASE' || (voucherType as string) === 'PAYMENT'
                            ? p.party_type === 'SUPPLIER' || p.party_type === 'BOTH'
                            : p.party_type === 'CUSTOMER' || p.party_type === 'BOTH'
                        )}
                        placeholder={voucherType === 'PURCHASE' ? 'Type to search supplier…' : 'Type to search customer…'}
                        onSelect={(p) => handleSelectParty(p.party_id, p)}
                        onAddNew={(typedName) => {
                          setNewPartyName(typedName);
                          setNewPartyType(voucherType === 'PURCHASE' ? 'SUPPLIER' : 'CUSTOMER');
                          setShowPartyModal(true);
                        }}
                      />
                      <button
                        type="button"
                        className="vev2-add-btn"
                        title="Create new party"
                        onClick={() => {
                          setNewPartyType(voucherType === 'PURCHASE' ? 'SUPPLIER' : 'CUSTOMER');
                          setShowPartyModal(true);
                        }}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Place of Supply */}
                  <div className="vev2-field">
                    <label>Place of Supply *</label>
                    <input
                      type="text"
                      value={placeOfSupply}
                      onChange={(e) => setPlaceOfSupply(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {/* Row 2: Invoice No | Reference No | Payment Terms | Supplier Bill Date */}
                <div className="vev2-meta-row-2">
                  <div className="vev2-field">
                    <label>Invoice No.</label>
                    <input
                      type="text"
                      value={voucherNumber}
                      onChange={(e) => setVoucherNumber(e.target.value)}
                      style={{ width: '100%', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                    />
                  </div>
                  <div className="vev2-field">
                    <label>Reference No.</label>
                    <input
                      type="text"
                      value={orderRef}
                      onChange={(e) => setOrderRef(e.target.value)}
                      placeholder="PO / Reference No."
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="vev2-field">
                    <label>Payment Terms</label>
                    <input
                      type="text"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      placeholder="e.g. 30 Days / Immediate"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="vev2-field">
                    <label>{voucherType === 'PURCHASE' ? 'Supplier Bill Date' : 'Due Date'}</label>
                    <input
                      type="date"
                      value={supplierInvoiceDate}
                      onChange={(e) => setSupplierInvoiceDate(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {/* Row 3: Sales Ledger + Tax Mode */}
                <div className="vev2-meta-row-3" style={{ marginBottom: 0 }}>
                  <div className="vev2-field">
                    <label>Payment Mode</label>
                    <input
                      type="text"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      placeholder="e.g. GPAY / NEFT / Cash"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="vev2-field">
                    <label>Tax Calculation Mode</label>
                    <div className="vev2-taxmode-group">
                      <button
                        type="button"
                        className={`vev2-taxmode-btn ${taxMode === 'EXCLUSIVE' ? 'active' : ''}`}
                        onClick={() => setTaxMode('EXCLUSIVE')}
                      >
                        Tax Exclusive (GST Added)
                      </button>
                      <button
                        type="button"
                        className={`vev2-taxmode-btn ${taxMode === 'INCLUSIVE' ? 'active' : ''}`}
                        onClick={() => setTaxMode('INCLUSIVE')}
                      >
                        Tax Inclusive (MRP)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Party info card (shows when party is selected) */}
                {selectedParty && (
                  <div className="vev2-party-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div className="vev2-party-name">{selectedParty.party_name}</div>
                        {(selectedParty.address_line1 || selectedParty.city) && (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {[selectedParty.address_line1, selectedParty.city, selectedParty.state].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className={`vev2-party-balance ${(selectedParty.current_balance_paise || 0) >= 0 ? 'credit' : 'debit'}`}>
                          ₹{Math.abs((selectedParty.current_balance_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {(selectedParty.current_balance_paise || 0) >= 0 ? 'Dr' : 'Cr'}
                        </span>
                      </div>
                    </div>
                    <div className="vev2-party-meta">
                      {selectedParty.gstin && (
                        <div><span>GSTIN&nbsp;</span><strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedParty.gstin}</strong></div>
                      )}
                      {selectedParty.pan && (
                        <div><span>PAN&nbsp;</span><strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedParty.pan}</strong></div>
                      )}
                      {selectedParty.phone && (
                        <div><span>Ph&nbsp;</span><strong>{selectedParty.phone}</strong></div>
                      )}
                      {selectedParty.bank_name && (
                        <div><span>Bank&nbsp;</span><strong>{selectedParty.bank_name}</strong></div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Items Section ── */}
              <div className="vev2-items-section">
                {/* Items header */}
                <div className="vev2-items-header">
                  <span className="vev2-items-title">Items</span>
                  <div className="vev2-item-search-wrap">
                    <Search size={13} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 2 }} />
                    <input
                      type="text"
                      className="vev2-item-search"
                      placeholder="Search or type to add an item…"
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      style={{ paddingLeft: '34px', width: '100%' }}
                    />
                  </div>
                  <button
                    type="button"
                    className="vev2-add-item-btn"
                    onClick={addLine}
                  >
                    <Plus size={13} />
                    Add Item
                  </button>
                  <button
                    type="button"
                    className="vev2-more-btn"
                    onClick={() => setShowQuickItemModal(true)}
                    title="Create new stock item master"
                    style={{ width: '32px', height: '32px', borderRadius: '6px' }}
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>

                {/* Items table */}
                <div className="vev2-table-wrap">
                  <table className="vev2-items-table">
                    <thead>
                      <tr>
                        <th style={{ width: '36px', textAlign: 'center' }}>#</th>
                        <th style={{ minWidth: '240px' }}>Item</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>HSN/SAC</th>
                        <th style={{ width: '70px', textAlign: 'right' }}>Qty</th>
                        <th style={{ width: '60px', textAlign: 'center' }}>Unit</th>
                        <th style={{ width: '130px', textAlign: 'right' }}>
                          Rate (₹) {taxMode === 'INCLUSIVE' ? <span style={{ color: 'var(--primary-accent)', fontSize: '9px' }}>INCL.</span> : <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>EXCL.</span>}
                        </th>
                        <th style={{ width: '75px', textAlign: 'right' }}>Disc. (%)</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>GST (%)</th>
                        <th style={{ width: '120px', textAlign: 'right' }}>Amount (₹)</th>
                        <th style={{ width: '36px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLineIndices.map((idx: number) => {
                        const row = lines[idx];
                        const qty = Number(row.quantity) || 0;
                        const gst = Number(row.gstRate) || 18;
                        const discPercent = Number(row.discountPercent) || 0;
                        let lineTotal = 0;

                        if (taxMode === 'EXCLUSIVE') {
                          const r = Number(row.rate) || 0;
                          const gross = qty * r;
                          const disc = gross * (discPercent / 100);
                          const taxable = gross - disc;
                          lineTotal = taxable + taxable * (gst / 100);
                        } else {
                          const rIncl = Number(row.rateInclTax || row.rate) || 0;
                          const gross = qty * rIncl;
                          lineTotal = gross - gross * (discPercent / 100);
                        }

                        return (
                          <tr key={idx}>
                            {/* # */}
                            <td className="vev2-line-number">{idx + 1}</td>

                            {/* Item name cell */}
                            <td style={{ minWidth: '260px' }}>
                              <ItemSearchSelect
                                itemId={row.itemId}
                                stockItems={stockItems}
                                voucherType={voucherType}
                                placeholder="Type to search stock item…"
                                onSelect={(stk) => updateLine(idx, 'itemId', stk.item_id)}
                                onAddNew={(typedName) => {
                                  setNewItemName(typedName);
                                  setShowQuickItemModal(true);
                                }}
                              />

                              {/* Serial number tracking */}
                              {(() => {
                                if (!row.itemId) return null;
                                const itemDef = stockItems.find((s: any) => s.item_id === row.itemId);
                                const isSerialTracked = Boolean(itemDef?.has_serial_no) || Boolean(itemDef?.serial_numbers);
                                if (!isSerialTracked) {
                                  return (
                                    <input
                                      type="text"
                                      value={row.description || ''}
                                      onChange={(e) => updateLine(idx, 'description', e.target.value)}
                                      placeholder="Line remarks / warranty notes (optional)…"
                                      style={{ width: '100%', height: '26px', fontSize: '12px', marginTop: '4px', color: 'var(--text-secondary)' }}
                                    />
                                  );
                                }
                                const availList: string[] = row.availableSerials || [];
                                const selectedSerials: string[] = (row.serialNumber || '').split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
                                const targetQty = Math.max(1, Math.round(Number(row.quantity) || 1));
                                const isMet = selectedSerials.length === targetQty;

                                const toggleSerial = (serial: string) => {
                                  let next: string[];
                                  if (selectedSerials.includes(serial)) {
                                    next = selectedSerials.filter((s: string) => s !== serial);
                                  } else {
                                    next = targetQty === 1 ? [serial] : [...selectedSerials, serial].slice(0, targetQty);
                                  }
                                  updateLine(idx, 'serialNumber', next.join(', '));
                                };

                                const isSalesOrOutward = voucherType === 'SALES';

                                return (
                                  <div className="serial-number-box" style={{ marginTop: '6px' }}>
                                    <div className="serial-box-header">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '11px' }}>
                                          {isSalesOrOutward ? '🏷️ Available S/N Stock:' : '📦 Incoming Serial Numbers:'}
                                        </span>
                                        {isSalesOrOutward && (
                                          <span className={`serial-badge-count ${availList.length > 0 ? 'success' : ''}`}>
                                            {availList.length} in Stock
                                          </span>
                                        )}
                                      </div>
                                      <span style={{ fontSize: '10px', color: isMet ? 'var(--success-emerald)' : 'var(--primary-accent)', fontWeight: 700 }}>
                                        {selectedSerials.length} / {targetQty} {isSalesOrOutward ? 'Selected' : 'Entered'} {isMet ? '✓' : ''}
                                      </span>
                                    </div>

                                    {/* Quick chips for Sales / Outward */}
                                    {isSalesOrOutward && availList.length > 0 && (
                                      <div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px', display: 'flex', justifyContent: 'space-between' }}>
                                          <span>Click chip to select serial:</span>
                                          {targetQty > 1 && (
                                            <button
                                              type="button"
                                              onClick={() => updateLine(idx, 'serialNumber', availList.slice(0, targetQty).join(', '))}
                                              style={{ background: 'none', border: 'none', color: 'var(--primary-accent)', fontSize: '10px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                                            >
                                              Pick First {targetQty}
                                            </button>
                                          )}
                                        </div>
                                        <div className="serial-chip-list">
                                          {availList.map((sn: string) => {
                                            const isSelected = selectedSerials.includes(sn);
                                            return (
                                              <button
                                                key={sn}
                                                type="button"
                                                onClick={() => toggleSerial(sn)}
                                                className={`serial-chip ${isSelected ? 'selected' : ''}`}
                                                title={isSelected ? 'Click to deselect' : 'Click to select'}
                                              >
                                                <span>{sn}</span>
                                                {isSelected && <span style={{ fontSize: '10px' }}>✓</span>}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {availList.length === 0 && isSalesOrOutward && (
                                      <div className="serial-warning-badge" style={{ marginTop: '4px' }}>
                                        <span>⚠️</span>
                                        <span>0 serial numbers currently in stock. Type manual serials below or update stock.</span>
                                      </div>
                                    )}

                                    {/* Direct comma-separated input */}
                                    <input
                                      type="text"
                                      value={row.serialNumber || ''}
                                      onChange={(e) => updateLine(idx, 'serialNumber', e.target.value)}
                                      placeholder={isSalesOrOutward ? 'Selected serials or type manual serial…' : 'Enter serial number(s) e.g. SN-001, SN-002…'}
                                      style={{ width: '100%', height: '28px', fontSize: '12px', fontFamily: 'var(--font-mono)', marginTop: '5px' }}
                                    />
                                  </div>
                                );
                              })()}
                            </td>

                            {/* HSN/SAC */}
                            <td>
                              <input
                                type="text"
                                value={row.hsnSac || ''}
                                onChange={(e) => updateLine(idx, 'hsnSac', e.target.value)}
                                placeholder="85044029"
                                style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                              />
                            </td>

                            {/* Qty */}
                            <td>
                              <input
                                type="number"
                                min="0.01"
                                step="1"
                                value={row.quantity}
                                onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                                style={{ textAlign: 'right', fontWeight: 700, fontSize: '14px' }}
                                className="tabular-nums"
                              />
                            </td>

                            {/* Unit */}
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                {row.unit || 'Nos'}
                              </span>
                            </td>

                            {/* Rate */}
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                value={taxMode === 'INCLUSIVE' ? row.rateInclTax : row.rate}
                                onChange={(e) => updateLine(idx, taxMode === 'INCLUSIVE' ? 'rateInclTax' : 'rate', e.target.value)}
                                style={{
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  fontSize: '14px',
                                  borderColor: 'var(--border-subtle)',
                                  backgroundColor: 'var(--surface-soft)'
                                }}
                                className="tabular-nums"
                              />
                            </td>

                            {/* Discount % */}
                            <td>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={row.discountPercent}
                                onChange={(e) => updateLine(idx, 'discountPercent', e.target.value)}
                                style={{ textAlign: 'right' }}
                                className="tabular-nums"
                              />
                            </td>

                            {/* GST % */}
                            <td>
                              <select
                                value={row.gstRate || 18}
                                onChange={(e) => updateLine(idx, 'gstRate', Number(e.target.value))}
                                style={{ textAlign: 'center', fontSize: '13px' }}
                              >
                                <option value={0}>0%</option>
                                <option value={5}>5%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
                            </td>

                            {/* Amount */}
                            <td>
                              <span className="vev2-amount-cell">
                                ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>

                            {/* Delete */}
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="vev2-delete-btn"
                                onClick={() => removeLine(idx)}
                                disabled={lines.length === 1}
                                title="Remove line"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Empty row hint */}
                      <tr>
                        <td colSpan={10} style={{ padding: '8px 12px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ opacity: 0.4 }}>+</span>
                            <span style={{ opacity: 0.5 }}>Search or select an item to add…</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Table footer: Add Row | Scan | Tax Inclusive toggle | Round Off */}
                <div className="vev2-table-footer">
                  <button type="button" className="vev2-add-row-btn" onClick={addLine}>
                    <Plus size={13} />
                    Add Row
                  </button>
                  <button
                    type="button"
                    className="vev2-scan-btn"
                    onClick={() => setShowQuickItemModal(true)}
                    title="Create new stock item"
                  >
                    <PackagePlus size={13} />
                    New Item
                  </button>

                  <div className="vev2-table-footer-right">
                    <label className="vev2-tax-toggle" title="Toggle between Tax Exclusive (GST added) and Tax Inclusive (MRP)">
                      Tax Inclusive
                      <label className="vev2-toggle-switch">
                        <input
                          type="checkbox"
                          checked={taxMode === 'INCLUSIVE'}
                          onChange={(e) => setTaxMode(e.target.checked ? 'INCLUSIVE' : 'EXCLUSIVE')}
                        />
                        <span className="vev2-toggle-track"></span>
                        <span className="vev2-toggle-thumb"></span>
                      </label>
                    </label>

                    <div className="vev2-round-off">
                      Round Off
                      <select defaultValue="nearest1">
                        <option value="nearest1">Nearest ₹1</option>
                        <option value="nearest10">Nearest ₹10</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Footer: Narration + Terms ── */}
              <div className="vev2-footer-card">
                <div className="vev2-footer-grid">
                  <div className="vev2-footer-field">
                    <label>Narration</label>
                    <textarea
                      rows={3}
                      value={narration}
                      onChange={(e) => setNarration(e.target.value)}
                      placeholder="e.g. Purchase of HP 65W Blue Adapter, Serial: 3cb0720r3y, 1Yr Dealer Wrnty..."
                    />
                  </div>
                  <div className="vev2-footer-field">
                    <label>Terms & Conditions</label>
                    <textarea
                      rows={3}
                      value={termsAndConditions}
                      onChange={(e) => setTermsAndConditions(e.target.value)}
                      placeholder="e.g. Goods once sold no return. Warranty from service center only."
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ════ Financial Voucher (Receipt / Payment / Contra / Journal) ════ */
            <>
              {/* Meta row for financial vouchers */}
              <div className="vev2-meta-card">
                <div className="vev2-meta-row">
                  <div className="vev2-field">
                    <label>Entry Date *</label>
                    <input
                      type="date"
                      id="voucher-date-input"
                      value={voucherDate}
                      onChange={(e) => setVoucherDate(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="vev2-field">
                    <label>Voucher Number</label>
                    <input
                      type="text"
                      value={voucherNumber}
                      onChange={(e) => setVoucherNumber(e.target.value)}
                      style={{ width: '100%', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                    />
                  </div>
                  <div className="vev2-field">
                    <label>Payment Mode / Ref</label>
                    <input
                      type="text"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      placeholder="e.g. GPAY / ICICI Bank / NEFT"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              {/* Ledger posting table */}
              <div className="vev2-ledger-card">
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
                  Accounting Ledger Postings (Double Entry)
                </h3>
                <table className="ledger-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '70px' }}>Type</th>
                      <th>Account Ledger</th>
                      <th style={{ width: '150px', textAlign: 'right' }}>Amount (₹)</th>
                      <th>Particulars</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerLines.map((row: any, idx: number) => (
                      <tr key={idx}>
                        <td>
                          <select
                            value={row.type}
                            onChange={(e) => {
                              const updated = [...ledgerLines];
                              updated[idx].type = e.target.value;
                              setLedgerLines(updated);
                            }}
                            style={{ padding: '4px 8px', fontWeight: 700 }}
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
                            <option value="">— Select Account Ledger —</option>
                            {ledgers.map((l: any) => (
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
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="vev2-delete-btn"
                            onClick={() => {
                              if (ledgerLines.length > 2) {
                                setLedgerLines(ledgerLines.filter((_: any, i: number) => i !== idx));
                              }
                            }}
                            disabled={ledgerLines.length <= 2}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="vev2-add-row-btn"
                    onClick={() => setLedgerLines([...ledgerLines, { ledgerId: '', type: 'DR', amount: 0, particulars: '' }])}
                  >
                    <Plus size={13} /> Add Row
                  </button>
                </div>
                {/* Narration for financial */}
                <div style={{ marginTop: '14px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>
                    Narration
                  </label>
                  <textarea
                    rows={2}
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    placeholder="Enter narration / reference notes..."
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ════ RIGHT: Sticky Sidebar ════ */}
        {isTrading && (
          <div className="vev2-sidebar">

            {/* Invoice Summary card */}
            <div className="vev2-summary-card">
              <div className="vev2-summary-title">Invoice Summary</div>

              {/* Counts */}
              <div className="vev2-summary-counts">
                <div className="vev2-summary-count">
                  <span>Total Items</span>
                  <strong>{filledLines.length}</strong>
                </div>
                <div className="vev2-summary-count">
                  <span>Total Qty</span>
                  <strong>{totalQty}</strong>
                </div>
              </div>

              {/* Rows */}
              <div className="vev2-summary-rows">
                <div className="vev2-summary-row">
                  <span>Taxable Value (Base)</span>
                  <span>₹{totals.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {totals.cgst > 0 && (
                  <div className="vev2-summary-row">
                    <span>CGST</span>
                    <span>₹{totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {totals.sgst > 0 && (
                  <div className="vev2-summary-row">
                    <span>SGST</span>
                    <span>₹{totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {totals.igst > 0 && (
                  <div className="vev2-summary-row">
                    <span>IGST</span>
                    <span>₹{totals.igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <hr className="vev2-summary-divider" />
                <div className="vev2-summary-row">
                  <span>Total Tax</span>
                  <span>₹{totals.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="vev2-summary-row">
                  <span>Round Off</span>
                  <span style={{ color: totals.roundOff < 0 ? 'var(--danger-red)' : 'var(--text-primary)' }}>
                    {totals.roundOff < 0 ? `(-)₹${Math.abs(totals.roundOff).toFixed(2)}` : `₹${totals.roundOff.toFixed(2)}`}
                  </span>
                </div>
              </div>

              {/* Grand Total */}
              <div className="vev2-grand-total-block">
                <div className="vev2-grand-total-label">Grand Total</div>
                <div className="vev2-grand-total-amount">
                  ₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Amount in words */}
              <div className="vev2-amount-words">
                <strong>Amount in Words</strong>
                {numberToWords(totals.grandTotal)}
              </div>
            </div>

            {/* Payment Details accordion */}
            <div className="vev2-accordion-card">
              <div
                className="vev2-accordion-header"
                onClick={() => setPaymentOpen((o) => !o)}
              >
                <span>Payment Details</span>
                <ChevronDown size={14} style={{ transform: paymentOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>
              {paymentOpen && (
                <div className="vev2-accordion-body">
                  <div style={{ paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Mode</label>
                      <input
                        type="text"
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        placeholder="GPAY / NEFT / Cash"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Terms</label>
                      <input
                        type="text"
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        placeholder="Immediate / Net 30 Days"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Terms & Conditions accordion */}
            <div className="vev2-accordion-card">
              <div
                className="vev2-accordion-header"
                onClick={() => setTermsOpen((o) => !o)}
              >
                <span>Terms & Conditions</span>
                <ChevronDown size={14} style={{ transform: termsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>
              {termsOpen && (
                <div className="vev2-accordion-body">
                  {termsAndConditions ? (
                    <ol className="vev2-terms-list">
                      {termsAndConditions.split(/\d+[-=.]/).filter(Boolean).map((t: string, i: number) => (
                        <li key={i}>{t.trim()}</li>
                      ))}
                    </ol>
                  ) : (
                    <div style={{ paddingTop: '8px', color: 'var(--text-muted)', fontSize: '11.5px', fontStyle: 'italic' }}>
                      Add terms in the Narration section below…
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ── Sticky Bottom Action Bar ── */}
      <div className="vev2-action-bar">
        <div className="vev2-action-left">
          <button
            type="button"
            className="vev2-cancel-btn"
            onClick={() => {
              if (confirm('Cancel voucher entry?')) {
                setLines([{ itemId: '', description: '', quantity: 1, unit: 'Nos', hsnSac: '85044029', rate: 0, rateInclTax: 0, discountPercent: 0, gstRate: 18, godownId: '', serialNumber: '', availableSerials: [] }]);
                setNarration('');
              }
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ height: '40px', padding: '0 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setShowLivePreview(true)}
            title="Print Preview (Alt+P)"
          >
            <Eye size={14} />
            Preview
          </button>
        </div>
        <div className="vev2-action-right">
          <button
            type="button"
            className="vev2-draft-btn"
            onClick={() => handleSaveVoucher(false)}
            disabled={isSaving}
          >
            Save as Draft
          </button>
          <div className="vev2-save-print-group" style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="vev2-btn-save"
              onClick={() => handleSaveVoucher(false)}
              disabled={isSaving}
              style={{ padding: '8px 22px', fontSize: '13.5px', fontWeight: 700, height: '40px' }}
              title="Save Voucher (Ctrl+A, Ctrl+S or F10)"
            >
              <Check size={16} />
              {isSaving ? 'Saving…' : 'Save Voucher'}
            </button>
            <button
              type="button"
              className="vev2-save-print-btn"
              onClick={() => handleSaveVoucher(true)}
              disabled={isSaving}
              style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 600, height: '40px' }}
              title="Save and open print preview"
            >
              <Printer size={15} />
              {isSaving ? 'Saving…' : 'Save & Print'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick Party Modal ── */}
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
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Phone / Mobile</label>
                    <input type="text" value={newPartyPhone} onChange={(e) => setNewPartyPhone(e.target.value)} placeholder="+91 93600 34774" style={{ width: '100%', padding: '8px 10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Email Address</label>
                    <input type="email" value={newPartyEmail} onChange={(e) => setNewPartyEmail(e.target.value)} placeholder="info@example.com" style={{ width: '100%', padding: '8px 10px' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Address</label>
                  <input type="text" value={newPartyAddress1} onChange={(e) => setNewPartyAddress1(e.target.value)} placeholder="Street, Building" style={{ width: '100%', padding: '8px 10px' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>City</label>
                    <input type="text" value={newPartyCity} onChange={(e) => setNewPartyCity(e.target.value)} placeholder="Chennai" style={{ width: '100%', padding: '8px 10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Pincode</label>
                    <input type="text" value={newPartyPincode} onChange={(e) => setNewPartyPincode(e.target.value)} placeholder="600001" style={{ width: '100%', padding: '8px 10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Bank Name</label>
                    <input type="text" value={newPartyBankName} onChange={(e) => setNewPartyBankName(e.target.value)} placeholder="ICICI BANK" style={{ width: '100%', padding: '8px 10px' }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowPartyModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 18px' }}>Create Party</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Quick Item Modal ── */}
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
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>HSN / SAC Code</label>
                    <input type="text" value={newItemHsn} onChange={(e) => setNewItemHsn(e.target.value)} placeholder="85044029" style={{ width: '100%', padding: '8px 10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Unit</label>
                    <select value={newItemUnitId} onChange={(e) => setNewItemUnitId(e.target.value)} style={{ width: '100%', padding: '8px 10px' }}>
                      {units.map((u: any) => (
                        <option key={u.unit_id} value={u.unit_id}>{u.symbol} ({u.unit_name})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>GST Rate %</label>
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
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Cost Excl. Tax (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newItemPurchaseCost}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setNewItemPurchaseCost(val);
                        setNewItemPurchaseCostIncl(Math.round(val * (1 + newItemGstRate / 100) * 100) / 100);
                        if (newItemSellingPrice === 0) setNewItemSellingPrice(Math.round(val * (1 + newItemGstRate / 100) * 100) / 100);
                      }}
                      placeholder="550.85"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Cost Incl. Tax (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newItemPurchaseCostIncl}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setNewItemPurchaseCostIncl(val);
                        setNewItemPurchaseCost(Math.round((val / (1 + newItemGstRate / 100)) * 100) / 100);
                        if (newItemSellingPrice === 0) setNewItemSellingPrice(val);
                      }}
                      placeholder="650.00"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Selling Price (₹) *</label>
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

                {/* Serial Number Tracking Toggle & Initial Serials Box */}
                <div style={{ marginTop: '8px', padding: '12px 14px', background: 'var(--surface-soft)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={newItemHasSerialNo}
                      onChange={(e) => setNewItemHasSerialNo(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary-accent)' }}
                    />
                    <span>🏷️ Track Serial Numbers (S/N / IMEI) for this Item</span>
                  </label>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginLeft: '24px', marginTop: '2px' }}>
                    Enable for serialized stock (laptops, printers, desktops, monitors, or hardware).
                  </div>

                  {newItemHasSerialNo && (
                    <div style={{ marginTop: '10px', marginLeft: '24px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                        Initial Stock Serial Numbers (Optional, comma-separated)
                      </label>
                      <input
                        type="text"
                        value={newItemSerialNumbers}
                        onChange={(e) => setNewItemSerialNumbers(e.target.value)}
                        placeholder="e.g. SN-LP01, SN-LP02, SN-LP03"
                        style={{ width: '100%', padding: '8px 10px', fontSize: '12.5px', fontFamily: 'var(--font-mono)' }}
                      />
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Each serial number will be entered as available in stock upon saving.
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowQuickItemModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 18px' }}>Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Live Print Preview Modal ── */}
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
