import React, { useState } from 'react';
import { employeeInitials, getEmployeePhotoUrl, getEmployeeDisplayName } from './employeeProfileUtils';

export default function EmployeeAvatar({ employee, name, className = '', size = 'md' }) {
  const displayName = name || getEmployeeDisplayName(employee);
  const photoUrl = getEmployeePhotoUrl(employee);
  const [failed, setFailed] = useState(false);

  const showPhoto = photoUrl && !failed;

  return (
    <span className={`ep-employees-avatar ep-employees-avatar--${size} ${className}`.trim()}>
      {showPhoto ? (
        <img
          src={photoUrl}
          alt=""
          className="ep-employees-avatar-img"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="ep-employees-avatar-initials">{employeeInitials(displayName)}</span>
      )}
    </span>
  );
}
