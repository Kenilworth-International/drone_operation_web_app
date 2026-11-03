const https = require('https');
const { createProxyMiddleware } = require('http-proxy-middleware');

const CPC_ACTIVE_PRICES_URL = 'https://api.ceypetco.gov.lk/api/admin/fuel-prices/active';

/**
 * CRA cannot reliably reverse-proxy CPC via http-proxy-middleware (mount/pathRewrite
 * often falls through to Express 404 / index.html → JSON parse of "<!DOCTYPE").
 * Bridge the one endpoint with a native https GET instead.
 */
function registerCpcFuelBridge(app) {
  app.get('/cpc-fuel/api/admin/fuel-prices/active', (req, res) => {
    const upstream = https.request(
      CPC_ACTIVE_PRICES_URL,
      {
        method: 'GET',
        family: 4,
        timeout: 45000,
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://ceypetco.gov.lk/marketing-sales/',
          Origin: 'https://ceypetco.gov.lk',
          Connection: 'close',
        },
      },
      (upRes) => {
        const chunks = [];
        upRes.on('data', (chunk) => chunks.push(chunk));
        upRes.on('end', () => {
          const body = Buffer.concat(chunks);
          const contentType = upRes.headers['content-type'] || 'application/json; charset=utf-8';
          if (!res.headersSent) {
            res.statusCode = upRes.statusCode || 502;
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'no-store');
            res.end(body);
          }
        });
      }
    );
    upstream.on('timeout', () => {
      upstream.destroy(Object.assign(new Error('CPC upstream timed out'), { code: 'ETIMEDOUT' }));
    });
    upstream.on('error', (err) => {
      console.warn(`[setupProxy] CPC bridge error: ${err.code || err.message}`);
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          message: `CPC upstream unreachable (${err.code || err.message})`,
        });
      }
    });
    upstream.end();
  });
}

/**
 * CRA dev server only: proxy API / uploads so localhost:3000 avoids CORS.
 * Default target: dsms-web-api-dev (or production if REACT_APP_ENV=production).
 * Optional: REACT_APP_NODE_API_PROXY=http://localhost:PORT for local backend.
 */
module.exports = function setupProxy(app) {
  const nodeTarget =
    process.env.REACT_APP_NODE_API_PROXY ||
    (process.env.REACT_APP_ENV === 'production'
      ? 'https://dsms-web-api.kenilworthinternational.com'
      : 'https://dsms-web-api-dev.kenilworthinternational.com');

  const proxyCommon = {
    target: nodeTarget,
    changeOrigin: true,
    secure: true,
    timeout: 120000,
    proxyTimeout: 120000,
    logLevel: process.env.REACT_APP_PROXY_DEBUG === '1' ? 'debug' : 'warn',
    onError(err, req, res) {
      console.warn(`[setupProxy] ${req.method} ${req.url} → ${nodeTarget}: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: false,
            message: 'Upstream API timeout/unavailable',
            target: nodeTarget,
          }),
        );
      }
    },
  };

  // Register before /api catch-all so the path is handled locally.
  registerCpcFuelBridge(app);

  app.use('/api', createProxyMiddleware(proxyCommon));
  app.use(['/uploads', '/documents'], createProxyMiddleware(proxyCommon));
};
