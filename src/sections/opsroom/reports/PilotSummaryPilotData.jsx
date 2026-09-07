import React, { useState, useEffect } from "react";
import { Bars } from 'react-loader-spinner';
import '../../../styles/ops.css';
import ReportDateRangePicker from '../../../components/ReportDateRangePicker';
import { baseApi } from '../../../api/services/allEndpoints';
import { useAppDispatch } from '../../../store/hooks';
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { FiDownload, FiPrinter } from "react-icons/fi";

const PilotSummaryPilotData = () => {
    const dispatch = useAppDispatch();
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const [startDate, setStartDate] = useState(firstDayOfMonth);
    const [endDate, setEndDate] = useState(today);
    const [pilotsData, setPilotsData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterOptions, setFilterOptions] = useState({
        pilotNames: []
    });
    const [filters, setFilters] = useState({
        pilotName: ''
    });
    const [pilotFlyingTimes, setPilotFlyingTimes] = useState({}); // NEW: Store flying times

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const result = await dispatch(baseApi.endpoints.getPilotPerformance.initiate({
                    startDate: startDate.toLocaleDateString('en-CA'),
                    endDate: endDate.toLocaleDateString('en-CA')
                }));
                if (result.error) {
                    throw new Error(result.error?.data?.message || result.error?.error || 'Failed to load pilot summary');
                }
                const response = result.data;
                if (!response?.pilots) {
                    setPilotsData([]);
                    setFilterOptions({ pilotNames: [] });
                    return;
                }

                const pilotStats = {};
                response.pilots.forEach(pilot => {
                    if (!pilotStats[pilot.pilot_name]) {
                        pilotStats[pilot.pilot_name] = {
                            pilotName: pilot.pilot_name,
                            assignedSpray: 0,
                            assignedSpread: 0,
                            assignedTotal: 0,
                            completedSpray: 0,
                            completedSpread: 0,
                            completedTotal: 0,
                            flyingTime: pilot.flying_time || 0
                        };
                    }
                    pilot.plans.forEach(plan => {
                        // Assigned
                        if (plan.type === 'spy') {
                            pilotStats[pilot.pilot_name].assignedSpray += Number(plan.assigned_area_to_pilot_in_plan) || 0;
                        } else if (plan.type === 'spd') {
                            pilotStats[pilot.pilot_name].assignedSpread += Number(plan.assigned_area_to_pilot_in_plan) || 0;
                        }
                        pilotStats[pilot.pilot_name].assignedTotal += Number(plan.assigned_area_to_pilot_in_plan) || 0;
                        // Completed
                        plan.fields.forEach(field => {
                            const completed = Number(field.completed_area_by_pilot_for_field) || 0;
                            if (plan.type === 'spy') {
                                pilotStats[pilot.pilot_name].completedSpray += completed;
                            } else if (plan.type === 'spd') {
                                pilotStats[pilot.pilot_name].completedSpread += completed;
                            }
                            pilotStats[pilot.pilot_name].completedTotal += completed;
                        });
                    });
                });
                setPilotsData(Object.values(pilotStats));
                setFilterOptions({
                    pilotNames: Object.keys(pilotStats)
                });
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [startDate, endDate]);

    const handleFilterChange = (filterType, value) => {
        setFilters(prev => ({ ...prev, [filterType]: value }));
    };

    const filteredData = pilotsData
        .filter(item => (
            (!filters.pilotName || item.pilotName === filters.pilotName) &&
            (item.assignedSpray > 0 || item.assignedSpread > 0) // Hide rows where both assigned values are 0
        ));

    const totals = filteredData.reduce(
        (acc, item) => {
            acc.assignedSpray += item.assignedSpray;
            acc.assignedSpread += item.assignedSpread;
            acc.assignedTotal += item.assignedTotal;
            acc.completedSpray += item.completedSpray;
            acc.completedSpread += item.completedSpread;
            acc.completedTotal += item.completedTotal;
            acc.flyingTime += item.flyingTime;
            return acc;
        },
        { assignedSpray: 0, assignedSpread: 0, assignedTotal: 0, completedSpray: 0, completedSpread: 0, completedTotal: 0, flyingTime: 0 }
    );

    const exportToExcel = () => {
        const headers = [
            'Pilot',
            'Assigned (Spray)', 'Assigned (Spread)', 'Assigned (Total)',
            'Completed (Spray)', 'Completed (Spread)', 'Completed (Total)',
            'Flying Time (min)'
        ];
        const dataRows = filteredData.map(item => [
            item.pilotName,
            typeof item.assignedSpray === 'number' ? item.assignedSpray.toFixed(2) : '0.00',
            typeof item.assignedSpread === 'number' ? item.assignedSpread.toFixed(2) : '0.00',
            typeof item.assignedTotal === 'number' ? item.assignedTotal.toFixed(2) : '0.00',
            typeof item.completedSpray === 'number' ? item.completedSpray.toFixed(2) : '0.00',
            typeof item.completedSpread === 'number' ? item.completedSpread.toFixed(2) : '0.00',
            typeof item.completedTotal === 'number' ? item.completedTotal.toFixed(2) : '0.00',
            typeof item.flyingTime === 'number' ? item.flyingTime.toFixed(1) : '0.0'
        ]);
        dataRows.push([
            'Total',
            typeof totals.assignedSpray === 'number' ? totals.assignedSpray.toFixed(2) : '0.00',
            typeof totals.assignedSpread === 'number' ? totals.assignedSpread.toFixed(2) : '0.00',
            typeof totals.assignedTotal === 'number' ? totals.assignedTotal.toFixed(2) : '0.00',
            typeof totals.completedSpray === 'number' ? totals.completedSpray.toFixed(2) : '0.00',
            typeof totals.completedSpread === 'number' ? totals.completedSpread.toFixed(2) : '0.00',
            typeof totals.completedTotal === 'number' ? totals.completedTotal.toFixed(2) : '0.00',
            typeof totals.flyingTime === 'number' ? totals.flyingTime.toFixed(1) : '0.0'
        ]);
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Pilot Performance");
        const formatDate = (date) => {
            if (!date) return '';
            const d = new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        XLSX.writeFile(workbook, `Pilot_Performance_Summary_${filters.pilotName}_${formatDate(startDate)}_to_${formatDate(endDate)}.xlsx`);
    };

    const exportToPDF = () => {
        if (filteredData.length === 0) return;
        const doc = new jsPDF();
        const logo = new Image();
        logo.src = '../../assets/images/kenilowrthlogoDark.png';
        doc.addImage(logo, 'PNG', 10, 10, 30, 30);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text("Kenilworth International Lanka Pvt Ltd", 60, 25);
        doc.text("7B , D.W Rupasinghe Mawatha, Nugegoda", 60, 30);
        const bodyData = filteredData.map(item => [
            item.pilotName,
            typeof item.assignedSpray === 'number' ? item.assignedSpray.toFixed(2) : '0.00',
            typeof item.assignedSpread === 'number' ? item.assignedSpread.toFixed(2) : '0.00',
            typeof item.assignedTotal === 'number' ? item.assignedTotal.toFixed(2) : '0.00',
            typeof item.completedSpray === 'number' ? item.completedSpray.toFixed(2) : '0.00',
            typeof item.completedSpread === 'number' ? item.completedSpread.toFixed(2) : '0.00',
            typeof item.completedTotal === 'number' ? item.completedTotal.toFixed(2) : '0.00',
            typeof item.flyingTime === 'number' ? item.flyingTime.toFixed(1) : '0.0'
        ]);
        bodyData.push([
            'Total',
            typeof totals.assignedSpray === 'number' ? totals.assignedSpray.toFixed(2) : '0.00',
            typeof totals.assignedSpread === 'number' ? totals.assignedSpread.toFixed(2) : '0.00',
            typeof totals.assignedTotal === 'number' ? totals.assignedTotal.toFixed(2) : '0.00',
            typeof totals.completedSpray === 'number' ? totals.completedSpray.toFixed(2) : '0.00',
            typeof totals.completedSpread === 'number' ? totals.completedSpread.toFixed(2) : '0.00',
            typeof totals.completedTotal === 'number' ? totals.completedTotal.toFixed(2) : '0.00',
            typeof totals.flyingTime === 'number' ? totals.flyingTime.toFixed(1) : '0.0'
        ]);
        autoTable(doc, {
            startY: 40,
            head: [[
                'Pilot',
                'Assigned (Spray)', 'Assigned (Spread)', 'Assigned (Total)',
                'Completed (Spray)', 'Completed (Spread)', 'Completed (Total)',
                'Flying Time (min)'
            ]],
            body: bodyData,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255 }
        });
        doc.save('pilot_performance.pdf');
    };

    return (
        <div className="ops-container">
            <div className="report-toolbar">
                <ReportDateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onChange={(start, end) => {
                        setStartDate(start);
                        setEndDate(end);
                    }}
                    disabled={loading}
                />
                <div className="report-toolbar-actions">
                    <button
                        onClick={exportToExcel}
                        className="flex items-center bg-green-500 text-white"
                    >
                        <FiDownload className="mr-2" />
                        Excel
                    </button>
                    <button
                        onClick={exportToPDF}
                        className="flex items-center bg-red-600 text-white"
                    >
                        <FiPrinter className="mr-2" />
                        PDF
                    </button>
                </div>
            </div>

            <div className="filter-controls">
                <select onChange={(e) => handleFilterChange('pilotName', e.target.value)}>
                    <option value="">All Pilots</option>
                    {filterOptions.pilotNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            <div className="performance-table">
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                        <Bars
                            height="80"
                            width="80"
                            color="#4180B9"
                            ariaLabel="bars-loading"
                            visible={true}
                        />
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Pilot</th>
                                <th>Assigned (Spray)</th>
                                <th>Assigned (Spread)</th>
                                <th>Assigned (Total)</th>
                                <th>Completed (Spray)</th>
                                <th>Completed (Spread)</th>
                                <th>Completed (Total)</th>
                                <th>Flying Time (min)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.length > 0 ? (
                                <>
                                    {filteredData.map((item, index) => (
                                        <tr key={index}>
                                            <td>{item.pilotName}</td>
                                            <td>{typeof item.assignedSpray === 'number' ? item.assignedSpray.toFixed(2) : '0.00'}</td>
                                            <td>{typeof item.assignedSpread === 'number' ? item.assignedSpread.toFixed(2) : '0.00'}</td>
                                            <td>{typeof item.assignedTotal === 'number' ? item.assignedTotal.toFixed(2) : '0.00'}</td>
                                            <td>{typeof item.completedSpray === 'number' ? item.completedSpray.toFixed(2) : '0.00'}</td>
                                            <td>{typeof item.completedSpread === 'number' ? item.completedSpread.toFixed(2) : '0.00'}</td>
                                            <td>{typeof item.completedTotal === 'number' ? item.completedTotal.toFixed(2) : '0.00'}</td>
                                            <td>{typeof item.flyingTime === 'number' ? item.flyingTime.toFixed(1) : '0.0'}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ fontWeight: 'bold' }}>
                                        <td style={{ textAlign: 'center' }}>Total</td>
                                        <td>{typeof totals.assignedSpray === 'number' ? totals.assignedSpray.toFixed(2) : '0.00'}</td>
                                        <td>{typeof totals.assignedSpread === 'number' ? totals.assignedSpread.toFixed(2) : '0.00'}</td>
                                        <td>{typeof totals.assignedTotal === 'number' ? totals.assignedTotal.toFixed(2) : '0.00'}</td>
                                        <td>{typeof totals.completedSpray === 'number' ? totals.completedSpray.toFixed(2) : '0.00'}</td>
                                        <td>{typeof totals.completedSpread === 'number' ? totals.completedSpread.toFixed(2) : '0.00'}</td>
                                        <td>{typeof totals.completedTotal === 'number' ? totals.completedTotal.toFixed(2) : '0.00'}</td>
                                        <td>{typeof totals.flyingTime === 'number' ? totals.flyingTime.toFixed(1) : '0.0'}</td>
                                    </tr>
                                </>
                            ) : (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', color: '#ff0000' }}>
                                        No data available for the selected date range and filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default PilotSummaryPilotData;