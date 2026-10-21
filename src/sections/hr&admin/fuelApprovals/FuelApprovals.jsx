import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ImageIcon from '@mui/icons-material/Image';
import {
  useGetPendingFuelApprovalsQuery,
  useGetFuelApprovalsHistoryQuery,
  useDecideFuelApprovalMutation,
} from '../../../api/services NodeJs/fuelApprovalsApi';
import ZoomableImageDialog from '../../../components/ZoomableImageDialog';

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatLkr = (value) =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(
    Number(value) || 0
  );

const StatusChip = ({ approved }) => {
  if (approved === 0)
    return <Chip size="small" label="Pending" sx={{ background: '#fff7e8', color: '#9a6700' }} />;
  if (approved === 1)
    return <Chip size="small" label="Approved" sx={{ background: '#eaf8ef', color: '#1f7a44' }} />;
  if (approved === 2)
    return <Chip size="small" label="Declined" sx={{ background: '#fdeff1', color: '#a63640' }} />;
  return <Chip size="small" label="Unknown" />;
};

const FuelApprovals = ({ embedded = false }) => {
  const [tab, setTab] = useState(0);
  const [decline, setDecline] = useState(null);
  const [approveConfirm, setApproveConfirm] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [actionError, setActionError] = useState(null);

  const {
    data: pending = [],
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = useGetPendingFuelApprovalsQuery();
  const {
    data: history = [],
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useGetFuelApprovalsHistoryQuery();
  const [decide, { isLoading: deciding }] = useDecideFuelApprovalMutation();

  const rows = tab === 0 ? pending : history;
  const loading = tab === 0 ? pendingLoading : historyLoading;

  const totals = useMemo(
    () => ({
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    }),
    [pending]
  );

  const submitApprove = async () => {
    if (!approveConfirm) return;
    try {
      await decide({ transaction_id: approveConfirm.id, approved: 1 }).unwrap();
      setApproveConfirm(null);
      refetchPending();
      refetchHistory();
    } catch (e) {
      setActionError(e?.data?.message || 'Failed to approve');
    }
  };

  const submitDecline = async () => {
    if (!decline?.reason?.trim()) return;
    try {
      await decide({
        transaction_id: decline.row.id,
        approved: 2,
        reject_reason: decline.reason.trim(),
      }).unwrap();
      setDecline(null);
      refetchPending();
      refetchHistory();
    } catch (e) {
      setActionError(e?.data?.message || 'Failed to decline');
    }
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#102739' }}>
                Fuel Approvals (HR)
              </Typography>
              <Typography variant="caption" sx={{ color: '#5f7383' }}>
                Approve or decline driver-submitted fuel bills. Approval debits the linked card balance.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
              <Chip size="small" label={`Pending: ${totals.pendingCount}`} sx={{ background: '#fff7e8', color: '#9a6700' }} />
              <Chip
                size="small"
                label={`Pending total: ${formatLkr(totals.pendingAmount)}`}
                sx={{ background: '#eef4ff', color: '#1d4ed8' }}
              />
            </Box>
          </Box>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 1.2 }}>
            <Tab label={`Pending (${pending.length})`} />
            <Tab label={`History (${history.length})`} />
          </Tabs>
        </CardContent>
      </Card>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card
          elevation={0}
          sx={{ border: '1px solid #d9e5ef', borderRadius: 2, overflow: 'hidden', backgroundColor: '#fff' }}
        >
          <TableContainer sx={{ maxHeight: embedded ? '64vh' : 'unset' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f4f8fc' }}>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Driver</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Vehicle</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Card</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Liters</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Unit Price</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Bill</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Bank Slip</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 4, color: '#7c8a99' }}>
                      {tab === 0 ? 'No pending fuel approvals' : 'No history yet'}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>{formatDate(row.date)}</div>
                        <div style={{ fontSize: 11, color: '#7c8a99' }}>{row.time || ''}</div>
                      </TableCell>
                      <TableCell>
                        <div style={{ fontWeight: 600 }}>{row.driver_name || '-'}</div>
                        <div style={{ fontSize: 11, color: '#7c8a99' }}>{row.driver_mobile || ''}</div>
                      </TableCell>
                      <TableCell>
                        <div style={{ fontWeight: 600 }}>{row.vehicle_no || '-'}</div>
                        <div style={{ fontSize: 11, color: '#7c8a99' }}>{row.fuel_category_name || ''}</div>
                      </TableCell>
                      <TableCell>
                        <div style={{ fontWeight: 600 }}>{row.card_holder || '-'}</div>
                        <div style={{ fontSize: 11, color: '#7c8a99', fontFamily: 'monospace' }}>{row.card_number}</div>
                      </TableCell>
                      <TableCell align="right">{Number(row.liters || 0).toFixed(2)}</TableCell>
                      <TableCell align="right">
                        {row.unit_price != null ? Number(row.unit_price).toFixed(2) : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatLkr(row.amount)}
                      </TableCell>
                      <TableCell align="center">
                        {row.bill_image_url ? (
                          <Tooltip title="View bill">
                            <Button
                              size="small"
                              startIcon={<ImageIcon />}
                              onClick={(e) => {
                                e.currentTarget.blur();
                                setImagePreview(row.bill_image_url);
                              }}
                              sx={{ textTransform: 'none' }}
                            >
                              View
                            </Button>
                          </Tooltip>
                        ) : (
                          <span style={{ color: '#aab4be' }}>-</span>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {row.bank_slip_image_url ? (
                          <Tooltip title="View bank slip">
                            <Button
                              size="small"
                              startIcon={<ImageIcon />}
                              onClick={(e) => {
                                e.currentTarget.blur();
                                setImagePreview(row.bank_slip_image_url);
                              }}
                              sx={{ textTransform: 'none' }}
                            >
                              View
                            </Button>
                          </Tooltip>
                        ) : (
                          <span style={{ color: '#aab4be' }}>-</span>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <StatusChip approved={row.approved} />
                        {row.approved === 2 && row.reject_reason ? (
                          <Tooltip title={row.reject_reason}>
                            <Typography
                              variant="caption"
                              sx={{
                                display: 'block',
                                color: '#a63640',
                                maxWidth: 220,
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
                      <TableCell align="center">
                        {row.approved === 0 ? (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={<CheckCircleIcon />}
                              disabled={deciding}
                              onClick={() => setApproveConfirm(row)}
                              sx={{ textTransform: 'none' }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<CancelIcon />}
                              disabled={deciding}
                              onClick={() => setDecline({ row, reason: '' })}
                              sx={{ textTransform: 'none' }}
                            >
                              Decline
                            </Button>
                          </Box>
                        ) : (
                          <span style={{ color: '#aab4be' }}>—</span>
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

      {/* Decline reason modal */}
      <Dialog open={!!decline} onClose={() => !deciding && setDecline(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Decline Fuel Bill</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5, color: '#5f7383' }}>
            Please provide a reason. The driver will see this on their app.
          </Typography>
          <TextField
            autoFocus
            multiline
            minRows={3}
            fullWidth
            placeholder="Reason for declining..."
            value={decline?.reason || ''}
            onChange={(e) => setDecline((prev) => (prev ? { ...prev, reason: e.target.value } : prev))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecline(null)} disabled={deciding}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={submitDecline}
            disabled={deciding || !decline?.reason?.trim()}
          >
            Decline
          </Button>
        </DialogActions>
      </Dialog>

      <ZoomableImageDialog
        open={!!imagePreview}
        src={imagePreview}
        title="Fuel Bill"
        alt="Fuel bill"
        onClose={() => setImagePreview(null)}
      />

      {/* Approve confirmation modal */}
      <Dialog
        open={!!approveConfirm}
        onClose={() => !deciding && setApproveConfirm(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Approve Fuel Bill</DialogTitle>
        <DialogContent>
          {approveConfirm ? (
            <Box sx={{ pt: 0.5 }}>
              <Typography variant="body2" sx={{ color: '#5f7383', mb: 1.5 }}>
                Approving will deduct the amount from the linked card balance. This cannot be undone.
              </Typography>
              <Box sx={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 1, p: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Driver</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {approveConfirm.driver_name || '-'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Vehicle</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {approveConfirm.vehicle_no || '-'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Liters</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {Number(approveConfirm.liters || 0).toFixed(2)} L
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, pt: 1, borderTop: '1px dashed #cbd5e1' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Amount</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#1d4ed8' }}>
                    {formatLkr(approveConfirm.amount)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveConfirm(null)} disabled={deciding}>Cancel</Button>
          <Button variant="contained" color="success" onClick={submitApprove} disabled={deciding}>
            {deciding ? 'Approving...' : 'Confirm Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Action error modal */}
      <Dialog open={!!actionError} onClose={() => setActionError(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Action Failed</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#a63640' }}>{actionError}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionError(null)} variant="contained">OK</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FuelApprovals;
