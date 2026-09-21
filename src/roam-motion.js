'use strict';

function nextRoamTarget({ x, width }, workArea, rng = Math.random, lastDirection) {
  const minX = workArea.x;
  const maxX = workArea.x + workArea.width - width;
  if (!(maxX > minX)) return { targetX: minX, direction: 'right' };

  const span = Math.max(80, Math.min(320, workArea.width * 0.22));
  const edgeMargin = Math.max(48, Math.round(span * 0.4));
  const nearLeft = x <= minX + edgeMargin;
  const nearRight = x >= maxX - edgeMargin;

  let direction;
  if (nearLeft && !nearRight) direction = 'right';
  else if (nearRight && !nearLeft) direction = 'left';
  else if (lastDirection === 'left' || lastDirection === 'right') {
    direction = rng() < 0.7 ? lastDirection : (lastDirection === 'left' ? 'right' : 'left');
  } else {
    direction = rng() < 0.5 ? 'left' : 'right';
  }

  const travel = Math.max(140, Math.round(span * (0.6 + rng() * 0.4)));
  let targetX = direction === 'right'
    ? Math.min(maxX, x + travel)
    : Math.max(minX, x - travel);

  if (Math.abs(targetX - x) < 48) {
    direction = direction === 'right' ? 'left' : 'right';
    targetX = direction === 'right'
      ? Math.min(maxX, x + travel)
      : Math.max(minX, x - travel);
  }

  return { targetX, direction };
}

function crawlIdleState(facing) {
  return facing === 'left' ? 'crawl-left' : 'crawl-right';
}

function roamStepBounds(startBounds, targetX, progress, size, workArea) {
  const t = Math.min(1, Math.max(0, Number(progress) || 0));
  const width = size.width;
  const height = size.height;
  const x = Math.round((Number(startBounds?.x) || 0) + (targetX - (Number(startBounds?.x) || 0)) * t);
  const minX = workArea.x;
  const maxX = workArea.x + workArea.width - width;
  const minY = workArea.y;
  const maxY = workArea.y + workArea.height - height;
  return {
    x: Math.round(Math.min(Math.max(x, minX), maxX)),
    y: Math.round(Math.min(Math.max(Number(startBounds?.y) || 0, minY), maxY)),
    width,
    height
  };
}

module.exports = { nextRoamTarget, crawlIdleState, roamStepBounds };
