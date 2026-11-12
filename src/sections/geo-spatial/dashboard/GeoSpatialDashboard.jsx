import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import {
  FaSync,
  FaMap,
  FaUnlock,
  FaCloudSunRain,
  FaLayerGroup,
  FaTree,
  FaGlobeAsia,
  FaHome,
  FaThLarge,
  FaBorderAll,
  FaCheckCircle,
  FaMapMarkerAlt,
  FaExclamationTriangle,
  FaArrowRight,
  FaFileExcel,
  FaDrawPolygon,
} from 'react-icons/fa';
import {
  useGetMappingDashboardStatsQuery,
  useLazyGetMappingAllFieldsReportQuery,
} from '../../../api/services NodeJs/mappingHierarchyApi';
import './geoSpatialDashboard.css';

const FIELD_COLORS = {
  can: '#0f766e',
  blocked: '#b91c1c',
};

function isBlockedFlag(value) {
  return !(Number(value) === 1 || value === true || value === '1');
}

function buildBlockedFieldsSheet(allFields, missionType) {
  const isSpray = missionType === 'spray';
  const rows = (allFields || [])
    .filter((field) => (isSpray ? isBlockedFlag(field.can_spray) : isBlockedFlag(field.can_spread)))
    .map((field) => ({
      Group: field.group_name || '',
      Plantation: field.plantation_name || '',
      Region: field.region_name || '',
      Estate: field.estate_name || '',
      Division: field.division_name || '',
      'Field Name': field.field || '',
      'Short Name': field.short_name || '',
      Area: field.area ?? '',
      Status: field.activated ? 'Active' : 'Inactive',
      'Mission Type': isSpray ? 'Spray' : 'Spread',
      'Can Mission': 'No',
      Reason: isSpray
        ? field.spray_reason_name || field.can_spray_text || 'No reason recorded'
        : field.spread_reason_name || field.can_spread_text || 'No reason recorded',
    }));

  return rows;
}

function downloadBlockedMissionExcel(allFields, missionType) {
  const isSpray = missionType === 'spray';
  const rows = buildBlockedFieldsSheet(allFields, missionType);
  if (!rows.length) {
    toast.warning(`No blocked ${isSpray ? 'spray' : 'spread'} fields found`);
    return;
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 20 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 16 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 36 },
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = isSpray ? 'Spray Cannot' : 'Spread Cannot';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${isSpray ? 'Spray' : 'Spread'}_Cannot_Fields_${stamp}.xlsx`);
  toast.success(`${rows.length} blocked ${isSpray ? 'spray' : 'spread'} field(s) exported`);
}

function pct(part, total) {
  const t = Number(total) || 0;
  if (t <= 0) return 0;
  return Math.round((Number(part || 0) / t) * 100);
}

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function StatCard({ icon: Icon, label, value, hint, tone = 'slate', onClick }) {
  const interactive = Boolean(onClick);
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      className={`geo-dash-stat-card geo-dash-stat-card--${tone}${interactive ? ' is-clickable' : ''}`}
      onClick={onClick}
    >
      <div className="geo-dash-stat-icon" aria-hidden="true">
        <Icon />
      </div>
      <div className="geo-dash-stat-body">
        <span className="geo-dash-stat-label">{label}</span>
        <strong className="geo-dash-stat-value">{formatCount(value)}</strong>
        {hint ? <span className="geo-dash-stat-hint">{hint}</span> : null}
      </div>
      {interactive ? <FaArrowRight className="geo-dash-stat-arrow" aria-hidden="true" /> : null}
    </Tag>
  );
}

function ProgressMeter({ label, value, total, tone = 'teal', detail }) {
  const percent = pct(value, total);
  return (
    <div className="geo-dash-meter">
      <div className="geo-dash-meter-head">
        <span>{label}</span>
        <strong>
          {formatCount(value)} / {formatCount(total)}
          <em>{percent}%</em>
        </strong>
      </div>
      <div className="geo-dash-meter-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={`geo-dash-meter-fill geo-dash-meter-fill--${tone}`} style={{ width: `${percent}%` }} />
      </div>
      {detail ? <p className="geo-dash-meter-detail">{detail}</p> : null}
    </div>
  );
}

function AttentionCard({ icon: Icon, label, value, tone, actionLabel, onAction }) {
  return (
    <div className={`geo-dash-attention-card geo-dash-attention-card--${tone}`}>
      <div className="geo-dash-attention-top">
        <span className="geo-dash-attention-icon" aria-hidden="true">
          <Icon />
        </span>
        <div>
          <span className="geo-dash-attention-label">{label}</span>
          <strong className="geo-dash-attention-value">{formatCount(value)}</strong>
        </div>
      </div>
      {onAction ? (
        <button type="button" className="geo-dash-link-btn" onClick={onAction}>
          {actionLabel} <FaArrowRight />
        </button>
      ) : null}
    </div>
  );
}

function Panel({ title, subtitle, action, children }) {
  return (
    <section className="geo-dash-panel">
      <div className="geo-dash-panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action || null}
      </div>
      {children}
    </section>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="geo-dash-tooltip">
      <strong>{label || payload[0]?.payload?.name}</strong>
      {payload.map((item) => (
        <span key={item.dataKey || item.name}>
          {item.name}: {formatCount(item.value)}
        </span>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="geo-dash-skeleton" aria-hidden="true">
      <div className="geo-dash-skeleton-row geo-dash-skeleton-row--3">
        <div className="geo-dash-skeleton-block" />
        <div className="geo-dash-skeleton-block" />
        <div className="geo-dash-skeleton-block" />
      </div>
      <div className="geo-dash-skeleton-row geo-dash-skeleton-row--6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="geo-dash-skeleton-block" />
        ))}
      </div>
      <div className="geo-dash-skeleton-row geo-dash-skeleton-row--2">
        <div className="geo-dash-skeleton-block geo-dash-skeleton-block--tall" />
        <div className="geo-dash-skeleton-block geo-dash-skeleton-block--tall" />
      </div>
    </div>
  );
}

const GeoSpatialDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isLoading, isFetching, refetch, isError, error } = useGetMappingDashboardStatsQuery();
  const [triggerAllFieldsReport] = useLazyGetMappingAllFieldsReportQuery();
  const [exportingMission, setExportingMission] = useState(null);

  const stats = data?.data || null;
  const go = (pathname) => navigate({ pathname, search: location.search });

  const fieldMissionChartData = useMemo(() => {
    const fields = stats?.fields || {};
    return [
      {
        name: 'Spray',
        Allowed: fields.canSpray || 0,
        Blocked: fields.sprayBlocked || 0,
        missionType: 'spray',
      },
      {
        name: 'Spread',
        Allowed: fields.canSpread || 0,
        Blocked: fields.spreadBlocked || 0,
        missionType: 'spread',
      },
    ];
  }, [stats]);

  const handleExportBlockedMission = async (missionType) => {
    if (!missionType || exportingMission) return;
    setExportingMission(missionType);
    try {
      const result = await triggerAllFieldsReport().unwrap();
      const allFields = result?.data || [];
      downloadBlockedMissionExcel(allFields, missionType);
    } catch (err) {
      toast.error(err?.data?.message || err?.error || 'Failed to export blocked fields report');
    } finally {
      setExportingMission(null);
    }
  };

  const handleMissionBarClick = (barData) => {
    const payload = barData?.payload || barData || {};
    const missionType =
      payload.missionType ||
      barData?.missionType ||
      String(payload.name || barData?.name || '').toLowerCase();
    if (missionType === 'spray' || missionType === 'spread') {
      handleExportBlockedMission(missionType);
    }
  };

  const updatedLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  return (
    <div className="geo-dash-page">
      <header className="geo-dash-header">
        <div className="geo-dash-header-copy">
          <p className="geo-dash-eyebrow">GEO Spatial Technology Wing</p>
          <h1>Operations Dashboard</h1>
          <p className="geo-dash-subtitle">
            Monitor mapping hierarchy health, estate coordinate readiness, and field mission blocks in one place.
          </p>
        </div>
        <div className="geo-dash-header-actions">
          <span className="geo-dash-updated">{isFetching ? 'Updating…' : `Updated ${updatedLabel}`}</span>
          <button type="button" className="geo-dash-btn ghost" onClick={() => go('/home/create')}>
            <FaCloudSunRain /> Forecast
          </button>
          <button type="button" className="geo-dash-btn ghost" onClick={() => go('/home/geo-spatial/mapping-update')}>
            <FaMap /> Mapping Update
          </button>
          <button
            type="button"
            className="geo-dash-btn primary"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <FaSync className={isFetching ? 'geo-dash-spin' : undefined} /> Refresh
          </button>
        </div>
      </header>

      {isLoading ? <DashboardSkeleton /> : null}

      {isError ? (
        <div className="geo-dash-error" role="alert">
          <div>
            <strong>Could not load dashboard</strong>
            <p>{error?.data?.message || error?.error || 'Please try again in a moment.'}</p>
          </div>
          <button type="button" className="geo-dash-btn primary" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      {!isLoading && !isError && stats ? (
        <>
          <section className="geo-dash-section">
            <div className="geo-dash-section-label">Needs attention</div>
            <div className="geo-dash-attention-grid">
              <AttentionCard
                icon={FaUnlock}
                label="Pending unblock requests"
                value={stats.fieldUnblockRequests?.pending}
                tone="amber"
                actionLabel="Open queue"
                onAction={() => go('/home/geo-spatial/field-unblock-requests')}
              />
              <AttentionCard
                icon={FaMapMarkerAlt}
                label="Estates missing lat/lon"
                value={stats.estates?.missingCoordinates}
                tone="teal"
                actionLabel="Update coordinates"
                onAction={() => go('/home/geo-spatial/mapping-update')}
              />
              <AttentionCard
                icon={FaCloudSunRain}
                label="Divisions missing lat/lon"
                value={stats.divisions?.missingCoordinates}
                tone="blue"
                actionLabel="Update coordinates"
                onAction={() => go('/home/geo-spatial/mapping-update')}
              />
              <AttentionCard
                icon={FaExclamationTriangle}
                label="Fields blocked (spray / spread)"
                value={(stats.fields?.sprayBlocked || 0) + (stats.fields?.spreadBlocked || 0)}
                tone="rose"
                actionLabel="Review mapping"
                onAction={() => go('/home/geo-spatial/mapping-update')}
              />
            </div>
          </section>

          <section className="geo-dash-section">
            <div className="geo-dash-section-label">Hierarchy inventory</div>
            <div className="geo-dash-stat-grid">
              <StatCard icon={FaLayerGroup} label="Groups" value={stats.totals?.groups} tone="brown" />
              <StatCard icon={FaTree} label="Plantations" value={stats.totals?.plantations} tone="rust" />
              <StatCard icon={FaGlobeAsia} label="Regions" value={stats.totals?.regions} tone="amber" />
              <StatCard
                icon={FaHome}
                label="Estates"
                value={stats.totals?.estates}
                hint={`${formatCount(stats.estates?.finalized)} finalized`}
                tone="teal"
                onClick={() => go('/home/geo-spatial/mapping-update')}
              />
              <StatCard icon={FaThLarge} label="Divisions" value={stats.totals?.divisions} tone="blue" />
              <StatCard
                icon={FaBorderAll}
                label="Fields"
                value={stats.totals?.fields}
                hint={`${formatCount(stats.fields?.sprayBlocked)} spray blocked`}
                tone="slate"
              />
            </div>
          </section>

          <section className="geo-dash-chart-grid">
            <Panel
              title="Estate & division readiness"
              subtitle="Finalization, estate forecast coords, and division weather coords"
              action={
                <button type="button" className="geo-dash-link-btn" onClick={() => go('/home/geo-spatial/mapping-update')}>
                  Manage mapping <FaArrowRight />
                </button>
              }
            >
              <div className="geo-dash-meters">
                <ProgressMeter
                  label="Finalized estates"
                  value={stats.estates?.finalized}
                  total={stats.estates?.total}
                  tone="teal"
                  detail={`${formatCount(stats.estates?.notFinalized)} still need finalization`}
                />
                <ProgressMeter
                  label="Estate latitude / longitude set"
                  value={stats.estates?.withCoordinates}
                  total={stats.estates?.total}
                  tone="blue"
                  detail={`${formatCount(stats.estates?.missingCoordinates)} estates need coordinates for plan forecast`}
                />
                <ProgressMeter
                  label="Division latitude / longitude set"
                  value={stats.divisions?.withCoordinates}
                  total={stats.divisions?.total}
                  tone="amber"
                  detail={`${formatCount(stats.divisions?.missingCoordinates)} divisions need coordinates for weather prediction`}
                />
                <ProgressMeter
                  label="Field GeoJSON boundary uploaded"
                  value={stats.fields?.withBoundary}
                  total={stats.fields?.total}
                  tone="violet"
                  detail={`${formatCount(stats.fields?.missingBoundary)} fields still need a boundary`}
                />
              </div>
              <div className="geo-dash-mini-kpi-row">
                <div className="geo-dash-mini-kpi">
                  <FaCheckCircle />
                  <div>
                    <span>Finalized</span>
                    <strong>{formatCount(stats.estates?.finalized)}</strong>
                  </div>
                </div>
                <div className="geo-dash-mini-kpi">
                  <FaMapMarkerAlt />
                  <div>
                    <span>Estate coords</span>
                    <strong>{formatCount(stats.estates?.withCoordinates)}</strong>
                  </div>
                </div>
                <div className="geo-dash-mini-kpi">
                  <FaCloudSunRain />
                  <div>
                    <span>Division coords</span>
                    <strong>{formatCount(stats.divisions?.withCoordinates)}</strong>
                  </div>
                </div>
                <div className="geo-dash-mini-kpi">
                  <FaDrawPolygon />
                  <div>
                    <span>Field GeoJSON</span>
                    <strong>{formatCount(stats.fields?.withBoundary)}</strong>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel
              title="Field mission availability"
              subtitle="Click Spray or Spread bar to download cannot (blocked) Excel with reason"
            >
              <div className={`geo-dash-chart${exportingMission ? ' is-exporting' : ''}`}>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart
                    data={fieldMissionChartData}
                    margin={{ top: 6, right: 6, left: -12, bottom: 0 }}
                    style={{ cursor: exportingMission ? 'wait' : 'pointer' }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8eef5" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15, 118, 110, 0.04)' }} />
                    <Legend iconType="circle" />
                    <Bar
                      dataKey="Allowed"
                      stackId="mission"
                      fill={FIELD_COLORS.can}
                      radius={[0, 0, 0, 0]}
                      maxBarSize={48}
                      cursor="pointer"
                      onClick={(data) => handleMissionBarClick(data)}
                    />
                    <Bar
                      dataKey="Blocked"
                      stackId="mission"
                      fill={FIELD_COLORS.blocked}
                      radius={[8, 8, 0, 0]}
                      maxBarSize={48}
                      cursor="pointer"
                      onClick={(data) => handleMissionBarClick(data)}
                    />
                  </BarChart>
                </ResponsiveContainer>
                {exportingMission ? (
                  <p className="geo-dash-export-status">
                    <FaFileExcel /> Preparing {exportingMission} cannot report…
                  </p>
                ) : (
                  <p className="geo-dash-inline-note">
                    Tip: click the Spray or Spread bar to export blocked fields with reasons.
                  </p>
                )}
              </div>
              <div className="geo-dash-field-summary">
                <div>
                  <span>Total fields</span>
                  <strong>{formatCount(stats.fields?.total)}</strong>
                </div>
                <button
                  type="button"
                  className="geo-dash-field-summary-btn"
                  onClick={() => handleExportBlockedMission('spray')}
                  disabled={Boolean(exportingMission)}
                  title="Download spray cannot Excel"
                >
                  <span>Spray blocked</span>
                  <strong className="is-danger">{formatCount(stats.fields?.sprayBlocked)}</strong>
                </button>
                <button
                  type="button"
                  className="geo-dash-field-summary-btn"
                  onClick={() => handleExportBlockedMission('spread')}
                  disabled={Boolean(exportingMission)}
                  title="Download spread cannot Excel"
                >
                  <span>Spread blocked</span>
                  <strong className="is-danger">{formatCount(stats.fields?.spreadBlocked)}</strong>
                </button>
              </div>
            </Panel>

            <Panel
              title="Field unblock requests"
              subtitle="Requests to restore spray / spread on blocked fields"
              action={
                <button
                  type="button"
                  className="geo-dash-link-btn"
                  onClick={() => go('/home/geo-spatial/field-unblock-requests')}
                >
                  Open queue <FaArrowRight />
                </button>
              }
            >
              <div className="geo-dash-unblock-layout">
                <div className="geo-dash-unblock-hero">
                  <span>Pending review</span>
                  <strong>{formatCount(stats.fieldUnblockRequests?.pending)}</strong>
                  <p>These fields stay blocked until approved.</p>
                  <button
                    type="button"
                    className="geo-dash-btn primary"
                    onClick={() => go('/home/geo-spatial/field-unblock-requests')}
                  >
                    <FaUnlock /> Review requests
                  </button>
                </div>
                <div className="geo-dash-unblock-stats">
                  <div className="geo-dash-unblock-stat">
                    <span>Approved</span>
                    <strong>{formatCount(stats.fieldUnblockRequests?.approved)}</strong>
                  </div>
                  <div className="geo-dash-unblock-stat">
                    <span>Rejected</span>
                    <strong>{formatCount(stats.fieldUnblockRequests?.rejected)}</strong>
                  </div>
                  <div className="geo-dash-unblock-stat">
                    <span>All requests</span>
                    <strong>{formatCount(stats.fieldUnblockRequests?.total)}</strong>
                  </div>
                </div>
              </div>
            </Panel>
          </section>
        </>
      ) : null}
    </div>
  );
};

export default GeoSpatialDashboard;
