import React, { useState, useEffect } from 'react';
import api from '../api';
import { PieChart, PlusCircle, Trash2, Edit2, AlertTriangle, X } from 'lucide-react';

const BudgetsPage = () => {
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [userCurrency, setUserCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [formData, setFormData] = useState({
    categoryId: '',
    amount: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      const res = await api.get('/budgets');
      if (res.data.success) {
        setBudgets(res.data.budgets);
        setCategories(res.data.categories);
        setUserCurrency(res.data.userCurrency);
      }
    } catch (err) {
      console.error('Failed to load budgets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        ...formData,
        id: editingBudget?._id
      };
      const res = await api.post('/budgets', payload);
      if (res.data.success) {
        setIsModalOpen(false);
        setEditingBudget(null);
        setFormData({ categoryId: '', amount: '', description: '' });
        fetchBudgets();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save budget');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this budget?')) return;
    try {
      const res = await api.delete(`/budgets/${id}`);
      if (res.data.success) {
        fetchBudgets();
      }
    } catch (err) {
      alert('Failed to delete budget');
    }
  };

  const openAddModal = () => {
    setEditingBudget(null);
    setFormData({ categoryId: categories[0]?._id || '', amount: '', description: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (b) => {
    setEditingBudget(b);
    setFormData({
      categoryId: b.categoryId?._id || b.categoryId,
      amount: b.convertedAmount || b.amount,
      description: b.description || ''
    });
    setIsModalOpen(true);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>Monthly Budgets</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Set category limits with automated email overrun alerts.
          </p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary">
          <PlusCircle size={16} />
          <span>Set Budget</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Loading budgets...
        </div>
      ) : budgets.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {budgets.map((b) => (
            <div key={b._id} className="content-card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{b.Category ? b.Category.name : 'Category'}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{b.description || 'Monthly allocation'}</p>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => openEditModal(b)} className="btn btn-outline btn-sm" style={{ padding: '4px 6px' }}>
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => handleDelete(b._id)} className="btn btn-outline btn-sm" style={{ padding: '4px 6px', color: 'var(--danger)' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', margin: '14px 0' }}>
                {userCurrency} {parseFloat(b.convertedAmount || b.amount).toFixed(2)}
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '6px' }}>/ month</span>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                Automated email alerts will be dispatched via EmailJS when expenses exceed this limit.
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="content-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <PieChart size={40} style={{ color: 'var(--primary)', margin: '0 auto 12px' }} />
          <h3>No Category Budgets Set</h3>
          <p style={{ marginTop: '6px', marginBottom: '18px' }}>
            Set category limits to proactively control spending and receive real-time alerts.
          </p>
          <button onClick={openAddModal} className="btn btn-primary">
            Create Your First Budget
          </button>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">{editingBudget ? 'Update Budget Limit' : 'Set Category Budget'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Monthly Limit ({userCurrency})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 500.00"
                  className="form-input"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Groceries & dining allowance"
                  className="form-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Saving...' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetsPage;
