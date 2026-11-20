import React, { useState, useEffect, useMemo } from "react";
import '../../../styles/ops2.css';
import { baseApi } from '../../../api/services/allEndpoints';
import { useAppDispatch } from '../../../store/hooks';
import DatePicker from 'react-datepicker';
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { Bars } from "react-loader-spinner";
import { FiDownload, FiPrinter } from "react-icons/fi";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useOpsReportWorkspace } from '../../management/reports/OpsReportWorkspaceContext';
import OpsReportViewToggle from '../../management/reports/OpsReportViewToggle';
import { OpsDateRangeControls } from '../../management/reports/OpsPeriodControls';
import '../../management/reports/reportsDecisionShell.css';

const OperationsReportPlanWise = ({ onExportReady }) => {
    const dispatch = useAppDispatch();
    const workspace = useOpsReportWorkspace();
    const [plantations, setPlantations] = useState([]);
    const [selectedPlantation, setSelectedPlantation] = useState(null);
    const [estates, setEstates] = useState([]);
    const [selectedEstates, setSelectedEstates] = useState([]);
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const [searchTerm, setSearchTerm] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [startDate, setStartDate] = useState(firstDayOfMonth);
    const [endDate, setEndDate] = useState(today);
    const [view, setView] = useState('chart');
    const [reportData, setReportData] = useState([]);

    // Keep selectedDates alias for export filenames / legacy paths
    const selectedDates = [startDate, endDate];

    useEffect(() => {
        const fetchPlantations = async () => {
            try {
                setLoading(true);
                const result = await dispatch(baseApi.endpoints.getPlantationsList.initiate());
                const data = result.data?.data || [];
                setPlantations(data);
                setError(null);
            } catch (err) {
                setError("Failed to load plantations");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchPlantations();
    }, [dispatch]);

    useEffect(() => {
        const fetchEstates = async () => {
            if (selectedPlantation) {
                try {
                    setLoading(true);
                    const result = await dispatch(baseApi.endpoints.getEstatesList.initiate(selectedPlantation));
                    const data = result.data?.data || [];
                    setEstates(data);
                    setSelectedEstates([]);
                    setError(null);
                } catch (err) {
                    setError("Failed to load estates");
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchEstates();
    }, [dispatch, selectedPlantation]);

    useEffect(() => {
        const fetchReportData = async () => {
            if (selectedPlantation && selectedEstates.length > 0 && startDate && endDate) {
                try {
                    setLoading(true);
                    const start = startDate.toLocaleDateString('en-CA');
                    const end = endDate.toLocaleDateString('en-CA');
                    const estateIds = selectedEstates.map(id => Number(id));

                    const result = await dispatch(baseApi.endpoints.getFinanceReport.initiate({
                        startDate: start,
                        endDate: end,
                        estates: estateIds
                    }));
                    const response = result.data;
                    const processedData = [];
                    const planMap = new Map();

                    const allEstates = Object.values(response || {})
                        .filter(item => item.estate_id);

                    allEstates.forEach(estate => {
                        estate.plans.forEach(plan => {
                            const planKey = `${estate.estate_id}-${plan.plan_id}-${plan.plan_date}`;

                            if (!planMap.has(planKey)) {
                                planMap.set(planKey, {
                                    date: plan.plan_date,
                                    planId: plan.plan_id,
                                    estateId: estate.estate_id,
                                    estateName: estate.estate,
                                    planType: plan.plan_type.toUpperCase(),
                                    totalHa: plan.planned_ha,
                                    completed: 0,
                                    managerCanceled: 0,
                                    teamLeadCanceled: 0,
                                    rescheduledHa: plan.total_rechedule_extent
                                });
                            }
                            const planEntry = planMap.get(planKey);

                            plan.fields.forEach(field => {
                                if (field.manager_status === 0) {
                                    planEntry.managerCanceled += field.field_extent;
                                } else {
                                    let completed = 0;
                                    if (Array.isArray(field.task) && field.task.length > 0) {
                                        completed = field.task.reduce((sum, t) => sum + (Number(t.dji_field_area) || 0), 0);
                                    }
                                    planEntry.completed += completed;

                                    if (field.status_team_lead === 'x') {
                                        planEntry.teamLeadCanceled += field.field_extent;
                                    }
                                }
                            });
                        });
                    });

                    planMap.forEach(plan => {
                        const incomplete = plan.totalHa - (plan.rescheduledHa + plan.completed + plan.managerCanceled);
                        processedData.push({
                            ...plan,
                            estateName: plan.estateName,
                            planDetails: `${plan.totalHa.toFixed(2)} Ha (${plan.planType})`,
                            incomplete: incomplete
                        });
                    });

                    setReportData(processedData);
                } catch (err) {
                    setError("Failed to load report data");
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            } else {
                setReportData([]);
            }
        };
        fetchReportData();
    }, [dispatch, selectedEstates, startDate, endDate, selectedPlantation]);

    const totals = useMemo(() => {
        const t = {
            totalHa: 0,
            rescheduledHa: 0,
            completed: 0,
            managerCanceled: 0,
            teamLeadCanceled: 0,
            incomplete: 0
        };
        reportData.forEach(row => {
            t.totalHa += row.totalHa;
            t.rescheduledHa += row.rescheduledHa;
            t.completed += row.completed;
            t.managerCanceled += row.managerCanceled;
            t.teamLeadCanceled += row.teamLeadCanceled;
            t.incomplete += row.incomplete;
        });
        return t;
    }, [reportData]);

    const chartData = useMemo(() => {
        const byDate = new Map();
        reportData.forEach((row) => {
            const key = String(row.date || '').slice(0, 10) || 'Unknown';
            if (!byDate.has(key)) {
                byDate.set(key, { name: key, assigned: 0, completed: 0, incomplete: 0, canceled: 0 });
            }
            const b = byDate.get(key);
            b.assigned += Number(row.totalHa) || 0;
            b.completed += Number(row.completed) || 0;
            b.incomplete += Number(row.incomplete) || 0;
            b.canceled += (Number(row.managerCanceled) || 0) + (Number(row.teamLeadCanceled) || 0);
        });
        return Array.from(byDate.values())
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((r) => ({
                ...r,
                assigned: Number(r.assigned.toFixed(2)),
                completed: Number(r.completed.toFixed(2)),
                incomplete: Number(r.incomplete.toFixed(2)),
                canceled: Number(r.canceled.toFixed(2)),
            }));
    }, [reportData]);

    const estateChartData = useMemo(() => {
        const byEstate = new Map();
        reportData.forEach((row) => {
            const key = row.estateName || 'Unknown';
            if (!byEstate.has(key)) {
                byEstate.set(key, { name: key, assigned: 0, completed: 0 });
            }
            const b = byEstate.get(key);
            b.assigned += Number(row.totalHa) || 0;
            b.completed += Number(row.completed) || 0;
        });
        return Array.from(byEstate.values())
            .sort((a, b) => b.assigned - a.assigned)
            .slice(0, 12)
            .map((r) => ({
                ...r,
                assigned: Number(r.assigned.toFixed(2)),
                completed: Number(r.completed.toFixed(2)),
            }));
    }, [reportData]);

    const handlePlantationChange = (event) => {
        setSearchTerm(event.target.value);
        setDropdownOpen(true);
    };

    const handlePlantationSelect = (id) => {
        const selected = plantations.find(p => p.id === id);
        if (!selected) return;

        setSelectedPlantation(id);
        setSearchTerm(selected.plantation);
        setDropdownOpen(false);
    };

    const handleClearSelection = () => {
        setSelectedPlantation(null);
        setSearchTerm("");
        setEstates([]);
        setSelectedEstates([]);
    };

    const handleCheckboxChange = (estateId) => {
        setSelectedEstates(prev =>
            prev.includes(estateId)
                ? prev.filter(id => id !== estateId)
                : [...prev, estateId]
        );
    };

    const handleSelectAll = () => {
        setSelectedEstates(prev =>
            prev.length === estates.length
                ? []
                : estates.map(estate => estate.id)
        );
    };

    const filteredPlantations = useMemo(
        () =>
            plantations.filter((p) =>
                p.plantation.toLowerCase().includes(searchTerm.toLowerCase())
            ),
        [plantations, searchTerm]
    );

    const handleDateChange = (dates) => {
        const [start, end] = dates;
        if (start) setStartDate(start);
        if (end) setEndDate(end);
        if (start && end) {
            setIsCalendarOpen(false);
        }
    };

    const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const exportToExcel = () => {
        const headers = [
            'Date',
            'Plan ID',
            'Estate',
            'Total (Plan Type)',
            'Rescheduled (Ha)',
            'Completed Area (Ha)',
            'Manager Canceled (Ha)',
            'Team Lead Canceled (Ha)',
            'Incomplete (Ha)'
        ];

        const dataRows = reportData.map(row => ({
            Date: row.date,
            'Plan ID': row.planId,
            Estate: row.estateName,
            'Total (Plan Type)': row.planDetails,
            'Rescheduled (Ha)': typeof row.rescheduledHa === 'number' ? row.rescheduledHa.toFixed(2) : '0.00',
            'Completed Area (Ha)': typeof row.completed === 'number' ? row.completed.toFixed(2) : '0.00',
            'Manager Canceled (Ha)': typeof row.managerCanceled === 'number' ? row.managerCanceled.toFixed(2) : '0.00',
            'Team Lead Canceled (Ha)': typeof row.teamLeadCanceled === 'number' ? row.teamLeadCanceled.toFixed(2) : '0.00',
            'Incomplete (Ha)': typeof row.incomplete === 'number' ? row.incomplete.toFixed(2) : '0.00'
        }));

        dataRows.push({
            Date: 'Total',
            'Plan ID': '',
            Estate: '',
            'Total (Plan Type)': typeof totals.totalHa === 'number' ? totals.totalHa.toFixed(2) : '0.00',
            'Rescheduled (Ha)': typeof totals.rescheduledHa === 'number' ? totals.rescheduledHa.toFixed(2) : '0.00',
            'Completed Area (Ha)': typeof totals.completed === 'number' ? totals.completed.toFixed(2) : '0.00',
            'Manager Canceled (Ha)': typeof totals.managerCanceled === 'number' ? totals.managerCanceled.toFixed(2) : '0.00',
            'Team Lead Canceled (Ha)': typeof totals.teamLeadCanceled === 'number' ? totals.teamLeadCanceled.toFixed(2) : '0.00',
            'Incomplete (Ha)': typeof totals.incomplete === 'number' ? totals.incomplete.toFixed(2) : '0.00'
        });

        const worksheet = XLSX.utils.json_to_sheet(dataRows, { header: headers });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
        const selectedEstateNames = estates
            .filter(e => selectedEstates.includes(e.id))
            .map(e => e.estate.replace(/\s+/g, '_'))
            .join('_') || 'All_Estates';
        XLSX.writeFile(workbook, `Operations_Report_Plan_Wise_${selectedEstateNames}_${formatDate(selectedDates[0])}_to_${formatDate(selectedDates[1])}.xlsx`);
    };

    const exportPdf = () => {
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text("Operations Report (Plan wise)", 14, 15);
        doc.setFontSize(10);

        const body = reportData.map(row => [
            row.date,
            row.planId,
            row.estateName,
            row.planDetails,
            typeof row.rescheduledHa === 'number' ? row.rescheduledHa.toFixed(2) : '0.00',
            typeof row.completed === 'number' ? row.completed.toFixed(2) : '0.00',
            typeof row.managerCanceled === 'number' ? row.managerCanceled.toFixed(2) : '0.00',
            typeof row.teamLeadCanceled === 'number' ? row.teamLeadCanceled.toFixed(2) : '0.00',
            typeof row.incomplete === 'number' ? row.incomplete.toFixed(2) : '0.00'
        ]);

        body.push([
            'Total',
            '',
            '',
            typeof totals.totalHa === 'number' ? totals.totalHa.toFixed(2) : '0.00',
            typeof totals.rescheduledHa === 'number' ? totals.rescheduledHa.toFixed(2) : '0.00',
            typeof totals.completed === 'number' ? totals.completed.toFixed(2) : '0.00',
            typeof totals.managerCanceled === 'number' ? totals.managerCanceled.toFixed(2) : '0.00',
            typeof totals.teamLeadCanceled === 'number' ? totals.teamLeadCanceled.toFixed(2) : '0.00',
            typeof totals.incomplete === 'number' ? totals.incomplete.toFixed(2) : '0.00'
        ]);

        autoTable(doc, {
            startY: 25,
            head: [
                ['Date', 'Plan ID', 'Estate', 'Ha (Plan Type)', 'Rescheduled', 'Completed', 'Manager', 'Team Lead', 'Incomplete']
            ],
            body: body,
            theme: 'grid',
            styles: {
                fontSize: 8,
                cellPadding: 1.5,
                halign: 'center'
            },
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
                fontStyle: 'bold'
            },
            columnStyles: {
                0: { cellWidth: 15, halign: 'left' },
                1: { cellWidth: 20, halign: 'left' },
                2: { cellWidth: 30 },
                3: { cellWidth: 25 },
                4: { cellWidth: 25 },
                5: { cellWidth: 25 },
                6: { cellWidth: 25 },
                7: { cellWidth: 25 },
                8: { cellWidth: 25 }
            },
            didParseCell: (data) => {
                if (data.row.index === body.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                }
            },
            willDrawCell: (data) => {
                if (data.row.index === body.length - 1) {
                    doc.setFillColor(240, 240, 240);
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                }
            }
        });

        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(
                `Page ${i} of ${pageCount}`,
                doc.internal.pageSize.width - 25,
                doc.internal.pageSize.height - 5
            );
        }

        const selectedEstateNames = estates
            .filter(e => selectedEstates.includes(e.id))
            .map(e => e.estate.replace(/\s+/g, '_'))
            .join('_') || 'All_Estates';
        doc.save(`Operations_Report_Plan_Wise_${selectedEstateNames}_${formatDate(selectedDates[0])}_to_${formatDate(selectedDates[1])}.pdf`);
    };

    useEffect(() => {
        onExportReady?.(exportToExcel);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportData, startDate, endDate, selectedEstates, totals]);

    useEffect(() => {
        if (!workspace?.setSidebar) return undefined;
        workspace.setSidebar(
            <div className="rds-ops-controls">
                <OpsDateRangeControls
                    startDate={startDate}
                    endDate={endDate}
                    onStartChange={setStartDate}
                    onEndChange={setEndDate}
                />
                <OpsReportViewToggle view={view} onChange={setView} />
                <div className="rds-ops-controls-block">
                    <div className="rds-ops-controls-label">Plantation</div>
                    <label className="rds-ops-field">
                        <span>Search</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={handlePlantationChange}
                            onFocus={() => setDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                            placeholder="Type plantation…"
                        />
                    </label>
                    {dropdownOpen && (
                        <div className="rds-ops-controls-block" style={{ maxHeight: 140, overflow: 'auto' }}>
                            {filteredPlantations.length === 0 ? (
                                <div className="rds-empty" style={{ padding: 8 }}>No matches</div>
                            ) : (
                                filteredPlantations.map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        className={`rds-ops-view-btn${selectedPlantation === p.id ? ' is-active' : ''}`}
                                        style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => handlePlantationSelect(p.id)}
                                    >
                                        {p.plantation}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                    {selectedPlantation && (
                        <button type="button" className="rds-ops-view-btn" onClick={handleClearSelection}>
                            Clear plantation
                        </button>
                    )}
                </div>
                {estates.length > 0 && (
                    <div className="rds-ops-controls-block">
                        <div className="rds-ops-controls-label">Estates</div>
                        <label className="rds-ops-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <input
                                type="checkbox"
                                checked={selectedEstates.length === estates.length && estates.length > 0}
                                onChange={handleSelectAll}
                            />
                            <span>Select all</span>
                        </label>
                        <div style={{ maxHeight: 220, overflow: 'auto' }}>
                            {estates.map((estate) => (
                                <label
                                    key={estate.id}
                                    className="rds-ops-field"
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedEstates.includes(estate.id)}
                                        onChange={() => handleCheckboxChange(estate.id)}
                                    />
                                    <span>{estate.estate}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
        return () => workspace.clearSidebar?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        workspace?.setSidebar,
        startDate,
        endDate,
        view,
        searchTerm,
        dropdownOpen,
        selectedPlantation,
        estates,
        selectedEstates,
        filteredPlantations,
    ]);

    const tableContent = (
        <>
            {error ? (
                <div className={workspace ? 'rds-empty' : 'error-message'}>{error}</div>
            ) : reportData.length > 0 ? (
                <div className={workspace ? 'rds-table-wrap' : 'table-container'}>
                    <table className={workspace ? 'rds-table' : 'report-table'}>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Plan ID</th>
                                <th>Estate (AP/NP/RP)</th>
                                <th>Total Ha (Plan Type)</th>
                                <th>Rescheduled (Ha)</th>
                                <th>Completed (Ha)</th>
                                <th>Manager Canceled (Ha)</th>
                                <th>Team Lead Canceled (Ha)</th>
                                <th>Incomplete (Ha)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.map((row, index) => (
                                <tr key={index}>
                                    <td>{row.date}</td>
                                    <td>{row.planId}</td>
                                    <td>{row.estateName}</td>
                                    <td>{row.planDetails}</td>
                                    <td className={workspace ? 'num' : undefined}>{typeof row.rescheduledHa === 'number' ? row.rescheduledHa.toFixed(2) : '0.00'}</td>
                                    <td className={workspace ? 'num' : undefined}>{typeof row.completed === 'number' ? row.completed.toFixed(2) : '0.00'}</td>
                                    <td className={workspace ? 'num' : undefined}>{typeof row.managerCanceled === 'number' ? row.managerCanceled.toFixed(2) : '0.00'}</td>
                                    <td className={workspace ? 'num' : undefined}>{typeof row.teamLeadCanceled === 'number' ? row.teamLeadCanceled.toFixed(2) : '0.00'}</td>
                                    <td className={workspace ? 'num' : undefined}>{typeof row.incomplete === 'number' ? row.incomplete.toFixed(2) : '0.00'}</td>
                                </tr>
                            ))}
                            <tr className={workspace ? undefined : 'total-row'}>
                                <td colSpan="3">Total</td>
                                <td className={workspace ? 'num' : undefined}>{typeof totals.totalHa === 'number' ? totals.totalHa.toFixed(2) : '0.00'}</td>
                                <td className={workspace ? 'num' : undefined}>{typeof totals.rescheduledHa === 'number' ? totals.rescheduledHa.toFixed(2) : '0.00'}</td>
                                <td className={workspace ? 'num' : undefined}>{typeof totals.completed === 'number' ? totals.completed.toFixed(2) : '0.00'}</td>
                                <td className={workspace ? 'num' : undefined}>{typeof totals.managerCanceled === 'number' ? totals.managerCanceled.toFixed(2) : '0.00'}</td>
                                <td className={workspace ? 'num' : undefined}>{typeof totals.teamLeadCanceled === 'number' ? totals.teamLeadCanceled.toFixed(2) : '0.00'}</td>
                                <td className={workspace ? 'num' : undefined}>{typeof totals.incomplete === 'number' ? totals.incomplete.toFixed(2) : '0.00'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className={workspace ? 'rds-empty' : undefined} style={workspace ? undefined : { textAlign: 'center', padding: '20px', color: '#ff0000' }}>
                    {!selectedPlantation || selectedEstates.length === 0
                        ? 'Select a plantation and estates to load the report.'
                        : 'No data available for the selected date range and filters.'}
                </div>
            )}
        </>
    );

    const chartContent =
        chartData.length > 0 || estateChartData.length > 0 ? (
            <div className="rds-ops-data">
                <div className="rds-metric-strip">
                    <div className="rds-metric-strip-item">
                        <div className="rds-metric-strip-lbl">Assigned</div>
                        <div className="rds-metric-strip-val">{totals.totalHa.toFixed(1)}</div>
                    </div>
                    <div className="rds-metric-strip-item">
                        <div className="rds-metric-strip-lbl">Completed</div>
                        <div className="rds-metric-strip-val">{totals.completed.toFixed(1)}</div>
                    </div>
                    <div className="rds-metric-strip-item">
                        <div className="rds-metric-strip-lbl">Incomplete</div>
                        <div className="rds-metric-strip-val">{totals.incomplete.toFixed(1)}</div>
                    </div>
                    <div className="rds-metric-strip-item">
                        <div className="rds-metric-strip-lbl">Plans</div>
                        <div className="rds-metric-strip-val">{reportData.length}</div>
                    </div>
                </div>
                {chartData.length > 0 && (
                    <div className="rds-chart-bleed">
                        <div className="rds-chart-bleed-title">Daily assigned vs completed</div>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                                <CartesianGrid strokeDasharray="3 6" stroke="#c9d9d2" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="assigned" name="Assigned" fill="#94a3b8" />
                                <Bar dataKey="completed" name="Completed" fill="#0f6b4c" />
                                <Bar dataKey="incomplete" name="Incomplete" fill="#f59e0b" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
                {estateChartData.length > 0 && (
                    <div className="rds-chart-bleed">
                        <div className="rds-chart-bleed-title">By estate · assigned vs completed</div>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={estateChartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                                <CartesianGrid strokeDasharray="3 6" stroke="#c9d9d2" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={56} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="assigned" name="Assigned" fill="#94a3b8" />
                                <Bar dataKey="completed" name="Completed" fill="#34d399" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        ) : (
            <div className="rds-empty">
                {!selectedPlantation || selectedEstates.length === 0
                    ? 'Select a plantation and estates in the left rail to load the chart.'
                    : 'No chart data for this period.'}
            </div>
        );

    if (workspace) {
        if (loading && reportData.length === 0 && selectedEstates.length > 0) {
            return (
                <div className="rds-loading">
                    <Bars height={40} width={40} color="#0f6b4c" />
                </div>
            );
        }
        return (
            <div className="rds-ops-data">
                {view === 'chart' ? chartContent : tableContent}
            </div>
        );
    }

    return (
        <div className="ops">
            <div className="top-ops-part">
                <div className="plantationpicker-ops">
                    <label htmlFor="ops-plantation-search">Select Plantation:</label>
                    <input
                        id="plantation-search"
                        type="text"
                        value={searchTerm}
                        onChange={handlePlantationChange}
                        placeholder="Type to search plantation..."
                        onFocus={() => setDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                        className="search-input"
                        aria-expanded={dropdownOpen}
                        aria-haspopup="listbox"
                    />
                    {searchTerm && (
                        <button
                            className="ops-clear-button"
                            onClick={handleClearSelection}
                            aria-label="Clear selection"
                        >
                            x
                        </button>
                    )}
                </div>

                <div className="daterangepicker-ops">
                    <p className="select-date-text text-ops" onClick={() => setIsCalendarOpen(!isCalendarOpen)}>
                        Select Date
                    </p>
                    <p className="date-range" onClick={() => setIsCalendarOpen(!isCalendarOpen)}>
                        {startDate.toLocaleDateString()} - {endDate?.toLocaleDateString()}
                    </p>
                    {isCalendarOpen && (
                        <div className="react-date-picker-ops">
                            <DatePicker
                                selected={startDate}
                                onChange={handleDateChange}
                                startDate={startDate}
                                endDate={endDate}
                                selectsRange
                                inline
                            />
                        </div>
                    )}
                </div>
                {dropdownOpen && (
                    <div
                        className="ops-dropdown-list"
                        role="listbox"
                        aria-labelledby="plantation-search"
                    >
                        {filteredPlantations.length === 0 ? (
                            <div className="ops-no-results">No matching plantations found</div>
                        ) : (
                            filteredPlantations.map((p) => (
                                <div
                                    key={p.id}
                                    role="option"
                                    aria-selected={selectedPlantation === p.id}
                                    onClick={() => handlePlantationSelect(p.id)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="dropdown-item"
                                >
                                    {p.plantation}
                                </div>
                            ))
                        )}
                    </div>
                )}
                <button
                    onClick={exportToExcel}
                    className="flex items-center bg-green-500 text-white"
                >
                    <FiDownload className="mr-2" />
                    Excel
                </button>
                <button
                    onClick={exportPdf}
                    className="flex items-center bg-red-600 text-white"
                >
                    <FiPrinter className="mr-2" />
                    PDF
                </button>
            </div>
            {startDate && endDate && selectedPlantation && (
                <div className="bottom-ops-part">
                    <div className="bottom-ops-part-left">
                        {estates.length > 0 && (
                            <div className="ops-checkbox-group" role="group" aria-labelledby="estate-selection">
                                <div className="select-all-container">
                                    <input
                                        type="checkbox"
                                        id="select-all"
                                        checked={selectedEstates.length === estates.length}
                                        onChange={handleSelectAll}
                                        aria-label={selectedEstates.length === estates.length ?
                                            "Unselect all estates" : "Select all estates"}
                                    />
                                    <label htmlFor="select-all">Select All</label>
                                </div>

                                <div className="ops-estates-list">
                                    {estates.map((estate) => (
                                        <div key={estate.id} className="estate-item-ops2">
                                            <input
                                                type="checkbox"
                                                id={`estate-${estate.id}`}
                                                checked={selectedEstates.includes(estate.id)}
                                                onChange={() => handleCheckboxChange(estate.id)}
                                            />
                                            <label htmlFor={`estate-${estate.id}`}>
                                                {estate.estate}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bottom-ops-part-right">
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
                            <div className="report-container">
                                {tableContent}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OperationsReportPlanWise;
