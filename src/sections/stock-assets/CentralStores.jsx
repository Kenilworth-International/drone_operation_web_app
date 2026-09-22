import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import '../../styles/centralStoresModule.css';
import { AdminStockPage, AdminSubTabs } from './shell/AdminStockShell';
import {
  useGetCentralStoreRequestQuery,
  useGetCentralStoreRequestQueueQuery,
  useGetNeedToProcureQueueQuery,
  useIssueCentralStoreItemsMutation,
  useSendRequestToNeedToProcureMutation,
} from '../../api/services NodeJs/allEndpoints';

const TABS = [
  { key: 'queue', label: 'Request Queue', path: '/home/stock-assets/central-stores/request-queue' },
  { key: 'issue', label: 'Issue Items/Services', path: '/home/stock-assets/central-stores/issue-items-services' },
  { key: 'need', label: 'Need to Procure Queue', path: '/home/stock-assets/central-stores/need-to-procure-queue' },
];

const detectTabFromPath = (path) => {
  if (path.includes('/issue-items-services')) return 'issue';
  if (path.includes('/need-to-procure-queue')) return 'need';
  return 'queue';
};

function getUserId() {
  try {
    return JSON.parse(localStorage.getItem('userData') || '{}')?.id || null;
  } catch {
    return null;
  }
}

function issueErrorMessage(error) {
  if (!error) return 'Failed to issue items';
  if (typeof error.data === 'string') return error.data;
  return error?.data?.message || error?.error || error?.message || 'Failed to issue items';
}

function formatDestination(row) {
  const dest = String(row?.destination_type || 'wing').toLowerCase();
  if (dest === 'workshop') return 'Workshop';
  if (dest === 'employee') {
    return row.requested_for_employee_name
      || (row.requested_for_employee_id ? `Employee #${row.requested_for_employee_id}` : 'Employee');
  }
  return row.wing_name || 'Wing';
}

function formatDestinationDetail(row) {
  const dest = String(row?.destination_type || '').toLowerCase();
  if (dest === 'employee') {
    if (row.emp_department_name) return row.emp_department_name;
    if (row.requested_for_employee_id && !row.emp_department_id) return 'Senior Management';
    return '';
  }
  if (dest === 'workshop') return '';
  return row.sector_name || '';
}

const CentralStores = () => {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(detectTabFromPath(routerLocation.pathname));
  const [issueRequestId, setIssueRequestId] = useState('');
  const [issueQtyMap, setIssueQtyMap] = useState({});

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
    isFetching: loadingIssueDetails,
  } = useGetCentralStoreRequestQuery(issueRequestId, { skip: !issueRequestId });

  const [issueCentralStoreItems, { isLoading: issuingItems }] = useIssueCentralStoreItemsMutation();
  const [sendRequestToNeedToProcure, { isLoading: sendingToProcure }] = useSendRequestToNeedToProcureMutation();

  useEffect(() => {
    setActiveTab(detectTabFromPath(routerLocation.pathname));
  }, [routerLocation.pathname]);

  // Prefill issue qty = min(remaining, stock) when a request is opened
  useEffect(() => {
    if (!issueRequestDetails?.items?.length) return;
    const next = {};
    issueRequestDetails.items.forEach((item) => {
      const remaining = Number(item.remaining_qty) || 0;
      const stock = Number(item.current_stock) || 0;
      if (remaining <= 0) return;
      if (stock <= 0) return;
      const qty = Math.min(remaining, stock);
      if (qty > 0) next[item.id] = String(qty);
    });
    setIssueQtyMap(next);
  }, [issueRequestDetails]);

  if (routerLocation.pathname.includes('/request-items-services')) {
    return (
      <Navigate
        to={{ pathname: '/home/stock-assets/central-stores/request-queue', search: routerLocation.search }}
        replace
      />
    );
  }

  if (
    routerLocation.pathname === '/home/stock-assets/central-stores'
    || routerLocation.pathname === '/home/stock-assets/central-stores/'
  ) {
    return (
      <Navigate
        to={{ pathname: '/home/stock-assets/central-stores/request-queue', search: routerLocation.search }}
        replace
      />
    );
  }

  const submitIssue = async () => {
    if (!issueRequestId) return;
    const payloadItems = Object.entries(issueQtyMap)
      .map(([request_item_id, issued_qty]) => ({
        request_item_id: Number(request_item_id),
        issued_qty: Number(issued_qty),
      }))
      .filter((x) => x.issued_qty > 0);
    if (!payloadItems.length) {
      alert('Enter at least one issue quantity (or ensure items have remaining qty and available stock).');
      return;
    }
    const userId = getUserId();
    try {
      await issueCentralStoreItems({
        request_id: Number(issueRequestId),
        issued_by: userId,
        items: payloadItems,
      }).unwrap();
      alert('Items issued successfully');
      setIssueQtyMap({});
      setIssueRequestId('');
      refetchRequestQueue();
      refetchNeedToProcure();
    } catch (error) {
      alert(issueErrorMessage(error));
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
      alert(issueErrorMessage(error) || 'Failed to move to Need to Procure Queue');
    }
  };

  const openRequests = (Array.isArray(requestQueue) ? requestQueue : [])
    .filter((x) => String(x.status || '').toLowerCase() !== 'issued');

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
        {activeTab === 'queue' && (
          <div className="central-stores-table-wrap">
            <p className="admin-stock-section-hint" style={{ padding: '12px 14px 0', margin: 0 }}>
              Requests arrive from Transfers &amp; Requests → Asset Request. Issue from stock, or send shortfalls to Need to Procure.
            </p>
            <table width="100%" cellPadding="6">
              <thead>
                <tr>
                  <th>Request No</th>
                  <th>Destination</th>
                  <th>For</th>
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
                    <td>{String(row.destination_type || 'wing')}</td>
                    <td>
                      {formatDestination(row)}
                      {formatDestinationDetail(row) ? (
                        <div style={{ fontSize: 12, color: '#64748b' }}>{formatDestinationDetail(row)}</div>
                      ) : null}
                    </td>
                    <td>{row.status}</td>
                    <td>{row.item_count}</td>
                    <td>{row.total_requested_qty}</td>
                    <td>{row.total_issued_qty}</td>
                  </tr>
                ))}
                {!requestQueue.length && (
                  <tr>
                    <td colSpan={7}>No records found. Create requests under Asset Request.</td>
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
                    <th>Destination</th>
                    <th>For</th>
                    <th>Status</th>
                    <th>Remaining Qty</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {openRequests.map((row) => (
                    <tr key={row.id}>
                      <td>{row.request_no}</td>
                      <td>{String(row.destination_type || 'wing')}</td>
                      <td>
                        {formatDestination(row)}
                        {formatDestinationDetail(row) ? (
                          <div style={{ fontSize: 12, color: '#64748b' }}>{formatDestinationDetail(row)}</div>
                        ) : null}
                      </td>
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
                  {!openRequests.length && (
                    <tr>
                      <td colSpan={6}>No open requests to issue.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {issueRequestId && loadingIssueDetails && (
              <div className="central-stores-issue-panel">
                <p>Loading request details…</p>
              </div>
            )}

            {issueRequestDetails?.items?.length > 0 && (
              <div className="central-stores-issue-panel">
                <h4>Issue Request: {issueRequestDetails.request_no}</h4>
                <p style={{ marginTop: 0, color: '#5b6b7c', fontSize: 13 }}>
                  Destination: {String(issueRequestDetails.destination_type || 'wing')}
                  {' · '}
                  {formatDestination(issueRequestDetails)}
                  {formatDestinationDetail(issueRequestDetails)
                    ? ` (${formatDestinationDetail(issueRequestDetails)})`
                    : ''}
                </p>
                {issueRequestDetails.items.map((item) => {
                  const remaining = Number(item.remaining_qty) || 0;
                  const stock = Number(item.current_stock) || 0;
                  const noStock = remaining > 0 && stock <= 0;
                  return (
                    <div
                      key={item.id}
                      className="central-stores-issue-item-row"
                    >
                      <div>{item.item_code} - {item.item_name}</div>
                      <div>Remaining: {item.remaining_qty}</div>
                      <div style={{ color: noStock ? '#b91c1c' : undefined }}>
                        Stock: {item.current_stock}
                        {noStock ? ' (use Procure Remaining)' : ''}
                      </div>
                      <div className="central-stores-form-group">
                        <label htmlFor={`issue-qty-${item.id}`}>Issue Qty</label>
                        <input
                          id={`issue-qty-${item.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          max={Math.min(remaining, stock > 0 ? stock : remaining)}
                          value={issueQtyMap[item.id] ?? ''}
                          onChange={(e) => setIssueQtyMap((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="Qty to issue"
                          disabled={remaining <= 0 || stock <= 0}
                        />
                      </div>
                    </div>
                  );
                })}
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
            <p className="admin-stock-section-hint" style={{ padding: '12px 14px 0', margin: 0 }}>
              Shortfalls from Issue move here, then continue in Procurement Process.
            </p>
            <table width="100%" cellPadding="6">
              <thead>
                <tr>
                  <th>Request No</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Destination</th>
                  <th>For</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {needToProcureQueue.map((row) => (
                  <tr key={row.id}>
                    <td>{row.request_no}</td>
                    <td>{row.item_code} - {row.item_name}</td>
                    <td>{row.quantity}</td>
                    <td>{String(row.destination_type || 'wing')}</td>
                    <td>
                      {formatDestination(row)}
                      {formatDestinationDetail(row) ? (
                        <div style={{ fontSize: 12, color: '#64748b' }}>{formatDestinationDetail(row)}</div>
                      ) : null}
                    </td>
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
