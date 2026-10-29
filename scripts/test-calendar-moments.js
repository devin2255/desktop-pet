'use strict';

const assert = require('assert');
const { validateManifest } = require('../src/petpack-validator');
const {
  pickCalendarMoment,
  nextCalendarMoment,
  resolveCalendarLine,
  remapAnimationAction
} = require('../src/calendar-moments');
const { resolveStartupGreeting } = require('../src/startup-greeting');

const moments = [
  { id: 'lichun', name: '立春', monthDay: [2, 4], greeting: '我把春气给你捂热一点。', poem: '风一软，冬天就让了半步。', know: '立春迎春。', bubble: '春气来了。' },
  { id: 'xiaoman', name: '小满', monthDay: [5, 21], greeting: '我叫小满。今天，也刚刚好。', poem: '麦粒将满未满，刚好最动人。', know: '小满将满。', bubble: '刚刚好。' },
  { id: 'dashu', name: '大暑', monthDay: [7, 23], greeting: '我摇扇，你歇一会儿。', poem: '热把世界熨平，只剩一声蝉。', know: '大暑最热。', bubble: '先歇一会儿。' },
  { id: 'qiufen', name: '秋分', monthDay: [9, 23], greeting: '一半光，一半静，我陪你。', poem: '昼夜平分，心事也可对半放下。', know: '秋分日夜等长。', origin: '秋分昼夜又均。', bubble: '一半光，一半静。' },
  { id: 'dongzhi', name: '冬至', monthDay: [12, 22], greeting: '冷没关系，我在这儿。', poem: '夜最长的那天，灯要更亮一点。', know: '冬至一阳生。', bubble: '我在这儿。' }
];

assert.strictEqual(pickCalendarMoment(moments, new Date(2026, 8, 9)).id, 'qiufen');
assert.strictEqual(pickCalendarMoment(moments, new Date(2026, 4, 21)).id, 'xiaoman');
assert.strictEqual(pickCalendarMoment(moments, new Date(2026, 0, 1)).id, 'dongzhi');
assert.strictEqual(pickCalendarMoment(moments, new Date(2026, 8, 9), 'lichun').id, 'lichun');
assert.strictEqual(nextCalendarMoment(moments, 'qiufen').id, 'dongzhi');
assert.strictEqual(nextCalendarMoment(moments, 'dongzhi').id, 'lichun');
assert.strictEqual(resolveCalendarLine(moments[3], 'poem'), '昼夜平分，心事也可对半放下。');
assert.strictEqual(
  resolveCalendarLine(moments[3], 'today', 0, new Date(2026, 8, 23)),
  '今日秋分。昼夜平分，心事也可对半放下。'
);
assert.strictEqual(
  resolveCalendarLine(moments[3], 'today', 0, new Date(2026, 8, 10)),
  '9月23日秋分。昼夜平分，心事也可对半放下。'
);
assert.strictEqual(
  resolveCalendarLine(moments[1], 'today', 0, new Date(2026, 4, 21)),
  '今日小满。麦粒将满未满，刚好最动人。'
);
assert.strictEqual(
  resolveCalendarLine(moments[1], 'today', 0, new Date(2026, 0, 1)),
  '5月21日小满。麦粒将满未满，刚好最动人。'
);
assert.strictEqual(
  resolveCalendarLine({
    name: '秋分',
    monthDay: [9, 23],
    poem: '昼夜平分，心事也可对半放下。',
    ceremony: '昼夜中分，雷始收声。'
  }, 'today', 0, new Date(2026, 8, 23)),
  '今日秋分。昼夜中分，雷始收声。'
);
assert.strictEqual(resolveCalendarLine(moments[3], 'cycle', 0), moments[3].greeting);
assert.strictEqual(resolveCalendarLine(moments[3], 'cycle', 1), moments[3].origin);
assert.strictEqual(resolveCalendarLine(moments[3], 'cycle', 2), moments[3].poem);
assert.strictEqual(resolveCalendarLine(moments[3], 'cycle', 3), moments[3].know);
assert.strictEqual(resolveCalendarLine(moments[3], 'cycle', 4), moments[3].bubble);
assert.strictEqual(resolveCalendarLine(moments[3], 'cycle', 5), moments[3].greeting);
assert.strictEqual(resolveCalendarLine({ verse: '「露从今夜白。」杜甫客秦州。' }, 'verse'), '「露从今夜白。」杜甫客秦州。');
assert.strictEqual(remapAnimationAction({ 'idle-qiufen': {} }, 'idle', { id: 'qiufen' }), 'idle-qiufen');
assert.strictEqual(remapAnimationAction({ idle: {} }, 'idle', { id: 'qiufen' }), 'idle');

const { expandContextMenuItems } = require('../src/calendar-moments');
const chooseMenu = expandContextMenuItems(
  [{ id: 'pick-term', label: '换个节气', action: 'reaction', calendarLine: 'choose', duration: 3200 }],
  moments,
  moments[3]
);
assert.strictEqual(chooseMenu.length, 1);
assert.strictEqual(chooseMenu[0].submenu.length, 5);
assert.strictEqual(chooseMenu[0].submenu[3].calendarMomentId, 'qiufen');
assert.strictEqual(chooseMenu[0].submenu[3].checked, true);
assert.strictEqual(chooseMenu[0].submenu[0].calendarLine, 'select');

assert.strictEqual(
  resolveStartupGreeting(
    { name: '小满', calendarMoments: [{ id: 'qiufen', name: '秋分', monthDay: [9, 23], greeting: '一半光。', ceremony: '昼夜中分，雷始收声。' }] },
    { date: new Date(2026, 8, 23) }
  ),
  '今日秋分。昼夜中分，雷始收声。'
);
assert.strictEqual(
  resolveStartupGreeting({ name: '小满', calendarMoments: moments }, { date: new Date(2026, 8, 9) }),
  '一半光，一半静，我陪你。'
);
assert.strictEqual(
  resolveStartupGreeting({ name: '小满', calendarMoments: moments }, { date: new Date(2026, 8, 9) }),
  '一半光，一半静，我陪你。'
);
assert.strictEqual(
  resolveStartupGreeting({ name: '小满', startupGreeting: '我叫小满。今天，也刚刚好。' }),
  '我叫小满。今天，也刚刚好。'
);

const base = {
  schemaVersion: 1,
  id: 'demo',
  name: '演示',
  preview: 'preview.png',
  animations: {
    idle: { frames: ['a/1.png', 'a/2.png', 'a/3.png', 'a/4.png'], durations: [100, 100, 100, 100], loop: true },
    walk: { frames: ['b/1.png', 'b/2.png', 'b/3.png', 'b/4.png', 'b/5.png', 'b/6.png'], durations: [100, 100, 100, 100, 100, 100], loop: true },
    sit: { frames: ['c/1.png', 'c/2.png', 'c/3.png', 'c/4.png'], durations: [100, 100, 100, 100], loop: false },
    sleep: { frames: ['d/1.png', 'd/2.png', 'd/3.png', 'd/4.png'], durations: [100, 100, 100, 100], loop: true },
    reaction: { frames: ['e/1.png', 'e/2.png', 'e/3.png', 'e/4.png'], durations: [100, 100, 100, 100], loop: false }
  }
};

assert.doesNotThrow(() => validateManifest({
  ...base,
  calendarMoments: moments,
  interact: { calendarLine: 'bubble', message: '今天也刚好。' },
  contextMenuActions: [
    { id: 'today-term', label: '今日节气', action: 'reaction', calendarLine: 'today' },
    { id: 'pick-term', label: '换个节气', action: 'reaction', calendarLine: 'choose' }
  ],
  behavior: {
    random: [
      { state: 'sit', weight: 1, minDuration: 1000, maxDuration: 2000, calendarLine: 'bubble' }
    ]
  }
}));

assert.throws(
  () => validateManifest({ ...base, calendarMoments: [{ id: 'bad', name: 'x', monthDay: [13, 1] }] }),
  /calendarMoments/
);
assert.throws(
  () => validateManifest({
    ...base,
    contextMenuActions: [{ id: 'bad-line', label: '今日', action: 'reaction', calendarLine: 'nope' }]
  }),
  /calendarLine/
);

console.log('calendar moment checks passed');
