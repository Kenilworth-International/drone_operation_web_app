import React, { useCallback, useEffect, useState } from 'react';
import { hrSupportRequest } from '../api/hrSupportApi';
import { useHrSupportAuth } from '../auth/HrSupportAuthProvider';
import { formatApiDateDisplay } from '../utils/formatApiDate';

function formatDate(value) {
  return formatApiDateDisplay(value, '—');
}

export default function ProfileTab({ token, profile, loginUser, refreshing, onRefresh }) {
  const { logout } = useHrSupportAuth();
  const [reportingChain, setReportingChain] = useState([]);
  const [hod, setHod] = useState(null);
  const [sections, setSections] = useState({});
  const [loading, setLoading] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const employeeId = profile?.employeeId || profile?.id;

  const loadDetails = useCallback(async () => {
    if (!token || !employeeId) return;
    setLoading(true);
    const fetchList = async (path, body) => {
      try {
        const data = await hrSupportRequest(path, token, { method: 'POST', body: JSON.stringify(body) });
        return Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      } catch { return []; }
    };
    try {
      const [dep, edu, skl, docs, chain] = await Promise.all([
        fetchList('/api/employee-profile/dependents/list', { employeeId }),
        fetchList('/api/employee-profile/education/list', { employeeId }),
        fetchList('/api/employee-profile/skills/list', { employeeId }),
        fetchList('/api/employee-documents/list', { employeeId }),
        hrSupportRequest('/api/hr/profile/reporting-chain', token, { method: 'POST', body: JSON.stringify({ employeeId }) }).catch(() => []),
      ]);
      setSections({ dependents: dep, education: edu, skills: skl, documents: docs });
      if (Array.isArray(chain)) {
        setReportingChain(chain);
        setHod(null);
      } else {
        setReportingChain(Array.isArray(chain?.chain) ? chain.chain : []);
        setHod(chain?.headOfDepartment || null);
      }
    } finally {
      setLoading(false);
    }
  }, [token, employeeId]);

  useEffect(() => { loadDetails(); }, [loadDetails]);
  useEffect(() => { if (refreshing) loadDetails(); }, [refreshing]);

  const confirmDelete = async () => {
    if (!token) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await hrSupportRequest('/api/account/deactivate', token, { method: 'POST', body: JSON.stringify({}) });
      logout();
    } catch (err) {
      setDeleteError(err?.message || 'Failed to deactivate account.');
    } finally {
      setDeleting(false);
    }
  };

  const displayName = profile?.employeeName || profile?.preferredName || profile?.name || loginUser?.name || 'Employee';
  const initial = displayName.charAt(0).toUpperCase();
  const role = profile?.designation || profile?.jobRole || '—';

  return (
    <div>
      <div className="hrsup-profile-header hrsup-profile-header--center">
        <div className="hrsup-profile-avatar hrsup-profile-avatar--lg">{initial}</div>
        <p className="hrsup-profile-name">{displayName}</p>
        <p className="hrsup-profile-role">{role}</p>
        {profile?.employeeNo || profile?.employee_no ? (
          <p className="hrsup-profile-meta">{profile?.employeeNo || profile?.employee_no}</p>
        ) : null}
      </div>

      {/* Basic info */}
      <div className="hrsup-card">
        <h3 className="hrsup-card-title">Employee Information</h3>
        {[
          ['Employee No', profile?.employeeNo || profile?.employee_no || profile?.empNo],
          ['Department', profile?.department],
          ['Branch', profile?.branch],
          ['Email', profile?.email],
          ['Mobile', profile?.mobile || profile?.mobile_no],
          ['Date of Birth', profile?.dob && formatDate(profile.dob)],
          ['Joined', formatDate(profile?.joinedDate || profile?.joined_date)],
          ['Status', profile?.status || profile?.employeeStatus],
        ].filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="hrsup-dl-row"><span className="hrsup-dl-label">{k}</span><span className="hrsup-dl-value">{v}</span></div>
        ))}
      </div>

      {/* Reporting chain */}
      {(reportingChain.length > 0 || hod) && (
        <div className="hrsup-card">
          <h3 className="hrsup-card-title">Reporting Chain</h3>
          {reportingChain.map((member, idx) => {
            const roleLabel = idx === 0 || member.role === 'self'
              ? 'You'
              : idx === 1 || member.role === 'reporting_officer'
                ? 'Reporting officer'
                : `Higher manager (L${idx})`;
            return (
              <div key={member.id || idx} className="hrsup-dl-row">
                <span className="hrsup-dl-label">{roleLabel}</span>
                <span className="hrsup-dl-value">{member.employeeName || member.name || '—'}</span>
              </div>
            );
          })}
          {hod && (
            <div className="hrsup-dl-row">
              <span className="hrsup-dl-label">Head of Department</span>
              <span className="hrsup-dl-value">{hod.employeeName || hod.name || '—'}</span>
            </div>
          )}
        </div>
      )}

      {/* Skills */}
      {(sections.skills || []).length > 0 && (
        <div className="hrsup-card">
          <h3 className="hrsup-card-title">Skills</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sections.skills.map((s, i) => (
              <span key={i} className="hrsup-badge hrsup-badge--blue">{s.skillName || s.skill || String(s)}</span>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {(sections.education || []).length > 0 && (
        <div className="hrsup-card">
          <h3 className="hrsup-card-title">Education</h3>
          {sections.education.map((e, i) => (
            <div key={i} className="hrsup-dl-row">
              <span className="hrsup-dl-label">{e.qualification || e.degree}</span>
              <span className="hrsup-dl-value">{e.institution || '—'}{e.year ? `, ${e.year}` : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Documents */}
      {(sections.documents || []).length > 0 && (
        <div className="hrsup-card">
          <h3 className="hrsup-card-title">Documents</h3>
          {sections.documents.map((doc, i) => (
            <div key={i} className="hrsup-dl-row">
              <span className="hrsup-dl-label">{doc.documentType || doc.document_type}</span>
              <span className="hrsup-dl-value">{doc.referenceNo || doc.reference_no || '—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Session */}
      <div className="hrsup-card">
        <h3 className="hrsup-card-title">Session</h3>
        {!showLogout ? (
          <button type="button" className="hrsup-btn hrsup-btn--outline-danger hrsup-btn--full" onClick={() => setShowLogout(true)}>Sign out</button>
        ) : (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>Are you sure you want to sign out of the HR portal?</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="hrsup-btn hrsup-btn--secondary" style={{ flex: 1 }} onClick={() => setShowLogout(false)}>Cancel</button>
              <button type="button" className="hrsup-btn hrsup-btn--danger" style={{ flex: 1 }} onClick={logout}>Sign Out</button>
            </div>
          </div>
        )}
      </div>

      {/* Deactivate account */}
      <div className="hrsup-card" style={{ borderColor: '#fecaca' }}>
        <h3 className="hrsup-card-title" style={{ color: '#dc2626' }}>Danger Zone</h3>
        {deleteError && <div className="hrsup-error-box" style={{ marginBottom: 12 }}>{deleteError}</div>}
        {!showDelete ? (
          <button type="button" className="hrsup-btn hrsup-btn--outline-warn hrsup-btn--full" onClick={() => setShowDelete(true)}>Deactivate account</button>
        ) : (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#991b1b' }}>This will permanently deactivate your account. This cannot be undone. Contact HR to reactivate.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="hrsup-btn hrsup-btn--secondary" style={{ flex: 1 }} onClick={() => setShowDelete(false)} disabled={deleting}>Cancel</button>
              <button type="button" className="hrsup-btn hrsup-btn--danger" style={{ flex: 1 }} onClick={confirmDelete} disabled={deleting}>{deleting ? 'Deactivating…' : 'Confirm'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
