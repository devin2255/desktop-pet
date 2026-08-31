'use strict';

function hasWatch(manifest) {
  return Boolean(manifest && manifest.watch && typeof manifest.watch === 'object' && !Array.isArray(manifest.watch));
}

function hasMarketSequences(manifest) {
  const sequences = manifest && manifest.sequences;
  return Boolean(sequences && (sequences['market-bull'] || sequences['market-bear']));
}

function hasCallHangupSequence(manifest) {
  const sequences = manifest && manifest.sequences && typeof manifest.sequences === 'object'
    ? Object.values(manifest.sequences)
    : [];
  return sequences.some((seq) => Array.isArray(seq && seq.stages)
    && seq.stages.some((stage) => stage && (stage.onContact || stage.messageLoop)));
}

function watchMenuLabel(manifest) {
  const label = manifest && manifest.watch && typeof manifest.watch.menuLabel === 'string'
    ? manifest.watch.menuLabel.trim()
    : '';
  return label || '消息雷达';
}

function taskProviderFromConfig(watchConfig) {
  return watchConfig && watchConfig.tasks && watchConfig.tasks.provider === 'mock' ? 'mock' : 'feishu';
}

module.exports = {
  hasWatch,
  hasMarketSequences,
  hasCallHangupSequence,
  watchMenuLabel,
  taskProviderFromConfig
};
