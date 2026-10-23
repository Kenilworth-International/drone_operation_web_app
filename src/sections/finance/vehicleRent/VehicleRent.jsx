import React, { useEffect, useMemo, useState } from 'react';
import { getResourceUrl } from '../../../utils/resourceUrls';
import {
  useGetApprovedForFinanceQuery,
  useGetMonthlySummaryByVehicleQuery,
  useUpdateFinanceStatusMutation,
} from '../../../api/services NodeJs/vehicleRentApi';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  Grid,
  CircularProgress,
  Alert,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  InputAdornment,
} from '@mui/material';
import {
  DirectionsCar,
  CalendarToday,
  Download,
  FilterList,
  Visibility,
  Cancel,
  HelpOutline,
} from '@mui/icons-material';
import '../../../styles/vehicleRent.css';

function nonEmptySrc(value) {
  const s = String(value == null ? '' : value).trim();
  return s || undefined;
}

const TOOLTIP_Z_INDEX = 6000;
const tooltipAboveOverlaySlotProps = {
  popper: {
    sx: { zIndex: TOOLTIP_Z_INDEX },
  },
};
const SELECT_MENU_Z_INDEX = 6100;
const selectMenuPropsAboveOverlay = {
  slotProps: {
    root: { sx: { zIndex: SELECT_MENU_Z_INDEX } },
    paper: { sx: { zIndex: SELECT_MENU_Z_INDEX } },
  },
};

const VehicleRent = ({
  embedded = false,
  externalMonth = '',
  forcedTab = null,
  lockTab = false,
  onMonthChange = null,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [tabValue, setTabValue] = useState(0);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [imageDialog, setImageDialog] = useState({ open: false, imageUrl: null, title: '' });
  const [paymentDialog, setPaymentDialog] = useState({ open: false, record: null });
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentProofDataUrl, setPaymentProofDataUrl] = useState('');
  const [updateFinanceStatus, { isLoading: updatingFinanceStatus }] = useUpdateFinanceStatusMutation();
  const isMonthLocked = Boolean(externalMonth);
  const isCompactPopup = embedded && lockTab;

  useEffect(() => {
    if (externalMonth && externalMonth !== selectedMonth) {
      setSelectedMonth(externalMonth);
    }
  }, [externalMonth, selectedMonth]);

  useEffect(() => {
    if (forcedTab === 0 || forcedTab === 1) {
      setTabValue(forcedTab);
    }
  }, [forcedTab]);

  // Generate list of months (last 12 months)
  const months = useMemo(() => {
    const monthsList = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      monthsList.push({ value: `${year}-${month}`, label: monthName });
    }
    return monthsList;
  }, []);

  // Queries
  const { 
    data: approvedData = [], 
    isLoading: approvedLoading, 
    error: approvedError
  } = useGetApprovedForFinanceQuery({ yearMonth: selectedMonth, vehicle: selectedVehicle || undefined });

  const { 
    data: monthlySummary = [], 
    isLoading: summaryLoading, 
    error: summaryError
  } = useGetMonthlySummaryByVehicleQuery({ yearMonth: selectedMonth });

  // Filter approved data by vehicle if selected (using vehicle_no)
  const filteredApprovedData = useMemo(() => {
    if (!selectedVehicle) return approvedData;
    return approvedData.filter(item => 
      (item.vehicle_no || item.vehicle) === selectedVehicle
    );
  }, [approvedData, selectedVehicle]);

  // Get unique vehicles from approved data (prioritize vehicle_no)
  const uniqueVehicles = useMemo(() => {
    const vehicles = new Set();
    approvedData.forEach(item => {
      const vehicleNo = item.vehicle_no || item.vehicle;
      if (vehicleNo) vehicles.add(vehicleNo);
    });
    return Array.from(vehicles).sort();
  }, [approvedData]);

  const formatCurrency = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 'LKR 0.00';
    return `LKR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const raw = String(dateString).trim();
      const date = raw.includes('T') ? new Date(raw) : new Date(`${raw}T00:00:00`);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      return dateString;
    }
  };

  const compactText = (value, max = 38) => {
    const text = String(value || '').trim();
    if (!text) return '-';
    if (text.length <= max) return text;
    return `${text.slice(0, max)}...`;
  };

  const renderRentCalculationTooltip = (record) => {
    const monthlyRate = Number(record?.monthly_rate || 0);
    const totalDays = Number(record?.total_days || 0);
    const workingDaysRaw = record?.working_days ?? record?.no_of_working_days ?? record?.vehicle_working_days;
    const workingDays = workingDaysRaw == null || workingDaysRaw === '' ? null : Number(workingDaysRaw);
    const totalKm = Number(record?.total_km || 0);
    const kmLimit = Number(record?.km_limit ?? record?.no_of_km_for_month ?? 0);
    const extraKm = Number(
      record?.extra_km != null ? record.extra_km : Math.max(totalKm - kmLimit, 0)
    ) || 0;
    const ratePerKm = Number(record?.rate_per_km || 0);
    const extraCharge = Number((extraKm * ratePerKm).toFixed(2));
    const grossRent = Number(record?.monthly_rent || 0);
    const advanceDeduction = Number(record?.advance_paid_total || 0);
    const netPayable = Number(record?.net_monthly_rent ?? grossRent);

    return (
      <Box sx={{ p: 0.5, minWidth: 260 }}>
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 0.5 }}>
          Rent calculation
        </Typography>
        <Typography variant="caption" sx={{ display: 'block' }}>
          Configured monthly rate: {formatCurrency(monthlyRate)}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block' }}>
          Verified days: {totalDays}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block' }}>
          Configured working days: {workingDays == null || Number.isNaN(workingDays) ? '-' : workingDays}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block' }}>
          Total KM: {totalKm.toFixed(1)} | Limit: {kmLimit.toFixed(1)}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block' }}>
          Extra KM x Rate/KM: {extraKm.toFixed(1)} x {formatCurrency(ratePerKm)} = {formatCurrency(extraCharge)}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block' }}>
          Gross rent (after day/KM rules): {formatCurrency(grossRent)}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block' }}>
          Advance deduction: {formatCurrency(advanceDeduction)}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
          Net payable: {formatCurrency(netPayable)}
        </Typography>
      </Box>
    );
  };

  const openImageDialog = (imageUrl, title) => {
    const src = nonEmptySrc(imageUrl);
    if (!src) return;
    setImageDialog({ open: true, imageUrl: src, title });
  };

  const closeImageDialog = () => {
    setImageDialog({ open: false, imageUrl: null, title: '' });
  };

  const openPaymentDialog = (record) => {
    setPaymentDialog({ open: true, record });
    setPaymentProofFile(null);
    setPaymentProofDataUrl('');
  };

  const closePaymentDialog = () => {
    setPaymentDialog({ open: false, record: null });
    setPaymentProofFile(null);
    setPaymentProofDataUrl('');
  };

  const readAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const getFinanceApprovalLabel = (value) => {
    const status = String(value || 'p').toLowerCase();
    if (status === 'a') return 'Approved';
    if (status === 'd') return 'Declined';
    return 'Pending';
  };

  const handleFinanceApprove = async (record) => {
    try {
      await updateFinanceStatus({
        id: record.id,
        finance_approval: 'a',
      }).unwrap();
    } catch (error) {
      // eslint-disable-next-line no-alert
      alert(error?.data?.message || 'Failed to update finance approval');
    }
  };

  const handleFinancePaid = async (record) => {
    try {
      if (!paymentProofDataUrl) {
        // eslint-disable-next-line no-alert
        alert('Please upload payment proof (image or PDF) before marking as paid');
        return;
      }
      await updateFinanceStatus({
        id: record.id,
        finance_paid: 1,
        payment_image: paymentProofDataUrl,
      }).unwrap();
      closePaymentDialog();
    } catch (error) {
      // eslint-disable-next-line no-alert
      alert(error?.data?.message || 'Failed to mark finance paid');
    }
  };

  const isPdfProof = (proofNameOrUrl) => String(proofNameOrUrl || '').toLowerCase().endsWith('.pdf');

  const openPaymentProof = (record) => {
    const urlFromUrl = nonEmptySrc(record.payment_image_url);
    const filename = String(record.payment_image || '').trim();
    const url = urlFromUrl || getResourceUrl('VEHICLE_DAY', filename) || '';
    const src = nonEmptySrc(url);
    if (!src) return;
    if (isPdfProof(filename || src)) {
      window.open(src, '_blank', 'noopener,noreferrer');
      return;
    }
    openImageDialog(src, `Payment Proof - ${record.vehicle_no || record.vehicle}`);
  };

  if (approvedLoading || summaryLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={embedded ? 220 : 400}>
        <CircularProgress />
      </Box>
    );
  }

  if (approvedError || summaryError) {
    return (
      <Box p={3}>
        <Alert severity="error">
          Error loading data: {approvedError?.message || summaryError?.message || 'Unknown error'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      className="vehicle-rent-container"
      sx={embedded
        ? { p: 0, m: 0, backgroundColor: 'transparent', minHeight: 'auto' }
        : { p: { xs: 2, sm: 3 }, backgroundColor: '#f3f7fb', minHeight: '100vh' }}
    >
      {/* Filters — month lives in parent toolbar when embedded */}
      <Card 
        className="vehicle-rent-filter-card"
        sx={{ 
          mb: 1.5,
          p: embedded ? 1.25 : 1.6,
          boxShadow: 'none',
          borderRadius: 2,
          background: '#fff',
          border: '1px solid #d9e5ef'
        }}
      >
        {!embedded ? (
          <Box sx={{ mb: 1.25, display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <FilterList sx={{ color: 'primary.main', fontSize: 18 }} />
            <Typography variant="body1" sx={{ fontWeight: 600, color: '#1a202c' }}>
              Filters
            </Typography>
          </Box>
        ) : null}
        <Grid container spacing={1.25} alignItems="center">
          {!embedded ? (
            <Grid size={{ xs: 12, sm: 6, md: 5 }}>
              <FormControl 
                fullWidth 
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'white',
                    borderRadius: 2,
                    '&:hover': {
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'primary.main',
                      },
                    },
                  },
                }}
              >
                <InputLabel>Select Month</InputLabel>
                <Select
                  value={selectedMonth}
                  label="Select Month"
                  onChange={(e) => {
                    const nextMonth = e.target.value;
                    setSelectedMonth(nextMonth);
                    if (onMonthChange) onMonthChange(nextMonth);
                  }}
                  disabled={isMonthLocked && !onMonthChange}
                  MenuProps={selectMenuPropsAboveOverlay}
                  startAdornment={
                    <InputAdornment position="start" sx={{ ml: 1 }}>
                      <CalendarToday sx={{ fontSize: 18, color: 'text.secondary' }} />
                    </InputAdornment>
                  }
                >
                  {months.map((month) => (
                    <MenuItem key={month.value} value={month.value}>
                      {month.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          ) : null}
          <Grid size={{ xs: 12, sm: embedded ? 9 : 6, md: embedded ? 9 : 5 }}>
            <FormControl 
              fullWidth 
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'white',
                  borderRadius: 2,
                  '&:hover': {
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                    },
                  },
                },
              }}
            >
              <InputLabel>Filter by Vehicle</InputLabel>
              <Select
                value={selectedVehicle}
                label="Filter by Vehicle"
                onChange={(e) => setSelectedVehicle(e.target.value)}
                MenuProps={selectMenuPropsAboveOverlay}
                startAdornment={
                  <InputAdornment position="start" sx={{ ml: 1 }}>
                    <DirectionsCar sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                }
              >
                <MenuItem value="">All Vehicles</MenuItem>
                {uniqueVehicles.map((vehicle) => (
                  <MenuItem key={vehicle} value={vehicle}>
                    {vehicle}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 12, md: 2 }} sx={{ display: 'flex', gap: 0.75, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            {(selectedVehicle || (!isMonthLocked && selectedMonth !== months[0]?.value)) ? (
              <Tooltip title="Clear Filters">
                <IconButton 
                  onClick={() => {
                    setSelectedVehicle('');
                    if (!isMonthLocked) {
                      const now = new Date();
                      setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                    }
                  }}
                  size="small"
                  sx={{ 
                    backgroundColor: 'error.light',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'error.main',
                    },
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  <Cancel />
                </IconButton>
              </Tooltip>
            ) : null}
          </Grid>
        </Grid>
      </Card>

      {!lockTab ? (
        <Card sx={{ mb: 1.5, boxShadow: 'none', border: '1px solid #d9e5ef', borderRadius: 2 }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, newValue) => setTabValue(newValue)}
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                minHeight: 64,
              },
            }}
          >
            <Tab icon={<DirectionsCar />} iconPosition="start" label="Vehicle Summary" />
            <Tab icon={<CalendarToday />} iconPosition="start" label="Monthly Records" />
          </Tabs>
        </Card>
      ) : null}

      {/* Vehicle Summary Tab */}
      {tabValue === 0 && (
        <Card sx={{ boxShadow: 'none', border: '1px solid #d9e5ef', borderRadius: 2, overflow: 'hidden' }}>
          {monthlySummary.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <DirectionsCar sx={{ fontSize: 64, color: '#cbd5e0', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No vehicle data for selected month
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Vehicle</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Make & Model</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Driver</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Total Days</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Approved Days</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Monthly Rate</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">KM Limit</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Rate/KM</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Total KM</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Excess KM</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Base Rent</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Advance Deduction</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Net Payable</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Finance Approved</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Finance Paid</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>First Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Last Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monthlySummary.map((summary, index) => (
                    <TableRow 
                      key={`${summary.vehicle_no || summary.vehicle}-${index}`}
                      hover
                      sx={{ 
                        '&:hover': { backgroundColor: '#f8f9fa' },
                        transition: 'background-color 0.2s',
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {summary.vehicle_no || summary.vehicle}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {summary.make || 'N/A'} {summary.model || ''}
                        </Typography>
                      </TableCell>
                      <TableCell>{summary.driver_name || 'N/A'}</TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={summary.total_days || 0} 
                          color="primary" 
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={summary.approved_days || 0} 
                          color="success" 
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell align="right">{formatCurrency(summary.monthly_rate || 0)}</TableCell>
                      <TableCell align="right">{Number(summary.no_of_km_for_month || 0).toFixed(0)}</TableCell>
                      <TableCell align="right">{formatCurrency(summary.rate_per_km || 0)}</TableCell>
                      <TableCell align="right">{Number(summary.total_km || 0).toFixed(1)}</TableCell>
                      <TableCell align="right">{Number(summary.extra_km || 0).toFixed(1)}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(summary.monthly_rent || 0)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: Number(summary.advance_paid_total || 0) > 0 ? 'error.main' : 'text.secondary' }}>
                        {formatCurrency(summary.advance_paid_total || 0)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                        {formatCurrency(summary.net_monthly_rent ?? summary.monthly_rent)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getFinanceApprovalLabel(summary.finance_approval)}
                          size="small"
                          color={
                            String(summary.finance_approval || 'p') === 'a'
                              ? 'success'
                              : String(summary.finance_approval || 'p') === 'd'
                                ? 'error'
                                : 'warning'
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={Number(summary.finance_paid) === 1 ? 'Paid' : 'Not Paid'}
                          size="small"
                          color={Number(summary.finance_paid) === 1 ? 'success' : 'default'}
                          variant={Number(summary.finance_paid) === 1 ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell>{formatDate(summary.first_date)}</TableCell>
                      <TableCell>{formatDate(summary.last_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      )}

      {/* Monthly Records Tab */}
      {tabValue === 1 && (
        <Card sx={{ boxShadow: 'none', border: '1px solid #d9e5ef', borderRadius: 2, overflow: 'hidden' }}>
          {filteredApprovedData.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CalendarToday sx={{ fontSize: 64, color: '#cbd5e0', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No approved records for selected filters
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: isCompactPopup ? '70vh' : 'unset' }}>
              <Table size={isCompactPopup ? 'small' : 'medium'} stickyHeader={isCompactPopup}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Month</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Vehicle</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Driver</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Total Days</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Total KM</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Base Rent</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Advance Deduction</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Net Payable</TableCell>
                    {!isCompactPopup ? <TableCell sx={{ fontWeight: 600 }}>Reduction Reason</TableCell> : null}
                    <TableCell sx={{ fontWeight: 600 }}>Payment Proof</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Finance Approved</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Finance Paid</TableCell>
                    {!isCompactPopup ? <TableCell sx={{ fontWeight: 600 }}>Approved By</TableCell> : null}
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredApprovedData.map((record) => (
                    <TableRow 
                      key={record.id}
                      hover
                      sx={{ 
                        '&:hover': { backgroundColor: '#f8f9fa' },
                        transition: 'background-color 0.2s',
                      }}
                    >
                      <TableCell>{record.month_key || selectedMonth}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {record.vehicle_no || record.vehicle}
                        </Typography>
                      </TableCell>
                      <TableCell>{record.driver_name || 'N/A'}</TableCell>
                      <TableCell>{record.total_days || 0}</TableCell>
                      <TableCell>{Number(record.total_km || 0).toFixed(1)}</TableCell>
                      <TableCell>
                        {formatCurrency(record.monthly_rent || 0)}
                      </TableCell>
                      <TableCell sx={{ color: Number(record.advance_paid_total || 0) > 0 ? 'error.main' : 'text.secondary' }}>
                        {formatCurrency(record.advance_paid_total || 0)}
                      </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                          {formatCurrency(record.net_monthly_rent ?? record.monthly_rent)}
                        </Typography>
                        <Tooltip
                          title={renderRentCalculationTooltip(record)}
                          arrow
                          placement="top"
                          slotProps={tooltipAboveOverlaySlotProps}
                        >
                          <IconButton size="small" sx={{ p: 0.25, color: 'info.main' }}>
                            <HelpOutline sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                      {!isCompactPopup ? (
                        <TableCell>
                          {Number(record.advance_paid_total || 0) > 0
                            ? (record.approval_note || `Reduced by ${formatCurrency(record.advance_paid_total)} due to paid advances`)
                            : '-'}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        {record.payment_image_url || record.payment_image ? (
                          <Tooltip title="View Payment Proof">
                            <IconButton
                              size="small"
                              onClick={() => openPaymentProof(record)}
                            >
                              <Visibility fontSize="small" color="primary" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getFinanceApprovalLabel(record.finance_approval)}
                          size="small"
                          color={
                            String(record.finance_approval || 'p') === 'a'
                              ? 'success'
                              : String(record.finance_approval || 'p') === 'd'
                                ? 'error'
                                : 'warning'
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={Number(record.finance_paid) === 1 ? 'Paid' : 'Not Paid'}
                          size="small"
                          color={Number(record.finance_paid) === 1 ? 'success' : 'default'}
                          variant={Number(record.finance_paid) === 1 ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      {!isCompactPopup ? (
                        <TableCell>
                          <Chip 
                            label={record.finance_approved_by_name || 'N/A'} 
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            disabled={updatingFinanceStatus || String(record.finance_approval || 'p') === 'a'}
                            onClick={() => handleFinanceApprove(record)}
                            sx={{ minWidth: isCompactPopup ? 112 : 'auto', textTransform: 'none' }}
                          >
                            Finance Approve
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            disabled={
                              updatingFinanceStatus ||
                              String(record.finance_approval || 'p') !== 'a' ||
                              Number(record.finance_paid) === 1
                            }
                            onClick={() => openPaymentDialog(record)}
                            sx={{ minWidth: isCompactPopup ? 92 : 'auto', textTransform: 'none' }}
                          >
                            Mark Paid
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      )}

      <Dialog
        open={paymentDialog.open}
        onClose={closePaymentDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Upload Payment Proof</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload payment verification file as image or PDF before marking this record as paid.
          </Typography>
          {paymentDialog.record && (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Vehicle:</strong> {paymentDialog.record.vehicle_no || paymentDialog.record.vehicle}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Base Rent:</strong> {formatCurrency(paymentDialog.record.monthly_rent || 0)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Advance Deduction:</strong> {formatCurrency(paymentDialog.record.advance_paid_total || 0)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, fontWeight: 700, color: 'success.main' }}>
                <strong>Net Payable:</strong> {formatCurrency(paymentDialog.record.net_monthly_rent ?? paymentDialog.record.monthly_rent)}
              </Typography>
            </>
          )}
          <Button variant="outlined" component="label" sx={{ textTransform: 'none' }}>
            Choose File
            <input
              hidden
              type="file"
              accept="image/*,application/pdf,.pdf"
              onChange={async (e) => {
                const file = e.target.files?.[0] || null;
                setPaymentProofFile(file);
                if (!file) {
                  setPaymentProofDataUrl('');
                  return;
                }
                try {
                  const dataUrl = await readAsDataUrl(file);
                  setPaymentProofDataUrl(String(dataUrl || ''));
                } catch (error) {
                  setPaymentProofDataUrl('');
                }
              }}
            />
          </Button>
          {paymentProofFile && (
            <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
              Selected: {paymentProofFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closePaymentDialog} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={() => handleFinancePaid(paymentDialog.record)}
            variant="contained"
            disabled={updatingFinanceStatus}
            sx={{ textTransform: 'none' }}
          >
            {updatingFinanceStatus ? <CircularProgress size={18} /> : 'Upload & Mark Paid'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image View Dialog — z-index above parent page overlays */}
      <Dialog
        open={imageDialog.open}
        onClose={closeImageDialog}
        fullScreen
        slotProps={{
          root: {
            sx: { zIndex: 5000 },
          },
        }}
        PaperProps={{
          sx: { 
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            m: 0,
          }
        }}
      >
        <DialogTitle 
          sx={{ 
            p: 2,
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'white' }}>
            {imageDialog.title}
          </Typography>
          <IconButton 
            onClick={closeImageDialog} 
            sx={{ 
              color: 'white',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                transform: 'rotate(90deg)',
              },
              transition: 'all 0.3s ease',
            }}
            size="large"
          >
            <Cancel fontSize="large" />
          </IconButton>
        </DialogTitle>
        <DialogContent 
          sx={{ 
            p: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 'calc(100vh - 80px)',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              height: '100%',
              p: 2,
            }}
          >
            {nonEmptySrc(imageDialog.imageUrl) ? (
              <img
                src={nonEmptySrc(imageDialog.imageUrl)}
                alt={imageDialog.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: '8px',
                }}
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+';
                }}
              />
            ) : null}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default VehicleRent;
