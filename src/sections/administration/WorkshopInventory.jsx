import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FaBoxOpen, FaCheck } from 'react-icons/fa';
import {
  useGetWorkshopInventoryQuery,
  useReceiveWorkshopInventoryMutation,
} from '../../api/services NodeJs/workshopInventoryApi';
import { withCurrentWingSearch } from '../../config/wingRouteGuard';
import {
  ASSET_REQUEST_PATH,
  ASSET_TRANSFER_PATH,
  isAssetTransferAllowedWing,
  normalizeWingTitle,
} from '../../config/wingHubDisplay';
import {
  AdminPageHeader,
  AdminStockPage,
  AdminToolbar,
} from '../stock-assets/shell/AdminStockShell';

function getUserId() {
  try {
    return JSON.parse(localStorage.getItem('userData') || '{}')?.id || null;
  } catch {
    return null;
  }
}

function formatDateTime(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

function formatSource(row) {
  const type = String(row.source_type || '').toLowerCase();
  if (type === 'maintenance' || row.maintenance_id) {
    return row.maintenance_id ? `Maintenance #${row.maintenance_id}` : 'Maintenance';
  }
  if (type === 'central_issue') {
    const csr = row.central_store_request_no || (row.central_store_request_id ? `#${row.central_store_request_id}` : null);
    return csr ? `CSR ${csr}` : 'Central issue';
  }
  if (type === 'stock_transfer' || type === 'workshop_transfer') {
    return row.source_id ? `Transfer #${row.source_id}` : 'Stock transfer';
  }
  if (row.central_store_request_id || row.central_store_request_no) {
    return `CSR ${row.central_store_request_no || `#${row.central_store_request_id}`}`;
  }
  return '—';
}

function statusChipClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'received') return 'admin-stock-chip admin-stock-chip--ok';
  if (s === 'expected') return 'admin-stock-chip admin-stock-chip--warn';
  if (s === 'in_repair') return 'admin-stock-chip';
  return 'admin-stock-chip admin-stock-chip--muted';
}

const WorkshopInventoryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const wingTitle = searchParams.get('wing') ? decodeURIComponent(searchParams.get('wing')) : null;
  const allowTransfer = isAssetTransferAllowedWing(normalizeWingTitle(wingTitle));
  const [statusFilter, setStatusFilter] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('ok');

  const filters = useMemo(() => {
    const f = {};
    if (statusFilter) f.status = statusFilter;
    return f;
  }, [statusFilter]);

  const { data, isLoading, error, refetch } = useGetWorkshopInventoryQuery(filters);
  const [receiveItem] = useReceiveWorkshopInventoryMutation();

  const rows = Array.isArray(data) ? data : [];

  const handleReceive = async (row) => {
    const userId = getUserId();
    if (!userId) {
      setMessageType('warn');
      setMessage('Please sign in again.');
      return;
    }
    try {
      await receiveItem({ id: row.id, received_by: userId }).unwrap();
      setMessageType('ok');
      setMessage(`Received #${row.id} into workshop.`);
      refetch();
    } catch (err) {
      setMessageType('warn');
      setMessage(err?.data?.message || err?.message || 'Receive failed.');
    }
  };

  const goRequestItems = () => {
    navigate(
      withCurrentWingSearch(ASSET_REQUEST_PATH, location.search, location.pathname)
    );
  };

  const goTransfer = () => {
    navigate(
      withCurrentWingSearch(ASSET_TRANSFER_PATH, location.search, location.pathname)
    );
  };

  return (
    <AdminStockPage>
      <AdminPageHeader
        title={(
          <>
            <FaBoxOpen style={{ marginRight: 8, verticalAlign: -2 }} />
            Workshop Inventory
          </>
        )}
        hint="Custody of crashed drones and stock items from transfers and central-store issues."
        actions={(
          <>
            {allowTransfer ? (
              <button type="button" className="admin-stock-btn" onClick={goTransfer}>
                Asset Transfer
              </button>
            ) : null}
            <button type="button" className="admin-stock-btn admin-stock-btn--primary" onClick={goRequestItems}>
              Asset Request
            </button>
          </>
        )}
      />

      <div className="admin-stock-body">
        <div className="admin-stock-stack">
          {message ? (
            <div className={`admin-stock-msg admin-stock-msg--${messageType === 'ok' ? 'ok' : 'warn'}`}>
              {message}
            </div>
          ) : null}

          <AdminToolbar>
            <div className="admin-stock-field" style={{ marginBottom: 0, minWidth: 180 }}>
              <label htmlFor="wi-status">Status</label>
              <select
                id="wi-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="expected">Expected</option>
                <option value="received">Received</option>
                <option value="in_repair">In repair</option>
                <option value="released">Released</option>
              </select>
            </div>
          </AdminToolbar>

          <div className="admin-stock-table-wrap">
            <table className="admin-stock-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Catalog item</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Serial / tag</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="9" className="admin-stock-empty">Loading…</td></tr>
                ) : error ? (
                  <tr><td colSpan="9" className="admin-stock-empty">Unable to load inventory.</td></tr>
                ) : rows.length ? (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td>#{row.id}</td>
                      <td>
                        <strong>
                          {row.inventory_item_name
                            || row.label
                            || row.drone_tag
                            || '—'}
                        </strong>
                        {row.inventory_item_code ? (
                          <div style={{ fontSize: 12, color: '#64748b' }}>{row.inventory_item_code}</div>
                        ) : null}
                      </td>
                      <td>
                        {[row.main_category_name, row.sub_category_name].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td>{row.qty != null ? row.qty : '1'}</td>
                      <td>{row.device_serial || row.drone_serial_ref || row.drone_tag_ref || '—'}</td>
                      <td>
                        {formatSource(row)}
                        {row.incident_id ? (
                          <div style={{ fontSize: 12, color: '#64748b' }}>Incident #{row.incident_id}</div>
                        ) : null}
                      </td>
                      <td>
                        <span className={statusChipClass(row.status)}>{row.status}</span>
                      </td>
                      <td>
                        {formatDateTime(row.received_at)}
                        {row.received_by_name ? (
                          <div style={{ fontSize: 12, color: '#64748b' }}>{row.received_by_name}</div>
                        ) : null}
                      </td>
                      <td>
                        {row.status === 'expected' ? (
                          <button
                            type="button"
                            className="admin-stock-btn admin-stock-btn--primary"
                            onClick={() => handleReceive(row)}
                          >
                            <FaCheck /> Receive
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="9" className="admin-stock-empty">No workshop inventory items.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminStockPage>
  );
};

export default WorkshopInventoryPage;
