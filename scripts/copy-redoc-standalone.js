/**
 * Copies redoc.standalone.js from node_modules into public/api-docs/
 * so the ApiDocsPage can load it via a plain <script> tag without
 * bundling it through webpack (which causes MobX version conflicts).
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'redoc', 'bundles', 'redoc.standalone.js');
const destDir = path.join(__dirname, '..', 'public', 'api-docs');
const dest = path.join(destDir, 'redoc.standalone.js');

if (!fs.existsSync(src)) {
  console.error('redoc standalone bundle not found — run npm install first.');
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Copied redoc.standalone.js -> public/api-docs/redoc.standalone.js`);
