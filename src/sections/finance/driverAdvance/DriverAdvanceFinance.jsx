import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
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
  Typography,
} from '@mui/material';
import {
  useGetAdvanceRequestsForFinanceQuery,
  useUpdateAdvanceFinanceStatusMutation,
} from '../../../api/services NodeJs/vehicleRentApi';
import '../../../styles/driverAdvanceFinance.css';

const SELECT_MENU_Z_INDEX = 6100;
const selectMenuPropsAboveOverlay = {
  slotProps: {
    root: { sx: { zIndex: SELECT_MENU_Z_INDEX } },
    paper: { sx: { zIndex: SELECT_MENU_Z_INDEX } },
  },
};

function formatDateOnly(value) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DriverAdvanceFinance = ({ embedded = false, externalMonth = '', onMonthChange = null }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [paymentProofById, setPaymentProofById] = useState({});
  const isMonthLocked = Boolean(externalMonth);
  const compactPopup = embedded;

  useEffect(() => {
    if (externalMonth && externalMonth !== selectedMonth) {
      setSelectedMonth(externalMonth);
    }
  }, [externalMonth, selectedMonth]);

  const months = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push({ value, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) });
    }
    return list;
  }, []);

  const { data: rows = [], isLoading, refetch } = useGetAdvanceRequestsForFinanceQuery({
    yearMonth: selectedMonth,
  });
  const [updateFinance, { isLoading: actionLoading }] = useUpdateAdvanceFinanceStatusMutation();
  const pendingCount = rows.filter((r) => String(r.finance_approval || 'p') === 'p').length;
  const approvedNotPaidCount = rows.filter(
    (r) => String(r.finance_approval || 'p') === 'a' && Number(r.finance_paid) !== 1
  ).length;
  const paidCount = rows.filter((r) => Number(r.finance_paid) === 1).length;

  const toDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handlePaymentProofChange = async (id, file) => {
    if (!file) return;
    try {
      const dataUrl = await toDataUrl(file);
      setPaymentProofById((prev) => ({
        ...prev,
        [id]: {
          name: file.name,
          dataUrl,
        },
      }));
    } catch (error) {
      alert('Failed to read selected file');
    }
  };

  const doFinanceAction = async (id, payload) => {
    try {
      await updateFinance({ id, ...payload }).unwrap();
      refetch();
    } catch (error) {
      alert(error?.data?.message || 'Failed to update finance status');
    }
  };

  return (
    <Box
      className={`daf-root${embedded ? ' daf-root--embedded' : ''}`}
      sx={embedded
        ? { p: 0, m: 0, backgroundColor: 'transparent', minHeight: 'auto' }
        : { p: 3, backgroundColor: '#f1f5f9', minHeight: '100vh' }}
    >
      <div className="daf-summary-strip" aria-label="Advance status summary">
        {!embedded ? (
          <div className="daf-summary-title">
            <strong>Driver Advance Finance</strong>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Month</InputLabel>
              <Select
                value={selectedMonth}
                label="Month"
                disabled={isMonthLocked && !onMonthChange}
                onChange={(e) => {
                  const nextMonth = e.target.value;
                  setSelectedMonth(nextMonth);
                  if (onMonthChange) onMonthChange(nextMonth);
                }}
                MenuProps={selectMenuPropsAboveOverlay}
              >
                {months.map((m) => (
                  <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        ) : null}
        <div className="daf-kpi-row">
          <div className="daf-kpi daf-kpi--pending">
            <span>Pending</span>
            <b>{pendingCount}</b>
          </div>
          <div className="daf-kpi daf-kpi--unpaid">
            <span>Approved, not paid</span>
            <b>{approvedNotPaidCount}</b>
          </div>
          <div className="daf-kpi daf-kpi--paid">
            <span>Paid</span>
            <b>{paidCount}</b>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: embedded ? 180 : 240 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <Card className="daf-table-card" sx={{ boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: embedded ? '68vh' : 'unset' }}>
            <Table size="small" stickyHeader={embedded}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 750, whiteSpace: 'nowrap' }}>Request Date</TableCell>
                  <TableCell sx={{ fontWeight: 750, whiteSpace: 'nowrap' }}>Driver</TableCell>
                  <TableCell sx={{ fontWeight: 750, whiteSpace: 'nowrap' }}>Vehicle</TableCell>
                  <TableCell sx={{ fontWeight: 750, whiteSpace: 'nowrap' }}>Amount (LKR)</TableCell>
                  <TableCell sx={{ fontWeight: 750, whiteSpace: 'nowrap' }}>Finance Approval</TableCell>
                  <TableCell sx={{ fontWeight: 750, whiteSpace: 'nowrap' }}>Paid</TableCell>
                  <TableCell sx={{ fontWeight: 750, whiteSpace: 'nowrap' }}>Payment Proof</TableCell>
                  <TableCell sx={{ fontWeight: 750, whiteSpace: 'nowrap' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover sx={{ '&:nth-of-type(even)': { backgroundColor: '#fbfdff' } }}>
                    <TableCell>{formatDateOnly(r.request_date)}</TableCell>
                    <TableCell>{r.requested_by_name || '-'}</TableCell>
                    <TableCell>{r.vehicle_no || '-'}</TableCell>
                    <TableCell>{Number(r.amount || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={r.finance_approval === 'a' ? 'success' : r.finance_approval === 'd' ? 'error' : 'warning'}
                        label={
                          r.finance_approval === 'a'
                            ? 'Approved'
                            : r.finance_approval === 'd'
                            ? 'Declined'
                            : 'Pending'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={Number(r.finance_paid) === 1 ? 'success' : 'default'}
                        label={Number(r.finance_paid) === 1 ? 'Paid' : 'Not Paid'}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Button component="label" size="small" variant="outlined" sx={{ textTransform: 'none' }}>
                          {compactPopup ? 'Upload' : 'Upload (Image/PDF)'}
                          <input
                            type="file"
                            hidden
                            accept="image/*,application/pdf"
                            onChange={(e) => handlePaymentProofChange(r.id, e.target.files?.[0])}
                          />
                        </Button>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                          {paymentProofById[r.id]?.name || (r.payment_image_url || r.payment_image ? 'Already uploaded' : 'No file')}
                        </Typography>
                        {(r.payment_image_url || r.payment_image) && (
                          <a href={r.payment_image_url || r.payment_image} target="_blank" rel="noreferrer">View current proof</a>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          disabled={actionLoading || String(r.finance_approval || 'p') === 'a'}
                          onClick={() =>
                            doFinanceAction(r.id, {
                              finance_approval: 'a',
                            })
                          }
                        >
                          {compactPopup ? 'Approve' : 'Finance Approve'}
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          disabled={actionLoading || String(r.finance_approval || 'p') !== 'a' || Number(r.finance_paid) === 1}
                          onClick={() =>
                            doFinanceAction(r.id, {
                              finance_paid: 1,
                              payment_image: paymentProofById[r.id]?.dataUrl,
                            })
                          }
                        >
                          {compactPopup ? 'Paid' : 'Mark Paid'}
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">No advance requests for finance.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Box>
  );
};

export default DriverAdvanceFinance;
