### Task 4: 磕头条 + pet.json 接线

**Files:**
- Create: `pets/work/brother-judge/source/realistic/kowtow-chroma.png`
- Modify: `pets/library/brother-judge/pet.json`（`animations.kowtow` + 菜单 action）

**Interfaces:**
- Consumes: master；参考 laopo `kowtow` 帧时序（起身→俯身→磕头→起）
- Produces: `kowtow` 6 帧绿幕条；清单字段可被播放器加载

- [ ] **Step 1: 生成 kowtow-chroma.png（6 帧）**

```text
Create exactly six photoreal frames of the same judge character performing a Chinese kowtow bow:
stand, bend, kneel-forward, forehead-near-ground hold, rise, return upright.
Keep hat wings fully visible and deform naturally with head motion.
No speech bubble, no text. Same identity and #00FF00 strip rules as other actions.
```

- [ ] **Step 2: 更新 pet.json 动画与菜单**

在 `animations` 中新增（与现有风格一致）：

```json
"kowtow": {
  "frames": [
    "animations/kowtow/01.png",
    "animations/kowtow/02.png",
    "animations/kowtow/03.png",
    "animations/kowtow/04.png",
    "animations/kowtow/05.png",
    "animations/kowtow/06.png"
  ],
  "durations": [180, 180, 220, 500, 220, 900],
  "loop": false,
  "holdLastFrame": true,
  "scale": 1
}
```

将 contextMenu 磕头改为：

```json
{
  "id": "kowtow",
  "label": "磕头",
  "action": "kowtow",
  "duration": 3600
}
```

（无 `message`、无 `speech`。）

- [ ] **Step 3: 语法/结构自检**

Run:

```powershell
node -e "JSON.parse(require('fs').readFileSync('pets/library/brother-judge/pet.json','utf8')); console.log('ok')"
```

Expected: `ok`

---
