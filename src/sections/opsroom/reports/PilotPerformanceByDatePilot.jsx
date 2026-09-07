import React, { useEffect, useMemo, useState } from "react";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Bars } from 'react-loader-spinner';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { baseApi } from '../../../api/services/allEndpoints';
import { useAppDispatch } from '../../../store/hooks';
import '../../../styles/opsreport9.css';

const formatDate = (date) => date.toLocaleDateString('en-CA');

const PilotPerformanceByDatePilot = () => {
  const dispatch = useAppDispatch();
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [endDate, setEndDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [apiData, setApiData] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await dispatch(baseApi.endpoints.getPilotTeamSprayArea.initiate({
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
      }));
      if (result.error) {
        setApiData(null);
        return;
      }
      const res = result.data;
      setApiData(res);
    } catch (e) {
      setApiData(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [startDate, endDate]);

  const { headers, teamRows, totalsRow, grandTotal, dateKeys, monthLabel } = useMemo(() => {
    const result = { 
      headers: [], 
      teamRows: [], 
      totalsRow: {}, 
      grandTotal: 0, 
      dateKeys: [], 
      monthLabel: ''
    };
    
    if (!apiData || apiData.status !== 'true' || !Array.isArray(apiData.dates)) return result;

    const dateKeys = apiData.dates.map(d => d.date);
    result.dateKeys = dateKeys;
    result.headers = ['Team', 'Pilot', ...dateKeys, 'Total'];
    
    if (dateKeys.length > 0) {
      const d0 = new Date(dateKeys[0]);
      const mm = d0.toLocaleString('en-US', { month: 'short' });
      const yy = String(d0.getFullYear()).slice(-2);
      result.monthLabel = `${mm}-${yy}`;
    }

    // Group pilots by plantation team
    const teamMap = new Map();
    
    apiData.dates.forEach(day => {
      const date = day.date;
      (day.pilots || []).forEach(p => {
        const teamName = p.pilot_plantation_team || 'Unassigned';
        const pilotId = p.pilot_id || p.pilot_name;
        
        if (!teamMap.has(teamName)) {
          teamMap.set(teamName, new Map());
        }
        
        if (!teamMap.get(teamName).has(pilotId)) {
          teamMap.get(teamName).set(pilotId, {
            name: p.pilot_name,
            perDate: {},
            total: 0
          });
        }
        
        const value = Number(p.pilot_date_field_area || 0);
        const pilotData = teamMap.get(teamName).get(pilotId);
        pilotData.perDate[date] = (pilotData.perDate[date] || 0) + value;
      });
    });

    // Convert to rows grouped by team
    teamMap.forEach((pilots, teamName) => {
      const teamPilots = [];
      
      pilots.forEach((pilotData, pilotId) => {
        const row = { 
          team: teamName, 
          pilot: pilotData.name,
          isTeamLead: pilotData.name.includes('(TL)') || false
        };
        
        let total = 0;
        dateKeys.forEach(dk => { 
          const v = Number(pilotData.perDate[dk] || 0); 
          row[dk] = v; 
          total += v; 
        });
        row.Total = total;
        
        if (total !== 0) {
          teamPilots.push(row);
          result.grandTotal += total;
        }
      });
      
      // Sort pilots within team by total desc
      teamPilots.sort((a, b) => b.Total - a.Total);
      
      if (teamPilots.length > 0) {
        result.teamRows.push({
          teamName,
          pilots: teamPilots
        });
      }
    });

    // Sort teams by Team column (ascending alphabetical)
    result.teamRows.sort((a, b) => (a.teamName || '').localeCompare(b.teamName || ''));

    // Totals per date
    const totalsRow = { team: 'Total', pilot: '', Total: 0 };
    dateKeys.forEach(dk => {
      const sum = result.teamRows.reduce((acc, team) => 
        acc + team.pilots.reduce((teamSum, pilot) => teamSum + Number(pilot[dk] || 0), 0), 0);
      totalsRow[dk] = sum;
      totalsRow.Total += sum;
    });
    result.totalsRow = totalsRow;

    return result;
  }, [apiData]);

  const fmt = (v) => (Number(v) === 0 ? '' : Number(v).toFixed(2));

  const exportToExcel = () => {
    const title = 'Pilot Performance';
    const days = (dateKeys || []).map(dk => new Date(dk).getDate());
    const sheetHeaders = [
      [title], 
      ["Team", "Pilot", monthLabel, ...new Array(days.length - 1).fill(''), "Total"], 
      ["", "", ...days, ""]
    ];

    const body = [];
    teamRows.forEach(team => {
      team.pilots.forEach(pilot => {
        body.push([
          team.teamName, 
          pilot.pilot, 
          ...dateKeys.map(dk => Number(pilot[dk] || 0)), 
          Number(pilot.Total || 0)
        ]);
      });
    });
    
    const aoa = [...sheetHeaders, ...body];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Merges: title across all columns
    const lastCol = (dateKeys?.length || 0) + 2;
    const headerMerges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
      // Team and Pilot rowspan
      { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
      { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
      // Month label across date columns
      { s: { r: 1, c: 2 }, e: { r: 1, c: lastCol - 1 } },
      // Total rowspan
      { s: { r: 1, c: lastCol }, e: { r: 2, c: lastCol } },
    ];

    // Merge Team cells for each team block in the body
    const bodyStartRow = 3; // after 3 header rows
    let currentRow = bodyStartRow;
    const teamBodyMerges = [];
    teamRows.forEach(team => {
      const count = team.pilots.length;
      if (count > 1) {
        teamBodyMerges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow + count - 1, c: 0 } });
      }
      currentRow += count;
    });

    ws['!merges'] = [...headerMerges, ...teamBodyMerges];

    // Column widths
    ws['!cols'] = [
      { wch: 15 }, // Team
      { wch: 24 }, // Pilot
      ...new Array(days.length).fill({ wch: 6 }), // Days
      { wch: 10 }  // Total
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pilot Performance');
    const filename = `Pilot_Performance_PilotData_${formatDate(startDate)}_to_${formatDate(endDate)}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Pilot Performance', 14, 12);
    
    const head = [["Team", "Pilot", ...dateKeys.map(dk => new Date(dk).getDate()), "Total"]];
    const body = [];
    
    teamRows.forEach(team => {
      team.pilots.forEach(pilot => {
        body.push([
          team.teamName, 
          pilot.pilot, 
          ...dateKeys.map(dk => Number(pilot[dk] || 0)), 
          Number(pilot.Total || 0)
        ]);
      });
    });
    
    autoTable(doc, { 
      head, 
      body, 
      startY: 18, 
      styles: { fontSize: 8 }, 
      headStyles: { fillColor: [15, 105, 55] } 
    });
    
    const filename = `Pilot_Performance_PilotData_${formatDate(startDate)}_to_${formatDate(endDate)}.pdf`;
    doc.save(filename);
  };

  return (
    <div className="ops9-container">
      <div className="ops9-controls">
        <div className="date-group">
          <label>Start Date:</label>
          <DatePicker selected={startDate} onChange={setStartDate} dateFormat="yyyy/MM/dd" className="date-picker" disabled={loading} />
        </div>
        <div className="date-group">
          <label>End Date:</label>
          <DatePicker selected={endDate} onChange={setEndDate} dateFormat="yyyy/MM/dd" className="date-picker" disabled={loading} />
        </div>
        <div className="controls-spacer" />
        <button className="export-btn" onClick={exportToExcel}>Excel</button>
        <button className="export-btn" onClick={exportToPDF}>PDF</button>
      </div>

      {loading ? (
        <div className="ops9-table-wrapper">
          <div className="loading-container-reports">
            <Bars height="60" width="60" color="#004B71" ariaLabel="bars-loading" visible={true} />
            <p>Loading...</p>
          </div>
        </div>
      ) : (
        <div className="ops9-table-wrapper">
          <table className="ops9-table">
            <thead>
              <tr className="title-row">
                <th colSpan={dateKeys.length + 3}>Pilot Performance</th>
              </tr>
              <tr className="month-row">
                <th className="team-col" rowSpan={2}>Team</th>
                <th className="pilot-col" rowSpan={2}>Pilot</th>
                <th colSpan={dateKeys.length} className="month-span">{monthLabel}</th>
                <th className="total-col" rowSpan={2}>Total</th>
              </tr>
              <tr className="days-row">
                {dateKeys.map((dk) => {
                  const day = new Date(dk).getDate();
                  return <th key={dk}>{day}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {teamRows.length === 0 && (
                <tr><td colSpan={dateKeys.length + 3} className="no-data">No data</td></tr>
              )}
              {teamRows.map((team, teamIdx) => (
                <React.Fragment key={team.teamName}>
                  {team.pilots.map((pilot, pilotIdx) => (
                    <tr key={`${team.teamName}-${pilot.pilot}`} className={pilotIdx % 2 === 0 ? 'even' : 'odd'}>
                      {pilotIdx === 0 ? (
                        <td className="team-col" rowSpan={team.pilots.length}>{team.teamName}</td>
                      ) : null}
                      <td className="pilot-col">{pilot.pilot}</td>
                      {dateKeys.map((dk) => (
                        <td key={dk} className="num">{fmt(pilot[dk] || 0)}</td>
                      ))}
                      <td className="num total">{fmt(pilot.Total || 0)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {/* Totals row */}
              <tr className="totals-row">
                <td className="team-col">{totalsRow.team}</td>
                <td className="pilot-col">{totalsRow.pilot}</td>
                {dateKeys.map((dk) => (
                  <td key={dk} className="num total">{fmt(totalsRow[dk] || 0)}</td>
                ))}
                <td className="num total">{fmt(totalsRow.Total || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PilotPerformanceByDatePilot;


