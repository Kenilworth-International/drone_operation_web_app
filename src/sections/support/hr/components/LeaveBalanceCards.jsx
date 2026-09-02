import React, { useState } from 'react';

function CompactList({ cards }) {
  if (!cards.length) return <p className="hrsup-empty">No leave balances available.</p>;
  return (
    <div className="hrsup-lb-list">
      {cards.map((card) => (
        <div key={card.code} className="hrsup-lb-row">
          <div className="hrsup-lb-name">{card.title}</div>
          <div className="hrsup-lb-meta">
            Avail {card.available} · Used {card.used} · Pending {card.pending} · Quota {card.quota}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LeaveBalanceCards({ cards, showPopupButton = false, popupButtonLabel = 'Leave Balance' }) {
  const [open, setOpen] = useState(false);

  if (showPopupButton) {
    return (
      <>
        <button type="button" className="hrsup-leave-balance-link" onClick={() => setOpen(true)}>
          {popupButtonLabel}
        </button>
        {open && (
          <div className="hrsup-modal-overlay" onClick={() => setOpen(false)}>
            <div className="hrsup-modal hrsup-modal--sm" onClick={(e) => e.stopPropagation()}>
              <div className="hrsup-modal-head">
                <h3 className="hrsup-modal-title">Leave Balance</h3>
                <button type="button" className="hrsup-modal-close" onClick={() => setOpen(false)}>✕</button>
              </div>
              <div className="hrsup-modal-body" style={{ padding: '4px 0' }}>
                <CompactList cards={cards} />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return <CompactList cards={cards} />;
}
