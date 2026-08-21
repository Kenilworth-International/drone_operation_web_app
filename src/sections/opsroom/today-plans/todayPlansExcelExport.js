import * as XLSX from 'xlsx';

function safe(val) {
  if (val == null || val === '') return '';
  return val;
}

function formatPilots(pilots) {
  if (!Array.isArray(pilots) || pilots.length === 0) return '';
  return pilots
    .map((p) => {
      const name = p?.name || '';
      const mobile = p?.mobile_no ? ` (${p.mobile_no})` : '';
      return `${name}${mobile}`.trim();
    })
    .filter(Boolean)
    .join('; ');
}

function droneLabel(drone) {
  if (!drone) return '';
  if (typeof drone === 'string') return drone;
  return drone.drone_tag || drone.tag || drone.serial || '';
}

function writeWorkbook(sheets, filename) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const data = rows && rows.length ? rows : [{ Note: 'No data' }];
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, String(name).slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
}

/**
 * Excel for the selected day (all plantations + missions on Today Plans).
 */
export function downloadTodayPlansDayExcel({ date, plans = [], missions = [], summary = {} }) {
  const summaryRows = [
    { Metric: 'Date', Value: date || '' },
    { Metric: 'Total Plantations', Value: summary.total_plans ?? plans.length },
    { Metric: 'Assigned Plantations', Value: summary.assigned_plans ?? '' },
    { Metric: 'Unassigned Plantations', Value: summary.unassigned_plans ?? '' },
    { Metric: 'Total Non Plantation', Value: summary.total_missions ?? missions.length },
    { Metric: 'Assigned Non Plantation', Value: summary.assigned_missions ?? '' },
    { Metric: 'Unassigned Non Plantation', Value: summary.unassigned_missions ?? '' },
  ];

  const planRows = plans.map((p) => ({
    Type: 'Plantation',
    ID: p.id,
    Estate: safe(p.estate_name),
    Extent_ha: p.totalExtent ?? p.plan_active_ha ?? '',
    Manager_Approval: p.manager_approval === 1 ? 'Approved' : 'Pending',
    Assigned: p.is_assigned === 1 ? 'Yes' : 'No',
    Team: safe(p.team_name),
    Pilots: formatPilots(p.pilots),
    Drone: droneLabel(p.drone),
    Status: safe(p.status),
    Fields_Count: Array.isArray(p.fields) ? p.fields.length : '',
  }));

  const missionRows = missions.map((m) => ({
    Type: 'Non Plantation',
    ID: m.id,
    Farmer: safe(m.farmer_name),
    GND: safe(m.gnd_name || m.gnd),
    Extent_ha: m.total_land_extent ?? '',
    Payment: m.payments === 1 ? 'Paid' : 'Not Paid',
    Assigned: m.is_assigned === 1 ? 'Yes' : 'No',
    Team: safe(m.team_name),
    Pilots: formatPilots(m.pilots),
    Drone: droneLabel(m.drone),
    Status: safe(m.status),
  }));

  const fieldRows = [];
  plans.forEach((p) => {
    (p.fields || []).forEach((f) => {
      fieldRows.push({
        Plan_ID: p.id,
        Estate: safe(p.estate_name),
        Field: safe(f.field_name || f.field),
        Task_ID: f.id,
        Pre_Check: f.pre_check_list === 1 ? 'Done' : 'Not yet',
        Start_Time: safe(f.start_time),
        Field_Size_ha: f.field_size_ha ?? '',
        Waypoint_ha: f.waypoint_area_ha ?? '',
        Pilot_Area_ha: f.pilot_field_area_ha ?? '',
        DJI_Area_ha: f.dji_field_area_ha ?? '',
        Water_Received: f.water_received === 1 ? 'Yes' : 'No',
        Water_Time: safe(f.water_received_time),
        Chemical_Received: f.chemical_received === 1 ? 'Yes' : 'No',
        Chemical_Time: safe(f.chemical_received_time),
        Final_Status: safe(f.final_status || f.status),
        Cancel_Reason: safe(f.cancel_reason),
        Partial_Reason: safe(f.remaining_reason),
      });
    });
  });

  writeWorkbook(
    [
      { name: 'Summary', rows: summaryRows },
      { name: 'Plantations', rows: planRows },
      { name: 'Non Plantation', rows: missionRows },
      { name: 'Fields', rows: fieldRows },
    ],
    `Today_Plans_${date || 'day'}.xlsx`
  );
}

/**
 * Excel for one opened plan/mission full-detail drawer.
 */
export function downloadPlanFullDetailExcel(detail) {
  if (!detail || detail.status === false) return;

  const kind = detail.kind || 'plan';
  const header = kind === 'mission' ? detail.mission : detail.plan;
  const id = header?.id || '';
  const date = header?.picked_date || header?.planned_date || '';
  const namePart =
    kind === 'mission'
      ? String(header?.farmer_name || `Mission_${id}`).replace(/\s+/g, '_')
      : String(header?.estate_name || `Plan_${id}`).replace(/\s+/g, '_');

  const overviewRows =
    kind === 'mission'
      ? [
          { Field: 'Kind', Value: 'Non Plantation' },
          { Field: 'Mission ID', Value: id },
          { Field: 'Farmer', Value: safe(header?.farmer_name) },
          { Field: 'Telephone', Value: safe(header?.farmer_telephone) },
          { Field: 'GND', Value: safe(header?.gnd) },
          { Field: 'Planned Date', Value: date },
          { Field: 'Extent (ha)', Value: header?.total_land_extent ?? '' },
          { Field: 'Payment', Value: Number(header?.payments) === 1 ? 'Paid' : 'Pending' },
          { Field: 'Team', Value: safe(header?.team_name) },
          { Field: 'Assigned', Value: header?.team_assigned === 1 ? 'Yes' : 'No' },
          { Field: 'Status', Value: safe(header?.status) },
          { Field: 'Created At', Value: safe(header?.created_at) },
        ]
      : [
          { Field: 'Kind', Value: 'Plantation' },
          { Field: 'Plan ID', Value: id },
          { Field: 'Estate', Value: safe(header?.estate_name) },
          { Field: 'Planned Date', Value: date },
          { Field: 'Active Extent (ha)', Value: header?.plan_active_ha ?? '' },
          { Field: 'Fields Count', Value: header?.plan_active_fields_count ?? '' },
          { Field: 'Team', Value: safe(header?.team_name) },
          { Field: 'Assigned', Value: header?.team_assigned === 1 ? 'Yes' : 'No' },
          { Field: 'Status', Value: safe(header?.status) },
          { Field: 'Creator', Value: safe(header?.creator_name) },
          { Field: 'Created At', Value: safe(header?.created_at) },
          { Field: 'Ops Operator', Value: safe(header?.operator_name) },
          { Field: 'Operator Date', Value: safe(header?.operator_date) },
          {
            Field: 'Manager Approval',
            Value: detail.manager?.cancel_reason_id
              ? 'Canceled'
              : detail.manager?.approval === 1
                ? 'Approved'
                : 'Pending',
          },
          { Field: 'Approved By', Value: safe(detail.manager?.approval_user_name) },
          { Field: 'Approved At', Value: safe(detail.manager?.approval_time) },
          { Field: 'Manager Cancel Reason', Value: safe(detail.manager?.cancel_reason) },
        ];

  const resourceRows = [
    {
      Assignment_ID: safe(detail.resources?.assignment?.assignment_id),
      Assigned_At: safe(detail.resources?.assignment?.created_at),
      Team: safe(detail.resources?.assignment?.team_name || header?.team_name),
      Pilots: formatPilots(detail.resources?.pilots),
      Drones: (detail.resources?.drones || [])
        .map((d) => d.tag || d.serial || d.id)
        .filter(Boolean)
        .join('; '),
      Vehicle: safe(detail.transport?.vehicle_no),
      Driver: safe(detail.transport?.driver_name),
      Driver_Mobile: safe(detail.transport?.driver_mobile),
      Driver_Arrival: safe(detail.transport?.driver_arrival_time),
    },
  ];

  const chemicalRows = (detail.chemicals?.chemical_lines || []).map((c) => ({
    Chemical: safe(c.chemical_name || c.chemical_id),
    Quantity: c.quantity ?? '',
    Time_of_Day: safe(detail.chemicals?.time_of_day_label),
  }));

  const fieldRows = (detail.fields || []).map((f) => ({
    Task_ID: f.task_id,
    Field: safe(f.field_name),
    Pilot: safe(f.pilot_name),
    Acknowledge: safe(f.condition_check),
    Acknowledge_Time: safe(f.condition_check_time),
    Start_Time: safe(f.start_time),
    Start_Lat: f.start_latitude ?? '',
    Start_Lng: f.start_longitude ?? '',
    Water_Received: f.water_received ? 'Yes' : 'No',
    Water_Time: safe(f.water_received_time),
    Chemical_Received: f.chemical_received ? 'Yes' : 'No',
    Chemical_Time: safe(f.chemical_received_time),
    Field_Size_ha: f.field_size_ha ?? '',
    Waypoint_ha: f.waypoint_area_ha ?? '',
    Pilot_Area_ha: f.pilot_field_area_ha ?? '',
    DJI_Area_ha: f.dji_field_area_ha ?? '',
    Final_Status: safe(f.final_status || f.status),
    Cancel_Reason: safe(f.cancel_reason),
    Partial_Reason: safe(f.remaining_reason),
    Ops_Reason: safe(f.ops_reason),
  }));

  const timelineRows = (detail.timeline || []).map((ev) => ({
    Timestamp: safe(ev.at),
    Type: safe(ev.type),
    Label: safe(ev.label),
    By: safe(ev.meta?.by),
    Reason: safe(ev.meta?.reason),
    Team: safe(ev.meta?.team),
    Vehicle: safe(ev.meta?.vehicle_no),
    Driver: safe(ev.meta?.driver_name),
  }));

  writeWorkbook(
    [
      { name: 'Overview', rows: overviewRows },
      { name: 'Resources_Transport', rows: resourceRows },
      { name: 'Chemicals', rows: chemicalRows },
      { name: 'Fields_Tasks', rows: fieldRows },
      { name: 'Timeline', rows: timelineRows },
    ],
    `Plan_Detail_${kind}_${id}_${namePart}_${date || 'na'}.xlsx`
  );
}
