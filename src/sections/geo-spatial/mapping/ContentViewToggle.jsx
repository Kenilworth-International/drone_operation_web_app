import React from 'react';
import { FaMap, FaThLarge } from 'react-icons/fa';

/** Cards / Map segmented toggle for Mapping Update content pane. */
const ContentViewToggle = ({ mode = 'cards', onChange }) => (
  <div className="content-view-toggle-map-update" role="group" aria-label="View mode">
    <button
      type="button"
      className={`content-view-toggle-btn-map-update${mode === 'cards' ? ' is-active' : ''}`}
      onClick={() => onChange('cards')}
      title="Card view"
      aria-pressed={mode === 'cards'}
    >
      <FaThLarge aria-hidden />
      <span>Cards</span>
    </button>
    <button
      type="button"
      className={`content-view-toggle-btn-map-update${mode === 'map' ? ' is-active' : ''}`}
      onClick={() => onChange('map')}
      title="Map view"
      aria-pressed={mode === 'map'}
    >
      <FaMap aria-hidden />
      <span>Map</span>
    </button>
  </div>
);

export default ContentViewToggle;
