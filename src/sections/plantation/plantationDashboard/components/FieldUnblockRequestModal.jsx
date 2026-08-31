import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import {
  useGetFieldUnblockCategoriesQuery,
  useSubmitFieldUnblockRequestMutation,
} from '../../../../api/services NodeJs/fieldUnblockRequestsApi';

export default function FieldUnblockRequestModal({ field, onClose, onSuccess }) {
  const [category, setCategory] = useState('problem_solved');
  const [message, setMessage] = useState('');
  const { data: categories = [] } = useGetFieldUnblockCategoriesQuery();
  const [submit, { isLoading }] = useSubmitFieldUnblockRequestMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await submit({
        fieldId: field.id,
        missionType: field.missionType,
        requestCategory: category,
        requestMessage: message.trim(),
      }).unwrap();
      onSuccess?.();
    } catch (err) {
      window.alert(err?.data?.message || err?.message || 'Failed to submit request.');
    }
  };

  const options = categories.length
    ? categories
    : [
        { id: 'problem_solved', label: 'Problem solved' },
        { id: 'no_issue', label: 'No issue' },
        { id: 'wrong_reason', label: 'Wrong reason' },
        { id: 'other', label: 'Other' },
      ];

  return (
    <div className="pd-popup-overlay" onClick={onClose}>
      <div className="pd-popup pd-popup--narrow" onClick={(e) => e.stopPropagation()}>
        <div className="pd-popup-header">
          <span className="pd-popup-title">Request field unblock</span>
          <button type="button" className="pd-popup-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <form className="pd-popup-body" onSubmit={handleSubmit}>
          <p>
            <strong>{field.fieldName || field.shortName}</strong>
          </p>
          <label className="pd-form-label">
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} required>
              {options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="pd-form-label">
            Message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              required
              minLength={3}
            />
          </label>
          <div className="pd-form-actions">
            <button type="button" className="plantation-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="pd-calendar-btn" disabled={isLoading}>
              {isLoading ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
