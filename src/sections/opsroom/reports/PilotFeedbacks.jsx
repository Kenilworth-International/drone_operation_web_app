import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Bars } from 'react-loader-spinner';
import * as XLSX from 'xlsx';
import { baseApi } from '../../../api/services/allEndpoints';
import { useAppDispatch } from '../../../store/hooks';
import '../../../styles/opsreport9.css';
import { useSyncShellPeriod } from '../../management/reports/ReportsPeriodContext';

const formatDate = (date) => date.toLocaleDateString('en-CA');

const PilotFeedbacks = () => {
  const dispatch = useAppDispatch();
  const [startDate, setStartDate] = useState(() => { 
    const d = new Date(); 
    d.setDate(d.getDate() - 7); 
    return d; 
  });
  const [endDate, setEndDate] = useState(new Date());
  useSyncShellPeriod(setStartDate, setEndDate);
  const [loading, setLoading] = useState(false);
  const [apiData, setApiData] = useState(null);
  const [selectedEstate, setSelectedEstate] = useState('all');
  const [selectedPilot, setSelectedPilot] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await dispatch(baseApi.endpoints.getPilotFeedbacks.initiate({
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
      }));
      const res = result.data;
      setApiData(res);
    } catch (e) {
      console.error('Error fetching pilot feedbacks:', e);
      setApiData(null);
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, [startDate, endDate]);

  // Get unique estates and pilots for filters
  const { estates, pilots } = useMemo(() => {
    if (!apiData || apiData.status !== 'true' || !Array.isArray(apiData.feedbacks)) {
      return { estates: [], pilots: [] };
    }

    const uniqueEstates = [...new Set(apiData.feedbacks.map(f => f.estate_name))].sort();
    const uniquePilots = [...new Set(apiData.feedbacks.map(f => f.user_name))].sort();
    
    return { estates: uniqueEstates, pilots: uniquePilots };
  }, [apiData]);

  // Filter data based on selected filters
  const filteredData = useMemo(() => {
    if (!apiData || apiData.status !== 'true' || !Array.isArray(apiData.feedbacks)) {
      return [];
    }

    return apiData.feedbacks.filter(feedback => {
      const estateMatch = selectedEstate === 'all' || feedback.estate_name === selectedEstate;
      const pilotMatch = selectedPilot === 'all' || feedback.user_name === selectedPilot;
      return estateMatch && pilotMatch;
    });
  }, [apiData, selectedEstate, selectedPilot]);

  const exportToExcel = () => {
    if (filteredData.length === 0) {
      alert('No data available to export');
      return;
    }

    const exportData = filteredData.map(item => ({
      'User ID': item.user_id,
      'Pilot Name': item.user_name,
      'Estate ID': item.estate_id,
      'Estate Name': item.estate_name,
      'Date': item.date,
      'Water Time': item.water_time,
      'Chemical Time': item.chemicle_time,
      'Latitude': item.latitude,
      'Longitude': item.longitude
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pilot Feedbacks');
    
    const filename = `Pilot_Feedbacks_${formatDate(startDate)}_to_${formatDate(endDate)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="ops9-container">
      <div className="ops9-controls">
        <div className="date-group">
          <label>Start Date:</label>
          <DatePicker 
            selected={startDate} 
            onChange={setStartDate} 
            dateFormat="yyyy/MM/dd" 
            className="date-picker" 
            disabled={loading} 
          />
        </div>
        <div className="date-group">
          <label>End Date:</label>
          <DatePicker 
            selected={endDate} 
            onChange={setEndDate} 
            dateFormat="yyyy/MM/dd" 
            className="date-picker" 
            disabled={loading} 
          />
        </div>
        
        <div className="date-group">
          <label>Estate:</label>
          <select 
            value={selectedEstate} 
            onChange={(e) => setSelectedEstate(e.target.value)}
            className="date-picker"
            disabled={loading}
          >
            <option value="all">All Estates</option>
            {estates.map(estate => (
              <option key={estate} value={estate}>{estate}</option>
            ))}
          </select>
        </div>
        
        <div className="date-group">
          <label>Pilot:</label>
          <select 
            value={selectedPilot} 
            onChange={(e) => setSelectedPilot(e.target.value)}
            className="date-picker"
            disabled={loading}
          >
            <option value="all">All Pilots</option>
            {pilots.map(pilot => (
              <option key={pilot} value={pilot}>{pilot}</option>
            ))}
          </select>
        </div>
        
        <div className="controls-spacer" />
        <button className="export-btn" onClick={exportToExcel} disabled={loading || filteredData.length === 0}>
          Excel
        </button>
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
              <tr>
                <th>User ID</th>
                <th>Pilot Name</th>
                <th>Estate ID</th>
                <th>Estate Name</th>
                <th>Date</th>
                <th>Water Time</th>
                <th>Chemical Time</th>
                <th>Latitude</th>
                <th>Longitude</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="no-data">No feedback data available for the selected criteria</td>
                </tr>
              ) : (
                filteredData.map((feedback, index) => (
                  <tr key={`${feedback.user_id}-${feedback.date}-${index}`} className={index % 2 === 0 ? 'even' : 'odd'}>
                    <td>{feedback.user_id}</td>
                    <td>{feedback.user_name}</td>
                    <td>{feedback.estate_id}</td>
                    <td>{feedback.estate_name}</td>
                    <td>{feedback.date}</td>
                    <td>{feedback.water_time}</td>
                    <td>{feedback.chemicle_time}</td>
                    <td>{feedback.latitude}</td>
                    <td>{feedback.longitude}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PilotFeedbacks;
