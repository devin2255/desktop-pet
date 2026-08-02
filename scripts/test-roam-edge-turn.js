#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { nextRoamFacing } = require('../src/roam-edge');

const workArea = { x: 0, y: 40, width: 800, height: 520 };
const width = 100;

assert.strictEqual(
  nextRoamFacing('right', workArea.x + workArea.width - width, width, workArea),
  'left',
  'right edge turns facing left'
);

assert.strictEqual(
  nextRoamFacing('left', workArea.x, width, workArea),
  'right',
  'left edge turns facing right'
);

assert.strictEqual(
  nextRoamFacing('right', 300, width, workArea),
  'right',
  'mid work-area keeps facing right'
);

assert.strictEqual(
  nextRoamFacing('left', 300, width, workArea),
  'left',
  'mid work-area keeps facing left'
);

console.log('roam-edge-turn: all assertions passed');
