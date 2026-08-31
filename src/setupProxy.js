const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * CRA dev server only: proxy API calls so localhost:3000 avoids CORS.
 * - /api → Node backend (dsms-web-api-dev or production)
 */
module.exports = function setupProxy(app) {
  const nodeTarget =
    process.env.REACT_APP_NODE_API_PROXY ||
    (process.env.REACT_APP_ENV === 'production'
      ? 'https://dsms-web-api.kenilworthinternational.com'
      : 'https://dsms-web-api-dev.kenilworthinternational.com');

  app.use(
    '/api',
    createProxyMiddleware({
      target: nodeTarget,
      changeOrigin: true,
      secure: true,
      timeout: 120000,
      proxyTimeout: 120000,
      logLevel: process.env.REACT_APP_PROXY_DEBUG === '1' ? 'debug' : 'warn',
    })
  );

  app.use(
    ['/uploads', '/documents'],
    createProxyMiddleware({
      target: nodeTarget,
      changeOrigin: true,
      secure: true,
      logLevel: 'warn',
    })
  );
};