'use strict';
// One-off: synthesize placeholder call audio for niulai boss-call sequence.
// Replace these files with real recordings later (keep file names).
const fs = require('fs');
const path = require('path');

(async () => {
  const { tts } = await import('edge-tts/out/index.js');
  const outDir = path.join(__dirname, '..', 'pets', 'library', 'niulai', 'audio');
  fs.mkdirSync(outDir, { recursive: true });

  const jobs = [
    { file: 'call-mom.mp3', text: '妈妈！', voice: 'zh-CN-YunxiaNeural', rate: '+15%' },
    { file: 'mom-niulai.mp3', text: '牛来？', voice: 'zh-CN-XiaoxiaoNeural', rate: '+0%' }
  ];

  for (const job of jobs) {
    const buffer = await tts(job.text, { voice: job.voice, rate: job.rate });
    const target = path.join(outDir, job.file);
    fs.writeFileSync(target, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
    console.log(`written ${target} (${fs.statSync(target).size} bytes)`);
  }
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
