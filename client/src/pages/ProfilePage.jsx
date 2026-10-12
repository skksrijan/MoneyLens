import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, DollarSign, ShieldCheck, CheckCircle2, Save } from 'lucide-react';

const ProfilePage = () => {
  const { user, updateProfile, updateCurrency } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currency, setCurrency] = useState(user?.currency || 'USD');
  const [savedMsg, setSavedMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(name, email);
      if (currency !== user.currency) {
        await updateCurrency(currency);
      }
      setSavedMsg('Profile updated successfully!');
      setTimeout(() => setSavedMsg(null), 3000);
    } catch (err) {
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800 }}>Account Profile</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Manage your personal details and base reporting currency.
        </p>
      </div>

      {savedMsg && (
        <div style={{ padding: '12px 18px', backgroundColor: 'var(--success-bg)', color: 'var(--success)', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          <span>{savedMsg}</span>
        </div>
      )}

      <div className="content-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-faint)' }} />
              <input
                type="text"
                required
                className="form-input"
                style={{ paddingLeft: '38px' }}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-faint)' }} />
              <input
                type="email"
                required
                className="form-input"
                style={{ paddingLeft: '38px' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Default Reporting Currency</label>
            <div style={{ position: 'relative' }}>
              <DollarSign size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-faint)' }} />
              <select
                className="form-select"
                style={{ paddingLeft: '38px' }}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="USD">USD ($) - United States Dollar</option>
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="GBP">GBP (£) - British Pound</option>
                <option value="JPY">JPY (¥) - Japanese Yen</option>
              </select>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
              All transactions and budgets are dynamically converted to this currency on your dashboard.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 0', borderTop: '1px solid var(--border)', marginTop: '20px' }}>
            <ShieldCheck size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Account Status: <strong>{user?.isVerified ? 'Verified' : 'Active'}</strong>
              {user?.googleId ? ' • Linked with Google OAuth' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ gap: '8px' }}>
              <Save size={16} />
              <span>{loading ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
