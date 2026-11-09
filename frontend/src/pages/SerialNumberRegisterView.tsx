import React, { useEffect, useState, useMemo } from 'react';
import { Company, FinancialYear, api } from '../api/client';
import {
  Barcode,
  Boxes,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Warehouse,
  ShoppingBag,
  TrendingUp,
  X,
  ShieldCheck,
  Building2,
  Calendar,
  User,
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export interface SerialNumberRegisterViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  onSelectVoucher?: (voucherId: string) => void;
  onBackToItems?: () => void;
}

export const SerialNumberRegisterView: React.FC<SerialNumberRegisterViewProps> = ({
  company,
  activeFy,
  onSelectVoucher,
  onBackToItems
}) => {
  const [loading, setLoading] = useState(true);
  const [serials, setSerials] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    available: 0,
    sold: 0,
    returned: 0,
    damaged: 0
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedGodown, setSelectedGodown] = useState<string>('ALL');
  const [selectedItem, setSelectedItem] = useState<string>('ALL');
  const [godownsList, setGodownsList] = useState<any[]>([]);
  const [itemsList, setItemsList] = useState<any[]>([]);

  // History modal
  const [selectedSerialHistory, setSelectedSerialHistory] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  const loadData = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [regRes, gList, iList] = await Promise.all([
        api.getSerialNumberRegister({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          godownId: selectedGodown !== 'ALL' ? selectedGodown : undefined,
          itemId: selectedItem !== 'ALL' ? selectedItem : undefined,
          search: searchQuery.trim() || undefined
        }),
        api.getGodowns().catch(() => []),
        api.getStockItems().catch(() => [])
      ]);

      setSerials(regRes.serials || []);
      setSummary(regRes.summary || { total: 0, available: 0, sold: 0, returned: 0, damaged: 0 });
      setGodownsList(Array.isArray(gList) ? gList : []);
      setItemsList(Array.isArray(iList) ? iList : []);
    } catch (err) {
      console.error('Failed to load serial number register:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company, statusFilter, selectedGodown, selectedItem]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleOpenHistory = async (serial: any) => {
    setHistoryLoading(true);
    setSelectedSerialHistory(serial);
    try {
      const hist = await api.getSerialHistory(serial.serialId || serial.serialNumber);
      setSelectedSerialHistory(hist);
    } catch (err) {
      console.error('Failed to fetch full history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Filtered in memory for rapid typing if search not submitted yet
  const filteredSerials = useMemo(() => {
    if (!searchQuery.trim()) return serials;
    const q = searchQuery.toLowerCase().trim();
    return serials.filter(s =>
      s.serialNumber.toLowerCase().includes(q) ||
      (s.itemName && s.itemName.toLowerCase().includes(q)) ||
      (s.itemCode && s.itemCode.toLowerCase().includes(q)) ||
      (s.sku && s.sku.toLowerCase().includes(q)) ||
      (s.purchaseVoucherNumber && s.purchaseVoucherNumber.toLowerCase().includes(q)) ||
      (s.salesVoucherNumber && s.salesVoucherNumber.toLowerCase().includes(q)) ||
      (s.supplierName && s.supplierName.toLowerCase().includes(q)) ||
      (s.customerName && s.customerName.toLowerCase().includes(q))
    );
  }, [serials, searchQuery]);

  const paginatedSerials = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredSerials.slice(start, start + rowsPerPage);
  }, [filteredSerials, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredSerials.length / rowsPerPage));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '9999px',
            backgroundColor: '#DCFCE7',
            color: '#15803D',
            border: '1px solid #86EFAC'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
            Available
          </span>
        );
      case 'SOLD':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '9999px',
            backgroundColor: '#E0E7FF',
            color: '#3730A3',
            border: '1px solid #C7D2FE'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366F1' }} />
            Sold
          </span>
        );
      case 'RETURNED':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '9999px',
            backgroundColor: '#FEF3C7',
            color: '#B45309',
            border: '1px solid #FDE68A'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
            Returned
          </span>
        );
      case 'DAMAGED':
      case 'WRITTEN_OFF':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '9999px',
            backgroundColor: '#FEE2E2',
            color: '#B91C1C',
            border: '1px solid #FECACA'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
            {status === 'DAMAGED' ? 'Damaged' : 'Written Off'}
          </span>
        );
      default:
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '9999px',
            backgroundColor: 'var(--bg-card-hover, #F1F5F9)',
            color: 'var(--text-muted, #64748B)',
            border: '1px solid var(--border-subtle, #E2E8F0)'
          }}>
            {status}
          </span>
        );
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Breadcrumb & Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <span>Inventory</span>
            <span>/</span>
            {onBackToItems ? (
              <button
                type="button"
                onClick={onBackToItems}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary, #F97316)', cursor: 'pointer', padding: 0, fontWeight: 500 }}
              >
                Stock Items
              </button>
            ) : (
              <span>Stock Items</span>
            )}
            <span>/</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Serial Number Register</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Barcode size={24} style={{ color: 'var(--color-primary, #F97316)' }} />
            Serial Number Register
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Track unit-level physical inventory lifecycle from purchase to sale, return, and warranty status.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={loadData}
            className="lf-btn lf-btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {onBackToItems && (
            <button
              type="button"
              onClick={onBackToItems}
              className="lf-btn lf-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
            >
              Back to Items
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Total Serials */}
        <div style={{
          backgroundColor: 'var(--bg-card, #FFFFFF)',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid var(--border-subtle, #E2E8F0)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary, #F97316)'
          }}>
            <Barcode size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Total Serials</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {summary.total.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Registered physical units</div>
          </div>
        </div>

        {/* Available in Stock */}
        <div style={{
          backgroundColor: 'var(--bg-card, #FFFFFF)',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid var(--border-subtle, #E2E8F0)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#16A34A'
          }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Available Units</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#16A34A', lineHeight: 1.2 }}>
              {summary.available.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {summary.total > 0 ? `${Math.round((summary.available / summary.total) * 100)}% of total` : 'Ready to sell'}
            </div>
          </div>
        </div>

        {/* Sold Units */}
        <div style={{
          backgroundColor: 'var(--bg-card, #FFFFFF)',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid var(--border-subtle, #E2E8F0)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6366F1'
          }}>
            <ShoppingBag size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Sold Units</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#6366F1', lineHeight: 1.2 }}>
              {summary.sold.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {summary.total > 0 ? `${Math.round((summary.sold / summary.total) * 100)}% sold` : 'Invoiced to customers'}
            </div>
          </div>
        </div>

        {/* Returned Units */}
        <div style={{
          backgroundColor: 'var(--bg-card, #FFFFFF)',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid var(--border-subtle, #E2E8F0)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D97706'
          }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Returned / Supplier</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#D97706', lineHeight: 1.2 }}>
              {summary.returned.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Processed returns</div>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div style={{
        backgroundColor: 'var(--bg-card, #FFFFFF)',
        borderRadius: '12px',
        padding: '16px 20px',
        border: '1px solid var(--border-subtle, #E2E8F0)',
        marginBottom: '20px'
      }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Search box */}
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <input
              type="text"
              className="lf-input"
              placeholder="Search serial number, item name, voucher #…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '32px', height: '36px', fontSize: '13px' }}
            />
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          {/* Status Filter */}
          <div style={{ width: '160px' }}>
            <select
              className="lf-select"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              style={{ width: '100%', height: '36px', fontSize: '13px' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">Available Only</option>
              <option value="SOLD">Sold Only</option>
              <option value="RETURNED">Returned Only</option>
              <option value="DAMAGED">Damaged / Written Off</option>
            </select>
          </div>

          {/* Godown Filter */}
          <div style={{ width: '180px' }}>
            <select
              className="lf-select"
              value={selectedGodown}
              onChange={e => { setSelectedGodown(e.target.value); setCurrentPage(1); }}
              style={{ width: '100%', height: '36px', fontSize: '13px' }}
            >
              <option value="ALL">All Locations / Godowns</option>
              {godownsList.map(g => (
                <option key={g.godown_id} value={g.godown_id}>{g.godown_name}</option>
              ))}
            </select>
          </div>

          {/* Item Filter */}
          <div style={{ width: '200px' }}>
            <select
              className="lf-select"
              value={selectedItem}
              onChange={e => { setSelectedItem(e.target.value); setCurrentPage(1); }}
              style={{ width: '100%', height: '36px', fontSize: '13px' }}
            >
              <option value="ALL">All Items</option>
              {itemsList.filter(it => it.has_serial_no || it.serial_numbers).map(it => (
                <option key={it.item_id} value={it.item_id}>{it.item_name}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="lf-btn lf-btn-primary"
            style={{ height: '36px', padding: '0 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Filter size={14} />
            Filter
          </button>
        </form>
      </div>

      {/* Main Register Table */}
      <div style={{
        backgroundColor: 'var(--bg-card, #FFFFFF)',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle, #E2E8F0)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
            <thead>
              <tr style={{
                backgroundColor: 'var(--bg-card-hover, #F8FAFC)',
                borderBottom: '1px solid var(--border-subtle, #E2E8F0)',
                color: 'var(--text-muted, #64748B)',
                fontWeight: 600,
                fontSize: '11.5px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                <th style={{ padding: '12px 16px' }}>Serial Number</th>
                <th style={{ padding: '12px 16px' }}>Item Name</th>
                <th style={{ padding: '12px 16px' }}>Godown</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Purchase Info</th>
                <th style={{ padding: '12px 16px' }}>Sales / Customer</th>
                <th style={{ padding: '12px 16px' }}>Warranty</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: 'var(--color-primary)' }} />
                    Loading serial number records…
                  </td>
                </tr>
              ) : paginatedSerials.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Barcode size={32} style={{ margin: '0 auto 12px', color: 'var(--text-muted)', opacity: 0.5 }} />
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>No Serialized Units Found</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      Try adjusting filters or record serial numbers during Purchase Entry.
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedSerials.map((s, idx) => (
                  <tr
                    key={s.serialId || `${s.serialNumber}_${idx}`}
                    style={{
                      borderBottom: '1px solid var(--border-subtle, #E2E8F0)',
                      transition: 'background-color 0.15s ease'
                    }}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Barcode size={14} style={{ color: 'var(--color-primary, #F97316)' }} />
                        {s.serialNumber}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.itemName}</div>
                      {(s.sku || s.itemCode) && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {s.sku ? `SKU: ${s.sku}` : `Code: ${s.itemCode}`}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Warehouse size={13} style={{ color: 'var(--text-muted)' }} />
                        {s.godownName}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {getStatusBadge(s.status)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {s.purchaseVoucherNumber ? (
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--color-primary, #F97316)' }}>
                            {s.purchaseVoucherNumber}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {s.purchaseDate || '—'} {s.supplierName ? `• ${s.supplierName}` : ''}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>
                          {s.purchaseDate ? `Opening Stock (${s.purchaseDate})` : 'Opening / Initial'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {s.status === 'SOLD' && s.salesVoucherNumber ? (
                        <div>
                          <div style={{ fontWeight: 500, color: '#6366F1' }}>
                            {s.salesVoucherNumber}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {s.salesDate || '—'} {s.customerName ? `• ${s.customerName}` : ''}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {s.warrantyExpiryDate ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px' }}>
                          <ShieldCheck size={13} style={{ color: '#16A34A' }} />
                          Until {s.warrantyExpiryDate}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>Standard</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenHistory(s)}
                        title="View Unit Lifecycle History"
                        className="lf-btn lf-btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={13} />
                        History
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle, #E2E8F0)',
          fontSize: '12px',
          color: 'var(--text-muted)'
        }}>
          <div>
            Showing {filteredSerials.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to{' '}
            {Math.min(currentPage * rowsPerPage, filteredSerials.length)} of {filteredSerials.length} units
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="lf-btn lf-btn-secondary"
              style={{ padding: '4px 8px', fontSize: '12px', opacity: currentPage <= 1 ? 0.5 : 1 }}
            >
              <ChevronLeft size={14} />
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="lf-btn lf-btn-secondary"
              style={{ padding: '4px 8px', fontSize: '12px', opacity: currentPage >= totalPages ? 0.5 : 1 }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Lifecycle History Modal */}
      {selectedSerialHistory && (
        <div className="vev2-serial-modal-overlay" onClick={() => setSelectedSerialHistory(null)}>
          <div
            className="vev2-serial-modal-card"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '600px', borderRadius: '12px', padding: '24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle, #E2E8F0)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Barcode size={20} style={{ color: 'var(--color-primary, #F97316)' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Unit Lifecycle: {selectedSerialHistory.serial_number || selectedSerialHistory.serialNumber}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {selectedSerialHistory.item_name || selectedSerialHistory.itemName}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSerialHistory(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {historyLoading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                Loading lifecycle details…
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Current State Summary */}
                <div style={{
                  backgroundColor: 'var(--bg-card-hover, #F8FAFC)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Current Status
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      {getStatusBadge(selectedSerialHistory.status)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Godown Location
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {selectedSerialHistory.godown_name || selectedSerialHistory.godownName || 'Main Location'}
                    </div>
                  </div>
                </div>

                {/* Lifecycle Milestones Timeline */}
                <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid var(--border-subtle, #CBD5E1)', marginLeft: '12px' }}>
                  {/* Step 1: Inward / Purchase */}
                  <div style={{ position: 'relative', marginBottom: '20px' }}>
                    <div style={{
                      position: 'absolute',
                      left: '-31px',
                      top: '0',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: '#22C55E',
                      border: '2px solid #FFFFFF'
                    }} />
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Inward Stock Registration
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Date: {selectedSerialHistory.purchase_date || selectedSerialHistory.purchaseDate || 'Initial Stock'}
                    </div>
                    {(selectedSerialHistory.purchase_voucher_number || selectedSerialHistory.purchaseVoucherNumber) && (
                      <div style={{ fontSize: '12px', color: 'var(--color-primary, #F97316)', marginTop: '2px' }}>
                        Voucher: {selectedSerialHistory.purchase_voucher_number || selectedSerialHistory.purchaseVoucherNumber}
                      </div>
                    )}
                    {(selectedSerialHistory.supplier_name || selectedSerialHistory.supplierName) && (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Supplier: {selectedSerialHistory.supplier_name || selectedSerialHistory.supplierName}
                      </div>
                    )}
                  </div>

                  {/* Step 2: Sale / Outward (if sold) */}
                  {selectedSerialHistory.status === 'SOLD' && (
                    <div style={{ position: 'relative', marginBottom: '20px' }}>
                      <div style={{
                        position: 'absolute',
                        left: '-31px',
                        top: '0',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: '#6366F1',
                        border: '2px solid #FFFFFF'
                      }} />
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#6366F1' }}>
                        Sold to Customer
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Sale Date: {selectedSerialHistory.sales_date || selectedSerialHistory.salesDate || '—'}
                      </div>
                      {(selectedSerialHistory.sales_voucher_number || selectedSerialHistory.salesVoucherNumber) && (
                        <div style={{ fontSize: '12px', color: '#6366F1', marginTop: '2px' }}>
                          Invoice: {selectedSerialHistory.sales_voucher_number || selectedSerialHistory.salesVoucherNumber}
                        </div>
                      )}
                      {(selectedSerialHistory.customer_name || selectedSerialHistory.customerName) && (
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Customer: {selectedSerialHistory.customer_name || selectedSerialHistory.customerName}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3: Warranty Details */}
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      left: '-31px',
                      top: '0',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: '#0EA5E9',
                      border: '2px solid #FFFFFF'
                    }} />
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Warranty Protection
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {selectedSerialHistory.warranty_expiry_date || selectedSerialHistory.warrantyExpiryDate
                        ? `Warranty valid through: ${selectedSerialHistory.warranty_expiry_date || selectedSerialHistory.warrantyExpiryDate}`
                        : 'Standard Manufacturer Warranty Policy Applies'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

