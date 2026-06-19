import React, { useState, useEffect , useCallback} from 'react';
import { Search, RefreshCw, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { securityAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const StatusIcon = ({ status }) => {
  if (status === 'success') return <CheckCircle className="w-4 h-4 text-green-400" />;
  if (status === 'failure') return <XCircle className="w-4 h-4 text-red-400" />;
  return <AlertCircle className="w-4 h-4 text-yellow-400" />;
};

export default function AuditLogsPage() {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [days, setDays] = useState(7);

  const loadLogs = useCallback(async () => {
    try {
      const endpoint = isAdmin
        ? securityAPI.getAuditLogs
        : securityAPI.getMyActivity;

      const res = await endpoint({
        days,
        limit: 200,
        status: statusFilter,
      });

      setLogs(res.data);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [days, statusFilter, isAdmin]);
  useEffect(() => {loadLogs();}, [loadLogs]);

  const filtered = logs.filter(log => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.action?.toLowerCase().includes(q) ||
      log.description?.toLowerCase().includes(q) ||
      log.user_email?.toLowerCase().includes(q) ||
      log.ip_address?.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="text-slate-400 text-sm">{filtered.length} events</p>
        </div>
        <button onClick={loadLogs} className="btn-secondary">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search logs..."
            className="input-field pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input-field w-auto"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="warning">Warning</option>
        </select>

        <select
          className="input-field w-auto"
          value={days}
          onChange={e => setDays(Number(e.target.value))}
        >
          <option value={1}>Last 24h</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: logs.length, color: 'text-slate-300' },
          { label: 'Success', value: logs.filter(l => l.status === 'success').length, color: 'text-green-400' },
          { label: 'Failures', value: logs.filter(l => l.status === 'failure').length, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card text-center py-4">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Logs table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  {isAdmin && <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>}
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">IP</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} className="table-row">
                    <td className="py-2.5 px-4">
                      <StatusIcon status={log.status} />
                    </td>
                    {isAdmin && (
                      <td className="py-2.5 px-4">
                        <span className="text-slate-300 text-xs">{log.user_email || log.username || `#${log.user_id}`}</span>
                      </td>
                    )}
                    <td className="py-2.5 px-4">
                      <span className="font-mono text-xs bg-slate-800 text-blue-300 px-2 py-0.5 rounded">{log.action}</span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-400 max-w-xs truncate">{log.description || '—'}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-500 font-mono">{log.ip_address || '—'}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-500" title={log.created_at ? format(new Date(log.created_at), 'PPpp') : ''}>
                      {log.created_at ? format(new Date(log.created_at), 'MMM d, HH:mm') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
