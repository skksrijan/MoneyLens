import React, { useState } from 'react';
import api from '../api';
import { UploadCloud, FileText, CheckCircle, AlertTriangle, X, Lock, Loader2 } from 'lucide-react';

const StatementImportModal = ({ isOpen, onClose, onImportSuccess, categories, userCurrency }) => {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleParse = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV or PDF file to upload');
      return;
    }

    const formData = new FormData();
    formData.append('statement', file);
    if (password) formData.append('password', password);

    try {
      setParsing(true);
      setError(null);
      const res = await api.post('/transactions/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setPreviewData(res.data);
        // By default select all unique transactions
        const initialSet = new Set();
        res.data.transactions.forEach((_, idx) => initialSet.add(idx));
        setSelectedIndices(initialSet);
      }
    } catch (err) {
      console.error('Import parse error:', err);
      setError(err.response?.data?.error || 'Failed to extract bank statement transactions');
    } finally {
      setParsing(false);
    }
  };

  const toggleSelect = (idx) => {
    const next = new Set(selectedIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIndices(next);
  };

  const handleConfirmImport = async () => {
    if (!previewData || selectedIndices.size === 0) {
      setError('Please select at least one transaction to commit to ledger');
      return;
    }

    const toImport = previewData.transactions
      .filter((_, idx) => selectedIndices.has(idx))
      .map(t => ({
        ...t,
        active: 'true'
      }));

    try {
      setConfirming(true);
      setError(null);
      const res = await api.post('/transactions/import/confirm', { transactions: toImport });
      if (res.data.success) {
        onImportSuccess(res.data.message);
        handleClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save transactions');
    } finally {
      setConfirming(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPassword('');
    setPreviewData(null);
    setSelectedIndices(new Set());
    setError(null);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-dialog" style={{ maxWidth: previewData ? '850px' : '520px' }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {previewData ? 'Review & Confirm Extracted Transactions' : 'Import Bank Statement'}
          </h2>
          <button onClick={handleClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {!previewData ? (
          <form onSubmit={handleParse}>
            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '36px 20px',
                textAlign: 'center',
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                marginBottom: '20px',
                cursor: 'pointer'
              }}
              onClick={() => document.getElementById('statement-file-input').click()}
            >
              <UploadCloud size={40} style={{ color: 'var(--primary)', margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
                {file ? file.name : 'Upload PDF or CSV Bank Statement'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                Supports statements worldwide (SBI, HDFC, Chase, BoA, Barclays, etc.)
              </p>
              <input
                id="statement-file-input"
                type="file"
                accept=".csv, .pdf"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={14} />
                  <span>PDF Password (Optional)</span>
                </div>
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="Leave blank if statement is not password-protected"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                Zero-knowledge in-memory decryption: passwords are never stored on disk or database.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button type="button" onClick={handleClose} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={parsing || !file} className="btn btn-primary">
                {parsing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Extracting Transactions...</span>
                  </>
                ) : (
                  <span>Process Statement</span>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                Extracted <strong>{previewData.transactions.length}</strong> unique records (
                {previewData.duplicates?.length || 0} duplicates flagged).
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  if (selectedIndices.size === previewData.transactions.length) setSelectedIndices(new Set());
                  else setSelectedIndices(new Set(previewData.transactions.map((_, i) => i)));
                }}
              >
                {selectedIndices.size === previewData.transactions.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="table-responsive" style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>Import</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.transactions.map((t, idx) => {
                    const isSelected = selectedIndices.has(idx);
                    const isIncome = t.type === 'income';
                    return (
                      <tr key={idx} style={{ opacity: isSelected ? 1 : 0.45 }}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(idx)}
                            style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                          />
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t.date}</td>
                        <td style={{ fontWeight: 500 }}>{t.description}</td>
                        <td>
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: '12px', minWidth: '130px' }}
                            value={t.categoryId || ''}
                            onChange={(e) => {
                              const updated = [...previewData.transactions];
                              updated[idx].categoryId = e.target.value;
                              setPreviewData({ ...previewData, transactions: updated });
                            }}
                          >
                            <option value="">Uncategorized</option>
                            {categories.map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          <span className={isIncome ? 'badge-income' : 'badge-expense'}>
                            {isIncome ? '+' : '-'} {userCurrency} {parseFloat(t.amount).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {previewData.duplicates && previewData.duplicates.length > 0 && (
              <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: 'var(--warning-bg)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)', fontSize: '13px', fontWeight: 600 }}>
                  <AlertTriangle size={15} />
                  <span>Filtered out {previewData.duplicates.length} duplicate transactions already present in database.</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
              <button type="button" onClick={() => setPreviewData(null)} className="btn btn-secondary">
                Back to Upload
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={confirming || selectedIndices.size === 0}
                className="btn btn-primary"
              >
                {confirming ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Mining Blockchain Blocks...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    <span>Confirm & Import ({selectedIndices.size} Items)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatementImportModal;
