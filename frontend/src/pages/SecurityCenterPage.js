import React, { useState, useEffect } from 'react';
import {
   AlertTriangle, CheckCircle,  RefreshCw,
  Brain, FileSearch, Lock,ChevronDown, ChevronUp
} from 'lucide-react';
import { securityAPI } from '../api/client';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const SeverityBadge = ({ severity }) => {
  const map = {
    critical: <span className="badge-critical">CRITICAL</span>,
    high: <span className="badge-high">HIGH</span>,
    medium: <span className="badge-medium">MEDIUM</span>,
    low: <span className="badge-low">LOW</span>,
    info: <span className="badge-info">INFO</span>,
  };
  return map[severity] || <span className="badge-info">{severity}</span>;
};

const FindingCard = ({ finding, onResolve }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`card transition-all ${finding.is_resolved ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={finding.severity} />
            <span className="text-sm font-medium text-slate-200">{finding.title}</span>
            {finding.is_resolved && <span className="badge-low">Resolved</span>}
          </div>
          {expanded && (
            <div className="mt-3 space-y-2">
              {finding.description && (
                <p className="text-sm text-slate-400">{finding.description}</p>
              )}
              {finding.recommendation && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-2">
                  <p className="text-xs font-semibold text-blue-400 mb-1">Recommendation</p>
                  <p className="text-xs text-slate-300">{finding.recommendation}</p>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Detected {finding.created_at ? formatDistanceToNow(new Date(finding.created_at), { addSuffix: true }) : ''}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!finding.is_resolved && (
            <button
              onClick={() => onResolve(finding.id)}
              className="btn-secondary py-1 px-3 text-xs"
            >
              <CheckCircle className="w-3 h-3" /> Resolve
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="p-1 text-slate-400 hover:text-slate-200">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function SecurityCenterPage() {
  const [findings, setFindings] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [allFiles, setAllFiles] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [findingsRes, filesRes] = await Promise.all([
        securityAPI.getFindings({ resolved: false, limit: 50 }),
        securityAPI.getAllFiles({ limit: 20 }).catch(() => ({ data: [] })),
      ]);
      setFindings(findingsRes.data);
      setAllFiles(filesRes.data);
    } catch {
      toast.error('Failed to load security data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const resolveFound = async (id) => {
    try {
      await securityAPI.resolveFinding(id);
      setFindings(prev => prev.map(f => f.id === id ? { ...f, is_resolved: true } : f));
      toast.success('Finding resolved');
    } catch {
      toast.error('Failed to resolve finding');
    }
  };

  const runAI = async () => {
    setAiLoading(true);
    try {
      const res = await securityAPI.runAIAnalysis();
      setAiAnalysis(res.data.analysis);
      toast.success('AI analysis complete');
    } catch {
      toast.error('AI analysis failed');
    } finally {
      setAiLoading(false);
    }
  };

  const generateReport = async () => {
    setReportLoading(true);
    try {
      const res = await securityAPI.generateReport(30);
      setReport(res.data.report);
      toast.success('Report generated');
    } catch {
      toast.error('Report generation failed');
    } finally {
      setReportLoading(false);
    }
  };

  const quarantineFile = async (fileId) => {
    try {
      await securityAPI.quarantineFile(fileId);
      toast.success('File quarantined');
      loadData();
    } catch {
      toast.error('Failed to quarantine');
    }
  };

  const critical = findings.filter(f => f.severity === 'critical' && !f.is_resolved);
  const high = findings.filter(f => f.severity === 'high' && !f.is_resolved);
  const open = findings.filter(f => !f.is_resolved);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Security Center</h1>
          <p className="text-slate-400 text-sm">{open.length} open findings · {critical.length} critical</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadData} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={runAI} disabled={aiLoading} className="btn-primary">
            {aiLoading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing...</>
              : <><Brain className="w-4 h-4" /> AI Analysis</>
            }
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Critical', count: critical.length, color: 'red' },
          { label: 'High', count: high.length, color: 'orange' },
          { label: 'Open Total', count: open.length, color: 'yellow' },
          { label: 'Resolved', count: findings.filter(f => f.is_resolved).length, color: 'green' },
        ].map(({ label, count, color }) => (
          <div key={label} className="card text-center">
            <p className={`text-3xl font-bold text-${color}-400`}>{count}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* AI Analysis */}
      {aiAnalysis && (
        <div className="card border-blue-500/30 bg-blue-500/5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-slate-100">AI Security Analysis</h3>
            <span className={`ml-auto text-2xl font-bold ${
              aiAnalysis.risk_score >= 70 ? 'text-red-400' :
              aiAnalysis.risk_score >= 40 ? 'text-yellow-400' : 'text-green-400'
            }`}>
              Risk: {aiAnalysis.risk_score}/100
            </span>
          </div>

          {aiAnalysis.summary && (
            <p className="text-sm text-slate-300 mb-4">{aiAnalysis.summary}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiAnalysis.concerns?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-400 mb-2">⚠ Concerns</p>
                <ul className="space-y-1">
                  {aiAnalysis.concerns.map((c, i) => (
                    <li key={i} className="text-xs text-slate-400 flex gap-1"><span className="text-red-400">•</span>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {aiAnalysis.recommendations?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-blue-400 mb-2">→ Recommendations</p>
                <ul className="space-y-1">
                  {aiAnalysis.recommendations.map((r, i) => (
                    <li key={i} className="text-xs text-slate-400 flex gap-1"><span className="text-blue-400">•</span>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {aiAnalysis.positive_controls?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-400 mb-2">✓ Controls in Place</p>
                <ul className="space-y-1">
                  {aiAnalysis.positive_controls.map((p, i) => (
                    <li key={i} className="text-xs text-slate-400 flex gap-1"><span className="text-green-400">•</span>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700 flex gap-3">
            <button onClick={generateReport} disabled={reportLoading} className="btn-secondary text-xs">
              {reportLoading ? 'Generating...' : <><FileSearch className="w-3 h-3" /> Generate Full Report</>}
            </button>
          </div>

          {report && (
            <div className="mt-4 bg-slate-800 rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap font-mono text-xs max-h-64 overflow-y-auto">
              {report}
            </div>
          )}
        </div>
      )}

      {/* Findings */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" /> Security Findings
        </h2>
        {findings.length === 0 ? (
          <div className="card text-center py-12 text-slate-500">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500" />
            <p className="font-medium">No security findings</p>
            <p className="text-xs mt-1">Your platform is clean</p>
          </div>
        ) : (
          <div className="space-y-2">
            {findings.sort((a, b) => {
              const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
              return (order[a.severity] || 5) - (order[b.severity] || 5);
            }).map(finding => (
              <FindingCard key={finding.id} finding={finding} onResolve={resolveFound} />
            ))}
          </div>
        )}
      </div>

      {/* All files admin view */}
      {allFiles.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-400" /> All Files (Admin)
          </h2>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="text-left py-2 px-4 text-xs text-slate-400">File</th>
                  <th className="text-left py-2 px-4 text-xs text-slate-400">Owner</th>
                  <th className="text-left py-2 px-4 text-xs text-slate-400">Scan</th>
                  <th className="text-right py-2 px-4 text-xs text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allFiles.map(f => (
                  <tr key={f.id} className="table-row">
                    <td className="py-2 px-4">
                      <span className="text-slate-200 truncate block max-w-xs">{f.original_filename}</span>
                    </td>
                    <td className="py-2 px-4 text-slate-400 text-xs">User #{f.owner_id}</td>
                    <td className="py-2 px-4">
                      {f.scan_status === 'clean' ? <span className="badge-low">Clean</span> :
                       f.scan_status === 'infected' ? <span className="badge-critical">Infected</span> :
                       <span className="badge-info">{f.scan_status}</span>}
                    </td>
                    <td className="py-2 px-4 text-right">
                      {!f.is_quarantined ? (
                        <button onClick={() => quarantineFile(f.id)} className="text-xs text-orange-400 hover:text-orange-300">
                          Quarantine
                        </button>
                      ) : (
                        <span className="badge-medium">Quarantined</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
