### Task 7: 女声音频

**Files:**
- Create: `pets/work/laopo/audio/` 与最终 `pets/library/laopo/audio/`
- `call-hubby.mp3` ← 「老公」
- `talent-show.mp3` ← 「上才艺」
- `serve-tea.mp3` ← 「老公喝茶」
- `love-you.mp3` ← 「爱你老公」
- `praise.mp3` ← 「宝贝真棒」
- `encourage.mp3` ← 「老公辛苦了」

- [ ] **Step 1: 用女声 TTS 生成（优先 edge-tts 中文女声，如 `zh-CN-XiaoxiaoNeural`）**

```powershell
edge-tts --voice zh-CN-XiaoxiaoNeural --text "老公" --write-media pets/work/laopo/audio/call-hubby.mp3
edge-tts --voice zh-CN-XiaoxiaoNeural --text "上才艺" --write-media pets/work/laopo/audio/talent-show.mp3
edge-tts --voice zh-CN-XiaoxiaoNeural --text "老公喝茶" --write-media pets/work/laopo/audio/serve-tea.mp3
edge-tts --voice zh-CN-XiaoxiaoNeural --text "爱你老公" --write-media pets/work/laopo/audio/love-you.mp3
edge-tts --voice zh-CN-XiaoxiaoNeural --text "宝贝真棒" --write-media pets/work/laopo/audio/praise.mp3
edge-tts --voice zh-CN-XiaoxiaoNeural --text "老公辛苦了" --write-media pets/work/laopo/audio/encourage.mp3
```

若未安装：`pip install edge-tts` 后再跑。

- [ ] **Step 2: 试听确认是女声且无多余静音过长**

---

