'use strict';

function petPositionForAnchor(petSize, anchor, targetPoint) {
  const ax = Number(anchor?.x);
  const ay = Number(anchor?.y);
  return {
    x: Math.round(targetPoint.x - petSize.width * ax),
    y: Math.round(targetPoint.y - petSize.height * ay)
  };
}

function nearestVerticalEdge(petBounds, windowBounds) {
  const petCx = petBounds.x + petBounds.width / 2;
  const left = windowBounds.x;
  const right = windowBounds.x + windowBounds.width;
  const useLeft = Math.abs(petCx - left) <= Math.abs(petCx - right);
  const y = Math.min(
    Math.max(petBounds.y + petBounds.height / 2, windowBounds.y),
    windowBounds.y + windowBounds.height
  );
  return useLeft
    ? { side: 'left', x: left, y }
    : { side: 'right', x: right, y };
}

function insetRect(rect, ratio) {
  const r = Math.min(0.49, Math.max(0, Number(ratio) || 0));
  const width = Math.round(rect.width * (1 - 2 * r));
  const height = Math.round(rect.height * (1 - 2 * r));
  return {
    x: Math.round(rect.x + rect.width * r),
    y: Math.round(rect.y + rect.height * r),
    width: Math.max(1, width),
    height: Math.max(1, height)
  };
}

function anchorScreenPoint(petBounds, anchor) {
  return {
    x: petBounds.x + petBounds.width * Number(anchor.x),
    y: petBounds.y + petBounds.height * Number(anchor.y)
  };
}

function anchorsOverlap(petBounds, anchor, targetRect) {
  const p = anchorScreenPoint(petBounds, anchor);
  return p.x >= targetRect.x && p.x <= targetRect.x + targetRect.width
    && p.y >= targetRect.y && p.y <= targetRect.y + targetRect.height;
}

function mirrorAnchorX(anchor, mirrored) {
  if (mirrored === false) return { x: Number(anchor.x), y: Number(anchor.y) };
  return { x: 1 - Number(anchor.x), y: Number(anchor.y) };
}

module.exports = {
  petPositionForAnchor,
  nearestVerticalEdge,
  insetRect,
  anchorScreenPoint,
  anchorsOverlap,
  mirrorAnchorX
};
