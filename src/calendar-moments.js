'use strict';

const CALENDAR_LINES = new Set(['today', 'poem', 'know', 'bubble', 'greeting', 'origin', 'verse', 'almanac', 'flower', 'ceremony', 'next', 'choose', 'select', 'cycle']);
const STATIC_CALENDAR_LINES = new Set(['today', 'poem', 'know', 'bubble', 'greeting', 'origin', 'verse', 'almanac', 'flower', 'ceremony']);
const BEHAVIOR_CALENDAR_LINES = new Set(['today', 'poem', 'know', 'bubble', 'greeting', 'origin', 'verse', 'almanac', 'flower', 'cycle']);
const CYCLE_FIELDS = ['greeting', 'origin', 'verse', 'poem', 'know', 'almanac', 'flower', 'bubble'];
const WEATHER_FX = new Set(['qi', 'petal', 'rain', 'dew', 'leaf', 'firefly', 'snow', 'frost']);
const CLICK_FX = new Set(['hearts', 'seal', 'qi', 'seasonal']);

function dayOfYear(date) {
  const year = date.getFullYear();
  const utc = Date.UTC(year, date.getMonth(), date.getDate());
  const start = Date.UTC(year, 0, 0);
  return Math.round((utc - start) / 86400000);
}

function yearLength(year) {
  return ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;
}

function momentDayOfYear(year, monthDay) {
  if (!Array.isArray(monthDay) || monthDay.length !== 2) return NaN;
  return dayOfYear(new Date(year, monthDay[0] - 1, monthDay[1]));
}

function circularDistance(left, right, length) {
  const diff = Math.abs(left - right);
  return Math.min(diff, length - diff);
}

function pickCalendarMoment(moments, date = new Date(), overrideId = '') {
  if (!Array.isArray(moments) || !moments.length) return null;
  if (overrideId) {
    const override = moments.find((item) => item && item.id === overrideId);
    if (override) return override;
  }
  const year = date.getFullYear();
  const today = dayOfYear(date);
  const length = yearLength(year);
  let best = moments[0];
  let bestDist = Infinity;
  for (const item of moments) {
    const day = momentDayOfYear(year, item?.monthDay);
    if (!Number.isFinite(day)) continue;
    const dist = circularDistance(today, day, length);
    if (dist < bestDist) {
      best = item;
      bestDist = dist;
    }
  }
  return best || null;
}

function nextCalendarMoment(moments, currentId) {
  if (!Array.isArray(moments) || !moments.length) return null;
  const index = moments.findIndex((item) => item && item.id === currentId);
  if (index < 0) return moments[0];
  return moments[(index + 1) % moments.length];
}

function cycleCalendarFields(moment) {
  return CYCLE_FIELDS.filter((field) => typeof moment?.[field] === 'string' && moment[field].trim());
}

function asDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
}

function momentMonthDay(moment) {
  const monthDay = moment?.monthDay;
  if (!Array.isArray(monthDay) || monthDay.length !== 2) return null;
  const month = Number(monthDay[0]);
  const day = Number(monthDay[1]);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;
  return [month, day];
}

function isMomentOnDate(moment, date = new Date()) {
  const monthDay = momentMonthDay(moment);
  if (!monthDay) return false;
  const when = asDate(date);
  return when.getMonth() + 1 === monthDay[0] && when.getDate() === monthDay[1];
}

function formatCalendarTodayTitle(moment, date = new Date()) {
  const name = typeof moment?.name === 'string' ? moment.name.trim() : '';
  if (!name) return '';
  if (isMomentOnDate(moment, date)) return `今日${name}`;
  const monthDay = momentMonthDay(moment);
  return monthDay ? `${monthDay[0]}月${monthDay[1]}日${name}` : name;
}

function resolveCalendarLine(moment, line, cycleIndex = 0, date = new Date()) {
  if (!moment || !line) return '';
  if (line === 'cycle') {
    const fields = cycleCalendarFields(moment);
    if (!fields.length) return '';
    const field = fields[((Number(cycleIndex) || 0) % fields.length + fields.length) % fields.length];
    return resolveCalendarLine(moment, field, 0, date);
  }
  if (line === 'today') {
    const title = formatCalendarTodayTitle(moment, date);
    const ceremony = isMomentOnDate(moment, date) && typeof moment.ceremony === 'string'
      ? moment.ceremony.trim()
      : '';
    const poem = typeof moment.poem === 'string' ? moment.poem.trim() : '';
    const body = ceremony || poem || (typeof moment.greeting === 'string' ? moment.greeting.trim() : '');
    if (title && body) return `${title}。${body}`;
    return body || title;
  }
  if (line === 'next' || line === 'select' || line === 'choose' || line === 'greeting') {
    return typeof moment.greeting === 'string' ? moment.greeting : '';
  }
  const value = moment[line];
  return typeof value === 'string' ? value : '';
}

function remapAnimationAction(animations, action, moment) {
  if (!animations || !action || !moment?.id) return action;
  const seasonal = `${action}-${moment.id}`;
  return Object.hasOwn(animations, seasonal) ? seasonal : action;
}

function expandContextMenuItems(actions, moments, currentMoment) {
  if (!Array.isArray(actions)) return [];
  return actions.flatMap((item) => {
    if (!item || item.calendarLine !== 'choose') return [item];
    const submenu = (Array.isArray(moments) ? moments : []).map((moment) => ({
      id: `${item.id}-${moment.id}`,
      label: moment.name,
      action: item.action || 'reaction',
      calendarLine: 'select',
      calendarMomentId: moment.id,
      duration: item.duration,
      checked: Boolean(currentMoment && currentMoment.id === moment.id)
    }));
    return [{ label: item.label, action: item.action, calendarLine: 'choose', submenu }];
  });
}

module.exports = {
  CALENDAR_LINES,
  STATIC_CALENDAR_LINES,
  BEHAVIOR_CALENDAR_LINES,
  CYCLE_FIELDS,
  pickCalendarMoment,
  nextCalendarMoment,
  resolveCalendarLine,
  formatCalendarTodayTitle,
  isMomentOnDate,
  cycleCalendarFields,
  remapAnimationAction,
  expandContextMenuItems,
  WEATHER_FX,
  CLICK_FX
};
