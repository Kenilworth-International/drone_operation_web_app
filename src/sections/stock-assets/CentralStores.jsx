import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../../styles/centralStoresModule.css';
import { AdminStockPage, AdminSubTabs } from './shell/AdminStockShell';
import {
  useCreateCentralStoreRequestMutation,
  useGetCentralStoreRequestQuery,
  useGetCentralStoreRequestQueueQuery,
  useGetNeedToProcureQueueQuery,
  useGetStockSectorsQuery,
  useGetStockWingsQuery,
  useIssueCentralStoreItemsMutation,
  useSendRequestToNeedToProcureMutation,
  useGetInventoryItemsQuery,
} from '../../api/services NodeJs/allEndpoints';

const TABS = [
  { key: 'request', label: 'Request Items/Services', path: '/home/stock-assets/central-stores/request-items-services' },
  { key: 'queue', label: 'Request Queue', path: '/home/stock-assets/central-stores/request-queue' },
  { key: 'issue', label: 'Issue Items/Services', path: '/home/stock-assets/central-stores/issue-items-services' },
  { key: 'need', label: 'Need to Procure Queue', path: '/home/stock-assets/central-stores/need-to-procure-queue' },
];

const detectTabFromPath = (path) => {
  if (path.includes('/request-queue')) return 'queue';
  if (path.includes('/issue-items-services')) return 'issue';
  if (path.includes('/need-to-procure-queue')) return 'need';
  return 'request';
};

const EMPTY_LINE = { inventory_item_id: '', requested_qty: '' };

const CentralStores = () => {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(detectTabFromPath(routerLocation.pathname));
  const [requestForm, setRequestForm] = useState({
    wing_id: '',
    sector_id: '',
    remarks: '',
    items: [{ ...EMPTY_LINE }],
  });
  const [issueRequestId, setIssueRequestId] = useState('');
  const [issueQtyMap, setIssueQtyMap] = useState({});

  const { data: wings = [] } = useGetStockWingsQuery();
  const { data: sectors = [] } = useGetStockSectorsQuery();
  const { data: inventoryItems = [] } = useGetInventoryItemsQuery({});
  const {
    data: requestQueue = [],
    refetch: refetchRequestQueue,
  } = useGetCentralStoreRequestQueueQuery({});
  const {
    data: needToProcureQueue = [],
    refetch: refetchNeedToProcure,
  } = useGetNeedToProcureQueueQuery({});
  const {
    data: issueRequestDetails,
    refetch: refetchIssueRequest,
  } = useGetCentralStoreRequestQuery(issueRequestId, { skip: !issueRequestId });

  const [createCentralStoreRequest, { isLoading: creatingRequest }] = useCreateCentralStoreRequestMutation();
  const [issueCentralStoreItems, { isLoading: issuingItems }] = useIssueCentralStoreItemsMutation();
  const [sendRequestToNeedToProcure, { isLoading: sendingToProcure }] = useSendRequestToNeedToProcureMutation();

  useEffect(() => {
    setActiveTab(detectTabFromPath(routerLocation.pathname));
  }, [routerLocation.pathname]);

  const selectedWing = useMemo(
    () => wings.find((w) => String(w.id) === String(requestForm.wing_id)),
    [wings, requestForm.wing_id]
  );
  const isDroneWing = String(selectedWing?.wingsCode || '').toLowerCase() === 'd';

  const addRequestLine = () => {
    setRequestForm((prev) => ({ ...prev, items: [...prev.items, { ...EMPTY_LINE }] }));
  };

  const removeRequestLine = (idx) => {
    setRequestForm((prev) => {
      const items = prev.items.filter((_, index) => index !== idx);
      return { ...prev, items: items.length ? items : [{ ...EMPTY_LINE }] };
    });
  };

  const updateRequestLine = (idx, key, value) => {
    setRequestForm((prev) => ({
      ...prev,
      items: prev.items.map((line, index) => (index === idx ? { ...line, [key]: value } : line)),
    }));
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    const filteredItems = requestForm.items
      .map((x) => ({
        inventory_item_id: Number(x.inventory_item_id),
        requested_qty: Number(x.requested_qty),
      }))
      .filter((x) => x.inventory_item_id > 0 && x.requested_qty > 0);

    if (!filteredItems.length) {
      alert('Add at least one valid item');
      return;
    }
    if (!requestForm.wing_id) {
      alert('Wing is required');
      return;
    }
    if (isDroneWing && !requestForm.sector_id) {
      alert('Sector is required for Drone wing');
      return;
    }

    try {
      await createCentralStoreRequest({
        wing_id: Number(requestForm.wing_id),
        sector_id: requestForm.sector_id ? Number(requestForm.sector_id) : null,
        remarks: requestForm.remarks,
        items: filteredItems,
      }).unwrap();
      alert('Request created successfully');
      setRequestForm({ wing_id: '', sector_id: '', remarks: '', items: [{ ...EMPTY_LINE }] });
      refetchRequestQueue();
    } catch (error) {
      alert(error?.data?.message || 'Failed to create request');
    }
  };

  const submitIssue = async () => {
    if (!issueRequestId) return;
    const payloadItems = Object.entries(issueQtyMap)
      .map(([request_item_id, issued_qty]) => ({
        request_item_id: Number(request_item_id),
        issued_qty: Number(issued_qty),
      }))
      .filter((x) => x.issued_qty > 0);
    if (!payloadItems.length) {
      alert('Enter at least one issue quantity');
      return;
    }
    try {
      await issueCentralStoreItems({
        request_id: Number(issueRequestId),
        items: payloadItems,
      }).unwrap();
      alert('Items issued successfully');
      setIssueQtyMap({});
      refetchRequestQueue();
      refetchNeedToProcure();
      refetchIssueRequest();
    } catch (error) {
      alert(error?.data?.message || 'Failed to issue items');
    }
  };

  const sendCurrentRequestToProcure = async (requestId) => {
    if (!requestId) return;
    try {
      await sendRequestToNeedToProcure({ request_id: Number(requestId) }).unwrap();
      alert('Remaining items moved to Need to Procure Queue');
      if (String(issueRequestId) === String(requestId)) {
        setIssueRequestId('');
      }
      refetchRequestQueue();
      refetchNeedToProcure();
    } catch (error) {
      alert(error?.data?.message || 'Failed to move to Need to Procure Queue');
    }
  };

  return (
    <AdminStockPage>
      <AdminSubTabs
        tabs={TABS}
        active={activeTab}
        onChange={(key) => {
          const tab = TABS.find((t) => t.key === key) || TABS[0];
          setActiveTab(tab.key);
          navigate({ pathname: tab.path, search: routerLocation.search });
        }}
      />
      <div className="central-stores-page admin-stock-body">
      {activeTab === 'request' && (
        <form onSubmit={submitRequest} className="central-stores-form">
          <div className="central-stores-row-two central-stores-form-group">
            <div className="central-stores-form-group">
              <label htmlFor="request-wing">Wing</label>
              <select
                id="request-wing"
                value={requestForm.wing_id}
                onChange={(e) => setRequestForm((prev) => ({ ...prev, wing_id: e.target.value, sector_id: '' }))}
                required
              >
                <option value="">Select Wing</option>
                {wings.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.wing} ({w.wingsCode})
                  </option>
                ))}
              </select>
            </div>
            {isDroneWing && (
              <div className="central-stores-form-group">
                <label htmlFor="request-sector">Sector</label>
                <select
                  id="request-sector"
                  value={requestForm.sector_id}
                  onChange={(e) => setRequestForm((prev) => ({ ...prev, sector_id: e.target.value }))}
                  required
                >
                  <option value="">Select Sector</option>
                  {sectors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sector}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="central-stores-form-group">
            <label htmlFor="request-remarks">Remarks</label>
            <textarea
              id="request-remarks"
              value={requestForm.remarks}
              onChange={(e) => setRequestForm((prev) => ({ ...prev, remarks: e.target.value }))}
              placeholder="Add any notes or comments (optional)"
              rows={2}
            />
          </div>

          <div className="central-stores-form-group">
            <label>Request Items</label>
            {requestForm.items.map((line, idx) => (
              <div key={`line-${idx}`} className="central-stores-item-line">
                <select
                  value={line.inventory_item_id}
                  onChange={(e) => updateRequestLine(idx, 'inventory_item_id', e.target.value)}
                  required
                >
                  <option value="">Select Item</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.item_code} - {item.item_name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={line.requested_qty}
                  onChange={(e) => updateRequestLine(idx, 'requested_qty', e.target.value)}
                  placeholder="Requested Qty"
                  required
                />
                <button type="button" onClick={() => removeRequestLine(idx)}>Remove</button>
              </div>
            ))}
          </div>
          <div className="central-stores-actions">
            <button type="button" onClick={addRequestLine}>+ Add Item</button>
            <button type="submit" disabled={creatingRequest}>
              {creatingRequest ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'queue' && (
        <div className="central-stores-table-wrap">
          <table width="100%" cellPadding="6">
            <thead>
              <tr>
                <th>Request No</th>
                <th>Wing</th>
                <th>Sector</th>
                <th>Status</th>
                <th>Items</th>
                <th>Requested Qty</th>
                <th>Issued Qty</th>
              </tr>
            </thead>
            <tbody>
              {requestQueue.map((row) => (
                <tr key={row.id}>
                  <td>{row.request_no}</td>
                  <td>{row.wing_name || '-'}</td>
                  <td>{row.sector_name || '-'}</td>
                  <td>{row.status}</td>
                  <td>{row.item_count}</td>
                  <td>{row.total_requested_qty}</td>
                  <td>{row.total_issued_qty}</td>
                </tr>
              ))}
              {!requestQueue.length && (
                <tr>
                  <td colSpan={7}>No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'issue' && (
        <div className="central-stores-issue-grid">
          <div className="central-stores-table-wrap">
            <table width="100%" cellPadding="6">
              <thead>
                <tr>
                  <th>Request No</th>
                  <th>Wing</th>
                  <th>Status</th>
                  <th>Remaining Qty</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {requestQueue.filter((x) => x.status !== 'issued').map((row) => (
                  <tr key={row.id}>
                    <td>{row.request_no}</td>
                    <td>{row.wing_name || '-'}</td>
                    <td>{row.status}</td>
                    <td>{row.total_remaining_qty}</td>
                    <td>
                      <div className="central-stores-issue-actions-cell">
                        <button type="button" onClick={() => setIssueRequestId(String(row.id))}>Issue</button>
                        <button
                          type="button"
                          disabled={sendingToProcure}
                          onClick={() => sendCurrentRequestToProcure(row.id)}
                        >
                          Procure
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {issueRequestDetails?.items?.length > 0 && (
            <div className="central-stores-issue-panel">
              <h4>Issue Request: {issueRequestDetails.request_no}</h4>
              {issueRequestDetails.items.map((item) => (
                <div
                  key={item.id}
                  className="central-stores-issue-item-row"
                >
                  <div>{item.item_code} - {item.item_name}</div>
                  <div>Remaining: {item.remaining_qty}</div>
                  <div>Stock: {item.current_stock}</div>
                  <div className="central-stores-form-group">
                    <label htmlFor={`issue-qty-${item.id}`}>Issue Qty</label>
                    <input
                      id={`issue-qty-${item.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      max={item.remaining_qty}
                      value={issueQtyMap[item.id] || ''}
                      onChange={(e) => setIssueQtyMap((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Qty to issue"
                    />
                  </div>
                </div>
              ))}
              <div className="central-stores-issue-actions-cell" style={{ marginTop: '12px' }}>
                <button type="button" disabled={issuingItems} onClick={submitIssue}>
                  {issuingItems ? 'Issuing...' : 'Issue Selected'}
                </button>
                <button
                  type="button"
                  disabled={sendingToProcure}
                  onClick={() => sendCurrentRequestToProcure(issueRequestId)}
                >
                  {sendingToProcure ? 'Sending...' : 'Procure Remaining'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'need' && (
        <div className="central-stores-table-wrap">
          <table width="100%" cellPadding="6">
            <thead>
              <tr>
                <th>Request No</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Wing</th>
                <th>Sector</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {needToProcureQueue.map((row) => (
                <tr key={row.id}>
                  <td>{row.request_no}</td>
                  <td>{row.item_code} - {row.item_name}</td>
                  <td>{row.quantity}</td>
                  <td>{row.wing_name || '-'}</td>
                  <td>{row.sector_name || '-'}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
              {!needToProcureQueue.length && (
                <tr>
                  <td colSpan={6}>No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </AdminStockPage>
  );
};

export default CentralStores;

