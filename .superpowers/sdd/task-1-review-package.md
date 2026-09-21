# Task 1 review package (uncommitted; files are untracked so git diff HEAD is empty)

Status: ?? src/duo-controller.js  ?? scripts/test-duo-controller.js
Base: none (untracked)
Head: working tree


## src/duo-controller.js
```js

'use strict';

function classifyRightPointer(input) {
  const dx = Number(input?.dx) || 0;
  const dy = Number(input?.dy) || 0;
  const menuSlopPx = input?.menuSlopPx != null ? Number(input.menuSlopPx) : 12;
  const commitPx = input?.commitPx != null ? Number(input.commitPx) : 20;
  const distance = Math.hypot(dx, dy);

  if (distance < menuSlopPx) {
    return { kind: 'menu' };
  }
  if (Math.abs(dx) >= commitPx && Math.abs(dx) > Math.abs(dy)) {
    return { kind: 'duo', direction: dx > 0 ? 'right' : 'left' };
  }
  return { kind: 'menu' };
}

function unfoldTravelPx(workAreaWidth) {
  const width = Number(workAreaWidth) || 0;
  const raw = Math.round(width * 0.12);
  return Math.min(120, Math.max(64, raw));
}

function canUnfold(workArea, windowSize, gapPx = 24) {
  const workWidth = Number(workArea?.width) || 0;
  const windowWidth = Number(windowSize?.width) || 0;
  const gap = Number(gapPx) || 0;
  return workWidth >= windowWidth * 2 + gap;
}

function lerpBounds(from, to, t) {
  const u = Math.min(1, Math.max(0, Number(t) || 0));
  return {
    x: Math.round(from.x + (to.x - from.x) * u),
    y: Math.round(from.y + (to.y - from.y) * u),
    width: Math.round(from.width + (to.width - from.width) * u),
    height: Math.round(from.height + (to.height - from.height) * u)
  };
}

function foldMovingBounds(progress, startBounds, targetBounds) {
  return lerpBounds(startBounds, targetBounds, progress);
}

function memberWindowSize(size, scale = 0.85) {
  return {
    width: Math.max(96, Math.round((Number(size?.width) || 0) * scale)),
    height: Math.max(108, Math.round((Number(size?.height) || 0) * scale)),
    ...(size && size.label ? { label: size.label } : {})
  };
}

function clampToWorkArea(bounds, workArea) {
  const width = Number(bounds?.width) || 0;
  const height = Number(bounds?.height) || 0;
  const minX = workArea.x;
  const maxX = workArea.x + workArea.width - width;
  const minY = workArea.y;
  const maxY = workArea.y + workArea.height - height;
  return {
    x: Math.round(Math.min(Math.max(Number(bounds?.x) || 0, minX), maxX)),
    y: Math.round(Math.min(Math.max(Number(bounds?.y) || 0, minY), maxY)),
    width,
    height
  };
}

function placeUnfoldedPair(origin, memberSize, workArea, gapPx = 8) {
  const gap = Number(gapPx) || 0;
  const width = memberSize.width;
  const height = memberSize.height;
  const footY = (Number(origin?.y) || 0) + (Number(origin?.height) || height);
  const y = footY - height;
  let leftX = Number(origin?.x) || workArea.x;
  let rightX = leftX + width + gap;
  const maxX = workArea.x + workArea.width - width;
  if (rightX > maxX) {
    rightX = maxX;
    leftX = rightX - width - gap;
  }
  if (leftX < workArea.x) {
    leftX = workArea.x;
    rightX = Math.min(maxX, leftX + width + gap);
  }
  return {
    left: clampToWorkArea({ x: leftX, y, width, height }, workArea),
    right: clampToWorkArea({ x: rightX, y, width, height }, workArea)
  };
}

function tentOpenProgress(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.48;
  return Math.min(0.65, Math.max(0.35, n));
}

function tentWindowBounds(foldedBounds, extraHeight = 40) {
  const extra = Math.max(0, Number(extraHeight) || 0);
  const width = Number(foldedBounds?.width) || 0;
  const height = Number(foldedBounds?.height) || 0;
  return {
    x: Math.round(Number(foldedBounds?.x) || 0),
    y: Math.round((Number(foldedBounds?.y) || 0) - extra),
    width,
    height: height + extra
  };
}

function tabletWindowSize(size) {
  const height = Math.max(108, Number(size?.height) || 0);
  return {
    width: Math.max(144, Math.round(height * 4 / 3)),
    height,
    ...(size && size.label ? { label: size.label } : {})
  };
}

function slackWindowSize(size, extraHeight = 56) {
  const foldedH = Math.max(108, Number(size?.height) || 0);
  const foldedW = Math.max(96, Number(size?.width) || 0);
  const extra = Math.max(0, Number(extraHeight) || 0);
  const height = foldedH + extra;
  const width = Math.max(foldedW * 2, Math.round(height * 4 / 3));
  return {
    width,
    height,
    ...(size && size.label ? { label: size.label } : {})
  };
}

function placeSlackWindow(origin, slackSize, workArea) {
  const width = Number(slackSize?.width) || 0;
  const height = Number(slackSize?.height) || 0;
  const footY = (Number(origin?.y) || 0) + (Number(origin?.height) || height);
  const originMid = (Number(origin?.x) || 0) + (Number(origin?.width) || 0) / 2;
  const x = originMid - width / 2;
  return clampToWorkArea({ x, y: footY - height, width, height }, workArea);
}

function presentationWindowSize(size, mode, options = {}) {
  const tentExtraHeight = Number(options.tentExtraHeight) || 0;
  if (mode === 'tent') {
    return {
      ...size,
      height: Math.max(0, Number(size?.height) || 0) + tentExtraHeight
    };
  }
  if (mode === 'slack') {
    return slackWindowSize(size, options.slackExtraHeight);
  }
  if (mode === 'open' || mode === 'folding' || (mode === 'unfolding' && options.peerOpen === true)) {
    return memberWindowSize(size);
  }
  if (mode === 'unfolding') {
    return tabletWindowSize(size);
  }
  return size;
}

function placeTabletWindow(origin, tabletSize, workArea, direction = 'right') {
  const width = Number(tabletSize?.width) || 0;
  const height = Number(tabletSize?.height) || 0;
  const footY = (Number(origin?.y) || 0) + (Number(origin?.height) || height);
  let x = Number(origin?.x) || workArea.x;
  if (direction === 'left') {
    x = x + (Number(origin?.width) || 0) - width;
  }
  return clampToWorkArea({
    x,
    y: footY - height,
    width,
    height
  }, workArea);
}

function clampOpenBounds(side, bounds, workArea) {
  const mid = workArea.x + workArea.width / 2;
  const width = bounds.width;
  const height = bounds.height;
  let x = bounds.x;
  let y = bounds.y;

  if (side === 'left') {
    const minX = workArea.x;
    const maxX = mid - width;
    x = Math.min(Math.max(x, minX), maxX);
  } else if (side === 'right') {
    const minX = mid;
    const maxX = workArea.x + workArea.width - width;
    x = Math.min(Math.max(x, minX), maxX);
  }

  const minY = workArea.y;
  const maxY = workArea.y + workArea.height - height;
  y = Math.min(Math.max(y, minY), maxY);

  return { x, y, width, height };
}

function createDuoController(options) {
  const snapProgress = options?.snapProgress != null ? Number(options.snapProgress) : 0.25;
  const tentEnabled = options?.tentEnabled === true;
  const slackEnabled = options?.slackEnabled === true;

  let mode = 'folded';
  let direction = null;
  let progress = 0;
  let travelPx = 0;
  let fromSide = null;
  let originMode = 'folded';

  function resetTransition() {
    direction = null;
    progress = 0;
    travelPx = 0;
    fromSide = null;
    originMode = mode;
  }

  return {
    mode() {
      return mode;
    },

    direction() {
      return direction;
    },

    fromSide() {
      return fromSide;
    },

    progress() {
      return progress;
    },

    beginTent() {
      if (!tentEnabled || mode !== 'folded') {
        return false;
      }
      originMode = 'folded';
      mode = 'tent';
      direction = 'right';
      progress = 0;
      fromSide = null;
      return true;
    },

    leaveTent() {
      if (mode !== 'tent') {
        return false;
      }
      mode = 'folded';
      resetTransition();
      return true;
    },

    beginSlack() {
      if (!slackEnabled || mode !== 'folded') {
        return false;
      }
      originMode = 'folded';
      mode = 'slack';
      direction = 'right';
      progress = 0;
      fromSide = null;
      return true;
    },

    leaveSlack() {
      if (mode !== 'slack') {
        return false;
      }
      mode = 'folded';
      resetTransition();
      return true;
    },

    beginUnfold(nextDirection, options) {
      const fromTentMenu = mode === 'tent' && options?.fromMenu === true;
      if (mode === 'slack' || (mode !== 'folded' && !fromTentMenu)) {
        return false;
      }
      originMode = mode;
      mode = 'unfolding';
      direction = nextDirection;
      progress = 0;
      fromSide = null;
      return true;
    },

    beginFold(side) {
      if (mode !== 'open') {
        return false;
      }
      originMode = mode;
      mode = 'folding';
      fromSide = side;
      direction = side === 'left' ? 'right' : 'left';
      progress = 0;
      return true;
    },

    updateDrag(dx) {
      const delta = Number(dx) || 0;
      if (travelPx <= 0) {
        return progress;
      }

      if (mode === 'unfolding') {
        progress = Math.min(1, Math.abs(delta) / travelPx);
      } else if (mode === 'folding') {
        const towardCenter =
          (fromSide === 'left' && delta > 0) || (fromSide === 'right' && delta < 0);
        if (towardCenter) {
          progress = Math.min(1, Math.abs(delta) / travelPx);
        }
      }

      return progress;
    },

    setTravelPx(px) {
      travelPx = Number(px) || 0;
    },

    release() {
      const committed = progress >= snapProgress;

      if (mode === 'unfolding') {
        mode = committed ? 'open' : originMode;
      } else if (mode === 'folding') {
        mode = committed ? 'folded' : originMode;
      }

      resetTransition();
      return { commit: committed, mode };
    },

    cancel() {
      mode = originMode;
      resetTransition();
    },

    openSides() {
      return null;
    }
  };
}

module.exports = {
  classifyRightPointer,
  unfoldTravelPx,
  canUnfold,
  clampOpenBounds,
  clampToWorkArea,
  placeUnfoldedPair,
  memberWindowSize,
  lerpBounds,
  foldMovingBounds,
  tentOpenProgress,
  tentWindowBounds,
  tabletWindowSize,
  placeTabletWindow,
  presentationWindowSize,
  slackWindowSize,
  placeSlackWindow,
  createDuoController
};


```n
## scripts/test-duo-controller.js
```js

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

const slackSize = slackWindowSize(petSize, 56);
assert.strictEqual(slackSize.height, 246);
assert.ok(slackSize.width >= 340);
assert.deepStrictEqual(
  presentationWindowSize(petSize, 'slack', { slackExtraHeight: 56 }),
  slackSize
);

const origin = { x: 100, y: 400, width: 170, height: 190 };
const placed = placeSlackWindow(origin, slackSize, { x: 0, y: 0, width: 1000, height: 800 });
assert.strictEqual(placed.y + placed.height, origin.y + origin.height, 'foot stays');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main-v3.js'), 'utf8');
assert.match(mainSource, /presentationWindowSize\(currentSize\(\), duo\.mode\(\)/);
assert.match(mainSource, /peerOpen:\s*duoIsOpen\(\)/);

console.log('test-duo-controller: ok');


```n
