import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiDocsEnvironmentLabel, getApiDocsServerUrl } from '../config/apiDocsServer';
import '../styles/api-docs.css';

const REDOC_SCRIPT_ID = 'redoc-standalone-script';
const REDOC_CONTAINER_ID = 'redoc-container';

/**
 * Wait up to `timeoutMs` for window.Redoc to become available.
 * Needed because the script tag may already exist in the DOM (e.g. on remount)
 * while the JS is still evaluating.
 */
function waitForRedoc(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (window.Redoc) { resolve(); return; }
    const interval = 50;
    let elapsed = 0;
    const timer = setInterval(() => {
      if (window.Redoc) { clearInterval(timer); resolve(); return; }
      elapsed += interval;
      if (elapsed >= timeoutMs) {
        clearInterval(timer);
        reject(new Error('Redoc global not available after script load — try refreshing'));
      }
    }, interval);
  });
}

function loadRedocScript() {
  return new Promise((resolve, reject) => {
    // Script tag already in DOM — just wait for window.Redoc to be ready
    if (document.getElementById(REDOC_SCRIPT_ID)) {
      waitForRedoc().then(resolve).catch(reject);
      return;
    }
    const script = document.createElement('script');
    script.id = REDOC_SCRIPT_ID;
    script.src = `${process.env.PUBLIC_URL || ''}/api-docs/redoc.standalone.js`;
    script.onload = () => waitForRedoc().then(resolve).catch(reject);
    script.onerror = () => reject(new Error('Failed to load redoc.standalone.js — run npm run prepare:public and refresh'));
    document.head.appendChild(script);
  });
}

export default function ApiDocsPage() {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'error' | 'ready'
  const [errorMsg, setErrorMsg] = useState('');

  const serverUrl = getApiDocsServerUrl();
  const environmentLabel = getApiDocsEnvironmentLabel();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 1. Load the standalone bundle (no-op if already loaded)
        await loadRedocScript();
        if (cancelled) return;

        // 2. Fetch the generated OpenAPI spec
        const res = await fetch(`${process.env.PUBLIC_URL || ''}/api-docs/openapi.json`);
        if (!res.ok) throw new Error(`Failed to load API spec (HTTP ${res.status})`);
        const spec = await res.json();
        if (cancelled) return;

        // 3. Patch the servers list with the runtime env URL
        const patchedSpec = {
          ...spec,
          servers: [
            {
              url: serverUrl,
              description: `${environmentLabel} — active backend for this session`,
            },
          ],
        };

        // 4. Use the globally exposed Redoc.init() — guaranteed available by loadRedocScript()
        if (containerRef.current) {
          await window.Redoc.init(
            patchedSpec,
            {
              scrollYOffset: 56,
              hideDownloadButton: false,
              expandResponses: '200,201',
              jsonSampleExpandLevel: 2,
              theme: {
                colors: { primary: { main: '#2563eb' } },
                typography: {
                  fontSize: '15px',
                  fontFamily: 'Segoe UI, system-ui, sans-serif',
                },
                sidebar: { width: '280px' },
              },
            },
            containerRef.current
          );
          if (!cancelled) setStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err.message || 'Unknown error');
          setStatus('error');
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl]);

  return (
    <div className="api-docs-page">
      <header className="api-docs-banner">
        <div className="api-docs-banner__left">
          <Link to="/home" className="api-docs-banner__back">
            ← Back to app
          </Link>
          <span className="api-docs-banner__title">DSMS API Documentation</span>
        </div>
        <div className="api-docs-banner__right">
          <span className="api-docs-banner__env">Environment: {environmentLabel}</span>
          <code className="api-docs-banner__url">{serverUrl}</code>
        </div>
      </header>

      <div className="api-docs-redoc">
        {status === 'loading' && (
          <div className="api-docs-loading">Loading API documentation…</div>
        )}
        {status === 'error' && (
          <div className="api-docs-error">
            <strong>Could not load API documentation</strong>
            <p>{errorMsg}</p>
            <p>
              If this is a first load, run <code>npm run prepare:public</code> in the{' '}
              <code>dsms_frontend</code> directory, then refresh.
            </p>
          </div>
        )}
        {/* Redoc.init() mounts into this div directly */}
        <div
          id={REDOC_CONTAINER_ID}
          ref={containerRef}
          style={{ display: status === 'ready' ? 'block' : 'none' }}
        />
      </div>
    </div>
  );
}
