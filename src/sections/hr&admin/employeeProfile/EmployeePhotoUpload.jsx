import React, { useEffect, useRef, useState } from 'react';
import { useUpdateEmployeeRegistrationMutation } from '../../../api/services NodeJs/jdManagementApi';
import { employeeInitials, employeeRecord, getEmployeePhotoUrl, getEmployeeDisplayName } from './employeeProfileUtils';

export default function EmployeePhotoUpload({
  employeeId,
  employee,
  onUploaded,
  size = 'hero',
}) {
  const inputRef = useRef(null);
  const previewRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [updateEmployee] = useUpdateEmployeeRegistrationMutation();

  const serverPhotoUrl = getEmployeePhotoUrl(employee);
  const photoUrl = previewUrl || (!loadFailed ? serverPhotoUrl : null);
  const name = getEmployeeDisplayName(employee);
  const initials = employeeInitials(name);
  const isHero = size === 'hero';

  useEffect(() => () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (serverPhotoUrl) {
      setLoadFailed(false);
    }
  }, [serverPhotoUrl]);

  const clearPreview = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreviewUrl(null);
  };

  const handleFile = async (file) => {
    if (!file || !employeeId) return;

    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    previewRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setLoadFailed(false);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append('id', String(employeeId));
      fd.append('employeePhoto', file);
      const response = await updateEmployee(fd).unwrap();
      const updated = employeeRecord(response);
      const uploadedUrl = getEmployeePhotoUrl(updated);

      if (uploadedUrl) {
        clearPreview();
        setLoadFailed(false);
      }

      if (onUploaded) {
        await onUploaded();
      }
    } catch {
      clearPreview();
      setLoadFailed(true);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`ep-photo-upload ep-photo-upload--${size}`}>
      <button
        type="button"
        className="ep-photo-trigger"
        onClick={() => !uploading && inputRef.current?.click()}
        disabled={uploading || !employeeId}
        title="Upload employee photo"
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name}
            className="ep-photo-img"
            onError={() => {
              if (previewUrl) return;
              setLoadFailed(true);
            }}
          />
        ) : (
          <span className="ep-photo-initials">{initials || '?'}</span>
        )}
        <span className="ep-photo-overlay">
          {uploading ? 'Uploading…' : 'Change photo'}
        </span>
      </button>
      {isHero && !photoUrl && (
        <p className="ep-photo-hint">JPG, PNG or WEBP</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="ep-photo-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
