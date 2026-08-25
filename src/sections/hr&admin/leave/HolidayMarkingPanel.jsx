import React from 'react';

export default function HolidayMarkingPanel({
  holidayMonth,
  setHolidayMonth,
  holidayCalendarCells,
  holidayMetaByDate,
  openHolidayEditor,
  savingHoliday,
  holidayModal,
  setHolidayModal,
  saveHolidayModal,
}) {
  return (
    <>
      <div className="leave-grid-leavemgt">
        <div className="leave-card-leavemgt leave-span-2-leavemgt">
          <div className="leave-card-header-leavemgt">
            <h3>Mark Holidays</h3>
            <span className="leave-muted-leavemgt">Click a date to set type and holiday name</span>
          </div>
          <div className="leave-holiday-toolbar-leavemgt">
            <input
              type="month"
              value={holidayMonth}
              onChange={(e) => setHolidayMonth(e.target.value)}
              className="leave-month-input-leavemgt"
            />
            <div className="leave-holiday-legend-leavemgt">
              <span className="holiday-dot-leavemgt mercantile-leavemgt" /> Statutory holidays
              <span className="holiday-dot-leavemgt poya-leavemgt" /> Poya
              <span className="holiday-dot-leavemgt special-leavemgt" /> Special (company)
            </div>
          </div>
          <div className="leave-holiday-weekdays-leavemgt">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="leave-holiday-weekday-leavemgt">{day}</div>
            ))}
          </div>
          <div className="leave-holiday-grid-leavemgt">
            {holidayCalendarCells.map((cell) => {
              if (cell.empty) {
                return <div key={cell.key} className="leave-holiday-cell-leavemgt empty-leavemgt" />;
              }
              const meta = holidayMetaByDate[cell.dateKey];
              const type = meta?.type || '';
              const desc = meta?.description || '';
              const typeLabel =
                type === 'mercantile'
                  ? 'Statutory holiday'
                  : type === 'poya'
                    ? 'Poya holiday'
                    : type === 'special'
                      ? 'Special holiday'
                      : '';
              const labelShort =
                desc ||
                (type === 'mercantile' ? 'Statutory' : type === 'poya' ? 'Poya' : type === 'special' ? 'Special' : '');
              const titleFull = type
                ? `${cell.dateKey} — ${typeLabel}${desc ? ` — ${desc}` : ''}`
                : `${cell.dateKey} — no holiday`;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  className={`leave-holiday-cell-leavemgt ${type ? `${type}-leavemgt` : 'normal-leavemgt'}`}
                  onClick={() => openHolidayEditor(cell.dateKey)}
                  disabled={savingHoliday}
                  title={titleFull}
                >
                  <span>{cell.dayNumber}</span>
                  {type ? <small className="leave-holiday-cell-label-leavemgt">{labelShort}</small> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {holidayModal ? (
        <div
          className="leave-holiday-modal-overlay-leavemgt"
          role="presentation"
          onClick={() => setHolidayModal(null)}
        >
          <div
            className="leave-holiday-modal-leavemgt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-holiday-modal-title-leavemgt"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="leave-holiday-modal-title-leavemgt" className="leave-holiday-modal-title-leavemgt">
              Holiday — {holidayModal.dateKey}
            </h4>
            <label className="leave-holiday-modal-label-leavemgt" htmlFor="holiday-type-select-leavemgt">Type</label>
            <select
              id="holiday-type-select-leavemgt"
              className="leave-holiday-modal-select-leavemgt"
              value={holidayModal.holidayType}
              onChange={(e) => setHolidayModal((prev) => ({ ...prev, holidayType: e.target.value }))}
            >
              <option value="">None (remove mark)</option>
              <option value="mercantile">Statutory holiday</option>
              <option value="poya">Poya holiday</option>
              <option value="special">Special holiday (company)</option>
            </select>
            <label className="leave-holiday-modal-label-leavemgt" htmlFor="holiday-desc-input-leavemgt">
              Holiday name / description
            </label>
            <input
              id="holiday-desc-input-leavemgt"
              type="text"
              className="leave-holiday-modal-input-leavemgt"
              placeholder="Shown on calendar and roster hover"
              value={holidayModal.description}
              disabled={!holidayModal.holidayType}
              onChange={(e) => setHolidayModal((prev) => ({ ...prev, description: e.target.value }))}
            />
            <div className="leave-holiday-modal-actions-leavemgt">
              <button
                type="button"
                className="leave-btn-leavemgt leave-btn-approve-leavemgt"
                disabled={savingHoliday}
                onClick={saveHolidayModal}
              >
                {savingHoliday ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="leave-btn-leavemgt leave-btn-secondary-leavemgt"
                onClick={() => setHolidayModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
