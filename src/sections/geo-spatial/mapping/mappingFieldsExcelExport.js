import * as XLSX from 'xlsx';

function formatHa(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return (Math.round(n * 100) / 100).toString();
}

function formatYesNo(value) {
  return Number(value) === 1 ? 'Yes' : 'No';
}

function resolveBlockReason(field, type, missionReasons) {
  const nameKey = type === 'spread' ? 'spread_reason_name' : 'spray_reason_name';
  if (field[nameKey]) return field[nameKey];

  const canKey = type === 'spread' ? 'can_spread' : 'can_spray';
  const textKey = type === 'spread' ? 'can_spread_text' : 'can_spray_text';
  if (Number(field[canKey]) !== 0 || !field[textKey]) return '';

  return missionReasons.find((r) => String(r.id) === String(field[textKey]))?.reason || '';
}

function buildDjiAreaRange(field) {
  const minArea = formatHa(field.ops_min_dji_area_1y);
  const maxArea = formatHa(field.ops_max_dji_area_1y);
  if (!minArea && !maxArea) return '';
  if (minArea && maxArea) return `${minArea} – ${maxArea} Ha`;
  return minArea ? `${minArea} Ha` : `${maxArea} Ha`;
}

export function buildFieldExcelDetailRows(fields, missionReasons = [], { includeHierarchy = true, hierarchyFallback = {} } = {}) {
  return fields.map((field) => {
    const row = {};

    if (includeHierarchy) {
      row['Group'] = field.group_name || hierarchyFallback.group || '';
      row['Plantation'] = field.plantation_name || hierarchyFallback.plantation || '';
      row['Region'] = field.region_name || hierarchyFallback.region || '';
      row['Estate'] = field.estate_name || hierarchyFallback.estate || '';
      row['Division'] = field.division_name || hierarchyFallback.division || '';
    }

    row['Field ID'] = field.id ?? '';
    row['Field Name'] = field.field || '';
    row['Short Name'] = field.short_name || '';
    row['Area (Ha)'] = formatHa(field.area);
    row['Area Mapping (Ha)'] = formatHa(field.area_mapping);
    row['Area Original (Ha)'] = formatHa(field.area_original);
    row['Latitude'] = field.latitude || '';
    row['Longitude'] = field.longitude || '';
    row['Status'] = field.activated ? 'Active' : 'Inactive';
    row['Can Spread'] = formatYesNo(field.can_spread);
    row['Spread Block Reason'] = resolveBlockReason(field, 'spread', missionReasons);
    row['Can Spray'] = formatYesNo(field.can_spray);
    row['Spray Block Reason'] = resolveBlockReason(field, 'spray', missionReasons);
    row['Spray/Spread Missions (1Y)'] = Number(field.ops_missions_1y) || 0;
    row['Min DJI Area (1Y Ha)'] = formatHa(field.ops_min_dji_area_1y);
    row['Max DJI Area (1Y Ha)'] = formatHa(field.ops_max_dji_area_1y);
    row['DJI Area Range (1Y)'] = buildDjiAreaRange(field);

    return row;
  });
}

function buildSummarySheet({
  title,
  hierarchy = {},
  fields,
  searchTerm = '',
}) {
  const activeCount = fields.filter((f) => f.activated).length;
  const inactiveCount = fields.length - activeCount;
  const canSpreadCount = fields.filter((f) => Number(f.can_spread) === 1).length;
  const canSprayCount = fields.filter((f) => Number(f.can_spray) === 1).length;
  const totalMissions1y = fields.reduce((sum, f) => sum + (Number(f.ops_missions_1y) || 0), 0);
  const fieldsWithDji1y = fields.filter(
    (f) => f.ops_min_dji_area_1y != null || f.ops_max_dji_area_1y != null
  ).length;

  const rows = [
    [title],
    ['Exported', new Date().toLocaleString()],
    [],
    ['Hierarchy'],
    ['Group', hierarchy.group || '—'],
    ['Plantation', hierarchy.plantation || '—'],
    ['Region', hierarchy.region || '—'],
    ['Estate', hierarchy.estate || '—'],
    ['Division', hierarchy.division || '—'],
    [],
    ['Filters'],
    ['Search term', searchTerm || '—'],
    [],
    ['Summary'],
    ['Total fields', fields.length],
    ['Active fields', activeCount],
    ['Inactive fields', inactiveCount],
    ['Can spread', canSpreadCount],
    ['Spread blocked', fields.length - canSpreadCount],
    ['Can spray', canSprayCount],
    ['Spray blocked', fields.length - canSprayCount],
    ['Total spray/spread missions (1Y)', totalMissions1y],
    ['Fields with DJI dayend data (1Y)', fieldsWithDji1y],
    [],
    ['Notes'],
    ['Spray/Spread Missions (1Y)', 'Combined spray + spread count with opsroom DJI dayend area in the last 365 days'],
    ['DJI Area (1Y)', 'Min/max dji_field_area (Ha) from opsroom dayend in the last 365 days'],
  ];

  return XLSX.utils.aoa_to_sheet(rows);
}

const DETAIL_COLUMN_WIDTHS = [
  { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
  { wch: 10 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
  { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 24 }, { wch: 12 },
  { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 18 },
];

const DETAIL_COLUMN_WIDTHS_NO_HIERARCHY = DETAIL_COLUMN_WIDTHS.slice(5);

export function downloadMappingFieldsExcel({
  fields,
  missionReasons = [],
  hierarchy = {},
  searchTerm = '',
  filename,
  detailSheetName = 'Fields',
  title = 'Mapping Update — Fields Report',
  includeHierarchy = true,
}) {
  const workbook = XLSX.utils.book_new();

  const summarySheet = buildSummarySheet({ title, hierarchy, fields, searchTerm });
  summarySheet['!cols'] = [{ wch: 36 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  const detailRows = buildFieldExcelDetailRows(fields, missionReasons, { includeHierarchy, hierarchyFallback: hierarchy });
  const detailSheet = XLSX.utils.json_to_sheet(detailRows);
  detailSheet['!cols'] = includeHierarchy ? DETAIL_COLUMN_WIDTHS : DETAIL_COLUMN_WIDTHS_NO_HIERARCHY;
  XLSX.utils.book_append_sheet(workbook, detailSheet, detailSheetName.substring(0, 31));

  XLSX.writeFile(workbook, filename);
}
