'use strict';

function contains(point, bounds) {
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

function selectTargetWindow(pointer, windows, excludedIds = new Set()) {
  return windows.find((item) => item && !excludedIds.has(String(item.id))
    && item.visible !== false && item.minimized !== true
    && item.bounds?.width > 0 && item.bounds?.height > 0
    && contains(pointer, item.bounds)) || null;
}

function eligibleWindow(item, excludedIds) {
  return Boolean(item)
    && !excludedIds.has(String(item.id))
    && item.visible !== false
    && item.minimized !== true
    && item.bounds?.width > 0
    && item.bounds?.height > 0;
}

function selectTopSeatWindow(pointer, petBounds, insets, windows, excludedIds = new Set(), threshold = 32) {
  const safeInsets = {
    left: Number(insets?.left) || 0,
    top: Number(insets?.top) || 0,
    right: Number(insets?.right) || 0,
    bottom: Number(insets?.bottom) || 0
  };
  const visible = petBounds?.width > 0 && petBounds?.height > 0
    ? visibleRect(petBounds, safeInsets)
    : null;
  let best = null;
  let bestDistance = Infinity;
  for (const item of windows || []) {
    if (!eligibleWindow(item, excludedIds)) continue;
    const bounds = item.bounds;
    const top = bounds.y;
    let distance = Infinity;
    let offset = bounds.width / 2;
    const pointerAbove = pointer
      && pointer.x >= bounds.x - 12
      && pointer.x <= bounds.x + bounds.width + 12
      && pointer.y < top
      && top - pointer.y <= threshold;
    if (pointerAbove) {
      distance = top - pointer.y;
      offset = Math.max(0, Math.min(bounds.width, pointer.x - bounds.x));
    }
    if (visible && visible.width > 0 && visible.height > 0) {
      const feetDistance = Math.abs(visible.y + visible.height - top);
      const overlap = Math.min(visible.x + visible.width, bounds.x + bounds.width)
        - Math.max(visible.x, bounds.x);
      const minOverlap = Math.min(24, visible.width * 0.35);
      if (feetDistance <= threshold && overlap >= minOverlap && feetDistance < distance) {
        distance = feetDistance;
        const center = visible.x + visible.width / 2;
        offset = Math.max(0, Math.min(bounds.width, center - bounds.x));
      }
    }
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { window: item, offset };
    }
  }
  return best;
}

function selectDisplayTopWindow(pointer, windows, display, excludedIds = new Set(), threshold = 32) {
  if (!pointer || !display || Math.abs(pointer.y - display.y) > threshold) return null;
  return windows.find((item) => {
    const bounds = item?.bounds;
    return item && !excludedIds.has(String(item.id))
      && item.visible !== false && item.minimized !== true
      && bounds?.width > 0 && bounds?.height > 0
      && pointer.x >= bounds.x && pointer.x <= bounds.x + bounds.width
      && Math.abs(bounds.y - display.y) <= threshold;
  }) || null;
}

function classifyWindowEdge(pointer, bounds, threshold = 32) {
  if (!contains(pointer, bounds)) return null;
  const priority = ['top', 'bottom', 'left', 'right'];
  const distances = {
    top: Math.abs(pointer.y - bounds.y),
    bottom: Math.abs(bounds.y + bounds.height - pointer.y),
    left: Math.abs(pointer.x - bounds.x),
    right: Math.abs(bounds.x + bounds.width - pointer.x)
  };
  const nearestDistance = Math.min(...priority.map((edge) => distances[edge]));
  if (nearestDistance > threshold) return null;
  const tieTolerance = 1e-6;
  return priority.find((edge) => Math.abs(distances[edge] - nearestDistance) <= tieTolerance) || null;
}

function visibleRect(bounds, insets) {
  return {
    x: bounds.x + insets.left,
    y: bounds.y + insets.top,
    width: bounds.width - insets.left - insets.right,
    height: bounds.height - insets.top - insets.bottom
  };
}

function clampByVisibleBounds(bounds, insets, display) {
  const visible = visibleRect(bounds, insets);
  const x = Math.min(
    Math.max(bounds.x, display.x - insets.left),
    display.x + display.width - visible.width - insets.left
  );
  const y = Math.min(
    Math.max(bounds.y, display.y - insets.top),
    display.y + display.height - visible.height - insets.top
  );
  return { x: Math.round(x), y: Math.round(y) };
}

function positionForAttachment(target, edge, anchor, petSize, insets, offset = 0) {
  const visibleWidth = petSize.width - insets.left - insets.right;
  const visibleHeight = petSize.height - insets.top - insets.bottom;
  const centerX = target.x + Math.max(0, Math.min(target.width, offset));
  if (edge === 'top') return {
    x: Math.round(centerX - insets.left - visibleWidth * anchor.x),
    y: Math.round(target.y - insets.top - visibleHeight * anchor.y)
  };
  if (edge === 'bottom') return {
    x: Math.round(centerX - insets.left - visibleWidth * anchor.x),
    y: Math.round(target.y + target.height - insets.top - visibleHeight * anchor.y)
  };
  const targetX = edge === 'left' ? target.x : target.x + target.width;
  return {
    x: Math.round(targetX - insets.left - visibleWidth * anchor.x),
    y: Math.round(target.y + Math.max(0, Math.min(target.height, offset))
      - insets.top - visibleHeight * anchor.y)
  };
}

function nextFallFrame(state, elapsedMs, floorY) {
  const seconds = Math.max(0, elapsedMs) / 1000;
  const velocity = state.velocity + 1800 * seconds;
  const movement = Math.min(48, state.velocity * seconds + 900 * seconds * seconds);
  const y = Math.min(floorY, state.y + movement);
  return { y: Math.round(y), velocity, landed: y >= floorY };
}

const THROW_MIN_SPEED = 300;
const THROW_MAX_SPEED = 3600;

function limitSpeed(velocity, cap = THROW_MAX_SPEED) {
  const length = Math.hypot(velocity?.x || 0, velocity?.y || 0);
  if (!length) return { x: 0, y: 0 };
  const speed = cap * Math.tanh(length / cap);
  return { x: velocity.x / length * speed, y: velocity.y / length * speed };
}

function estimateThrowVelocity(samples, now, cap = THROW_MAX_SPEED) {
  if (!Array.isArray(samples) || !samples.length || !Number.isFinite(now)) return { x: 0, y: 0 };
  const last = samples[samples.length - 1];
  if (!last || now - last.t >= 150) return { x: 0, y: 0 };
  const recent = samples.filter((sample) => last.t - sample.t <= 120);
  const first = recent[0];
  if (!first || last.t - first.t < 8) return { x: 0, y: 0 };
  const dt = last.t - first.t;
  return limitSpeed({
    x: (last.x - first.x) / dt * 1000,
    y: (last.y - first.y) / dt * 1000
  }, cap);
}

function canThrow(velocity) {
  return Math.hypot(velocity?.x || 0, velocity?.y || 0) >= THROW_MIN_SPEED;
}

function rectInside(rect, area) {
  return rect.x >= area.x - 0.5
    && rect.y >= area.y - 0.5
    && rect.x + rect.width <= area.x + area.width + 0.5
    && rect.y + rect.height <= area.y + area.height + 0.5;
}

function areaContainingBody(bounds, insets, areas) {
  const rect = visibleRect(bounds, insets);
  return (areas || []).find((area) => area && area.width > 0 && area.height > 0 && rectInside(rect, area)) || null;
}

function nearestWorkArea(bounds, insets, areas) {
  const found = areaContainingBody(bounds, insets, areas);
  if (found) return found;
  const rect = visibleRect(bounds, insets);
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  let best = null;
  let bestDistance = Infinity;
  for (const area of areas || []) {
    if (!area || !(area.width > 0) || !(area.height > 0)) continue;
    const px = Math.min(Math.max(cx, area.x), area.x + area.width);
    const py = Math.min(Math.max(cy, area.y), area.y + area.height);
    const distance = Math.hypot(cx - px, cy - py);
    if (distance < bestDistance) {
      best = area;
      bestDistance = distance;
    }
  }
  return best;
}

function clampIntoWorkAreas(bounds, insets, areas) {
  const safeInsets = {
    left: Number(insets?.left) || 0,
    top: Number(insets?.top) || 0,
    right: Number(insets?.right) || 0,
    bottom: Number(insets?.bottom) || 0
  };
  const area = nearestWorkArea(bounds, safeInsets, areas);
  if (!area) return { x: Math.round(bounds.x), y: Math.round(bounds.y) };
  const minX = area.x - safeInsets.left;
  const maxX = area.x + area.width - (bounds.width - safeInsets.right);
  const minY = area.y - safeInsets.top;
  const maxY = area.y + area.height - (bounds.height - safeInsets.bottom);
  return {
    x: Math.round(Math.min(Math.max(bounds.x, minX), Math.max(minX, maxX))),
    y: Math.round(Math.min(Math.max(bounds.y, minY), Math.max(minY, maxY)))
  };
}

function nextThrowFrame(state, areas) {
  const dt = Math.min(0.05, Math.max(0, Number(state.elapsedMs) || 0) / 1000);
  const insets = state.insets || { left: 0, top: 0, right: 0, bottom: 0 };
  const bounds = { x: state.x, y: state.y, width: state.width, height: state.height };
  const area = nearestWorkArea(bounds, insets, areas);
  if (!area || dt === 0) {
    return { x: Math.round(state.x), y: Math.round(state.y), vx: state.vx, vy: state.vy, landed: false };
  }
  let vx = state.vx * Math.exp(-0.35 * dt);
  let vy = state.vy + 1400 * dt;
  const bottomOffset = Number(state.bottomOffset) || 0;
  const minX = area.x - insets.left;
  const maxX = area.x + area.width - (state.width - insets.right);
  const minY = area.y - insets.top;
  const maxY = area.y + area.height - (state.height - insets.bottom) + bottomOffset;
  let x = state.x + vx * dt;
  let y = state.y + vy * dt;
  let landed = false;
  if (x < minX || x > maxX) {
    x = Math.min(Math.max(x, minX), Math.max(minX, maxX));
    vx = -vx * 0.65;
  }
  if (y < minY) {
    y = minY;
    vy = Math.abs(vy) * 0.5;
  } else if (y > maxY) {
    y = maxY;
    if (Math.abs(vy) < 180) {
      vy = 0;
      vx *= Math.exp(-5 * dt);
      if (Math.abs(vx) < 40) {
        vx = 0;
        landed = true;
      }
    } else {
      vy = -Math.abs(vy) * 0.62;
      vx *= 0.78;
    }
  }
  return { x: Math.round(x), y: Math.round(y), vx, vy, landed };
}

module.exports = {
  selectTargetWindow, selectTopSeatWindow, selectDisplayTopWindow, classifyWindowEdge, visibleRect,
  clampByVisibleBounds, clampIntoWorkAreas, positionForAttachment, nextFallFrame,
  estimateThrowVelocity, canThrow, nextThrowFrame, THROW_MIN_SPEED
};
