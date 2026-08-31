'use strict';

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/+$/, '');
}

function createStoreApi({ baseUrl, token, fetchImpl }) {
  const root = normalizeBaseUrl(baseUrl);
  const fetchFn = fetchImpl || globalThis.fetch;
  if (!root) throw new Error('STORE_BASE_URL_MISSING');
  if (!token) throw new Error('STORE_TOKEN_MISSING');
  if (typeof fetchFn !== 'function') throw new Error('FETCH_UNAVAILABLE');

  async function request(path, { asBuffer = false } = {}) {
    const url = path.startsWith('http') ? path : `${root}${path.startsWith('/') ? '' : '/'}${path}`;
    const res = await fetchFn(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401) {
      const err = new Error('STORE_UNAUTHORIZED');
      err.status = 401;
      throw err;
    }
    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        detail = body.error || body.code || '';
      } catch {
        /* ignore */
      }
      const err = new Error(detail || `STORE_HTTP_${res.status}`);
      err.status = res.status;
      throw err;
    }
    if (asBuffer) {
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }
    const json = await res.json();
    if (!json || json.ok === false) {
      throw new Error(json?.error || 'STORE_BAD_RESPONSE');
    }
    return json.data;
  }

  return {
    fetchLibrary: () => request('/api/client/library'),
    downloadPack: (packId) =>
      request(`/api/client/packs/download?packId=${encodeURIComponent(packId)}`, {
        asBuffer: true
      })
  };
}

module.exports = { createStoreApi, normalizeBaseUrl };
