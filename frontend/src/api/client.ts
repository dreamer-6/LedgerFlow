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
}

export interface FinancialYear {
  fy_id: string;
  company_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'OPEN' | 'LOCKED' | 'CLOSED';
}

export const api = {
  async getCompanyAndFy(): Promise<{ company: Company; activeFinancialYear: FinancialYear }> {
    const res = await fetch(`${API_BASE}/companies/current`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateCompany(data: Partial<Company>): Promise<void> {
    const res = await fetch(`${API_BASE}/companies/current`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
  },

  async getDashboard(companyId: string) {
    const res = await fetch(`${API_BASE}/reports/dashboard?companyId=${companyId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getLedgers() {
    const res = await fetch(`${API_BASE}/masters/ledgers`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getParties(type?: string) {
    const url = type ? `${API_BASE}/masters/parties?type=${type}` : `${API_BASE}/masters/parties`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createParty(party: any) {
    const res = await fetch(`${API_BASE}/masters/parties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      method: 'DELETE'
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
    const res = await fetch(`${API_BASE}/masters/items`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createStockItem(item: any) {
    const res = await fetch(`${API_BASE}/masters/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getGodowns() {
    const res = await fetch(`${API_BASE}/masters/godowns`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getUnits() {
    const res = await fetch(`${API_BASE}/masters/units`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getNextVoucherNumber(companyId: string, fyId: string, type: string) {
    const res = await fetch(`${API_BASE}/vouchers/next-number?companyId=${companyId}&fyId=${fyId}&type=${type}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getVouchers(companyId: string, type?: string, fromDate?: string, toDate?: string) {
    const params = new URLSearchParams({ companyId });
    if (type) params.append('type', type);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    const res = await fetch(`${API_BASE}/vouchers?${params.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getVoucherById(id: string) {
    const res = await fetch(`${API_BASE}/vouchers/${id}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async postVoucher(voucherData: any) {
    const res = await fetch(`${API_BASE}/vouchers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(voucherData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to post voucher');
    }
    return res.json();
  },

  async cancelVoucher(id: string, reason: string) {
    const res = await fetch(`${API_BASE}/vouchers/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Reports
  async getDayBook(companyId: string, fromDate: string, toDate: string) {
    const res = await fetch(`${API_BASE}/reports/daybook?companyId=${companyId}&fromDate=${fromDate}&toDate=${toDate}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getLedgerStatement(ledgerId: string, fromDate: string, toDate: string) {
    const res = await fetch(`${API_BASE}/reports/ledger/${ledgerId}?fromDate=${fromDate}&toDate=${toDate}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getTrialBalance(companyId: string, asOnDate: string) {
    const res = await fetch(`${API_BASE}/reports/trial-balance?companyId=${companyId}&asOnDate=${asOnDate}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getProfitAndLoss(companyId: string, fromDate: string, toDate: string) {
    const res = await fetch(`${API_BASE}/reports/profit-loss?companyId=${companyId}&fromDate=${fromDate}&toDate=${toDate}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getBalanceSheet(companyId: string, asOnDate: string) {
    const res = await fetch(`${API_BASE}/reports/balance-sheet?companyId=${companyId}&asOnDate=${asOnDate}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getStockSummary(companyId: string) {
    const res = await fetch(`${API_BASE}/reports/stock-summary?companyId=${companyId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getOutstanding(companyId: string, type: 'CUSTOMER' | 'SUPPLIER') {
    const res = await fetch(`${API_BASE}/reports/outstanding?companyId=${companyId}&type=${type}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getGstSummary(companyId: string, fromDate: string, toDate: string) {
    const res = await fetch(`${API_BASE}/reports/gst-summary?companyId=${companyId}&fromDate=${fromDate}&toDate=${toDate}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async triggerBackup() {
    const res = await fetch(`${API_BASE}/utilities/backup`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getAuditLogs() {
    const res = await fetch(`${API_BASE}/utilities/audit-logs`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async resetData() {
    const res = await fetch(`${API_BASE}/utilities/reset-data`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

