import React, { useMemo, useState } from 'react';
import {
  useGetStockTransfersQuery,
  useCreateStockTransferMutation,
  useGetWorkshopStockAvailabilityQuery,
} from '../../api/services NodeJs/centralProcurementApi';
import {
  useGetMainCategoriesQuery,
  useGetSubCategoriesQuery,
} from '../../api/services NodeJs/stockAssetsApi';
import { AdminPanel, AdminToolbar } from './shell/AdminStockShell';

const EMPTY_LINE = { inventory_item_id: '', qty: '', device_serial: '', main_category_id: '', sub_category_id: '' };

function getUserId() {
  try {
    return JSON.parse(localStorage.getItem('userData') || '{}')?.id || null;
  } catch {
    return null;
  }
}

const AssetTransfer = ({ embedded = false }) => {
  const [form, setForm] = useState({
    remarks: '',
    destination_type: 'workshop',
    lines: [{ ...EMPTY_LINE }],
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('ok');
  const [search, setSearch] = useState('');

  const { data: mainCategoriesData } = useGetMainCategoriesQuery();
  const { data: subCategoriesData } = useGetSubCategoriesQuery({});
  const { data: stockData, refetch: refetchStock } = useGetWorkshopStockAvailabilityQuery(
    search.trim() ? { search: search.trim() } : {}
  );
  const { data: transfersData, refetch } = useGetStockTransfersQuery({
    destination_type: form.destination_type || 'workshop',
  });
  const [createTransfer, { isLoading: saving }] = useCreateStockTransferMutation();

  const mainCategories = Array.isArray(mainCategoriesData) ? mainCategoriesData : [];
  const subCategories = Array.isArray(subCategoriesData) ? subCategoriesData : [];
  const stockRows = Array.isArray(stockData) ? stockData : [];
  const transfers = Array.isArray(transfersData) ? transfersData : [];

  const stockById = useMemo(() => {
    const map = new Map();
    stockRows.forEach((r) => map.set(String(r.inventory_item_id), r));
    return map;
  }, [stockRows]);

  const availableCount = useMemo(
    () => stockRows.filter((r) => Number(r.current_stock) > 0).length,
    [stockRows]
  );

  const itemsForLine = (line) => {
    let list = stockRows.filter((r) => Number(r.current_stock) > 0);
    if (line.main_category_id) {
      list = list.filter((r) => Number(r.main_category_id) === Number(line.main_category_id));
    }
    if (line.sub_category_id) {
      list = list.filter((r) => Number(r.sub_category_id) === Number(line.sub_category_id));
    }
    return list;
  };

  const subsForLine = (line) => {
    if (!line.main_category_id) return [];
    return subCategories.filter((s) => Number(s.main_category_id) === Number(line.main_category_id));
  };

  const updateLine = (idx, key, value) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => {
        if (i !== idx) return line;
        const next = { ...line, [key]: value };
        if (key === 'main_category_id') {
          next.sub_category_id = '';
          next.inventory_item_id = '';
        }
        if (key === 'sub_category_id') next.inventory_item_id = '';
        return next;
      }),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const userId = getUserId();
    if (!userId) {
      setMessageType('warn');
      setMessage('Please sign in again.');
      return;
    }
    const lines = form.lines
      .map((line) => ({
        inventory_item_id: Number(line.inventory_item_id),
        qty: Number(line.qty),
        device_serial: line.device_serial?.trim() || null,
      }))
      .filter((x) => x.inventory_item_id > 0 && x.qty > 0);
    if (!lines.length) {
      setMessageType('warn');
      setMessage('Add at least one line with available central stock and quantity.');
      return;
    }
    for (const line of lines) {
      const avail = stockById.get(String(line.inventory_item_id));
      if (!avail || Number(avail.current_stock) < line.qty) {
        setMessageType('warn');
        setMessage(`Insufficient central stock for item #${line.inventory_item_id}.`);
        return;
      }
    }

    try {
      await createTransfer({
        transferred_by: userId,
        remarks: form.remarks || null,
        destination_type: form.destination_type || 'workshop',
        lines,
      }).unwrap();
      setForm({ remarks: '', destination_type: form.destination_type || 'workshop', lines: [{ ...EMPTY_LINE }] });
      setMessageType('ok');
      setMessage('Transfer completed. Central stock updated.');
      refetch();
      refetchStock();
    } catch (err) {
      setMessageType('warn');
      setMessage(err?.data?.message || err?.message || 'Transfer failed.');
    }
  };

  return (
    <div className={`assets-transfer-container${embedded ? ' assets-transfer-container--embedded' : ''} admin-stock-body`}>
      {!embedded ? (
        <h2 className="admin-stock-title" style={{ marginBottom: 12 }}>Asset Transfer</h2>
      ) : null}

      <div className="admin-stock-stack">
        {message ? (
          <div className={`admin-stock-msg admin-stock-msg--${messageType === 'ok' ? 'ok' : 'warn'}`}>
            {message}
          </div>
        ) : null}

        <AdminToolbar>
          <div className="admin-stock-field" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label htmlFor="xfer-search">Find stock</label>
            <input
              id="xfer-search"
              type="search"
              placeholder="Search item code or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="admin-stock-field" style={{ marginBottom: 0 }}>
            <label>Available SKUs</label>
            <div style={{ padding: '10px 12px', fontWeight: 650, color: '#1a5f7a' }}>
              {availableCount}
            </div>
          </div>
        </AdminToolbar>

        <AdminPanel>
          <h3 className="admin-stock-section-title">New transfer</h3>
          <p className="admin-stock-section-hint">
            Move Central Stores stock to a destination (e.g. workshop). Destination custody is updated when supported.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="admin-stock-grid-2">
              <div className="admin-stock-field">
                <label htmlFor="xfer-dest">Destination *</label>
                <select
                  id="xfer-dest"
                  value={form.destination_type}
                  onChange={(e) => setForm((p) => ({ ...p, destination_type: e.target.value }))}
                  required
                >
                  <option value="workshop">Workshop</option>
                  <option value="wing" disabled>Wing (coming soon)</option>
                </select>
              </div>
              <div className="admin-stock-field">
                <label htmlFor="xfer-remarks">Remarks</label>
                <textarea
                  id="xfer-remarks"
                  rows={2}
                  value={form.remarks}
                  onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                  placeholder="Optional note for this transfer"
                />
              </div>
            </div>

            <h3 className="admin-stock-section-title" style={{ marginTop: 8 }}>Lines</h3>
            {form.lines.map((line, idx) => {
              const selected = stockById.get(String(line.inventory_item_id));
              return (
                <div key={`xfer-${idx}`} className="admin-stock-line admin-stock-line--transfer">
                  <div className="admin-stock-field">
                    <label>Main category</label>
                    <select
                      value={line.main_category_id}
                      onChange={(e) => updateLine(idx, 'main_category_id', e.target.value)}
                    >
                      <option value="">All</option>
                      {mainCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.category_name || c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-stock-field">
                    <label>Sub category</label>
                    <select
                      value={line.sub_category_id}
                      onChange={(e) => updateLine(idx, 'sub_category_id', e.target.value)}
                    >
                      <option value="">All</option>
                      {subsForLine(line).map((s) => (
                        <option key={s.id} value={s.id}>{s.sub_category_name || s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-stock-field">
                    <label>Item (in stock) *</label>
                    <select
                      value={line.inventory_item_id}
                      onChange={(e) => updateLine(idx, 'inventory_item_id', e.target.value)}
                      required
                    >
                      <option value="">Select item</option>
                      {itemsForLine(line).map((item) => (
                        <option key={item.inventory_item_id} value={item.inventory_item_id}>
                          {item.item_code} — {item.item_name} ({item.current_stock})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-stock-field">
                    <label>Qty *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={line.qty}
                      onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                      required
                    />
                  </div>
                  <div className="admin-stock-field">
                    <label>Serial</label>
                    <input
                      type="text"
                      value={line.device_serial}
                      onChange={(e) => updateLine(idx, 'device_serial', e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <button
                    type="button"
                    className="admin-stock-btn admin-stock-btn--ghost"
                    onClick={() => setForm((p) => ({
                      ...p,
                      lines: p.lines.length > 1 ? p.lines.filter((_, i) => i !== idx) : [{ ...EMPTY_LINE }],
                    }))}
                  >
                    Remove
                  </button>
                  {selected ? (
                    <div className="admin-stock-line-meta">
                      Available central stock: <strong>{selected.current_stock}</strong>
                      {selected.main_category_name ? ` · ${selected.main_category_name}` : ''}
                      {selected.sub_category_name ? ` / ${selected.sub_category_name}` : ''}
                    </div>
                  ) : null}
                </div>
              );
            })}

            <div className="admin-stock-actions">
              <button
                type="button"
                className="admin-stock-btn"
                onClick={() => setForm((p) => ({ ...p, lines: [...p.lines, { ...EMPTY_LINE }] }))}
              >
                + Add line
              </button>
              <button type="submit" className="admin-stock-btn admin-stock-btn--primary" disabled={saving}>
                {saving ? 'Transferring…' : 'Submit transfer'}
              </button>
            </div>
          </form>
        </AdminPanel>

        <AdminPanel>
          <h3 className="admin-stock-section-title">Recent transfers</h3>
          <div className="admin-stock-table-wrap" style={{ boxShadow: 'none' }}>
            <table className="admin-stock-table">
              <thead>
                <tr>
                  <th>Transfer</th>
                  <th>By</th>
                  <th>Lines</th>
                  <th>Total qty</th>
                  <th>When</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length ? (
                  transfers.map((t) => (
                    <tr key={t.id}>
                      <td><strong>#{t.id}</strong></td>
                      <td>{t.transferred_by_name || t.transferred_by || '—'}</td>
                      <td>{t.line_count ?? '—'}</td>
                      <td>{t.total_qty ?? '—'}</td>
                      <td>{t.transferred_at ? String(t.transferred_at).slice(0, 19).replace('T', ' ') : '—'}</td>
                      <td>{t.remarks || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="admin-stock-empty">No transfers yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      </div>
    </div>
  );
};

export default AssetTransfer;
