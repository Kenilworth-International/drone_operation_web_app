/**
 * Generate OpenAPI spec for /#/docs.
 *
 * Local (WebApp monorepo): runs dsms_backend_dev/scripts/generate-openapi.js
 * Jenkins / frontend-only checkout: skips generation and uses committed
 * public/api-docs/openapi.json (copied into build by CRA).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const FRONTEND_ROOT = path.join(__dirname, '..');
const BACKEND_GENERATOR = path.join(
  FRONTEND_ROOT,
  '..',
  'dsms_backend_dev',
  'scripts',
  'generate-openapi.js'
);
const COMMITTED_SPEC = path.join(FRONTEND_ROOT, 'public', 'api-docs', 'openapi.json');

function runBackendGenerator() {
  console.log('[generate:api-docs] Running backend generator:', BACKEND_GENERATOR);
  const result = spawnSync(process.execPath, [BACKEND_GENERATOR], {
    cwd: path.dirname(BACKEND_GENERATOR),
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function useCommittedSpec(reason) {
  if (!fs.existsSync(COMMITTED_SPEC)) {
    console.error(
      '[generate:api-docs] ERROR: Backend generator not available and no committed spec at:',
      COMMITTED_SPEC
    );
    console.error(
      '[generate:api-docs] Regenerate locally (npm run generate:api-docs) and commit public/api-docs/openapi.json.'
    );
    process.exit(1);
  }
  console.warn(`[generate:api-docs] ${reason}`);
  console.warn('[generate:api-docs] Using committed spec:', COMMITTED_SPEC);
}

if (fs.existsSync(BACKEND_GENERATOR)) {
  runBackendGenerator();
} else {
  useCommittedSpec(
    'dsms_backend_dev not found (frontend-only CI checkout). Skipping live generation.'
  );
}
