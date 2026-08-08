'use strict';

const assert = require('assert');
const { PET_ID_PATTERN } = require('../src/petpack-validator');
const { composedPetId } = require('../src/store-ids');

const id = composedPetId('clxyz0123456789abcdefgh');
assert.match(id, PET_ID_PATTERN);
assert.ok(id.startsWith('store-'));
assert.notStrictEqual(composedPetId('claaa'), composedPetId('clbbb'));

console.log('test-store-ids: ok');
