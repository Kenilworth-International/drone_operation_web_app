import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGetWebmailStatusQuery,
  useConnectWebmailMutation,
  useDisconnectWebmailMutation,
  useGetWebmailFoldersQuery,
  useListWebmailMessagesQuery,
  useLazyGetWebmailMessageQuery,
  useSendWebmailMessageMutation,
  useSaveWebmailDraftMutation,
  useRetryWebmailOutboxMutation,
  useDeleteWebmailOutboxMutation,
  useGetWebmailSignatureQuery,
  useSaveWebmailSignatureMutation,
  useApplyWebmailSignatureMutation,
  useDeleteWebmailSignatureMutation,
  useListWebmailContactsQuery,
  useSaveWebmailContactMutation,
  useDeleteWebmailContactMutation,
  downloadWebmailAttachment,
} from '../../api/services NodeJs/webmailApi';
import { getNodeBackendUrl } from '../../api/services NodeJs/nodeBackendUrl';
import '../../styles/webmail.css';

/** Inline icons — avoid react-icons fill/CSS fights on dark chrome buttons. */
const MAIL_ICON_PATHS = {
  arrowLeft: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  envelope: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z',
  pen: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z',
  addressBook: 'M20 0H4v2h16V0zM4 24h16v-2H4v2zM20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 2.75c1.24 0 2.25 1.01 2.25 2.25S13.24 11.25 12 11.25 9.75 10.24 9.75 9 10.76 6.75 12 6.75zM17 17H7v-1.5c0-1.67 3.33-2.5 5-2.5s5 .83 5 2.5V17z',
  cog: 'M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z',
  sync: 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z',
  signOut: 'M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 0 0-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
  times: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  trash: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  search: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  paperclip: 'M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z',
  reply: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z',
  share: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
  userPlus: 'M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  inbox: 'M19 3H4.99c-1.11 0-1.98.89-1.98 2L3 19c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10z',
  sent: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
  draft: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  spam: 'M15.73 3H8.27L3 8.27v7.46L8.27 21h7.46L21 15.73V8.27L15.73 3zM12 17.3c-.72 0-1.3-.58-1.3-1.3s.58-1.3 1.3-1.3 1.3.58 1.3 1.3-.58 1.3-1.3 1.3zm1-4.3h-2V7h2v6z',
  outbox: 'M19 15l-6 6-1.42-1.42L15.17 16H4V4h2v10h9.17l-3.59-3.58L13 9l6 6z',
};

function MailIcon({ name, className = '', size = 18, title }) {
  const d = MAIL_ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg
      className={`webmail-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path fill="currentColor" d={d} />
    </svg>
  );
}

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function formatListWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, sameYear
    ? { month: 'short', day: 'numeric' }
    : { year: 'numeric', month: 'short', day: 'numeric' });
}

function initialsFrom(value) {
  const text = String(value || '').trim();
  if (!text) return '?';
  const name = extractDisplayName(text) || extractEmail(text) || text;
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return name.slice(0, 1).toUpperCase();
  return ((parts[0][0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

function Spinner({ dark = false, sm = false }) {
  return (
    <span
      className={`webmail-spinner${dark ? ' webmail-spinner--dark' : ''}${sm ? ' webmail-spinner--sm' : ''}`}
      aria-hidden
    />
  );
}

function ListSkeleton() {
  return (
    <div className="webmail-skeleton" aria-hidden>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="webmail-skeleton-row" style={{ animationDelay: `${i * 0.06}s` }} />
      ))}
    </div>
  );
}

function ReaderSkeleton() {
  return (
    <div className="webmail-read-card webmail-read-loading" aria-busy="true">
      <div className="webmail-skeleton-block webmail-skeleton-block--lg" />
      <div className="webmail-skeleton-block webmail-skeleton-block--md" />
      <div className="webmail-skeleton-block webmail-skeleton-block--md" />
      <div className="webmail-skeleton-block webmail-skeleton-block--full" />
    </div>
  );
}

function ConfirmDialog({
  open,
  title = 'Please confirm',
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  return (
    <div
      className="webmail-modal-overlay webmail-confirm-overlay"
      role="presentation"
    >
      <div className="webmail-modal webmail-modal--confirm" role="alertdialog" aria-modal="true" aria-labelledby="webmail-confirm-title">
        <header className="webmail-modal-head">
          <h2 id="webmail-confirm-title">{title}</h2>
          <button
            type="button"
            className="webmail-icon-btn webmail-icon-btn--panel"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
          >
            <MailIcon name="times" />
          </button>
        </header>
        <p className="webmail-confirm-message">{message}</p>
        <footer className="webmail-modal-foot">
          <button type="button" className="webmail-btn webmail-btn--ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`webmail-btn ${danger ? 'webmail-btn--danger' : 'webmail-btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <><Spinner sm /> Working…</> : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

function useConfirmDialog() {
  const [state, setState] = useState(null);

  const askConfirm = (opts) =>
    new Promise((resolve) => {
      setState({
        title: opts.title || 'Please confirm',
        message: opts.message || '',
        confirmLabel: opts.confirmLabel || 'OK',
        cancelLabel: opts.cancelLabel || 'Cancel',
        danger: Boolean(opts.danger),
        resolve,
      });
    });

  const close = (result) => {
    if (!state) return;
    state.resolve(result);
    setState(null);
  };

  const confirmDialog = (
    <ConfirmDialog
      open={Boolean(state)}
      title={state?.title}
      message={state?.message}
      confirmLabel={state?.confirmLabel}
      cancelLabel={state?.cancelLabel}
      danger={state?.danger}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return [askConfirm, confirmDialog];
}

function extractEmail(fromStr) {
  const m = String(fromStr || '').match(/<([^>]+)>/);
  return m ? m[1] : String(fromStr || '').trim();
}

function extractDisplayName(fromStr) {
  const raw = String(fromStr || '').trim();
  const m = raw.match(/^"?([^"<]+)"?\s*</);
  if (m) return m[1].trim();
  return '';
}

function appendAddress(current, email) {
  const next = String(email || '').trim();
  if (!next) return current || '';
  const parts = String(current || '')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const exists = parts.some((p) => extractEmail(p).toLowerCase() === extractEmail(next).toLowerCase());
  if (exists) return parts.join(', ');
  return [...parts, next].join(', ');
}

function ConnectPanel({ status, onConnected }) {
  const [password, setPassword] = useState('');
  const [connect, { isLoading, error }] = useConnectWebmailMutation();
  const errMsg = error?.data?.message || error?.error;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await connect({ password }).unwrap();
      setPassword('');
      onConnected?.();
    } catch (_e) {
      /* shown via error */
    }
  };

  return (
    <div className="webmail-connect">
      <div className="webmail-connect-card">
        <div className="webmail-connect-icon-wrap" aria-hidden>
          <MailIcon name="envelope" />
        </div>
        <h1>Connect your mailbox</h1>
        <p>
          Use your Kenilworth company email password. It is stored encrypted for this DSMS account
          and used only to open your mail securely.
        </p>
        <dl className="webmail-connect-meta">
          <div>
            <dt>Company email</dt>
            <dd>{status?.email || '—'}</dd>
          </div>
        </dl>
        {status?.previousEmailCleared ? (
          <p className="webmail-muted">
            Company email changed from <strong>{status.previousEmailCleared}</strong>.
            Enter the password for the new mailbox to reconnect.
          </p>
        ) : null}
        <form onSubmit={handleSubmit}>
          <label>
            Mailbox password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={isLoading}
            />
          </label>
          {errMsg ? <p className="webmail-error">{errMsg}</p> : null}
          <button type="submit" className="webmail-btn webmail-btn--primary" disabled={isLoading || !password}>
            {isLoading ? <><Spinner sm /> Connecting…</> : 'Connect mailbox'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AddressField({ label, value, onChange, contacts }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = contacts || [];
    if (!q) return list.slice(0, 40);
    return list
      .filter((c) =>
        String(c.email || '').toLowerCase().includes(q)
        || String(c.name || '').toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [contacts, filter]);

  return (
    <div className="webmail-address-field">
      <div className="webmail-address-field-row">
        <label>
          {label}
          <input value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
        <button
          type="button"
          className="webmail-btn webmail-btn--compact"
          title="Pick from contacts"
          onClick={() => setPickerOpen((v) => !v)}
        >
          <MailIcon name="addressBook" />
        </button>
      </div>
      {pickerOpen ? (
        <div className="webmail-contact-picker">
          <input
            className="webmail-contact-picker-search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search contacts…"
            autoFocus
          />
          <ul>
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(appendAddress(value, c.email));
                    setPickerOpen(false);
                    setFilter('');
                  }}
                >
                  <strong>{c.name || c.email}</strong>
                  {c.name ? <span>{c.email}</span> : null}
                </button>
              </li>
            ))}
            {!filtered.length ? <li className="webmail-empty">No contacts</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ComposeModal({
  open,
  mode,
  seed,
  onClose,
  onSent,
  onDraftSaved,
}) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const [signatureId, setSignatureId] = useState('');
  const [closePrompt, setClosePrompt] = useState(false);
  const [send, { isLoading: sending }] = useSendWebmailMessageMutation();
  const [saveDraft, { isLoading: drafting }] = useSaveWebmailDraftMutation();
  const [localError, setLocalError] = useState(null);
  const initialRef = useRef(null);
  const { data: contactsData } = useListWebmailContactsQuery({}, { skip: !open });
  const { data: signatureData } = useGetWebmailSignatureQuery(undefined, { skip: !open });
  const contacts = contactsData?.contacts || [];
  const signatures = signatureData?.signatures || [];
  const selectedSig = useMemo(() => {
    if (!signatures.length) return null;
    if (signatureId) {
      return signatures.find((s) => String(s.id) === String(signatureId)) || null;
    }
    return signatureData?.applied || signatures.find((s) => s.isApplied) || signatures[0] || null;
  }, [signatures, signatureId, signatureData]);

  useEffect(() => {
    if (!open) {
      setClosePrompt(false);
      return;
    }
    const next = {
      to: seed?.to || '',
      cc: seed?.cc || '',
      bcc: seed?.bcc || '',
      subject: seed?.subject || '',
      body: seed?.body || '',
    };
    setTo(next.to);
    setCc(next.cc);
    setBcc(next.bcc);
    setSubject(next.subject);
    setBody(next.body);
    setFiles([]);
    setLocalError(null);
    setClosePrompt(false);
    initialRef.current = next;
    const appliedId = signatureData?.applied?.id;
    setSignatureId(appliedId != null ? String(appliedId) : '');
  }, [open, seed, signatureData?.applied?.id]);

  if (!open) return null;

  const fields = {
    to,
    cc,
    bcc,
    subject,
    text: body,
    html: body.replace(/\n/g, '<br/>'),
    inReplyTo: seed?.inReplyTo || '',
    references: Array.isArray(seed?.references) ? seed.references.join(' ') : seed?.references || '',
    signatureId: selectedSig?.id || '',
  };

  const isDirty = () => {
    const initial = initialRef.current || {
      to: '', cc: '', bcc: '', subject: '', body: '',
    };
    return (
      to !== initial.to
      || cc !== initial.cc
      || bcc !== initial.bcc
      || subject !== initial.subject
      || body !== initial.body
      || files.length > 0
    );
  };

  const hasWritableContent = () =>
    Boolean(
      to.trim()
      || cc.trim()
      || bcc.trim()
      || subject.trim()
      || body.trim()
      || files.length
    );

  const finishClose = () => {
    setClosePrompt(false);
    onClose?.();
  };

  const handleSend = async () => {
    setLocalError(null);
    try {
      await send({ fields, files }).unwrap();
      onSent?.();
      finishClose();
    } catch (err) {
      setLocalError(err?.data?.message || err?.error || 'Send failed — check Outbox');
    }
  };

  const handleDraft = async ({ closeAfter = true } = {}) => {
    setLocalError(null);
    try {
      await saveDraft({ fields, files }).unwrap();
      onDraftSaved?.();
      onSent?.();
      if (closeAfter) finishClose();
    } catch (err) {
      setLocalError(err?.data?.message || err?.error || 'Draft save failed');
      setClosePrompt(false);
    }
  };

  const requestClose = () => {
    if (sending || drafting) return;
    if (isDirty() && hasWritableContent()) {
      setClosePrompt(true);
      return;
    }
    finishClose();
  };

  const sigImageSrc = selectedSig?.imageUrl
    ? `${getNodeBackendUrl()}${selectedSig.imageUrl}`
    : null;

  return (
    <div className="webmail-modal-overlay" role="presentation">
      <div className="webmail-modal" role="dialog" aria-modal="true" aria-label="Compose">
        <header className="webmail-modal-head">
          <h2>{mode === 'reply' ? 'Reply' : mode === 'forward' ? 'Forward' : 'Compose'}</h2>
          <button
            type="button"
            className="webmail-icon-btn webmail-icon-btn--panel"
            onClick={requestClose}
            disabled={sending || drafting}
            aria-label="Close"
          >
            <MailIcon name="times" />
          </button>
        </header>
        <div className="webmail-compose-fields">
          <AddressField label="To" value={to} onChange={setTo} contacts={contacts} />
          <AddressField label="Cc" value={cc} onChange={setCc} contacts={contacts} />
          <AddressField label="Bcc" value={bcc} onChange={setBcc} contacts={contacts} />
          <label>
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label>
            Message
            <textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>

          <div className="webmail-compose-sig-block">
            <div className="webmail-compose-sig-head">
              <span>Signature</span>
              {signatures.length ? (
                <select
                  value={selectedSig?.id != null ? String(selectedSig.id) : ''}
                  onChange={(e) => setSignatureId(e.target.value)}
                  aria-label="Choose signature"
                >
                  {signatures.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.isApplied ? ' (applied)' : ''}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            {selectedSig ? (
              <div className="webmail-compose-sig-preview">
                {(selectedSig.mode === 'text' || selectedSig.mode === 'mixed') && selectedSig.textHtml ? (
                  <div
                    className="webmail-compose-sig-html"
                    dangerouslySetInnerHTML={{ __html: selectedSig.textHtml }}
                  />
                ) : null}
                {(selectedSig.mode === 'image' || selectedSig.mode === 'mixed') && sigImageSrc ? (
                  <img src={sigImageSrc} alt="" className="webmail-sig-preview" />
                ) : null}
                {!selectedSig.textHtml && !sigImageSrc ? (
                  <p className="webmail-muted">This signature is empty.</p>
                ) : null}
              </div>
            ) : (
              <p className="webmail-muted">No signature applied. Add one under Signature settings.</p>
            )}
          </div>

          <label className="webmail-file-label">
            <MailIcon name="paperclip" size={14} /> Attachments
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </label>
          {files.length ? (
            <ul className="webmail-file-list">
              {files.map((f) => (
                <li key={`${f.name}-${f.size}`}>{f.name}</li>
              ))}
            </ul>
          ) : null}
          {localError ? <p className="webmail-error">{localError}</p> : null}
        </div>
        <footer className="webmail-modal-foot">
          <button type="button" className="webmail-btn webmail-btn--ghost" onClick={() => handleDraft()} disabled={drafting || sending}>
            {drafting && !closePrompt ? <><Spinner dark sm /> Saving…</> : 'Save draft'}
          </button>
          <button type="button" className="webmail-btn webmail-btn--primary" onClick={handleSend} disabled={sending || drafting || !to.trim()}>
            {sending ? <><Spinner sm /> Sending…</> : 'Send'}
          </button>
        </footer>
      </div>

      {closePrompt ? (
        <div className="webmail-modal-overlay webmail-confirm-overlay" role="presentation">
          <div className="webmail-modal webmail-modal--confirm" role="alertdialog" aria-modal="true" aria-labelledby="webmail-draft-close-title">
            <header className="webmail-modal-head">
              <h2 id="webmail-draft-close-title">Save as draft?</h2>
            </header>
            <p className="webmail-confirm-message">
              You have an unfinished message. Save it to Drafts, or discard what you typed?
            </p>
            <footer className="webmail-modal-foot webmail-modal-foot--wrap">
              <button
                type="button"
                className="webmail-btn webmail-btn--ghost"
                disabled={drafting}
                onClick={() => setClosePrompt(false)}
              >
                Keep writing
              </button>
              <button
                type="button"
                className="webmail-btn"
                disabled={drafting}
                onClick={finishClose}
              >
                Discard
              </button>
              <button
                type="button"
                className="webmail-btn webmail-btn--primary"
                disabled={drafting}
                onClick={() => handleDraft({ closeAfter: true })}
              >
                {drafting ? <><Spinner sm /> Saving…</> : 'Save draft'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ContactsPanel({ open, onClose }) {
  const { data, isFetching, refetch } = useListWebmailContactsQuery({}, { skip: !open });
  const [saveContact, { isLoading: saving }] = useSaveWebmailContactMutation();
  const [deleteContact, { isLoading: deleting }] = useDeleteWebmailContactMutation();
  const [askConfirm, confirmDialog] = useConfirmDialog();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState(null);

  const contacts = useMemo(() => {
    const list = data?.contacts || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        String(c.email || '').toLowerCase().includes(q)
        || String(c.name || '').toLowerCase().includes(q)
        || String(c.notes || '').toLowerCase().includes(q)
    );
  }, [data, search]);

  useEffect(() => {
    if (!open) {
      setName('');
      setEmail('');
      setNotes('');
      setEditId(null);
      setSearch('');
      setMsg(null);
    }
  }, [open]);

  if (!open) return null;

  const resetForm = () => {
    setName('');
    setEmail('');
    setNotes('');
    setEditId(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      await saveContact({
        id: editId || undefined,
        name,
        email,
        notes,
      }).unwrap();
      setMsg(editId ? 'Contact updated' : 'Contact saved');
      resetForm();
      refetch();
    } catch (err) {
      setMsg(err?.data?.message || 'Save failed');
    }
  };

  return (
    <div className="webmail-modal-overlay" role="presentation">
      <div className="webmail-modal" role="dialog" aria-modal="true" aria-label="Contacts">
        <header className="webmail-modal-head">
          <h2>Contacts</h2>
          <button type="button" className="webmail-icon-btn webmail-icon-btn--panel" onClick={onClose} aria-label="Close">
            <MailIcon name="times" />
          </button>
        </header>
        <div className="webmail-compose-fields">
          <form className="webmail-contact-form" onSubmit={handleSave}>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
            </label>
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
            </label>
            <label>
              Notes
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </label>
            <div className="webmail-contact-form-actions">
              {editId ? (
                <button type="button" className="webmail-btn webmail-btn--ghost" onClick={resetForm}>
                  Cancel edit
                </button>
              ) : null}
              <button type="submit" className="webmail-btn webmail-btn--primary" disabled={saving || !email.trim()}>
                {saving ? 'Saving…' : editId ? 'Update contact' : 'Add contact'}
              </button>
            </div>
          </form>
          {msg ? <p className="webmail-muted">{msg}</p> : null}
          <label>
            Search
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find contacts…" />
          </label>
          {isFetching ? <p className="webmail-muted">Loading…</p> : null}
          <ul className="webmail-contact-manage-list">
            {contacts.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="webmail-contact-manage-main"
                  onClick={() => {
                    setEditId(c.id);
                    setName(c.name || '');
                    setEmail(c.email || '');
                    setNotes(c.notes || '');
                  }}
                >
                  <strong>{c.name || c.email}</strong>
                  {c.name ? <span>{c.email}</span> : null}
                  {c.notes ? <em>{c.notes}</em> : null}
                </button>
                <button
                  type="button"
                  className="webmail-icon-btn webmail-icon-btn--danger"
                  title="Delete"
                  disabled={deleting}
                  onClick={async () => {
                    const ok = await askConfirm({
                      title: 'Delete contact',
                      message: `Remove ${c.email} from your contacts?`,
                      confirmLabel: 'Delete',
                      danger: true,
                    });
                    if (!ok) return;
                    try {
                      await deleteContact({ id: c.id }).unwrap();
                      if (editId === c.id) resetForm();
                      refetch();
                    } catch (err) {
                      setMsg(err?.data?.message || 'Delete failed');
                    }
                  }}
                >
                  <MailIcon name="trash" />
                </button>
              </li>
            ))}
            {!isFetching && !contacts.length ? <li className="webmail-empty">No contacts yet</li> : null}
          </ul>
        </div>
        {confirmDialog}
      </div>
    </div>
  );
}

function SignaturePanel({ open, onClose }) {
  const { data, isFetching, refetch } = useGetWebmailSignatureQuery(undefined, { skip: !open });
  const [save, { isLoading: saving }] = useSaveWebmailSignatureMutation();
  const [apply, { isLoading: applying }] = useApplyWebmailSignatureMutation();
  const [remove, { isLoading: deleting }] = useDeleteWebmailSignatureMutation();
  const [askConfirm, confirmDialog] = useConfirmDialog();
  const [editId, setEditId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [mode, setMode] = useState('text');
  const [textHtml, setTextHtml] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [clearImage, setClearImage] = useState(false);
  const [msg, setMsg] = useState(null);

  const signatures = data?.signatures || [];
  const applied = data?.applied || signatures.find((s) => s.isApplied) || null;
  const editing = editId != null
    ? signatures.find((s) => s.id === editId)
    : null;
  const appliedImageSrc = applied?.imageUrl
    ? `${getNodeBackendUrl()}${applied.imageUrl}`
    : null;

  useEffect(() => {
    if (!open) {
      setEditId(null);
      setFormOpen(false);
      setName('');
      setMode('text');
      setTextHtml('');
      setImageFile(null);
      setClearImage(false);
      setMsg(null);
    }
  }, [open]);

  if (!open) return null;

  const resetForm = () => {
    setEditId(null);
    setFormOpen(false);
    setName('');
    setMode('text');
    setTextHtml('');
    setImageFile(null);
    setClearImage(false);
  };

  const startEdit = (sig) => {
    setFormOpen(true);
    setEditId(sig.id);
    setName(sig.name || '');
    setMode(sig.mode || 'text');
    setTextHtml(sig.textHtml || '');
    setImageFile(null);
    setClearImage(false);
    setMsg(null);
  };

  const startCreate = () => {
    setEditId(null);
    setFormOpen(true);
    setName('New signature');
    setMode('text');
    setTextHtml('');
    setImageFile(null);
    setClearImage(false);
    setMsg(null);
  };

  const imagePreview = imageFile
    ? URL.createObjectURL(imageFile)
    : !clearImage && editing?.imageUrl
      ? `${getNodeBackendUrl()}${editing.imageUrl}`
      : null;

  const handleSave = async () => {
    setMsg(null);
    try {
      await save({
        fields: {
          id: editId || '',
          name: name.trim() || 'Signature',
          mode,
          textHtml,
          clearImage: clearImage ? '1' : '0',
        },
        imageFile: imageFile || undefined,
      }).unwrap();
      setMsg(editId ? 'Signature updated' : 'Signature added');
      resetForm();
      refetch();
    } catch (err) {
      setMsg(err?.data?.message || 'Save failed');
    }
  };

  const showForm = formOpen;

  return (
    <div className="webmail-modal-overlay" role="presentation">
      <div className="webmail-modal" role="dialog" aria-modal="true" aria-label="Signatures">
        <header className="webmail-modal-head">
          <h2>Email signatures</h2>
          <button type="button" className="webmail-icon-btn webmail-icon-btn--panel" onClick={onClose} aria-label="Close">
            <MailIcon name="times" />
          </button>
        </header>
        <div className="webmail-compose-fields">
          <p className="webmail-muted">
            Create multiple signatures and use <strong>Apply</strong> to choose the default for new messages and replies.
          </p>

          {applied ? (
            <div className="webmail-sig-applied-box">
              <div className="webmail-sig-applied-head">
                <span className="webmail-sig-badge">Applied</span>
                <strong>{applied.name}</strong>
                <span className="webmail-muted">{applied.mode}</span>
              </div>
              <div className="webmail-sig-applied-body">
                {(applied.mode === 'text' || applied.mode === 'mixed') && applied.textHtml ? (
                  <div
                    className="webmail-compose-sig-html"
                    dangerouslySetInnerHTML={{ __html: applied.textHtml }}
                  />
                ) : null}
                {(applied.mode === 'image' || applied.mode === 'mixed') && appliedImageSrc ? (
                  <img src={appliedImageSrc} alt="" className="webmail-sig-preview" />
                ) : null}
                {!applied.textHtml && !appliedImageSrc ? (
                  <p className="webmail-muted">This signature has no content yet.</p>
                ) : null}
              </div>
            </div>
          ) : !isFetching && signatures.length ? (
            <p className="webmail-muted">No signature is applied yet. Click <strong>Apply</strong> on one below.</p>
          ) : null}

          {isFetching ? <p className="webmail-muted">Loading…</p> : null}
          <ul className="webmail-sig-list">
            {signatures.map((s) => (
              <li key={s.id} className={s.isApplied ? 'is-applied' : ''}>
                <div className="webmail-sig-list-main">
                  <strong>{s.name}</strong>
                  <span>{s.mode}{s.isApplied ? ' · Applied' : ''}</span>
                </div>
                <div className="webmail-sig-list-actions">
                  {!s.isApplied ? (
                    <button
                      type="button"
                      className="webmail-btn webmail-btn--compact webmail-btn--primary"
                      disabled={applying}
                      onClick={async () => {
                        setMsg(null);
                        try {
                          await apply({ id: s.id }).unwrap();
                          setMsg(`Applied “${s.name}”`);
                          refetch();
                        } catch (err) {
                          setMsg(err?.data?.message || 'Apply failed');
                        }
                      }}
                    >
                      Apply
                    </button>
                  ) : (
                    <span className="webmail-sig-badge">Applied</span>
                  )}
                  <button type="button" className="webmail-btn webmail-btn--compact" onClick={() => startEdit(s)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="webmail-icon-btn webmail-icon-btn--danger"
                    title="Delete"
                    disabled={deleting}
                    onClick={async () => {
                      const ok = await askConfirm({
                        title: 'Delete signature',
                        message: `Delete signature “${s.name}”? This cannot be undone.`,
                        confirmLabel: 'Delete',
                        danger: true,
                      });
                      if (!ok) return;
                      setMsg(null);
                      try {
                        await remove({ id: s.id }).unwrap();
                        if (editId === s.id) resetForm();
                        setMsg('Signature deleted');
                        refetch();
                      } catch (err) {
                        setMsg(err?.data?.message || 'Delete failed');
                      }
                    }}
                  >
                    <MailIcon name="trash" />
                  </button>
                </div>
              </li>
            ))}
            {!isFetching && !signatures.length ? (
              <li className="webmail-empty">No signatures yet</li>
            ) : null}
          </ul>

          <div className="webmail-contact-form-actions">
            <button type="button" className="webmail-btn webmail-btn--ghost" onClick={startCreate}>
              + New signature
            </button>
          </div>

          {showForm ? (
            <>
              <h3 className="webmail-sig-form-title">{editId ? 'Edit signature' : 'New signature'}</h3>
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Work, Personal" />
              </label>
              <label>
                Mode
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="mixed">Mixed (text + image)</option>
                </select>
              </label>
              {(mode === 'text' || mode === 'mixed') ? (
                <label>
                  Signature text / HTML
                  <textarea rows={6} value={textHtml} onChange={(e) => setTextHtml(e.target.value)} />
                </label>
              ) : null}
              {(mode === 'image' || mode === 'mixed') ? (
                <>
                  <label className="webmail-file-label">
                    Signature image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        setImageFile(e.target.files?.[0] || null);
                        setClearImage(false);
                      }}
                    />
                  </label>
                  {imagePreview ? (
                    <img className="webmail-sig-preview" src={imagePreview} alt="Signature preview" />
                  ) : null}
                  {editing?.imageUrl ? (
                    <label className="webmail-check">
                      <input type="checkbox" checked={clearImage} onChange={(e) => setClearImage(e.target.checked)} />
                      <span>Remove saved image</span>
                    </label>
                  ) : null}
                </>
              ) : null}
              <div className="webmail-contact-form-actions">
                <button type="button" className="webmail-btn webmail-btn--ghost" onClick={resetForm}>
                  Cancel
                </button>
                <button type="button" className="webmail-btn webmail-btn--primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><Spinner sm /> Saving…</> : editId ? 'Update signature' : 'Save signature'}
                </button>
              </div>
            </>
          ) : null}
          {msg ? <p className="webmail-muted">{msg}</p> : null}
        </div>
        {confirmDialog}
      </div>
    </div>
  );
}

export default function WebmailApp() {
  const navigate = useNavigate();
  const { data: status, isLoading: statusLoading, refetch: refetchStatus, error: statusError } =
    useGetWebmailStatusQuery(undefined, { refetchOnMountOrArgChange: true });
  const connected = Boolean(status?.connected) && !status?.emailMismatch;
  const [folder, setFolder] = useState('inbox');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [selectedUid, setSelectedUid] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState('compose');
  const [composeSeed, setComposeSeed] = useState(null);
  const [sigOpen, setSigOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [disconnect] = useDisconnectWebmailMutation();
  const [saveContact] = useSaveWebmailContactMutation();
  const [retryOutbox, { isLoading: retryingOutbox }] = useRetryWebmailOutboxMutation();
  const [deleteOutbox, { isLoading: deletingOutbox }] = useDeleteWebmailOutboxMutation();
  const [askConfirm, confirmDialog] = useConfirmDialog();
  const [fetchMessage, messageState] = useLazyGetWebmailMessageQuery();

  const showToast = (message, kind = 'ok') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 2800);
  };

  const listArgs = useMemo(
    () => ({ folder, page, pageSize: 30, query: query || undefined }),
    [folder, page, query]
  );

  const {
    refetch: refetchFolders,
  } = useGetWebmailFoldersQuery(undefined, { skip: !connected });

  const {
    data: listData,
    isFetching: listFetching,
    refetch: refetchList,
    error: listError,
  } = useListWebmailMessagesQuery(listArgs, { skip: !connected });

  useEffect(() => {
    setPage(1);
    setSelectedUid(null);
  }, [folder, query]);

  useEffect(() => {
    if (!connected || selectedUid == null) return;
    fetchMessage({ folder, uid: selectedUid });
  }, [connected, folder, selectedUid, fetchMessage]);

  const roleFolders = [
    { id: 'inbox', label: 'Inbox', icon: 'inbox' },
    { id: 'drafts', label: 'Drafts', icon: 'draft' },
    { id: 'sent', label: 'Sent', icon: 'sent' },
    { id: 'outbox', label: 'Outbox', icon: 'outbox' },
    { id: 'spam', label: 'Spam', icon: 'spam' },
    { id: 'trash', label: 'Deleted Items', icon: 'trash' },
  ];

  const selected = messageState.data;
  const messages = listData?.messages || [];

  const openCompose = (mode = 'compose', seed = null) => {
    setComposeMode(mode);
    setComposeSeed(seed);
    setComposeOpen(true);
  };

  const handleReply = () => {
    if (!selected) return;
    openCompose('reply', {
      to: extractEmail(selected.from),
      subject: selected.subject?.startsWith('Re:') ? selected.subject : `Re: ${selected.subject || ''}`,
      body: `\n\n----- Original message -----\nFrom: ${selected.from}\nDate: ${formatWhen(selected.date)}\n\n${selected.text || ''}`,
      inReplyTo: selected.messageId || '',
      references: selected.references || [],
    });
  };

  const handleForward = () => {
    if (!selected) return;
    openCompose('forward', {
      to: '',
      subject: selected.subject?.startsWith('Fwd:') ? selected.subject : `Fwd: ${selected.subject || ''}`,
      body: `\n\n----- Forwarded message -----\nFrom: ${selected.from}\nTo: ${selected.to}\nDate: ${formatWhen(selected.date)}\nSubject: ${selected.subject}\n\n${selected.text || ''}`,
    });
  };

  const handleAddSenderContact = async () => {
    if (!selected?.from) return;
    const email = extractEmail(selected.from);
    if (!email) return;
    try {
      await saveContact({
        email,
        name: extractDisplayName(selected.from) || undefined,
      }).unwrap();
      showToast(`Saved contact: ${email}`, 'ok');
    } catch (err) {
      showToast(err?.data?.message || 'Could not save contact', 'err');
    }
  };

  const handleRetryOutbox = async () => {
    if (!selectedUid || folder !== 'outbox') return;
    try {
      await retryOutbox({ id: selectedUid }).unwrap();
      showToast('Message sent', 'ok');
      setSelectedUid(null);
      refetchList();
    } catch (err) {
      showToast(err?.data?.message || 'Resend failed', 'err');
      refetchList();
      if (selectedUid != null) fetchMessage({ folder: 'outbox', uid: selectedUid });
    }
  };

  const handleDeleteOutbox = async () => {
    if (!selectedUid || folder !== 'outbox') return;
    const ok = await askConfirm({
      title: 'Delete from Outbox',
      message: 'Remove this failed message from Outbox?',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteOutbox({ id: selectedUid }).unwrap();
      showToast('Removed from Outbox', 'ok');
      setSelectedUid(null);
      refetchList();
    } catch (err) {
      showToast(err?.data?.message || 'Delete failed', 'err');
    }
  };

  const activeFolder = roleFolders.find((f) => f.id === folder) || roleFolders[0];
  const listBusy = listFetching && !messages.length;
  const listRefreshing = listFetching && messages.length > 0;

  if (statusLoading) {
    return (
      <div className="webmail-boot">
        <div className="webmail-boot-card">
          <Spinner />
          <p>Opening webmail…</p>
        </div>
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="webmail-boot">
        <div className="webmail-boot-card">
          <p>{statusError?.data?.message || 'Failed to load webmail status'}</p>
          <button type="button" className="webmail-btn webmail-btn--ghost-light" onClick={() => refetchStatus()} style={{ marginTop: 16 }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="webmail-app">
        <header className="webmail-chrome">
          <div className="webmail-chrome-left">
            <button type="button" className="webmail-btn webmail-btn--ghost-light" onClick={() => navigate('/home')}>
              <MailIcon name="arrowLeft" /> Home
            </button>
            <div className="webmail-chrome-brand">
              <div className="webmail-chrome-mark" aria-hidden><MailIcon name="envelope" /></div>
              <div>
                <strong>DSMS Mail</strong>
                <span>{status?.email || 'Connect mailbox'}</span>
              </div>
            </div>
          </div>
          <div />
        </header>
        <ConnectPanel status={status} onConnected={() => { refetchStatus(); refetchFolders(); }} />
      </div>
    );
  }

  return (
    <div className="webmail-app">
      <header className="webmail-chrome">
        <div className="webmail-chrome-left">
          <button type="button" className="webmail-icon-btn" title="Back to home" onClick={() => navigate('/home')}>
            <MailIcon name="arrowLeft" />
          </button>
          <div className="webmail-chrome-brand">
            <div className="webmail-chrome-mark" aria-hidden><MailIcon name="envelope" /></div>
            <div>
              <strong>DSMS Mail</strong>
              <span>{status?.email}</span>
            </div>
          </div>
        </div>
        <div className="webmail-chrome-right">
          <button type="button" className="webmail-btn webmail-btn--primary" onClick={() => openCompose('compose')}>
            <MailIcon name="pen" /> Compose
          </button>
          <button type="button" className="webmail-icon-btn" title="Contacts" onClick={() => setContactsOpen(true)}>
            <MailIcon name="addressBook" />
          </button>
          <button type="button" className="webmail-icon-btn" title="Signature" onClick={() => setSigOpen(true)}>
            <MailIcon name="cog" />
          </button>
          <button
            type="button"
            className="webmail-icon-btn"
            title="Refresh"
            disabled={listFetching}
            onClick={() => { refetchList(); refetchFolders(); }}
          >
            <MailIcon name="sync" className={listFetching ? 'spin' : ''} />
          </button>
          <button
            type="button"
            className="webmail-icon-btn"
            title="Disconnect mailbox"
            onClick={async () => {
              const ok = await askConfirm({
                title: 'Disconnect mailbox',
                message: 'Remove the saved mailbox password from DSMS? You can reconnect later with your email password.',
                confirmLabel: 'Disconnect',
                danger: true,
              });
              if (!ok) return;
              await disconnect();
              refetchStatus();
            }}
          >
            <MailIcon name="signOut" />
          </button>
        </div>
      </header>

      <div className="webmail-shell">
        <aside className="webmail-nav">
          <button
            type="button"
            className="webmail-btn webmail-btn--primary webmail-nav-compose"
            onClick={() => openCompose('compose')}
          >
            <MailIcon name="pen" /> New message
          </button>
          <div className="webmail-nav-label">Folders</div>
          {roleFolders.map((f) => {
            return (
              <button
                key={f.id}
                type="button"
                className={`webmail-folder-btn${folder === f.id ? ' is-active' : ''}`}
                onClick={() => setFolder(f.id)}
              >
                <MailIcon name={f.icon} />
                {f.label}
              </button>
            );
          })}
          <div className="webmail-nav-tools">
            <div className="webmail-nav-label">Tools</div>
            <button type="button" className="webmail-folder-btn" onClick={() => setContactsOpen(true)}>
              <MailIcon name="addressBook" /> Contacts
            </button>
            <button type="button" className="webmail-folder-btn" onClick={() => setSigOpen(true)}>
              <MailIcon name="cog" /> Signature
            </button>
          </div>
        </aside>

        <section className="webmail-list-pane">
          {listRefreshing ? <div className="webmail-list-fetching" aria-hidden /> : null}
          <div className="webmail-list-toolbar">
            <div className="webmail-list-toolbar-title">
              <h2>{activeFolder?.label || 'Mailbox'}</h2>
              <span>{listData?.total != null ? `${listData.total} messages` : '—'}</span>
            </div>
            <form
              className="webmail-search"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(searchInput.trim());
              }}
            >
              <MailIcon name="search" size={14} />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search this folder…"
              />
              <button type="submit">Search</button>
            </form>
          </div>

          {listError ? (
            <p className="webmail-error">{listError?.data?.message || 'Failed to load messages'}</p>
          ) : null}

          {listBusy ? (
            <ListSkeleton />
          ) : (
            <ul className="webmail-msg-list">
              {messages.map((m) => {
                const who = folder === 'sent' || folder === 'drafts' || folder === 'outbox' ? m.to : m.from;
                return (
                  <li key={m.uid}>
                    <button
                      type="button"
                      className={`webmail-msg-row${!m.seen ? ' is-unread' : ''}${selectedUid === m.uid ? ' is-selected' : ''}${m.failed ? ' is-failed' : ''}`}
                      onClick={() => setSelectedUid(m.uid)}
                    >
                      <span className="webmail-msg-avatar" aria-hidden>{initialsFrom(who)}</span>
                      <span className="webmail-msg-main">
                        <span className="webmail-msg-from">{who || '—'}</span>
                        <span className="webmail-msg-subject">
                          {m.failed ? <span className="webmail-failed-tag">Failed</span> : null}
                          {m.hasAttachments ? <MailIcon name="paperclip" size={14} /> : null}
                          {m.subject}
                        </span>
                      </span>
                      <span className="webmail-msg-date">{formatListWhen(m.date)}</span>
                    </button>
                  </li>
                );
              })}
              {!messages.length ? (
                <li className="webmail-empty">
                  {folder === 'outbox' ? 'No failed messages in Outbox' : 'No messages in this folder'}
                </li>
              ) : null}
            </ul>
          )}

          <div className="webmail-pager">
            <button type="button" disabled={page <= 1 || listFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </button>
            <span>
              Page {page}
              {listData?.total != null ? ` · ${listData.total} total` : ''}
            </span>
            <button
              type="button"
              disabled={!listData || listFetching || page * (listData.pageSize || 30) >= (listData.total || 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </section>

        <section className="webmail-read-pane">
          {!selectedUid ? (
            <div className="webmail-empty-pane">
              <MailIcon name="envelope" />
              <div>Select a message to read</div>
            </div>
          ) : messageState.isFetching || messageState.isLoading ? (
            <ReaderSkeleton />
          ) : messageState.error ? (
            <p className="webmail-error">{messageState.error?.data?.message || 'Failed to open message'}</p>
          ) : selected ? (
            <article className="webmail-read-card">
              <header className="webmail-read-head">
                <h2>{selected.subject}</h2>
                {folder === 'outbox' || selected.failed ? (
                  <div className="webmail-outbox-error" role="alert">
                    <strong>Send failed</strong>
                    <span>{selected.errorMessage || 'Could not deliver this message.'}</span>
                  </div>
                ) : null}
                <div className="webmail-read-meta">
                  <div><strong>From</strong> {selected.from}</div>
                  <div><strong>To</strong> {selected.to}</div>
                  {selected.cc ? <div><strong>Cc</strong> {selected.cc}</div> : null}
                  <div><strong>Date</strong> {formatWhen(selected.date)}</div>
                </div>
                <div className="webmail-read-actions">
                  {folder === 'outbox' ? (
                    <>
                      <button
                        type="button"
                        className="webmail-btn webmail-btn--primary"
                        onClick={handleRetryOutbox}
                        disabled={retryingOutbox || deletingOutbox}
                      >
                        {retryingOutbox ? <><Spinner sm /> Sending…</> : <><MailIcon name="sync" /> Retry send</>}
                      </button>
                      <button
                        type="button"
                        className="webmail-btn"
                        onClick={handleDeleteOutbox}
                        disabled={deletingOutbox || retryingOutbox}
                      >
                        <MailIcon name="trash" /> Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="webmail-btn" onClick={handleReply}>
                        <MailIcon name="reply" /> Reply
                      </button>
                      <button type="button" className="webmail-btn" onClick={handleForward}>
                        <MailIcon name="share" /> Forward
                      </button>
                      <button type="button" className="webmail-btn" onClick={handleAddSenderContact}>
                        <MailIcon name="userPlus" /> Save sender
                      </button>
                    </>
                  )}
                </div>
              </header>
              {selected.attachments?.length ? (
                <div className="webmail-attachments">
                  {selected.attachments
                    .filter((a) => !a.related)
                    .map((a) => (
                      <button
                        key={`${a.index}-${a.filename}`}
                        type="button"
                        className="webmail-attachment-chip"
                        onClick={() =>
                          downloadWebmailAttachment({
                            folder,
                            uid: selected.uid,
                            index: a.index,
                            filename: a.filename,
                          }).catch((err) => showToast(err.message, 'err'))
                        }
                      >
                        <MailIcon name="paperclip" size={14} /> {a.filename}
                      </button>
                    ))}
                </div>
              ) : null}
              {selected.html ? (
                <iframe
                  className="webmail-html-frame"
                  title="Message body"
                  sandbox=""
                  srcDoc={selected.html}
                />
              ) : (
                <pre className="webmail-text-body">{selected.text || ''}</pre>
              )}
            </article>
          ) : null}
        </section>
      </div>

      <ComposeModal
        open={composeOpen}
        mode={composeMode}
        seed={composeSeed}
        onClose={() => setComposeOpen(false)}
        onSent={() => refetchList()}
        onDraftSaved={() => {
          showToast('Saved to Drafts', 'ok');
          if (folder !== 'drafts') setFolder('drafts');
        }}
      />
      <ContactsPanel open={contactsOpen} onClose={() => setContactsOpen(false)} />
      <SignaturePanel open={sigOpen} onClose={() => setSigOpen(false)} />
      {confirmDialog}

      {toast ? (
        <div className={`webmail-toast webmail-toast--${toast.kind}`} role="status">
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
