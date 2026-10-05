import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  api,
  Company,
  Party,
  CreatePartyPayload,
  UpdatePartyPayload
} from '../api/client';
import { AmountDisplay, formatIndianCurrency } from '../components/accounting/AmountDisplay';
import {
  Users,
  User,
  Package,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  ArrowRight,
  MoreVertical,
  Check,
  ChevronRight,
  FileText,
  FileCheck,
  BookOpen,
  Receipt,
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Info
} from 'lucide-react';

interface PartiesViewProps {
  company: Company | null;
  onOpenNewVoucher?: (type: string, partyId?: string) => void;
  onNavigateReports?: (subTab: string, partyId?: string) => void;
}

// Indian GST States & Codes
const GST_STATES = [
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
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh (New)' },
  { code: '38', name: 'Ladakh' }
];

export const PartiesView: React.FC<PartiesViewProps> = ({
  company,
  onOpenNewVoucher,
  onNavigateReports
}) => {
  // Data state
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'EDIT'>('LIST');
  const [editingParty, setEditingParty] = useState<Party | null>(null);

  // Filter & Search state
  const [activeTab, setActiveTab] = useState<'ALL' | 'CUSTOMERS' | 'SUPPLIERS' | 'OTHERS'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [balanceFilter, setBalanceFilter] = useState<'ALL' | 'RECEIVABLE' | 'PAYABLE' | 'ZERO'>('ALL');
  const [sortField, setSortField] = useState<'name' | 'outstanding'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Selection & Details panel
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [detailsTab, setDetailsTab] = useState<'Overview' | 'Addresses' | 'Contacts' | 'More'>('Overview');

  // Action Menu dropdown state
  const [activeMenuPartyId, setActiveMenuPartyId] = useState<string | null>(null);
  const [deleteConfirmParty, setDeleteConfirmParty] = useState<Party | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // --------------------------------------------------------------------------
  // Form State (for Create & Edit)
  // --------------------------------------------------------------------------
  const [partyType, setPartyType] = useState<'CUSTOMER' | 'SUPPLIER' | 'BOTH'>('CUSTOMER');
  const [partyName, setPartyName] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [status, setStatus] = useState<string>('Active');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [altPhone, setAltPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [website, setWebsite] = useState<string>('');

  // Address
  const [addressTab, setAddressTab] = useState<'billing' | 'shipping' | 'other' | 'notes'>('billing');
  const [addressLine1, setAddressLine1] = useState<string>('');
  const [addressLine2, setAddressLine2] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('Tamil Nadu');
  const [stateCode, setStateCode] = useState<string>('33');
  const [pincode, setPincode] = useState<string>('');

  // Opening Balance
  const [openingBalance, setOpeningBalance] = useState<string>('0');
  const [balanceNature, setBalanceNature] = useState<'DR' | 'CR'>('DR');
  const [asOnDate, setAsOnDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Tax Details
  const [gstRegistered, setGstRegistered] = useState<boolean>(true);
  const [gstin, setGstin] = useState<string>('');
  const [taxTreatment, setTaxTreatment] = useState<string>('Regular');
  const [pan, setPan] = useState<string>('');
  const [placeOfSupply, setPlaceOfSupply] = useState<string>('Tamil Nadu (33)');

  // Credit Details
  const [creditLimit, setCreditLimit] = useState<string>('0');
  const [creditPeriod, setCreditPeriod] = useState<string>('30');
  const [paymentTerms, setPaymentTerms] = useState<string>('30 Days');
  const [allowCredit, setAllowCredit] = useState<boolean>(true);
  const [setDefaultTerms, setSetDefaultTerms] = useState<boolean>(false);

  // Form Validation & Submission
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Load parties from API
  const loadParties = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getParties();
      setParties(data);
      if (data.length > 0 && !selectedPartyId) {
        setSelectedPartyId(data[0].party_id);
      }
    } catch (err: any) {
      console.error('Failed to load parties:', err);
      setError(err.message || 'Failed to load parties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParties();
  }, [company?.company_id]);

  // Toast Auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuPartyId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // --------------------------------------------------------------------------
  // KPI Calculations
  // --------------------------------------------------------------------------
  const metrics = useMemo(() => {
    const total = parties.length;
    const customers = parties.filter(p => p.party_type === 'CUSTOMER' || p.party_type === 'BOTH');
    const suppliers = parties.filter(p => p.party_type === 'SUPPLIER' || p.party_type === 'BOTH');
    const others = parties.filter(p => p.party_type === 'BOTH');

    // Receivables: Positive current_balance_paise (Debit balance)
    let receivablesPaise = 0;
    let receivablesCustomerCount = 0;
    parties.forEach(p => {
      if (p.current_balance_paise > 0) {
        receivablesPaise += p.current_balance_paise;
        receivablesCustomerCount++;
      }
    });

    // Payables: Negative current_balance_paise (Credit balance)
    let payablesPaise = 0;
    let payablesSupplierCount = 0;
    parties.forEach(p => {
      if (p.current_balance_paise < 0) {
        payablesPaise += Math.abs(p.current_balance_paise);
        payablesSupplierCount++;
      }
    });

    return {
      totalCount: total,
      customerCount: customers.length,
      supplierCount: suppliers.length,
      othersCount: others.length,
      receivablesPaise,
      receivablesCustomerCount,
      payablesPaise,
      payablesSupplierCount
    };
  }, [parties]);

  // --------------------------------------------------------------------------
  // Filtered & Sorted Parties
  // --------------------------------------------------------------------------
  const filteredParties = useMemo(() => {
    return parties.filter(party => {
      // Tab filter
      if (activeTab === 'CUSTOMERS') {
        if (party.party_type !== 'CUSTOMER' && party.party_type !== 'BOTH') return false;
      } else if (activeTab === 'SUPPLIERS') {
        if (party.party_type !== 'SUPPLIER' && party.party_type !== 'BOTH') return false;
      } else if (activeTab === 'OTHERS') {
        if (party.party_type !== 'BOTH') return false;
      }

      // Group filter
      if (groupFilter === 'DEBTORS') {
        if (party.party_type === 'SUPPLIER') return false;
      } else if (groupFilter === 'CREDITORS') {
        if (party.party_type === 'CUSTOMER') return false;
      }

      // Balance filter
      if (balanceFilter === 'RECEIVABLE') {
        if (party.current_balance_paise <= 0) return false;
      } else if (balanceFilter === 'PAYABLE') {
        if (party.current_balance_paise >= 0) return false;
      } else if (balanceFilter === 'ZERO') {
        if (party.current_balance_paise !== 0) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = party.party_name.toLowerCase().includes(q);
        const phoneMatch = party.phone ? party.phone.toLowerCase().includes(q) : false;
        const gstinMatch = party.gstin ? party.gstin.toLowerCase().includes(q) : false;
        const cityMatch = party.city ? party.city.toLowerCase().includes(q) : false;
        const emailMatch = party.email ? party.email.toLowerCase().includes(q) : false;
        return nameMatch || phoneMatch || gstinMatch || cityMatch || emailMatch;
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'name') {
        return sortAsc
          ? a.party_name.localeCompare(b.party_name)
          : b.party_name.localeCompare(a.party_name);
      } else {
        return sortAsc
          ? a.current_balance_paise - b.current_balance_paise
          : b.current_balance_paise - a.current_balance_paise;
      }
    });
  }, [parties, activeTab, groupFilter, balanceFilter, searchQuery, sortField, sortAsc]);

  // Paginated parties
  const paginatedParties = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredParties.slice(start, start + pageSize);
  }, [filteredParties, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredParties.length / pageSize) || 1;

  // Selected party object
  const selectedParty = useMemo(() => {
    return parties.find(p => p.party_id === selectedPartyId) || paginatedParties[0] || null;
  }, [parties, selectedPartyId, paginatedParties]);

  // Helper for generating avatar initials and color
  const getAvatarInfo = (name: string) => {
    const parts = name.trim().split(' ');
    let initials = '';
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (name.length > 0) {
      initials = name.substring(0, 2).toUpperCase();
    } else {
      initials = 'PT';
    }

    const colors = ['blue', 'orange', 'purple', 'green', 'rose', 'teal'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % colors.length;
    return { initials, colorClass: `party-avatar-${colors[colorIndex]}` };
  };

  // Helper to format short party code
  const formatPartyCode = (party: Party, index?: number) => {
    const prefix = party.party_type === 'SUPPLIER' ? 'SUP' : 'CUS';
    // Use last 3 chars of ID or numeric representation
    const idClean = party.party_id.replace(/^party_/, '');
    const numPart = idClean.slice(-3).padStart(3, '0').toUpperCase();
    return `${prefix}-${numPart}`;
  };

  // --------------------------------------------------------------------------
  // Form Reset / Initialization
  // --------------------------------------------------------------------------
  const openCreateForm = (typeDefault: 'CUSTOMER' | 'SUPPLIER' | 'BOTH' = 'CUSTOMER') => {
    setEditingParty(null);
    setPartyType(typeDefault);
    setPartyName('');
    setDisplayName('');
    setStatus('Active');
    setContactPerson('');
    setPhone('');
    setAltPhone('');
    setEmail('');
    setWebsite('');
    setAddressTab('billing');
    setAddressLine1('');
    setAddressLine2('');
    setCity('');
    setState('Tamil Nadu');
    setStateCode('33');
    setPincode('');
    setOpeningBalance('0');
    setBalanceNature(typeDefault === 'SUPPLIER' ? 'CR' : 'DR');
    setAsOnDate(new Date().toISOString().split('T')[0]);
    setGstRegistered(true);
    setGstin('');
    setTaxTreatment('Regular');
    setPan('');
    setPlaceOfSupply('Tamil Nadu (33)');
    setCreditLimit('0');
    setCreditPeriod('30');
    setPaymentTerms('30 Days');
    setAllowCredit(true);
    setSetDefaultTerms(false);
    setFormErrors({});
    setServerError(null);
    setViewMode('CREATE');
  };

  const openEditForm = (party: Party) => {
    setEditingParty(party);
    setPartyType(party.party_type);
    setPartyName(party.party_name);
    setDisplayName(party.party_name);
    setStatus('Active');
    setContactPerson(party.contact_person || '');
    setPhone(party.phone || '');
    setAltPhone('');
    setEmail(party.email || '');
    setWebsite('');
    setAddressTab('billing');
    setAddressLine1(party.address_line1 || '');
    setAddressLine2(party.address_line2 || '');
    setCity(party.city || '');
    setState(party.state || 'Tamil Nadu');
    setStateCode(party.state_code || '33');
    setPincode(party.pincode || '');

    const balRupees = (party.opening_balance_paise || 0) / 100;
    setOpeningBalance(String(balRupees));
    setBalanceNature(party.opening_balance_type || (party.party_type === 'SUPPLIER' ? 'CR' : 'DR'));
    setAsOnDate(new Date().toISOString().split('T')[0]);

    setGstRegistered(!!party.gstin);
    setGstin(party.gstin || '');
    setTaxTreatment(party.gstin ? 'Regular' : 'Unregistered');
    setPan(party.pan || '');
    setPlaceOfSupply(party.state ? `${party.state} (${party.state_code || '33'})` : 'Tamil Nadu (33)');

    const limitRupees = (party.credit_limit_paise || 0) / 100;
    setCreditLimit(String(limitRupees));
    setCreditPeriod(String(party.credit_period_days || 30));
    setPaymentTerms('30 Days');
    setAllowCredit(true);
    setSetDefaultTerms(false);
    setFormErrors({});
    setServerError(null);
    setViewMode('EDIT');
  };

  // Handle GSTIN change with automated State & PAN extraction
  const handleGstinChange = (val: string) => {
    const clean = val.toUpperCase().trim();
    setGstin(clean);

    if (clean.length >= 2) {
      const code = clean.substring(0, 2);
      const matchedState = GST_STATES.find(s => s.code === code);
      if (matchedState) {
        setState(matchedState.name);
        setStateCode(matchedState.code);
        setPlaceOfSupply(`${matchedState.name} (${matchedState.code})`);
      }
    }

    if (clean.length === 15) {
      const derivedPan = clean.substring(2, 12);
      setPan(derivedPan);
    }
  };

  // Validate form fields
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!partyName.trim()) {
      errors.partyName = 'Party Name is required.';
    }

    if (phone && phone.trim()) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        errors.phone = 'Please enter a valid 10-digit phone number.';
      }
    }

    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = 'Please enter a valid email address.';
      }
    }

    if (gstRegistered && gstin && gstin.trim()) {
      const gstinClean = gstin.trim().toUpperCase();
      if (gstinClean.length !== 15) {
        errors.gstin = 'GSTIN must be exactly 15 alphanumeric characters.';
      }
    }

    const opBalNum = parseFloat(openingBalance);
    if (isNaN(opBalNum) || opBalNum < 0) {
      errors.openingBalance = 'Opening balance must be 0 or a positive number.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Save Party (Create or Edit)
  const handleSaveParty = async (isSaveAndNew: boolean = false) => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    const openingBalancePaise = Math.round(parseFloat(openingBalance || '0') * 100);

    const payload: CreatePartyPayload = {
      partyName: partyName.trim(),
      partyType,
      gstin: gstRegistered && gstin.trim() ? gstin.trim().toUpperCase() : undefined,
      pan: pan.trim() ? pan.trim().toUpperCase() : undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      contactPerson: contactPerson.trim() || undefined,
      addressLine1: addressLine1.trim() || undefined,
      addressLine2: addressLine2.trim() || undefined,
      city: city.trim() || undefined,
      state: state || 'Tamil Nadu',
      stateCode: stateCode || '33',
      pincode: pincode.trim() || undefined,
      openingBalancePaise
    };

    try {
      if (viewMode === 'CREATE') {
        const res = await api.createParty(payload);
        setToast({ message: `Party "${payload.partyName}" created successfully.`, type: 'success' });
        await loadParties();
        if (res.partyId) {
          setSelectedPartyId(res.partyId);
        }

        if (isSaveAndNew) {
          openCreateForm(partyType);
        } else {
          setViewMode('LIST');
        }
      } else if (viewMode === 'EDIT' && editingParty) {
        const updatePayload: UpdatePartyPayload = {
          ...payload
        };
        await api.updateParty(editingParty.party_id, updatePayload);
        setToast({ message: `Party "${payload.partyName}" updated successfully.`, type: 'success' });
        await loadParties();
        setSelectedPartyId(editingParty.party_id);
        setViewMode('LIST');
      }
    } catch (err: any) {
      console.error('Failed to save party:', err);
      setServerError(err.message || 'Failed to save party. Please check details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Safe Deletion
  const handleDeleteParty = async () => {
    if (!deleteConfirmParty) return;

    try {
      setIsDeleting(true);
      await api.deleteParty(deleteConfirmParty.party_id);
      setToast({ message: `Party "${deleteConfirmParty.party_name}" deleted successfully.`, type: 'success' });
      setDeleteConfirmParty(null);
      await loadParties();
    } catch (err: any) {
      console.error('Delete party failed:', err);
      setToast({
        message: err.message || `Cannot delete party with existing transactions or opening balance.`,
        type: 'error'
      });
      setDeleteConfirmParty(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // --------------------------------------------------------------------------
  // RENDER: Party Creation / Edit View
  // --------------------------------------------------------------------------
  if (viewMode === 'CREATE' || viewMode === 'EDIT') {
    const isEdit = viewMode === 'EDIT';
    return (
      <div className="party-form-container">
        {/* Toast feedback */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              padding: '12px 20px',
              borderRadius: '8px',
              background: toast.type === 'error' ? '#DC2626' : '#059669',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 9999,
              fontSize: '13.5px',
              fontWeight: 500
            }}
          >
            {toast.message}
          </div>
        )}

        {/* Form Header */}
        <div className="party-form-header">
          <div className="party-form-title">
            <div className="party-form-breadcrumb">
              <span className="party-form-breadcrumb-link" onClick={() => setViewMode('LIST')}>
                Parties
              </span>
              <span>&gt;</span>
              <span>{isEdit ? 'Edit' : 'Create'}</span>
            </div>
            <h1>{isEdit ? `Edit Party: ${editingParty?.party_name}` : 'Create New Party'}</h1>
            <p>
              {isEdit
                ? 'Update customer, supplier or party details in your business.'
                : 'Add a new customer, supplier or other party to your business.'}
            </p>
          </div>

          <div className="party-form-actions">
            <button
              type="button"
              className="parties-filter-btn"
              onClick={() => setViewMode('LIST')}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="parties-add-btn"
              onClick={() => handleSaveParty(false)}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Party'}
              <ChevronDown size={14} />
            </button>
          </div>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '8px',
              background: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              color: '#DC2626',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13.5px'
            }}
          >
            <AlertCircle size={18} />
            <span>{serverError}</span>
          </div>
        )}

        {/* 2-Column Form Layout matching Party Creation.png */}
        <div className="party-form-grid">
          {/* Left Column (62%) */}
          <div className="party-form-col-left">
            {/* Card 1: Party Type */}
            <div className="party-form-card">
              <div className="party-form-card-title">
                <Users size={18} className="icon" />
                <span>Party Type</span>
              </div>

              <div className="party-type-selector">
                {/* Customer */}
                <div
                  className={`party-type-card ${partyType === 'CUSTOMER' ? 'selected' : ''}`}
                  onClick={() => {
                    setPartyType('CUSTOMER');
                    setBalanceNature('DR');
                  }}
                >
                  <div className="party-type-card-top">
                    <User size={22} className="party-type-card-icon" />
                    <div className="party-type-radio">
                      {partyType === 'CUSTOMER' && <div className="party-type-radio-inner" />}
                    </div>
                  </div>
                  <div className="party-type-name">Customer</div>
                  <div className="party-type-desc">Buys goods or services from you</div>
                </div>

                {/* Supplier */}
                <div
                  className={`party-type-card ${partyType === 'SUPPLIER' ? 'selected' : ''}`}
                  onClick={() => {
                    setPartyType('SUPPLIER');
                    setBalanceNature('CR');
                  }}
                >
                  <div className="party-type-card-top">
                    <Package size={22} className="party-type-card-icon" />
                    <div className="party-type-radio">
                      {partyType === 'SUPPLIER' && <div className="party-type-radio-inner" />}
                    </div>
                  </div>
                  <div className="party-type-name">Supplier</div>
                  <div className="party-type-desc">Supplies goods or services to you</div>
                </div>

                {/* Both */}
                <div
                  className={`party-type-card ${partyType === 'BOTH' ? 'selected' : ''}`}
                  onClick={() => {
                    setPartyType('BOTH');
                  }}
                >
                  <div className="party-type-card-top">
                    <Users size={22} className="party-type-card-icon" />
                    <div className="party-type-radio">
                      {partyType === 'BOTH' && <div className="party-type-radio-inner" />}
                    </div>
                  </div>
                  <div className="party-type-name">Both</div>
                  <div className="party-type-desc">Acts as both customer and supplier</div>
                </div>
              </div>
            </div>

            {/* Card 2: Basic Details */}
            <div className="party-form-card">
              <div className="party-form-card-title">
                <User size={18} className="icon" />
                <span>Basic Details</span>
              </div>

              {/* Row 1: Party Name & Display Name */}
              <div className="party-form-row party-form-row-2">
                <div className="party-field-group">
                  <label className="party-field-label">
                    Party Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className={`party-input ${formErrors.partyName ? 'has-error' : ''}`}
                    placeholder="e.g. ABC Enterprises"
                    value={partyName}
                    onChange={(e) => {
                      setPartyName(e.target.value);
                      if (!displayName) setDisplayName(e.target.value);
                      if (formErrors.partyName) {
                        setFormErrors(prev => ({ ...prev, partyName: '' }));
                      }
                    }}
                  />
                  {formErrors.partyName && (
                    <div className="party-field-error">{formErrors.partyName}</div>
                  )}
                </div>

                <div className="party-field-group">
                  <label className="party-field-label">Display Name (Optional)</label>
                  <input
                    type="text"
                    className="party-input"
                    placeholder="e.g. ABC Enterprises"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </div>

              {/* Row 2: Group & Code & Status */}
              <div className="party-form-row party-form-row-3">
                <div className="party-field-group">
                  <label className="party-field-label">
                    Group <span className="required">*</span>
                  </label>
                  <select
                    className="party-select"
                    value={partyType === 'SUPPLIER' ? 'Sundry Creditors' : 'Sundry Debtors'}
                    disabled
                  >
                    <option value="Sundry Debtors">Sundry Debtors (Customers)</option>
                    <option value="Sundry Creditors">Sundry Creditors (Suppliers)</option>
                  </select>
                </div>

                <div className="party-field-group">
                  <label className="party-field-label">Party Code (Auto)</label>
                  <input
                    type="text"
                    className="party-input"
                    value={
                      isEdit && editingParty
                        ? formatPartyCode(editingParty)
                        : `${partyType === 'SUPPLIER' ? 'SUP' : 'CUS'}-${String(parties.length + 1).padStart(3, '0')}`
                    }
                    disabled
                  />
                </div>

                <div className="party-field-group">
                  <label className="party-field-label">Status</label>
                  <select
                    className="party-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Contact Person & Phone & Alt Phone */}
              <div className="party-form-row party-form-row-3">
                <div className="party-field-group">
                  <label className="party-field-label">Contact Person</label>
                  <input
                    type="text"
                    className="party-input"
                    placeholder="e.g. Ramakrishnan"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                  />
                </div>

                <div className="party-field-group">
                  <label className="party-field-label">Phone</label>
                  <input
                    type="text"
                    className={`party-input ${formErrors.phone ? 'has-error' : ''}`}
                    placeholder="e.g. +91 98765 43210"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: '' }));
                    }}
                  />
                  {formErrors.phone && <div className="party-field-error">{formErrors.phone}</div>}
                </div>

                <div className="party-field-group">
                  <label className="party-field-label">Alternate Phone (Optional)</label>
                  <input
                    type="text"
                    className="party-input"
                    placeholder="e.g. +91 91234 56789"
                    value={altPhone}
                    onChange={(e) => setAltPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Row 4: Email & Website */}
              <div className="party-form-row party-form-row-2">
                <div className="party-field-group">
                  <label className="party-field-label">Email (Optional)</label>
                  <input
                    type="email"
                    className={`party-input ${formErrors.email ? 'has-error' : ''}`}
                    placeholder="e.g. abc@enterprises.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' }));
                    }}
                  />
                  {formErrors.email && <div className="party-field-error">{formErrors.email}</div>}
                </div>

                <div className="party-field-group">
                  <label className="party-field-label">Website (Optional)</label>
                  <input
                    type="text"
                    className="party-input"
                    placeholder="e.g. www.abcenterprises.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Address Details (with tabs) */}
            <div className="party-form-card">
              <div className="party-address-tabs">
                <button
                  type="button"
                  className={`party-address-tab-btn ${addressTab === 'billing' ? 'active' : ''}`}
                  onClick={() => setAddressTab('billing')}
                >
                  <MapPin size={14} />
                  <span>Billing Address</span>
                </button>
                <button
                  type="button"
                  className={`party-address-tab-btn ${addressTab === 'shipping' ? 'active' : ''}`}
                  onClick={() => setAddressTab('shipping')}
                >
                  <Package size={14} />
                  <span>Shipping Address</span>
                </button>
                <button
                  type="button"
                  className={`party-address-tab-btn ${addressTab === 'other' ? 'active' : ''}`}
                  onClick={() => setAddressTab('other')}
                >
                  <span>Other Details</span>
                </button>
                <button
                  type="button"
                  className={`party-address-tab-btn ${addressTab === 'notes' ? 'active' : ''}`}
                  onClick={() => setAddressTab('notes')}
                >
                  <span>Notes</span>
                </button>
              </div>

              {addressTab === 'billing' && (
                <>
                  <div className="party-form-row party-form-row-2">
                    <div className="party-field-group">
                      <label className="party-field-label">
                        Address Line 1 <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        className="party-input"
                        placeholder="e.g. No. 12, Main Road"
                        value={addressLine1}
                        onChange={(e) => setAddressLine1(e.target.value)}
                      />
                    </div>

                    <div className="party-field-group">
                      <label className="party-field-label">Address Line 2 (Optional)</label>
                      <input
                        type="text"
                        className="party-input"
                        placeholder="e.g. Gandhipuram"
                        value={addressLine2}
                        onChange={(e) => setAddressLine2(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="party-form-row party-form-row-3">
                    <div className="party-field-group">
                      <label className="party-field-label">
                        City <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        className="party-input"
                        placeholder="e.g. Coimbatore"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>

                    <div className="party-field-group">
                      <label className="party-field-label">
                        State <span className="required">*</span>
                      </label>
                      <select
                        className="party-select"
                        value={stateCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          const found = GST_STATES.find(s => s.code === code);
                          if (found) {
                            setState(found.name);
                            setStateCode(found.code);
                            setPlaceOfSupply(`${found.name} (${found.code})`);
                          }
                        }}
                      >
                        {GST_STATES.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="party-field-group">
                      <label className="party-field-label">
                        Pincode <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        className="party-input"
                        placeholder="e.g. 641012"
                        maxLength={6}
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {addressTab === 'shipping' && (
                <div style={{ padding: '10px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <p style={{ margin: '0 0 12px 0' }}>
                    Shipping address is automatically mirrored from the billing address in standard invoices.
                  </p>
                  <div className="party-field-group">
                    <label className="party-field-label">Shipping Address Override (Optional)</label>
                    <input
                      type="text"
                      className="party-input"
                      placeholder="Same as Billing Address"
                      disabled
                    />
                  </div>
                </div>
              )}

              {addressTab === 'other' && (
                <div style={{ padding: '10px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <div className="party-field-group">
                    <label className="party-field-label">Delivery Note / Transport Preferences</label>
                    <input
                      type="text"
                      className="party-input"
                      placeholder="e.g. Standard Roadways Cargo"
                    />
                  </div>
                </div>
              )}

              {addressTab === 'notes' && (
                <div style={{ padding: '10px 0' }}>
                  <div className="party-field-group">
                    <label className="party-field-label">Internal Account Notes</label>
                    <textarea
                      className="party-textarea"
                      placeholder="Add any internal business notes for this party..."
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (38%) */}
          <div className="party-form-col-right">
            {/* Card 1: Opening Balance */}
            <div className="party-form-card">
              <div className="party-form-card-title">
                <Receipt size={18} className="icon" />
                <span>Opening Balance (Optional)</span>
              </div>

              <div className="party-form-row party-form-row-2">
                <div className="party-field-group">
                  <label className="party-field-label">Opening Balance</label>
                  <div style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        fontWeight: 600
                      }}
                    >
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={`party-input ${formErrors.openingBalance ? 'has-error' : ''}`}
                      style={{ paddingLeft: '28px' }}
                      value={openingBalance}
                      onChange={(e) => {
                        setOpeningBalance(e.target.value);
                        if (formErrors.openingBalance) {
                          setFormErrors(prev => ({ ...prev, openingBalance: '' }));
                        }
                      }}
                    />
                  </div>
                  {formErrors.openingBalance && (
                    <div className="party-field-error">{formErrors.openingBalance}</div>
                  )}
                </div>

                <div className="party-field-group">
                  <label className="party-field-label">Balance Nature</label>
                  <select
                    className="party-select"
                    value={balanceNature}
                    onChange={(e) => setBalanceNature(e.target.value as 'DR' | 'CR')}
                  >
                    <option value="DR">Receivable (Dr)</option>
                    <option value="CR">Payable (Cr)</option>
                  </select>
                </div>
              </div>

              <div className="party-field-group" style={{ marginTop: '10px' }}>
                <label className="party-field-label">As on Date</label>
                <input
                  type="date"
                  className="party-input"
                  value={asOnDate}
                  onChange={(e) => setAsOnDate(e.target.value)}
                />
              </div>

              <div className="party-info-banner">
                <Info size={16} className="icon" />
                <span>
                  Use opening balance only if the party already has an outstanding amount with you.
                </span>
              </div>
            </div>

            {/* Card 2: Tax Details */}
            <div className="party-form-card">
              <div className="party-form-card-title">
                <FileText size={18} className="icon" />
                <span>Tax Details</span>
              </div>

              <div className="party-form-row party-form-row-2" style={{ alignItems: 'flex-end' }}>
                <div className="party-field-group">
                  <label className="party-field-label">GST Registered</label>
                  <div className="party-toggle-group">
                    <button
                      type="button"
                      className={`party-toggle-btn ${gstRegistered ? 'active' : ''}`}
                      onClick={() => setGstRegistered(true)}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={`party-toggle-btn ${!gstRegistered ? 'active' : ''}`}
                      onClick={() => {
                        setGstRegistered(false);
                        setGstin('');
                      }}
                    >
                      No
                    </button>
                  </div>
                </div>

                <div className="party-field-group">
                  <label className="party-field-label">GSTIN</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className={`party-input ${formErrors.gstin ? 'has-error' : ''}`}
                      placeholder="e.g. 33ABCDE1234F1Z5"
                      maxLength={15}
                      value={gstin}
                      disabled={!gstRegistered}
                      onChange={(e) => handleGstinChange(e.target.value)}
                    />
                    <Search
                      size={15}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)'
                      }}
                    />
                  </div>
                  {formErrors.gstin && <div className="party-field-error">{formErrors.gstin}</div>}
                </div>
              </div>

              <div className="party-form-row party-form-row-2" style={{ marginTop: '10px' }}>
                <div className="party-field-group">
                  <label className="party-field-label">
                    State <span className="required">*</span>
                  </label>
                  <select
                    className="party-select"
                    value={stateCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      const found = GST_STATES.find(s => s.code === code);
                      if (found) {
                        setState(found.name);
                        setStateCode(found.code);
                        setPlaceOfSupply(`${found.name} (${found.code})`);
                      }
                    }}
                  >
                    {GST_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="party-field-group">
                  <label className="party-field-label">
                    Place of Supply <span className="required">*</span>
                  </label>
                  <select
                    className="party-select"
                    value={placeOfSupply}
                    onChange={(e) => setPlaceOfSupply(e.target.value)}
                  >
                    {GST_STATES.map((s) => (
                      <option key={s.code} value={`${s.name} (${s.code})`}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="party-form-row party-form-row-2" style={{ marginTop: '10px' }}>
                <div className="party-field-group">
                  <label className="party-field-label">Tax Treatment</label>
                  <select
                    className="party-select"
                    value={taxTreatment}
                    onChange={(e) => setTaxTreatment(e.target.value)}
                  >
                    <option value="Regular">Regular</option>
                    <option value="Composition">Composition</option>
                    <option value="Consumer">Consumer</option>
                    <option value="Unregistered">Unregistered</option>
                  </select>
                </div>

                <div className="party-field-group">
                  <label className="party-field-label">PAN (Optional)</label>
                  <input
                    type="text"
                    className="party-input"
                    placeholder="e.g. ABCDE1234F"
                    maxLength={10}
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Credit & Payment Details */}
            <div className="party-form-card">
              <div className="party-form-card-title">
                <CreditCard size={18} className="icon" />
                <span>Credit & Payment Details</span>
              </div>

              <div className="party-form-row party-form-row-2">
                <div className="party-field-group">
                  <label className="party-field-label">Credit Limit (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="party-input"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                  />
                </div>

                <div className="party-field-group">
                  <label className="party-field-label">Credit Period (Days)</label>
                  <input
                    type="number"
                    min="0"
                    className="party-input"
                    value={creditPeriod}
                    onChange={(e) => setCreditPeriod(e.target.value)}
                  />
                </div>
              </div>

              <div className="party-form-row party-form-row-2" style={{ marginTop: '10px' }}>
                <div className="party-field-group">
                  <label className="party-field-label">Payment Terms</label>
                  <select
                    className="party-select"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                  >
                    <option value="Immediate">Immediate / Due on Receipt</option>
                    <option value="15 Days">15 Days</option>
                    <option value="30 Days">30 Days</option>
                    <option value="45 Days">45 Days</option>
                    <option value="60 Days">60 Days</option>
                  </select>
                </div>

                <div className="party-field-group">
                  <label className="party-field-label">Price List (Optional)</label>
                  <select className="party-select" defaultValue="Retail Price">
                    <option value="Retail Price">Retail Price</option>
                    <option value="Wholesale Price">Wholesale Price</option>
                    <option value="Dealer Price">Dealer Price</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={allowCredit}
                    onChange={(e) => setAllowCredit(e.target.checked)}
                    style={{ accentColor: 'var(--color-primary, #F97316)', width: '16px', height: '16px' }}
                  />
                  <span>Allow this party for credit transactions</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={setDefaultTerms}
                    onChange={(e) => setSetDefaultTerms(e.target.checked)}
                    style={{ accentColor: 'var(--color-primary, #F97316)', width: '16px', height: '16px' }}
                  />
                  <span>Set default payment terms for this party</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="party-bottom-actions">
          {!isEdit && (
            <button
              type="button"
              className="parties-filter-btn"
              onClick={() => handleSaveParty(true)}
              disabled={isSubmitting}
            >
              Save &amp; New
            </button>
          )}
          <button
            type="button"
            className="parties-add-btn"
            onClick={() => handleSaveParty(false)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Party'}
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: Parties Dashboard View (Matches Parties Dashboard.png)
  // --------------------------------------------------------------------------
  return (
    <div className="parties-view-container">
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            background: toast.type === 'error' ? '#DC2626' : '#059669',
            color: '#FFFFFF',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999,
            fontSize: '13.5px',
            fontWeight: 500
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmParty && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setDeleteConfirmParty(null)}
        >
          <div
            className="ledger-card"
            style={{
              width: '420px',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626'
                }}
              >
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>Delete Party</h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  This action removes the party master record.
                </p>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: '20px' }}>
              Are you sure you want to delete <strong>{deleteConfirmParty.party_name}</strong>?
              {deleteConfirmParty.current_balance_paise !== 0 && (
                <span style={{ display: 'block', marginTop: '8px', color: '#DC2626', fontSize: '12.5px' }}>
                  Note: Parties with existing transactions, vouchers or opening balance cannot be deleted.
                </span>
              )}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="parties-filter-btn"
                onClick={() => setDeleteConfirmParty(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                onClick={handleDeleteParty}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="parties-header">
        <div className="parties-header-left">
          <h1>Parties</h1>
          <p>Manage your customers, suppliers and other parties.</p>
        </div>

        <div className="parties-header-actions">
          {/* Search Input */}
          <div className="parties-search-box">
            <input
              type="text"
              placeholder="Search by name, phone, GSTIN, city..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            <Search size={16} className="parties-search-icon" />
          </div>

          {/* Balance Filter dropdown */}
          <select
            className="parties-group-select"
            value={balanceFilter}
            onChange={(e) => {
              setBalanceFilter(e.target.value as any);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">All Balances</option>
            <option value="RECEIVABLE">Receivables Only</option>
            <option value="PAYABLE">Payables Only</option>
            <option value="ZERO">Zero Balance</option>
          </select>

          {/* Group Filter dropdown */}
          <select
            className="parties-group-select"
            value={groupFilter}
            onChange={(e) => {
              setGroupFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">All Groups</option>
            <option value="DEBTORS">Sundry Debtors</option>
            <option value="CREDITORS">Sundry Creditors</option>
          </select>

          {/* Add Party Button */}
          <button
            type="button"
            className="parties-add-btn"
            onClick={() => openCreateForm('CUSTOMER')}
          >
            <Plus size={16} />
            <span>Add Party</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="parties-kpi-grid">
        {/* Total Parties */}
        <div
          className="parties-kpi-card"
          onClick={() => {
            setActiveTab('ALL');
            setCurrentPage(1);
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="parties-kpi-icon-wrap parties-kpi-icon-blue">
            <Users size={22} />
          </div>
          <div className="parties-kpi-body">
            <div className="parties-kpi-label">Total Parties</div>
            <div className="parties-kpi-value-row">
              <span className="parties-kpi-value">{metrics.totalCount}</span>
              {metrics.totalCount > 0 && <span className="parties-kpi-trend">↑ 12%</span>}
            </div>
            <div className="parties-kpi-subtext">All Customers &amp; Suppliers</div>
          </div>
        </div>

        {/* Customers */}
        <div
          className="parties-kpi-card"
          onClick={() => {
            setActiveTab('CUSTOMERS');
            setCurrentPage(1);
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="parties-kpi-icon-wrap parties-kpi-icon-green">
            <User size={22} />
          </div>
          <div className="parties-kpi-body">
            <div className="parties-kpi-label">Customers</div>
            <div className="parties-kpi-value-row">
              <span className="parties-kpi-value">{metrics.customerCount}</span>
              {metrics.customerCount > 0 && <span className="parties-kpi-trend">↑ 8%</span>}
            </div>
            <div className="parties-kpi-subtext">Active Customers</div>
          </div>
        </div>

        {/* Suppliers */}
        <div
          className="parties-kpi-card"
          onClick={() => {
            setActiveTab('SUPPLIERS');
            setCurrentPage(1);
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="parties-kpi-icon-wrap parties-kpi-icon-orange">
            <Package size={22} />
          </div>
          <div className="parties-kpi-body">
            <div className="parties-kpi-label">Suppliers</div>
            <div className="parties-kpi-value-row">
              <span className="parties-kpi-value">{metrics.supplierCount}</span>
              {metrics.supplierCount > 0 && <span className="parties-kpi-trend">↑ 21%</span>}
            </div>
            <div className="parties-kpi-subtext">Active Suppliers</div>
          </div>
        </div>

        {/* Receivables */}
        <div
          className="parties-kpi-card"
          onClick={() => {
            setBalanceFilter('RECEIVABLE');
            setCurrentPage(1);
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="parties-kpi-icon-wrap parties-kpi-icon-red">
            <Receipt size={22} />
          </div>
          <div className="parties-kpi-body">
            <div className="parties-kpi-label">Receivables</div>
            <div className="parties-kpi-value-row">
              <span className="parties-kpi-value" style={{ color: '#DC2626' }}>
                ₹ {formatIndianCurrency(metrics.receivablesPaise / 100)}
              </span>
            </div>
            <div className="parties-kpi-subtext">
              {metrics.receivablesCustomerCount > 0
                ? `From ${metrics.receivablesCustomerCount} Customers`
                : 'No pending receivables'}
            </div>
          </div>
          <ArrowRight size={16} className="parties-kpi-arrow" />
        </div>

        {/* Payables */}
        <div
          className="parties-kpi-card"
          onClick={() => {
            setBalanceFilter('PAYABLE');
            setCurrentPage(1);
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="parties-kpi-icon-wrap parties-kpi-icon-blue">
            <CreditCard size={22} />
          </div>
          <div className="parties-kpi-body">
            <div className="parties-kpi-label">Payables</div>
            <div className="parties-kpi-value-row">
              <span className="parties-kpi-value" style={{ color: '#2563EB' }}>
                ₹ {formatIndianCurrency(metrics.payablesPaise / 100)}
              </span>
            </div>
            <div className="parties-kpi-subtext">
              {metrics.payablesSupplierCount > 0
                ? `To ${metrics.payablesSupplierCount} Suppliers`
                : 'No pending payables'}
            </div>
          </div>
          <ArrowRight size={16} className="parties-kpi-arrow" />
        </div>
      </div>

      {/* Tab Filters Bar */}
      <div className="parties-tabs-bar">
        <button
          type="button"
          className={`parties-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('ALL');
            setCurrentPage(1);
          }}
        >
          <span>All Parties</span>
          <span className="parties-tab-badge">{metrics.totalCount}</span>
        </button>

        <button
          type="button"
          className={`parties-tab-btn ${activeTab === 'CUSTOMERS' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('CUSTOMERS');
            setCurrentPage(1);
          }}
        >
          <span>Customers</span>
          <span className="parties-tab-badge">{metrics.customerCount}</span>
        </button>

        <button
          type="button"
          className={`parties-tab-btn ${activeTab === 'SUPPLIERS' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('SUPPLIERS');
            setCurrentPage(1);
          }}
        >
          <span>Suppliers</span>
          <span className="parties-tab-badge">{metrics.supplierCount}</span>
        </button>

        <button
          type="button"
          className={`parties-tab-btn ${activeTab === 'OTHERS' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('OTHERS');
            setCurrentPage(1);
          }}
        >
          <span>Others</span>
          <span className="parties-tab-badge">{metrics.othersCount}</span>
        </button>
      </div>

      {/* Main Split Layout: Table (72%) + Details Quick-View (28%) */}
      <div className="parties-main-split">
        {/* Left Side: Table Card */}
        <div className="parties-table-card">
          <div className="parties-table-wrapper">
            <table className="parties-table">
              <thead>
                <tr>
                  <th style={{ width: '36px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      style={{ accentColor: 'var(--color-primary, #F97316)' }}
                    />
                  </th>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (sortField === 'name') setSortAsc(!sortAsc);
                      else {
                        setSortField('name');
                        setSortAsc(true);
                      }
                    }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span>Party Name</span>
                      <ArrowUpDown size={13} />
                    </div>
                  </th>
                  <th>Type</th>
                  <th>Phone</th>
                  <th>City</th>
                  <th>GSTIN</th>
                  <th
                    style={{ textAlign: 'right', cursor: 'pointer' }}
                    onClick={() => {
                      if (sortField === 'outstanding') setSortAsc(!sortAsc);
                      else {
                        setSortField('outstanding');
                        setSortAsc(false);
                      }
                    }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                      <span>Outstanding ₹</span>
                      <ArrowUpDown size={13} />
                    </div>
                  </th>
                  <th>Status</th>
                  <th style={{ width: '40px', textAlign: 'center' }}>•••</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>Loading parties...</div>
                    </td>
                  </tr>
                ) : paginatedParties.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px 24px' }}>
                      <div style={{ maxWidth: '340px', margin: '0 auto' }}>
                        {searchQuery ? (
                          <>
                            <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '6px' }}>
                              No parties found
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                              No parties match your search query "{searchQuery}".
                            </p>
                            <button
                              type="button"
                              className="parties-filter-btn"
                              onClick={() => setSearchQuery('')}
                            >
                              Clear search
                            </button>
                          </>
                        ) : (
                          <>
                            <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '6px' }}>
                              No parties yet
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                              Add your first customer or supplier to start managing transactions.
                            </p>
                            <button
                              type="button"
                              className="parties-add-btn"
                              onClick={() => openCreateForm('CUSTOMER')}
                            >
                              <Plus size={16} />
                              <span>+ Add Party</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedParties.map((party, idx) => {
                    const avatar = getAvatarInfo(party.party_name);
                    const isSelected = party.party_id === selectedPartyId;
                    const balPaise = party.current_balance_paise || 0;
                    const balRupees = balPaise / 100;
                    const code = formatPartyCode(party, idx);

                    return (
                      <tr
                        key={party.party_id}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => setSelectedPartyId(party.party_id)}
                      >
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            style={{ accentColor: 'var(--color-primary, #F97316)' }}
                          />
                        </td>

                        <td>
                          <div className="party-cell-name">
                            <div className={`party-avatar ${avatar.colorClass}`}>
                              {avatar.initials}
                            </div>
                            <div>
                              <div className="party-name-title">{party.party_name}</div>
                              <div className="party-name-code">{code}</div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`party-badge-type ${
                              party.party_type === 'CUSTOMER'
                                ? 'party-badge-customer'
                                : party.party_type === 'SUPPLIER'
                                ? 'party-badge-supplier'
                                : 'party-badge-both'
                            }`}
                          >
                            {party.party_type === 'CUSTOMER'
                              ? 'Customer'
                              : party.party_type === 'SUPPLIER'
                              ? 'Supplier'
                              : 'Both'}
                          </span>
                        </td>

                        <td>{party.phone || '-'}</td>
                        <td>{party.city || '-'}</td>
                        <td>{party.gstin || 'NA'}</td>

                        <td style={{ textAlign: 'right' }}>
                          {balPaise > 0 ? (
                            <span className="party-amount-receivable">
                              {formatIndianCurrency(balRupees)}
                            </span>
                          ) : balPaise < 0 ? (
                            <span className="party-amount-payable">
                              {formatIndianCurrency(balRupees)}
                            </span>
                          ) : (
                            <span className="party-amount-zero">0</span>
                          )}
                        </td>

                        <td>
                          <span className="party-badge-status-active">Active</span>
                        </td>

                        <td style={{ textAlign: 'center', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="party-action-btn"
                            title="More actions"
                            onClick={() => {
                              setActiveMenuPartyId(activeMenuPartyId === party.party_id ? null : party.party_id);
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>

                          {activeMenuPartyId === party.party_id && (
                            <div className="party-menu-dropdown">
                              <button
                                type="button"
                                className="party-menu-item"
                                onClick={() => {
                                  setActiveMenuPartyId(null);
                                  openEditForm(party);
                                }}
                              >
                                <span>Edit Party</span>
                              </button>

                              {onOpenNewVoucher && (
                                <>
                                  <button
                                    type="button"
                                    className="party-menu-item"
                                    onClick={() => {
                                      setActiveMenuPartyId(null);
                                      onOpenNewVoucher('SALES', party.party_id);
                                    }}
                                  >
                                    <span>Create Sales Invoice</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="party-menu-item"
                                    onClick={() => {
                                      setActiveMenuPartyId(null);
                                      onOpenNewVoucher('PURCHASE', party.party_id);
                                    }}
                                  >
                                    <span>Create Purchase Bill</span>
                                  </button>
                                </>
                              )}

                              {onNavigateReports && (
                                <button
                                  type="button"
                                  className="party-menu-item"
                                  onClick={() => {
                                    setActiveMenuPartyId(null);
                                    onNavigateReports('ledger', party.party_id);
                                  }}
                                >
                                  <span>View Ledger</span>
                                </button>
                              )}

                              <button
                                type="button"
                                className="party-menu-item danger"
                                onClick={() => {
                                  setActiveMenuPartyId(null);
                                  setDeleteConfirmParty(party);
                                }}
                              >
                                <span>Delete Party</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="parties-pagination">
            <div>
              Showing {filteredParties.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, filteredParties.length)} of {filteredParties.length} parties
            </div>

            <div className="parties-pagination-controls">
              <button
                type="button"
                className="parties-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                &lt;
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`parties-page-btn ${currentPage === page ? 'active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}

              {totalPages > 5 && (
                <>
                  <span style={{ padding: '0 4px', color: 'var(--text-muted)' }}>...</span>
                  <button
                    type="button"
                    className={`parties-page-btn ${currentPage === totalPages ? 'active' : ''}`}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    {totalPages}
                  </button>
                </>
              )}

              <button
                type="button"
                className="parties-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                &gt;
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Details Panel (~28%) */}
        {selectedParty ? (
          <div className="party-details-card">
            {/* Header with Avatar, Name, Code, Status, and Menu */}
            <div className="party-details-header">
              <div className="party-details-profile">
                {(() => {
                  const avatar = getAvatarInfo(selectedParty.party_name);
                  return (
                    <div className={`party-details-avatar ${avatar.colorClass}`}>
                      {avatar.initials}
                    </div>
                  );
                })()}
                <div className="party-details-info">
                  <h2>{selectedParty.party_name}</h2>
                  <div className="party-details-code">{formatPartyCode(selectedParty)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="party-badge-status-active">Active</span>
                <button
                  type="button"
                  className="party-action-btn"
                  title="Edit Party"
                  onClick={() => openEditForm(selectedParty)}
                >
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>

            {/* Sub-tabs: Overview | Addresses | Contacts | More */}
            <div className="party-details-tabs">
              {(['Overview', 'Addresses', 'Contacts', 'More'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`party-details-tab-btn ${detailsTab === tab ? 'active' : ''}`}
                  onClick={() => setDetailsTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab: Overview */}
            {detailsTab === 'Overview' && (
              <div className="party-details-fields">
                <div className="party-detail-row">
                  <div className="party-detail-label">
                    <User size={14} />
                    <span>Type</span>
                  </div>
                  <div className="party-detail-value">
                    {selectedParty.party_type === 'CUSTOMER'
                      ? 'Customer'
                      : selectedParty.party_type === 'SUPPLIER'
                      ? 'Supplier'
                      : 'Both'}
                  </div>
                </div>

                <div className="party-detail-row">
                  <div className="party-detail-label">
                    <Phone size={14} />
                    <span>Phone</span>
                  </div>
                  <div className="party-detail-value">{selectedParty.phone || '-'}</div>
                </div>

                <div className="party-detail-row">
                  <div className="party-detail-label">
                    <Mail size={14} />
                    <span>Email</span>
                  </div>
                  <div className="party-detail-value">{selectedParty.email || '-'}</div>
                </div>

                <div className="party-detail-row">
                  <div className="party-detail-label">
                    <FileText size={14} />
                    <span>GSTIN</span>
                  </div>
                  <div className="party-detail-value">{selectedParty.gstin || 'NA'}</div>
                </div>

                <div className="party-detail-row">
                  <div className="party-detail-label">
                    <MapPin size={14} />
                    <span>City</span>
                  </div>
                  <div className="party-detail-value">{selectedParty.city || '-'}</div>
                </div>

                <div className="party-detail-row">
                  <div className="party-detail-label">
                    <Building2 size={14} />
                    <span>State</span>
                  </div>
                  <div className="party-detail-value">
                    {selectedParty.state || 'Tamil Nadu'}{' '}
                    {selectedParty.state_code ? `(${selectedParty.state_code})` : ''}
                  </div>
                </div>

                <div className="party-detail-row">
                  <div className="party-detail-label">
                    <Calendar size={14} />
                    <span>Opening Balance</span>
                  </div>
                  <div className="party-detail-value">
                    ₹ {formatIndianCurrency((selectedParty.opening_balance_paise || 0) / 100)}
                  </div>
                </div>

                <div
                  className="party-detail-row"
                  style={{
                    paddingTop: '8px',
                    borderTop: '1px dashed var(--border)',
                    marginTop: '4px'
                  }}
                >
                  <div className="party-detail-label" style={{ fontWeight: 600 }}>
                    <CreditCard size={14} />
                    <span>Current Outstanding</span>
                  </div>
                  <div className="party-detail-value">
                    {selectedParty.current_balance_paise > 0 ? (
                      <span className="party-amount-receivable">
                        ₹ {formatIndianCurrency(selectedParty.current_balance_paise / 100)}
                      </span>
                    ) : selectedParty.current_balance_paise < 0 ? (
                      <span className="party-amount-payable">
                        ₹ {formatIndianCurrency(Math.abs(selectedParty.current_balance_paise) / 100)}
                      </span>
                    ) : (
                      <span className="party-amount-zero">₹ 0.00</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Addresses */}
            {detailsTab === 'Addresses' && (
              <div className="party-details-fields">
                <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Billing Address</div>
                  <div>{selectedParty.address_line1 || 'No street address specified'}</div>
                  {selectedParty.address_line2 && <div>{selectedParty.address_line2}</div>}
                  <div>
                    {[selectedParty.city, selectedParty.state, selectedParty.pincode]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                    Country: India
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Contacts */}
            {detailsTab === 'Contacts' && (
              <div className="party-details-fields">
                <div className="party-detail-row">
                  <div className="party-detail-label">
                    <User size={14} />
                    <span>Contact Person</span>
                  </div>
                  <div className="party-detail-value">{selectedParty.contact_person || '-'}</div>
                </div>
                <div className="party-detail-row">
                  <div className="party-detail-label">
                    <Phone size={14} />
                    <span>Phone</span>
                  </div>
                  <div className="party-detail-value">{selectedParty.phone || '-'}</div>
                </div>
                <div className="party-detail-row">
                  <div className="party-detail-label">
                    <Mail size={14} />
                    <span>Email</span>
                  </div>
                  <div className="party-detail-value">{selectedParty.email || '-'}</div>
                </div>
                {selectedParty.banking_account_no && (
                  <div className="party-detail-row">
                    <div className="party-detail-label">
                      <CreditCard size={14} />
                      <span>Bank Account</span>
                    </div>
                    <div className="party-detail-value">
                      {selectedParty.banking_account_no} ({selectedParty.banking_ifsc})
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: More */}
            {detailsTab === 'More' && (
              <div className="party-details-fields">
                <div className="party-detail-row">
                  <div className="party-detail-label">
                    <span>PAN</span>
                  </div>
                  <div className="party-detail-value">{selectedParty.pan || 'NA'}</div>
                </div>
                <div className="party-detail-row">
                  <div className="party-detail-label">
                    <span>Ledger ID</span>
                  </div>
                  <div className="party-detail-value" style={{ fontSize: '11.5px', fontFamily: 'monospace' }}>
                    {selectedParty.ledger_id}
                  </div>
                </div>
                <div className="party-detail-row">
                  <div className="party-detail-label">
                    <span>Party ID</span>
                  </div>
                  <div className="party-detail-value" style={{ fontSize: '11.5px', fontFamily: 'monospace' }}>
                    {selectedParty.party_id}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions matching mockup */}
            <div className="party-quick-actions">
              <div className="party-quick-actions-title">
                <Package size={15} style={{ color: 'var(--color-primary, #F97316)' }} />
                <span>Quick Actions</span>
              </div>

              {onOpenNewVoucher && (
                <>
                  <button
                    type="button"
                    className="party-quick-action-link"
                    onClick={() => onOpenNewVoucher('SALES', selectedParty.party_id)}
                  >
                    <div className="party-quick-action-link-left">
                      <FileText size={15} />
                      <span>Create Sales Invoice</span>
                    </div>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </button>

                  <button
                    type="button"
                    className="party-quick-action-link"
                    onClick={() => onOpenNewVoucher('PURCHASE', selectedParty.party_id)}
                  >
                    <div className="party-quick-action-link-left">
                      <FileCheck size={15} />
                      <span>Create Purchase Bill</span>
                    </div>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </button>
                </>
              )}

              {onNavigateReports && (
                <>
                  <button
                    type="button"
                    className="party-quick-action-link"
                    onClick={() => onNavigateReports('ledger', selectedParty.party_id)}
                  >
                    <div className="party-quick-action-link-left">
                      <BookOpen size={15} />
                      <span>View Ledger</span>
                    </div>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </button>

                  <button
                    type="button"
                    className="party-quick-action-link"
                    onClick={() => onNavigateReports('ledger', selectedParty.party_id)}
                  >
                    <div className="party-quick-action-link-left">
                      <Receipt size={15} />
                      <span>Party Statement</span>
                    </div>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="party-details-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Select a party from the table to view quick details.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
