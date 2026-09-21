import React from 'react';
import { FaBan, FaWrench, FaSearch, FaClipboardCheck, FaCheck } from 'react-icons/fa';
import { getActionStatus } from '../utils/formatters';

export default function StatusBadge({ report }) {
  const status = getActionStatus(report);
  return (
    <span className={`accidentreports-status-badge accidentreports-status-badge--${status.key}`}>
      {status.key === 'declined' ? <FaBan aria-hidden /> : null}
      {status.key === 'repair' ? <FaWrench aria-hidden /> : null}
      {status.key === 'investigating' ? <FaSearch aria-hidden /> : null}
      {status.key === 'review' ? <FaClipboardCheck aria-hidden /> : null}
      {status.key === 'approved' ? <FaCheck aria-hidden /> : null}
      {status.label}
    </span>
  );
}
