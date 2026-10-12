import React, { useState, useEffect } from 'react';
import api from '../api';
import { BarChart3, AlertTriangle, ShieldCheck, Check, Calendar, TrendingDown, TrendingUp } from 'lucide-react';

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'anomalies'
  const [year, setYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [resReports, resAnomalies] = await Promise.all([
        api.get(`/reports?year=${year}`),
        api.get('/reports/anomalies')
      ]);

      if (resReports.data.success) setReportData(resReports.data);
      if (resAnomalies.data.success) setAnomalies(resAnomalies.data.anomalies);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [year]);

  const handleDismissAnomaly = async (id) => {
    try {
      const res = await api.post(`/reports/anomalies/dismiss/${id}`);
      if (res.data.success) {
        setAnomalies(anomalies.filter(a => a.transaction._id !== id));
      }
    } catch (err) {
      alert('Failed to dismiss anomaly');
    }
  };

  const fmt = (n) => (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="animate-fade-in">
      {/* Header & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>Analytics & Reports</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Multi-year trend analysis, category allocations & statistical anomaly inference.
          </p>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-surface)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none' }}
          >
            <BarChart3 size={15} />
            <span>Annual Breakdown</span>
          </button>
          <button
            onClick={() => setActiveTab('anomalies')}
            className={`btn btn-sm ${activeTab === 'anomalies' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none' }}
          >
            <AlertTriangle size={15} />
            <span>Anomalies ({anomalies.length})</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Computing annual statistical aggregates...
        </div>
      ) : activeTab === 'overview' && reportData ? (
        <div>
          {/* Year Selector Bar */}
          <div className="content-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Filter Financial Year:</span>
            <select
              className="form-select"
              style={{ width: '120px' }}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
            >
              <option value="2027">2027</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>

          {/* Top 2 Totals Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div className="stat-card">
              <div className="card-top">
                <span className="card-title">Total Annual Income ({year})</span>
                <TrendingUp size={20} style={{ color: 'var(--success)' }} />
              </div>
              <div className="card-value" style={{ color: 'var(--success)' }}>
                {reportData.userCurrency} {fmt(reportData.totalIncome)}
              </div>
            </div>

            <div className="stat-card">
              <div className="card-top">
                <span className="card-title">Total Annual Expenses ({year})</span>
                <TrendingDown size={20} style={{ color: 'var(--danger)' }} />
              </div>
              <div className="card-value" style={{ color: 'var(--danger)' }}>
                {reportData.userCurrency} {fmt(reportData.totalExpense)}
              </div>
            </div>
          </div>

          {/* 12-Month Table */}
          <div className="content-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Month-by-Month Statement Summary</h3>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th style={{ textAlign: 'right' }}>Total Income</th>
                    <th style={{ textAlign: 'right' }}>Total Expenses</th>
                    <th style={{ textAlign: 'right' }}>Net Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.fullYearBreakdown.map((row) => {
                    const isPositive = row.savings >= 0;
                    return (
                      <tr key={row.month}>
                        <td style={{ fontWeight: 600 }}>{row.month}</td>
                        <td style={{ textAlign: 'right', color: 'var(--success)' }}>
                          {reportData.userCurrency} {fmt(row.income)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>
                          {reportData.userCurrency} {fmt(row.expense)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: isPositive ? 'var(--primary)' : 'var(--danger)' }}>
                          {reportData.userCurrency} {fmt(row.savings)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Anomalies Tab */
        <div className="content-card">
          <div className="card-header-bar">
            <div>
              <div className="card-header-title">
                <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
                <span>Statistical Spending Anomalies</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Flagged via Z-Score calculation (Z &gt; 2.2) and same-day merchant frequency clustering.
              </p>
            </div>
          </div>

          {anomalies.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {anomalies.map((anom) => {
                const tx = anom.transaction;
                const isHigh = anom.severity === 'high';
                return (
                  <div
                    key={tx._id}
                    style={{
                      padding: '16px 20px',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      border: `1px solid ${isHigh ? 'var(--danger)' : 'var(--warning)'}`,
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          className={`badge ${isHigh ? 'badge-expense' : 'badge-warning'}`}
                          style={{ textTransform: 'uppercase', fontSize: '10px' }}
                        >
                          {anom.severity} Severity
                        </span>
                        <h4 style={{ fontSize: '16px', fontWeight: 700 }}>
                          {tx.description} — {reportData?.userCurrency || 'USD'} {fmt(tx.amount)}
                        </h4>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {anom.reason}
                      </p>
                      <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
                        Date: {tx.date} • Category: {tx.categoryId?.name || 'Uncategorized'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDismissAnomaly(tx._id)}
                      className="btn btn-outline btn-sm"
                      title="Dismiss false positive"
                    >
                      <Check size={14} />
                      <span>Dismiss Alert</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <ShieldCheck size={44} style={{ color: 'var(--primary)', margin: '0 auto 12px' }} />
              <h3>Zero Anomalies Detected</h3>
              <p style={{ marginTop: '6px' }}>
                All historical spending patterns are within standard statistical deviation thresholds.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
