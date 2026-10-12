import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  Sparkles,
  Receipt
} from 'lucide-react';
import { Chart as ChartJS, registerables } from 'chart.js';

ChartJS.register(...registerables);

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const barChartRef = useRef(null);
  const doughnutChartRef = useRef(null);
  const barChartInstance = useRef(null);
  const doughnutChartInstance = useRef(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard');
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Render Charts when data arrives
  useEffect(() => {
    if (!data) return;

    // Destroy existing instances
    if (barChartInstance.current) barChartInstance.current.destroy();
    if (doughnutChartInstance.current) doughnutChartInstance.current.destroy();

    // 1. Income vs Expense Bar Chart
    if (barChartRef.current) {
      const ctx = barChartRef.current.getContext('2d');
      barChartInstance.current = new ChartJS(ctx, {
        type: 'bar',
        data: {
          labels: ['Monthly Income', 'Monthly Expenses'],
          datasets: [
            {
              label: `Amount (${data.userCurrency})`,
              data: [data.totalIncome, data.totalExpense],
              backgroundColor: ['rgba(16, 185, 129, 0.85)', 'rgba(239, 68, 68, 0.85)'],
              borderRadius: 8,
              borderWidth: 0,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8' }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8' }
            }
          }
        }
      });
    }

    // 2. Category Spending Doughnut Chart
    if (doughnutChartRef.current && Object.keys(data.categoryData || {}).length > 0) {
      const ctx = doughnutChartRef.current.getContext('2d');
      const labels = Object.keys(data.categoryData);
      const values = Object.values(data.categoryData);
      const colors = [
        '#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b',
        '#3b82f6', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
      ];

      doughnutChartInstance.current = new ChartJS(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: colors.slice(0, labels.length),
              borderWidth: 2,
              borderColor: '#1e293b'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: '#94a3b8', font: { size: 12 }, padding: 12 }
            }
          },
          cutout: '68%'
        }
      });
    }

    return () => {
      if (barChartInstance.current) barChartInstance.current.destroy();
      if (doughnutChartInstance.current) doughnutChartInstance.current.destroy();
    };
  }, [data]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
        <p>Loading financial insights...</p>
      </div>
    );
  }

  if (!data) return null;

  const fmt = (num) =>
    (num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="animate-fade-in">
      {/* Top Banner / Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>Financial Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Real-time spending overview, budget health & cryptographic verification.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/ai" className="btn btn-outline" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
            <Sparkles size={16} />
            <span>Ask AI Advisor</span>
          </Link>
          <Link to="/transactions" className="btn btn-primary">
            <PlusCircle size={16} />
            <span>Add Transaction</span>
          </Link>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid-cards-4">
        {/* Income Card */}
        <div className="stat-card">
          <div className="card-top">
            <span className="card-title">Monthly Income</span>
            <div className="card-icon-wrap" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="card-value">
            {data.userCurrency} {fmt(data.totalIncome)}
          </div>
          <span className="card-subtitle">Active month cash inflow</span>
        </div>

        {/* Expenses Card */}
        <div className="stat-card">
          <div className="card-top">
            <span className="card-title">Monthly Expenses</span>
            <div className="card-icon-wrap" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="card-value">
            {data.userCurrency} {fmt(data.totalExpense)}
          </div>
          <span className="card-subtitle">Active month expenditures</span>
        </div>

        {/* Net Balance / Savings Card */}
        <div className="stat-card">
          <div className="card-top">
            <span className="card-title">Monthly Net Balance</span>
            <div className="card-icon-wrap" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info)' }}>
              <Wallet size={18} />
            </div>
          </div>
          <div className="card-value" style={{ color: data.savings >= 0 ? 'var(--primary)' : 'var(--danger)' }}>
            {data.userCurrency} {fmt(data.savings)}
          </div>
          <span className="card-subtitle">
            {data.monthlyDeficit > 0 ? (
              <span style={{ color: 'var(--danger)' }}>⚠️ Deficit: {data.userCurrency} {fmt(data.monthlyDeficit)}</span>
            ) : (
              'Surplus cash flow'
            )}
          </span>
        </div>

        {/* Compiled Savings Card */}
        <div className="stat-card">
          <div className="card-top">
            <span className="card-title">Total Compiled Savings</span>
            <div className="card-icon-wrap" style={{ backgroundColor: 'var(--purple-bg)', color: 'var(--purple)' }}>
              <PiggyBank size={18} />
            </div>
          </div>
          <div className="card-value">
            {data.userCurrency} {fmt(data.totalSavingsCompiled)}
          </div>
          <span className="card-subtitle">
            {data.monthlyDeficit > 0 ? 'Deficit deducted automatically' : 'All asset pools combined'}
          </span>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Income vs Expense Bar Chart */}
        <div className="content-card" style={{ marginBottom: 0 }}>
          <div className="card-header-bar">
            <div className="card-header-title">Monthly Cash Flow</div>
          </div>
          <div style={{ height: '260px' }}>
            <canvas ref={barChartRef}></canvas>
          </div>
        </div>

        {/* Category Breakdown Doughnut */}
        <div className="content-card" style={{ marginBottom: 0 }}>
          <div className="card-header-bar">
            <div className="card-header-title">Category Breakdown</div>
          </div>
          <div style={{ height: '260px' }}>
            {Object.keys(data.categoryData || {}).length > 0 ? (
              <canvas ref={doughnutChartRef}></canvas>
            ) : (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
                No category expenses logged this month.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Budget Progress & Recent Transactions Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Budget Progress */}
        <div className="content-card">
          <div className="card-header-bar">
            <div className="card-header-title">
              <PieChart size={18} />
              <span>Budget Progress</span>
            </div>
            <Link to="/budgets" className="btn btn-outline btn-sm">
              Manage Budgets <ArrowRight size={14} />
            </Link>
          </div>

          {data.budgetProgress && data.budgetProgress.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {data.budgetProgress.map((b) => {
                const isExceeded = b.percent > 100;
                return (
                  <div key={b.id || b.category}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{b.category}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          {data.userCurrency} {fmt(b.spent)} / {data.userCurrency} {fmt(b.limit)}
                        </span>
                        {isExceeded && (
                          <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                            <AlertTriangle size={12} /> Exceeded!
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="progress-bar-wrap">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${Math.min(100, b.percent)}%`,
                          backgroundColor: isExceeded ? 'var(--danger)' : b.percent > 80 ? 'var(--warning)' : 'var(--primary)'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <p>No budgets configured for this month.</p>
              <Link to="/budgets" className="btn btn-outline btn-sm" style={{ marginTop: '12px' }}>
                Set Category Limits
              </Link>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="content-card">
          <div className="card-header-bar">
            <div className="card-header-title">
              <Receipt size={18} />
              <span>Recent Transactions</span>
            </div>
            <Link to="/transactions" className="btn btn-outline btn-sm">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {data.recentTransactions && data.recentTransactions.length > 0 ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTransactions.map((tx) => {
                    const isIncome = tx.type === 'income';
                    return (
                      <tr key={tx._id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{tx.date}</td>
                        <td style={{ fontWeight: 500 }}>{tx.description || 'Transaction'}</td>
                        <td>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {tx.Category ? tx.Category.name : 'Uncategorized'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          <span className={isIncome ? 'badge-income' : 'badge-expense'} style={{ padding: '3px 8px', borderRadius: '6px' }}>
                            {isIncome ? '+' : '-'} {data.userCurrency} {fmt(tx.amtInUserCurrency)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <p>No transactions logged yet.</p>
              <Link to="/transactions" className="btn btn-primary btn-sm" style={{ marginTop: '12px' }}>
                Log First Transaction
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
