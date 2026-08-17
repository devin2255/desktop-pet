'use strict';

const {
  petPositionForAnchor,
  nearestVerticalEdge,
  anchorsOverlap,
  mirrorAnchorX
} = require('./approach-target');

function createSequenceController(deps) {
  const getManifest = deps.getManifest;
  const sendState = deps.sendState;
  const pauseBehavior = deps.pauseBehavior || (() => {});
  const scheduleBehavior = deps.scheduleBehavior || (() => {});
  const setTimerFn = deps.setTimer || ((fn, ms) => setTimeout(fn, ms));
  const clearTimerFn = deps.clearTimer || clearTimeout;
  const getPetBounds = typeof deps.getPetBounds === 'function' ? deps.getPetBounds : null;
  const movePetWindow = typeof deps.movePetWindow === 'function' ? deps.movePetWindow : null;
  const getApproachRect = typeof deps.getApproachRect === 'function' ? deps.getApproachRect : null;
  const onContact = typeof deps.onContact === 'function' ? deps.onContact : null;

  let active = false;
  let stageIndex = 0;
  let stages = [];
  let currentSequence = null;
  let waitingForClick = false;
  let advanceTimerId = null;
  let pollTimerId = null;
  let restoreFrom = null;
  let contacted = false;

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
      movePetWindow(pos.x, pos.y);
    }
  }

  function scheduleApproachPoll(stage) {
    if (!getApproachRect || !movePetWindow) {
      return;
    }
    pollTimerId = setTimerFn(() => {
      pollTimerId = null;
      if (!active) {
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
    restoreFrom = null;
    contacted = false;
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
      maybeContact(stage);
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
    restoreFrom = null;
    contacted = false;
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
    restoreFrom = session?.restoreFrom || null;
    if (!restoreFrom && getPetBounds) {
      const bounds = getPetBounds();
      if (bounds) {
        restoreFrom = { x: bounds.x, y: bounds.y };
      }
    }
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
    isActive: () => active
  };
}

module.exports = { createSequenceController };
