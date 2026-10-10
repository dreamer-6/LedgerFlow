const API_BASE = '/api';

export interface Company {
  company_id: string;
  company_name: string;
  legal_name: string;
  gstin: string;
  pan: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  country: string;
  phone: string;
  email: string;
  currency: string;
  currency_symbol: string;
  bank_name?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  terms_and_conditions?: string;
  logo_base64?: string;
  role?: string;
}

export interface FinancialYear {
  fy_id: string;
  company_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'OPEN' | 'LOCKED' | 'CLOSED';
}

export interface UserSession {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
}

export interface Party {
  party_id: string;
  company_id: string;
  ledger_id: string;
  party_type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  party_name: string;
  gstin?: string | null;
  pan?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_person?: string | null;
  credit_limit_paise?: number;
  credit_period_days?: number;
  banking_name?: string | null;
  banking_account_no?: string | null;
  banking_ifsc?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  state_code?: string | null;
  pincode?: string | null;
  opening_balance_paise?: number;
  opening_balance_type?: 'DR' | 'CR';
  current_balance_paise: number;
  created_at?: string;
}

export interface CreatePartyPayload {
  partyName?: string;
  party_name?: string;
  partyType?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  party_type?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  companyId?: string;
  company_id?: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  contact_person?: string;
  bankingName?: string;
  bankingAccountNo?: string;
  bankingIfsc?: string;
  addressLine1?: string;
  address_line1?: string;
  addressLine2?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  state_code?: string;
  pincode?: string;
  openingBalancePaise?: number;
  [key: string]: any;
}

export interface UpdatePartyPayload extends Partial<CreatePartyPayload> {}

export interface StockItem {
  item_id: string;
  company_id: string;
  item_name: string;
  item_code?: string | null;
  sku?: string | null;
  hsn_sac: string;
  unit_id: string;
  unit_symbol?: string | null;
  gst_rate: number;
  cess_rate?: number;
  purchase_rate_paise: number;
  selling_rate_paise: number;
  opening_qty: number;
  opening_rate_paise: number;
  reorder_level: number;
  is_active: number;
  created_at?: string;
  serial_numbers?: string | null;
  has_serial_no?: number;
  current_stock?: number;
  total_value_paise?: number;
}

export interface UnitMaster {
  unit_id: string;
  company_id: string | null;
  unit_name: string;
  symbol: string;
  decimal_places: number;
}

export interface GodownMaster {
  godown_id: string;
  company_id: string | null;
  godown_name: string;
  location?: string | null;
  is_default: number;
}

export interface LedgerMaster {
  ledger_id: string;
  company_id: string;
  group_id: string;
  ledger_name: string;
  code?: string | null;
  opening_balance_paise: number;
  opening_balance_type: 'DR' | 'CR';
  is_party: number;
  is_active: number;
  created_at?: string;
  group_name: string;
  nature: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  parent_group_name?: string;
  current_balance_paise?: number;
}

export interface LedgerGroup {
  group_id: string;
  company_id: string | null;
  parent_group_id: string | null;
  group_name: string;
  nature: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  affects_gross_profit: number;
}

export interface CreateLedgerPayload {
  groupId: string;
  ledgerName: string;
  code?: string;
  openingBalancePaise?: number;
  openingBalanceType?: 'DR' | 'CR';
}

export interface StockSummaryItem {
  itemId: string;
  item_id: string;
  itemName: string;
  item_name: string;
  sku: string;
  hsn: string;
  hsn_sac: string;
  unit: string;
  unit_symbol: string;
  quantity: number;
  closing_qty: number;
  currentStock: number;
  reorderLevel: number;
  reorder_level: number;
  avgRatePaise: number;
  avg_rate_paise: number;
  totalValuePaise: number;
  total_value_paise: number;
}

export interface CreateStockItemPayload {
  itemName: string;
  itemCode?: string;
  sku?: string;
  hsnSac?: string;
  unitId?: string;
  gstRate?: number;
  cessRate?: number;
  purchaseRatePaise?: number;
  sellingRatePaise?: number;
  openingQty?: number;
  openingRatePaise?: number;
  reorderLevel?: number;
  godownId?: string;
  serialNumbers?: string;
  hasSerialNo?: boolean | number;
  quantityToAdd?: number;
  allowNegativeStock?: boolean;
  [key: string]: any;
}

export const authStorage = {
  getToken: () => localStorage.getItem('lf_token'),
  setToken: (token: string | null) => {
    if (token) localStorage.setItem('lf_token', token);
    else localStorage.removeItem('lf_token');
  },
  getActiveCompanyId: () => localStorage.getItem('lf_active_company_id'),
  setActiveCompanyId: (id: string | null) => {
    if (id) localStorage.setItem('lf_active_company_id', id);
    else localStorage.removeItem('lf_active_company_id');
  },
  getUser: (): UserSession | null => {
    try {
      const u = localStorage.getItem('lf_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
  setUser: (user: UserSession | null) => {
    if (user) localStorage.setItem('lf_user', JSON.stringify(user));
    else localStorage.removeItem('lf_user');
  },
  clear: () => {
    localStorage.removeItem('lf_token');
    localStorage.removeItem('lf_active_company_id');
    localStorage.removeItem('lf_user');
  }
};

function getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  const token = authStorage.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const compId = authStorage.getActiveCompanyId();
  if (compId) {
    headers['x-company-id'] = compId;
  }
  return headers;
}


async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text();
    if (!text || !text.trim()) return `${fallback} (HTTP ${res.status})`;
    try {
      const data = JSON.parse(text);
      if (data && typeof data === 'object') {
        return data.error || data.message || text;
      }
    } catch {
      if (text.includes('ECONNREFUSED') || text.includes('500 Internal Server Error')) {
        return 'Unable to reach backend server. Please verify the backend is running on port 5000.';
      }
      if (text.trim().startsWith('<')) {
        return `${fallback}: Server returned HTTP ${res.status}`;
      }
      return text;
    }
    return text;
  } catch {
    return `${fallback} (HTTP ${res.status})`;
  }
}

export const api = {
  // ---------------- AUTHENTICATION & BUSINESS TENANCY ----------------
  async login(credentials: { emailOrUsername: string; password: string }) {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
    } catch (networkErr: any) {
      throw new Error('Network error: Unable to connect to backend server. Please check your connection.');
    }
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'Login failed'));
    }
    const data = await res.json();
    authStorage.setToken(data.token);
    authStorage.setUser(data.user);
    if (data.activeCompanyId) {
      authStorage.setActiveCompanyId(data.activeCompanyId);
    }
    return data;
  },

  async ssoLogin(payload: { provider?: string; email: string; name?: string; avatarUrl?: string }) {
    const res = await fetch(`${API_BASE}/auth/sso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'SSO login failed'));
    }
    const data = await res.json();
    authStorage.setToken(data.token);
    authStorage.setUser(data.user);
    if (data.activeCompanyId) {
      authStorage.setActiveCompanyId(data.activeCompanyId);
    }
    return data;
  },

  async register(info: {
    fullName: string;
    email: string;
    username?: string;
    password: string;
    companyName: string;
    businessName?: string;
    legalName?: string;
    gstin?: string;
    state?: string;
    stateCode?: string;
  }) {
    const payload = {
      ...info,
      businessName: info.businessName || info.companyName,
      companyName: info.companyName
    };
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'Registration failed'));
    }
    const data = await res.json();
    authStorage.setToken(data.token);
    authStorage.setUser(data.user);
    const resolvedCompId = data.activeCompanyId || data.company?.company_id || data.businesses?.[0]?.company_id;
    if (resolvedCompId) {
      authStorage.setActiveCompanyId(resolvedCompId);
    }
    return data;
  },

  async getMe(): Promise<{ user: UserSession; businesses: Company[] }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Unauthorized');
    return res.json();
  },

  async getBusinesses(): Promise<Company[]> {
    const res = await fetch(`${API_BASE}/businesses`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async createBusiness(data: any): Promise<{ company: Company; message: string }> {
    const res = await fetch(`${API_BASE}/businesses`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'Failed to create business'));
    }
    return res.json();
  },

  // ---------------- COMPANY & MASTER DETAILS ----------------
  async getCompanyAndFy(): Promise<{ company: Company; activeFinancialYear: FinancialYear }> {
    const res = await fetch(`${API_BASE}/companies/current`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async updateCompany(data: Partial<Company>): Promise<void> {
    const res = await fetch(`${API_BASE}/companies/current`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
  },

  async deleteCompany(companyId: string, password: string): Promise<{ success: boolean; remainingBusinesses: Company[]; nextActiveCompanyId: string | null }> {
    const res = await fetch(`${API_BASE}/companies/${encodeURIComponent(companyId)}/delete`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'Failed to delete company'));
    }
    const result = await res.json();
    if (result.nextActiveCompanyId) {
      authStorage.setActiveCompanyId(result.nextActiveCompanyId);
    }
    return result;
  },

  async getFinancialYears(companyId?: string): Promise<FinancialYear[]> {
    const targetCompId = companyId || authStorage.getActiveCompanyId() || '';
    const res = await fetch(`${API_BASE}/financial-years?companyId=${encodeURIComponent(targetCompId)}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async createFinancialYear(data: {
    name: string;
    startDate: string;
    endDate: string;
    status?: 'OPEN' | 'CLOSED';
    companyId?: string;
  }): Promise<FinancialYear> {
    const res = await fetch(`${API_BASE}/financial-years`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'Failed to create financial year'));
    }
    return res.json();
  },

  async getDashboard(companyId?: string) {
    const targetCompId = companyId || authStorage.getActiveCompanyId() || '';
    const res = await fetch(`${API_BASE}/reports/dashboard?companyId=${encodeURIComponent(targetCompId)}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getLedgers(): Promise<LedgerMaster[]> {
    const res = await fetch(`${API_BASE}/masters/ledgers`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getLedgerGroups(): Promise<LedgerGroup[]> {
    const res = await fetch(`${API_BASE}/masters/groups`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async createLedger(payload: CreateLedgerPayload): Promise<{ ledgerId: string; ledgerName: string }> {
    const res = await fetch(`${API_BASE}/masters/ledgers`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'Failed to create ledger'));
    }
    return res.json();
  },

  async getParties(type?: string): Promise<Party[]> {
    const url = type ? `${API_BASE}/masters/parties?type=${type}` : `${API_BASE}/masters/parties`;
    const res = await fetch(url, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async createParty(party: CreatePartyPayload): Promise<any> {
    const res = await fetch(`${API_BASE}/masters/parties`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(party)
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'Failed to create party'));
    }
    return res.json();
  },

  async updateParty(id: string, party: UpdatePartyPayload): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/masters/parties/${id}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(party)
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'Failed to update party'));
    }
    return res.json();
  },

  async deleteParty(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/masters/parties/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'Failed to delete party'));
    }
    return res.json();
  },

  async getStockItems(): Promise<StockItem[]> {
    const res = await fetch(`${API_BASE}/masters/items`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getStockSummary(param?: string, asOfDate?: string): Promise<StockSummaryItem[]> {
    const actualAsOfDate = asOfDate || (param && param.includes('-') && param.length === 10 ? param : undefined);
    const url = actualAsOfDate
      ? `${API_BASE}/reports/stock-summary?asOfDate=${encodeURIComponent(actualAsOfDate)}`
      : `${API_BASE}/reports/stock-summary`;
    const res = await fetch(url, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async createStockItem(item: CreateStockItemPayload): Promise<any> {
    const res = await fetch(`${API_BASE}/masters/items`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(item)
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'Failed to create item'));
    }
    return res.json();
  },

  async updateStockItem(id: string, item: Partial<CreateStockItemPayload>): Promise<any> {
    const res = await fetch(`${API_BASE}/masters/items/${id}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(item)
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'Failed to update item'));
    }
    return res.json();
  },

  async deleteStockItem(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/masters/items/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getGodowns(): Promise<GodownMaster[]> {
    const res = await fetch(`${API_BASE}/masters/godowns`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getUnits(): Promise<UnitMaster[]> {
    const res = await fetch(`${API_BASE}/masters/units`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getNextVoucherNumber(companyId: string, fyId: string, type: string) {
    const res = await fetch(`${API_BASE}/vouchers/next-number?companyId=${companyId}&fyId=${fyId}&type=${type}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getVouchers(companyId: string, type?: string, fromDate?: string, toDate?: string) {
    const params = new URLSearchParams({ companyId });
    if (type) params.append('type', type);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    const res = await fetch(`${API_BASE}/vouchers?${params.toString()}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getVoucherById(id: string) {
    const res = await fetch(`${API_BASE}/vouchers/${id}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async postVoucher(voucherData: any) {
    const res = await fetch(`${API_BASE}/vouchers`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(voucherData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to post voucher' }));
      throw new Error(err.error || 'Failed to post voucher');
    }
    return res.json();
  },

  async updateVoucher(id: string, voucherData: any) {
    const res = await fetch(`${API_BASE}/vouchers/${id}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(voucherData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update voucher' }));
      throw new Error(err.error || 'Failed to update voucher');
    }
    return res.json();
  },

  async cancelVoucher(id: string, reason: string) {
    const res = await fetch(`${API_BASE}/vouchers/${id}/cancel`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ reason })
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async deleteVoucher(id: string) {
    const res = await fetch(`${API_BASE}/vouchers/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  // ---------------- REPORTS ----------------
  async getDayBook(companyId: string, fromDate: string, toDate: string) {
    const res = await fetch(`${API_BASE}/reports/daybook?companyId=${companyId}&fromDate=${fromDate}&toDate=${toDate}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getLedgerStatement(ledgerId: string, fromDate: string, toDate: string) {
    const res = await fetch(`${API_BASE}/reports/ledger/${ledgerId}?fromDate=${fromDate}&toDate=${toDate}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getTrialBalance(companyId: string, asOnDate: string) {
    const res = await fetch(`${API_BASE}/reports/trial-balance?companyId=${companyId}&asOnDate=${asOnDate}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getProfitAndLoss(companyId: string, fromDate: string, toDate: string) {
    const res = await fetch(`${API_BASE}/reports/profit-loss?companyId=${companyId}&fromDate=${fromDate}&toDate=${toDate}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getBalanceSheet(companyId: string, asOnDate: string) {
    const res = await fetch(`${API_BASE}/reports/balance-sheet?companyId=${companyId}&asOnDate=${asOnDate}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },


  async getOutstanding(companyId: string, type: 'CUSTOMER' | 'SUPPLIER') {
    const res = await fetch(`${API_BASE}/reports/outstanding?companyId=${companyId}&type=${type}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getGstSummary(companyId: string, fromDate: string, toDate: string) {
    const res = await fetch(`${API_BASE}/reports/gst-summary?companyId=${companyId}&fromDate=${fromDate}&toDate=${toDate}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  // ---------------- UTILITIES ----------------
  async triggerBackup() {
    const res = await fetch(`${API_BASE}/utilities/backup`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getAuditLogs() {
    const res = await fetch(`${API_BASE}/utilities/audit-logs`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async resetData() {
    const res = await fetch(`${API_BASE}/utilities/reset-data`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getAvailableSerials(itemId: string): Promise<string[]> {
    const res = await fetch(`${API_BASE}/masters/items/${itemId}/serials`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async postDraftVoucher(id: string) {
    const res = await fetch(`${API_BASE}/vouchers/${id}/post`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({})
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Failed to post draft voucher'));
    return res.json();
  },

  async getSalesVouchers(fromDate?: string, toDate?: string, status?: string): Promise<any[]> {
    const params = new URLSearchParams({ type: 'SALES' });
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (status) params.append('status', status);
    const res = await fetch(`${API_BASE}/vouchers?${params.toString()}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getPurchaseVouchers(fromDate?: string, toDate?: string, status?: string): Promise<any[]> {
    const params = new URLSearchParams({ type: 'PURCHASE' });
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (status) params.append('status', status);
    const res = await fetch(`${API_BASE}/vouchers?${params.toString()}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getReceiptVouchers(fromDate?: string, toDate?: string, status?: string): Promise<any[]> {
    const params = new URLSearchParams({ type: 'RECEIPT' });
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (status) params.append('status', status);
    const res = await fetch(`${API_BASE}/vouchers?${params.toString()}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getPaymentVouchers(fromDate?: string, toDate?: string, status?: string): Promise<any[]> {
    const params = new URLSearchParams({ type: 'PAYMENT' });
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (status) params.append('status', status);
    const res = await fetch(`${API_BASE}/vouchers?${params.toString()}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  },

  async getJournalVouchers(fromDate?: string, toDate?: string, status?: string): Promise<any[]> {
    const params = new URLSearchParams({ type: 'JOURNAL' });
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (status) params.append('status', status);
    const res = await fetch(`${API_BASE}/vouchers?${params.toString()}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Request failed'));
    return res.json();
  }
};
