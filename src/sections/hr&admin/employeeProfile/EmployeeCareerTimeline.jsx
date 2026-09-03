import React, { useMemo } from 'react';
import { useEmployee } from './useEmployee';
import {
  splitDate,
  formatProfileDate,
  isContractEmploymentType,
  isExternalMemberType,
  isProbationEmploymentType,
} from './employeeProfileUtils';

export default function EmployeeCareerTimeline({ employeeId }) {
  const { employee, isLoading } = useEmployee(employeeId);

  const events = useMemo(() => {
    if (!employee) return [];
    const isContract = isExternalMemberType(employee.memberTypeFlag)
      || isContractEmploymentType(employee.employmentType);
    const isProbation = isProbationEmploymentType(employee.employmentType);
    const candidates = [
      { key: 'joined', label: 'Joined company', date: employee.joinedDate },
      { key: 'appointment', label: 'Current appointment', date: employee.appointmentDate },
      ...(isProbation
        ? [{ key: 'probation-end', label: 'Probation end', date: employee.probationEndDate }]
        : []),
      { key: 'permanent', label: 'Permanent status', date: employee.permanentDate },
      ...(isContract
        ? [
            { key: 'contract-start', label: 'Contract start', date: employee.contractStartDate },
            { key: 'contract-end', label: 'Contract end', date: employee.contractEndDate },
          ]
        : []),
      { key: 'retirement', label: 'Retirement', date: employee.retirementDate },
    ];
    return candidates
      .map((item) => {
        const iso = splitDate(item.date);
        return { ...item, iso, displayDate: formatProfileDate(item.date) };
      })
      .filter((item) => item.displayDate)
      .sort((a, b) => String(a.iso).localeCompare(String(b.iso)));
  }, [employee]);

  if (isLoading || !employee) return null;
  if (!events.length) return null;

  return (
    <section className="ep-career-timeline" aria-label="Career timeline">
      <h3 className="ep-career-timeline-title">Career timeline</h3>
      <ol className="ep-career-timeline-list">
        {events.map((event) => (
          <li key={event.key} className="ep-career-timeline-item">
            <span className="ep-career-timeline-dot" aria-hidden="true" />
            <div className="ep-career-timeline-body">
              <span className="ep-career-timeline-label">{event.label}</span>
              <time className="ep-career-timeline-date" dateTime={event.iso}>{event.displayDate}</time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
