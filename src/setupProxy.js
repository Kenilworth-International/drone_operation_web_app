const { createProxyMiddleware } = require('http-proxy-middleware');

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

  app.use('/api', createProxyMiddleware(proxyCommon));
  app.use(['/uploads', '/documents'], createProxyMiddleware(proxyCommon));
};
