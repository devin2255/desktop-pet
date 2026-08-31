'use strict';

const assert = require('assert');
const { createStoreApi } = require('../src/store-api');

const calls = [];
const fakeFetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  if (String(url).includes('/api/client/library')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          pets: [
            {
              petInstanceId: 'pet1',
              species: 'cat',
              displayName: '猫',
              base: {
                packId: 'base-cat-v1',
                contentVersion: 1,
                downloadPath: '/api/client/packs/download?packId=base-cat-v1'
              },
              actions: []
            }
          ]
        }
      })
    };
  }
  if (String(url).includes('/api/client/packs/download')) {
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => Uint8Array.from([0x50, 0x4b]).buffer,
      headers: { get: () => 'attachment; filename="base-cat-v1.petpack"' }
    };
  }
  return { ok: false, status: 404, json: async () => ({ ok: false, error: 'nope' }) };
};

(async () => {
  const api = createStoreApi({
    baseUrl: 'http://localhost:3000',
    token: 'abc',
    fetchImpl: fakeFetch
  });
  const library = await api.fetchLibrary();
  assert.strictEqual(library.pets.length, 1);
  assert.strictEqual(calls[0].init.headers.Authorization, 'Bearer abc');

  const buf = await api.downloadPack('base-cat-v1');
  assert.ok(Buffer.isBuffer(buf));
  assert.ok(String(calls[1].url).includes('packId=base-cat-v1'));

  const api401 = createStoreApi({
    baseUrl: 'http://localhost:3000',
    token: 'bad',
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ ok: false }) })
  });
  await assert.rejects(() => api401.fetchLibrary(), /STORE_UNAUTHORIZED/);

  console.log('test-store-api: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
