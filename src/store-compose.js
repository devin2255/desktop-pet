'use strict';

const fs = require('fs');
const path = require('path');
const {
  validateManifest,
  validateActionPetJson,
  referencedFiles,
  safeRelative
} = require('./petpack-validator');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function composePetTo({ baseDir, actionDirs = [], composedId, displayName, outDir }) {
  const baseManifest = readJson(path.join(baseDir, 'pet.json'));
  validateManifest(baseManifest);

  const merged = JSON.parse(JSON.stringify(baseManifest));
  merged.id = composedId;
  merged.name = displayName || baseManifest.name;

  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const rel of referencedFiles(baseManifest)) {
    const parts = safeRelative(rel);
    copyFile(path.join(baseDir, ...parts), path.join(outDir, ...parts));
  }

  for (const actionDir of actionDirs) {
    const actionManifest = readJson(path.join(actionDir, 'pet.json'));
    validateActionPetJson(actionManifest);
    for (const [action, animation] of Object.entries(actionManifest.animations)) {
      const newFrames = [];
      for (const frame of animation.frames) {
        const parts = safeRelative(frame);
        const destRel = parts.join('/');
        copyFile(path.join(actionDir, ...parts), path.join(outDir, ...parts));
        newFrames.push(destRel);
      }
      merged.animations[action] = { ...animation, frames: newFrames };
    }
  }

  validateManifest(merged);
  fs.writeFileSync(path.join(outDir, 'pet.json'), `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  return { outDir, manifest: merged };
}

module.exports = { composePetTo };
