/**
 * Environment-aware OpenAPI server URL for /#/docs (Redoc).
 * Mirrors getNodeBackendUrl() but always includes the /api path prefix.
 */

function getEnvironmentLabel() {
  const env = process.env.REACT_APP_ENV;
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalDevServer = hostname === 'localhost' || hostname === '127.0.0.1';

    if (isLocalDevServer) {
      return 'Development (localhost proxy)';
    }
    if (env === 'production') {
      return 'Production';
    }
    if (env === 'development' || hostname.includes('dev')) {
      return 'Development';
    }
    if (hostname.includes('test')) {
      return 'Test';
    }
    return 'Production';
  }

  if (env === 'production') {
    return 'Production';
  }
  return 'Development';
}

/**
 * @returns {string} OpenAPI servers[0].url value
 */
export function getApiDocsServerUrl() {
  const env = process.env.REACT_APP_ENV;

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalDevServer = hostname === 'localhost' || hostname === '127.0.0.1';

    if (isLocalDevServer) {
      return '/api';
    }

    if (env === 'production') {
      return 'https://dsms-web-api.kenilworthinternational.com/api';
    }
    if (env === 'development' || hostname.includes('dev')) {
      return 'https://dsms-web-api-dev.kenilworthinternational.com/api';
    }
    if (hostname.includes('test')) {
      return 'https://dsms-api-test.kenilworth.international.com/api';
    }
    return 'https://dsms-web-api.kenilworthinternational.com/api';
  }

  if (env === 'production') {
    return 'https://dsms-web-api.kenilworthinternational.com/api';
  }
  return 'https://dsms-web-api-dev.kenilworthinternational.com/api';
}

export function getApiDocsEnvironmentLabel() {
  return getEnvironmentLabel();
}
