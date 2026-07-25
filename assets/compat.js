(function (global) {
  function getBasePath(pathname = '/') {
    const normalized = pathname.replace(/\/+/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (!parts.length || parts[0] === 'api' || parts[0] === 'assets' || normalized === '/') {
      return '/';
    }
    return `/${parts[0]}/`;
  }

  function resolveUrl(path, baseUrl = (global.location && global.location.href) || 'http://localhost/') {
    if (!path) return path;
    if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path;
    if (path.startsWith('/')) {
      const basePath = getBasePath(global.location?.pathname || '/');
      if (basePath === '/') return path;
      return `${basePath}${path.replace(/^\/+/, '')}`;
    }
    return new URL(path, baseUrl).toString();
  }

  const api = {
    getBasePath,
    resolveUrl
  };

  global.XMCompat = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
