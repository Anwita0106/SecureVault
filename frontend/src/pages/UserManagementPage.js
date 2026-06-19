import React, { useState, useEffect } from 'react';
import { Search, UserX,  Edit2, RefreshCw, Shield } from 'lucide-react';
import { usersAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const RoleBadge = ({ role }) => {
  const map = {
    admin: 'badge-critical',
    manager: 'badge-medium',
    user: 'badge-info',
    viewer: 'badge-low',
  };
  return <span className={map[role] || 'badge-info'}>{role || 'none'}</span>;
};

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        usersAPI.listUsers({ limit: 100 }),
        usersAPI.listRoles().catch(() => ({ data: [] })),
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) ||
           u.full_name?.toLowerCase().includes(q) || u.department?.toLowerCase().includes(q);
  });

  const openEdit = (user) => {
    setEditUser(user);
    setEditForm({ is_active: user.is_active, role_id: user.role_id });
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await usersAPI.updateUser(editUser.id, editForm);
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...editForm, role_name: roles.find(r => r.id === editForm.role_id)?.name } : u));
      setEditUser(null);
      toast.success('User updated');
    } catch {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (userId) => {
    if (userId === currentUser.id) { toast.error("Can't deactivate yourself"); return; }
    if (!window.confirm('Deactivate this user?')) return;
    try {
      await usersAPI.deactivateUser(userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: false } : u));
      toast.success('User deactivated');
    } catch {
      toast.error('Failed to deactivate');
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="text-slate-400 text-sm">{users.length} total users</p>
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-slate-100">{users.filter(u => u.is_active).length}</p>
          <p className="text-xs text-slate-500 mt-1">Active Users</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-red-400">{users.filter(u => !u.is_active).length}</p>
          <p className="text-xs text-slate-500 mt-1">Inactive Users</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-purple-400">{users.filter(u => u.is_superuser).length}</p>
          <p className="text-xs text-slate-500 mt-1">Admins</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" className="input-field pl-10" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Users table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  {['User', 'Role', 'Department', 'Status', 'Last Login', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <tr key={user.id} className="table-row">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {user.username?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-200">{user.full_name || user.username}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                        {user.is_superuser && <Shield className="w-3 h-3 text-purple-400" title="Admin" />}
                      </div>
                    </td>
                    <td className="py-3 px-4"><RoleBadge role={user.role_name} /></td>
                    <td className="py-3 px-4 text-slate-400 text-xs">{user.department || '—'}</td>
                    <td className="py-3 px-4">
                      {user.is_active
                        ? <span className="badge-low">Active</span>
                        : <span className="badge-critical">Inactive</span>}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {user.last_login ? format(new Date(user.last_login), 'MMM d, HH:mm') : 'Never'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(user)} className="p-1.5 rounded text-slate-400 hover:text-blue-400 hover:bg-blue-400/10">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {user.id !== currentUser.id && user.is_active && (
                          <button onClick={() => deactivate(user.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-400/10">
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md mx-4 p-6">
            <h2 className="font-semibold text-slate-100 mb-4">Edit User: {editUser.username}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Role</label>
                <select
                  className="input-field"
                  value={editForm.role_id || ''}
                  onChange={e => setEditForm({ ...editForm, role_id: Number(e.target.value) })}
                >
                  <option value="">No role</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-slate-300">Account active</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditUser(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
