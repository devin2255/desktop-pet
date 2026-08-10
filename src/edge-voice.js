'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function createVoiceSynthesizer({ cacheDir, voice = 'zh-CN-YunxiNeural', rate = '+0%', loader }) {
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  let chain = Promise.resolve();
  const loadTts = loader || (() => require('edge-tts').tts);

  function synthesize(text) {
    const key = crypto.createHash('sha256').update(String(text)).update(voice).update(rate).digest('hex').slice(0, 32);
    const filePath = path.join(cacheDir, `${key}.mp3`);
    if (fs.existsSync(filePath)) return Promise.resolve({ url: `voice-cache://${key}.mp3` });
    const task = chain.then(async () => {
      try {
        const tts = await loadTts();
        const buffer = await tts(text, { voice, rate });
        fs.writeFileSync(filePath, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
        return { url: `voice-cache://${key}.mp3` };
      } catch (_) {
        return null;
      }
    });
    chain = task.catch(() => {});
    return task;
  }

  return { synthesize, dispose() { chain = Promise.resolve(); } };
}

module.exports = { createVoiceSynthesizer };
