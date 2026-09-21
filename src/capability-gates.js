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

function hasDuo(manifest) {
  const duo = manifest && manifest.duo;
  return Boolean(duo && typeof duo === 'object' && !Array.isArray(duo) && Array.isArray(duo.members) && duo.members.length === 2);
}

function hasDuoTent(manifest) {
  return hasDuo(manifest)
    && Boolean(manifest.duo.tent && typeof manifest.duo.tent === 'object' && !Array.isArray(manifest.duo.tent));
}

function hasDuoSlack(manifest) {
  return hasDuo(manifest)
    && Boolean(manifest.duo.slack && typeof manifest.duo.slack === 'object' && !Array.isArray(manifest.duo.slack));
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
  hasDuo,
  hasDuoTent,
  hasDuoSlack,
  watchMenuLabel,
  taskProviderFromConfig
};
