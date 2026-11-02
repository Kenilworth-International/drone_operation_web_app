import React, { useState } from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function parseEmailsList(value) {
  if (value == null || value === '') return [];
  let list = value;
  if (typeof list === 'string') {
    const trimmed = list.trim();
    if (!trimmed) return [];
    try {
      list = JSON.parse(trimmed);
    } catch {
      list = trimmed.split(/[,;\n]+/);
    }
  }
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const email = String(item ?? '')
      .trim()
      .toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function formatEmailsPreview(value, maxLen = 42) {
  const list = parseEmailsList(value);
  if (!list.length) return '—';
  if (list.length === 1) {
    const s = list[0];
    return s.length <= maxLen ? s : `${s.slice(0, maxLen)}…`;
  }
  const head = list[0];
  const more = list.length - 1;
  const label = `${head} +${more}`;
  return label.length <= maxLen ? label : `${head.slice(0, Math.max(8, maxLen - 6))}… +${more}`;
}

/**
 * Multi-email editor for Corporate Customer popup.
 * `emails` is an array of strings in form state.
 */
export default function PlantationEmailsEditor({ emails = [], onChange }) {
  const list = Array.isArray(emails) ? emails : [];
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const setEmails = (next) => {
    onChange('emails', next);
  };

  const addEmail = (e) => {
    e.preventDefault();
    const email = String(draft || '')
      .trim()
      .toLowerCase();
    if (!email) {
      setError('Enter an email address');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address');
      return;
    }
    if (list.includes(email)) {
      setError('Email already added');
      return;
    }
    setEmails([...list, email]);
    setDraft('');
    setError('');
  };

  const removeAt = (idx) => {
    setEmails(list.filter((_, i) => i !== idx));
  };

  const updateAt = (idx, value) => {
    const next = [...list];
    next[idx] = String(value || '')
      .trim()
      .toLowerCase();
    setEmails(next);
  };

  return (
    <section className="cc-emails-editor" aria-labelledby="cc-emails-title">
      <h3 id="cc-emails-title" className="sr-only">
        Emails
      </h3>
      <p className="cc-emails-editor__hint">
        Add one or more contact emails for this plantation. Duplicates are ignored.
      </p>

      {list.length ? (
        <ul className="cc-emails-editor__list">
          {list.map((email, idx) => (
            <li key={`${email}-${idx}`} className="cc-emails-editor__row">
              <input
                className="cc-input"
                type="email"
                value={email}
                onChange={(ev) => updateAt(idx, ev.target.value)}
                aria-label={`Email ${idx + 1}`}
              />
              <button
                type="button"
                className="cc-btn cc-btn--ghost cc-emails-editor__remove"
                onClick={() => removeAt(idx)}
                aria-label={`Remove ${email}`}
                title="Remove"
              >
                <FaTrash aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cc-emails-editor__empty">No emails yet.</p>
      )}

      <div className="cc-emails-editor__add">
        <input
          className="cc-input"
          type="email"
          placeholder="name@company.com"
          value={draft}
          onChange={(ev) => {
            setDraft(ev.target.value);
            if (error) setError('');
          }}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              addEmail(ev);
            }
          }}
          aria-label="New email"
        />
        <button type="button" className="cc-btn cc-btn--primary" onClick={addEmail}>
          <FaPlus aria-hidden /> Add
        </button>
      </div>
      {error ? <p className="cc-emails-editor__error">{error}</p> : null}
    </section>
  );
}
