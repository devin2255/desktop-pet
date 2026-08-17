'use strict';

const {
  clampByVisibleBounds,
  classifyWindowEdge,
  nextFallFrame,
  positionForAttachment,
  selectDisplayTopWindow,
  selectTargetWindow
} = require('./window-interactions');

const INTERACTIVE_STATES = new Set([
  'dragging', 'climbing', 'perched', 'hanging',
  'falling', 'impact', 'recovering'
]);
const ATTACHED_STATES = new Set(['climbing', 'perched', 'hanging']);
const FALLBACK_ACTIONS = {
  drag: 'walk',
  climb: 'walk',
  perch: 'sit',
  hang: 'sit',
  fall: 'reaction',
  impact: 'reaction',
  recover: 'reaction'
};
const DEFAULT_ANCHORS = {
  climb: { x: 0.5, y: 0.5 },
  perch: { x: 0.5, y: 0.7 },
  hang: { x: 0.5, y: 0.1 }
};
const CONTROLLER_STATE_OPTIONS = Object.freeze({ preserveBounds: true });

function pointFrom(value) {
  if (!value) return null;
  const x = Number.isFinite(value.x) ? value.x : value.screenX;
  const y = Number.isFinite(value.y) ? value.y : value.screenY;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function validTarget(target) {
  const bounds = target?.bounds;
  return target && target.id !== undefined && target.id !== null
    && target.visible !== false && target.minimized !== true
    && bounds && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(bounds[key]))
    && bounds.width > 0 && bounds.height > 0;
}

function shouldRestoreWindowBounds(options) {
  return options?.preserveBounds !== true;
}

function perchedIdleWaitMs(choices, delayMs, rng = Math.random) {
  const mins = [];
  const maxs = [];
  for (const item of Array.isArray(choices) ? choices : []) {
    if (Number.isFinite(Number(item?.idleMinMs))) mins.push(Number(item.idleMinMs));
    if (Number.isFinite(Number(item?.idleMaxMs))) maxs.push(Number(item.idleMaxMs));
  }
  if (mins.length || maxs.length) {
    const lo = Math.max(400, mins.length ? Math.min(...mins) : 18000);
    const hi = Math.max(lo, maxs.length ? Math.max(...maxs) : lo);
    return lo + rng() * (hi - lo);
  }
  if (Number.isFinite(delayMs)) return Math.max(400, delayMs);
  return 1800 + rng() * 2200;
}

function createInteractionController(dependencies) {
  const petWindow = dependencies.window || dependencies.petWindow;
  const discovery = dependencies.discovery;
  const screen = dependencies.screen;
  const getCurrentSize = dependencies.getCurrentSize || dependencies.currentSize;
  const getManifest = dependencies.getManifest || (() => dependencies.manifest || {});
  const sendState = dependencies.sendState;
  const pauseBehavior = dependencies.pauseBehavior || (() => {});
  const resumeBehavior = dependencies.resumeBehavior || (() => {});
  const ensureOnTop = dependencies.ensureOnTop || (() => {});
  const setTimeoutFn = dependencies.setTimeout || setTimeout;
  const clearTimeoutFn = dependencies.clearTimeout || clearTimeout;
  const setIntervalFn = dependencies.setInterval || setInterval;
  const clearIntervalFn = dependencies.clearInterval || clearInterval;
  const now = dependencies.now || Date.now;
  const scheduleFrame = dependencies.scheduleFrame
    || ((callback) => setTimeoutFn(() => callback(now()), 16));
  const cancelFrame = dependencies.cancelFrame || clearTimeoutFn;
  const excludedIds = dependencies.excludedIds || new Set();
  const edgeThreshold = Number.isFinite(dependencies.edgeThreshold) ? dependencies.edgeThreshold : 32;
  const visibleTopThreshold = Number.isFinite(dependencies.visibleTopThreshold)
    ? dependencies.visibleTopThreshold
    : 6;
  const attachmentPollMs = Number.isFinite(dependencies.attachmentPollMs)
    ? dependencies.attachmentPollMs
    : 100;
  const edgeGap = Number.isFinite(dependencies.edgeGap) ? dependencies.edgeGap : 14;
  const bottomOffset = Number.isFinite(dependencies.bottomOffset) ? dependencies.bottomOffset : 6;
  const dragFacingThresholdPx = Number.isFinite(dependencies.dragFacingThresholdPx)
    ? dependencies.dragFacingThresholdPx
    : 4;

  if (!petWindow || !discovery || !screen || typeof getCurrentSize !== 'function'
    || typeof sendState !== 'function') {
    throw new TypeError('interaction controller dependencies are incomplete');
  }

  let currentState = 'normal';
  let visibleInsets = { left: 0, top: 0, right: 0, bottom: 0 };
  let dragOrigin;
  let dragFacing = 'right';
  let topSnap;
  let attachment;
  let attachmentTimer;
  let attachmentPollPending;
  let frameTimer;
  let animationTimer;
  let perchedIdleTimer;
  let perchedIdleSuspended = false;
  let climbUpTimer;
  let generation = 0;
  let disposed = false;

  function currentSize() {
    const size = getCurrentSize();
    return { width: size.width, height: size.height };
  }

  function setPosition(position) {
    if (disposed || petWindow.isDestroyed?.()) return;
    const size = currentSize();
    petWindow.setBounds({
      x: Math.round(position.x),
      y: Math.round(position.y),
      width: size.width,
      height: size.height
    }, false);
  }

  function facingState(role, facing) {
    if ((role === 'drag' || role === 'climb') && (facing === 'left' || facing === 'right')) {
      return `${role}-${facing}`;
    }
    return role;
  }

  function emitRole(role, extras = {}) {
    if (disposed) return;
    const facing = extras.facing;
    sendState(facingState(role, facing), {
      ...CONTROLLER_STATE_OPTIONS,
      ...extras,
      logicalRole: role
    });
    ensureOnTop();
  }

  function transition(next, logicalRole, extras = {}) {
    if (disposed) return;
    currentState = next;
    if (INTERACTIVE_STATES.has(next)) pauseBehavior();
    emitRole(logicalRole || next, extras);
    if (next === 'normal') resumeBehavior();
  }

  function clearAttachmentPolling() {
    if (attachmentTimer !== undefined) clearIntervalFn(attachmentTimer);
    attachmentTimer = undefined;
    attachmentPollPending = undefined;
  }

  function clearPerchedIdle() {
    if (perchedIdleTimer !== undefined) clearTimeoutFn(perchedIdleTimer);
    perchedIdleTimer = undefined;
  }

  function clearMotionTimers() {
    if (frameTimer !== undefined) cancelFrame(frameTimer);
    frameTimer = undefined;
    if (animationTimer !== undefined) clearTimeoutFn(animationTimer);
    animationTimer = undefined;
    if (climbUpTimer !== undefined) clearTimeoutFn(climbUpTimer);
    climbUpTimer = undefined;
    clearPerchedIdle();
  }

  function pickWeighted(choices) {
    const usable = Array.isArray(choices)
      ? choices.filter((item) => item && typeof item.state === 'string' && getManifest()?.animations?.[item.state])
      : [];
    if (!usable.length) return null;
    const total = usable.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0);
    if (total <= 0) return usable[0];
    let cursor = Math.random() * total;
    for (const item of usable) {
      cursor -= Math.max(0, Number(item.weight) || 0);
      if (cursor <= 0) return item;
    }
    return usable[0];
  }

  function schedulePerchedIdle(delayMs) {
    clearPerchedIdle();
    if (disposed || perchedIdleSuspended || currentState !== 'perched') return;
    const choices = getManifest()?.behavior?.perched;
    if (!Array.isArray(choices) || !choices.length) return;
    const wait = perchedIdleWaitMs(choices, delayMs);
    const token = generation;
    perchedIdleTimer = setTimeoutFn(() => {
      perchedIdleTimer = undefined;
      if (disposed || perchedIdleSuspended || generation !== token || currentState !== 'perched') return;
      const choice = pickWeighted(choices);
      if (!choice) return;
      const playMs = Math.max(
        600,
        Number(choice.minDuration) + Math.random() * Math.max(0, Number(choice.maxDuration) - Number(choice.minDuration))
      );
      // Keep controller state as perched for attachment; only swap the visible action.
      emitRole(choice.state, {
        message: typeof choice.message === 'string' ? choice.message : '',
        speech: typeof choice.speech === 'string' ? choice.speech : '',
        speechAudio: typeof choice.speechAudio === 'string' ? choice.speechAudio : ''
      });
      perchedIdleTimer = setTimeoutFn(() => {
        perchedIdleTimer = undefined;
        if (disposed || perchedIdleSuspended || generation !== token || currentState !== 'perched') return;
        emitRole('perch');
        schedulePerchedIdle();
      }, playMs);
    }, wait);
  }

  function suspendPerchedIdle() {
    perchedIdleSuspended = true;
    clearPerchedIdle();
  }

  function resumePerchedIdle() {
    perchedIdleSuspended = false;
    if (disposed || currentState !== 'perched') return;
    emitRole('perch');
    schedulePerchedIdle();
  }

  function displayForPoint(point) {
    return screen.getDisplayNearestPoint({ x: Math.round(point.x), y: Math.round(point.y) });
  }

  function displayForWindow() {
    const bounds = petWindow.getBounds();
    return displayForPoint({
      x: bounds.x + Math.round(bounds.width / 2),
      y: bounds.y + Math.round(bounds.height / 2)
    });
  }

  function actionFor(role) {
    const manifest = getManifest() || {};
    return manifest.interactionActions?.[role]?.action || FALLBACK_ACTIONS[role] || role;
  }

  function animationDuration(role) {
    const animation = getManifest()?.animations?.[actionFor(role)];
    if (!Array.isArray(animation?.durations)) return 0;
    return animation.durations.reduce(
      (total, duration) => total + (Number.isFinite(duration) && duration > 0 ? duration : 0),
      0
    );
  }

  function anchorFor(role, edge) {
    const base = getManifest()?.interactionActions?.[role]?.anchor
      || DEFAULT_ANCHORS[role]
      || { x: 0.5, y: 0.5 };
    // Side-profile climb art faces right. CSS flips climb-left, so hands
    // land on the left of the window; unflipped climb-right keeps hands on the right.
    if (role === 'climb' && edge === 'left') return { x: 0.16, y: base.y };
    if (role === 'climb' && edge === 'right') return { x: 0.84, y: base.y };
    return base;
  }

  function startupPosition(display) {
    const size = currentSize();
    const workArea = display.workArea || display.bounds;
    return {
      x: workArea.x + workArea.width - size.width - edgeGap,
      y: workArea.y + workArea.height - size.height + bottomOffset
    };
  }

  function attachmentPosition(target, edge, offset, role) {
    return positionForAttachment(
      target.bounds,
      edge,
      anchorFor(role, edge),
      currentSize(),
      visibleInsets,
      offset
    );
  }

  function applyAttachment(target) {
    if (!attachment || String(target.id) !== attachment.id) return;
    attachment.bounds = { ...target.bounds };
    setPosition(attachmentPosition(target, attachment.edge, attachment.offset, attachment.role));
  }

  function startAttachmentPolling() {
    clearAttachmentPolling();
    attachmentTimer = setIntervalFn(async () => {
      if (disposed || !attachment || attachmentPollPending) return;
      const pollGeneration = generation;
      const pollAttachment = attachment;
      const pollAttachmentId = attachment.id;
      if (!ATTACHED_STATES.has(currentState)) return;
      const pollToken = {};
      attachmentPollPending = pollToken;
      const isCurrentPoll = () => !disposed
        && generation === pollGeneration
        && ATTACHED_STATES.has(currentState)
        && attachment === pollAttachment
        && attachment?.id === pollAttachmentId;
      try {
        const windows = await discovery.list();
        if (!isCurrentPoll()) return;
        const target = windows.find((item) => validTarget(item) && String(item.id) === attachment.id);
        if (!target) {
          detachAndFall('target-unavailable');
          return;
        }
        applyAttachment(target);
      } catch {
        if (isCurrentPoll()) detachAndFall('attachment-poll-failed');
      } finally {
        if (attachmentPollPending === pollToken) attachmentPollPending = undefined;
      }
    }, attachmentPollMs);
  }

  function attach(target, edge, offset, role, nextState, extras = {}) {
    attachment = {
      id: String(target.id),
      edge,
      offset,
      role,
      bounds: { ...target.bounds }
    };
    applyAttachment(target);
    transition(nextState, role, extras);
    startAttachmentPolling();
    if (nextState === 'perched') schedulePerchedIdle(900);
  }

  function climbUpToTop() {
    climbUpTimer = undefined;
    if (disposed || currentState !== 'climbing' || !attachment) return;
    if (attachment.edge !== 'left' && attachment.edge !== 'right') return;

    const climbEdge = attachment.edge;
    const targetId = attachment.id;
    const targetBounds = { ...attachment.bounds };

    // Stop side attachment polling during ascent
    clearAttachmentPolling();

    const startPos = petWindow.getBounds();
    // Left climb → sit at left corner of top edge; right climb → right corner
    const perchAnchorX = climbEdge === 'left' ? 0.15 : 0.85;
    const perchAnchor = { x: perchAnchorX, y: DEFAULT_ANCHORS.perch.y };
    const endPos = positionForAttachment(
      targetBounds,
      'top',
      perchAnchor,
      currentSize(),
      visibleInsets,
      Math.max(0, Math.min(targetBounds.width, startPos.x - targetBounds.x + currentSize().width / 2))
    );

    const token = generation;
    const duration = 3000; // slow ascent
    const startTime = now();

    function climbStep(timestamp) {
      frameTimer = undefined;
      if (disposed || generation !== token || currentState !== 'climbing') return;
      const frameTime = Number.isFinite(timestamp) ? timestamp : now();
      const elapsed = Math.max(0, frameTime - startTime);
      const progress = Math.min(1, elapsed / duration);
      // ease-in-out so it starts gently, speeds up mid-climb, slows at top
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const x = Math.round(startPos.x + (endPos.x - startPos.x) * eased);
      const y = Math.round(startPos.y + (endPos.y - startPos.y) * eased);
      setPosition({ x, y });

      if (progress >= 1) {
        // Reached top — perch
        attachment = {
          id: String(targetId),
          edge: 'top',
          offset: endPos.x - targetBounds.x + visibleInsets.left,
          role: 'perch',
          bounds: targetBounds
        };
        transition('perched', 'perch');
        startAttachmentPolling();
        schedulePerchedIdle(900);
        return;
      }
      frameTimer = scheduleFrame(climbStep);
    }
    frameTimer = scheduleFrame(climbStep);
  }

  function restOnSide(target, pointer, edge) {
    const sideOffset = pointer.y - target.bounds.y;
    const clingFacing = edge === 'right' ? 'right' : 'left';
    attach(target, edge, sideOffset, 'climb', 'climbing', { facing: clingFacing });
    climbUpTimer = setTimeoutFn(climbUpToTop, 1000);
  }

  function finishFall(display, token) {
    if (disposed || generation !== token || currentState !== 'falling') return;
    transition('impact', 'impact');
    animationTimer = setTimeoutFn(() => {
      animationTimer = undefined;
      if (disposed || generation !== token || currentState !== 'impact') return;
      transition('recovering', 'recover');
      animationTimer = setTimeoutFn(() => {
        animationTimer = undefined;
        if (disposed || generation !== token || currentState !== 'recovering') return;
        setPosition(startupPosition(display));
        transition('normal', 'normal');
      }, animationDuration('recover'));
    }, animationDuration('impact'));
  }

  function detachAndFall(_reason) {
    if (disposed) return;
    generation += 1;
    const token = generation;
    dragOrigin = undefined;
    topSnap = undefined;
    attachment = undefined;
    clearAttachmentPolling();
    clearMotionTimers();
    const display = displayForWindow();
    const landing = startupPosition(display);
    let velocity = 0;
    let previousTime = now();
    transition('falling', 'fall');

    const tick = (timestamp) => {
      frameTimer = undefined;
      if (disposed || generation !== token || currentState !== 'falling') return;
      const frameTime = Number.isFinite(timestamp) ? timestamp : now();
      const elapsed = Math.max(0, frameTime - previousTime);
      previousTime = frameTime;
      const bounds = petWindow.getBounds();
      const next = nextFallFrame({ y: bounds.y, velocity }, elapsed, landing.y);
      velocity = next.velocity;
      setPosition({ x: bounds.x, y: next.y });
      if (next.landed) finishFall(display, token);
      else frameTimer = scheduleFrame(tick);
    };
    frameTimer = scheduleFrame(tick);
  }

  function startDrag(pointerValue) {
    const pointer = pointFrom(pointerValue);
    if (!pointer || disposed || petWindow.isDestroyed?.()) return false;
    generation += 1;
    topSnap = undefined;
    attachment = undefined;
    clearAttachmentPolling();
    clearMotionTimers();
    const bounds = petWindow.getBounds();
    dragOrigin = {
      pointer,
      bounds: { x: bounds.x, y: bounds.y },
      lastPointer: pointer
    };
    dragFacing = 'right';
    transition('dragging', 'drag', { facing: dragFacing });
    return true;
  }

  function moveDrag(pointerValue) {
    const pointer = pointFrom(pointerValue);
    if (!pointer || !dragOrigin || currentState !== 'dragging' || disposed) return false;
    const display = displayForPoint(pointer);
    const size = currentSize();
    const desired = {
      x: dragOrigin.bounds.x + pointer.x - dragOrigin.pointer.x,
      y: dragOrigin.bounds.y + pointer.y - dragOrigin.pointer.y,
      width: size.width,
      height: size.height
    };
    const next = clampByVisibleBounds(desired, visibleInsets, display.bounds);
    if (pointer.y - display.bounds.y <= visibleTopThreshold) {
      next.y = Math.round(display.bounds.y - visibleInsets.top);
      topSnap = {
        displayId: String(display.id),
        displayTop: display.bounds.y
      };
    } else {
      topSnap = undefined;
    }
    const dx = pointer.x - (dragOrigin.lastPointer?.x ?? dragOrigin.pointer.x);
    if (Math.abs(dx) >= dragFacingThresholdPx) {
      // Drag sprites face the direction they are being pulled from (trail opposite of travel).
      const nextFacing = dx < 0 ? 'right' : 'left';
      if (nextFacing !== dragFacing) {
        dragFacing = nextFacing;
        emitRole('drag', { facing: dragFacing });
      }
    }
    dragOrigin.lastPointer = pointer;
    setPosition(next);
    return true;
  }

  async function endDrag(pointerValue) {
    const pointer = pointFrom(pointerValue);
    if (!pointer || !dragOrigin || currentState !== 'dragging' || disposed) return false;
    dragOrigin = undefined;
    dragFacing = 'right';
    const releasedTopSnap = topSnap;
    topSnap = undefined;
    const token = generation;
    let windows;
    try {
      windows = await discovery.list();
    } catch {
      if (!disposed && generation === token && currentState === 'dragging') {
        if (releasedTopSnap) detachAndFall('screen-top-discovery-unavailable');
        else transition('normal', 'normal');
      }
      return false;
    }
    if (disposed || generation !== token || currentState !== 'dragging') return false;

    const display = displayForPoint(pointer);
    const candidates = Array.isArray(windows) ? windows : [];
    const target = selectTargetWindow(pointer, candidates, excludedIds);
    if (target) {
      const edge = classifyWindowEdge(pointer, target.bounds, edgeThreshold);
      if (edge === 'left' || edge === 'right') {
        restOnSide(target, pointer, edge);
        return true;
      }
      if (edge === 'top') {
        attach(target, 'top', pointer.x - target.bounds.x, 'perch', 'perched');
        return true;
      }
      if (edge === 'bottom') {
        attach(target, 'bottom', pointer.x - target.bounds.x, 'hang', 'hanging');
        return true;
      }
      transition('normal', 'normal');
      return true;
    }

    const displayTopTarget = releasedTopSnap
      ? selectDisplayTopWindow(pointer, candidates, display.bounds, excludedIds, edgeThreshold)
      : null;
    if (displayTopTarget) {
      attach(
        displayTopTarget,
        'top',
        pointer.x - displayTopTarget.bounds.x,
        'perch',
        'perched'
      );
      return true;
    }

    const bounds = petWindow.getBounds();
    const visibleTop = bounds.y + visibleInsets.top;
    const releasedSnappedToDisplay = releasedTopSnap
      && releasedTopSnap.displayId === String(display.id)
      && releasedTopSnap.displayTop === display.bounds.y;
    const pointerWithinTopBand = pointer.y - display.bounds.y <= visibleTopThreshold;
    if (releasedSnappedToDisplay
      || (pointerWithinTopBand && visibleTop - display.bounds.y <= visibleTopThreshold)) {
      detachAndFall('screen-top');
      return true;
    }
    transition('normal', 'normal');
    return true;
  }

  function updateVisibleInsets(nextInsets) {
    const size = currentSize();
    const valid = nextInsets && ['left', 'top', 'right', 'bottom'].every((side) => {
      const limit = side === 'left' || side === 'right' ? size.width : size.height;
      return Number.isFinite(nextInsets[side]) && nextInsets[side] >= 0 && nextInsets[side] < limit;
    });
    if (!valid) return false;
    visibleInsets = {
      left: nextInsets.left,
      top: nextInsets.top,
      right: nextInsets.right,
      bottom: nextInsets.bottom
    };
    if (topSnap && currentState === 'dragging') {
      const bounds = petWindow.getBounds();
      setPosition({ x: bounds.x, y: topSnap.displayTop - visibleInsets.top });
    }
    if (attachment) applyAttachment({ id: attachment.id, bounds: attachment.bounds });
    return true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    generation += 1;
    dragOrigin = undefined;
    dragFacing = 'right';
    topSnap = undefined;
    attachment = undefined;
    clearAttachmentPolling();
    clearMotionTimers();
    pauseBehavior();
  }

  return {
    startDrag,
    moveDrag,
    endDrag,
    updateVisibleInsets,
    detachAndFall,
    dispose,
    state: () => currentState,
    suspendPerchedIdle,
    resumePerchedIdle
  };
}

module.exports = {
  createInteractionController,
  INTERACTIVE_STATES,
  shouldRestoreWindowBounds,
  perchedIdleWaitMs
};
