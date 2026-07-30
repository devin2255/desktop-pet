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

module.exports = {
  selectTargetWindow, classifyWindowEdge, visibleRect,
  clampByVisibleBounds, positionForAttachment, nextFallFrame
};
