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

function slackWindowSize(size, extraHeight = 96) {
  const foldedH = Math.max(108, Number(size?.height) || 0);
  const extra = Math.max(0, Number(extraHeight) || 0);
  const phoneW = Math.max(144, Math.round(foldedH * 4 / 3));
  return {
    width: phoneW,
    height: foldedH + extra,
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
