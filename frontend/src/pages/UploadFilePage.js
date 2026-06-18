import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  Upload, File, X, CheckCircle, AlertTriangle,
  Shield, Lock, Zap, Info
} from 'lucide-react';
import { filesAPI } from '../api/client';
import toast from 'react-hot-toast';

const formatBytes = (b) => {
  if (!b) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const ALLOWED_EXTS = ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','png','jpg','jpeg','gif','zip','tar','gz'];

export default function UploadFilePage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState('/');
  const [progress, setProgress] = useState({});
  const [results, setResults] = useState({});

  const onDrop = useCallback((accepted, rejected) => {
    const newFiles = accepted.map(f => ({
      file: f,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
    }));
    setFiles(prev => [...prev, ...newFiles]);

    if (rejected.length > 0) {
      toast.error(`${rejected.length} file(s) rejected (type or size)`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 100 * 1024 * 1024,
    accept: ALLOWED_EXTS.reduce((acc, ext) => ({
      ...acc,
      [`application/${ext}`]: [],
      [`image/${ext}`]: [],
      [`text/${ext}`]: [],
    }), {}),
  });

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id));

  const uploadAll = async () => {
    if (files.length === 0) { toast.error('No files selected'); return; }
    setUploading(true);

    for (const item of files) {
      if (results[item.id]?.success) continue;

      const formData = new FormData();
      formData.append('file', item.file);
      if (description) formData.append('description', description);
      formData.append('folder', folder);

      try {
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f));

        await filesAPI.upload(formData, (evt) => {
          if (evt.total) {
            setProgress(prev => ({ ...prev, [item.id]: Math.round((evt.loaded * 100) / evt.total) }));
          }
        });

        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done' } : f));
        setResults(prev => ({ ...prev, [item.id]: { success: true } }));
      } catch (err) {
        const msg = err.response?.data?.detail || 'Upload failed';
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', error: msg } : f));
        setResults(prev => ({ ...prev, [item.id]: { success: false, error: msg } }));
      }
    }

    setUploading(false);
    const successCount = Object.values(results).filter(r => r?.success).length + 
      files.filter(f => f.status === 'done').length;

    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded successfully!`);
      setTimeout(() => navigate('/files'), 1500);
    }
  };

  const statusIcon = (status, error) => {
    if (status === 'done') return <CheckCircle className="w-5 h-5 text-green-400" />;
    if (status === 'error') return <AlertTriangle className="w-5 h-5 text-red-400" title={error} />;
    if (status === 'uploading') return <div className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />;
    return null;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload Files</h1>
          <p className="text-slate-400 text-sm">Files are scanned for malware and AES-256 encrypted</p>
        </div>
      </div>

      {/* Security badges */}
      <div className="flex flex-wrap gap-3">
        {[
          { icon: Shield, label: 'AES-256 Encrypted', color: 'text-blue-400' },
          { icon: Lock, label: 'Malware Scanned', color: 'text-green-400' },
          { icon: Zap, label: 'Instant Processing', color: 'text-yellow-400' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="flex items-center gap-2 text-xs bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
            <Icon className={`w-3.5 h-3.5 ${color}`} />
            <span className="text-slate-300">{label}</span>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer
          ${isDragActive ? 'border-blue-500 bg-blue-500/5' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/30'}`}
      >
        <input {...getInputProps()} />
        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? 'text-blue-400' : 'text-slate-500'}`} />
        <p className="text-lg font-semibold text-slate-200">
          {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-slate-400 text-sm mt-2">or click to browse files</p>
        <p className="text-slate-500 text-xs mt-3">
          Supported: PDF, DOC, XLS, PNG, JPG, ZIP and more · Max 100MB per file
        </p>
      </div>

      {/* Metadata */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-slate-200 text-sm">File Metadata</h3>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Description (optional)</label>
          <textarea
            className="input-field resize-none h-20"
            placeholder="Add a description for these files..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Folder</label>
          <input
            type="text"
            className="input-field"
            placeholder="/ (root)"
            value={folder}
            onChange={e => setFolder(e.target.value)}
          />
        </div>
      </div>

      {/* File queue */}
      {files.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-200 text-sm">{files.length} file(s) queued</h3>
            <button onClick={() => setFiles([])} className="text-xs text-slate-400 hover:text-red-400">
              Clear all
            </button>
          </div>

          {files.map(({ file, id, status, error }) => (
            <div key={id} className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
              <File className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
                {status === 'uploading' && progress[id] !== undefined && (
                  <div className="mt-1.5">
                    <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${progress[id]}%` }}
                      />
                    </div>
                    <p className="text-xs text-blue-400 mt-0.5">{progress[id]}%</p>
                  </div>
                )}
                {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {statusIcon(status, error)}
                {status === 'pending' && (
                  <button onClick={() => removeFile(id)} className="text-slate-500 hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={uploadAll}
            disabled={uploading || files.every(f => f.status === 'done')}
            className="btn-primary w-full justify-center"
          >
            {uploading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
              : <><Upload className="w-4 h-4" /> Upload {files.filter(f => f.status !== 'done').length} File(s)</>
            }
          </button>
        </div>
      )}

      {/* Info */}
      <div className="flex gap-2 text-xs text-slate-500 bg-slate-800/50 rounded-lg p-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          All files are automatically scanned for malware using ClamAV before storage.
          Infected files are blocked and quarantined. Clean files are encrypted with AES-256-GCM
          before being stored on disk.
        </span>
      </div>
    </div>
  );
}
