'use strict';

function resolveStartupGreeting(manifest, { switching = false } = {}) {
  const custom = typeof manifest?.startupGreeting === 'string' ? manifest.startupGreeting.trim() : '';
  if (custom) return custom;
  const name = typeof manifest?.name === 'string' && manifest.name.trim() ? manifest.name.trim() : '桌宠';
  return switching ? `你好，我是${name}。` : `我是${name}。`;
}

module.exports = { resolveStartupGreeting };
