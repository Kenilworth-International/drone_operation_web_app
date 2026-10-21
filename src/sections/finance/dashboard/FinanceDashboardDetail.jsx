import React, { useMemo } from 'react';
import { CircularProgress } from '@mui/material';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FaArrowLeft, FaSyncAlt } from 'react-icons/fa';
import { withCurrentWingSearch } from '../../../config/wingRouteGuard';
import { useGetFinanceDashboardDetailQuery } from '../../../api/services NodeJs/financeDashboardApi';
import '../../../styles/financeDashboard.css';

const METRIC_TONES = {
  revenue_billed: 'income',
  revenue_collected: 'collected',
  expenses_billed: 'billed',
  expenses_paid: 'paid',
  net_billed: 'net-pos',
};

function fmtMoneyExact(value) {
  const n = Number(value) || 0;
  return `LKR ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtCell(value, kind) {
  if (kind === 'money') return fmtMoneyExact(value);
  if (value == null || value === '') return '—';
  return String(value);
}

export default function FinanceDashboardDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { metric: metricParam } = useParams();
  const [searchParams] = useSearchParams();
  const month = searchParams.get('month') || '';
  const metric = String(metricParam || '').toLowerCase();

  const { data, isLoading, isFetching, refetch, error } = useGetFinanceDashboardDetailQuery(
    { month: month || null, metric },
    { skip: !metric }
  );

  const goBack = () => {
    const base = withCurrentWingSearch('/home/finance/dashboard', location.search);
    const params = new URLSearchParams(String(base.search || '').replace(/^\?/, ''));
    if (month) params.set('month', month);
    const q = params.toString();
    navigate(`${base.pathname}${q ? `?${q}` : ''}`);
  };

  const columns = data?.columns || [];
  const rows = data?.rows || [];
  const summary = data?.summary || [];
  const tone =
    metric === 'net_billed'
      ? Number(data?.total) >= 0
        ? 'net-pos'
        : 'net-neg'
      : METRIC_TONES[metric] || 'income';

  const totalLabel = useMemo(() => {
    if (!data?.title) return 'Total';
    return data.title;
  }, [data?.title]);

  return (
    <div className="fd-page fd-detail-page">
      <header className="fd-top">
        <div className="fd-top-left">
          <button
            type="button"
            className="fd-refresh fd-back"
            onClick={goBack}
            title="Back to dashboard"
          >
            <FaArrowLeft aria-hidden />
            Back
          </button>
          <div className="fd-title-block">
            <p className="fd-eyebrow">Finance · KPI detail</p>
            <h1>{data?.title || 'KPI detail'}</h1>
            <p>
              {data?.month_label || month || 'Selected month'}
              {data?.description ? ` · ${data.description}` : ''}
            </p>
          </div>
        </div>
        <div className="fd-top-controls">
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
          {error?.data?.message || error?.error || 'Failed to load KPI detail'}
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className="fd-loading">
          <CircularProgress size={22} />
          <span>Loading…</span>
        </div>
      ) : data ? (
        <>
          <section className={`fd-detail-hero fd-kpi--${tone}`}>
            <div>
              <span className="fd-kpi-label">{totalLabel}</span>
              <strong className="fd-kpi-value">{fmtMoneyExact(data.total)}</strong>
            </div>
            {data.formula ? (
              <div className="fd-detail-formula">
                <span>{fmtMoneyExact(data.formula.revenue_billed)}</span>
                <em>−</em>
                <span>{fmtMoneyExact(data.formula.expenses_billed)}</span>
                <em>=</em>
                <strong>{fmtMoneyExact(data.formula.net_billed)}</strong>
              </div>
            ) : null}
          </section>

          {summary.length ? (
            <section className="fd-detail-summary">
              {summary.map((item, index) => (
                <article key={`fd-sum-${item.label}-${index}`} className="fd-detail-summary-card">
                  <span>{item.label}</span>
                  <strong>
                    {item.kind === 'money' ? fmtMoneyExact(item.value) : item.value}
                  </strong>
                </article>
              ))}
            </section>
          ) : null}

          <section className="fd-table-card">
            <div className="fd-card-head">
              <div>
                <h2>Breakdown</h2>
                <p>
                  {rows.length} row{rows.length === 1 ? '' : 's'} for {data.month_label || month}
                </p>
              </div>
            </div>
            <div className="fd-table-wrap">
              <table className="fd-table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} className={col.align === 'right' ? 'num' : undefined}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(columns.length, 1)}>No items for this month.</td>
                    </tr>
                  ) : (
                    rows.map((row, index) => (
                      <tr key={`fd-row-${row.id ?? row.ref ?? row.category ?? index}`}>
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className={col.align === 'right' ? 'num' : undefined}
                          >
                            {fmtCell(row[col.key], col.kind)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
