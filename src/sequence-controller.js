'use strict';

const {
  petPositionForAnchor,
  nearestVerticalEdge,
  anchorsOverlap,
  mirrorAnchorX
} = require('./approach-target');

function asFn(value) {
  return typeof value === 'function' ? value : null;
}

function snapshotPoint(source) {
  if (!source) return null;
  const x = Number(source.x);
  const y = Number(source.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function createSequenceController(deps) {
  const getManifest = deps.getManifest;
  const sendState = deps.sendState;
  const pauseBehavior = deps.pauseBehavior || (() => {});
  const scheduleBehavior = deps.scheduleBehavior || (() => {});
  const setTimerFn = deps.setTimer || ((fn, ms) => setTimeout(fn, ms));
  const clearTimerFn = deps.clearTimer || clearTimeout;
  const defaultGetPetBounds = asFn(deps.getPetBounds);
  const defaultMovePetWindow = asFn(deps.movePetWindow);
  const defaultGetApproachRect = asFn(deps.getApproachRect);
  const defaultOnContact = asFn(deps.onContact);
  const defaultOnWalkFacing = asFn(deps.onWalkFacing);

  let active = false;
  let stageIndex = 0;
  let stages = [];
  let currentSequence = null;
  let waitingForClick = false;
  let advanceTimerId = null;
  let pollTimerId = null;
  let restoreFrom = null;
  let contacted = false;
  const finishCallbacks = [];
  let getPetBounds = defaultGetPetBounds;
  let movePetWindow = defaultMovePetWindow;
  let getApproachRect = defaultGetApproachRect;
  let onContact = defaultOnContact;
  let onWalkFacing = defaultOnWalkFacing;

  function resetRunCallbacks() {
    getPetBounds = defaultGetPetBounds;
    movePetWindow = defaultMovePetWindow;
    getApproachRect = defaultGetApproachRect;
    onContact = defaultOnContact;
    onWalkFacing = defaultOnWalkFacing;
    restoreFrom = null;
  }

  function applySession(session) {
    getPetBounds = asFn(session?.getPetBounds) || defaultGetPetBounds;
    movePetWindow = asFn(session?.movePetWindow) || defaultMovePetWindow;
    getApproachRect = asFn(session?.getApproachRect) || defaultGetApproachRect;
    onContact = asFn(session?.onContact) || defaultOnContact;
    onWalkFacing = asFn(session?.onWalkFacing) || defaultOnWalkFacing;
    restoreFrom = snapshotPoint(session?.restoreFrom);
    if (!restoreFrom && getPetBounds) {
      restoreFrom = snapshotPoint(getPetBounds());
    }
  }

  function clearCurrentTimer() {
    if (advanceTimerId != null) {
      clearTimerFn(advanceTimerId);
      advanceTimerId = null;
    }
    if (pollTimerId != null) {
      clearTimerFn(pollTimerId);
      pollTimerId = null;
    }
  }

  function buildExtras(stage) {
    const extras = {};
    if (stage.messages) {
      extras.messages = stage.messages;
    }
    if (stage.messageGapMs != null) {
      extras.messageGapMs = stage.messageGapMs;
    }
    if (stage.speechAudio) {
      extras.speechAudio = stage.speechAudio;
    }
    if (stage.speechGender) {
      extras.speechGender = stage.speechGender;
    }
    if (stage.messageLoop === true) {
      extras.messageLoop = true;
    }
    if (stage.speechLoop === true) {
      extras.speechLoop = true;
    }
    return Object.keys(extras).length > 0 ? extras : undefined;
  }

  function resolveDuration(stage) {
    if (stage.duration != null) {
      return stage.duration;
    }
    if (stage.timeoutMs != null) {
      return stage.timeoutMs;
    }
    return 3000;
  }

  function resolveApproachDelay(stage) {
    if (stage.timeoutMs != null) {
      return stage.timeoutMs;
    }
    if (stage.duration != null) {
      return stage.duration;
    }
    return 4000;
  }

  function hangupContact() {
    return currentSequence?.contacts?.hangup || null;
  }

  function hangupOverlapping() {
    const hangup = hangupContact();
    if (!hangup?.anchor || !getPetBounds || !getApproachRect) {
      return false;
    }
    const pet = getPetBounds();
    const rect = getApproachRect('incoming-call-reject');
    if (!pet || !rect) {
      return false;
    }
    return anchorsOverlap(pet, hangup.anchor, rect);
  }

  function maybeContact(stage) {
    if (contacted || !onContact) {
      return;
    }
    const hangup = hangupContact();
    if (!hangup || stage.action !== hangup.action) {
      return;
    }
    if (!hangupOverlapping()) {
      return;
    }
    contacted = true;
    onContact(stage);
  }

  function moveToward(stage) {
    if (!stage.approachTarget || !getApproachRect || !movePetWindow || !getPetBounds) {
      return;
    }
    const rect = getApproachRect(stage.approachTarget);
    if (!rect) {
      return;
    }
    const pet = getPetBounds();
    if (!pet) {
      return;
    }
    const petSize = { width: pet.width, height: pet.height };
    const contacts = currentSequence?.contacts || {};
    if (stage.approachTarget === 'incoming-call-edge') {
      const contact = contacts.climb;
      if (!contact?.anchor) {
        return;
      }
      const edge = nearestVerticalEdge(pet, rect);
      const anchor = mirrorAnchorX(contact.anchor, edge.side === 'right');
      const pos = petPositionForAnchor(petSize, anchor, { x: edge.x, y: edge.y });
      movePetWindow(pos.x, pos.y);
      return;
    }
    if (stage.approachTarget === 'incoming-call-reject') {
      const contact = contacts.hangup;
      if (!contact?.anchor) {
        return;
      }
      const target = {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2
      };
      const pos = petPositionForAnchor(petSize, contact.anchor, target);
      // Walk instead of teleport: each poll tick moves at most walkMaxStepPx
      // toward the target so mom visibly strolls over to the hangup button.
      const stepPx = Number(stage.walkMaxStepPx);
      const maxStep = Number.isFinite(stepPx) && stepPx > 0 ? stepPx : 5;
      const dx = pos.x - pet.x;
      const dy = pos.y - pet.y;
      const dist = Math.hypot(dx, dy);
      let nextX;
      let nextY;
      if (dist <= maxStep) {
        nextX = pos.x;
        nextY = pos.y;
      } else {
        nextX = Math.round(pet.x + (dx / dist) * maxStep);
        nextY = Math.round(pet.y + (dy / dist) * maxStep);
      }
      // Face the direction of travel: mirror the walk animation when moving left.
      if (typeof onWalkFacing === 'function') onWalkFacing(nextX < pet.x - 1 ? 'left' : nextX > pet.x + 1 ? 'right' : null);
      movePetWindow(nextX, nextY);
      return;
    }
    // Generic rect approach (e.g. nearest-window-top, sequence-origin): glide
    // the pet so the stage anchor lands on a configurable point of the rect
    // (default: top edge center) at up to walkMaxStepPx per poll tick. Used by
    // market-mood sequences to fly the pet onto a window top and back.
    {
      const anchor = (stage.anchor && Number.isFinite(stage.anchor.x) && Number.isFinite(stage.anchor.y))
        ? stage.anchor
        : { x: 0.5, y: 0.7 };
      const targetX = Number.isFinite(stage.targetX) ? stage.targetX : 0.5;
      const targetY = Number.isFinite(stage.targetY) ? stage.targetY : 0;
      const target = {
        x: rect.x + rect.width * targetX,
        y: rect.y + rect.height * targetY
      };
      const pos = petPositionForAnchor(petSize, anchor, target);
      const stepPx = Number(stage.walkMaxStepPx);
      const maxStep = Number.isFinite(stepPx) && stepPx > 0 ? stepPx : 8;
      const dx = pos.x - pet.x;
      const dy = pos.y - pet.y;
      const dist = Math.hypot(dx, dy);
      let nextX;
      let nextY;
      if (dist <= maxStep) {
        nextX = pos.x;
        nextY = pos.y;
      } else {
        nextX = Math.round(pet.x + (dx / dist) * maxStep);
        nextY = Math.round(pet.y + (dy / dist) * maxStep);
      }
      if (typeof onWalkFacing === 'function') onWalkFacing(nextX < pet.x - 1 ? 'left' : nextX > pet.x + 1 ? 'right' : null);
      movePetWindow(nextX, nextY);
    }
  }

  function scheduleApproachPoll(stage) {
    if (!getApproachRect || !movePetWindow) {
      return;
    }
    const pollStageIndex = stageIndex;
    pollTimerId = setTimerFn(() => {
      pollTimerId = null;
      if (!active || stageIndex !== pollStageIndex) {
        return;
      }
      moveToward(stage);
      const hangup = hangupContact();
      if (hangupOverlapping() && hangup && stage.action !== hangup.action) {
        clearCurrentTimer();
        advance();
        return;
      }
      maybeContact(stage);
      scheduleApproachPoll(stage);
    }, 50);
  }

  function scheduleAdvance(delay) {
    advanceTimerId = setTimerFn(() => {
      advanceTimerId = null;
      if (pollTimerId != null) {
        clearTimerFn(pollTimerId);
        pollTimerId = null;
      }
      advance();
    }, delay);
  }

  function finishSequence() {
    clearCurrentTimer();
    waitingForClick = false;
    active = false;
    stages = [];
    currentSequence = null;
    stageIndex = 0;
    contacted = false;
    resetRunCallbacks();
    // sendState after active=false so main-process restorePetWindowSize can run.
    // The last cinematic stage is sent while the sequence is still active and skips that restore.
    sendState('idle');
    const cbs = finishCallbacks.splice(0);
    for (const cb of cbs) {
      try { cb(); } catch (_) { /* callback errors must not break the sequence */ }
    }
    scheduleBehavior(900);
  }

  function advance() {
    if (!active) {
      return;
    }
    stageIndex += 1;
    if (stageIndex >= stages.length) {
      finishSequence();
      return;
    }
    playStage(stageIndex);
  }

  function playStage(index) {
    const stage = stages[index];
    if (!stage) {
      finishSequence();
      return;
    }

    const message = stage.message != null
      ? stage.message
      : (stage.messages && stage.messages[0]) || '';
    const extras = buildExtras(stage);
    sendState(stage.action, message, '', extras);
    maybeContact(stage);

    if (stage.restorePosition === true && restoreFrom && movePetWindow) {
      movePetWindow(restoreFrom.x, restoreFrom.y);
    }

    if (stage.waitForClick) {
      waitingForClick = true;
      return;
    }

    waitingForClick = false;

    if (stage.approachTarget) {
      moveToward(stage);
      scheduleApproachPoll(stage);
      scheduleAdvance(resolveApproachDelay(stage));
      return;
    }

    const duration = resolveDuration(stage);

    if (stage.action === 'idle' && duration === 0) {
      advance();
      return;
    }

    scheduleAdvance(duration);
  }

  function validateSequence(id) {
    const manifest = getManifest();
    if (!manifest?.sequences?.[id]) {
      return false;
    }
    const { stages: seqStages } = manifest.sequences[id];
    if (!Array.isArray(seqStages) || seqStages.length === 0) {
      return false;
    }
    const animations = manifest.animations || {};
    return seqStages.every((stage) => stage.action && animations[stage.action]);
  }

  function cancel(options = {}) {
    const shouldSchedule = options.schedule !== false;
    clearCurrentTimer();
    waitingForClick = false;
    active = false;
    stages = [];
    currentSequence = null;
    stageIndex = 0;
    contacted = false;
    resetRunCallbacks();
    sendState('idle');
    if (shouldSchedule) {
      scheduleBehavior(900);
    }
  }

  function start(id, session) {
    if (!validateSequence(id)) {
      return false;
    }
    if (active) {
      cancel({ schedule: false });
    }
    pauseBehavior();
    const sequence = getManifest().sequences[id];
    currentSequence = sequence;
    stages = sequence.stages;
    stageIndex = 0;
    active = true;
    waitingForClick = false;
    contacted = false;
    applySession(session);
    playStage(0);
    return true;
  }

  function continueFromClick() {
    if (!active || !waitingForClick) {
      return false;
    }
    waitingForClick = false;
    advance();
    return true;
  }

  function dispose() {
    cancel({ schedule: false });
  }

  return {
    start,
    cancel,
    dispose,
    continueFromClick,
    isWaitingForClick: () => waitingForClick,
    isActive: () => active,
    onceFinished: (cb) => { finishCallbacks.push(typeof cb === 'function' ? cb : () => {}); }
  };
}

module.exports = { createSequenceController };
