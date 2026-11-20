import React, { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Bars } from 'react-loader-spinner';
import { useAppDispatch } from '../../store/hooks';
import { baseApi } from '../../api/services/allEndpoints';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import '../../styles/chemicalreport.css';
import { useSyncShellPeriod } from '../../sections/management/reports/ReportsPeriodContext';
import { useOpsReportWorkspace } from '../../sections/management/reports/OpsReportWorkspaceContext';
import { OpsDateRangeControls } from '../../sections/management/reports/OpsPeriodControls';
import '../../sections/management/reports/reportsDecisionShell.css';

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const applyPresetRange = (key) => {
  const today = new Date();
  if (key === 'week') {
    const start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    return { start, end: today };
  }
  if (key === 'last') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start, end };
  }
  return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
};

const ChemicalsReport = ({ onExportReady }) => {
  const dispatch = useAppDispatch();
  const workspace = useOpsReportWorkspace();
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [activePreset, setActivePreset] = useState('month');
  useSyncShellPeriod(setStartDate, setEndDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({ chemical_usage: {} });
  const [estateFilter, setEstateFilter] = useState('ALL');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!startDate || !endDate) return;
      setLoading(true);
      setError('');
      try {
        const result = await dispatch(
          baseApi.endpoints.getUsedChemicals.initiate({
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
          })
        );
        const res = result.data;
        if (mounted) setData(res || { chemical_usage: {} });
      } catch (e) {
        if (mounted) setError('Failed to load chemicals usage');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [dispatch, startDate, endDate]);

  const groupedUsage = useMemo(() => {
    const usage = data?.chemical_usage || {};
    if (Array.isArray(usage)) {
      const grouped = {};
      usage.forEach((entry) => {
        if (typeof entry === 'object' && entry !== null) {
          const estate = entry.estate || 'Unknown';
          if (!grouped[estate]) grouped[estate] = [];
          grouped[estate].push(entry);
        }
      });
      return grouped;
    }
    return usage;
  }, [data]);

  const estates = useMemo(() => ['ALL', ...Object.keys(groupedUsage)], [groupedUsage]);

  const chemicalList = useMemo(() => {
    const selectedEstates = estateFilter === 'ALL' ? Object.keys(groupedUsage) : [estateFilter];
    const set = new Set();
    selectedEstates.forEach((estate) => {
      (groupedUsage[estate] || []).forEach((entry) => {
        (entry.chemicals || []).forEach((chem) => set.add(chem.chemical));
      });
    });
    const allChems = Array.from(set);
    const priorityChemicals = ['Zinc Sulfate', 'Urea', 'Epsom Salt', 'Copper'];
    const prioritized = priorityChemicals.filter((c) => allChems.includes(c));
    const others = allChems.filter((c) => !priorityChemicals.includes(c)).sort();
    return [...prioritized, ...others];
  }, [groupedUsage, estateFilter]);

  const tableRows = useMemo(() => {
    const selectedEstates = estateFilter === 'ALL' ? Object.keys(groupedUsage) : [estateFilter];
    const out = [];
    selectedEstates.forEach((estate) => {
      (groupedUsage[estate] || []).forEach((entry) => {
        const row = {
          Date: entry.date,
          Estate: estate,
          Extent: entry.extent,
          'Plan id': entry.plan_id,
        };
        chemicalList.forEach((chem) => {
          row[chem] = 0;
        });
        (entry.chemicals || []).forEach((chem) => {
          row[chem.chemical] = chem.quantity;
        });
        out.push(row);
      });
    });
    return out;
  }, [groupedUsage, estateFilter, chemicalList]);

  const handleExportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(tableRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Chemicals');
    XLSX.writeFile(workbook, `chemicals_${formatDate(startDate)}_${formatDate(endDate)}.xlsx`);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text(`Chemicals Usage (${formatDate(startDate)} to ${formatDate(endDate)})`, 14, 14);
    const head = [['Date', 'Estate', 'Extent', 'Plan id', ...chemicalList]];
    const body = tableRows.map((r) => [
      r.Date,
      r.Estate,
      String(r.Extent),
      String(r['Plan id']),
      ...chemicalList.map((chem) => String(r[chem])),
    ]);
    doc.autoTable({ head, body, startY: 20 });
    doc.save(`chemicals_${formatDate(startDate)}_${formatDate(endDate)}.pdf`);
  };

  useEffect(() => {
    onExportReady?.(handleExportExcel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableRows, startDate, endDate, onExportReady]);

  useEffect(() => {
    if (!workspace?.setSidebar) return undefined;
    workspace.setSidebar(
      <div className="rds-ops-controls">
        <OpsDateRangeControls
          startDate={startDate}
          endDate={endDate}
          onStartChange={(d) => {
            setActivePreset(null);
            setStartDate(d);
          }}
          onEndChange={(d) => {
            setActivePreset(null);
            setEndDate(d);
          }}
          showPresets
          activePreset={activePreset}
          onPreset={(key) => {
            const { start, end } = applyPresetRange(key);
            setActivePreset(key);
            setStartDate(start);
            setEndDate(end);
          }}
        />
        <div className="rds-ops-controls-block rds-ops-controls-inline">
          <span className="rds-ops-controls-label">Estate</span>
          <label className="rds-ops-field rds-ops-field-inline">
            <select value={estateFilter} onChange={(e) => setEstateFilter(e.target.value)} disabled={loading}>
              {estates.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    );
    return () => workspace.clearSidebar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    workspace?.setSidebar,
    startDate,
    endDate,
    activePreset,
    estateFilter,
    estates,
    loading,
  ]);

  const tableBlock = (
    <div className="rds-table-wrap">
      <table className="rds-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Estate</th>
            <th className="num">Extent (Ha)</th>
            <th>Plan ID</th>
            {chemicalList.map((chem) => (
              <th key={chem}>{chem}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableRows.length === 0 ? (
            <tr>
              <td colSpan={4 + chemicalList.length} style={{ textAlign: 'center' }}>
                No data
              </td>
            </tr>
          ) : (
            tableRows.map((r, idx) => (
              <tr key={idx}>
                <td>{r.Date}</td>
                <td>{r.Estate}</td>
                <td className="num">{r.Extent}</td>
                <td>{r['Plan id']}</td>
                {chemicalList.map((chem) => (
                  <td key={chem} className="num">
                    {r[chem]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  if (workspace) {
    return (
      <div className="rds-ops-data">
        {error && <div className="rds-empty">{error}</div>}
        {loading ? (
          <div className="rds-loading">
            <Bars height={36} width={36} color="#0f6b4c" ariaLabel="loading" />
          </div>
        ) : (
          tableBlock
        )}
      </div>
    );
  }

  return (
    <div className="container-chemical">
      <div className="filters">
        <div className="input-group">
          <label>Start Date</label>
          <DatePicker
            selected={startDate}
            onChange={setStartDate}
            dateFormat="yyyy-MM-dd"
            maxDate={endDate}
            disabled={loading}
          />
        </div>
        <div className="input-group">
          <label>End Date</label>
          <DatePicker
            selected={endDate}
            onChange={setEndDate}
            dateFormat="yyyy-MM-dd"
            minDate={startDate}
            maxDate={new Date()}
            disabled={loading}
          />
        </div>
        <div className="input-group">
          <label>Estate</label>
          <select value={estateFilter} onChange={(e) => setEstateFilter(e.target.value)}>
            {estates.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div className="buttons">
          <button type="button" onClick={handleExportExcel}>
            Download Excel
          </button>
          <button type="button" onClick={handleExportPdf}>
            Download PDF
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {loading ? <div>Loading...</div> : tableBlock}
    </div>
  );
};

export default ChemicalsReport;
