import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaChevronLeft, FaChevronRight, FaCalendarAlt } from 'react-icons/fa';

const SingleMonthPicker = ({ selectedMonth, onChange, monthsAhead = 0 }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [currentYear, setCurrentYear] = useState(selectedMonth.getFullYear());
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const pickerRef = useRef(null);

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const updatePickerPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPickerPosition({
        top: rect.bottom + 8,
        left: rect.left
      });
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target) &&
          pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowPicker(false);
      }
    };

    const handleScroll = () => {
      if (showPicker) {
        updatePickerPosition();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [showPicker, updatePickerPosition]);

  useEffect(() => {
    setCurrentYear(selectedMonth.getFullYear());
  }, [selectedMonth]);

  const formatMonth = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const maxSelectableMonth = useCallback(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + monthsAhead, 1);
  }, [monthsAhead]);

  const isMonthSelectable = useCallback(
    (year, monthIndex) => {
      const candidate = new Date(year, monthIndex, 1);
      return candidate <= maxSelectableMonth();
    },
    [maxSelectableMonth]
  );

  const handleMonthSelect = (monthIndex) => {
    const newMonth = new Date(currentYear, monthIndex, 1);
    if (isMonthSelectable(currentYear, monthIndex)) {
      onChange(newMonth);
      setShowPicker(false);
    }
  };

  const handleQuickSelect = (type) => {
    const today = new Date();
    let newMonth;

    switch (type) {
      case 'thisMonth':
        newMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'lastMonth':
        newMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        break;
      case 'twoMonthsAgo':
        newMonth = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        break;
      default:
        return;
    }

    onChange(newMonth);
    setShowPicker(false);
  };

  return (
    <div className="plantation-single-month-picker">
      <div className="plantation-month-range-input-wrapper">
        <button
          type="button"
          ref={buttonRef}
          className="plantation-month-range-btn"
          onClick={() => {
            if (!showPicker) {
              updatePickerPosition();
            }
            setShowPicker(!showPicker);
            setCurrentYear(selectedMonth.getFullYear());
          }}
        >
          <FaCalendarAlt className="plantation-month-icon" />
          <span>{formatMonth(selectedMonth)}</span>
        </button>
        {showPicker && (
          <div 
            className="plantation-month-picker-dropdown plantation-month-picker-dropdown-fixed" 
            ref={pickerRef}
            style={{
              top: `${pickerPosition.top}px`,
              left: `${pickerPosition.left}px`
            }}
          >
            <div className="plantation-month-picker-header">
              <button
                type="button"
                className="plantation-month-picker-nav"
                onClick={() => setCurrentYear(currentYear - 1)}
              >
                <FaChevronLeft />
              </button>
              <span className="plantation-month-picker-year">{currentYear}</span>
              <button
                type="button"
                className="plantation-month-picker-nav"
                onClick={() => setCurrentYear(currentYear + 1)}
                disabled={currentYear >= maxSelectableMonth().getFullYear()}
              >
                <FaChevronRight />
              </button>
            </div>
            <div className="plantation-month-picker-grid">
              {months.map((month, index) => {
                const isSelected = selectedMonth.getFullYear() === currentYear && selectedMonth.getMonth() === index;
                const isDisabled = !isMonthSelectable(currentYear, index);
                return (
                  <button
                    key={index}
                    type="button"
                    className={`plantation-month-picker-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => !isDisabled && handleMonthSelect(index)}
                    disabled={isDisabled}
                  >
                    {month}
                  </button>
                );
              })}
            </div>
            <div className="plantation-month-picker-quick-actions">
              <button type="button" onClick={() => handleQuickSelect('thisMonth')}>This Month</button>
              <button type="button" onClick={() => handleQuickSelect('lastMonth')}>Last Month</button>
              <button type="button" onClick={() => handleQuickSelect('twoMonthsAgo')}>2 Months Ago</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SingleMonthPicker;
