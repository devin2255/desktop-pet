'use strict';

function nextRoamFacing(facing, x, width, workArea) {
  if (facing === 'right' && x + width >= workArea.x + workArea.width) return 'left';
  if (facing === 'left' && x <= workArea.x) return 'right';
  return facing;
}

module.exports = { nextRoamFacing };
