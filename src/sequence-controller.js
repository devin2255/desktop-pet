'use strict';

function createSequenceController(deps) {
  const getManifest = deps.getManifest;
  const sendState = deps.sendState;
  const pauseBehavior = deps.pauseBehavior || (() => {});
  const scheduleBehavior = deps.scheduleBehavior || (() => {});
  const setTimerFn = deps.setTimer || ((fn, ms) => setTimeout(fn, ms));
  const clearTimerFn = deps.clearTimer || clearTimeout;

  let active = false;
  let stageIndex = 0;
  let stages = [];
  let waitingForClick = false;
  let timerId = null;

  function clearCurrentTimer() {
    if (timerId != null) {
      clearTimerFn(timerId);
      timerId = null;
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
    return Object.keys(extras).length > 0 ? extras : undefined;
  }

  function resolveDuration(stage) {
    if (stage.duration != null) {
      return stage.duration;
    }
    return 3000;
  }

  function finishSequence() {
    clearCurrentTimer();
    waitingForClick = false;
    active = false;
    stages = [];
    stageIndex = 0;
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

    if (stage.waitForClick) {
      waitingForClick = true;
      return;
    }

    waitingForClick = false;
    const duration = resolveDuration(stage);

    if (stage.action === 'idle' && duration === 0) {
      advance();
      return;
    }

    timerId = setTimerFn(() => {
      timerId = null;
      advance();
    }, duration);
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
    stageIndex = 0;
    sendState('idle');
    if (shouldSchedule) {
      scheduleBehavior(900);
    }
  }

  function start(id) {
    if (!validateSequence(id)) {
      return false;
    }
    if (active) {
      cancel({ schedule: false });
    }
    pauseBehavior();
    stages = getManifest().sequences[id].stages;
    stageIndex = 0;
    active = true;
    waitingForClick = false;
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
