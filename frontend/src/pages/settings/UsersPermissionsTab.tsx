import React, { useState, useEffect } from 'react';
import { UserSession, CompanyMember, api } from '../../api/client';
import {
  Users,
  UserCheck,
  Shield,
  Clock,
  Search,
  Plus,
  Trash2,
  Lock,
  AlertCircle,
  CheckCircle2,
  X,
  UserPlus
} from 'lucide-react';

export interface UsersPermissionsTabProps {
  currentUser: UserSession | null;
  userRole: string;
}

export const UsersPermissionsTab: React.FC<UsersPermissionsTabProps> = ({
  currentUser,
  userRole
}) => {
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState('ACCOUNTANT');

  // Modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'ACCOUNTANT' | 'VIEWER' | 'OWNER'>('ACCOUNTANT');
  const [newPassword, setNewPassword] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Role edit state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [targetNewRole, setTargetNewRole] = useState<string>('');

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCompanyMembers();
      setMembers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      setModalError('Email address is required');
      return;
    }
    setModalSubmitting(true);
    setModalError(null);
    try {
      const res = await api.addCompanyMember({
        email: newEmail.trim(),
        name: newName.trim() || undefined,
        role: newRole,
        tempPassword: newPassword.trim() || undefined
      });
      setSuccessMsg(res.message || 'Team member added successfully.');
      setShowAddModal(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewRole('ACCOUNTANT');
      await loadMembers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setModalError(err.message || 'Failed to add member');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleUpdateRole = async (targetUserId: string, roleToSet: string) => {
    try {
      const res = await api.updateMemberRole(targetUserId, roleToSet);
      setSuccessMsg(res.message || 'Role updated successfully.');
      setEditingUserId(null);
      await loadMembers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update role');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleRemoveMember = async (targetUserId: string, memberName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this company?`)) {
      return;
    }
    try {
      const res = await api.removeCompanyMember(targetUserId);
      setSuccessMsg(res.message || 'Member removed successfully.');
      await loadMembers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
      setTimeout(() => setError(null), 5000);
    }
  };

  const isOperatorAdmin = userRole === 'OWNER' || userRole === 'ADMIN';

  const roleCounts: Record<string, number> = {
    OWNER: 0,
    ADMIN: 0,
    ACCOUNTANT: 0,
    VIEWER: 0
  };
  members.forEach(m => {
    if (roleCounts[m.role] !== undefined) {
      roleCounts[m.role]++;
    }
  });

  const roleDefinitions = [
    { code: 'OWNER', name: 'Owner', desc: 'Full root ownership, fiscal periods, company deletion and settings', users: roleCounts.OWNER, status: 'Active' },
    { code: 'ADMIN', name: 'Administrator', desc: 'Full business management, vouchers, team members and settings', users: roleCounts.ADMIN, status: 'Active' },
    { code: 'ACCOUNTANT', name: 'Accountant', desc: 'Full transaction, ledger, GST, quotation and reporting capabilities', users: roleCounts.ACCOUNTANT, status: 'Active' },
    { code: 'VIEWER', name: 'Viewer', desc: 'Read-only visibility into books, ledgers and reports', users: roleCounts.VIEWER, status: 'Active' }
  ];

  const permissionsMatrix: Record<string, Array<{ module: string; items: Array<{ name: string; view: boolean; create: boolean; edit: boolean; delete: boolean; settings: boolean }> }>> = {
    OWNER: [
      {
        module: 'System & Company',
        items: [
          { name: 'Company Profile & Delete', view: true, create: true, edit: true, delete: true, settings: true },
          { name: 'Fiscal Years (Lock / Close / Reopen)', view: true, create: true, edit: true, delete: true, settings: true },
          { name: 'Users & Permissions', view: true, create: true, edit: true, delete: true, settings: true }
        ]
      },
      {
        module: 'Transactions & Books',
        items: [
          { name: 'Sales, Purchase, Quotations', view: true, create: true, edit: true, delete: true, settings: true },
          { name: 'Payments, Receipts, Journals', view: true, create: true, edit: true, delete: true, settings: true },
          { name: 'Audit Reports & Day Book', view: true, create: true, edit: true, delete: true, settings: true }
        ]
      }
    ],
    ADMIN: [
      {
        module: 'System & Company',
        items: [
          { name: 'Company Profile', view: true, create: false, edit: true, delete: false, settings: true },
          { name: 'Fiscal Years (Create / Lock)', view: true, create: true, edit: true, delete: false, settings: true },
          { name: 'Users & Permissions (Non-Owner)', view: true, create: true, edit: true, delete: true, settings: true }
        ]
      },
      {
        module: 'Transactions & Books',
        items: [
          { name: 'Sales, Purchase, Quotations', view: true, create: true, edit: true, delete: true, settings: true },
          { name: 'Payments, Receipts, Journals', view: true, create: true, edit: true, delete: true, settings: true },
          { name: 'Audit Reports & Day Book', view: true, create: true, edit: true, delete: true, settings: true }
        ]
      }
    ],
    ACCOUNTANT: [
      {
        module: 'System & Company',
        items: [
          { name: 'Company Profile', view: true, create: false, edit: false, delete: false, settings: false },
          { name: 'Fiscal Years', view: true, create: false, edit: false, delete: false, settings: false },
          { name: 'Users & Permissions', view: true, create: false, edit: false, delete: false, settings: false }
        ]
      },
      {
        module: 'Transactions & Books',
        items: [
          { name: 'Sales, Purchase, Quotations', view: true, create: true, edit: true, delete: false, settings: false },
          { name: 'Payments, Receipts, Journals', view: true, create: true, edit: true, delete: false, settings: false },
          { name: 'Audit Reports & Day Book', view: true, create: true, edit: false, delete: false, settings: false }
        ]
      }
    ],
    VIEWER: [
      {
        module: 'System & Company',
        items: [
          { name: 'Company Profile', view: true, create: false, edit: false, delete: false, settings: false },
          { name: 'Fiscal Years', view: true, create: false, edit: false, delete: false, settings: false },
          { name: 'Users & Permissions', view: true, create: false, edit: false, delete: false, settings: false }
        ]
      },
      {
        module: 'Transactions & Books',
        items: [
          { name: 'Sales, Purchase, Quotations', view: true, create: false, edit: false, delete: false, settings: false },
          { name: 'Payments, Receipts, Journals', view: true, create: false, edit: false, delete: false, settings: false },
          { name: 'Audit Reports & Day Book', view: true, create: false, edit: false, delete: false, settings: false }
        ]
      }
    ]
  };

  const filteredUsers = members.filter(u =>
    (u.full_name || u.username || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'OWNER':
        return { bg: 'rgba(139, 92, 246, 0.1)', color: '#7C3AED', border: '#C4B5FD' };
      case 'ADMIN':
        return { bg: 'rgba(59, 130, 246, 0.1)', color: '#2563EB', border: '#93C5FD' };
      case 'ACCOUNTANT':
        return { bg: 'rgba(22, 163, 74, 0.1)', color: '#16A34A', border: '#86EFAC' };
      case 'VIEWER':
      default:
        return { bg: 'rgba(100, 116, 139, 0.1)', color: '#64748B', border: '#CBD5E1' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Notifications */}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <CheckCircle2 size={15} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 4 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div style={{ padding: '16px 20px', borderRadius: '10px', backgroundColor: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Total Members</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text, #0F172A)' }}>{members.length}</div>
            <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Verified company users</div>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderRadius: '10px', backgroundColor: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(22, 163, 74, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
            <UserCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Active Members</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text, #0F172A)' }}>
              {members.filter(m => m.is_active === 1).length}
            </div>
            <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Access enabled</div>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderRadius: '10px', backgroundColor: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
            <Shield size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Your Company Role</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-text, #0F172A)' }}>{userRole || 'VIEWER'}</div>
            <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Current permissions</div>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderRadius: '10px', backgroundColor: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Owner Count</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text, #0F172A)' }}>{roleCounts.OWNER}</div>
            <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Lockout protected</div>
          </div>
        </div>
      </div>

      {/* Middle Card: Company Users Table */}
      <div
        style={{
          padding: '20px',
          borderRadius: '10px',
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} style={{ color: '#F97316' }} />
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Company Members
              </h3>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                Authenticated users assigned to this company. Multi-tenant isolated.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94A3B8' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search members..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{ paddingLeft: '28px', fontSize: '12px', width: '200px' }}
              />
            </div>

            {isOperatorAdmin && (
              <button
                type="button"
                onClick={() => {
                  setModalError(null);
                  setShowAddModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--color-primary, #F97316)',
                  color: '#FFFFFF',
                  cursor: 'pointer'
                }}
              >
                <Plus size={13} /> Add Member
              </button>
            )}
          </div>
        </div>

        <div style={{ border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)', borderBottom: '1px solid var(--color-border, #E2E8F0)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>#</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Member</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Email</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Role</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Added On</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                    Loading company members...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                    No members match your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, idx) => {
                  const isMe = u.user_id === currentUser?.userId;
                  const badge = getRoleBadgeStyle(u.role);
                  const isEditingThis = editingUserId === u.user_id;

                  return (
                    <tr key={u.user_id} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                      <td style={{ padding: '9px 12px', color: '#64748B' }}>{idx + 1}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#0F172A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                            {(u.full_name || u.username || 'U').substring(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <span style={{ fontWeight: 700 }}>{u.full_name || u.username}</span>
                            {isMe && (
                              <span style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 5px', borderRadius: '6px', backgroundColor: '#F97316', color: '#FFFFFF', fontWeight: 700 }}>
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '9px 12px', color: '#475569' }}>{u.email}</td>
                      <td style={{ padding: '9px 12px' }}>
                        {isEditingThis ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <select
                              value={targetNewRole}
                              onChange={e => setTargetNewRole(e.target.value)}
                              style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #CBD5E1' }}
                            >
                              {userRole === 'OWNER' && <option value="OWNER">OWNER</option>}
                              <option value="ADMIN">ADMIN</option>
                              <option value="ACCOUNTANT">ACCOUNTANT</option>
                              <option value="VIEWER">VIEWER</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleUpdateRole(u.user_id, targetNewRole)}
                              style={{ fontSize: '10.5px', padding: '2px 6px', backgroundColor: '#16A34A', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingUserId(null)}
                              style={{ fontSize: '10.5px', padding: '2px 6px', backgroundColor: '#94A3B8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, backgroundColor: u.is_active ? 'rgba(22, 163, 74, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: u.is_active ? '#15803D' : '#DC2626' }}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: '#64748B' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                        {isOperatorAdmin && (
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {/* Role change button */}
                            {(!isMe || userRole === 'OWNER') && (
                              <button
                                type="button"
                                title="Change Role"
                                onClick={() => {
                                  setEditingUserId(u.user_id);
                                  setTargetNewRole(u.role);
                                }}
                                style={{
                                  border: '1px solid #CBD5E1',
                                  background: '#F8FAFC',
                                  borderRadius: '4px',
                                  padding: '2px 6px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  color: '#334155'
                                }}
                              >
                                Edit Role
                              </button>
                            )}

                            {/* Remove button */}
                            {(!isMe || (userRole === 'OWNER' && roleCounts.OWNER > 1)) && (
                              <button
                                type="button"
                                title="Remove Member"
                                onClick={() => handleRemoveMember(u.user_id, u.full_name || u.username)}
                                style={{
                                  border: '1px solid #FCA5A5',
                                  background: '#FEF2F2',
                                  borderRadius: '4px',
                                  padding: '2px 6px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  color: '#DC2626',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}
                              >
                                <Trash2 size={11} /> Remove
                              </button>
                            )}
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
      </div>

      {/* Bottom Row: Role Management & Permissions Matrix */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px' }}>
        {/* Bottom Left: Role Management */}
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={16} style={{ color: '#F97316' }} />
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                  Role Definitions
                </h3>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                  Standard RBAC hierarchy enforced across all company operations.
                </div>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)', borderBottom: '1px solid var(--color-border, #E2E8F0)', textAlign: 'left' }}>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>Role</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>Description</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>Active Users</th>
                </tr>
              </thead>
              <tbody>
                {roleDefinitions.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                    <td style={{ padding: '7px 10px', color: '#64748B' }}>{idx + 1}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 700 }}>{r.name}</td>
                    <td style={{ padding: '7px 10px', color: '#64748B' }}>{r.desc}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 700 }}>{r.users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Right: Permissions Matrix */}
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={16} style={{ color: '#F97316' }} />
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                  Permissions Matrix
                </h3>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                  Authoritative capabilities by role tier.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Preview Role:</span>
              <select
                className="form-control"
                value={selectedRoleForMatrix}
                onChange={e => setSelectedRoleForMatrix(e.target.value)}
                style={{ fontSize: '11.5px', padding: '3px 8px' }}
              >
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Administrator</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
          </div>

          <div style={{ border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)', borderBottom: '1px solid var(--color-border, #E2E8F0)', textAlign: 'center' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Module / Feature</th>
                  <th style={{ padding: '6px 8px', fontWeight: 700 }}>View</th>
                  <th style={{ padding: '6px 8px', fontWeight: 700 }}>Create</th>
                  <th style={{ padding: '6px 8px', fontWeight: 700 }}>Edit</th>
                  <th style={{ padding: '6px 8px', fontWeight: 700 }}>Delete</th>
                  <th style={{ padding: '6px 8px', fontWeight: 700 }}>Settings</th>
                </tr>
              </thead>
              <tbody>
                {(permissionsMatrix[selectedRoleForMatrix] || permissionsMatrix.ACCOUNTANT).map((section, sIdx) => (
                  <React.Fragment key={sIdx}>
                    <tr style={{ backgroundColor: 'var(--color-surface-inner, #F8F7F4)' }}>
                      <td colSpan={6} style={{ padding: '6px 10px', fontWeight: 800, color: 'var(--color-text, #0F172A)' }}>
                        ▾ {section.module}
                      </td>
                    </tr>
                    {section.items.map((item, iIdx) => (
                      <tr key={iIdx} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', textAlign: 'center' }}>
                        <td style={{ padding: '6px 12px 6px 20px', textAlign: 'left', fontWeight: 600 }}>{item.name}</td>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="checkbox" checked={item.view} readOnly style={{ accentColor: '#F97316' }} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="checkbox" checked={item.create} readOnly style={{ accentColor: '#F97316' }} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="checkbox" checked={item.edit} readOnly style={{ accentColor: '#F97316' }} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="checkbox" checked={item.delete} readOnly style={{ accentColor: '#F97316' }} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="checkbox" checked={item.settings} readOnly style={{ accentColor: '#F97316' }} />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Member Modal Dialog */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '440px', backgroundColor: 'var(--color-surface, #FFFFFF)', borderRadius: '12px', border: '1px solid var(--color-border, #E2E8F0)', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} style={{ color: '#F97316' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--color-text, #0F172A)' }}>Add Company Member</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '11.5px', marginBottom: '12px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="member@company.com"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Assigned Role *
                </label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as any)}
                  className="form-control"
                  style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                >
                  {userRole === 'OWNER' && <option value="OWNER">Owner (Full administrative rights)</option>}
                  <option value="ADMIN">Administrator (Company & Team management)</option>
                  <option value="ACCOUNTANT">Accountant (Transactions, reports & GST)</option>
                  <option value="VIEWER">Viewer (Read-only access)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Temporary Password (Optional if user already registered)
                </label>
                <input
                  type="password"
                  placeholder="Leave blank to auto-generate or use existing"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                />
                <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '3px' }}>
                  If the user does not exist in LedgerFlow, a new account is automatically provisioned.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={modalSubmitting}
                  style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#F8FAFC', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  style={{ padding: '7px 16px', borderRadius: '6px', border: 'none', background: 'var(--color-primary, #F97316)', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {modalSubmitting ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
