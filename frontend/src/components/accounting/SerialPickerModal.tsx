import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Check, Plus, Search, Barcode, ShieldCheck, AlertCircle, Trash2 } from 'lucide-react';
import { api, ItemSerialDetail } from '../../api/client';

export interface SerialPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'SALES' | 'PURCHASE';
  itemId?: string;
  itemName: string;
  currentQuantity: number;
  initialSerials: string[];
  warrantyMonths?: number;
  godownId?: string;
  godownName?: string;
  onConfirm: (serials: string[]) => void;
}

export const SerialPickerModal: React.FC<SerialPickerModalProps> = ({
  isOpen,
  onClose,
  mode,
  itemId,
  itemName,
  currentQuantity,
  initialSerials,
  warrantyMonths = 0,
  godownId,
  godownName,
  onConfirm
}) => {
  // Sales mode state
  const [availableSerials, setAvailableSerials] = useState<ItemSerialDetail[]>([]);
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [salesInputVal, setSalesInputVal] = useState('');
  const [salesBulkInput, setSalesBulkInput] = useState('');
  const [showSalesBulkInput, setShowSalesBulkInput] = useState(false);

  // Purchase mode state
  const [purchaseSerials, setPurchaseSerials] = useState<string[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkInput, setShowBulkInput] = useState(false);

  // Autofocus DOM element references
  const salesInputRef = useRef<HTMLInputElement>(null);
  const purchaseInputRef = useRef<HTMLInputElement>(null);
  const salesBulkRef = useRef<HTMLTextAreaElement>(null);
  const purchaseBulkRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus the active input when modal opens or switches modes
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (mode === 'SALES') {
        salesInputRef.current?.focus();
        salesInputRef.current?.select();
      } else {
        purchaseInputRef.current?.focus();
        purchaseInputRef.current?.select();
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [isOpen, mode]);

  // Auto-focus bulk textarea when toggled
  useEffect(() => {
    if (showSalesBulkInput) {
      setTimeout(() => salesBulkRef.current?.focus(), 50);
    }
  }, [showSalesBulkInput]);

  useEffect(() => {
    if (showBulkInput) {
      setTimeout(() => purchaseBulkRef.current?.focus(), 50);
    }
  }, [showBulkInput]);

  // Initialize state when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'SALES') {
      setSelectedSet(new Set(initialSerials.map(s => s.trim()).filter(Boolean)));
      if (itemId) {
        setIsLoading(true);
        setFetchError(null);
        api.getItemSerials(itemId, true, godownId)
          .then((res: any[]) => {
            // Handle both object detail format and string array format
            const formatted: ItemSerialDetail[] = (res || []).map(r => {
              if (typeof r === 'string') {
                return { serialNumber: r, status: 'AVAILABLE' };
              }
              return r;
            });
            setAvailableSerials(formatted);
          })
          .catch((err: any) => {
            console.error('Failed to load item serials:', err);
            setFetchError(err.message || 'Failed to load available serial numbers');
          })
          .finally(() => {
            setIsLoading(false);
          });
      }
    } else {
      // PURCHASE mode
      setPurchaseSerials([...initialSerials.map(s => s.trim()).filter(Boolean)]);
      setInputVal('');
      setBulkInput('');
      setShowBulkInput(false);
    }
  }, [isOpen, mode, itemId, godownId]);

  // Handle Escape key to close cleanly
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered available serials for search in SALES mode
  const filteredAvailable = useMemo(() => {
    if (!searchQuery.trim()) return availableSerials;
    const q = searchQuery.toLowerCase().trim();
    return availableSerials.filter(s => s.serialNumber.toLowerCase().includes(q));
  }, [availableSerials, searchQuery]);

  if (!isOpen) return null;

  const toggleSelectSerial = (s: string) => {
    setSelectedSet(prev => {
      const next = new Set(prev);
      if (next.has(s)) {
        next.delete(s);
      } else {
        next.add(s);
      }
      return next;
    });
  };

  const handleSelectFirstN = () => {
    const qty = Math.max(1, Math.round(currentQuantity));
    const toPick = filteredAvailable.slice(0, qty).map(s => s.serialNumber);
    setSelectedSet(new Set(toPick));
  };

  const handleClearSelection = () => {
    setSelectedSet(new Set());
  };

  // Add a single manual / scanned serial in Sales mode (e.g. unbilled purchase)
  const handleAddSalesManualSerial = () => {
    const trimmed = salesInputVal.trim();
    if (!trimmed) return;
    if (selectedSet.has(trimmed)) {
      setSalesInputVal('');
      setTimeout(() => salesInputRef.current?.focus(), 20);
      return;
    }
    setSelectedSet(prev => new Set([...prev, trimmed]));
    setAvailableSerials(prev => {
      if (prev.some(s => s.serialNumber.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [...prev, { serialNumber: trimmed, status: 'AVAILABLE' }];
    });
    setSalesInputVal('');
    setTimeout(() => salesInputRef.current?.focus(), 20);
  };

  // Add bulk serials in Sales mode
  const handleAddSalesBulkSerials = () => {
    if (!salesBulkInput.trim()) return;
    const parts = salesBulkInput
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const newToAdd: string[] = [];
    setSelectedSet(prev => {
      const next = new Set(prev);
      for (const p of parts) {
        next.add(p);
        newToAdd.push(p);
      }
      return next;
    });

    setAvailableSerials(prev => {
      const existing = new Set(prev.map(p => p.serialNumber.toLowerCase()));
      const toAppend = newToAdd
        .filter(s => !existing.has(s.toLowerCase()))
        .map(s => ({ serialNumber: s, status: 'AVAILABLE' as const }));
      return [...prev, ...toAppend];
    });

    setSalesBulkInput('');
    setShowSalesBulkInput(false);
  };

  const handleRemoveSalesSerial = (s: string) => {
    setSelectedSet(prev => {
      const next = new Set(prev);
      next.delete(s);
      return next;
    });
    setTimeout(() => salesInputRef.current?.focus(), 20);
  };

  // Add a single serial in Purchase mode
  const handleAddPurchaseSerial = () => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;
    if (purchaseSerials.includes(trimmed)) {
      alert(`Serial '${trimmed}' is already in the list.`);
      setTimeout(() => purchaseInputRef.current?.focus(), 20);
      return;
    }
    setPurchaseSerials(prev => [...prev, trimmed]);
    setInputVal('');
    setTimeout(() => purchaseInputRef.current?.focus(), 20);
  };

  // Add bulk serials in Purchase mode
  const handleAddBulkSerials = () => {
    if (!bulkInput.trim()) return;
    const parts = bulkInput
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const newSerials: string[] = [];
    for (const p of parts) {
      if (!purchaseSerials.includes(p) && !newSerials.includes(p)) {
        newSerials.push(p);
      }
    }
    setPurchaseSerials(prev => [...prev, ...newSerials]);
    setBulkInput('');
    setShowBulkInput(false);
    setTimeout(() => purchaseInputRef.current?.focus(), 30);
  };

  const handleRemovePurchaseSerial = (idx: number) => {
    setPurchaseSerials(prev => prev.filter((_, i) => i !== idx));
    setTimeout(() => purchaseInputRef.current?.focus(), 20);
  };

  const handleConfirm = () => {
    if (mode === 'SALES') {
      onConfirm(Array.from(selectedSet));
    } else {
      onConfirm(purchaseSerials);
    }
    onClose();
  };

  return (
    <div className="vev2-serial-modal-overlay" onClick={onClose}>
      <div
        className="vev2-serial-modal-card"
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '640px' }}
      >
        {/* Header */}
        <div className="vev2-serial-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6366F1'
              }}
            >
              <Barcode size={18} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {mode === 'SALES' ? 'Select Serial Numbers' : 'Register Purchase Serials'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {itemName} {godownName && `• Godown: ${godownName}`} {warrantyMonths > 0 && `• ${warrantyMonths}M Standard Warranty`}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="vev2-serial-modal-body">
          {mode === 'SALES' ? (
            /* SALES MODE */
            <>
              {/* Manual Entry & Barcode Scanner Bar */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  ref={salesInputRef}
                  autoFocus
                  type="text"
                  className="lf-input"
                  placeholder="Type or scan unit serial number (Press Enter to add)"
                  value={salesInputVal}
                  onChange={e => setSalesInputVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (salesInputVal.trim()) {
                        handleAddSalesManualSerial();
                      } else if (selectedSet.size > 0) {
                        handleConfirm();
                      }
                    }
                  }}
                  style={{ flex: 1, fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
                <button
                  type="button"
                  className="lf-btn lf-btn-primary"
                  onClick={handleAddSalesManualSerial}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px' }}
                >
                  <Plus size={14} /> Add
                </button>
                <button
                  type="button"
                  className="lf-btn lf-btn-secondary"
                  onClick={() => setShowSalesBulkInput(!showSalesBulkInput)}
                  style={{ fontSize: '11.5px', padding: '6px 10px' }}
                >
                  {showSalesBulkInput ? 'Close Bulk' : 'Paste Multiple'}
                </button>
              </div>

              {/* Bulk paste textarea for Sales */}
              {showSalesBulkInput && (
                <div
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-subtle)'
                  }}
                >
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Paste comma, semicolon, or newline-separated serial numbers:
                  </label>
                  <textarea
                    ref={salesBulkRef}
                    autoFocus
                    rows={3}
                    className="lf-input"
                    placeholder="SN-1001, SN-1002, SN-1003..."
                    value={salesBulkInput}
                    onChange={e => setSalesBulkInput(e.target.value)}
                    style={{ width: '100%', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="lf-btn lf-btn-primary"
                      onClick={handleAddSalesBulkSerials}
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                    >
                      Import Serials
                    </button>
                  </div>
                </div>
              )}

              {/* Selected Serials Chip Cloud */}
              {selectedSet.size > 0 && (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    maxHeight: '110px',
                    overflowY: 'auto',
                    alignContent: 'flex-start'
                  }}
                >
                  {Array.from(selectedSet).map(s => (
                    <span
                      key={s}
                      className="vev2-serial-tag"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#EEF2FF',
                        color: '#4F46E5',
                        border: '1px solid #C7D2FE'
                      }}
                    >
                      <Barcode size={12} />
                      <strong style={{ fontFamily: 'var(--font-mono)' }}>{s}</strong>
                      <button
                        type="button"
                        onClick={() => handleRemoveSalesSerial(s)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#EF4444',
                          padding: '1px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title={`Remove serial ${s}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Status summary */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11.5px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-subtle)'
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Required Qty: </span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{currentQuantity}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Selected: </span>
                  <strong
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: selectedSet.size === Number(currentQuantity) ? '#10B981' : '#F59E0B'
                    }}
                  >
                    {selectedSet.size}
                  </strong>
                  {selectedSet.size === Number(currentQuantity) && (
                    <span style={{ color: '#10B981', marginLeft: '6px' }}>✓ Exact match</span>
                  )}
                </div>
              </div>

              {/* Available Stock Section / Unbilled Helper */}
              {isLoading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  ⏳ Loading available in-stock serials…
                </div>
              ) : fetchError ? (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#EF4444',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <AlertCircle size={15} />
                  <span>{fetchError}</span>
                </div>
              ) : availableSerials.length === 0 ? (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}
                >
                  <ShieldCheck size={18} color="#16A34A" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '12.5px' }}>Direct / Unbilled Procurement</div>
                    <div style={{ fontSize: '11px', color: '#15803D', marginTop: '3px', lineHeight: 1.4 }}>
                      No prior purchase invoice serials found in stock for this item. You can type or scan serial numbers above to allocate them directly to this sales invoice without creating a purchase bill.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="text"
                        className="lf-input"
                        placeholder="Search available in-stock serials…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ fontSize: '12px', paddingLeft: '28px', height: '32px' }}
                      />
                      <Search
                        size={13}
                        style={{
                          position: 'absolute',
                          left: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--text-muted)'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={handleSelectFirstN}
                        className="lf-btn lf-btn-secondary"
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                      >
                        Select First {currentQuantity}
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        className="lf-btn lf-btn-secondary"
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {filteredAvailable.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      No serial numbers matching '{searchQuery}'.
                    </div>
                  ) : (
                    <div className="vev2-serial-grid" style={{ maxHeight: '220px' }}>
                      {filteredAvailable.map(item => {
                        const isSelected = selectedSet.has(item.serialNumber);
                        return (
                          <div
                            key={item.serialNumber}
                            className={`vev2-serial-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleSelectSerial(item.serialNumber)}
                          >
                            <div
                              style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '3px',
                                border: isSelected ? '1px solid #6366F1' : '1px solid var(--border-subtle)',
                                backgroundColor: isSelected ? '#6366F1' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#FFFFFF'
                              }}
                            >
                              {isSelected && <Check size={10} strokeWidth={3} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: isSelected ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.serialNumber}
                              </div>
                              {item.warrantyExpiryDate && (
                                <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  Exp: {item.warrantyExpiryDate}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            /* PURCHASE MODE */
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11.5px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-subtle)'
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Target Invoice Qty: </span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{currentQuantity}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Entered Serials: </span>
                  <strong
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: purchaseSerials.length === Number(currentQuantity) ? '#10B981' : '#F59E0B'
                    }}
                  >
                    {purchaseSerials.length}
                  </strong>
                </div>
              </div>

              {/* Single Serial Input */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  ref={purchaseInputRef}
                  autoFocus
                  type="text"
                  className="lf-input"
                  placeholder="Enter unit serial number (e.g. SN-8942-01)"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (inputVal.trim()) {
                        handleAddPurchaseSerial();
                      } else if (purchaseSerials.length > 0) {
                        handleConfirm();
                      }
                    }
                  }}
                  style={{ flex: 1, fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
                <button
                  type="button"
                  className="lf-btn lf-btn-primary"
                  onClick={handleAddPurchaseSerial}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px' }}
                >
                  <Plus size={14} /> Add
                </button>
                <button
                  type="button"
                  className="lf-btn lf-btn-secondary"
                  onClick={() => setShowBulkInput(!showBulkInput)}
                  style={{ fontSize: '11.5px', padding: '6px 10px' }}
                >
                  {showBulkInput ? 'Close Bulk' : 'Paste Multiple'}
                </button>
              </div>

              {/* Bulk paste textarea */}
              {showBulkInput && (
                <div
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-subtle)'
                  }}
                >
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Paste comma, semicolon, or newline-separated serial numbers:
                  </label>
                  <textarea
                    ref={purchaseBulkRef}
                    autoFocus
                    rows={3}
                    className="lf-input"
                    placeholder="SN-1001, SN-1002, SN-1003..."
                    value={bulkInput}
                    onChange={e => setBulkInput(e.target.value)}
                    style={{ width: '100%', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="lf-btn lf-btn-primary"
                      onClick={handleAddBulkSerials}
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                    >
                      Import Serials
                    </button>
                  </div>
                </div>
              )}

              {/* Serials Chip Cloud */}
              <div
                style={{
                  minHeight: '100px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '10px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  alignContent: 'flex-start'
                }}
              >
                {purchaseSerials.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '11.5px', margin: 'auto' }}>
                    No serial numbers added yet. Type a serial number above or paste multiple.
                  </div>
                ) : (
                  purchaseSerials.map((s, idx) => (
                    <span key={idx} className="vev2-serial-tag">
                      <span>{s}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePurchaseSerial(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#EF4444',
                          padding: '1px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="vev2-serial-footer">
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            {mode === 'SALES' ? (
              <span>{selectedSet.size} unit(s) selected</span>
            ) : (
              <span>{purchaseSerials.length} unit(s) registered</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="lf-btn lf-btn-secondary"
              onClick={onClose}
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="lf-btn lf-btn-primary"
              onClick={handleConfirm}
              style={{ fontSize: '12px', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Check size={14} /> Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
