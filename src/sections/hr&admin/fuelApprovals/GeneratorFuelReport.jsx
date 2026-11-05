import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
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
import * as XLSX from 'xlsx';
import { useGetFuelApprovalsReportQuery } from '../../../api/services NodeJs/fuelApprovalsApi';

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

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const approvalChip = (status) => {
  if (status === 'pending')
    return <Chip size="small" label="Pending" sx={{ background: '#fff7e8', color: '#9a6700' }} />;
  if (status === 'approved')
    return <Chip size="small" label="Approved" sx={{ background: '#eaf8ef', color: '#1f7a44' }} />;
  if (status === 'declined')
    return <Chip size="small" label="Declined" sx={{ background: '#fdeff1', color: '#a63640' }} />;
  return <Chip size="small" label={status || '—'} />;
};

const paymentChip = (status) => {
  if (status === 'paid')
    return <Chip size="small" label="Paid" sx={{ background: '#e8f5e9', color: '#1b5e20' }} />;
  if (status === 'unpaid')
    return <Chip size="small" label="Unpaid" sx={{ background: '#fff3e0', color: '#e65100' }} />;
  return <Chip size="small" label="No voucher" sx={{ background: '#f1f5f9', color: '#64748b' }} />;
};

const sourceChip = (source) =>
  source === 'generator' ? (
    <Chip size="small" label="Generator" sx={{ background: '#ecfeff', color: '#0e7490' }} />
  ) : (
    <Chip size="small" label="Vehicle" sx={{ background: '#eff6ff', color: '#1d4ed8' }} />
  );

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

/**
 * Unified fuel report (vehicle + generator): cards, users/pilots/drivers,
 * vouchers & payments. Month filter + Excel download.
 */
export default function GeneratorFuelReport({
  embedded = false,
  defaultFuelSource = 'all',
}) {
  const [month, setMonth] = useState(currentMonth);
  const [fuelSource, setFuelSource] = useState(defaultFuelSource);
  const [approvalStatus, setApprovalStatus] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const queryArgs = useMemo(
    () => ({
      month: month || undefined,
      fuel_source: fuelSource || 'all',
      approval_status: approvalStatus,
      payment_status: paymentStatus,
      search: searchApplied || undefined,
    }),
    [month, fuelSource, approvalStatus, paymentStatus, searchApplied]
  );

  const { data, isLoading, isFetching, refetch, error } = useGetFuelApprovalsReportQuery(queryArgs);
  const rows = data?.rows || [];
  const summary = data?.summary || {};

  const downloadExcel = () => {
    const sheetRows = rows.map((r) => ({
      Month: r.billing_month || month || '',
      Source: r.fuel_source_label || r.fuel_source || '',
      Date: formatDate(r.date),
      Time: r.time || '',
      Role: r.person_role === 'pilot' ? 'Pilot' : 'Driver',
      'Person Name': r.person_name || '',
      Mobile: r.person_mobile || '',
      'User ID': r.person_user_id || r.user_id || '',
      'Submitted By': r.submitted_by_name || '',
      Vehicle: r.vehicle_no || '',
      'Vehicle Category': r.vehicle_category_name || '',
      'Fuel Category': r.fuel_category_name || '',
      'Card Holder': r.card_holder || '',
      'Card No': r.card_number || '',
      'Card ID': r.card_id || '',
      'Card Balance': r.card_balance != null ? Number(r.card_balance) : '',
      Liters: r.liters != null ? Number(r.liters) : '',
      'Unit Price': r.unit_price != null ? Number(r.unit_price) : '',
      Amount: r.amount != null ? Number(r.amount) : '',
      Approval: r.approval_status || '',
      'Approved By': r.approved_by_name || '',
      'Reject Reason': r.reject_reason || '',
      'Voucher No': r.voucher_no || '',
      'Voucher Stage': voucherStageLabel(r.voucher_stage),
      Payment: r.payment_status || '',
      'Payment Method': r.payment_method || '',
      'Payment Ref': r.payment_reference || '',
      'Paid At': r.paid_at ? formatDate(r.paid_at) : '',
      'Paid By': r.paid_by_name || '',
      'Tx ID': r.id,
    }));
    const ws = XLSX.utils.json_to_sheet(sheetRows.length ? sheetRows : [{ Note: 'No rows' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fuel Report');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          Month: month || '',
          Source: fuelSource,
          Rows: summary.total_rows || 0,
          Vehicle: summary.vehicle_count || 0,
          Generator: summary.generator_count || 0,
          Pending: summary.pending_count || 0,
          Approved: summary.approved_count || 0,
          Declined: summary.declined_count || 0,
          'No voucher (approved)': summary.no_voucher_count || 0,
          Unpaid: summary.awaiting_payment_count || 0,
          Paid: summary.paid_count || 0,
          'Total amount': summary.total_amount || 0,
          'Vehicle amount': summary.vehicle_amount || 0,
          'Generator amount': summary.generator_amount || 0,
          'Paid amount': summary.paid_amount || 0,
          'Unpaid amount': summary.unpaid_amount || 0,
          Liters: summary.total_liters || 0,
        },
      ]),
      'Summary'
    );
    XLSX.writeFile(wb, `Fuel_Report_${month || 'all'}_${fuelSource || 'all'}.xlsx`);
  };

  const shellSx = embedded
    ? { p: '6px', m: 0, backgroundColor: 'transparent', minHeight: 'auto' }
    : { p: 3, backgroundColor: '#f3f7fb', minHeight: '100vh' };

  return (
    <Box sx={shellSx}>
      <Card
        elevation={0}
        sx={{
          mb: 1.5,
          border: '1px solid #d9e5ef',
          borderRadius: 2,
          background: 'linear-gradient(180deg, #fdfefe 0%, #f6fbff 100%)',
        }}
      >
        <CardContent sx={{ p: '14px !important' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#102739' }}>
                Fuel Report
              </Typography>
              <Typography variant="caption" sx={{ color: '#5f7383' }}>
                Vehicle + generator bills by month — card, user/pilot/driver, voucher & payment.
                Filter and download Excel.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
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
                onClick={downloadExcel}
                disabled={!rows.length}
                sx={{ textTransform: 'none', background: '#0f766e' }}
              >
                Download Excel
              </Button>
            </Box>
          </Box>

          <Box
            sx={{
              mt: 1.5,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 1,
            }}
          >
            <TextField
              size="small"
              label="Month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="API filters month-by-month"
            />
            <FormControl size="small">
              <InputLabel id="fr-source">Source</InputLabel>
              <Select
                labelId="fr-source"
                label="Source"
                value={fuelSource}
                onChange={(e) => setFuelSource(e.target.value)}
              >
                <MenuItem value="all">All (vehicle + generator)</MenuItem>
                <MenuItem value="vehicle">Vehicle only</MenuItem>
                <MenuItem value="generator">Generator only</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small">
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
            <FormControl size="small">
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
              label="Search name / card / vehicle / voucher"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSearchApplied(search.trim());
              }}
            />
            <Button
              size="small"
              variant="outlined"
              onClick={() => setSearchApplied(search.trim())}
              sx={{ textTransform: 'none', height: 40 }}
            >
              Apply search
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', mt: 1.5 }}>
            <Chip size="small" label={`Month: ${month || '—'}`} />
            <Chip size="small" label={`Rows: ${summary.total_rows || 0}`} />
            <Chip
              size="small"
              label={`Vehicle: ${summary.vehicle_count || 0}`}
              sx={{ background: '#eff6ff', color: '#1d4ed8' }}
            />
            <Chip
              size="small"
              label={`Generator: ${summary.generator_count || 0}`}
              sx={{ background: '#ecfeff', color: '#0e7490' }}
            />
            <Chip
              size="small"
              label={`Pending: ${summary.pending_count || 0}`}
              sx={{ background: '#fff7e8', color: '#9a6700' }}
            />
            <Chip
              size="small"
              label={`Paid: ${formatLkr(summary.paid_amount)}`}
              sx={{ background: '#e8f5e9', color: '#1b5e20' }}
            />
            <Chip
              size="small"
              label={`Unpaid: ${formatLkr(summary.unpaid_amount)}`}
              sx={{ background: '#fff3e0', color: '#e65100' }}
            />
            <Chip size="small" label={`Liters: ${Number(summary.total_liters || 0).toFixed(2)}`} />
          </Box>
        </CardContent>
      </Card>

      {error ? (
        <Card elevation={0} sx={{ p: 2, border: '1px solid #fecaca', color: '#a63640' }}>
          {error?.data?.message || error?.error || 'Failed to load report'}
        </Card>
      ) : isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card
          elevation={0}
          sx={{ border: '1px solid #d9e5ef', borderRadius: 2, overflow: 'hidden', backgroundColor: '#fff' }}
        >
          <TableContainer sx={{ maxHeight: embedded ? '64vh' : '70vh' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f4f8fc' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Source</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Person</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Vehicle</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Card</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Liters
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Amount
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">
                    Approval
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Voucher</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">
                    Payment
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Paid details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 4, color: '#7c8a99' }}>
                      No fuel rows for {month || 'these filters'}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={`${row.fuel_source}-${row.id}`} hover>
                      <TableCell>{sourceChip(row.fuel_source)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>{formatDate(row.date)}</div>
                        <div style={{ fontSize: 11, color: '#7c8a99' }}>{row.time || ''}</div>
                      </TableCell>
                      <TableCell>
                        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>
                          {row.person_role || 'user'}
                        </div>
                        <div style={{ fontWeight: 600 }}>{row.person_name || '-'}</div>
                        <div style={{ fontSize: 11, color: '#7c8a99' }}>{row.person_mobile || ''}</div>
                      </TableCell>
                      <TableCell>
                        {row.vehicle_no ? (
                          <>
                            <div style={{ fontWeight: 600 }}>{row.vehicle_no}</div>
                            <div style={{ fontSize: 11, color: '#7c8a99' }}>
                              {[row.vehicle_category_name, row.fuel_category_name]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div style={{ fontWeight: 600 }}>{row.card_holder || '-'}</div>
                        <div style={{ fontSize: 11, color: '#7c8a99', fontFamily: 'monospace' }}>
                          {row.card_number}
                        </div>
                        {row.card_balance != null ? (
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            Bal {formatLkr(row.card_balance)}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell align="right">{Number(row.liters || 0).toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatLkr(row.amount)}
                      </TableCell>
                      <TableCell align="center">
                        {approvalChip(row.approval_status)}
                        {row.reject_reason ? (
                          <Tooltip title={row.reject_reason}>
                            <Typography
                              variant="caption"
                              sx={{
                                display: 'block',
                                color: '#a63640',
                                maxWidth: 120,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {row.reject_reason}
                            </Typography>
                          </Tooltip>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {row.voucher_no ? (
                          <>
                            <div style={{ fontWeight: 700 }}>{row.voucher_no}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              {voucherStageLabel(row.voucher_stage)}
                            </div>
                          </>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>
                            {row.approval_status === 'approved' ? 'Not invoiced yet' : '—'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell align="center">{paymentChip(row.payment_status)}</TableCell>
                      <TableCell>
                        {row.payment_status === 'paid' ? (
                          <>
                            <div style={{ fontSize: 12 }}>
                              {row.payment_method || 'Settled'}
                              {row.payment_reference ? ` · ${row.payment_reference}` : ''}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              {row.paid_at ? formatDate(row.paid_at) : ''}
                              {row.paid_by_name ? ` · ${row.paid_by_name}` : ''}
                            </div>
                          </>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Box>
  );
}
