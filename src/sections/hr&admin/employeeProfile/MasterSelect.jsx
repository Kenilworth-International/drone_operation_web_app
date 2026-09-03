import React from 'react';
import { useHrMasterOptions } from './useHrMasterOptions';

export default function MasterSelect({
  category,
  value,
  onChange,
  name,
  disabled,
  className,
  placeholder = '-- Select --',
  filterOption,
}) {
  const { getOptions, isLoading } = useHrMasterOptions();
  const allOptions = getOptions(category);
  const options = typeof filterOption === 'function'
    ? allOptions.filter(filterOption)
    : allOptions;

  return (
    <select
      name={name}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled || isLoading}
      className={className}
    >
      <option value="">{isLoading ? 'Loading…' : placeholder}</option>
      {options.map((opt) => (
        <option key={`${category}-${opt.value}`} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
