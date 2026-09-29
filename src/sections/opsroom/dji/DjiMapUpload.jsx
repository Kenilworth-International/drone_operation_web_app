import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Select from 'react-select';
import { FaCalendarAlt, FaTimes, FaUpload, FaEdit, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { Bars } from 'react-loader-spinner';
import { 
  useGetAllDjiImagesQuery, 
  useUploadDjiImageMutation, 
  useUpdateDjiImageMutation,
  useDeleteDjiImageMutation,
  useGetDjiDayEndAutomationLogQuery,
} from '../../../api/services NodeJs/djiImagesApi';
import { useGetEstatesQuery } from '../../../api/services NodeJs/jdManagementApi';
import { useGetBookingCreationDivisionsByEstateQuery } from '../../../api/services NodeJs/bookingCreationApi';
import '../../../styles/djiMapUpload.css';
import '../../../styles/vehicleProfile.css';
import ProfileImageUploadCard from '../../../components/ProfileImageUploadCard';

const CustomDateInput = React.forwardRef(({ value, onClick }, ref) => (
  <div className="custom-date-input-dji" ref={ref} onClick={onClick}>
    <input type="text" value={value} readOnly className="date-picker-input-dji" />
    <FaCalendarAlt className="calendar-icon-dji" />
  </div>
));

// Helper function to get backend URL based on environment
const slugifyForAutoId = (value) => {
  if (value == null || value === '') return '';
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/[()]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const djiSelectMenuPortalProps = {
  menuPortalTarget: typeof document !== 'undefined' ? document.body : null,
  menuPosition: 'fixed',
  styles: {
    menuPortal: (base) => ({ ...base, zIndex: 10001 }),
  },
};

const DJI_METRIC_INPUTS = [
  { key: 'dji_field_area', label: 'DJI Field Area (Ha)', step: '0.01' },
  { key: 'dji_spraying_area', label: 'DJI Spraying Area (Ha)', step: '0.01' },
  { key: 'dji_spraying_litres', label: 'DJI Sprayed Liters', step: '0.01' },
  { key: 'dji_no_of_flights', label: 'DJI No of Flights', step: '1', integer: true },
  { key: 'dji_flying_duration', label: 'DJI Flying Duration (mins)', step: '0.01' },
];

const EMPTY_DJI_METRICS = DJI_METRIC_INPUTS.reduce((acc, { key }) => ({ ...acc, [key]: '' }), {});

const metricsFromImage = (image) =>
  DJI_METRIC_INPUTS.reduce((acc, { key }) => {
    const v = image?.[key];
    return { ...acc, [key]: v === null || v === undefined ? '' : String(Number(v)) };
  }, {});

/** Returns the first validation message, or null when all five are > 0. */
const validateDjiMetrics = (metrics) => {
  for (const { key, label, integer } of DJI_METRIC_INPUTS) {
    const n = Number(String(metrics?.[key] ?? '').replace(/,/g, '').trim());
    if (String(metrics?.[key] ?? '').trim() === '' || !Number.isFinite(n) || n <= 0) {
      return `${label} is required and must be greater than 0`;
    }
    if (integer && !Number.isInteger(n)) {
      return `${label} must be a whole number`;
    }
  }
  return null;
};

const AUTOMATION_STATUS_LABEL = { done: 'Done', skipped: 'Skipped', incomplete: 'Incomplete' };

const getBackendUrl = () => {
  const hostname = window.location.hostname;
  if (hostname.includes('test')) {
    return 'https://dsms-api-test.kenilworth.international.com';
  } else if (!hostname.includes('dev') && !hostname.includes('localhost')) {
    return 'https://dsms-web-api.kenilworthinternational.com';
  }
  return 'https://dsms-web-api-dev.kenilworthinternational.com';
};

const DjiMapUpload = () => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const userData = JSON.parse(localStorage.getItem('userData')) || {};
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('plantation'); // 'plantation' or 'nonplantation'
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    date: '',
    estateId: '',
    estateName: '',
    fieldId: '',
    fieldName: '',
    nic: '',
    isPlantation: true,
  });
  
  // Form state for plantation
  const [plantationForm, setPlantationForm] = useState({
    estateId: '',
    estateName: '',
    fieldId: '',
    fieldName: '',
  });
  
  // Form state for non-plantation
  const [nonPlantationForm, setNonPlantationForm] = useState({
    nic: '',
  });

  const [uploadMetrics, setUploadMetrics] = useState(EMPTY_DJI_METRICS);
  const [editMetrics, setEditMetrics] = useState(EMPTY_DJI_METRICS);
  const [showAutomationLog, setShowAutomationLog] = useState(false);
  
  // Image upload state
  const [selectedFile, setSelectedFile] = useState(null);

  const guessImageMimeByName = (filename = '') => {
    const ext = String(filename).toLowerCase().split('.').pop();
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'jfif') return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'webp') return 'image/webp';
    return '';
  };
  
  // Get all DJI images
  const { data: imagesData, isLoading: loadingImages, refetch: refetchImages } = useGetAllDjiImagesQuery({
    date: selectedDate.toISOString().split('T')[0]
  });
  
  const images = imagesData?.data || [];

  const { data: automationLogData, isFetching: loadingAutomationLog } = useGetDjiDayEndAutomationLogQuery(
    { date: selectedDate.toISOString().split('T')[0] },
    { skip: !showAutomationLog }
  );
  const automationLog = Array.isArray(automationLogData?.data) ? automationLogData.data : [];
  
  // Get estates (Node — legacy PHP display_all_estates caused CORS on production)
  const { data: estatesData } = useGetEstatesQuery();
  const estates = Array.isArray(estatesData) ? estatesData : [];
  
  // Get fields for selected estate (use editForm estateId when in edit mode, otherwise plantationForm)
  const estateIdForFields = isEditMode && editForm.isPlantation ? editForm.estateId : plantationForm.estateId;
  const { data: fieldsData } = useGetBookingCreationDivisionsByEstateQuery(estateIdForFields, {
    skip: !estateIdForFields
  });
  
  // Get all fields from all divisions (skip min/max plan size keys from booking-creation payload)
  const allFields = fieldsData
    ? Object.values(fieldsData).flatMap((division) => {
        if (!division || typeof division !== 'object' || !Array.isArray(division.fields)) {
          return [];
        }
        return division.fields.map((field) => ({
          ...field,
          divisionName: division.division_name,
        }));
      })
    : [];
  
  // Upload mutation
  const [uploadImage, { isLoading: uploading }] = useUploadDjiImageMutation();
  const [updateImage, { isLoading: updating }] = useUpdateDjiImageMutation();
  const [deleteImage, { isLoading: deleting }] = useDeleteDjiImageMutation();
  
  // Calculate auto-generated ID
  const calculateAutoId = () => {
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    if (activeTab === 'plantation') {
      if (!selectedDateStr || !plantationForm.estateId || !plantationForm.fieldId) {
        return '';
      }
      const estateSlug = plantationForm.estateName
        ? slugifyForAutoId(plantationForm.estateName)
        : `estate-${plantationForm.estateId}`;
      const fieldSlug = plantationForm.fieldName
        ? slugifyForAutoId(plantationForm.fieldName)
        : `field-${plantationForm.fieldId}`;
      return `${selectedDateStr}-${estateSlug}-${fieldSlug}-01`;
    } else {
      if (!selectedDateStr || !nonPlantationForm.nic) {
        return '';
      }
      return `${selectedDateStr}-${nonPlantationForm.nic}-01`;
    }
  };
  
  const autoGeneratedId = calculateAutoId();
  
  const processImageFile = (file) => {
    if (!file) return;
    const guessedMime = guessImageMimeByName(file.name);
    const mime = file.type || guessedMime;
    const extOk = /\.(jpe?g|jfif|png|gif|webp)$/i.test(file.name || '');
    if (!(String(mime).startsWith('image/') && extOk)) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }
    let normalizedFile = file;
    if (!file.type || file.type === 'application/octet-stream' || file.type === 'binary/octet-stream') {
      try {
        normalizedFile = new File([file], file.name, {
          type: guessedMime || 'image/jpeg',
          lastModified: file.lastModified,
        });
      } catch {
        normalizedFile = file;
      }
    }
    setSelectedFile(normalizedFile);
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!selectedFile) {
      toast.error('Please select an image file');
      return;
    }
    
    if (activeTab === 'plantation') {
      if (!plantationForm.estateId || !plantationForm.fieldId) {
        toast.error('Please select estate and field');
        return;
      }
      const metricsError = validateDjiMetrics(uploadMetrics);
      if (metricsError) {
        toast.error(metricsError);
        return;
      }
    } else {
      if (!nonPlantationForm.nic) {
        toast.error('Please enter NIC');
        return;
      }
    }
    
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      const selectedDateStr = selectedDate.toISOString().split('T')[0];
      
      if (activeTab === 'plantation') {
        formData.append('uploadDate', selectedDateStr);
        formData.append('isPlantation', 'true');
        formData.append('estateId', plantationForm.estateId);
        formData.append('estateName', plantationForm.estateName);
        formData.append('fieldId', plantationForm.fieldId);
        formData.append('fieldName', plantationForm.fieldName);
        DJI_METRIC_INPUTS.forEach(({ key }) => formData.append(key, String(uploadMetrics[key]).trim()));
      } else {
        formData.append('uploadDate', selectedDateStr);
        formData.append('isPlantation', 'false');
        formData.append('nic', nonPlantationForm.nic);
      }
      
      const result = await uploadImage(formData).unwrap();
      const uploadedImageId = result?.data?.id;
      
      toast.success('DJI image uploaded successfully');
      setShowAddModal(false);
      resetForm();
      
      // Refetch images and select the newly uploaded image
      const refetchResult = await refetchImages();
      const newImages = refetchResult?.data?.data || [];
      
      // Find and select the newly uploaded image
      if (uploadedImageId) {
        const newImage = newImages.find(img => img.id === uploadedImageId);
        if (newImage) {
          // Small delay to ensure DOM is updated
          setTimeout(() => {
            handleImageSelect(newImage);
            // Scroll to the new image in the list
            const imageElement = document.querySelector(`[data-image-id="${uploadedImageId}"]`);
            if (imageElement) {
              imageElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 100);
        }
      }
    } catch (error) {
      const status = error?.status;
      const msg = error?.data?.error || error?.error || 'Failed to upload image';
      if (status === 502 || status === 'FETCH_ERROR') {
        toast.error('Network/proxy error while contacting upload API. Please retry or switch network/VPN.');
      } else {
        toast.error(msg);
      }
    }
  };
  
  // Reset form
  const resetForm = () => {
    setPlantationForm({
      estateId: '',
      estateName: '',
      fieldId: '',
      fieldName: '',
    });
    setNonPlantationForm({
      nic: '',
    });
    setUploadMetrics(EMPTY_DJI_METRICS);
    setSelectedFile(null);
    setActiveTab('plantation');
  };
  
  // Helper function to format date to YYYY-MM-DD
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    // If it's an ISO date string, extract just the date part
    if (dateString.includes('T')) {
      return dateString.split('T')[0];
    }
    // Try to parse as Date and format
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      // If parsing fails, return empty string
    }
    return '';
  };

  // Helper function to format date for display (extracts just YYYY-MM-DD from ISO string)
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    // If it's an ISO date string, extract just the date part
    if (dateString.includes('T')) {
      return dateString.split('T')[0];
    }
    // Try to parse as Date and format
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      // If parsing fails, return empty string
    }
    return dateString; // Return original if can't parse
  };
  
  // Handle image selection
  const handleImageSelect = (image) => {
    setSelectedImage(image);
    setIsEditMode(false);
    // Populate edit form with image data
    setEditForm({
      date: formatDateForInput(image.upload_date) || '',
      estateId: image.estate_id || '',
      estateName: image.estate_name || '',
      fieldId: image.field_id || '',
      fieldName: image.field_name || '',
      nic: image.nic || '',
      isPlantation: image.is_plantation === 1,
    });
    setEditMetrics(metricsFromImage(image));
    setActiveTab(image.is_plantation === 1 ? 'plantation' : 'nonplantation');
  };
  
  // Handle update
  const handleUpdate = async () => {
    if (!selectedImage) return;
    
    // Validate form
    if (editForm.isPlantation) {
      if (!editForm.estateId || !editForm.fieldId) {
        toast.error('Please select estate and field');
        return;
      }
      const metricsError = validateDjiMetrics(editMetrics);
      if (metricsError) {
        toast.error(metricsError);
        return;
      }
    } else {
      if (!editForm.nic) {
        toast.error('Please enter NIC');
        return;
      }
    }
    
    try {
      const updateData = {
        id: selectedImage.id,
        uploadDate: editForm.date,
        isPlantation: editForm.isPlantation,
      };
      
      if (editForm.isPlantation) {
        updateData.estateId = editForm.estateId;
        updateData.estateName = editForm.estateName;
        updateData.fieldId = editForm.fieldId;
        updateData.fieldName = editForm.fieldName;
        updateData.nic = null;
        DJI_METRIC_INPUTS.forEach(({ key }) => {
          updateData[key] = String(editMetrics[key]).trim();
        });
      } else {
        updateData.nic = editForm.nic;
        updateData.estateId = null;
        updateData.estateName = null;
        updateData.fieldId = null;
        updateData.fieldName = null;
      }
      
      const result = await updateImage(updateData).unwrap();
      toast.success('Image updated successfully');
      setIsEditMode(false);
      // Update selected image with the returned data
      if (result?.data) {
        setSelectedImage(result.data);
        handleImageSelect(result.data);
      }
      // Refetch images list
      refetchImages();
    } catch (error) {
      toast.error(error?.data?.error || 'Failed to update image');
    }
  };
  
  // Calculate auto-generated ID for edit form
  const calculateEditAutoId = () => {
    if (editForm.isPlantation) {
      if (!editForm.date || !editForm.estateId || !editForm.fieldId) {
        return '';
      }
      const estateSlug = editForm.estateName
        ? slugifyForAutoId(editForm.estateName)
        : `estate-${editForm.estateId}`;
      const fieldSlug = editForm.fieldName
        ? slugifyForAutoId(editForm.fieldName)
        : `field-${editForm.fieldId}`;
      return `${editForm.date}-${estateSlug}-${fieldSlug}-01`;
    } else {
      if (!editForm.date || !editForm.nic) {
        return '';
      }
      return `${editForm.date}-${editForm.nic}-01`;
    }
  };
  
  const editAutoGeneratedId = calculateEditAutoId();
  
  // Handle delete
  const handleDelete = async () => {
    if (!selectedImage) return;
    if (!window.confirm('Are you sure you want to delete this image?')) return;
    
    try {
      await deleteImage(selectedImage.id).unwrap();
      toast.success('Image deleted successfully');
      setSelectedImage(null);
      refetchImages();
    } catch (error) {
      toast.error(error?.data?.error || 'Failed to delete image');
    }
  };
  
  // Get image URL
  const getImageUrl = (image) => {
    const baseUrl = getBackendUrl();
    return `${baseUrl}/api/dji-images/file/${image.image_filename}`;
  };

  const renderMetricInputs = (values, setValues, disabled = false) => (
    <div className="dji-metrics-grid">
      {DJI_METRIC_INPUTS.map(({ key, label, step, integer }) => (
        <div className="dji-form-group dji-metric-group" key={key}>
          <label>{label} *</label>
          <input
            type="number"
            min={integer ? '1' : '0.01'}
            step={step}
            inputMode={integer ? 'numeric' : 'decimal'}
            value={values[key]}
            disabled={disabled}
            onChange={(e) => {
              const next = e.target.value;
              setValues((prev) => ({ ...prev, [key]: next }));
            }}
            placeholder="0"
          />
        </div>
      ))}
    </div>
  );

  const formatMetric = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    return Number.isFinite(n) ? String(n) : '—';
  };
  
  return (
    <div className="dji-map-upload-container">
      <div className="dji-map-upload-header">
        <button 
          className="dji-back-btn" 
          onClick={() => navigate({ pathname: '/home/workflowDashboard', search: routerLocation.search })}
        >
          ←
        </button>
        <h1>DJI Map Upload</h1>
      </div>
      
      <div className="dji-map-upload-content">
        {/* Left Sidebar - 25% */}
        <div className="dji-left-sidebar">
          <div className="dji-sidebar-header">
            <DatePicker
              selected={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              dateFormat="yyyy-MM-dd"
              customInput={<CustomDateInput />}
            />
            <button 
              className="dji-add-btn"
              onClick={() => setShowAddModal(true)}
            >
              <FaUpload /> Add
            </button>
          </div>
          
          <div className="dji-images-list">
            {loadingImages ? (
              <div className="dji-loading">Loading images...</div>
            ) : images.length === 0 ? (
              <div className="dji-empty">No images found for selected date</div>
            ) : (
              images.map((image) => (
                <div
                  key={image.id}
                  data-image-id={image.id}
                  className={`dji-image-item ${selectedImage?.id === image.id ? 'active' : ''}`}
                  onClick={() => handleImageSelect(image)}
                >
                  <div className="dji-image-item-id">{image.auto_generated_id}</div>
                  <div className="dji-image-item-info">
                    {image.is_plantation === 1 ? (
                      <>
                        <span>{image.estate_name}</span>
                        <span>{image.field_name}</span>
                      </>
                    ) : (
                      <span>NIC: {image.nic}</span>
                    )}
                  </div>
                  <div className="dji-image-item-date">{formatDateForDisplay(image.upload_date)}</div>
                </div>
              ))
            )}
          </div>

          <div className="dji-automation-panel">
            <button
              type="button"
              className="dji-automation-toggle"
              onClick={() => setShowAutomationLog((v) => !v)}
            >
              <span>Day end automation</span>
              <span>{showAutomationLog ? '▾' : '▸'}</span>
            </button>
            {showAutomationLog && (
              <div className="dji-automation-list">
                {loadingAutomationLog ? (
                  <div className="dji-automation-empty">Loading…</div>
                ) : automationLog.length === 0 ? (
                  <div className="dji-automation-empty">No automation results for this date</div>
                ) : (
                  automationLog.map((row) => (
                    <div className="dji-automation-row" key={row.id} title={row.reason || ''}>
                      <div className="dji-automation-row-top">
                        <span className="dji-automation-field">
                          {row.field_name || `Field ${row.field_id}`}
                        </span>
                        {row.needs_partial_reason ? (
                          <span className="dji-automation-status dji-automation-status--needs-reason">
                            Done · needs reason
                          </span>
                        ) : (
                          <span className={`dji-automation-status dji-automation-status--${row.status}`}>
                            {AUTOMATION_STATUS_LABEL[row.status] || row.status}
                          </span>
                        )}
                      </div>
                      {(row.status !== 'done' || row.needs_partial_reason) && row.reason ? (
                        <div className="dji-automation-reason">{row.reason}</div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Right Section - 75% */}
        <div className="dji-right-section">
          {selectedImage ? (
            <div className="dji-image-details">
              <div className="dji-image-details-header">
                <h2>{isEditMode ? 'Edit Image' : selectedImage.auto_generated_id}</h2>
                <div className="dji-image-actions">
                  {!isEditMode ? (
                    <>
                      <button 
                        className="dji-edit-btn"
                        onClick={() => setIsEditMode(true)}
                      >
                        <FaEdit /> Edit
                      </button>
                      <button 
                        className="dji-delete-btn"
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        <FaTrash /> Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        className="dji-cancel-btn"
                        onClick={() => {
                          setIsEditMode(false);
                          handleImageSelect(selectedImage);
                        }}
                      >
                        Cancel
                      </button>
                      <button 
                        className="dji-submit-btn"
                        onClick={handleUpdate}
                        disabled={updating}
                      >
                        {updating ? 'Updating...' : 'Update'}
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {!isEditMode ? (
                <>
                  <div className="dji-image-info" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="dji-info-row">
                      <label>Auto-Generated ID:</label>
                      <span>{selectedImage.auto_generated_id}</span>
                    </div>
                    <div className="dji-info-row">
                      <label>Date:</label>
                      <span>{formatDateForDisplay(selectedImage.upload_date)}</span>
                    </div>
                    <div className="dji-info-row">
                      <label>Type:</label>
                      <span>{selectedImage.is_plantation === 1 ? 'Plantation' : 'Non-Plantation'}</span>
                    </div>
                    {selectedImage.is_plantation === 1 ? (
                      <>
                        <div className="dji-info-row">
                          <label>Estate:</label>
                          <span>{selectedImage.estate_name}</span>
                        </div>
                        <div className="dji-info-row">
                          <label>Field:</label>
                          <span>{selectedImage.field_name}</span>
                        </div>
                        {DJI_METRIC_INPUTS.map(({ key, label }) => (
                          <div className="dji-info-row" key={key}>
                            <label>{label}:</label>
                            <span>{formatMetric(selectedImage[key])}</span>
                          </div>
                        ))}
                        <div className="dji-info-row">
                          <label>Linked Task:</label>
                          <span>{Number(selectedImage.linked_task) > 0 ? `#${selectedImage.linked_task}` : 'Not linked'}</span>
                        </div>
                      </>
                    ) : (
                      <div className="dji-info-row">
                        <label>NIC:</label>
                        <span>{selectedImage.nic}</span>
                      </div>
                    )}
                    <div className="dji-info-row">
                      <label>Uploaded By:</label>
                      <span>{selectedImage.uploaded_by_name || 'Unknown'}</span>
                    </div>
                    <div className="dji-info-row">
                      <label>Uploaded At:</label>
                      <span>{new Date(selectedImage.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="dji-image-viewer">
                    <img 
                      src={getImageUrl(selectedImage)} 
                      alt={selectedImage.auto_generated_id}
                      crossOrigin="anonymous"
                      onError={(e) => {
                        e.target.src = '/placeholder-image.png';
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="dji-edit-form">
                  <div className="dji-form-tabs">
                    <button
                      className={editForm.isPlantation ? 'active' : ''}
                      onClick={() => {
                        setEditForm({ ...editForm, isPlantation: true, nic: '', estateId: '', fieldId: '', estateName: '', fieldName: '' });
                        setActiveTab('plantation');
                      }}
                    >
                      Plantation
                    </button>
                    <button
                      className={!editForm.isPlantation ? 'active' : ''}
                      onClick={() => {
                        setEditForm({ ...editForm, isPlantation: false, estateId: '', fieldId: '', estateName: '', fieldName: '' });
                        setActiveTab('nonplantation');
                      }}
                    >
                      Non-Plantation
                    </button>
                  </div>
                  
                  <div className="dji-form">
                    <div className="dji-form-group">
                      <label>Date *</label>
                      <input
                        type="date"
                        value={editForm.date}
                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      />
                    </div>
                    
                    {editForm.isPlantation ? (
                      <>
                        <div className="dji-form-group">
                          <label>Estate *</label>
                          <Select
                            value={estates.find(est => est.id.toString() === editForm.estateId) ? {
                              value: editForm.estateId,
                              label: editForm.estateName || 'Select Estate'
                            } : null}
                            onChange={(selectedOption) => {
                              if (selectedOption) {
                                const estate = estates.find(est => est.id.toString() === selectedOption.value);
                                setEditForm({
                                  ...editForm,
                                  estateId: selectedOption.value,
                                  estateName: estate?.estate || '',
                                  fieldId: '',
                                  fieldName: '',
                                });
                              } else {
                                setEditForm({
                                  ...editForm,
                                  estateId: '',
                                  estateName: '',
                                  fieldId: '',
                                  fieldName: '',
                                });
                              }
                            }}
                            options={estates.map(estate => ({
                              value: estate.id.toString(),
                              label: estate.estate
                            }))}
                            placeholder="Select Estate"
                            isSearchable={true}
                            isClearable={true}
                            styles={{
                              control: (base) => ({
                                ...base,
                                minHeight: '38px',
                                borderColor: '#ddd',
                                '&:hover': {
                                  borderColor: '#999'
                                }
                              })
                            }}
                          />
                        </div>
                        
                        <div className="dji-form-group">
                          <label>Field *</label>
                          <Select
                            value={allFields.find(f => f.field_id.toString() === editForm.fieldId) ? {
                              value: editForm.fieldId,
                              label: editForm.fieldName || 'Select Field'
                            } : null}
                            onChange={(selectedOption) => {
                              if (selectedOption) {
                                const field = allFields.find(f => f.field_id.toString() === selectedOption.value);
                                setEditForm({
                                  ...editForm,
                                  fieldId: selectedOption.value,
                                  fieldName: field?.field_name || '',
                                });
                              } else {
                                setEditForm({
                                  ...editForm,
                                  fieldId: '',
                                  fieldName: '',
                                });
                              }
                            }}
                            options={allFields.map(field => ({
                              value: field.field_id.toString(),
                              label: `${field.field_name}${field.divisionName ? ` (${field.divisionName})` : ''}`
                            }))}
                            placeholder="Select Field"
                            isSearchable={true}
                            isClearable={true}
                            isDisabled={!editForm.estateId}
                            styles={{
                              control: (base) => ({
                                ...base,
                                minHeight: '38px',
                                borderColor: '#ddd',
                                '&:hover': {
                                  borderColor: '#999'
                                }
                              })
                            }}
                          />
                        </div>

                        {renderMetricInputs(editMetrics, setEditMetrics, updating)}
                      </>
                    ) : (
                      <div className="dji-form-group">
                        <label>NIC *</label>
                        <input
                          type="text"
                          value={editForm.nic}
                          onChange={(e) => setEditForm({ ...editForm, nic: e.target.value })}
                          placeholder="Enter NIC number"
                        />
                      </div>
                    )}
                    
                    {editAutoGeneratedId && (
                      <div className="dji-auto-id">
                        <label>New Auto-Generated ID:</label>
                        <span>{editAutoGeneratedId}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="dji-image-viewer">
                    <img 
                      src={getImageUrl(selectedImage)} 
                      alt={selectedImage.auto_generated_id}
                      crossOrigin="anonymous"
                      onError={(e) => {
                        e.target.src = '/placeholder-image.png';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="dji-empty-selection">
              Select an image from the list to view details
            </div>
          )}
        </div>
      </div>
      
      {/* Add Modal */}
      {showAddModal && createPortal(
        <div className="dji-modal-overlay" onClick={() => !uploading && setShowAddModal(false)}>
          <div className="dji-modal-content" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
            {/* Loading Overlay */}
            {uploading && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000,
                borderRadius: '8px'
              }}>
                <Bars
                  height="60"
                  width="60"
                  color="#4180B9"
                  ariaLabel="uploading"
                  visible={true}
                />
                <p style={{ marginTop: '20px', fontSize: '16px', color: '#4180B9', fontWeight: '500' }}>
                  Uploading image...
                </p>
              </div>
            )}
            <div className="dji-modal-header">
              <div>
                <h2>Upload DJI Map Image</h2>
                <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                  Date: {selectedDate.toISOString().split('T')[0]}
                </div>
              </div>
              <button 
                className="dji-modal-close"
                onClick={() => {
                  if (!uploading) {
                    setShowAddModal(false);
                    resetForm();
                  }
                }}
                disabled={uploading}
                style={{ opacity: uploading ? 0.5 : 1, cursor: uploading ? 'not-allowed' : 'pointer' }}
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="dji-modal-tabs">
              <button
                className={activeTab === 'plantation' ? 'active' : ''}
                onClick={() => setActiveTab('plantation')}
              >
                Plantation
              </button>
              <button
                className={activeTab === 'nonplantation' ? 'active' : ''}
                onClick={() => setActiveTab('nonplantation')}
              >
                Non-Plantation
              </button>
            </div>
            
            <div className="dji-modal-body">
              <div className="dji-form" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {activeTab === 'plantation' ? (
                  <>
                    <div className="dji-form-group">
                      <label>Estate *</label>
                      <Select
                        value={estates.find(est => est.id.toString() === plantationForm.estateId) ? {
                          value: plantationForm.estateId,
                          label: plantationForm.estateName || 'Select Estate'
                        } : null}
                        onChange={(selectedOption) => {
                          if (selectedOption) {
                            const estate = estates.find(est => est.id.toString() === selectedOption.value);
                            setPlantationForm({
                              ...plantationForm,
                              estateId: selectedOption.value,
                              estateName: estate?.estate || '',
                              fieldId: '',
                              fieldName: '',
                            });
                          } else {
                            setPlantationForm({
                              ...plantationForm,
                              estateId: '',
                              estateName: '',
                              fieldId: '',
                              fieldName: '',
                            });
                          }
                        }}
                        options={estates.map(estate => ({
                          value: estate.id.toString(),
                          label: estate.estate
                        }))}
                        placeholder="Select Estate"
                        isSearchable={true}
                        isClearable={true}
                        {...djiSelectMenuPortalProps}
                        styles={{
                          control: (base) => ({
                            ...base,
                            minHeight: '38px',
                            borderColor: '#ddd',
                            '&:hover': {
                              borderColor: '#999'
                            }
                          }),
                          ...djiSelectMenuPortalProps.styles,
                        }}
                      />
                    </div>
                    
                    <div className="dji-form-group">
                      <label>Field *</label>
                      <Select
                        value={allFields.find(f => f.field_id.toString() === plantationForm.fieldId) ? {
                          value: plantationForm.fieldId,
                          label: plantationForm.fieldName || 'Select Field'
                        } : null}
                        onChange={(selectedOption) => {
                          if (selectedOption) {
                            const field = allFields.find(f => f.field_id.toString() === selectedOption.value);
                            setPlantationForm({
                              ...plantationForm,
                              fieldId: selectedOption.value,
                              fieldName: field?.field_name || '',
                            });
                          } else {
                            setPlantationForm({
                              ...plantationForm,
                              fieldId: '',
                              fieldName: '',
                            });
                          }
                        }}
                        options={allFields.map(field => ({
                          value: field.field_id.toString(),
                          label: `${field.field_name}${field.divisionName ? ` (${field.divisionName})` : ''}`
                        }))}
                        placeholder="Select Field"
                        isSearchable={true}
                        isClearable={true}
                        isDisabled={!plantationForm.estateId}
                        {...djiSelectMenuPortalProps}
                        styles={{
                          control: (base) => ({
                            ...base,
                            minHeight: '38px',
                            borderColor: '#ddd',
                            '&:hover': {
                              borderColor: '#999'
                            }
                          }),
                          ...djiSelectMenuPortalProps.styles,
                        }}
                      />
                    </div>
                    
                    <div style={{ gridColumn: '1 / -1' }}>
                      {renderMetricInputs(uploadMetrics, setUploadMetrics, uploading)}
                    </div>

                    {autoGeneratedId && (
                      <div className="dji-auto-id" style={{ gridColumn: '1 / -1' }}>
                        <label>Auto-Generated ID:</label>
                        <span>{autoGeneratedId}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="dji-form-group">
                      <label>NIC *</label>
                      <input
                        type="text"
                        value={nonPlantationForm.nic}
                        onChange={(e) => setNonPlantationForm({ ...nonPlantationForm, nic: e.target.value })}
                        placeholder="Enter NIC number"
                      />
                    </div>
                    
                    {autoGeneratedId && (
                      <div className="dji-auto-id" style={{ gridColumn: '1 / -1' }}>
                        <label>Auto-Generated ID:</label>
                        <span>{autoGeneratedId}</span>
                      </div>
                    )}
                  </>
                )}
                
                <div className="dji-image-upload-card" style={{ gridColumn: '1 / -1' }}>
                  <ProfileImageUploadCard
                    label="DJI map image *"
                    file={selectedFile}
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,.jfif"
                    disabled={uploading}
                    onFileSelect={processImageFile}
                    onClear={() => setSelectedFile(null)}
                  />
                </div>
              </div>
            </div>
            
            <div className="dji-modal-footer">
              <button
                className="dji-cancel-btn"
                onClick={() => {
                  if (!uploading) {
                    setShowAddModal(false);
                    resetForm();
                  }
                }}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                className="dji-submit-btn"
                onClick={handleSubmit}
                disabled={uploading || !selectedFile}
                style={{ position: 'relative' }}
              >
                {uploading ? (
                  <>
                    <Bars
                      height="20"
                      width="20"
                      color="#ffffff"
                      ariaLabel="uploading"
                      visible={true}
                      wrapperStyle={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }}
                    />
                    Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DjiMapUpload;

