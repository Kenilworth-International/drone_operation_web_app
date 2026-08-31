import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaSync, FaServer, FaExclamationTriangle, FaCheckCircle, FaDatabase, FaMicrochip } from 'react-icons/fa';
import { Bars } from 'react-loader-spinner';
import {
  useGetSystemMaintenanceOverviewQuery,
  useGetSystemMaintenanceBackupStatusQuery,
  useLazyGetSystemMaintenancePm2LogsQuery,
  useRestartPm2ProcessMutation,
  useTriggerSystemBackupMutation,
} from '../../../api/services NodeJs/systemMaintenanceApi';
import Pm2ProcessCard from './components/Pm2ProcessCard';
import HostMetricsPanel from './components/HostMetricsPanel';
import BackupPanel from './components/BackupPanel';
import LogTailModal from './components/LogTailModal';
import JenkinsPanel from './components/JenkinsPanel';
import { FEATURE_CODES } from '../../../utils/featurePermissions';
import { isInternalDeveloper } from '../../../utils/authUtils';
import { useGetMyPermissionsQuery } from '../../../api/services NodeJs/featurePermissionsApi';
import { useNavbarPermissions } from '../../../hooks/useNavbarPermissions';
import '../../../styles/systemMaintenancePage.css';

const SYSTEM_MAINTENANCE_PATH = '/home/ict/system-admin/system-maintenance';

function formatCollectedAt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function hoursSince(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

function toneFromState(state) {
  const s = String(state || '').toLowerCase();
  if (s === 'healthy' || s === 'online' || s === 'success') return 'ok';
  if (s === 'warning' || s === 'running' || s === 'unstable') return 'warn';
  if (s === 'critical' || s === 'failed' || s === 'offline') return 'bad';
  return 'muted';
}

function isApiReachabilityError(error) {
  return error?.status === 'FETCH_ERROR' || error?.status === 'PARSING_ERROR';
}

function formatMaintenanceLoadError(error) {
  if (isApiReachabilityError(error)) {
    return 'Could not reach the DSMS API. The server may be restarting, or the API process (dsms-api-prod) may be offline. Refresh in a moment or contact ICT if this continues.';
  }
  return error?.data?.message || error?.message || 'Unknown error';
}

const SystemMaintenancePage = () => {
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  const userId = userData?.id || null;
  const isDeveloper = isInternalDeveloper(userData);
  const { allowedPaths, loadingPermissions } = useNavbarPermissions();
  const canAccessPage =
    isDeveloper || allowedPaths.includes(SYSTEM_MAINTENANCE_PATH);
  const { data: featurePermissionsData = {} } = useGetMyPermissionsQuery(undefined, {
    skip: !userId,
  });

  const checkFeatureAccess = (featureCode) => {
    if (isDeveloper) return true;
    if (!featurePermissionsData || typeof featurePermissionsData !== 'object') return false;
    if (featurePermissionsData.features && featurePermissionsData.features[featureCode] === true) {
      return true;
    }
    const categories = featurePermissionsData.categories || featurePermissionsData;
    for (const category in categories) {
      if (category === 'paths' || category === 'features') continue;
      const categoryData = categories[category];
      if (Array.isArray(categoryData) && categoryData.includes(featureCode)) {
        return true;
      }
    }
    return false;
  };

  const canViewLogs = checkFeatureAccess(FEATURE_CODES.SYSTEM_MAINTENANCE_VIEW_LOGS) || canAccessPage;
  const canRestart = isDeveloper;
  const canRunBackup = isDeveloper;

  const [pollingMs, setPollingMs] = useState(30000);

  const {
    data: overview,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetSystemMaintenanceOverviewQuery(undefined, {
    pollingInterval: pollingMs,
    refetchOnReconnect: false,
    refetchOnFocus: false,
  });

  useEffect(() => {
    if (isApiReachabilityError(error)) {
      setPollingMs(0);
    } else if (overview && pollingMs === 0) {
      setPollingMs(30000);
    }
  }, [error, overview, pollingMs]);

  const { refetch: refetchBackupStatus } = useGetSystemMaintenanceBackupStatusQuery(undefined, {
    skip: true,
  });

  const [fetchLogs, { data: logData, isFetching: logsLoading, error: logsError }] =
    useLazyGetSystemMaintenancePm2LogsQuery();
  const [restartPm2, { isLoading: isRestarting }] = useRestartPm2ProcessMutation();
  const [triggerBackup, { isLoading: isTriggering }] = useTriggerSystemBackupMutation();

  const [logAppName, setLogAppName] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [backupPolling, setBackupPolling] = useState(false);
  const [queuedRefresh, setQueuedRefresh] = useState(false);
  const hostMetricsRetriedRef = useRef(false);

  const isDisabled = error?.status === 503 || error?.status === 403;
  const capabilities = overview?.capabilities;

  const handleViewLogs = useCallback((appName) => {
    if (!canViewLogs) {
      setActionMessage('Access denied. Ask ICT to enable View PM2 logs under Auth Controls → Features.');
      return;
    }
    setLogAppName(appName);
    fetchLogs({ appName, lines: 100 });
  }, [canViewLogs, fetchLogs]);

  const handleRestart = useCallback(async (appName, confirmName, onDone) => {
    if (!canRestart) {
      setActionMessage('PM2 restart is restricted to internal developers.');
      return;
    }
    try {
      const result = await restartPm2({ appName, confirmName }).unwrap();
      const warning = result?.data?.warning;
      const selfRestart = result?.data?.selfRestart;
      setActionMessage(
        warning || `Restarted ${appName} successfully.`
      );
      onDone();
      if (selfRestart) {
        window.setTimeout(() => refetch(), 8000);
      } else {
        refetch();
      }
    } catch (err) {
      setActionMessage(err?.data?.message || err?.message || 'Restart failed.');
    }
  }, [canRestart, restartPm2, refetch]);

  const handleTriggerBackup = useCallback(async (confirmAction) => {
    if (!canRunBackup) {
      setActionMessage('Manual backup is restricted to internal developers.');
      return { ok: false };
    }
    try {
      await triggerBackup({ confirmAction }).unwrap();
      setActionMessage('Database backup started. Status will update when complete.');
      setBackupPolling(true);
      return { ok: true };
    } catch (err) {
      setActionMessage(err?.data?.message || err?.message || 'Failed to start backup.');
      return { ok: false };
    }
  }, [canRunBackup, triggerBackup]);

  useEffect(() => {
    if (!backupPolling) return undefined;
    const id = setInterval(() => {
      refetch();
      refetchBackupStatus();
    }, 10000);
    const stop = setTimeout(() => setBackupPolling(false), 5 * 60 * 1000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [backupPolling, refetch, refetchBackupStatus]);

  const handleRefresh = useCallback(() => {
    if (isFetching) {
      setQueuedRefresh(true);
      return;
    }
    refetch();
  }, [isFetching, refetch]);

  useEffect(() => {
    if (!queuedRefresh || isFetching) return;
    setQueuedRefresh(false);
    refetch();
  }, [queuedRefresh, isFetching, refetch]);

  useEffect(() => {
    if (!overview || hostMetricsRetriedRef.current || isFetching) return;
    const hostErr = (overview.errors || []).find((e) => e.section === 'host');
    if (!hostErr || overview.host) return;
    hostMetricsRetriedRef.current = true;
    const id = window.setTimeout(() => refetch(), 2500);
    return () => window.clearTimeout(id);
  }, [overview, isFetching, refetch]);

  if (!loadingPermissions && !canAccessPage) {
    return (
      <div
        className="page-sysmaint page-sysmaint--glass"
        style={{ '--sysmaint-bg-url': `url(${process.env.PUBLIC_URL || ''}/assets/images/bg.jpg)` }}
      >
        <div className="sysmaint-bg-layer" />
        <div className="sysmaint-shell">
          <div className="sysmaint-unavailable">
            <FaExclamationTriangle />
            <h2>Access denied</h2>
            <p>
              You do not have navigation access to System Maintenance. Ask ICT to grant the Dashboard path under Auth Controls.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="page-sysmaint page-sysmaint--glass"
        style={{ '--sysmaint-bg-url': `url(${process.env.PUBLIC_URL || ''}/assets/images/bg.jpg)` }}
      >
        <div className="sysmaint-bg-layer" />
        <div className="sysmaint-shell">
          <div className="sysmaint-loading sysmaint-loading--page">
            <Bars height={40} width={40} color="#1a73e8" />
            <span>Loading system maintenance…</span>
          </div>
        </div>
      </div>
    );
  }

  if (isDisabled) {
    const msg =
      error?.status === 503
        ? 'System Maintenance is only available on the DSMS Windows server environment (enable SYSTEM_MAINTENANCE_ENABLED on the API).'
        : error?.data?.message || error?.message || 'Failed to load System Maintenance.';
    return (
      <div
        className="page-sysmaint page-sysmaint--glass"
        style={{ '--sysmaint-bg-url': `url(${process.env.PUBLIC_URL || ''}/assets/images/bg.jpg)` }}
      >
        <div className="sysmaint-bg-layer" />
        <div className="sysmaint-shell">
          <div className="sysmaint-unavailable">
            <FaExclamationTriangle />
            <h2>System Maintenance unavailable</h2>
            <p>{msg}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div
        className="page-sysmaint page-sysmaint--glass"
        style={{ '--sysmaint-bg-url': `url(${process.env.PUBLIC_URL || ''}/assets/images/bg.jpg)` }}
      >
        <div className="sysmaint-bg-layer" />
        <div className="sysmaint-shell">
          <div className="sysmaint-unavailable">
            <FaExclamationTriangle />
            <h2>Failed to load System Maintenance</h2>
            <p>{formatMaintenanceLoadError(error)}</p>
            <button type="button" className="sysmaint-btn-secondary" onClick={() => refetch()}>
              <FaSync /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pm2Processes = overview?.pm2 || [];
  const recentActions = overview?.recentActions || [];
  const sectionErrors = overview?.errors || [];
  const onlineCount = pm2Processes.filter((p) => p.status === 'online').length;
  const totalCount = pm2Processes.length;
  const cpuPercent = overview?.host?.cpuPercent ?? null;
  const memoryPercent = overview?.host?.memory?.usedPercent ?? null;
  const backupHours = hoursSince(overview?.backup?.lastBackupAt);
  const backupState =
    overview?.backup?.inProgress
      ? 'Running'
      : backupHours == null
        ? 'Unknown'
        : backupHours <= 24
          ? 'Healthy'
          : backupHours <= 36
            ? 'Warning'
            : 'Critical';
  const jenkinsJobs = overview?.jenkins?.jobs || [];
  const jenkinsOk = jenkinsJobs.filter((j) => j.status === 'success').length;
  const summaryCards = [
    {
      key: 'pm2',
      title: 'PM2 Services',
      value: `${onlineCount}/${totalCount || 0}`,
      hint: totalCount ? `${onlineCount} online` : 'No configured services',
      tone: totalCount === 0 ? 'muted' : onlineCount === totalCount ? 'ok' : 'warn',
      icon: <FaCheckCircle />,
    },
    {
      key: 'cpu',
      title: 'Server CPU',
      value: cpuPercent == null ? '—' : `${cpuPercent}%`,
      hint: 'Current utilization',
      tone: cpuPercent == null ? 'muted' : cpuPercent >= 90 ? 'bad' : cpuPercent >= 75 ? 'warn' : 'ok',
      icon: <FaMicrochip />,
    },
    {
      key: 'backup',
      title: 'Backup State',
      value: backupState,
      hint: backupHours == null ? 'No recent backup timestamp' : `${backupHours.toFixed(1)} hours since last backup`,
      tone: backupState === 'Healthy' ? 'ok' : backupState === 'Running' ? 'warn' : backupState === 'Warning' ? 'warn' : backupState === 'Critical' ? 'bad' : 'muted',
      icon: <FaDatabase />,
    },
    {
      key: 'jenkins',
      title: 'Jenkins Jobs',
      value: `${jenkinsOk}/${jenkinsJobs.length || 0}`,
      hint: jenkinsJobs.length
        ? `${jenkinsOk} successful${overview?.jenkins?.lastUpdatedAt ? ` · latest ${formatCollectedAt(overview.jenkins.lastUpdatedAt)}` : ''}`
        : (overview?.jenkins?.enabled ? 'No jobs configured' : 'Integration not configured'),
      tone: !overview?.jenkins?.enabled || !jenkinsJobs.length ? 'muted' : jenkinsOk === jenkinsJobs.length ? 'ok' : 'warn',
      icon: <FaServer />,
    },
  ];
  const backupStatusTone = toneFromState(backupState);
  const jenkinsTone = !overview?.jenkins?.enabled
    ? 'muted'
    : jenkinsJobs.length === 0
      ? 'muted'
      : jenkinsOk === jenkinsJobs.length
        ? 'ok'
        : 'warn';
  const latestAction = recentActions[0] || null;

  return (
    <div
      className="page-sysmaint page-sysmaint--glass"
      style={{ '--sysmaint-bg-url': `url(${process.env.PUBLIC_URL || ''}/assets/images/bg.jpg)` }}
    >
      <div className="sysmaint-bg-layer" />
      <div className="sysmaint-shell">
        <header className="sysmaint-hero">
          <div className="sysmaint-hero-main">
            <h1 className="sysmaint-title">
              <FaServer /> ICT Dashboard
            </h1>
            <p className="sysmaint-subtitle">
              Unified operations cockpit for services, infrastructure, backup health, and CI status.
            </p>
            <div className="sysmaint-hero-pills">
              <span className="sysmaint-pill">API: {overview?.apiSelf?.pm2AppName || 'standalone'}</span>
              <span className="sysmaint-pill">{overview?.apiSelf?.environment || 'unknown'}</span>
              <span className="sysmaint-pill">Uptime {overview?.apiSelf?.uptime?.formatted || '—'}</span>
              <span className={`sysmaint-pill sysmaint-pill--${backupStatusTone}`}>Backup {backupState}</span>
              <span className={`sysmaint-pill sysmaint-pill--${jenkinsTone}`}>
                Jenkins {jenkinsJobs.length ? `${jenkinsOk}/${jenkinsJobs.length}` : 'N/A'}
              </span>
            </div>
          </div>
          <div className="sysmaint-hero-side">
            <span className="sysmaint-updated">
              Last updated: {formatCollectedAt(overview?.collectedAt)}
              {isFetching && ' (refreshing…)'}
            </span>
            <button type="button" className="sysmaint-btn-secondary" onClick={handleRefresh}>
              <FaSync /> Refresh
            </button>
            {queuedRefresh && <span className="sysmaint-hint">Another refresh queued…</span>}
          </div>
        </header>

        {actionMessage && (
          <div className="sysmaint-toast" role="status">
            {actionMessage}
            <button type="button" onClick={() => setActionMessage(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        <section className="sysmaint-section">
          <div className="sysmaint-summary-grid">
            {summaryCards.map((card) => (
              <article className={`sysmaint-summary-card sysmaint-summary-card--${card.tone}`} key={card.key}>
                <div className="sysmaint-summary-icon">{card.icon}</div>
                <div>
                  <p className="sysmaint-summary-title">{card.title}</p>
                  <p className="sysmaint-summary-value">{card.value}</p>
                  <p className="sysmaint-hint">{card.hint}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {sectionErrors.length > 0 && (
          <div className="sysmaint-warnings">
            {sectionErrors.map((e) => (
              <p key={e.section}>
                <strong>{e.section}:</strong> {e.message}
              </p>
            ))}
          </div>
        )}

        <div className="sysmaint-grid-main">
          <section className="sysmaint-section sysmaint-panel-wrap">
            <h2 className="sysmaint-section-title">Application Services (PM2)</h2>
            {pm2Processes.length === 0 ? (
              <p className="sysmaint-hint">No allowlisted PM2 processes found. Check SYSTEM_MAINTENANCE_PM2_APPS on the server.</p>
            ) : (
              <div className="sysmaint-pm2-grid">
                {pm2Processes.map((proc) => (
                  <Pm2ProcessCard
                    key={proc.name}
                    process={proc}
                    onViewLogs={handleViewLogs}
                    onRestart={handleRestart}
                    isRestarting={isRestarting}
                    canViewLogs={canViewLogs}
                    canRestart={canRestart}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="sysmaint-section sysmaint-panel-wrap">
            <h2 className="sysmaint-section-title">Operations Snapshot</h2>
            <div className="sysmaint-split">
              <HostMetricsPanel host={overview?.host} errors={sectionErrors} />
              <BackupPanel
                mysql={overview?.mysql}
                backup={overview?.backup}
                onTriggerBackup={handleTriggerBackup}
                isTriggering={isTriggering}
                onPollStatus={() => refetch()}
                canRunBackup={canRunBackup}
              />
            </div>
          </section>
        </div>

        <section className="sysmaint-section">
          <h2 className="sysmaint-section-title">CI/CD Pipeline</h2>
          <JenkinsPanel jenkins={overview?.jenkins} errors={sectionErrors} />
        </section>

        <section className="sysmaint-section">
          <h2 className="sysmaint-section-title">Audit Timeline</h2>
          {latestAction && (
            <div className="sysmaint-latest-action">
              <strong>Latest:</strong> {latestAction.action} by {latestAction.userName || latestAction.userId} at {latestAction.timestamp}
            </div>
          )}
          {recentActions.length === 0 ? (
            <p className="sysmaint-hint">No maintenance actions recorded yet today.</p>
          ) : (
            <div className="sysmaint-table-wrap">
              <table className="sysmaint-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActions.map((row, idx) => (
                    <tr key={`${row.timestamp}-${idx}`}>
                      <td>{row.timestamp}</td>
                      <td>{row.userName || row.userId}</td>
                      <td>{row.action}</td>
                      <td>{row.target}</td>
                      <td>{row.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {capabilities && !capabilities.enabled && (
          <p className="sysmaint-hint">Maintenance capabilities are disabled in API configuration.</p>
        )}
      </div>

      {logAppName && canViewLogs && (
        <LogTailModal
          appName={logAppName}
          onClose={() => setLogAppName(null)}
          onFetch={fetchLogs}
          isLoading={logsLoading}
          content={logData?.content}
          error={logsError?.data?.message || logsError?.message}
        />
      )}
    </div>
  );
};

export default SystemMaintenancePage;
