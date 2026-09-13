import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Database, ShieldCheck, CheckCircle2, RefreshCw, FileText } from 'lucide-react';

export const UtilitiesView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.getAuditLogs();
      setLogs(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupMsg(null);
    try {
      const res = await api.triggerBackup();
      setBackupMsg(`Safe Online Backup written to: ${res.backupFile}`);
      loadAuditLogs();
    } catch (err: any) {
      alert('Backup failed: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
          Backup & Statutory Audit Trail
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', marginTop: '2px' }}>
          Immutable tamper-evident double-entry audit logging and non-blocking database snapshot backups.
        </p>
      </div>

      {/* Backup Card */}
      <div className="ledger-card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={16} color="var(--primary-accent)" />
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Database Snapshot Backup
              </h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
              Creates an isolated, consistent, byte-for-byte SQLite database archive in the system backup directory.
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={handleBackup}
            disabled={isBackingUp}
            style={{ padding: '8px 16px' }}
          >
            {isBackingUp ? 'Backing Up...' : 'Trigger Backup'}
          </button>
        </div>

        {backupMsg && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              backgroundColor: 'var(--success-bg)',
              color: 'var(--success-emerald)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '6px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <CheckCircle2 size={14} />
            <span>{backupMsg}</span>
          </div>
        )}
      </div>

      {/* Immutable Audit Log Table */}
      <div className="ledger-card" style={{ overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={16} color="var(--success-emerald)" />
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Immutable Audit Logs (MCA / Tax Compliance)
            </h3>
          </div>
          <button className="btn-quiet" onClick={loadAuditLogs} style={{ gap: '4px' }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        <table className="ledger-table">
          <thead>
            <tr>
              <th style={{ width: '170px' }}>Timestamp</th>
              <th style={{ width: '130px' }}>Action</th>
              <th style={{ width: '130px' }}>Entity</th>
              <th>Details</th>
              <th style={{ width: '110px' }}>User</th>
            </tr>
          </thead>
          <tbody>
            {logs && logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.audit_id}>
                  <td className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </td>
                  <td>
                    <span
                      className={`badge-status ${
                        log.action_type === 'CREATE' ? 'badge-success' : log.action_type === 'UPDATE' ? 'badge-warning' : 'badge-info'
                      }`}
                    >
                      {log.action_type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{log.entity_name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {log.details ? JSON.stringify(log.details) : `Entity ID: ${log.entity_id}`}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{log.user_id || 'admin'}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No audit log entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Fresh Start / Reset Data Card */}
      <div className="ledger-card" style={{ padding: '20px', marginTop: '24px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--danger-red)' }}>
                Fresh Start — Clear All Dummy / Transaction Data
              </h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
              Wipes all vouchers, transaction entries, sample parties, and sample items while preserving your standard Chart of Accounts, company info, and units so you can enter your clean live data manually.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              const confirmMsg = prompt('Type "RESET" to confirm clearing all transaction and master data:');
              if (confirmMsg === 'RESET') {
                try {
                  const res = await api.resetData();
                  alert(`Data wiped successfully!\nRemaining vouchers: ${res.counts.vouchers}\nRemaining parties: ${res.counts.parties}\nCore ledgers intact: ${res.counts.core_ledgers}`);
                  loadAuditLogs();
                } catch (e: any) {
                  alert('Reset failed: ' + e.message);
                }
              }
            }}
            style={{ color: 'var(--danger-red)', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '8px 16px' }}
          >
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
};

