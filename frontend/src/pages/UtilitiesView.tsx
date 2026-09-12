import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { DatabaseBackup, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';

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
      setBackupMsg(`Safe Online Backup successfully written to: ${res.backupFile}`);
      loadAuditLogs();
    } catch (err: any) {
      alert('Backup failed: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
          System Utilities, Backups & Audit Trail
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
          Statutory compliance, live immutable audit logs, and non-blocking database snapshot backups.
        </p>
      </div>

      {/* Backup Card */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Database Safe Online Snapshot (VACUUM INTO)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Creates a clean, crash-consistent copy of the active SQLite database without pausing active writes or locking users.
            </p>
          </div>

          <button
            className="btn-primary"
            onClick={handleBackup}
            disabled={isBackingUp}
            style={{ padding: '8px 18px', fontSize: '13px' }}
          >
            <DatabaseBackup size={16} />
            <span>{isBackingUp ? 'Creating Snapshot...' : 'Trigger Verified Backup'}</span>
          </button>
        </div>

        {backupMsg && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid var(--accent-emerald)',
            borderRadius: '6px',
            color: 'var(--accent-emerald)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle2 size={16} />
            <span>{backupMsg}</span>
          </div>
        )}
      </div>

      {/* Audit Log Card */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="var(--accent-blue)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Immutable Transaction Audit Trail
            </h3>
          </div>

          <button className="btn-secondary" onClick={loadAuditLogs} style={{ padding: '4px 10px', fontSize: '11px' }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        <table className="acc-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Entity</th>
              <th>User</th>
              <th>Snapshot / Details</th>
            </tr>
          </thead>
          <tbody>
            {loadingLogs ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>Loading audit logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>No audit trail recorded yet.</td></tr>
            ) : (
              logs.map((log: any) => (
                <tr key={log.log_id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {log.created_at}
                  </td>
                  <td>
                    <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--accent-cyan)' }}>
                      {log.action}
                    </span>
                  </td>
                  <td>{log.entity_name} #{log.entity_id}</td>
                  <td style={{ fontWeight: 600 }}>{log.user_id}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.details || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
