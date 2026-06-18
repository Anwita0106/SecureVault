import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Files, Users, HardDrive, Share2, Shield, AlertTriangle,
  Upload, Activity, TrendingUp, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { securityAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const StatCard = ({ icon: Icon, label, value, sub, color = 'blue', link }) => {
  const colors = {
    blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    green: 'text-green-400 bg-green-400/10 border-green-400/20',
    red: 'text-red-400 bg-red-400/10 border-red-400/20',
    yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    orange: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  };
  const content = (
    <div className={`card hover:border-slate-600 transition-all ${link ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold text-slate-100 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl border ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
  return link ? <Link to={link}>{content}</Link> : content;
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const mockActivityData = Array.from({ length: 7 }, (_, i) => ({
  day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
  uploads: Math.floor(Math.random() * 20) + 5,
  downloads: Math.floor(Math.random() * 30) + 10,
  logins: Math.floor(Math.random() * 15) + 5,
}));

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, actRes, logsRes] = await Promise.all([
          securityAPI.getDashboard(),
          securityAPI.getActivitySummary(7).catch(() => ({ data: null })),
          securityAPI.getAuditLogs({ limit: 5, days: 1 }).catch(() => ({ data: [] })),
        ]);
        setStats(statsRes.data);
        setActivity(actRes.data);
        setRecentLogs(logsRes.data || []);
      } catch (err) {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  const pieData = [
    { name: 'Clean', value: (stats?.total_files || 0) - (stats?.infected_files || 0) - (stats?.quarantined_files || 0), color: '#22c55e' },
    { name: 'Quarantined', value: stats?.quarantined_files || 0, color: '#f59e0b' },
    { name: 'Infected', value: stats?.infected_files || 0, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const statusColors = { success: 'text-green-400', failure: 'text-red-400', warning: 'text-yellow-400' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Welcome back, <span className="gradient-text">{user?.username}</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link to="/upload" className="btn-primary">
          <Upload className="w-4 h-4" /> Upload File
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Files} label="Total Files" value={stats?.total_files ?? 0} sub={`${stats?.recent_uploads ?? 0} today`} color="blue" link="/files" />
        <StatCard icon={HardDrive} label="Storage Used" value={formatBytes(stats?.total_storage_bytes)} color="purple" />
        <StatCard icon={Share2} label="Active Shares" value={stats?.active_shares ?? 0} color="green" link="/shared" />
        <StatCard icon={Users} label="Active Users" value={stats?.total_users ?? 0} color="blue" link={isAdmin ? "/users" : undefined} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={AlertTriangle} label="Open Findings" value={stats?.security_findings ?? 0} sub={`${stats?.critical_findings ?? 0} critical`} color="yellow" link="/security" />
        <StatCard icon={XCircle} label="Infected Files" value={stats?.infected_files ?? 0} color="red" link="/security" />
        <StatCard icon={Shield} label="Quarantined" value={stats?.quarantined_files ?? 0} color="orange" />
        <StatCard icon={Activity} label="Logins (7d)" value={stats?.recent_logins ?? 0} color="green" link="/audit-logs" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity chart */}
        <div className="card lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" /> Activity (Last 7 Days)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={mockActivityData}>
              <defs>
                <linearGradient id="uploads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="downloads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
              <Area type="monotone" dataKey="uploads" stroke="#3b82f6" strokeWidth={2} fill="url(#uploads)" name="Uploads" />
              <Area type="monotone" dataKey="downloads" stroke="#8b5cf6" strokeWidth={2} fill="url(#downloads)" name="Downloads" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* File health pie */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" /> File Health
          </h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-slate-400">{d.name}</span>
                    </div>
                    <span className="font-semibold text-slate-200">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-slate-500">
              <CheckCircle className="w-10 h-10 text-green-500 mb-2" />
              <p className="text-sm">No files yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" /> Recent Activity
          </h3>
          <Link to="/audit-logs" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
        </div>
        {recentLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-green-400' : log.status === 'failure' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                  <div>
                    <p className="text-sm text-slate-200 font-medium">{log.action}</p>
                    <p className="text-xs text-slate-500">{log.description || log.user_email || 'System'}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security alerts */}
      {(stats?.critical_findings > 0 || stats?.infected_files > 0) && (
        <div className="border border-red-500/30 bg-red-500/5 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold text-sm">Security Alerts Require Attention</p>
            <p className="text-slate-400 text-xs mt-1">
              {stats?.critical_findings > 0 && `${stats.critical_findings} critical finding(s). `}
              {stats?.infected_files > 0 && `${stats.infected_files} infected file(s) detected.`}
            </p>
            <Link to="/security" className="text-xs text-red-400 underline mt-1 inline-block">
              Go to Security Center →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
