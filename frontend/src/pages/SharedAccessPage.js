import React, { useState, useEffect , useCallback} from 'react';
import { useParams } from 'react-router-dom';
import { Download, Lock, FileText, Shield, AlertTriangle, Eye } from 'lucide-react';
import { filesAPI } from '../api/client';
import toast from 'react-hot-toast';

const formatBytes = (b) => {
  if (!b) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export default function SharedAccessPage() {
  const { token } = useParams();
  const [fileInfo, setFileInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchFile = useCallback(async () => {
    try {
      const res = await filesAPI.getSharedFile(token, password);
      setFile(res.data);
    } catch (err) {
      // error handling
    }
  }, [token, password]);

  useEffect(() => {
  fetchFile();
}, [fetchFile]);



  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    fetchFile(password);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await filesAPI.downloadShared(token, password || null);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInfo.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">SecureVault</h1>
          <p className="text-slate-400 text-sm">Secure File Share</p>
        </div>

        <div className="card">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-red-400 font-semibold">Access Unavailable</p>
              <p className="text-slate-400 text-sm mt-2">{error}</p>
            </div>
          ) : needsPassword && !fileInfo ? (
            <div>
              <div className="text-center mb-6">
                <Lock className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
                <h2 className="font-semibold text-slate-100">Password Protected</h2>
                <p className="text-slate-400 text-sm mt-1">Enter the password to access this file</p>
              </div>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <input
                  type="password"
                  className="input-field"
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus
                  required
                />
                <button type="submit" className="btn-primary w-full justify-center">
                  <Lock className="w-4 h-4" /> Unlock
                </button>
              </form>
            </div>
          ) : fileInfo ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <FileText className="w-10 h-10 text-blue-400 shrink-0 mt-1" />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-100 truncate">{fileInfo.filename}</p>
                  <p className="text-sm text-slate-400">{formatBytes(fileInfo.file_size)}</p>
                  {fileInfo.mime_type && <p className="text-xs text-slate-500 mt-0.5">{fileInfo.mime_type}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
                <Shield className="w-3 h-3" />
                <span>AES-256 encrypted · Malware scanned</span>
              </div>

              {fileInfo.can_download ? (
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="btn-primary w-full justify-center py-3"
                >
                  {downloading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Downloading...</>
                    : <><Download className="w-4 h-4" />Download File</>
                  }
                </button>
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800 rounded-lg p-3">
                  <Eye className="w-4 h-4" />
                  <span>View only - downloads not permitted</span>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Powered by SecureVault · Enterprise Secure File Platform
        </p>
      </div>
    </div>
  );
}
