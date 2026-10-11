import React, { useState } from 'react';
import { UserSession } from '../../api/client';
import {
  Users,
  UserCheck,
  Shield,
  Clock,
  Search,
  Plus,
  Edit2,
  Trash2,
  MoreVertical,
  ChevronDown,
  Lock
} from 'lucide-react';

export interface UsersPermissionsTabProps {
  currentUser: UserSession | null;
  userRole: string;
}

export const UsersPermissionsTab: React.FC<UsersPermissionsTabProps> = ({
  currentUser,
  userRole
}) => {
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState('Accountant');
  const [userSearch, setUserSearch] = useState('');

  // Sample users list populated with session user as #1
  const companyUsers = [
    {
      id: '1',
      name: currentUser?.fullName || currentUser?.username || 'Dreamer',
      isMe: true,
      email: currentUser?.email || 'dreamer@example.com',
      role: userRole || 'Accountant',
      roleBadgeColor: '#3B82F6',
      status: 'Active',
      joinedOn: '10 Sep 2026',
      lastActive: 'Today, 10:24 PM'
    },
    {
      id: '2',
      name: 'Abdul Rahman',
      isMe: false,
      email: 'rahman@example.com',
      role: 'Administrator',
      roleBadgeColor: '#F59E0B',
      status: 'Active',
      joinedOn: '15 Sep 2026',
      lastActive: '08 Oct 2026'
    },
    {
      id: '3',
      name: 'Saravanan',
      isMe: false,
      email: 'saravanan@example.com',
      role: 'Staff',
      roleBadgeColor: '#64748B',
      status: 'Active',
      joinedOn: '18 Sep 2026',
      lastActive: '07 Oct 2026'
    },
    {
      id: '4',
      name: 'Praveen',
      isMe: false,
      email: 'praveen@example.com',
      role: 'Viewer',
      roleBadgeColor: '#8B5CF6',
      status: 'Active',
      joinedOn: '25 Sep 2026',
      lastActive: '05 Oct 2026'
    }
  ];

  const roleDefinitions = [
    { name: 'Administrator', desc: 'Full access to all features and settings', users: 1, status: 'Active' },
    { name: 'Accountant', desc: 'Access to transactions, masters, reports and most settings', users: 1, status: 'Active' },
    { name: 'Staff', desc: 'Access to day-to-day transactions and selected masters', users: 1, status: 'Active' },
    { name: 'Viewer', desc: 'Read-only access to reports and basic information', users: 1, status: 'Active' }
  ];

  const permissionsMatrix = [
    {
      module: 'Dashboard',
      items: [
        { name: 'View Dashboard', view: true, create: false, edit: false, delete: false, settings: false }
      ]
    },
    {
      module: 'Transactions',
      items: [
        { name: 'Sales', view: true, create: true, edit: true, delete: false, settings: false },
        { name: 'Purchase', view: true, create: true, edit: true, delete: false, settings: false },
        { name: 'Receipts', view: true, create: true, edit: true, delete: false, settings: false },
        { name: 'Payments', view: true, create: true, edit: true, delete: false, settings: false },
        { name: 'Journal', view: true, create: true, edit: false, delete: false, settings: false },
        { name: 'Service Bills', view: true, create: true, edit: true, delete: false, settings: false },
        { name: 'Quotation', view: true, create: true, edit: false, delete: false, settings: false }
      ]
    }
  ];

  const filteredUsers = companyUsers.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 4 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div style={{ padding: '16px 20px', borderRadius: '10px', backgroundColor: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Total Users</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text, #0F172A)' }}>4</div>
            <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Active members in this company</div>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderRadius: '10px', backgroundColor: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(22, 163, 74, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
            <UserCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Active Users</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text, #0F172A)' }}>4</div>
            <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Users with active access</div>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderRadius: '10px', backgroundColor: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
            <Shield size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Company Roles</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text, #0F172A)' }}>4</div>
            <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Defined role types</div>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderRadius: '10px', backgroundColor: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Pending Invites</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text, #0F172A)' }}>0</div>
            <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Invitations not yet accepted</div>
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
                Company Users
              </h3>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                Manage users, roles and access for this company.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94A3B8' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search users..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{ paddingLeft: '28px', fontSize: '12px', width: '200px' }}
              />
            </div>

            <button
              type="button"
              onClick={() => alert('Invite User modal will be available in future team management release.')}
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
              <Plus size={13} /> Invite User
            </button>
          </div>
        </div>

        <div style={{ border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)', borderBottom: '1px solid var(--color-border, #E2E8F0)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>#</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>User</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Email</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Role</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Joined On</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Last Active</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, idx) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                  <td style={{ padding: '9px 12px', color: '#64748B' }}>{idx + 1}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#0F172A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                        {u.name.substring(0, 1).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 700 }}>{u.name}</span>
                      {u.isMe && (
                        <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '6px', backgroundColor: '#F97316', color: '#FFFFFF', fontWeight: 700 }}>
                          You
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '9px 12px', color: '#475569' }}>{u.email}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(59, 130, 246, 0.1)', color: u.roleBadgeColor }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#15803D' }}>
                      {u.status}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', color: '#64748B' }}>{u.joinedOn}</td>
                  <td style={{ padding: '9px 12px', color: '#64748B' }}>{u.lastActive}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '4px' }}>
                      <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}><Edit2 size={12} /></button>
                      <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}><MoreVertical size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
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
                  Role Management
                </h3>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                  Create and manage role types with specific permissions.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => alert('Custom role creation available in enterprise tier.')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--color-primary, #F97316)',
                color: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              <Plus size={13} /> Add Role
            </button>
          </div>

          <div style={{ border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)', borderBottom: '1px solid var(--color-border, #E2E8F0)', textAlign: 'left' }}>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>Role Name</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>Description</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>Users</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roleDefinitions.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                    <td style={{ padding: '7px 10px', color: '#64748B' }}>{idx + 1}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 700 }}>{r.name}</td>
                    <td style={{ padding: '7px 10px', color: '#64748B' }}>{r.desc}</td>
                    <td style={{ padding: '7px 10px' }}>{r.users}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#15803D' }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}><Edit2 size={11} /></button>
                        <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={11} /></button>
                      </div>
                    </td>
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
                  Permissions
                </h3>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                  Configure what each role can access in LedgerFlow.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Select Role:</span>
              <select
                className="form-control"
                value={selectedRoleForMatrix}
                onChange={e => setSelectedRoleForMatrix(e.target.value)}
                style={{ fontSize: '11.5px', padding: '3px 8px' }}
              >
                <option value="Accountant">Accountant</option>
                <option value="Administrator">Administrator</option>
                <option value="Staff">Staff</option>
                <option value="Viewer">Viewer</option>
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
                {permissionsMatrix.map((section, sIdx) => (
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
    </div>
  );
};
