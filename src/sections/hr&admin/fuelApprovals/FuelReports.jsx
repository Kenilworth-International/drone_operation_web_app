import React, { useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import BoltIcon from '@mui/icons-material/Bolt';
import {
  useGetFuelApprovalsReportQuery,
  useLazyGetFuelApprovalsReportQuery,
} from '../../../api/services NodeJs/fuelApprovalsApi';
import { downloadDetailedFuelReportExcel } from './fuelReportExcelExport';
import './fuelReports.css';

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatLkr = (value) =>
  new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatNum = (value, digits = 2) => {
  if (value == null || value === '') return '—';
  return Number(value).toLocaleString('en-LK', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

/** Average of metric per liter for the group (null if no liters). */
const avgPerLiter = (metric, liters) => {
  const m = Number(metric);
  const l = Number(liters);
  if (!Number.isFinite(m) || !Number.isFinite(l) || l <= 0) return null;
  return m / l;
};

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const buildMonthOptions = (count = 24) => {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < count; i += 1) {
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    out.push({ value: ym, label });
    d.setMonth(d.getMonth() - 1);
  }
  return out;
};

const approvalChip = (status) => {
  if (status === 'pending') return <Chip size="small" className="fr-chip fr-chip-pending" label="Pending" />;
  if (status === 'approved') return <Chip size="small" className="fr-chip fr-chip-ok" label="Approved" />;
  if (status === 'declined') return <Chip size="small" className="fr-chip fr-chip-bad" label="Declined" />;
  return <Chip size="small" label={status || '—'} />;
};

const paymentChip = (status) => {
  if (status === 'paid') return <Chip size="small" className="fr-chip fr-chip-ok" label="Paid" />;
  if (status === 'unpaid') return <Chip size="small" className="fr-chip fr-chip-warn" label="Unpaid" />;
  return <Chip size="small" className="fr-chip fr-chip-muted" label="No voucher" />;
};

const voucherStageLabel = (stage) => {
  const map = {
    no_voucher: 'No voucher',
    voucher_pending: 'Voucher pending',
    voucher_declined: 'Voucher declined',
    finance_declined: 'Finance declined',
    awaiting_payment: 'Awaiting payment',
    paid: 'Paid',
    voucher_linked: 'Linked',
  };
  return map[stage] || stage || '—';
};

function StatCard({ label, value, hint, tone }) {
  return (
    <div className={`fr-stat fr-stat-${tone || 'neutral'}`}>
      <div className="fr-stat-label">{label}</div>
      <div className="fr-stat-value">{value}</div>
      {hint ? <div className="fr-stat-hint">{hint}</div> : null}
    </div>
  );
}

/**
 * Fuel Reports — dedicated Vehicle / Generator views with multi-month filter.
 * Vehicle rows show monthly full KM; generator rows show pilot sprayed Ha (dji_field_area).
 */
export default function FuelReports({ embedded = false }) {
  const monthOptions = useMemo(() => buildMonthOptions(24), []);
  const [selectedMonths, setSelectedMonths] = useState(() => {
    const cur = currentMonth();
    const opt = monthOptions.find((m) => m.value === cur) || monthOptions[0];
    return opt ? [opt] : [];
  });
  const [viewTab, setViewTab] = useState('vehicle'); // vehicle | generator
  const [approvalStatus, setApprovalStatus] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const monthValues = useMemo(
    () => selectedMonths.map((m) => m.value).filter(Boolean),
    [selectedMonths]
  );

  const queryArgs = useMemo(() => {
    const args = {
      fuel_source: viewTab === 'generator' ? 'generator' : 'vehicle',
      approval_status: approvalStatus,
      payment_status: paymentStatus,
      search: searchApplied || undefined,
    };
    if (monthValues.length === 1) {
      args.month = monthValues[0];
    } else if (monthValues.length > 1) {
      args.months = monthValues;
    } else {
      args.month = currentMonth();
    }
    return args;
  }, [viewTab, approvalStatus, paymentStatus, searchApplied, monthValues]);

  const {
    currentData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetFuelApprovalsReportQuery(queryArgs, {
    // Always refetch when filters/tab change; avoid flashing stale cache mid-switch.
    refetchOnMountOrArgChange: true,
  });
  const [fetchReportForExport] = useLazyGetFuelApprovalsReportQuery();
  const [exporting, setExporting] = useState(false);

  /**
   * Use currentData only (result for THIS queryArgs).
   * Using `data` can briefly show the previous tab/month (Unknown vehicle / missing Ha/KM).
   */
  const report = currentData || null;
  const requestedSource = String(queryArgs.fuel_source || 'vehicle');
  const responseSource = String(
    report?.filters?.fuel_source || report?.rows?.[0]?.fuel_source || ''
  );
  // currentData is already scoped to queryArgs; also verify source so tab switches never mix.
  const filtersMatch =
    !!report && (!responseSource || responseSource === requestedSource);
  // Spinner while first load / tab-month switch. Keep table visible on same-filter refresh.
  const showLoading = isLoading || !filtersMatch || (isFetching && !report);
  const rows = filtersMatch ? report.rows || [] : [];
  const summary = filtersMatch ? report.summary || {} : {};

  const monthsLabel =
    monthValues.length === 0
      ? '—'
      : monthValues.length === 1
        ? monthValues[0]
        : `${monthValues.length} months`;

  const sortBillsAscending = (bills) =>
    [...bills].sort((a, b) => {
      const da = String(a.date || '');
      const db = String(b.date || '');
      if (da !== db) return da.localeCompare(db);
      const ta = String(a.time || '');
      const tb = String(b.time || '');
      if (ta !== tb) return ta.localeCompare(tb);
      return Number(a.id) - Number(b.id);
    });

  /** Vehicle: one group per vehicle × month — plate + KM shown once. */
  const vehicleGroups = useMemo(() => {
    if (viewTab !== 'vehicle' || showLoading) return [];
    const map = new Map();
    rows.forEach((r) => {
      // Skip incomplete rows (stale / unmatched) so we never flash "Unknown vehicle".
      if (!r.vehicle_no && !r.vehicle_id) return;
      const vehicleKey = r.vehicle_id || r.vehicle_no;
      const month = r.billing_month || '—';
      const key = `${vehicleKey}|${month}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          month,
          vehicle_no: r.vehicle_no || `Vehicle #${r.vehicle_id}`,
          vehicle_category_name: r.vehicle_category_name || '',
          fuel_category_name: r.fuel_category_name || '',
          full_km: r.full_km != null ? Number(r.full_km) : r.month_km != null ? Number(r.month_km) : null,
          bills: [],
          liters: 0,
          amount: 0,
        });
      }
      const g = map.get(key);
      g.bills.push(r);
      g.liters += Number(r.liters) || 0;
      g.amount += Number(r.amount) || 0;
      if (r.vehicle_no) g.vehicle_no = r.vehicle_no;
      if (r.full_km != null) g.full_km = Number(r.full_km);
      else if (r.month_km != null) g.full_km = Number(r.month_km);
    });
    return [...map.values()]
      .map((g) => ({
        ...g,
        liters: Number(g.liters.toFixed(2)),
        amount: Number(g.amount.toFixed(2)),
        bills: sortBillsAscending(g.bills),
      }))
      .sort((a, b) => {
        const vCmp = String(a.vehicle_no).localeCompare(String(b.vehicle_no));
        if (vCmp !== 0) return vCmp;
        return String(b.month).localeCompare(String(a.month));
      });
  }, [rows, viewTab, showLoading]);

  /** Generator: one group per pilot × month — name + sprayed Ha shown once. */
  const generatorPilotGroups = useMemo(() => {
    if (viewTab !== 'generator' || showLoading) return [];
    const map = new Map();
    rows.forEach((r) => {
      if (!r.person_name && !r.person_user_id && !r.user_id) return;
      const pilotId = r.person_user_id || r.user_id || r.person_name;
      const month = r.billing_month || '—';
      const key = `${pilotId}|${month}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          pilotId,
          month,
          person_name: r.person_name || `Pilot #${pilotId}`,
          person_mobile: r.person_mobile || '',
          sprayed_ha: r.sprayed_ha != null ? Number(r.sprayed_ha) : r.dji_field_area != null ? Number(r.dji_field_area) : null,
          bills: [],
          liters: 0,
          amount: 0,
        });
      }
      const g = map.get(key);
      g.bills.push(r);
      g.liters += Number(r.liters) || 0;
      g.amount += Number(r.amount) || 0;
      if (r.person_name) g.person_name = r.person_name;
      if (r.sprayed_ha != null) g.sprayed_ha = Number(r.sprayed_ha);
      else if (r.dji_field_area != null) g.sprayed_ha = Number(r.dji_field_area);
    });
    return [...map.values()]
      .map((g) => ({
        ...g,
        liters: Number(g.liters.toFixed(2)),
        amount: Number(g.amount.toFixed(2)),
        sprayed_ha: g.sprayed_ha != null ? g.sprayed_ha : 0,
        bills: sortBillsAscending(g.bills),
      }))
      .sort((a, b) => {
        const nameCmp = String(a.person_name).localeCompare(String(b.person_name));
        if (nameCmp !== 0) return nameCmp;
        return String(b.month).localeCompare(String(a.month));
      });
  }, [rows, viewTab, showLoading]);

  const downloadExcel = async () => {
    setExporting(true);
    try {
      const exportArgs = {
        ...queryArgs,
        fuel_source: 'all',
      };
      const result = await fetchReportForExport(exportArgs).unwrap();
      downloadDetailedFuelReportExcel(result?.rows || [], { months: monthValues });
    } catch (err) {
      console.error(err);
      // Fallback: export whatever is currently loaded for the active tab
      downloadDetailedFuelReportExcel(rows, { months: monthValues });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box className={`fuel-reports-page${embedded ? ' fuel-reports-embedded' : ''}`}>
      <header className="fr-hero">
        <div className="fr-hero-copy">
          <div className="fr-hero-kicker">
            <LocalGasStationIcon fontSize="small" />
            Fuel Reports - Administration
          </div>
          
        </div>
        <div className="fr-hero-actions">
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => refetch()}
            disabled={isFetching}
            sx={{ textTransform: 'none' }}
          >
            Refresh
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={() => void downloadExcel()}
            disabled={showLoading || exporting || !rows.length}
            sx={{ textTransform: 'none', background: '#0f766e' }}
          >
            {exporting ? 'Preparing…' : 'Download Excel'}
          </Button>
        </div>
      </header>

      <section className="fr-filters">
        <Autocomplete
          multiple
          size="small"
          options={monthOptions}
          value={selectedMonths}
          onChange={(_, next) => setSelectedMonths(next || [])}
          getOptionLabel={(o) => o.label || o.value}
          isOptionEqualToValue={(a, b) => a.value === b.value}
          renderInput={(params) => (
            <TextField {...params} label="Months" placeholder="Select month(s)" helperText="Multi-select allowed" />
          )}
          sx={{ minWidth: 260, flex: '1 1 260px' }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="fr-approval">Approval</InputLabel>
          <Select
            labelId="fr-approval"
            label="Approval"
            value={approvalStatus}
            onChange={(e) => setApprovalStatus(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="declined">Declined</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="fr-payment">Payment</InputLabel>
          <Select
            labelId="fr-payment"
            label="Payment"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="unpaid">Unpaid (has voucher)</MenuItem>
            <MenuItem value="paid">Paid</MenuItem>
            <MenuItem value="no_voucher">No voucher yet</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Search name / last 4 / vehicle / voucher"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setSearchApplied(search.trim());
          }}
          sx={{ minWidth: 220, flex: '1 1 220px' }}
        />
        <Button
          size="small"
          variant="outlined"
          onClick={() => setSearchApplied(search.trim())}
          sx={{ textTransform: 'none', height: 40 }}
        >
          Apply search
        </Button>
      </section>

      <Tabs
        value={viewTab}
        onChange={(_, v) => setViewTab(v)}
        className="fr-tabs"
        textColor="inherit"
        indicatorColor="primary"
      >
        <Tab
          value="vehicle"
          icon={<DirectionsCarIcon fontSize="small" />}
          iconPosition="start"
          label="Vehicle fuel"
          sx={{ textTransform: 'none', fontWeight: 700 }}
        />
        <Tab
          value="generator"
          icon={<BoltIcon fontSize="small" />}
          iconPosition="start"
          label="Generator fuel"
          sx={{ textTransform: 'none', fontWeight: 700 }}
        />
      </Tabs>

      <section className="fr-stats">
        <StatCard label="Period" value={monthsLabel} hint={monthValues.join(' · ') || 'Current month'} />
        <StatCard
          label="Fuel bills"
          value={showLoading ? '…' : summary.total_rows || 0}
          tone={viewTab === 'vehicle' ? 'blue' : 'teal'}
        />
        <StatCard
          label="Liters"
          value={showLoading ? '…' : formatNum(summary.total_liters)}
          tone="neutral"
        />
        <StatCard
          label="Amount"
          value={showLoading ? '…' : formatLkr(summary.total_amount)}
          tone="neutral"
        />
        {viewTab === 'vehicle' ? (
          <StatCard
            label="Vehicles"
            value={showLoading ? '…' : vehicleGroups.length}
            hint={showLoading ? 'Loading…' : `KM total ${formatNum(summary.total_full_km)}`}
            tone="blue"
          />
        ) : (
          <StatCard
            label="Pilots"
            value={showLoading ? '…' : generatorPilotGroups.length}
            hint={showLoading ? 'Loading…' : `Sprayed Ha total ${formatNum(summary.total_sprayed_ha)}`}
            tone="teal"
          />
        )}
        <StatCard
          label="Paid"
          value={showLoading ? '…' : formatLkr(summary.paid_amount)}
          tone="ok"
        />
        <StatCard
          label="Unpaid"
          value={showLoading ? '…' : formatLkr(summary.unpaid_amount)}
          tone="warn"
        />
      </section>

      {isError ? (
        <div className="fr-error">{error?.data?.message || error?.error || 'Failed to load report'}</div>
      ) : showLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, p: 4 }}>
          <CircularProgress />
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Loading {viewTab === 'generator' ? 'generator' : 'vehicle'} fuel report…
          </Typography>
        </Box>
      ) : viewTab === 'generator' ? (
        <TableContainer className="fr-table-wrap">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Pilot</TableCell>
                <TableCell>Month</TableCell>
                <TableCell align="right">Sprayed Ha</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Card</TableCell>
                <TableCell align="right">Liters</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="center">Approval</TableCell>
                <TableCell>Voucher</TableCell>
                <TableCell align="center">Payment</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {generatorPilotGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" className="fr-empty">
                    No generator fuel rows for {monthsLabel}
                  </TableCell>
                </TableRow>
              ) : (
                generatorPilotGroups.map((group) =>
                  group.bills.map((row, billIdx) => (
                    <TableRow
                      key={`${group.key}-${row.id}`}
                      hover
                      className={billIdx === 0 ? 'fr-pilot-group-start' : 'fr-pilot-group-bill'}
                    >
                      {billIdx === 0 ? (
                        <TableCell rowSpan={group.bills.length} className="fr-pilot-cell">
                          <div className="fr-strong">{group.person_name}</div>
                          <div className="fr-muted">{group.person_mobile || ''}</div>
                          <div className="fr-pilot-meta">
                            {group.bills.length} bill{group.bills.length === 1 ? '' : 's'}
                            {' · '}
                            {formatNum(group.liters)} L
                          </div>
                        </TableCell>
                      ) : null}
                      {billIdx === 0 ? (
                        <TableCell rowSpan={group.bills.length}>
                          <span className="fr-mono">{group.month}</span>
                        </TableCell>
                      ) : null}
                      {billIdx === 0 ? (
                        <TableCell rowSpan={group.bills.length} align="right" className="fr-metric-ha fr-pilot-ha">
                          <div>{formatNum(group.sprayed_ha)}</div>
                          {(() => {
                            const avg = avgPerLiter(group.sprayed_ha, group.liters);
                            return avg != null ? (
                              <div className="fr-avg-per-l">({formatNum(avg, 3)} /L)</div>
                            ) : null;
                          })()}
                        </TableCell>
                      ) : null}
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <div className="fr-strong">{formatDate(row.date)}</div>
                        <div className="fr-muted">{row.time || ''}</div>
                      </TableCell>
                      <TableCell>
                        <div className="fr-strong">{row.card_holder || '-'}</div>
                        <div className="fr-mono fr-muted">{row.card_number}</div>
                      </TableCell>
                      <TableCell align="right">{formatNum(row.liters)}</TableCell>
                      <TableCell align="right" className="fr-strong">
                        {formatLkr(row.amount)}
                      </TableCell>
                      <TableCell align="center">
                        {approvalChip(row.approval_status)}
                        {row.reject_reason ? (
                          <Tooltip title={row.reject_reason}>
                            <Typography variant="caption" className="fr-reject">
                              {row.reject_reason}
                            </Typography>
                          </Tooltip>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {row.voucher_no ? (
                          <>
                            <div className="fr-strong">{row.voucher_no}</div>
                            <div className="fr-muted">{voucherStageLabel(row.voucher_stage)}</div>
                          </>
                        ) : (
                          <span className="fr-muted">
                            {row.approval_status === 'approved' ? 'Not invoiced yet' : '—'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell align="center">{paymentChip(row.payment_status)}</TableCell>
                    </TableRow>
                  ))
                )
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <TableContainer className="fr-table-wrap">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Vehicle</TableCell>
                <TableCell>Month</TableCell>
                <TableCell align="center">KM</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Driver</TableCell>
                <TableCell>Card</TableCell>
                <TableCell align="right">Liters</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="center">Approval</TableCell>
                <TableCell>Voucher</TableCell>
                <TableCell align="center">Payment</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vehicleGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" className="fr-empty">
                    No vehicle fuel rows for {monthsLabel}
                  </TableCell>
                </TableRow>
              ) : (
                vehicleGroups.map((group) =>
                  group.bills.map((row, billIdx) => (
                    <TableRow
                      key={`${group.key}-${row.id}`}
                      hover
                      className={billIdx === 0 ? 'fr-vehicle-group-start' : 'fr-vehicle-group-bill'}
                    >
                      {billIdx === 0 ? (
                        <TableCell rowSpan={group.bills.length} className="fr-vehicle-cell">
                          <div className="fr-strong">{group.vehicle_no}</div>
                          <div className="fr-muted">
                            {[group.vehicle_category_name, group.fuel_category_name]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                          <div className="fr-vehicle-meta">
                            {group.bills.length} bill{group.bills.length === 1 ? '' : 's'}
                            {' · '}
                            {formatNum(group.liters)} L
                          </div>
                        </TableCell>
                      ) : null}
                      {billIdx === 0 ? (
                        <TableCell rowSpan={group.bills.length} className="fr-vehicle-month">
                          <span className="fr-mono">{group.month}</span>
                        </TableCell>
                      ) : null}
                      {billIdx === 0 ? (
                        <TableCell rowSpan={group.bills.length} className="fr-metric-km fr-vehicle-km">
                          <div>{group.full_km != null ? formatNum(group.full_km) : '—'}</div>
                          {(() => {
                            const avg = avgPerLiter(group.full_km, group.liters);
                            return avg != null ? (
                              <div className="fr-avg-per-l">({formatNum(avg, 2)} /L)</div>
                            ) : null;
                          })()}
                        </TableCell>
                      ) : null}
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <div className="fr-strong">{formatDate(row.date)}</div>
                        <div className="fr-muted">{row.time || ''}</div>
                      </TableCell>
                      <TableCell>
                        <div className="fr-strong">{row.person_name || '-'}</div>
                        <div className="fr-muted">{row.person_mobile || ''}</div>
                      </TableCell>
                      <TableCell>
                        <div className="fr-strong">{row.card_holder || '-'}</div>
                        <div className="fr-mono fr-muted">{row.card_number}</div>
                      </TableCell>
                      <TableCell align="right">{formatNum(row.liters)}</TableCell>
                      <TableCell align="right" className="fr-strong">
                        {formatLkr(row.amount)}
                      </TableCell>
                      <TableCell align="center">
                        {approvalChip(row.approval_status)}
                        {row.reject_reason ? (
                          <Tooltip title={row.reject_reason}>
                            <Typography variant="caption" className="fr-reject">
                              {row.reject_reason}
                            </Typography>
                          </Tooltip>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {row.voucher_no ? (
                          <>
                            <div className="fr-strong">{row.voucher_no}</div>
                            <div className="fr-muted">{voucherStageLabel(row.voucher_stage)}</div>
                          </>
                        ) : (
                          <span className="fr-muted">
                            {row.approval_status === 'approved' ? 'Not invoiced yet' : '—'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell align="center">{paymentChip(row.payment_status)}</TableCell>
                    </TableRow>
                  ))
                )
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
