import React, { useState, useMemo } from 'react';
import {
  PersonalTab,
  EmploymentTab,
  FamilyTab,
  SecurityTab,
  LegacyFilesSection,
} from './EmployeeProfileCoreTabs';
import ProfileRecordWithFileSection from './ProfileRecordWithFileSection';
import EducationSection from './EducationSection';
import MasterSelect from './MasterSelect';
import {
  useListEmployeeProfileSectionQuery,
  useSaveEmployeeProfileSectionMutation,
  useDeleteEmployeeProfileSectionMutation,
  useListEmployeeDocumentsQuery,
  useUploadEmployeeDocumentMutation,
  useDeleteEmployeeDocumentMutation,
} from '../../../api/services NodeJs/employeeProfileApi';

const SELECT = 'select';
const DATE = 'date';
const NUMBER = 'number';
const TEXTAREA = 'textarea';

// Field definitions per section. `single: true` sections are 1:1 with the employee.
const SECTION_DEFS = {
  education: {
    label: 'Education & Qualifications',
    fields: [
      { name: 'qualification_type', label: 'Qualification Type', type: SELECT, masterCategory: 'qualification_type' },
      { name: 'course_name', label: 'Degree / Course Name' },
      { name: 'institution', label: 'Institution' },
      { name: 'field_of_study', label: 'Field of Study' },
      { name: 'start_date', label: 'Start Date', type: DATE },
      { name: 'completion_date', label: 'Completion Date', type: DATE },
      { name: 'grade', label: 'Grade / Class / GPA' },
    ],
  },
  'employment-history': {
    label: 'Employment History',
    fields: [
      { name: 'company_name', label: 'Company / Organization' },
      { name: 'designation', label: 'Job title / Designation' },
      { name: 'industry', label: 'Industry', type: SELECT, masterCategory: 'employment_industry' },
      { name: 'employment_period', label: 'Employment period', hint: 'e.g. Jan 2018 – Dec 2021' },
      { name: 'reason_for_leaving', label: 'Reason for leaving', type: TEXTAREA },
    ],
  },
  skills: {
    label: 'Skills & Competencies',
    fields: [
      { name: 'skill_category', label: 'Category', type: SELECT, masterCategory: 'skill_category' },
      { name: 'skill_name', label: 'Skill / Name' },
      { name: 'skill_level', label: 'Skill Level' },
      { name: 'certification', label: 'Certification' },
    ],
  },
  assets: {
    label: 'Assets & Administration',
    fields: [
      { name: 'asset_type', label: 'Asset Type', type: SELECT, masterCategory: 'asset_type' },
      { name: 'has_asset', label: 'Issued?', type: SELECT, options: [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }] },
      { name: 'count', label: 'Count', type: NUMBER },
      { name: 'serial_no', label: 'Serial Number' },
      { name: 'warranty', label: 'Warranty' },
      { name: 'vehicle_no', label: 'Vehicle Number' },
      { name: 'fuel_card', label: 'Fuel Card' },
      { name: 'driver_allocation', label: 'Driver Allocation' },
      { name: 'issue_date', label: 'Issue Date', type: DATE },
      { name: 'return_date', label: 'Return Date', type: DATE },
      { name: 'issue_condition', label: 'Issue Condition' },
      { name: 'return_condition', label: 'Return Condition' },
      { name: 'assigned_by', label: 'Assigned By' },
    ],
  },
  'performance-reviews': {
    label: 'Performance',
    fields: [
      { name: 'review_type', label: 'Type', type: SELECT, masterCategory: 'review_type' },
      { name: 'review_period', label: 'Period' },
      { name: 'kpi', label: 'KPI' },
      { name: 'rating', label: 'Rating' },
      { name: 'promotion', label: 'Promotion' },
      { name: 'review_date', label: 'Review Date', type: DATE },
      { name: 'reviewer', label: 'Reviewer' },
      { name: 'appraisal_notes', label: 'Notes', type: TEXTAREA },
    ],
  },
  'training-records': {
    label: 'Training',
    fields: [
      { name: 'course_name', label: 'Course Name' },
      { name: 'provider', label: 'Provider' },
      { name: 'certification', label: 'Certification' },
      { name: 'skill_area', label: 'Skill Area' },
      { name: 'start_date', label: 'Start Date', type: DATE },
      { name: 'completion_date', label: 'Completion Date', type: DATE },
      { name: 'expiry_date', label: 'Expiry Date', type: DATE },
    ],
  },
  'disciplinary-actions': {
    label: 'Warnings / Disciplinary',
    fields: [
      { name: 'action_type', label: 'Action Type', type: SELECT, masterCategory: 'disciplinary_action_type' },
      { name: 'description', label: 'Description', type: TEXTAREA },
      { name: 'action_date', label: 'Date', type: DATE },
      { name: 'issued_by', label: 'Issued By' },
      { name: 'status', label: 'Status' },
    ],
  },
  exit: {
    label: 'Exit Management',
    single: true,
    fields: [
      { name: 'resignation_date', label: 'Resignation Date', type: DATE },
      { name: 'last_working_date', label: 'Last Working Date', type: DATE },
      { name: 'reason_for_leaving', label: 'Reason for Leaving' },
      { name: 'clearance_status', label: 'Clearance Status', type: SELECT, masterCategory: 'exit_clearance_status' },
      { name: 'exit_interview', label: 'Exit Interview', type: TEXTAREA },
      { name: 'notes', label: 'Notes', type: TEXTAREA },
    ],
  },
  'exit-clearances': {
    label: 'Clearance Workflow',
    fields: [
      { name: 'clearance_type', label: 'Clearance', type: SELECT, masterCategory: 'exit_clearance_type' },
      { name: 'status', label: 'Status', type: SELECT, masterCategory: 'exit_item_status' },
      { name: 'cleared_by', label: 'Cleared By' },
      { name: 'cleared_at', label: 'Cleared At', type: DATE },
      { name: 'notes', label: 'Notes' },
    ],
  },
};

const DOC_TYPES = [
  'NIC', 'Birth Certificate', 'Passport Copy', 'Driving License', 'Police Report',
  'GN Report', 'Medical Report', 'School Leaving Certificate', 'Appointment Letter',
  'Employment Contract', 'NDA', 'Agreement', 'CV/Resume', 'Interview Assessment Form',
  'Confirmation Letter', 'Promotion Letter', 'Transfer Letter', 'Salary Revision Letter', 'Other',
];

function emptyRow(def) {
  const row = {};
  def.fields.forEach((f) => { row[f.name] = ''; });
  return row;
}

function FieldInput({ field, value, onChange }) {
  const common = { value: value ?? '', onChange: (e) => onChange(field.name, e.target.value) };
  if (field.masterCategory) {
    return (
      <MasterSelect
        category={field.masterCategory}
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    );
  }
  if (field.type === SELECT) {
    return (
      <select {...common}>
        <option value="">-- Select --</option>
        {field.options.map((opt) => {
          const o = typeof opt === 'object' ? opt : { value: opt, label: opt };
          return <option key={o.value} value={o.value}>{o.label}</option>;
        })}
      </select>
    );
  }
  if (field.type === TEXTAREA) {
    return <textarea rows={2} {...common} />;
  }
  return <input type={field.type === DATE ? 'date' : field.type === NUMBER ? 'number' : 'text'} {...common} />;
}

function GenericListSection({ section, def, employeeId, readOnly = false }) {
  const { data, isLoading, refetch } = useListEmployeeProfileSectionQuery({ section, employeeId });
  const [saveSection, { isLoading: saving }] = useSaveEmployeeProfileSectionMutation();
  const [deleteSection] = useDeleteEmployeeProfileSectionMutation();
  const [draft, setDraft] = useState(emptyRow(def));
  const [editingId, setEditingId] = useState(null);

  const rows = useMemo(() => (Array.isArray(data?.data) ? data.data : []), [data]);

  const handleChange = (name, value) => setDraft((p) => ({ ...p, [name]: value }));

  const startEdit = (row) => {
    const next = {};
    def.fields.forEach((f) => {
      let v = row[f.name];
      if (f.type === DATE && v) v = String(v).split('T')[0];
      next[f.name] = v ?? '';
    });
    setDraft(next);
    setEditingId(row.id);
  };

  const resetDraft = () => { setDraft(emptyRow(def)); setEditingId(null); };

  const handleSave = async () => {
    const body = { section, employeeId, ...draft };
    if (editingId) body.id = editingId;
    await saveSection(body).unwrap().catch(() => {});
    resetDraft();
    refetch();
  };

  const handleDelete = async (id) => {
    await deleteSection({ section, id }).unwrap().catch(() => {});
    refetch();
  };

  return (
    <div className="epd-section">
      {!readOnly && (
        <>
          <div className="epd-form-grid">
            {def.fields.map((f) => (
              <div className="epd-field" key={f.name}>
                <label>{f.label}</label>
                <FieldInput field={f} value={draft[f.name]} onChange={handleChange} />
              </div>
            ))}
          </div>
          <div className="epd-actions">
            <button className="epd-btn epd-btn-primary" onClick={handleSave} disabled={saving}>
              {editingId ? 'Update' : 'Add'}
            </button>
            {editingId && <button className="epd-btn" onClick={resetDraft}>Cancel</button>}
          </div>
        </>
      )}

      <div className="epd-table-wrap">
        {isLoading ? (
          <p>Loading...</p>
        ) : rows.length === 0 ? (
          <p className="epd-empty">No records yet.</p>
        ) : (
          <table className="epd-table">
            <thead>
              <tr>
                {def.fields.map((f) => <th key={f.name}>{f.label}</th>)}
                {!readOnly && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {def.fields.map((f) => {
                    let v = row[f.name];
                    if (f.type === DATE && v) v = String(v).split('T')[0];
                    if (f.name === 'has_asset') v = String(v) === '1' ? 'Yes' : 'No';
                    return <td key={f.name}>{v || '-'}</td>;
                  })}
                  {!readOnly && (
                  <td className="epd-row-actions">
                    <button className="epd-btn epd-btn-sm" onClick={() => startEdit(row)}>Edit</button>
                    <button className="epd-btn epd-btn-sm epd-btn-danger" onClick={() => handleDelete(row.id)}>Delete</button>
                  </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SingleSection({ section, def, employeeId, readOnly = false }) {
  const { data, isLoading, refetch } = useListEmployeeProfileSectionQuery({ section, employeeId });
  const [saveSection, { isLoading: saving }] = useSaveEmployeeProfileSectionMutation();
  const [draft, setDraft] = useState(null);

  const record = data?.data || null;
  const current = draft || (() => {
    const base = emptyRow(def);
    if (record) {
      def.fields.forEach((f) => {
        let v = record[f.name];
        if (f.type === DATE && v) v = String(v).split('T')[0];
        base[f.name] = v ?? '';
      });
    }
    return base;
  })();

  const handleChange = (name, value) => setDraft({ ...current, [name]: value });

  const handleSave = async () => {
    await saveSection({ section, employeeId, ...current }).unwrap().catch(() => {});
    setDraft(null);
    refetch();
  };

  if (isLoading) return <p>Loading...</p>;

  if (readOnly) {
    return (
      <div className="epd-section">
        <div className="ep-readonly-grid">
          {def.fields.map((f) => {
            let v = current[f.name];
            if (f.type === DATE && v) v = String(v).split('T')[0];
            if (f.name === 'epfEligible' || f.name === 'etfEligible' || f.name === 'overtimeEligible') {
              v = String(v) === '1' ? 'Yes' : String(v) === '0' ? 'No' : v;
            }
            return (
              <div className="ep-readonly-item" key={f.name}>
                <span className="ep-readonly-label">{f.label}</span>
                <span className="ep-readonly-value">{v || '—'}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="epd-section">
      <div className="epd-form-grid">
        {def.fields.map((f) => (
          <div className="epd-field" key={f.name}>
            <label>{f.label}</label>
            <FieldInput field={f} value={current[f.name]} onChange={handleChange} />
          </div>
        ))}
      </div>
      <div className="epd-actions">
        <button className="epd-btn epd-btn-primary" onClick={handleSave} disabled={saving}>Save</button>
      </div>
    </div>
  );
}

function DocumentsSection({ employeeId, readOnly = false }) {
  const { data, isLoading, refetch } = useListEmployeeDocumentsQuery(employeeId);
  const [uploadDoc, { isLoading: uploading }] = useUploadEmployeeDocumentMutation();
  const [deleteDoc] = useDeleteEmployeeDocumentMutation();
  const [docType, setDocType] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState(null);

  const docs = useMemo(() => (Array.isArray(data?.data) ? data.data : []), [data]);

  const handleUpload = async () => {
    if (!file || !docType) return;
    const fd = new FormData();
    fd.append('employeeId', employeeId);
    fd.append('docType', docType);
    if (expiryDate) fd.append('expiryDate', expiryDate);
    fd.append('document', file);
    await uploadDoc(fd).unwrap().catch(() => {});
    setFile(null);
    setDocType('');
    setExpiryDate('');
    refetch();
  };

  const isExpiringSoon = (d) => {
    if (!d) return false;
    const exp = new Date(d);
    const now = new Date();
    const days = (exp - now) / (1000 * 60 * 60 * 24);
    return days <= 60;
  };

  return (
    <div className="epd-section">
      {!readOnly && (
        <>
          <div className="epd-form-grid">
            <div className="epd-field">
              <label>Document Type</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                <option value="">-- Select --</option>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="epd-field">
              <label>Expiry Date (optional)</label>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
            <div className="epd-field">
              <label>File</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <div className="epd-actions">
            <button className="epd-btn epd-btn-primary" onClick={handleUpload} disabled={uploading || !file || !docType}>
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </>
      )}

      <div className="epd-table-wrap">
        {isLoading ? (
          <p>Loading...</p>
        ) : docs.length === 0 ? (
          <p className="epd-empty">No documents uploaded.</p>
        ) : (
          <table className="epd-table">
            <thead>
              <tr><th>Type</th><th>File</th><th>Expiry</th>{!readOnly && <th>Actions</th>}</tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id} className={isExpiringSoon(doc.expiry_date) ? 'epd-row-warning' : ''}>
                  <td>{doc.doc_type}</td>
                  <td>
                    {doc.fileUrl ? <a href={doc.fileUrl} target="_blank" rel="noreferrer">{doc.original_name || 'View'}</a> : (doc.original_name || '-')}
                  </td>
                  <td>{doc.expiry_date ? String(doc.expiry_date).split('T')[0] : '-'}</td>
                  {!readOnly && (
                  <td className="epd-row-actions">
                    <button className="epd-btn epd-btn-sm epd-btn-danger" onClick={async () => { await deleteDoc(doc.id).unwrap().catch(() => {}); refetch(); }}>Delete</button>
                  </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
export function renderEmployeeProfileTab(activeTab, employeeId, { readOnly = false } = {}) {
  if (!employeeId) return null;
  if (activeTab === 'personal') {
    return <PersonalTab employeeId={employeeId} readOnly={readOnly} key={`personal-${employeeId}`} />;
  }
  if (activeTab === 'employment') {
    return <EmploymentTab employeeId={employeeId} readOnly={readOnly} key={`employment-${employeeId}`} />;
  }
  if (activeTab === 'family') {
    return <FamilyTab employeeId={employeeId} readOnly={readOnly} key={`family-${employeeId}`} />;
  }
  if (activeTab === 'security') {
    return <SecurityTab employeeId={employeeId} readOnly={readOnly} key={`security-${employeeId}`} />;
  }
  if (activeTab === 'education') {
    return (
      <EducationSection
        key={`education-${employeeId}`}
        employeeId={employeeId}
        readOnly={readOnly}
      />
    );
  }
  if (activeTab === 'employment-history') {
    return (
      <ProfileRecordWithFileSection
        key={`employment-history-${employeeId}`}
        section="employment-history"
        def={SECTION_DEFS['employment-history']}
        employeeId={employeeId}
        readOnly={readOnly}
        fileField={{
          column: 'service_letter_file',
          label: 'Service letter',
          accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx',
        }}
        intro="Add each employer before joining this company — company name, job title, industry, dates, and service letter."
      />
    );
  }
  if (activeTab === 'documents') {
    return (
      <div key={`documents-${employeeId}`}>
        <LegacyFilesSection employeeId={employeeId} readOnly={readOnly} />
        <hr className="ep-section-divider" />
        <DocumentsSection employeeId={employeeId} readOnly={readOnly} />
      </div>
    );
  }
  if (SECTION_DEFS[activeTab]?.single) {
    return (
      <SingleSection section={activeTab} def={SECTION_DEFS[activeTab]} employeeId={employeeId} readOnly={readOnly} key={`${activeTab}-${employeeId}`} />
    );
  }
  if (SECTION_DEFS[activeTab]) {
    return (
      <GenericListSection section={activeTab} def={SECTION_DEFS[activeTab]} employeeId={employeeId} readOnly={readOnly} key={`${activeTab}-${employeeId}`} />
    );
  }
  return null;
}

export { SECTION_DEFS };
