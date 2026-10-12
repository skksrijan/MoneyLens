import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  PlusCircle,
  Upload,
  Search,
  Filter,
  Trash2,
  Edit2,
  FileText,
  Link as ChainIcon,
  Check,
  X,
  ExternalLink
} from 'lucide-react';
import StatementImportModal from './StatementImportModal';

const TransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [userCurrency, setUserCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState(null);
  const [editingTx, setEditingTx] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    amount: '',
    type: 'expense',
    date: new Date().toISOString().split('T')[0],
    description: '',
    categoryId: '',
    currency: 'USD'
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/transactions');
      if (res.data.success) {
        setTransactions(res.data.transactions);
        setCategories(res.data.categories);
        setUserCurrency(res.data.userCurrency);
        setFormData(prev => ({ ...prev, currency: res.data.userCurrency }));
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFile(e.target.files[0]);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append('amount', formData.amount);
    data.append('type', formData.type);
    data.append('date', formData.date);
    data.append('description', formData.description);
    data.append('categoryId', formData.categoryId);
    data.append('currency', formData.currency);
    if (receiptFile) data.append('receipt', receiptFile);

    try {
      setSubmitting(true);
      const res = await api.post('/transactions', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setIsAddModalOpen(false);
        resetForm();
        setFeedbackMsg('Transaction logged & mined on blockchain!');
        fetchTransactions();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingTx) return;

    const data = new FormData();
    data.append('amount', formData.amount);
    data.append('type', formData.type);
    data.append('date', formData.date);
    data.append('description', formData.description);
    data.append('categoryId', formData.categoryId);
    data.append('currency', formData.currency);
    if (receiptFile) data.append('receipt', receiptFile);

    try {
      setSubmitting(true);
      const res = await api.put(`/transactions/${editingTx._id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setIsEditModalOpen(false);
        setEditingTx(null);
        resetForm();
        setFeedbackMsg('Transaction amended on blockchain ledger!');
        fetchTransactions();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction? A deletion block will be mined on the blockchain ledger.')) return;
    try {
      const res = await api.delete(`/transactions/${id}`);
      if (res.data.success) {
        setFeedbackMsg('Transaction deleted & recorded on blockchain!');
        fetchTransactions();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete transaction');
    }
  };

  const openEditModal = (tx) => {
    setEditingTx(tx);
    setFormData({
      amount: tx.amount,
      type: tx.type,
      date: tx.date,
      description: tx.description || '',
      categoryId: tx.categoryId ? (tx.categoryId._id || tx.categoryId) : '',
      currency: tx.currency || userCurrency
    });
    setReceiptFile(null);
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      amount: '',
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
      description: '',
      categoryId: '',
      currency: userCurrency
    });
    setReceiptFile(null);
  };

  // Filtered list
  const filtered = transactions.filter((t) => {
    const matchesSearch =
      (t.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.Category?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || t.type === filterType;
    const catId = t.Category ? (t.Category._id || t.Category).toString() : '';
    const matchesCategory = filterCategory === 'all' || catId === filterCategory;
    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <div className="animate-fade-in">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>Transactions Ledger</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            All cash flows cryptographically indexed and linked to the Proof-of-Work chain.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsImportModalOpen(true)} className="btn btn-outline">
            <Upload size={16} />
            <span>Import Statement</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="btn btn-primary"
          >
            <PlusCircle size={16} />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>{feedbackMsg}</span>
          <button onClick={() => setFeedbackMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="content-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-faint)' }} />
            <input
              type="text"
              placeholder="Search by description or merchant..."
              className="form-input"
              style={{ paddingLeft: '36px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Type Filter */}
          <div style={{ minWidth: '140px' }}>
            <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              <option value="income">Income Only</option>
              <option value="expense">Expense Only</option>
            </select>
          </div>

          {/* Category Filter */}
          <div style={{ minWidth: '160px' }}>
            <select className="form-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Data Table */}
      <div className="content-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            Loading ledger transactions...
          </div>
        ) : filtered.length > 0 ? (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Receipt</th>
                  <th>Ledger Block</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'center', width: '90px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const isIncome = tx.type === 'income';
                  return (
                    <tr key={tx._id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{tx.date}</td>
                      <td style={{ fontWeight: 600 }}>{tx.description || 'Transaction'}</td>
                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          {tx.Category ? tx.Category.name : 'Uncategorized'}
                        </span>
                      </td>
                      <td>
                        {tx.receiptUrl ? (
                          <button
                            onClick={() => setSelectedReceiptUrl(tx.receiptUrl)}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
                            title="View receipt"
                          >
                            <FileText size={12} /> View
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-faint)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                      <td>
                        {tx.blockHash ? (
                          <span className="badge badge-blockchain" title={`Mined Block Hash: ${tx.blockHash}`}>
                            <ChainIcon size={11} /> {tx.blockHash.substring(0, 8)}...
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-faint)', fontSize: '11px' }}>Pending</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        <span className={isIncome ? 'badge-income' : 'badge-expense'} style={{ padding: '4px 8px', borderRadius: '6px' }}>
                          {isIncome ? '+' : '-'} {userCurrency} {parseFloat(tx.convertedAmount || tx.amount).toFixed(2)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => openEditModal(tx)}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '4px 6px' }}
                            title="Edit & Mine Amendment"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(tx._id)}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '4px 6px', color: 'var(--danger)' }}
                            title="Delete & Mine Deletion"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <p>No matching transactions found.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Transaction Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">
                {isEditModalOpen ? 'Edit Transaction & Mine Amendment' : 'Add New Transaction'}
              </h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="modal-close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={isEditModalOpen ? handleEditSubmit : handleAddSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select name="type" className="form-select" value={formData.type} onChange={handleInputChange}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    required
                    className="form-input"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    name="date"
                    required
                    className="form-input"
                    value={formData.date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select name="currency" className="form-select" value={formData.currency} onChange={handleInputChange}>
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select name="categoryId" className="form-select" value={formData.categoryId} onChange={handleInputChange}>
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Description / Merchant</label>
                <input
                  type="text"
                  name="description"
                  className="form-input"
                  placeholder="e.g. Swiggy, Uber, Rent, Netflix"
                  value={formData.description}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Receipt Image / PDF (Optional)</label>
                <input type="file" accept="image/*, application/pdf" className="form-input" onChange={handleFileChange} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Mining Block...' : isEditModalOpen ? 'Save Amendment' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {selectedReceiptUrl && (
        <div className="modal-overlay" onClick={() => setSelectedReceiptUrl(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Receipt Preview</h2>
              <button onClick={() => setSelectedReceiptUrl(null)} className="modal-close">
                <X size={20} />
              </button>
            </div>
            <div style={{ textAlign: 'center', maxHeight: '500px', overflow: 'auto' }}>
              {selectedReceiptUrl.startsWith('data:application/pdf') ? (
                <iframe src={selectedReceiptUrl} style={{ width: '100%', height: '450px', border: 'none' }} title="Receipt PDF" />
              ) : (
                <img src={selectedReceiptUrl} alt="Receipt" style={{ maxWidth: '100%', borderRadius: '8px' }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Statement Import Modal */}
      <StatementImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        categories={categories}
        userCurrency={userCurrency}
        onImportSuccess={(msg) => {
          setFeedbackMsg(msg);
          fetchTransactions();
        }}
      />
    </div>
  );
};

export default TransactionsPage;
