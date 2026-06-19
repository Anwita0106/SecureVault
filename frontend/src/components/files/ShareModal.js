import React, { useState } from 'react';
import { X, Share2, Copy, Link, Lock, Download, Eye } from 'lucide-react';
import { filesAPI } from '../../api/client';
import toast from 'react-hot-toast';

export default function ShareModal({ file, onClose, onShared }) {
  const [form, setForm] = useState({
    shared_with_email: '',
    can_download: true,
    can_view: true,
    requires_password: false,
    share_password: '',
    max_downloads: '',
    max_views: '',
    expires_hours: '24',
  });
  const [loading, setLoading] = useState(false);
  const [shareLink, setShareLink] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        file_id: file.id,
        shared_with_email: form.shared_with_email || null,
        can_download: form.can_download,
        can_view: form.can_view,
        requires_password: form.requires_password,
        share_password: form.requires_password ? form.share_password : null,
        max_downloads: form.max_downloads ? parseInt(form.max_downloads) : null,
        max_views: form.max_views ? parseInt(form.max_views) : null,
        expires_hours: form.expires_hours ? parseInt(form.expires_hours) : null,
      };
      const res = await filesAPI.shareFile(file.id, payload);
      const url = `${window.location.origin}/share/${res.data.token}`;
      setShareLink(url);
      onShared?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success('Link copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-slate-100">Share File</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-slate-400 mb-4 truncate">
            <span className="font-medium text-slate-300">{file.original_filename}</span>
          </p>

          {shareLink ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-lg p-3">
                <Link className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs text-slate-300 truncate flex-1">{shareLink}</span>
                <button onClick={copyLink} className="btn-primary py-1.5 px-3 text-xs shrink-0">
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <div className="text-xs text-slate-500 text-center">
                Share this link to grant access to the file
              </div>
              <button onClick={onClose} className="btn-secondary w-full justify-center">
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Share with (email, optional)</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="colleague@company.com"
                  value={form.shared_with_email}
                  onChange={e => setForm({ ...form, shared_with_email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 cursor-pointer bg-slate-800 rounded-lg p-3">
                  <input type="checkbox" checked={form.can_view} onChange={e => setForm({ ...form, can_view: e.target.checked })} className="rounded" />
                  <Eye className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-300">Can View</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-slate-800 rounded-lg p-3">
                  <input type="checkbox" checked={form.can_download} onChange={e => setForm({ ...form, can_download: e.target.checked })} className="rounded" />
                  <Download className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-300">Can Download</span>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Expires (hrs)</label>
                  <input type="number" className="input-field text-sm" placeholder="24" min="1" value={form.expires_hours} onChange={e => setForm({ ...form, expires_hours: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Max Downloads</label>
                  <input type="number" className="input-field text-sm" placeholder="∞" min="1" value={form.max_downloads} onChange={e => setForm({ ...form, max_downloads: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Max Views</label>
                  <input type="number" className="input-field text-sm" placeholder="∞" min="1" value={form.max_views} onChange={e => setForm({ ...form, max_views: e.target.value })} />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.requires_password} onChange={e => setForm({ ...form, requires_password: e.target.checked })} className="rounded" />
                <Lock className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">Password protect</span>
              </label>

              {form.requires_password && (
                <input type="password" className="input-field" placeholder="Share password" value={form.share_password} onChange={e => setForm({ ...form, share_password: e.target.value })} required />
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Share2 className="w-4 h-4" /> Create Link</>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
