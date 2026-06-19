import React, { useState } from 'react';
import { User, Mail, Building, Lock, Save, Shield } from 'lucide-react';
import { usersAPI, authAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, fetchUser } = useAuth();
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    department: user?.department || '',
    phone: user?.phone || '',
  });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await usersAPI.updateMe(form);
      await fetchUser();
      toast.success('Profile updated');
    } catch {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    setPwSaving(true);
    try {
      await authAPI.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      setPwForm({ current_password: '', new_password: '', confirm: '' });
      toast.success('Password changed successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="page-title">My Profile</h1>

      {/* Profile info */}
      <div className="card">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">{user?.full_name || user?.username}</h2>
            <p className="text-slate-400 text-sm">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              {user?.is_superuser && <span className="badge-critical flex items-center gap-1"><Shield className="w-3 h-3" />Admin</span>}
              <span className="badge-info">{user?.username}</span>
            </div>
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
            <input type="text" className="input-field" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Department</label>
              <input type="text" className="input-field" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone</label>
              <input type="text" className="input-field" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* Read-only info */}
      <div className="card">
        <h3 className="font-semibold text-slate-200 mb-4">Account Information</h3>
        <div className="space-y-3 text-sm">
          {[
            { icon: Mail, label: 'Email', value: user?.email },
            { icon: User, label: 'Username', value: user?.username },
            { icon: Building, label: 'Account created', value: user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—' },
            { icon: Shield, label: 'Account status', value: user?.is_active ? 'Active' : 'Inactive' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 text-slate-400">
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-slate-500">{label}:</span>
              <span className="text-slate-200">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Change password */}
      <div className="card">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-400" /> Change Password
        </h3>
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Current Password</label>
            <input type="password" className="input-field" value={pwForm.current_password} onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
            <input type="password" className="input-field" value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm New Password</label>
            <input type="password" className={`input-field ${pwForm.confirm && pwForm.confirm !== pwForm.new_password ? 'border-red-500' : ''}`} value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} required />
          </div>
          <button type="submit" disabled={pwSaving} className="btn-primary">
            <Lock className="w-4 h-4" /> {pwSaving ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
