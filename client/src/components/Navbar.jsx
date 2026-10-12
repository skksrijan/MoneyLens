import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp,
  LayoutDashboard,
  Receipt,
  PieChart,
  PiggyBank,
  BarChart3,
  Link as BlockchainIcon,
  Sparkles,
  User,
  LogOut,
  Menu,
  X
} from 'lucide-react';

const Navbar = () => {
  const { user, logout, updateCurrency } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Transactions', path: '/transactions', icon: Receipt },
    { name: 'Budgets', path: '/budgets', icon: PieChart },
    { name: 'Savings', path: '/savings', icon: PiggyBank },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Blockchain', path: '/blockchain', icon: BlockchainIcon },
    { name: 'AI Advisor', path: '/ai', icon: Sparkles, highlight: true },
  ];

  const handleCurrencyChange = (e) => {
    updateCurrency(e.target.value);
  };

  return (
    <header className="navbar">
      <div className="nav-wrapper">
        <Link to="/" className="nav-brand">
          <div className="brand-icon">
            <TrendingUp size={20} />
          </div>
          <span>MoneyLens</span>
        </Link>

        {user ? (
          <>
            <nav className="nav-links">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${isActive ? 'active' : ''} ${item.highlight ? 'text-primary' : ''}`}
                    style={item.highlight && !isActive ? { color: 'var(--primary)', fontWeight: 600 } : {}}
                  >
                    <Icon size={16} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="nav-actions">
              <select
                className="currency-badge-select"
                value={user.currency || 'USD'}
                onChange={handleCurrencyChange}
                title="Select base currency"
              >
                <option value="USD">USD $</option>
                <option value="INR">INR ₹</option>
                <option value="EUR">EUR €</option>
                <option value="GBP">GBP £</option>
                <option value="JPY">JPY ¥</option>
              </select>

              <Link to="/profile" className="btn btn-outline btn-sm" title="My Profile">
                <User size={15} />
                <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name.split(' ')[0]}
                </span>
              </Link>

              <button onClick={handleLogout} className="btn btn-outline btn-sm" title="Logout" style={{ color: 'var(--danger)' }}>
                <LogOut size={15} />
              </button>

              <button
                className="btn btn-outline btn-sm nav-mobile-toggle"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                style={{ display: 'none' }}
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </>
        ) : (
          <div className="nav-actions">
            <Link to="/auth" className="btn btn-primary btn-sm">
              Sign In
            </Link>
          </div>
        )}
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && user && (
        <div style={{ padding: '16px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={16} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
