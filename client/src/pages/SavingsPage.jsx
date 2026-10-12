import React, { useState, useEffect } from 'react';
import api from '../api';
import { PiggyBank, PlusCircle, CheckCircle2, Circle, Trash2, Edit2, AlertCircle, X, Target } from 'lucide-react';

const SavingsPage = () => {
  const [savings, setSavings] = useState([]);
  const [plans, setPlans] = useState([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [monthlyDeficit, setMonthlyDeficit] = useState(0);
  const [userCurrency, setUserCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);

  // Modals
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPool, setEditingPool] = useState(null);

  const [poolForm, setPoolForm] = useState({ source: '', amount: '', description: '', isPrimary: false });
  const [planForm, setPlanForm] = useState({ goalName: '', targetAmount: '', month: '' });

  const fetchSavings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/savings');
      if (res.data.success) {
        setSavings(res.data.savings);
        setPlans(res.data.plans);
        setTotalSavings(res.data.totalSavings);
        setMonthlyDeficit(res.data.monthlyDeficit);
        setUserCurrency(res.data.userCurrency);
      }
    } catch (err) {
      console.error('Failed to load savings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavings();
  }, []);

  const handlePoolSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPool) {
        await api.put(`/savings/${editingPool._id}`, poolForm);
      } else {
        await api.post('/savings', poolForm);
      }
      setIsPoolModalOpen(false);
      setEditingPool(null);
      setPoolForm({ source: '', amount: '', description: '', isPrimary: false });
      fetchSavings();
    } catch (err) {
      alert('Failed to save asset pool');
    }
  };

  const handleDeletePool = async (id) => {
    if (!window.confirm('Delete this savings pool?')) return;
    try {
      await api.delete(`/savings/${id}`);
      fetchSavings();
    } catch (err) {
      alert('Failed to delete pool');
    }
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/savings/plans', planForm);
      setIsPlanModalOpen(false);
      setPlanForm({ goalName: '', targetAmount: '', month: '' });
      fetchSavings();
    } catch (err) {
      alert('Failed to create goal');
    }
  };

  const handleTogglePlan = async (id) => {
    try {
      await api.post(`/savings/plans/${id}/toggle`);
      fetchSavings();
    } catch (err) {
      alert('Failed to toggle goal status');
    }
  };

  const handleDeletePlan = async (id) => {
    try {
      await api.delete(`/savings/plans/${id}`);
      fetchSavings();
    } catch (err) {
      alert('Failed to delete goal');
    }
  };

  const fmt = (n) => (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>Savings & Asset Pools</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Track accumulated wealth, emergency funds, and milestone financial goals.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsPlanModalOpen(true)} className="btn btn-outline">
            <Target size={16} />
            <span>Add Milestone Goal</span>
          </button>
          <button
            onClick={() => {
              setEditingPool(null);
              setPoolForm({ source: '', amount: '', description: '', isPrimary: false });
              setIsPoolModalOpen(true);
            }}
            className="btn btn-primary"
          >
            <PlusCircle size={16} />
            <span>Add Asset Pool</span>
          </button>
        </div>
      </div>

      {/* Total Compiled Net Worth Banner */}
      <div className="content-card" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Compiled Net Savings
            </span>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
              {userCurrency} {fmt(totalSavings)}
            </div>
          </div>
          {monthlyDeficit > 0 && (
            <div style={{ padding: '8px 14px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>Current monthly budget deficit (-{userCurrency} {fmt(monthlyDeficit)}) automatically offset from primary goal.</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid of Asset Pools & Milestone Goals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Asset Pools Section */}
        <div>
          <div className="card-header-bar">
            <div className="card-header-title">
              <PiggyBank size={18} />
              <span>Asset Pools</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {savings.map((s) => (
              <div key={s._id} className="content-card" style={{ marginBottom: 0, padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ fontSize: '16px', fontWeight: 700 }}>{s.source}</h4>
                      {s.isPrimary && (
                        <span className="badge badge-income" style={{ fontSize: '10px' }}>
                          Primary Absorber
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {s.description || 'Dedicated reserve fund'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => {
                        setEditingPool(s);
                        setPoolForm({
                          source: s.source,
                          amount: s.amount,
                          description: s.description || '',
                          isPrimary: s.isPrimary
                        });
                        setIsPoolModalOpen(true);
                      }}
                      className="btn btn-outline btn-sm"
                      style={{ padding: '4px 6px' }}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleDeletePool(s._id)} className="btn btn-outline btn-sm" style={{ padding: '4px 6px', color: 'var(--danger)' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', marginTop: '12px' }}>
                  {userCurrency} {fmt(s.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Milestone Goals Section */}
        <div>
          <div className="card-header-bar">
            <div className="card-header-title">
              <Target size={18} />
              <span>Milestone Goals</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {plans.map((p) => (
              <div key={p._id} className="content-card" style={{ marginBottom: 0, padding: '18px 20px', opacity: p.isCompleted ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={() => handleTogglePlan(p._id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: p.isCompleted ? 'var(--primary)' : 'var(--text-muted)' }}
                    >
                      {p.isCompleted ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                    </button>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, textDecoration: p.isCompleted ? 'line-through' : 'none' }}>
                        {p.goalName}
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                        Target: {userCurrency} {fmt(p.targetAmount)} {p.month ? `• ${p.month}` : ''}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleDeletePlan(p._id)} className="btn btn-outline btn-sm" style={{ padding: '4px 6px', color: 'var(--danger)' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}

            {plans.length === 0 && (
              <div className="content-card" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                No milestone saving goals set yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pool Modal */}
      {isPoolModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">{editingPool ? 'Update Asset Pool' : 'Create Asset Pool'}</h2>
              <button onClick={() => setIsPoolModalOpen(false)} className="modal-close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handlePoolSubmit}>
              <div className="form-group">
                <label className="form-label">Asset / Account Source</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Emergency Fund, Stocks, High Yield Savings"
                  className="form-input"
                  value={poolForm.source}
                  onChange={(e) => setPoolForm({ ...poolForm, source: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Balance Amount ({userCurrency})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="form-input"
                  value={poolForm.amount}
                  onChange={(e) => setPoolForm({ ...poolForm, amount: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 6 months living expenses"
                  className="form-input"
                  value={poolForm.description}
                  onChange={(e) => setPoolForm({ ...poolForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '14px 0' }}>
                <input
                  type="checkbox"
                  id="primaryCheck"
                  checked={poolForm.isPrimary}
                  onChange={(e) => setPoolForm({ ...poolForm, isPrimary: e.target.checked })}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <label htmlFor="primaryCheck" style={{ fontSize: '13px', cursor: 'pointer' }}>
                  Set as <strong>Primary Deficit Absorber</strong> (monthly budget shortfalls will deduct from this reserve)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setIsPoolModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Asset Pool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan Modal */}
      {isPlanModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">New Milestone Goal</h2>
              <button onClick={() => setIsPlanModalOpen(false)} className="modal-close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handlePlanSubmit}>
              <div className="form-group">
                <label className="form-label">Goal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Down Payment, Europe Vacation, New Laptop"
                  className="form-input"
                  value={planForm.goalName}
                  onChange={(e) => setPlanForm({ ...planForm, goalName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Amount ({userCurrency})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="form-input"
                  value={planForm.targetAmount}
                  onChange={(e) => setPlanForm({ ...planForm, targetAmount: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Month / Date</label>
                <input
                  type="text"
                  placeholder="e.g. Dec 2026"
                  className="form-input"
                  value={planForm.month}
                  onChange={(e) => setPlanForm({ ...planForm, month: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setIsPlanModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavingsPage;
