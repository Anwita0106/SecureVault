import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, UserPlus, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const PasswordStrength = ({ password }) => {
  const checks = [
    { label: '8+ characters', pass: password.length >= 8 },
    { label: 'Uppercase', pass: /[A-Z]/.test(password) },
    { label: 'Lowercase', pass: /[a-z]/.test(password) },
    { label: 'Number', pass: /\d/.test(password) },
    { label: 'Special char', pass: /[!@#$%^&*]/.test(password) },
  ];
  const score = checks.filter(c => c.pass).length;
  const colors = ['bg-red-500', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[0,1,2,3,4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < score ? colors[score - 1] : 'bg-slate-700'}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {checks.map(({ label, pass }) => (
          <span key={label} className={`flex items-center gap-1 text-xs ${pass ? 'text-green-400' : 'text-slate-500'}`}>
            {pass ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', full_name: '', password: '', confirm: '', department: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return; }

    setLoading(true);
    try {
      await register({ email: form.email, username: form.username, full_name: form.full_name, password: form.password, department: form.department });
      toast.success('Account created! Please log in.');
      navigate('/login');
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(Array.isArray(detail) ? detail[0]?.msg || 'Registration failed' : detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 glow-blue">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-100">SecureVault</h1>
          <p className="text-slate-400 mt-1">Create your secure account</p>
        </div>

        <div className="card glow-blue">
          <h2 className="text-xl font-semibold text-slate-100 mb-6">Create Account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label>
                <input type="email" className="input-field" placeholder="you@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Username *</label>
                <input type="text" className="input-field" placeholder="john_doe" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
              <input type="text" className="input-field" placeholder="John Doe" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Department</label>
              <input type="text" className="input-field" placeholder="Engineering" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password *</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="Strong password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password && <PasswordStrength password={form.password} />}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password *</label>
              <input type="password" className={`input-field ${form.confirm && form.confirm !== form.password ? 'border-red-500' : ''}`} placeholder="Repeat password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</> : <><UserPlus className="w-4 h-4" /> Create Secure Account</>}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700 text-center">
            <p className="text-slate-400 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
