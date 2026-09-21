'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyRightPointer,
  unfoldTravelPx,
  canUnfold,
  clampOpenBounds,
  clampToWorkArea,
  placeUnfoldedPair,
  memberWindowSize,
  foldMovingBounds,
  tentOpenProgress,
  tentWindowBounds,
  tabletWindowSize,
  placeTabletWindow,
  presentationWindowSize,
  slackWindowSize,
  placeSlackWindow,
  createDuoController
} = require('../src/duo-controller');

assert.deepStrictEqual(classifyRightPointer({ dx: 0, dy: 0 }), { kind: 'menu' });
assert.deepStrictEqual(classifyRightPointer({ dx: 8, dy: 2 }), { kind: 'menu' });
assert.deepStrictEqual(
  classifyRightPointer({ dx: 60, dy: 10 }),
  { kind: 'duo', direction: 'right' }
);
assert.deepStrictEqual(
  classifyRightPointer({ dx: -60, dy: 8 }),
  { kind: 'duo', direction: 'left' }
);
assert.deepStrictEqual(classifyRightPointer({ dx: 20, dy: 80 }), { kind: 'menu' });

assert.deepStrictEqual(
  classifyRightPointer({ dx: 24, dy: 4 }),
  { kind: 'duo', direction: 'right' }
);
assert.strictEqual(unfoldTravelPx(1000), 120);
assert.strictEqual(unfoldTravelPx(200), 64);
assert.strictEqual(unfoldTravelPx(2000), 120);

const work = { x: 0, y: 0, width: 1000, height: 800 };
const size = { width: 180, height: 220 };
assert.strictEqual(canUnfold(work, size), true);
assert.strictEqual(canUnfold({ ...work, width: 300 }, size), false);

const foldStart = { x: 40, y: 500, width: 180, height: 220 };
const foldTarget = { x: 700, y: 480, width: 180, height: 220 };
assert.deepStrictEqual(foldMovingBounds(0, foldStart, foldTarget), foldStart);
assert.deepStrictEqual(foldMovingBounds(1, foldStart, foldTarget), foldTarget);
assert.strictEqual(foldMovingBounds(0.5, foldStart, foldTarget).x, 370);

const left = clampOpenBounds('left', { x: 900, y: 100, width: 180, height: 220 }, work);
assert.ok(left.x + left.width <= 500);
const right = clampOpenBounds('right', { x: 0, y: 100, width: 180, height: 220 }, work);
assert.ok(right.x >= 500);

const duo = createDuoController({});
assert.strictEqual(duo.mode(), 'folded');
assert.strictEqual(duo.beginUnfold('right'), true);
assert.strictEqual(duo.mode(), 'unfolding');
duo.setTravelPx(200);
duo.updateDrag(40);
assert.ok(duo.progress() > 0 && duo.progress() < 0.5);
const snapBack = duo.release();
assert.strictEqual(snapBack.commit, false);
assert.strictEqual(duo.mode(), 'folded');

assert.strictEqual(duo.beginUnfold('left'), true);
duo.setTravelPx(200);
duo.updateDrag(-150);
const opened = duo.release();
assert.strictEqual(opened.commit, true);
assert.strictEqual(duo.mode(), 'open');

assert.strictEqual(duo.beginFold('left'), true);
duo.setTravelPx(200);
duo.updateDrag(40);
assert.strictEqual(duo.release().commit, false);
assert.strictEqual(duo.mode(), 'open');

assert.strictEqual(duo.beginFold('right'), true);
duo.setTravelPx(200);
duo.updateDrag(-150);
assert.strictEqual(duo.release().commit, true);
assert.strictEqual(duo.mode(), 'folded');

duo.beginUnfold('right');
duo.cancel();
assert.strictEqual(duo.mode(), 'folded');
assert.strictEqual(duo.progress(), 0);

const member = memberWindowSize({ width: 170, height: 190 });
assert.ok(member.width < 170 && member.height < 190, 'open members must stay smaller than the folded window');
assert.ok(member.width >= 96 && member.height >= 108);

const highOrigin = { x: 700, y: 80, width: 170, height: 190 };
const pair = placeUnfoldedPair(highOrigin, member, work);
assert.ok(Math.abs(pair.left.y - pair.right.y) <= 1, 'unfolded pair must share a baseline');
assert.ok(pair.left.x >= work.x && pair.right.x + pair.right.width <= work.x + work.width);
assert.ok(pair.right.x >= pair.left.x + pair.left.width, 'right member sits beside the left member');
assert.ok(Math.abs(pair.left.x - highOrigin.x) < 40, 'must unfold beside the current window');
assert.ok(pair.left.x > 500, 'must not snap the pair onto the left half');
assert.ok(Math.abs((pair.left.y + pair.left.height) - (highOrigin.y + highOrigin.height)) <= 2, 'keep the folded foot baseline');

const rightEdge = placeUnfoldedPair({ x: 860, y: 400, width: 170, height: 190 }, member, work);
assert.ok(rightEdge.right.x + rightEdge.right.width <= 1000);
assert.ok(rightEdge.left.x >= 0);

const clamped = clampToWorkArea({ x: -40, y: 900, width: 180, height: 220 }, work);
assert.strictEqual(clamped.x, 0);
assert.strictEqual(clamped.y, 580);

assert.strictEqual(tentOpenProgress(undefined), 0.48);
assert.strictEqual(tentOpenProgress(0.48), 0.48);
assert.strictEqual(tentOpenProgress(0.2), 0.35);
assert.strictEqual(tentOpenProgress(0.9), 0.65);

const foldedBounds = { x: 100, y: 400, width: 170, height: 190 };
const tentBounds = tentWindowBounds(foldedBounds, 40);
assert.strictEqual(tentBounds.width, 170);
assert.strictEqual(tentBounds.height, 230);
assert.strictEqual(tentBounds.y, 360);
assert.strictEqual(tentBounds.y + tentBounds.height, foldedBounds.y + foldedBounds.height);

const tablet = tabletWindowSize({ width: 170, height: 190 });
assert.strictEqual(tablet.height, 190);
assert.strictEqual(tablet.width, Math.round(190 * 4 / 3), 'unfold chrome is official 4:3 landscape');
const tabletRight = placeTabletWindow(foldedBounds, tablet, work, 'right');
assert.strictEqual(tabletRight.y + tabletRight.height, foldedBounds.y + foldedBounds.height);
assert.strictEqual(tabletRight.x, foldedBounds.x);
const tabletLeft = placeTabletWindow(foldedBounds, tablet, work, 'left');
assert.strictEqual(tabletLeft.x + tabletLeft.width, foldedBounds.x + foldedBounds.width);

const noTent = createDuoController({});
assert.strictEqual(noTent.beginTent(), false);
assert.strictEqual(noTent.mode(), 'folded');

const tentDuo = createDuoController({ tentEnabled: true });
assert.strictEqual(tentDuo.beginTent(), true);
assert.strictEqual(tentDuo.mode(), 'tent');
assert.strictEqual(tentDuo.beginUnfold('right'), false, 'gesture unfold from tent must fail');
assert.strictEqual(tentDuo.mode(), 'tent');
assert.strictEqual(tentDuo.beginUnfold('right', { fromMenu: true }), true);
assert.strictEqual(tentDuo.mode(), 'unfolding');
tentDuo.cancel();
assert.strictEqual(tentDuo.mode(), 'tent', 'cancel unfold must return to tent');
assert.strictEqual(tentDuo.leaveTent(), true);
assert.strictEqual(tentDuo.mode(), 'folded');
assert.strictEqual(tentDuo.leaveTent(), false);

assert.strictEqual(tentDuo.beginUnfold('right'), true);
tentDuo.setTravelPx(200);
tentDuo.updateDrag(200);
assert.strictEqual(tentDuo.release().mode, 'open');
assert.strictEqual(tentDuo.beginTent(), false, 'open cannot enter tent');
assert.strictEqual(tentDuo.mode(), 'open');

const petSize = { width: 170, height: 190, label: '小（推荐）' };
assert.deepStrictEqual(presentationWindowSize(petSize, 'folded'), petSize);
assert.deepStrictEqual(presentationWindowSize(petSize, 'unfolding'), tabletWindowSize(petSize));
assert.deepStrictEqual(
  presentationWindowSize(petSize, 'unfolding', { peerOpen: true }),
  memberWindowSize(petSize),
  'committing unfold must keep member size, not snap back to the tablet frame'
);
assert.deepStrictEqual(presentationWindowSize(petSize, 'open'), memberWindowSize(petSize));
assert.deepStrictEqual(presentationWindowSize(petSize, 'folding'), memberWindowSize(petSize));
assert.strictEqual(presentationWindowSize(petSize, 'tent', { tentExtraHeight: 56 }).height, 246);

const slackOff = createDuoController({});
assert.strictEqual(slackOff.beginSlack(), false);

const slackDuo = createDuoController({ slackEnabled: true, tentEnabled: true });
assert.strictEqual(slackDuo.beginSlack(), true);
assert.strictEqual(slackDuo.mode(), 'slack');
assert.strictEqual(slackDuo.beginUnfold('right'), false, 'slack blocks gesture unfold');
assert.strictEqual(slackDuo.beginTent(), false, 'slack cannot tent');
assert.strictEqual(slackDuo.leaveSlack(), true);
assert.strictEqual(slackDuo.mode(), 'folded');

assert.strictEqual(slackDuo.beginTent(), true);
assert.strictEqual(slackDuo.beginSlack(), false, 'tent cannot slack');
slackDuo.leaveTent();

assert.strictEqual(createDuoController({ slackEnabled: true }).beginUnfold('right'), true);

const slackSize = slackWindowSize(petSize, 96);
assert.strictEqual(slackSize.height, 286);
assert.strictEqual(slackSize.width, Math.round(190 * 4 / 3));
assert.deepStrictEqual(
  presentationWindowSize(petSize, 'slack', { slackExtraHeight: 96 }),
  slackSize
);

const origin = { x: 100, y: 400, width: 170, height: 190 };
const placed = placeSlackWindow(origin, slackSize, { x: 0, y: 0, width: 1000, height: 800 });
assert.strictEqual(placed.y + placed.height, origin.y + origin.height, 'foot stays');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main-v3.js'), 'utf8');
assert.match(mainSource, /presentationWindowSize\(currentSize\(\), duo\.mode\(\)/);
assert.match(mainSource, /peerOpen:\s*duoIsOpen\(\)/);

console.log('test-duo-controller: ok');
