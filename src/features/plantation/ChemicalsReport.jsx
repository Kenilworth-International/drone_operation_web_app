import React, { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useAppDispatch } from '../../store/hooks';
import { baseApi } from '../../api/services/allEndpoints';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import '../../styles/chemicalreport.css';
import { useSyncShellPeriod } from '../../sections/management/reports/ReportsPeriodContext';

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ChemicalsReport = () => {
  const dispatch = useAppDispatch();
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  useSyncShellPeriod(setStartDate, setEndDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({ chemical_usage: {} });
  const [estateFilter, setEstateFilter] = useState('ALL');

  // Fetch on date change
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!startDate || !endDate) return;
      setLoading(true);
      setError('');
      try {
        const result = await dispatch(baseApi.endpoints.getUsedChemicals.initiate({startDate: formatDate(startDate), endDate: formatDate(endDate)}));
        const res = result.data;
        if (mounted) {
          setData(res || { chemical_usage: {} });
        }
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
  }, [startDate, endDate]);

  const groupedUsage = useMemo(() => {
    const usage = data?.chemical_usage || {};
    if (Array.isArray(usage)) {
      const grouped = {};
      usage.forEach((entry) => {
        if (typeof entry === 'object' && entry !== null) {
          const estate = entry.estate || 'Unknown';
          if (!grouped[estate]) {
            grouped[estate] = [];
          }
          grouped[estate].push(entry);
        }
      });
      return grouped;
    } else {
      return usage;
    }
  }, [data]);

  const estates = useMemo(() => {
    return ['ALL', ...Object.keys(groupedUsage)];
  }, [groupedUsage]);

  const chemicalList = useMemo(() => {
    const selectedEstates = estateFilter === 'ALL' ? Object.keys(groupedUsage) : [estateFilter];
    const set = new Set();
    selectedEstates.forEach((estate) => {
      const entries = groupedUsage[estate] || [];
      entries.forEach((entry) => {
        (entry.chemicals || []).forEach((chem) => set.add(chem.chemical));
      });
    });
    const allChems = Array.from(set);
    const priorityChemicals = ['Zinc Sulfate', 'Urea', 'Epsom Salt', 'Copper'];
    const prioritized = priorityChemicals.filter(c => allChems.includes(c));
    const others = allChems.filter(c => !priorityChemicals.includes(c)).sort();
    return [...prioritized, ...others];
  }, [groupedUsage, estateFilter]);

  const tableRows = useMemo(() => {
    const selectedEstates = estateFilter === 'ALL' ? Object.keys(groupedUsage) : [estateFilter];
    const out = [];
    selectedEstates.forEach((estate) => {
      const entries = groupedUsage[estate] || [];
      entries.forEach((entry) => {
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
    const filename = `chemicals_${formatDate(startDate)}_${formatDate(endDate)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const title = `Chemicals Usage (${formatDate(startDate)} to ${formatDate(endDate)})`;
    doc.text(title, 14, 14);
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
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
        <div className="buttons">
          <button onClick={handleExportExcel}>Download Excel</button>
          <button onClick={handleExportPdf}>Download PDF</button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Estate</th>
                  <th>Extent (Ha)</th>
                  <th>Plan ID</th>
                  {chemicalList.map((chem) => (
                    <th key={chem}>{chem}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td className="no-data" colSpan={4 + chemicalList.length}>No data</td>
                  </tr>
                ) : (
                  tableRows.map((r, idx) => (
                    <tr key={idx}>
                      <td>{r.Date}</td>
                      <td>{r.Estate}</td>
                      <td>{r.Extent}</td>
                      <td>{r['Plan id']}</td>
                      {chemicalList.map((chem) => (
                        <td key={chem}>{r[chem]}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* <div className="summary">
            <div className="summary-title">Estate Summary</div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Estate</th>
                    <th>Plans</th>
                    <th>Total Extent (Ha)</th>
                    {chemicalList.map((chem) => (
                      <th key={chem}>{chem}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.length === 0 ? (
                    <tr>
                      <td className="no-data" colSpan={3 + chemicalList.length}>No data</td>
                    </tr>
                  ) : (
                    summaryRows.map((row) => (
                      <tr key={row.estate}>
                        <td>{row.estate}</td>
                        <td>{row.plans}</td>
                        <td>{row.totalExtent}</td>
                        {chemicalList.map((chem) => (
                          <td key={chem}>
                            {Number((row.chemTotals[chem] || 0).toFixed ? (row.chemTotals[chem] || 0).toFixed(2) : row.chemTotals[chem] || 0)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div> */}
        </>
      )}
    </div>
  );
};

export default ChemicalsReport;