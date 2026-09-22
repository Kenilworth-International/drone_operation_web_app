import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  useGetAccidentReportsQuery,
  useGetAccidentReportByIdQuery,
  useGetPilotsQuery,
  useDeclineAccidentReportMutation,
  useRecommendInvestigationMutation,
  useStartInvestigationMutation,
  useUpdateInvestigationNotesMutation,
  useSubmitInvestigationReviewMutation,
  useCompleteInvestigationMutation,
  useApproveAccidentReportMutation,
} from '../../../../api/services NodeJs/accidentReportsApi';
import { useGetTechniciansQuery } from '../../../../api/services NodeJs/maintenanceApi';
import { downloadResource, getResourceUrl } from '../utils/media';

const EMPTY_FILTERS = {
  start_date: '',
  end_date: '',
  pilot: '',
  equipment_type: '',
  device_serial: '',
};

const EMPTY_ACTION_FORM = {
  decline_reason: '',
  technician_id: '',
  description: '',
  scheduled_date: '',
  notes: '',
  findings: '',
  suspected_fault: '',
  who_at_fault: '',
};

function getCurrentUserId() {
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  return userData?.id || null;
}

export function useIncidentReportsPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageRotation, setImageRotation] = useState(0);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [actionForm, setActionForm] = useState(EMPTY_ACTION_FORM);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const cleanFilters = useMemo(() => {
    const cleaned = {};
    Object.keys(filters).forEach((key) => {
      if (filters[key]) cleaned[key] = filters[key];
    });
    return cleaned;
  }, [filters]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => String(value || '').trim() !== '').length,
    [filters]
  );
  const hasActiveFilters = activeFilterCount > 0;

  const { data: reportsData, isLoading, error, refetch } = useGetAccidentReportsQuery(cleanFilters);
  const { data: pilotsData } = useGetPilotsQuery();
  const { data: reportDetail, isLoading: detailLoading } = useGetAccidentReportByIdQuery(selectedReport?.id, {
    skip: !showDetailsModal || !selectedReport?.id,
  });
  const [declineReport] = useDeclineAccidentReportMutation();
  const [recommendInvestigation] = useRecommendInvestigationMutation();
  const [startInvestigation] = useStartInvestigationMutation();
  const [updateInvestigationNotes] = useUpdateInvestigationNotesMutation();
  const [submitInvestigationReview] = useSubmitInvestigationReviewMutation();
  const [completeInvestigation] = useCompleteInvestigationMutation();
  const [approveReport] = useApproveAccidentReportMutation();
  const { data: techniciansData } = useGetTechniciansQuery();

  const reports = Array.isArray(reportsData) ? reportsData : reportsData ? [reportsData] : [];
  const pilots = Array.isArray(pilotsData) ? pilotsData : pilotsData ? [pilotsData] : [];
  const technicians = Array.isArray(techniciansData) ? techniciansData : techniciansData ? [techniciansData] : [];
  const detailView = reportDetail || selectedReport;

  useEffect(() => {
    if (!message || messageType !== 'success') return undefined;
    const timer = setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, messageType]);

  const filteredReports = useMemo(() => {
    if (!reports.length) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return reports;
    return reports.filter((report) => {
      if (!report) return false;
      return (
        String(report.id || '').includes(term) ||
        (report.pilot_name && String(report.pilot_name).toLowerCase().includes(term)) ||
        (report.device_serial && String(report.device_serial).toLowerCase().includes(term)) ||
        (report.estate_name && String(report.estate_name).toLowerCase().includes(term)) ||
        (report.equipment_type_name && String(report.equipment_type_name).toLowerCase().includes(term)) ||
        (report.incident_type_name && String(report.incident_type_name).toLowerCase().includes(term))
      );
    });
  }, [reports, searchTerm]);

  const openDetails = useCallback((report) => {
    setSelectedReport(report);
    setShowDetailsModal(true);
  }, []);

  const closeDetails = useCallback(() => {
    setShowDetailsModal(false);
    setSelectedReport(null);
  }, []);

  const openAction = useCallback((report, type) => {
    setSelectedReport(report);
    setActionType(type);
    setActionForm({
      ...EMPTY_ACTION_FORM,
      notes: report.investigation_notes || '',
      findings: report.investigation_findings || '',
      description: report.approval_suggestions || '',
    });
    setShowActionModal(true);
  }, []);

  const closeAction = useCallback(() => {
    setShowActionModal(false);
    setSelectedReport(null);
    setActionType(null);
    setActionForm(EMPTY_ACTION_FORM);
  }, []);

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const handleDownload = useCallback((url, filename, resourceType) => {
    try {
      downloadResource(url, filename, resourceType);
    } catch {
      try {
        window.open(getResourceUrl(url, resourceType), '_blank');
      } catch {
        setMessage('Could not download this file. Try right-click and Save As.');
        setMessageType('warning');
      }
    }
  }, []);

  const openImageViewer = useCallback((imageUrl) => {
    setSelectedImage(imageUrl);
    setImageRotation(0);
  }, []);

  const closeImageViewer = useCallback(() => {
    setSelectedImage(null);
    setImageRotation(0);
  }, []);

  const rotateImage = useCallback((direction) => {
    setImageRotation((prev) => (direction === 'left' ? prev - 90 : prev + 90));
  }, []);

  const submitAction = useCallback(
    async (event) => {
      event.preventDefault();
      if (!selectedReport) return;

      try {
        const userId = getCurrentUserId();
        if (!userId) {
          setMessage('Please sign in again to continue.');
          setMessageType('warning');
          return;
        }

        if (actionType === 'decline') {
          if (!actionForm.decline_reason.trim()) {
            setMessage('Please enter a decline reason.');
            setMessageType('warning');
            return;
          }
          await declineReport({
            id: selectedReport.id,
            decline_reason: actionForm.decline_reason,
            action_by: userId,
          }).unwrap();
          setMessage('Incident report declined.');
          setMessageType('success');
        } else if (actionType === 'recommend_investigation') {
          if (!actionForm.notes.trim()) {
            setMessage('Please enter a recommendation reason.');
            setMessageType('warning');
            return;
          }
          await recommendInvestigation({
            id: selectedReport.id,
            action_by: userId,
            recommended_by: userId,
            reason: actionForm.notes,
            suspected_fault: actionForm.suspected_fault || null,
            who_at_fault: actionForm.who_at_fault || null,
            notes: actionForm.notes,
          }).unwrap();
          setMessage('Investigation recommendation sent to HR.');
          setMessageType('success');
        } else if (actionType === 'start_investigation') {
          await startInvestigation({
            id: selectedReport.id,
            action_by: userId,
            notes: actionForm.notes || null,
          }).unwrap();
          setMessage('Investigation started.');
          setMessageType('success');
        } else if (actionType === 'investigation_notes') {
          await updateInvestigationNotes({
            id: selectedReport.id,
            notes: actionForm.notes,
          }).unwrap();
          setMessage('Investigation notes saved.');
          setMessageType('success');
        } else if (actionType === 'submit_review') {
          await submitInvestigationReview({
            id: selectedReport.id,
            action_by: userId,
          }).unwrap();
          setMessage('Investigation submitted for review.');
          setMessageType('success');
        } else if (actionType === 'complete_investigation') {
          if (!actionForm.findings.trim()) {
            setMessage('Investigation findings are required.');
            setMessageType('warning');
            return;
          }
          await completeInvestigation({
            id: selectedReport.id,
            action_by: userId,
            findings: actionForm.findings,
          }).unwrap();
          setMessage('Investigation completed.');
          setMessageType('success');
        } else if (actionType === 'approve' || actionType === 'repair') {
          if (!actionForm.technician_id || !actionForm.description.trim() || !actionForm.scheduled_date) {
            setMessage('Technician, suggestions, and scheduled date are required.');
            setMessageType('warning');
            return;
          }
          await approveReport({
            id: selectedReport.id,
            action_by: userId,
            created_by: userId,
            technician_id: parseInt(actionForm.technician_id, 10),
            approval_suggestions: actionForm.description,
            scheduled_date: actionForm.scheduled_date,
          }).unwrap();
          setMessage('Incident approved and sent to technician.');
          setMessageType('success');
        }

        closeAction();
        refetch();
      } catch (err) {
        setMessage(err?.data?.message || err?.message || 'Could not complete this action.');
        setMessageType('warning');
      }
    },
    [
      actionForm,
      actionType,
      closeAction,
      approveReport,
      completeInvestigation,
      declineReport,
      recommendInvestigation,
      refetch,
      selectedReport,
      startInvestigation,
      submitInvestigationReview,
      updateInvestigationNotes,
    ]
  );

  return {
    filters,
    hasActiveFilters,
    activeFilterCount,
    searchTerm,
    setSearchTerm,
    pilots,
    technicians,
    reports,
    filteredReports,
    isLoading,
    error,
    message,
    messageType,
    detailView,
    detailLoading,
    showDetailsModal,
    showActionModal,
    selectedReport,
    actionType,
    actionForm,
    setActionForm,
    selectedImage,
    imageRotation,
    handleFilterChange,
    clearFilters,
    openDetails,
    closeDetails,
    openAction,
    closeAction,
    submitAction,
    handleDownload,
    openImageViewer,
    closeImageViewer,
    rotateImage,
  };
}
