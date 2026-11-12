import React, { useMemo, useState } from 'react';
import { CircularProgress } from '@mui/material';
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FaArrowLeft,
  FaArrowRight,
  FaCarSide,
  FaClipboardList,
  FaMoneyBillWave,
  FaTools,
} from 'react-icons/fa';
import {
  useGetAdvanceRequestsForFinanceQuery,
  useGetApprovedForFinanceQuery,
} from '../../api/services NodeJs/vehicleRentApi';
import { useGetVehicleAppMaintenanceRequestsQuery } from '../../api/services NodeJs/vehicleAppApi';
import { useGetMaintenanceVoucherHistoryQuery } from '../../api/services NodeJs/maintenanceVoucherApi';
import VehicleRent from '../finance/vehicleRent/VehicleRent';
import DriverAdvanceFinance from '../finance/driverAdvance/DriverAdvanceFinance';
import MaintenanceFinance from '../finance/maintenance/MaintenanceFinance';
import '../../styles/transportFinanceDashboard.css';

function getRollingMonthOptions(monthsBack = 24) {
  const now = new Date();
  const out = [];
  for (let i = 0; i < monthsBack; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    out.push({ value, label });
  }
  return out;
}

function toMoney(value) {
  return Number(value || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const MODULE_ICONS = {
  vehicleSummary: { Icon: FaCarSide, tone: 'slate' },
  monthlyRecords: { Icon: FaClipboardList, tone: 'amber' },
  driverAdvance: { Icon: FaMoneyBillWave, tone: 'teal' },
  maintenanceFinance: { Icon: FaTools, tone: 'navy' },
};

function TransportFinanceDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  // Maintenance queue is not month-bound by default (pending work spans months).
  const [maintenanceMonth, setMaintenanceMonth] = useState('');
  const [activeSection, setActiveSection] = useState('');

  const monthOptions = useMemo(() => getRollingMonthOptions(36), []);
  const selectedMonthLabel = monthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth;
  const maintenanceMonthLabel = maintenanceMonth
    ? (monthOptions.find((m) => m.value === maintenanceMonth)?.label || maintenanceMonth)
    : 'All months';

  const { data: rentRows = [], isLoading: rentLoading } = useGetApprovedForFinanceQuery({ yearMonth: selectedMonth });
  const { data: advanceRows = [], isLoading: advanceLoading } = useGetAdvanceRequestsForFinanceQuery({ yearMonth: selectedMonth });
  const { data: maintenanceRows = [], isLoading: maintenanceLoading } = useGetVehicleAppMaintenanceRequestsQuery(
    maintenanceMonth || ''
  );
  const { data: maintenanceVoucherHistory = [] } = useGetMaintenanceVoucherHistoryQuery();

  const kpi = useMemo(() => {
    const rentPendingApproval = rentRows.filter((r) => String(r.finance_approval || 'p') === 'p').length;
    const rentApprovedNotPaid = rentRows.filter(
      (r) => String(r.finance_approval || 'p') === 'a' && Number(r.finance_paid) !== 1
    ).length;
    const rentPaidCount = rentRows.filter((r) => Number(r.finance_paid) === 1).length;

    const advPendingApproval = advanceRows.filter((r) => String(r.finance_approval || 'p') === 'p').length;
    const advApprovedNotPaid = advanceRows.filter(
      (r) => String(r.finance_approval || 'p') === 'a' && Number(r.finance_paid) !== 1
    ).length;
    const advPaidCount = advanceRows.filter((r) => Number(r.finance_paid) === 1).length;

    const rentPaidAmount = rentRows.reduce((sum, row) => (
      Number(row.finance_paid) === 1 ? sum + Number(row.net_monthly_rent ?? row.monthly_rent ?? 0) : sum
    ), 0);
    const advancePaidAmount = advanceRows.reduce((sum, row) => (
      Number(row.finance_paid) === 1 ? sum + Number(row.amount || 0) : sum
    ), 0);

    const maintenancePendingFinance = maintenanceRows.filter(
      (r) => String(r.hr_approval || r.approval || 'p') === 'a' && String(r.finance_approval || 'p') === 'p'
    ).length;
    const maintenanceApprovedNotPaid = maintenanceRows.filter(
      (r) => String(r.finance_approval || 'p') === 'a' && Number(r.finance_paid || 0) !== 1
    ).length;
    const maintenancePaidCount = maintenanceRows.filter((r) => Number(r.finance_paid || 0) === 1).length;
    const maintenancePaidAmount = maintenanceRows.reduce((sum, row) => (
      Number(row.finance_paid) === 1 ? sum + Number(row.cost_estimation || 0) : sum
    ), 0);
    const maintenanceVoucherPending = maintenanceVoucherHistory.filter((v) => v.status === 'pending').length;
    const maintenanceVoucherApprovedUnpaid = maintenanceVoucherHistory.filter((v) => v.status === 'approved' && !v.settled).length;

    return {
      rentPendingApproval,
      rentApprovedNotPaid,
      rentPaidCount,
      advPendingApproval,
      advApprovedNotPaid,
      advPaidCount,
      maintenancePendingFinance,
      maintenanceApprovedNotPaid,
      maintenancePaidCount,
      maintenancePaidAmount,
      maintenanceVoucherPending,
      maintenanceVoucherApprovedUnpaid,
      totalPaidAmount: rentPaidAmount + advancePaidAmount + maintenancePaidAmount,
      rentPaidAmount,
      advancePaidAmount,
      pendingFinanceTotal: rentPendingApproval + advPendingApproval + maintenancePendingFinance,
      approvedNotPaidTotal: rentApprovedNotPaid + advApprovedNotPaid + maintenanceApprovedNotPaid,
      paidRecordsTotal: rentPaidCount + advPaidCount + maintenancePaidCount,
    };
  }, [rentRows, advanceRows, maintenanceRows, maintenanceVoucherHistory]);

  const rentByVehicleChart = useMemo(() => {
    const map = new Map();
    rentRows.forEach((row) => {
      if (Number(row.finance_paid) !== 1) return;
      const key = String(row.vehicle_no || row.vehicle || 'Unknown').trim() || 'Unknown';
      map.set(key, (map.get(key) || 0) + Number(row.net_monthly_rent ?? row.monthly_rent ?? 0));
    });
    return [...map.entries()]
      .map(([name, amount]) => ({ name, amount: Number(amount.toFixed(2)) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [rentRows]);

  const advanceByDriverChart = useMemo(() => {
    const map = new Map();
    advanceRows.forEach((row) => {
      if (Number(row.finance_paid) !== 1) return;
      const key = String(row.requested_by_name || row.driver_name || 'Unknown').trim() || 'Unknown';
      map.set(key, (map.get(key) || 0) + Number(row.amount || 0));
    });
    return [...map.entries()]
      .map(([name, amount]) => ({ name, amount: Number(amount.toFixed(2)) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [advanceRows]);

  const loading = rentLoading || advanceLoading || maintenanceLoading;
  const attentionCount = kpi.pendingFinanceTotal + kpi.approvedNotPaidTotal;

  const sectionCards = [
    {
      key: 'vehicleSummary',
      title: 'Vehicle Summary',
      caption: 'Month-wise rent totals and deductions.',
    },
    {
      key: 'monthlyRecords',
      title: 'Monthly Records',
      caption: 'Approve rent and mark payments with proof.',
      stats: [
        { label: 'Pending', value: kpi.rentPendingApproval, tone: 'pending' },
        { label: 'Not paid', value: kpi.rentApprovedNotPaid, tone: 'approvedNotPaid' },
        { label: 'Paid', value: kpi.rentPaidCount, tone: 'paid' },
      ],
    },
    {
      key: 'driverAdvance',
      title: 'Driver Advance',
      caption: 'Approve advances and attach payment proof.',
      stats: [
        { label: 'Pending', value: kpi.advPendingApproval, tone: 'pending' },
        { label: 'Not paid', value: kpi.advApprovedNotPaid, tone: 'approvedNotPaid' },
        { label: 'Paid', value: kpi.advPaidCount, tone: 'paid' },
      ],
    },
    {
      key: 'maintenanceFinance',
      title: 'Maintenance',
      caption: 'Approve → voucher → MD → settle.',
      stats: [
        { label: 'Pending', value: kpi.maintenancePendingFinance, tone: 'pending' },
        { label: 'MD queue', value: kpi.maintenanceVoucherPending, tone: 'pending' },
        { label: 'Settle', value: kpi.maintenanceVoucherApprovedUnpaid, tone: 'approvedNotPaid' },
        { label: 'Paid', value: kpi.maintenancePaidCount, tone: 'paid' },
      ],
    },
  ];

  const activeCard = sectionCards.find((s) => s.key === activeSection);
  const isMaintenanceSection = activeSection === 'maintenanceFinance';

  const renderActiveSection = () => {
    if (activeSection === 'vehicleSummary') {
      return (
        <VehicleRent
          embedded
          externalMonth={selectedMonth}
          forcedTab={0}
          lockTab
          onMonthChange={setSelectedMonth}
        />
      );
    }
    if (activeSection === 'monthlyRecords') {
      return (
        <VehicleRent
          embedded
          externalMonth={selectedMonth}
          forcedTab={1}
          lockTab
          onMonthChange={setSelectedMonth}
        />
      );
    }
    if (activeSection === 'driverAdvance') {
      return <DriverAdvanceFinance embedded externalMonth={selectedMonth} onMonthChange={setSelectedMonth} />;
    }
    if (activeSection === 'maintenanceFinance') {
      return (
        <MaintenanceFinance
          embedded
          externalMonth={maintenanceMonth}
          onMonthChange={setMaintenanceMonth}
          prefetchedRows={maintenanceRows}
          prefetchedLoading={maintenanceLoading}
        />
      );
    }
    return null;
  };

  const monthSelect = (
    <label className="transport-finance-month-filter">
      <span>Billing month</span>
      <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
        {monthOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );

  if (activeSection) {
    return (
      <div className="transport-finance-shell transport-finance-shell--drilled">
        <div className="transport-finance-standalone-panel">
          <div className="transport-finance-section-toolbar">
            <div className="transport-finance-section-toolbar-left">
              <button
                type="button"
                className="transport-finance-back-btn"
                onClick={() => setActiveSection('')}
              >
                <FaArrowLeft aria-hidden /> Back
              </button>
              <div>
                <strong>{activeCard?.title || 'Finance Section'}</strong>
                <span className="transport-finance-section-toolbar-meta">
                  {isMaintenanceSection
                    ? `Queue · ${maintenanceMonthLabel}`
                    : selectedMonthLabel}
                </span>
              </div>
            </div>
            {!isMaintenanceSection ? monthSelect : null}
          </div>
          <div className="transport-finance-section-wrap">
            {renderActiveSection()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="transport-finance-shell">
      <header className="transport-finance-hero">
        <div className="transport-finance-hero-copy">
          <p className="transport-finance-hero-kicker">Finance · Transport</p>
          <h1>Transport Payments</h1>
          <p className="transport-finance-hero-lead">
            Approve and settle vehicle rent, driver advances, and maintenance in one queue.
          </p>
        </div>
        <div className="transport-finance-hero-aside">
          {!loading ? (
            <div className="transport-finance-hero-pulse" aria-live="polite">
              <span className={`transport-finance-pulse-dot${attentionCount > 0 ? ' is-active' : ''}`} />
              <span>
                {attentionCount > 0
                  ? `${attentionCount} need attention`
                  : 'All clear'}
              </span>
            </div>
          ) : null}
          {monthSelect}
        </div>
      </header>

      {loading ? (
        <div className="transport-finance-loading">
          <CircularProgress size={36} />
          <p>Loading finance summary…</p>
        </div>
      ) : (
        <>
          <section className="transport-finance-kpi-panel" aria-label="Month summary">
            <article className="transport-finance-kpi-card transport-finance-kpi-card--paid">
              <div className="transport-finance-kpi-label">Total paid</div>
              <div className="transport-finance-kpi-value">
                <small>LKR</small>
                {toMoney(kpi.totalPaidAmount)}
              </div>
              <dl className="transport-finance-kpi-breakdown">
                <div><dt>Rent</dt><dd>{toMoney(kpi.rentPaidAmount)}</dd></div>
                <div><dt>Advance</dt><dd>{toMoney(kpi.advancePaidAmount)}</dd></div>
                <div><dt>Maint</dt><dd>{toMoney(kpi.maintenancePaidAmount)}</dd></div>
              </dl>
            </article>

            <article className="transport-finance-kpi-card transport-finance-kpi-card--pending">
              <div className="transport-finance-kpi-label">Pending approvals</div>
              <div className="transport-finance-kpi-value">{kpi.pendingFinanceTotal}</div>
              <dl className="transport-finance-kpi-breakdown">
                <div><dt>Rent</dt><dd>{kpi.rentPendingApproval}</dd></div>
                <div><dt>Advance</dt><dd>{kpi.advPendingApproval}</dd></div>
                <div><dt>Maint</dt><dd>{kpi.maintenancePendingFinance}</dd></div>
              </dl>
            </article>

            <article className="transport-finance-kpi-card transport-finance-kpi-card--unpaid">
              <div className="transport-finance-kpi-label">Approved, not paid</div>
              <div className="transport-finance-kpi-value">{kpi.approvedNotPaidTotal}</div>
              <dl className="transport-finance-kpi-breakdown">
                <div><dt>Rent</dt><dd>{kpi.rentApprovedNotPaid}</dd></div>
                <div><dt>Advance</dt><dd>{kpi.advApprovedNotPaid}</dd></div>
                <div><dt>Maint</dt><dd>{kpi.maintenanceApprovedNotPaid}</dd></div>
              </dl>
            </article>

            <article className="transport-finance-kpi-card transport-finance-kpi-card--records">
              <div className="transport-finance-kpi-label">Paid records</div>
              <div className="transport-finance-kpi-value">{kpi.paidRecordsTotal}</div>
              <dl className="transport-finance-kpi-breakdown">
                <div><dt>Rent</dt><dd>{kpi.rentPaidCount}</dd></div>
                <div><dt>Advance</dt><dd>{kpi.advPaidCount}</dd></div>
                <div><dt>Maint</dt><dd>{kpi.maintenancePaidCount}</dd></div>
              </dl>
            </article>
          </section>

          <section className="transport-finance-block">
            <div className="transport-finance-block-head">
              <h2>Work queues</h2>
              <p>Select a queue to process</p>
            </div>

            <div className="transport-finance-module-grid" role="list">
              {sectionCards.map((card) => {
                const meta = MODULE_ICONS[card.key] || MODULE_ICONS.vehicleSummary;
                const { Icon } = meta;
                const waiting = (card.stats || [])
                  .filter((s) => s.tone !== 'paid')
                  .reduce((sum, s) => sum + Number(s.value || 0), 0);
                return (
                  <button
                    key={card.key}
                    type="button"
                    className="transport-finance-module-card"
                    role="listitem"
                    onClick={() => setActiveSection(card.key)}
                  >
                    <div className="transport-finance-module-top">
                      <span
                        className={`transport-finance-module-icon transport-finance-module-icon--${meta.tone || 'navy'}`}
                        aria-hidden
                      >
                        <Icon />
                      </span>
                      <div className="transport-finance-module-copy">
                        <strong>{card.title}</strong>
                        <span>{card.caption}</span>
                      </div>
                      {waiting > 0 ? (
                        <span className="transport-finance-module-badge" title="Needs attention">
                          {waiting}
                        </span>
                      ) : null}
                    </div>
                    {card.stats ? (
                      <div className="transport-finance-module-stats">
                        {card.stats.map((stat) => (
                          <div
                            key={`${card.key}-${stat.label}`}
                            className={`transport-finance-module-stat ${stat.tone}`}
                          >
                            <span>{stat.label}</span>
                            <b>{stat.value}</b>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="transport-finance-module-note">Month totals &amp; deductions</div>
                    )}
                    <span className="transport-finance-module-go">
                      Open <FaArrowRight aria-hidden />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="transport-finance-block">
            <div className="transport-finance-block-head">
              <h2>Paid this month</h2>
              <p>{selectedMonthLabel}</p>
            </div>

            <div className="transport-finance-chart-grid">
              <div className="transport-finance-chart-card">
                <div className="transport-finance-chart-head">
                  <h3>Paid rent by vehicle</h3>
                  <span>Top 8</span>
                </div>
                {rentByVehicleChart.length ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={rentByVehicleChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8eef3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-18} textAnchor="end" height={44} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={40} />
                      <Tooltip formatter={(value) => [`LKR ${toMoney(value)}`, 'Paid']} />
                      <Bar dataKey="amount" name="Paid" fill="#0c4a6e" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="transport-finance-chart-empty">No paid rent for this month.</div>
                )}
              </div>

              <div className="transport-finance-chart-card">
                <div className="transport-finance-chart-head">
                  <h3>Paid advance by driver</h3>
                  <span>Top 8</span>
                </div>
                {advanceByDriverChart.length ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={advanceByDriverChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8eef3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-18} textAnchor="end" height={44} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={40} />
                      <Tooltip formatter={(value) => [`LKR ${toMoney(value)}`, 'Paid']} />
                      <Bar dataKey="amount" name="Paid" fill="#0f766e" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="transport-finance-chart-empty">No paid advance for this month.</div>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default TransportFinanceDashboard;
