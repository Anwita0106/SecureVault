import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Files, Download, Trash2, Share2, Search, Filter,
  FileText, Image, Archive, File, Shield, Clock,
  ChevronDown, AlertCircle, RefreshCw, GitBranch
} from 'lucide-react';
import { filesAPI } from '../api/client';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';
import ShareModal from '../components/files/ShareModal';

const fileIcon = (ext) => {
  const icons = {
    pdf: <FileText className="w-5 h-5 text-red-400" />,
    doc: <FileText className="w-5 h-5 text-blue-400" />,
    docx: <FileText className="w-5 h-5 text-blue-400" />,
    xls: <FileText className="w-5 h-5 text-green-400" />,
    xlsx: <FileText className="w-5 h-5 text-green-400" />,
    png: <Image className="w-5 h-5 text-purple-400" />,
    jpg: <Image className="w-5 h-5 text-purple-400" />,
    jpeg: <Image className="w-5 h-5 text-purple-400" />,
    zip: <Archive className="w-5 h-5 text-yellow-400" />,
    tar: <Archive className="w-5 h-5 text-yellow-400" />,
    gz: <Archive className="w-5 h-5 text-yellow-400" />,
  };
  return icons[ext?.toLowerCase()] || <File className="w-5 h-5 text-slate-400" />;
};

const formatBytes = (b) => {
  if (!b) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const ScanBadge = ({ status }) => {
  const map = {
    clean: <span className="badge-low">✓ Clean</span>,
    infected: <span className="badge-critical">⚠ Infected</span>,
    pending: <span className="badge-info">⏳ Scanning</span>,
    error: <span className="badge-medium">! Error</span>,
  };
  return map[status] || <span className="badge-info">{status}</span>;
};

export default function MyFilesPage() {
  const [files, setFiles] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [shareFile, setShareFile] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await filesAPI.list({ limit: 100 });
      setFiles(res.data);
      setFiltered(res.data);
    } catch {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(files);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(files.filter(f =>
      f.original_filename.toLowerCase().includes(q) ||
      f.description?.toLowerCase().includes(q) ||
      f.file_extension?.toLowerCase().includes(q)
    ));
  }, [search, files]);

  const handleDownload = async (file) => {
    setDownloading(file.id);
    try {
      const res = await filesAPI.download(file.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm('Permanently delete this file?')) return;
    setDeleting(fileId);
    try {
      await filesAPI.delete(fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
      toast.success('File deleted');
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Files</h1>
          <p className="text-slate-400 text-sm">{files.length} files · AES-256 encrypted</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadFiles} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <Link to="/upload" className="btn-primary">
            <Files className="w-4 h-4" /> Upload New
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search files by name, description, type..."
          className="input-field pl-10"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Files table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Files className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{search ? 'No files match your search' : 'No files uploaded yet'}</p>
            {!search && (
              <Link to="/upload" className="btn-primary mx-auto mt-4 w-fit">
                <Files className="w-4 h-4" /> Upload your first file
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">File</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Size</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Security</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Version</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Uploaded</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(file => (
                  <tr key={file.id} className="table-row">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {fileIcon(file.file_extension)}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-100 truncate max-w-xs">{file.original_filename}</p>
                          <p className="text-xs text-slate-500">{file.description || file.mime_type || 'No description'}</p>
                        </div>
                        {file.is_encrypted && (
                          <Shield className="w-3 h-3 text-blue-400 shrink-0" title="Encrypted" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-300">{formatBytes(file.file_size)}</td>
                    <td className="py-3 px-4"><ScanBadge status={file.scan_status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-sm text-slate-400">
                        <GitBranch className="w-3 h-3" /> v{file.version}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-400" title={file.created_at ? format(new Date(file.created_at), 'PPpp') : ''}>
                      {file.created_at ? formatDistanceToNow(new Date(file.created_at), { addSuffix: true }) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDownload(file)}
                          disabled={downloading === file.id || file.is_quarantined}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-colors disabled:opacity-40"
                          title="Download"
                        >
                          {downloading === file.id
                            ? <div className="w-4 h-4 border-b-2 border-blue-400 rounded-full animate-spin" />
                            : <Download className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setShareFile(file)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-green-400 hover:bg-green-400/10 transition-colors"
                          title="Share"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(file.id)}
                          disabled={deleting === file.id}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {shareFile && (
        <ShareModal
          file={shareFile}
          onClose={() => setShareFile(null)}
          onShared={() => { setShareFile(null); toast.success('Share link created!'); }}
        />
      )}
    </div>
  );
}
