import React, { useState, useEffect } from 'react';
import { useAuth } from '../../state/AuthContext';
import { api } from '../../services/api';
import { FileAttachment } from '../../types';
import {
  Folder,
  Upload,
  Download,
  FileText,
  FileImage,
  FileCode,
  FileArchive,
  File as FileIcon,
  HardDrive
} from 'lucide-react';

export const FilesPage: React.FC = () => {
  const { activeOrganization } = useAuth();
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const loadFiles = async () => {
    setLoading(true);
    try {
      const orgParam = activeOrganization ? `?organization_id=${activeOrganization.id}` : '';
      const resp = await api.get<any>(`/api/v1/files/${orgParam}`);
      setFiles(resp.results || resp);
    } catch (err) {
      console.error('Failed to load files', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [activeOrganization]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('file', file);
    if (activeOrganization) {
      formData.append('organization_id', activeOrganization.id);
    }

    try {
      await api.post('/api/v1/files/upload/', formData);
      await loadFiles();
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const getFileIcon = (mime: string) => {
    if (mime.startsWith('image/')) return <FileImage size={20} color="#5b5fc7" />;
    if (mime.includes('pdf') || mime.includes('text')) return <FileText size={20} color="#237b4b" />;
    if (mime.includes('zip') || mime.includes('tar')) return <FileArchive size={20} color="#f2994a" />;
    if (mime.includes('json') || mime.includes('javascript') || mime.includes('python')) return <FileCode size={20} color="#0078d4" />;
    return <FileIcon size={20} color="#8a8a8a" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Files & Documents</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Cloud storage backed by Supabase Storage with secure signed access
          </p>
        </div>

        <label className="teams-btn teams-btn-primary" style={{ padding: '8px 16px', cursor: 'pointer' }}>
          <Upload size={16} />
          <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={isUploading}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {uploadError && (
        <div style={{
          backgroundColor: '#fde7e9',
          color: '#c4314b',
          padding: '10px 14px',
          borderRadius: '6px',
          fontSize: '13px',
          marginBottom: '16px',
        }}>
          {uploadError}
        </div>
      )}

      {/* Files Table */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '3fr 1.5fr 1fr 1.5fr 1fr',
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-color)',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          <span>Name</span>
          <span>Uploaded By</span>
          <span>Size</span>
          <span>Date</span>
          <span style={{ textAlign: 'right' }}>Action</span>
        </div>

        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Loading files...
          </div>
        ) : files.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Folder size={48} style={{ opacity: 0.4, margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>No files shared yet</h3>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Upload your first attachment or share documents in chat.</p>
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '3fr 1.5fr 1fr 1.5fr 1fr',
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-color)',
                alignItems: 'center',
                fontSize: '13px',
                transition: 'background-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                {getFileIcon(file.mime_type)}
                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.filename}
                </span>
              </div>

              <span style={{ color: 'var(--text-secondary)' }}>
                {file.uploader?.full_name || file.uploader?.username}
              </span>

              <span style={{ color: 'var(--text-secondary)' }}>
                {formatFileSize(file.file_size)}
              </span>

              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                {new Date(file.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>

              <div style={{ textAlign: 'right' }}>
                <a
                  href={file.download_url}
                  target="_blank"
                  rel="noreferrer"
                  download={file.filename}
                  className="teams-btn teams-btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '12px', display: 'inline-flex' }}
                >
                  <Download size={14} />
                  <span>Download</span>
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
