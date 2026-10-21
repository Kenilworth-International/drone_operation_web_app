import React, { useMemo, useState } from 'react';
import { CircularProgress } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FaChartLine,
  FaFileInvoiceDollar,
  FaMoneyBillWave,
  FaReceipt,
  FaSyncAlt,
  FaWallet,
} from 'react-icons/fa';
import { withCurrentWingSearch } from '../../../config/wingRouteGuard';
import { useGetFinanceDashboardSummaryQuery } from '../../../api/services NodeJs/financeDashboardApi';
import '../../../styles/financeDashboard.css';

const CATEGORY_COLORS = {
  fuel_vehicle: '#0ea5e9',
  fuel_generator: '#0284c7',
  vehicle_rent: '#f59e0b',
  payroll: '#047857',
  procurement: '#004b71',
  maintenance: '#64748b',
};

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function recentMonthOptions(count = 18) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' }),
    };
  });
}

function fmtMoney(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const compact = (n / 1_000_000).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `LKR ${compact}M`;
  }
  return `LKR ${n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtMoneyExact(value) {
  const n = Number(value) || 0;
  return `LKR ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildKpiDetailHref(metric, month, currentSearch) {
  const pathname = `/home/finance/dashboard/detail/${metric}`;
  const base = withCurrentWingSearch(pathname, currentSearch);
  const params = new URLSearchParams(String(base.search || '').replace(/^\?/, ''));
  if (month) params.set('month', month);
  const q = params.toString();
  return `${base.pathname}${q ? `?${q}` : ''}`;
}

function openKpiDetail(metric, month, currentSearch, navigate) {
  navigate(buildKpiDetailHref(metric, month, currentSearch));
}

function KpiCard({ tone, icon: Icon, label, value, meta, onOpen }) {
  return (
    <button
      type="button"
      className={`fd-kpi fd-kpi--clickable fd-kpi--${tone}`}
      onClick={onOpen}
      title={`Open ${label} detail`}
    >
      <div className="fd-kpi-head">
        <span className="fd-kpi-label">{label}</span>
        <span className="fd-kpi-icon" aria-hidden>
          <Icon />
        </span>
      </div>
      <strong className="fd-kpi-value">{value}</strong>
      {meta ? <span className="fd-kpi-meta">{meta}</span> : null}
      <span className="fd-kpi-cta">
        View detail
        <span aria-hidden>→</span>
      </span>
    </button>
  );
}

export default function FinanceDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => {
    const fromUrl = new URLSearchParams(location.search).get('month');
    return /^\d{4}-\d{2}$/.test(fromUrl || '') ? fromUrl : currentMonthKey();
  });
  const monthOptions = useMemo(() => recentMonthOptions(), []);

  const { data, isLoading, isFetching, refetch, error } = useGetFinanceDashboardSummaryQuery({ month });

  const openMetric = (metric) => openKpiDetail(metric, month, location.search, navigate);

  const kpis = data?.kpis || {};
  const categories = data?.expenses_by_category || [];
  const trend = data?.trend || [];
  const income = data?.income || {};
  const note = data?.note || {};

  const pieData = useMemo(
    () =>
      categories
        .filter((c) => Number(c.billed) > 0)
        .map((c) => ({
          name: c.label,
          value: Number(c.billed) || 0,
          key: c.key,
        })),
    [categories]
  );

  const billedPaidBars = useMemo(
    () =>
      categories.map((c) => ({
        name: c.label.replace('Fuel (', '').replace(')', ''),
        billed: Number(c.billed) || 0,
        paid: Number(c.paid) || 0,
      })),
    [categories]
  );

  const totalBilledCats = pieData.reduce((s, r) => s + r.value, 0) || 1;

  return (
    <div className="fd-page">
      <header className="fd-top">
        <div className="fd-title-block">
          <p className="fd-eyebrow">Finance</p>
          <h1>Financial Dashboard</h1>
          <p>
            Billed for P&amp;L · Paid for cash · Invoices pre/post
          </p>
        </div>
        <div className="fd-top-controls">
          <label className="fd-month-field" htmlFor="fd-month">
            <span>Month</span>
            <select id="fd-month" value={month} onChange={(e) => setMonth(e.target.value)}>
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                  {opt.value === currentMonthKey() ? ' (this month)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="fd-refresh"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh"
          >
            <FaSyncAlt className={isFetching ? 'fd-spin' : ''} aria-hidden />
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div className="fd-error">
          {error?.data?.message || error?.error || 'Failed to load finance dashboard'}
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className="fd-loading">
          <CircularProgress size={22} />
          <span>Loading…</span>
        </div>
      ) : (
        <>
          <section className="fd-kpi-row">
            <KpiCard
              tone="income"
              icon={FaWallet}
              label="Revenue billed"
              value={fmtMoney(kpis.revenue_billed)}
              meta={`${Number(kpis.invoices_pre || 0) + Number(kpis.invoices_post || 0)} invoices · Pre ${kpis.invoices_pre || 0} / Post ${kpis.invoices_post || 0}`}
              onOpen={() => openMetric('revenue_billed')}
            />
            <KpiCard
              tone="collected"
              icon={FaFileInvoiceDollar}
              label="Revenue collected"
              value={fmtMoney(kpis.revenue_collected)}
              meta={`${kpis.invoice_payments || 0} payments · cash received`}
              onOpen={() => openMetric('revenue_collected')}
            />
            <KpiCard
              tone="billed"
              icon={FaChartLine}
              label="Expenses billed"
              value={fmtMoney(kpis.expenses_billed)}
              meta="By activity / obligation month"
              onOpen={() => openMetric('expenses_billed')}
            />
            <KpiCard
              tone="paid"
              icon={FaMoneyBillWave}
              label="Expenses paid"
              value={fmtMoney(kpis.expenses_paid)}
              meta="By cash settlement month"
              onOpen={() => openMetric('expenses_paid')}
            />
            <KpiCard
              tone={Number(kpis.net_billed) >= 0 ? 'net-pos' : 'net-neg'}
              icon={FaReceipt}
              label="Net (billed)"
              value={fmtMoney(kpis.net_billed)}
              meta="Revenue billed − expenses billed"
              onOpen={() => openMetric('net_billed')}
            />
          </section>

          <section className="fd-grid">
            <article className="fd-card fd-card--wide">
              <div className="fd-card-head">
                <div>
                  <h2>Revenue vs expenses</h2>
                  <p>Last 6 months · billed for P&amp;L, paid for cash</p>
                </div>
              </div>
              <div className="fd-chart">
                <ResponsiveContainer width="100%" height={190}>
                  <AreaChart data={trend} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fdRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#004b71" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#004b71" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="fdExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ea580c" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#ea580c" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                      tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(v, name) => [fmtMoneyExact(v), name]}
                      contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 11, padding: '6px 8px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="revenue_billed"
                      name="Revenue billed"
                      stroke="#004b71"
                      fill="url(#fdRev)"
                      strokeWidth={1.8}
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses_billed"
                      name="Expenses billed"
                      stroke="#ea580c"
                      fill="url(#fdExp)"
                      strokeWidth={1.8}
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses_paid"
                      name="Expenses paid"
                      stroke="#94a3b8"
                      fill="transparent"
                      strokeWidth={1.4}
                      strokeDasharray="4 3"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="fd-card">
              <div className="fd-card-head">
                <div>
                  <h2>Expense mix</h2>
                  <p>Billed share · {data?.month_label || month}</p>
                </div>
              </div>
              <div className="fd-donut-wrap">
                <div className="fd-chart fd-chart--donut">
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie
                        data={pieData.length ? pieData : [{ name: 'None', value: 1, key: 'none' }]}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={42}
                        outerRadius={62}
                        paddingAngle={2}
                      >
                        {(pieData.length ? pieData : [{ key: 'none' }]).map((entry) => (
                          <Cell
                            key={entry.key}
                            fill={CATEGORY_COLORS[entry.key] || '#cbd5e1'}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, name) => [fmtMoneyExact(v), name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="fd-donut-center">
                    <span>Billed</span>
                    <strong>{fmtMoney(kpis.expenses_billed)}</strong>
                  </div>
                </div>
                <ul className="fd-legend">
                  {categories.map((c) => (
                    <li key={c.key}>
                      <span
                        className="fd-legend-dot"
                        style={{ background: CATEGORY_COLORS[c.key] || '#94a3b8' }}
                      />
                      <span className="fd-legend-name">{c.label}</span>
                      <span className="fd-legend-val">
                        {((Number(c.billed) / totalBilledCats) * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <article className="fd-card fd-card--wide">
              <div className="fd-card-head">
                <div>
                  <h2>Billed vs paid by category</h2>
                  <p>
                    Example: Sept fuel paid on Oct 2 counts as <em>billed in Sept</em>, <em>paid in Oct</em>
                  </p>
                </div>
              </div>
              <div className="fd-chart">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={billedPaidBars} margin={{ top: 4, right: 6, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                      tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(v, name) => [fmtMoneyExact(v), name]}
                      contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 11, padding: '6px 8px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="billed" name="Billed" fill="#004b71" radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="paid" name="Paid" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="fd-card">
              <div className="fd-card-head">
                <div>
                  <h2>Income snapshot</h2>
                  <p>Plantation invoices · {data?.month_label || month}</p>
                </div>
              </div>
              <div className="fd-income-stats">
                <div>
                  <span>Pre-invoices sent</span>
                  <strong>{income.invoices?.pre ?? kpis.invoices_pre ?? 0}</strong>
                </div>
                <div>
                  <span>Post / tax invoices</span>
                  <strong>{income.invoices?.post ?? kpis.invoices_post ?? 0}</strong>
                </div>
                <div>
                  <span>Credit notes</span>
                  <strong>{income.invoices?.credit_note ?? kpis.invoices_credit_note ?? 0}</strong>
                </div>
                <div>
                  <span>Billed amount</span>
                  <strong>{fmtMoneyExact(income.invoices?.billed_amount ?? kpis.revenue_billed)}</strong>
                </div>
                <div>
                  <span>Collected</span>
                  <strong>{fmtMoneyExact(income.collected?.amount ?? kpis.revenue_collected)}</strong>
                </div>
                <div>
                  <span>Payments</span>
                  <strong>{income.collected?.payment_count ?? kpis.invoice_payments ?? 0}</strong>
                </div>
              </div>
            </article>
          </section>

          <section className="fd-table-card">
            <div className="fd-card-head">
              <div>
                <h2>Category detail</h2>
                <p>Compare billed obligation vs cash paid for {data?.month_label || month}</p>
              </div>
            </div>
            <div className="fd-table-wrap">
              <table className="fd-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">Billed</th>
                    <th className="num">Paid</th>
                    <th className="num">Gap (unpaid billed)</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => {
                    const gap = Math.max(0, Number(c.billed || 0) - Number(c.paid || 0));
                    return (
                      <tr key={c.key}>
                        <td>
                          <span
                            className="fd-legend-dot"
                            style={{ background: CATEGORY_COLORS[c.key] || '#94a3b8' }}
                          />
                          {c.label}
                        </td>
                        <td className="num">{fmtMoneyExact(c.billed)}</td>
                        <td className="num">{fmtMoneyExact(c.paid)}</td>
                        <td className="num">{fmtMoneyExact(gap)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="num">{fmtMoneyExact(kpis.expenses_billed)}</td>
                    <td className="num">{fmtMoneyExact(kpis.expenses_paid)}</td>
                    <td className="num">
                      {fmtMoneyExact(Math.max(0, Number(kpis.expenses_billed || 0) - Number(kpis.expenses_paid || 0)))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <footer className="fd-footnote">
            <p>{note.billed}</p>
            <p>{note.paid}</p>
            <p>{note.revenue}</p>
          </footer>
        </>
      )}
    </div>
  );
}
