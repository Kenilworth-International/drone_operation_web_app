import React, { useEffect, useMemo, useState } from 'react';
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
  Typography,
} from '@mui/material';
import {
  useGetAdvanceRequestsForFinanceQuery,
  useUpdateAdvanceFinanceStatusMutation,
} from '../../../api/services NodeJs/vehicleRentApi';

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
      sx={embedded
        ? { p: 0, m: 0, backgroundColor: 'transparent', minHeight: 'auto' }
        : { p: 3, backgroundColor: '#f3f7fb', minHeight: '100vh' }}
    >
      {!embedded ? (
        <Card
          elevation={0}
          sx={{
            p: 0,
            mb: 1.5,
            border: '1px solid #d9e5ef',
            borderRadius: 2,
            background: 'linear-gradient(180deg, #fdfefe 0%, #f6fbff 100%)',
          }}
        >
          <CardContent sx={{ p: '14px !important' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#102739', m: 0 }}>
                Driver Advance Finance
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(120px, 1fr))' },
                  gap: 1,
                  width: { xs: '100%', sm: 'auto' },
                  minWidth: { sm: 420 },
                }}
              >
                <Box sx={{ border: '1px solid #f6dfb0', background: '#fff7e8', borderRadius: 1.5, px: 1.2, py: 0.7 }}>
                  <Typography sx={{ fontSize: 11, color: '#7b5600', lineHeight: 1.2 }}>Pending</Typography>
                  <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#9a6700', lineHeight: 1.1 }}>{pendingCount}</Typography>
                </Box>
                <Box sx={{ border: '1px solid #ddd0ff', background: '#f1ecff', borderRadius: 1.5, px: 1.2, py: 0.7 }}>
                  <Typography sx={{ fontSize: 11, color: '#4a2f8a', lineHeight: 1.2 }}>Approved, Not Paid</Typography>
                  <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#5a3d9a', lineHeight: 1.1 }}>{approvedNotPaidCount}</Typography>
                </Box>
                <Box sx={{ border: '1px solid #c7ecd8', background: '#eaf8ef', borderRadius: 1.5, px: 1.2, py: 0.7 }}>
                  <Typography sx={{ fontSize: 11, color: '#1d6b3b', lineHeight: 1.2 }}>Paid</Typography>
                  <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#1f7a44', lineHeight: 1.1 }}>{paidCount}</Typography>
                </Box>
              </Box>
            </Box>
            <Box sx={{ mt: 1.2 }}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
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
            </Box>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: embedded ? 200 : 260 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card sx={{ boxShadow: 'none', border: '1px solid #d9e5ef', borderRadius: 2, overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: embedded ? '66vh' : 'unset' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f4f8fc' }}>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Request Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Driver</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Vehicle</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Amount (LKR)</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Finance Approval</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Paid</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Payment Proof</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Actions</TableCell>
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
