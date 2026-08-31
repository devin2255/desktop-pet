'use strict';

const { createHash } = require('crypto');
const { PET_ID_PATTERN } = require('./petpack-validator');

function composedPetId(petInstanceId) {
  const raw = String(petInstanceId || '');
  const digest = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  const id = `store-${digest}`;
  if (!PET_ID_PATTERN.test(id)) throw new Error(`composed id invalid: ${id}`);
  return id;
}

module.exports = { composedPetId };
