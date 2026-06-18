import React, { useState, useEffect } from 'react';
import { Share2, Copy, Trash2, Clock, Download, Eye, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { filesAPI } from '../api/client';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow, isPast } from 'date-fns';

export default function SharedFilesPage() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await filesAPI.getSharedLinks();
      setShares(res.data);
    } catch {
      toast.error('Failed to load shared files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copyLink = (token) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  };

  const isExpired = (share) => share.expires_at && isPast(new Date(share.expires_at));
  const isLimitReached = (share) =>
    (share.max_downloads && share.download_count >= share.max_downloads) ||
    (share.max_views && share.view_count >= share.max_views);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Shared Files</h1>
          <p className="text-slate-400 text-sm">{shares.length} active share links</p>
        </div>
        <button onClick={load} className="btn-secondary">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
      ) : shares.length === 0 ? (
        <div className="card text-center py-16 text-slate-500">
          <Share2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No shared files yet</p>
          <p className="text-xs mt-1">Share a file from My Files to see links here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shares.map(share => {
            const expired = isExpired(share);
            const limitReached = isLimitReached(share);
            const inactive = expired || limitReached || !share.is_active;

            return (
              <div key={share.id} className={`card transition-all ${inactive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {share.token.substring(0, 12)}...
                      </span>
                      {inactive
                        ? <span className="badge-medium">Inactive</span>
                        : <span className="badge-low">Active</span>
                      }
                      {expired && <span className="badge-critical">Expired</span>}
                      {limitReached && <span className="badge-medium">Limit reached</span>}
                      {share.requires_password && <span className="badge-info"><Eye className="w-3 h-3 inline mr-1" />Password</span>}
                    </div>

                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
                      {share.shared_with_email && (
                        <span>Shared with: <span className="text-slate-300">{share.shared_with_email}</span></span>
                      )}
                      {share.expires_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {expired
                            ? `Expired ${formatDistanceToNow(new Date(share.expires_at), { addSuffix: true })}`
                            : `Expires ${formatDistanceToNow(new Date(share.expires_at), { addSuffix: true })}`}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        {share.download_count}{share.max_downloads ? `/${share.max_downloads}` : ''} downloads
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {share.view_count}{share.max_views ? `/${share.max_views}` : ''} views
                      </span>
                    </div>

                    <div className="flex gap-2 mt-2 text-xs text-slate-500">
                      {share.can_download
                        ? <span className="flex items-center gap-1 text-green-400"><CheckCircle className="w-3 h-3" />Downloads allowed</span>
                        : <span className="flex items-center gap-1 text-red-400"><XCircle className="w-3 h-3" />No downloads</span>
                      }
                      {share.can_view
                        ? <span className="flex items-center gap-1 text-green-400"><CheckCircle className="w-3 h-3" />Viewing allowed</span>
                        : <span className="flex items-center gap-1 text-red-400"><XCircle className="w-3 h-3" />No viewing</span>
                      }
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {!inactive && (
                      <button
                        onClick={() => copyLink(share.token)}
                        className="btn-secondary py-1.5 px-3 text-xs"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
