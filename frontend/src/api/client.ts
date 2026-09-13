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

export const api = {
  // ---------------- AUTHENTICATION & BUSINESS TENANCY ----------------
  async login(credentials: { emailOrUsername: string; password: string }) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    if (!res.ok) {
      let msg = 'Login failed';
      try {
        const d = await res.json();
        msg = d.error || msg;
      } catch {
        msg = await res.text();
      }
      throw new Error(msg);
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
      let msg = 'Registration failed';
      try {
        const d = await res.json();
        msg = d.error || msg;
      } catch {
        msg = await res.text();
      }
      throw new Error(msg);
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
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createBusiness(data: {
    companyName: string;
    legalName?: string;
    gstin?: string;
    state?: string;
    stateCode?: string;
  }): Promise<{ company: Company; message: string }> {
    const res = await fetch(`${API_BASE}/businesses`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      let msg = 'Failed to create business';
      try {
        const d = await res.json();
        msg = d.error || msg;
      } catch {
        msg = await res.text();
      }
      throw new Error(msg);
    }
    return res.json();
  },

  // ---------------- COMPANY & MASTER DETAILS ----------------
  async getCompanyAndFy(): Promise<{ company: Company; activeFinancialYear: FinancialYear }> {
    const res = await fetch(`${API_BASE}/companies/current`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateCompany(data: Partial<Company>): Promise<void> {
    const res = await fetch(`${API_BASE}/companies/current`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
  },

  async deleteCompany(companyId: string, password: string): Promise<{ success: boolean; remainingBusinesses: Company[]; nextActiveCompanyId: string | null }> {
    const res = await fetch(`${API_BASE}/companies/${encodeURIComponent(companyId)}/delete`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      let msg = 'Failed to delete company';
      try {
        const d = await res.json();
        msg = d.error || msg;
      } catch {
        msg = await res.text();
      }
      throw new Error(msg);
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
    if (!res.ok) throw new Error(await res.text());
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
      let msg = 'Failed to create financial year';
      try {
        const d = await res.json();
        msg = d.error || msg;
      } catch {
        msg = await res.text();
      }
      throw new Error(msg);
    }
    return res.json();
  },

  async getDashboard(companyId?: string) {
    const targetCompId = companyId || authStorage.getActiveCompanyId() || '';
    const res = await fetch(`${API_BASE}/reports/dashboard?companyId=${encodeURIComponent(targetCompId)}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getLedgers() {
    const res = await fetch(`${API_BASE}/masters/ledgers`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getParties(type?: string) {
    const url = type ? `${API_BASE}/masters/parties?type=${type}` : `${API_BASE}/masters/parties`;
    const res = await fetch(url, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createParty(party: any) {
    const res = await fetch(`${API_BASE}/masters/parties`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(party)
    });
    if (!res.ok) {
      let msg = 'Failed to create party';
      try {
        const data = await res.json();
        msg = data.error || msg;
      } catch {
        msg = await res.text();
      }
      throw new Error(msg);
    }
    return res.json();
  },

  async updateParty(id: string, party: any) {
    const res = await fetch(`${API_BASE}/masters/parties/${id}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(party)
    });
    if (!res.ok) {
      let msg = 'Failed to update party';
      try {
        const data = await res.json();
        msg = data.error || msg;
      } catch {
        msg = await res.text();
      }
      throw new Error(msg);
    }
    return res.json();
  },

  async deleteParty(id: string) {
    const res = await fetch(`${API_BASE}/masters/parties/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) {
      let msg = 'Failed to delete party';
      try {
        const data = await res.json();
        msg = data.error || msg;
      } catch {
        msg = await res.text();
      }
      throw new Error(msg);
    }
    return res.json();
  },

  async getStockItems() {
    const res = await fetch(`${API_BASE}/masters/items`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createStockItem(item: any) {
    const res = await fetch(`${API_BASE}/masters/items`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(item)
    });
    if (!res.ok) {
      let msg = 'Failed to create item';
      try {
        const data = await res.json();
        msg = data.error || msg;
      } catch {
        msg = await res.text();
      }
      throw new Error(msg);
    }
    return res.json();
  },

  async updateStockItem(id: string, item: any) {
    const res = await fetch(`${API_BASE}/masters/items/${id}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(item)
    });
    if (!res.ok) {
      let msg = 'Failed to update item';
      try {
        const data = await res.json();
        msg = data.error || msg;
      } catch {
        msg = await res.text();
      }
      throw new Error(msg);
    }
    return res.json();
  },

  async deleteStockItem(id: string) {
    const res = await fetch(`${API_BASE}/masters/items/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getGodowns() {
    const res = await fetch(`${API_BASE}/masters/godowns`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getUnits() {
    const res = await fetch(`${API_BASE}/masters/units`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getNextVoucherNumber(companyId: string, fyId: string, type: string) {
    const res = await fetch(`${API_BASE}/vouchers/next-number?companyId=${companyId}&fyId=${fyId}&type=${type}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
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
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getVoucherById(id: string) {
    const res = await fetch(`${API_BASE}/vouchers/${id}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
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

  async cancelVoucher(id: string, reason: string) {
    const res = await fetch(`${API_BASE}/vouchers/${id}/cancel`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ reason })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // ---------------- REPORTS ----------------
  async getDayBook(companyId: string, fromDate: string, toDate: string) {
    const res = await fetch(`${API_BASE}/reports/daybook?companyId=${companyId}&fromDate=${fromDate}&toDate=${toDate}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getLedgerStatement(ledgerId: string, fromDate: string, toDate: string) {
    const res = await fetch(`${API_BASE}/reports/ledger/${ledgerId}?fromDate=${fromDate}&toDate=${toDate}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getTrialBalance(companyId: string, asOnDate: string) {
    const res = await fetch(`${API_BASE}/reports/trial-balance?companyId=${companyId}&asOnDate=${asOnDate}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getProfitAndLoss(companyId: string, fromDate: string, toDate: string) {
    const res = await fetch(`${API_BASE}/reports/profit-loss?companyId=${companyId}&fromDate=${fromDate}&toDate=${toDate}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getBalanceSheet(companyId: string, asOnDate: string) {
    const res = await fetch(`${API_BASE}/reports/balance-sheet?companyId=${companyId}&asOnDate=${asOnDate}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getStockSummary(companyId: string) {
    const res = await fetch(`${API_BASE}/reports/stock-summary?companyId=${companyId}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getOutstanding(companyId: string, type: 'CUSTOMER' | 'SUPPLIER') {
    const res = await fetch(`${API_BASE}/reports/outstanding?companyId=${companyId}&type=${type}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getGstSummary(companyId: string, fromDate: string, toDate: string) {
    const res = await fetch(`${API_BASE}/reports/gst-summary?companyId=${companyId}&fromDate=${fromDate}&toDate=${toDate}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // ---------------- UTILITIES ----------------
  async triggerBackup() {
    const res = await fetch(`${API_BASE}/utilities/backup`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getAuditLogs() {
    const res = await fetch(`${API_BASE}/utilities/audit-logs`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async resetData() {
    const res = await fetch(`${API_BASE}/utilities/reset-data`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};
