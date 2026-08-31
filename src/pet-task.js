'use strict';

const MOCK_DELAY_MS = 2000;

const MOCK_RESULTS = {
  'weekly-report': '这周对齐了八回，饼画了三张，代码还在路上，我筐也没到。',
  'summarize-chat': '重点就一句：先别下班。其余全是闭环、颗粒度和未来可期。',
  'collect-gossip': '有人说周末来一趟，转头又说小意思。我躺着听完的，锅还没飞到。'
};

function mockResultFor(taskType) {
  return MOCK_RESULTS[taskType] || MOCK_RESULTS['summarize-chat'];
}

function schedulePetTaskMock({
  taskType,
  onResult,
  setTimer = setTimeout,
  delayMs = MOCK_DELAY_MS
} = {}) {
  const result = mockResultFor(taskType);
  return setTimer(() => {
    if (typeof onResult === 'function') onResult(result);
  }, delayMs);
}

module.exports = {
  MOCK_DELAY_MS,
  MOCK_RESULTS,
  mockResultFor,
  schedulePetTaskMock
};
