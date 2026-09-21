import React, { useState } from 'react';
import '../../styles/assetRequest.css';

const AssetRequest = ({ embedded = false }) => {
  const [formData, setFormData] = useState({
    requestNumber: '',
    requestType: '',
    assetType: '',
    assetId: '',
    requestedBy: '',
    requestDate: '',
    requiredDate: '',
    quantity: '',
    purpose: '',
    status: 'pending',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Implement API call when backend is ready
    console.log('Asset Request Data:', formData);
  };

  return (
    <div className={`asset-request-container${embedded ? ' asset-request-container--embedded' : ''} admin-stock-body`}>
      {!embedded && (
        <div className="asset-request-header">
          <h1 className="heading-asset-request">Asset/Item/Service Request</h1>
        </div>
      )}

      <div className="asset-request-content admin-stock-panel">
        <form className="form-asset-request" onSubmit={handleSubmit}>
          <div className="form-group-asset-request admin-stock-field">
            <label className="label-asset-request" htmlFor="requestNumber">
              Request Number <span className="required-asset-request">*</span>
            </label>
            <input
              type="text"
              id="requestNumber"
              name="requestNumber"
              className="input-asset-request"
              value={formData.requestNumber}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group-asset-request">
            <label className="label-asset-request" htmlFor="requestType">
              Request Type <span className="required-asset-request">*</span>
            </label>
            <select
              id="requestType"
              name="requestType"
              className="select-asset-request"
              value={formData.requestType}
              onChange={handleChange}
              required
            >
              <option value="">Select Request Type</option>
              <option value="asset">Asset</option>
              <option value="item">Item</option>
              <option value="service">Service</option>
            </select>
          </div>

          <div className="form-group-asset-request">
            <label className="label-asset-request" htmlFor="assetType">
              Asset/Item/Service <span className="required-asset-request">*</span>
            </label>
            <select
              id="assetId"
              name="assetId"
              className="select-asset-request"
              value={formData.assetId}
              onChange={handleChange}
              required
            >
              <option value="">Select Asset/Item/Service</option>
              {/* TODO: Populate from API */}
            </select>
          </div>

          <div className="form-group-asset-request">
            <label className="label-asset-request" htmlFor="requestedBy">
              Requested By <span className="required-asset-request">*</span>
            </label>
            <input
              type="text"
              id="requestedBy"
              name="requestedBy"
              className="input-asset-request"
              value={formData.requestedBy}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row-asset-request">
            <div className="form-group-asset-request">
              <label className="label-asset-request" htmlFor="requestDate">
                Request Date <span className="required-asset-request">*</span>
              </label>
              <input
                type="date"
                id="requestDate"
                name="requestDate"
                className="input-asset-request"
                value={formData.requestDate}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group-asset-request">
              <label className="label-asset-request" htmlFor="requiredDate">
                Required Date
              </label>
              <input
                type="date"
                id="requiredDate"
                name="requiredDate"
                className="input-asset-request"
                value={formData.requiredDate}
                onChange={handleChange}
              />
            </div>

            <div className="form-group-asset-request">
              <label className="label-asset-request" htmlFor="quantity">
                Quantity
              </label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                className="input-asset-request"
                value={formData.quantity}
                onChange={handleChange}
                min="1"
              />
            </div>
          </div>

          <div className="form-group-asset-request">
            <label className="label-asset-request" htmlFor="purpose">
              Purpose <span className="required-asset-request">*</span>
            </label>
            <textarea
              id="purpose"
              name="purpose"
              className="textarea-asset-request"
              value={formData.purpose}
              onChange={handleChange}
              rows="3"
              required
            />
          </div>

          <div className="form-group-asset-request">
            <label className="label-asset-request" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              className="select-asset-request"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="fulfilled">Fulfilled</option>
            </select>
          </div>

          <div className="form-actions-asset-request">
            <button type="submit" className="btn-submit-asset-request">
              Submit Request
            </button>
            <button type="button" className="btn-cancel-asset-request" onClick={() => setFormData({
              requestNumber: '',
              requestType: '',
              assetType: '',
              assetId: '',
              requestedBy: '',
              requestDate: '',
              requiredDate: '',
              quantity: '',
              purpose: '',
              status: 'pending',
            })}>
              Clear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssetRequest;

