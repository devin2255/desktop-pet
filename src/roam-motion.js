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

module.exports = { nextRoamTarget, crawlIdleState };
