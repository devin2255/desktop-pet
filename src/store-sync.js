'use strict';

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { createStoreApi } = require('./store-api');
const { composedPetId } = require('./store-ids');
const { composePetTo } = require('./store-compose');

async function ensurePackCached({ api, cacheRoot, packId, contentVersion }) {
  const dir = path.join(cacheRoot, packId);
  const metaPath = path.join(dir, 'meta.json');
  const packPath = path.join(dir, 'pack.petpack');
  const unpacked = path.join(dir, 'unpacked');
  if (fs.existsSync(metaPath) && fs.existsSync(unpacked)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (meta.contentVersion === contentVersion) return unpacked;
  }
  fs.mkdirSync(dir, { recursive: true });
  const buf = await api.downloadPack(packId);
  fs.writeFileSync(packPath, buf);
  if (fs.existsSync(unpacked)) fs.rmSync(unpacked, { recursive: true, force: true });
  fs.mkdirSync(unpacked, { recursive: true });
  new AdmZip(packPath).extractAllTo(unpacked, true);
  const commercePath = path.join(unpacked, 'petpack.json');
  if (!fs.existsSync(commercePath)) throw new Error('MISSING_PETPACK_JSON');
  const commerce = JSON.parse(fs.readFileSync(commercePath, 'utf8'));
  if (commerce.packId !== packId) throw new Error('PACK_ID_MISMATCH');
  fs.writeFileSync(
    metaPath,
    `${JSON.stringify({ packId, contentVersion, cachedAt: new Date().toISOString() }, null, 2)}\n`
  );
  return unpacked;
}

async function syncStoreLibrary({ baseUrl, token, cacheRoot, libraryRoot, fetchImpl }) {
  const api = createStoreApi({ baseUrl, token, fetchImpl });
  const library = await api.fetchLibrary();
  const composed = [];

  for (const pet of library.pets || []) {
    if (!pet.base?.packId) continue;
    const baseDir = await ensurePackCached({
      api,
      cacheRoot,
      packId: pet.base.packId,
      contentVersion: pet.base.contentVersion ?? 1
    });
    const actionDirs = [];
    for (const action of pet.actions || []) {
      try {
        actionDirs.push(
          await ensurePackCached({
            api,
            cacheRoot,
            packId: action.packId,
            contentVersion: action.contentVersion ?? 1
          })
        );
      } catch (error) {
        console.warn('skip action', action.packId, error.message);
      }
    }
    const id = composedPetId(pet.petInstanceId);
    const outDir = path.join(libraryRoot, id);
    composePetTo({
      baseDir,
      actionDirs,
      composedId: id,
      displayName: pet.displayName || id,
      outDir
    });
    composed.push({
      petInstanceId: pet.petInstanceId,
      composedId: id,
      displayName: pet.displayName
    });
  }
  return { pets: composed };
}

module.exports = { syncStoreLibrary, ensurePackCached };
