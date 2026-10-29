'use strict';

const { pickCalendarMoment, isMomentOnDate } = require('./calendar-moments');

function resolveStartupGreeting(manifest, { switching = false, date = new Date(), momentId = '' } = {}) {
  const moment = pickCalendarMoment(manifest?.calendarMoments, date, momentId);
  const ceremony = isMomentOnDate(moment, date) && typeof moment?.ceremony === 'string'
    ? moment.ceremony.trim()
    : '';
  if (ceremony) {
    const name = typeof moment?.name === 'string' ? moment.name.trim() : '';
    return name ? `今日${name}。${ceremony}` : ceremony;
  }
  const seasonal = typeof moment?.greeting === 'string' ? moment.greeting.trim() : '';
  if (seasonal) return seasonal;
  const custom = typeof manifest?.startupGreeting === 'string' ? manifest.startupGreeting.trim() : '';
  if (custom) return custom;
  const name = typeof manifest?.name === 'string' && manifest.name.trim() ? manifest.name.trim() : '桌宠';
  return switching ? `你好，我是${name}。` : `我是${name}。`;
}

module.exports = { resolveStartupGreeting };
