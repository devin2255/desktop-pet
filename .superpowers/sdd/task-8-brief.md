### Task 8: 组装 `pets/library/laopo` 与 `pet.json`

**Files:**
- Create: `pets/library/laopo/**`
- Create: `pets/library/laopo/pet.json`
- Create: `pets/library/laopo/preview.png`（从 master/idle 生成）

- [ ] **Step 1: 复制规范化帧到 `animations/<action>/01.png...`**

- [ ] **Step 2: 复制音频到 `audio/*.mp3`**

- [ ] **Step 3: 写 `pet.json`（关键字段如下，durations 按实际观感微调）**

```json
{
  "schemaVersion": 1,
  "packageVersion": "0.1.0",
  "id": "laopo",
  "name": "老婆",
  "description": "俏皮粘人的老婆桌宠：站立待机、散步陪伴，会叫老公、磕头、上才艺扭屁股。",
  "personality": ["俏皮", "粘人", "甜蜜"],
  "speechGender": "female",
  "startupGreeting": "老公，我来啦~",
  "defaultSize": "small",
  "preview": "preview.png",
  "normalizationMetric": "alpha-area-v1",
  "animations": {
    "idle": { "frames": ["animations/idle/01.png", "animations/idle/02.png", "animations/idle/03.png", "animations/idle/04.png"], "durations": [420, 300, 260, 420], "loop": true, "scale": 1 },
    "walk": { "frames": ["animations/walk/01.png", "animations/walk/02.png", "animations/walk/03.png", "animations/walk/04.png", "animations/walk/05.png", "animations/walk/06.png"], "durations": [140, 140, 140, 140, 140, 140], "loop": true, "scale": 1 },
    "sit": { "frames": ["animations/sit/01.png", "animations/sit/02.png", "animations/sit/03.png", "animations/sit/04.png"], "durations": [220, 220, 260, 2000], "loop": false, "holdLastFrame": true, "scale": 1 },
    "sleep": { "frames": ["animations/sleep/01.png", "animations/sleep/02.png", "animations/sleep/03.png", "animations/sleep/04.png"], "durations": [650, 650, 420, 650], "loop": true, "scale": 1 },
    "reaction": { "frames": ["animations/reaction/01.png", "animations/reaction/02.png", "animations/reaction/03.png", "animations/reaction/04.png"], "durations": [160, 180, 220, 1500], "loop": false, "holdLastFrame": true, "scale": 1 },
    "drag": { "frames": ["animations/drag/01.png", "animations/drag/02.png", "animations/drag/03.png", "animations/drag/04.png", "animations/drag/05.png", "animations/drag/06.png"], "durations": [120, 120, 120, 120, 120, 120], "loop": true, "scale": 1 },
    "climb": { "frames": ["animations/climb/01.png", "animations/climb/02.png", "animations/climb/03.png", "animations/climb/04.png", "animations/climb/05.png", "animations/climb/06.png"], "durations": [140, 140, 140, 140, 140, 140], "loop": true, "scale": 1 },
    "perch": { "frames": ["animations/perch/01.png", "animations/perch/02.png", "animations/perch/03.png", "animations/perch/04.png"], "durations": [220, 220, 220, 1800], "loop": true, "scale": 1 },
    "perch-hair-flip": { "frames": ["animations/perch-hair-flip/01.png", "animations/perch-hair-flip/02.png", "animations/perch-hair-flip/03.png", "animations/perch-hair-flip/04.png", "animations/perch-hair-flip/05.png", "animations/perch-hair-flip/06.png"], "durations": [200, 220, 240, 260, 280, 600], "loop": false, "holdLastFrame": true, "scale": 1 },
    "perch-blow-kiss": { "frames": ["animations/perch-blow-kiss/01.png", "animations/perch-blow-kiss/02.png", "animations/perch-blow-kiss/03.png", "animations/perch-blow-kiss/04.png", "animations/perch-blow-kiss/05.png", "animations/perch-blow-kiss/06.png"], "durations": [180, 200, 220, 260, 400, 500], "loop": false, "holdLastFrame": true, "scale": 1 },
    "perch-look": { "frames": ["animations/perch-look/01.png", "animations/perch-look/02.png", "animations/perch-look/03.png", "animations/perch-look/04.png", "animations/perch-look/05.png", "animations/perch-look/06.png"], "durations": [200, 220, 200, 220, 200, 400], "loop": false, "holdLastFrame": true, "scale": 1 },
    "hang": { "frames": ["animations/hang/01.png", "animations/hang/02.png", "animations/hang/03.png", "animations/hang/04.png"], "durations": [220, 220, 220, 1800], "loop": true, "scale": 1 },
    "fall": { "frames": ["animations/fall/01.png", "animations/fall/02.png", "animations/fall/03.png", "animations/fall/04.png"], "durations": [120, 120, 120, 120], "loop": true, "scale": 1 },
    "impact": { "frames": ["animations/impact/01.png", "animations/impact/02.png", "animations/impact/03.png", "animations/impact/04.png"], "durations": [140, 160, 180, 900], "loop": false, "holdLastFrame": true, "scale": 1 },
    "pat-butt": { "frames": ["animations/pat-butt/01.png", "animations/pat-butt/02.png", "animations/pat-butt/03.png", "animations/pat-butt/04.png", "animations/pat-butt/05.png", "animations/pat-butt/06.png"], "durations": [140, 140, 160, 160, 160, 700], "loop": false, "holdLastFrame": true, "scale": 1 },
    "call-hubby": { "frames": ["animations/call-hubby/01.png", "animations/call-hubby/02.png", "animations/call-hubby/03.png", "animations/call-hubby/04.png", "animations/call-hubby/05.png", "animations/call-hubby/06.png"], "durations": [220, 220, 180, 180, 180, 900], "loop": false, "holdLastFrame": true, "scale": 1 },
    "kowtow": { "frames": ["animations/kowtow/01.png", "animations/kowtow/02.png", "animations/kowtow/03.png", "animations/kowtow/04.png", "animations/kowtow/05.png", "animations/kowtow/06.png"], "durations": [180, 180, 220, 500, 220, 900], "loop": false, "holdLastFrame": true, "scale": 1 },
    "talent-show": { "frames": ["animations/talent-show/01.png", "animations/talent-show/02.png", "animations/talent-show/03.png", "animations/talent-show/04.png", "animations/talent-show/05.png", "animations/talent-show/06.png", "animations/talent-show/07.png", "animations/talent-show/08.png"], "durations": [140, 140, 140, 140, 140, 140, 140, 400], "loop": false, "holdLastFrame": true, "scale": 1 },
    "serve-tea": { "frames": ["animations/serve-tea/01.png", "animations/serve-tea/02.png", "animations/serve-tea/03.png", "animations/serve-tea/04.png", "animations/serve-tea/05.png", "animations/serve-tea/06.png"], "durations": [220, 260, 320, 420, 900, 360], "loop": false, "holdLastFrame": true, "scale": 1 },
    "love-you": { "frames": ["animations/love-you/01.png", "animations/love-you/02.png", "animations/love-you/03.png", "animations/love-you/04.png"], "durations": [200, 240, 400, 800], "loop": false, "holdLastFrame": true, "scale": 1 },
    "praise": { "frames": ["animations/praise/01.png", "animations/praise/02.png", "animations/praise/03.png", "animations/praise/04.png"], "durations": [200, 240, 400, 800], "loop": false, "holdLastFrame": true, "scale": 1 },
    "encourage": { "frames": ["animations/encourage/01.png", "animations/encourage/02.png", "animations/encourage/03.png", "animations/encourage/04.png"], "durations": [200, 240, 400, 800], "loop": false, "holdLastFrame": true, "scale": 1 }
  },
  "behavior": {
    "random": [
      { "state": "walk", "weight": 32, "minDuration": 1500, "maxDuration": 4200 },
      { "state": "serve-tea", "weight": 22, "minDuration": 3200, "maxDuration": 4800, "message": "老公喝茶", "speech": "老公喝茶", "speechAudio": "audio/serve-tea.mp3" },
      { "state": "love-you", "weight": 10, "minDuration": 2200, "maxDuration": 3400, "message": "爱你老公", "speech": "爱你老公", "speechAudio": "audio/love-you.mp3" },
      { "state": "praise", "weight": 10, "minDuration": 2200, "maxDuration": 3400, "message": "宝贝真棒", "speech": "宝贝真棒", "speechAudio": "audio/praise.mp3" },
      { "state": "encourage", "weight": 10, "minDuration": 2200, "maxDuration": 3400, "message": "老公辛苦了", "speech": "老公辛苦了", "speechAudio": "audio/encourage.mp3" },
      { "state": "sit", "weight": 10, "minDuration": 4200, "maxDuration": 6200 },
      { "state": "reaction", "weight": 6, "minDuration": 2200, "maxDuration": 3400 }
    ],
    "perched": [
      { "state": "perch-hair-flip", "weight": 40, "minDuration": 2800, "maxDuration": 4200 },
      { "state": "perch-blow-kiss", "weight": 40, "minDuration": 2800, "maxDuration": 4200 },
      { "state": "perch-look", "weight": 20, "minDuration": 2000, "maxDuration": 3600 }
    ]
  },
  "interactionActions": {
    "drag": { "action": "drag" },
    "climb": { "action": "climb", "anchor": { "x": 0.84, "y": 0.55 } },
    "perch": { "action": "perch", "anchor": { "x": 0.5, "y": 0.52 } },
    "hang": { "action": "hang", "anchor": { "x": 0.5, "y": 0.05 } },
    "fall": { "action": "fall" },
    "impact": { "action": "impact" },
    "recover": { "action": "pat-butt" }
  },
  "contextMenuActions": [
    {
      "id": "call-hubby",
      "label": "叫老公",
      "action": "call-hubby",
      "message": "老公!",
      "speech": "老公",
      "speechAudio": "audio/call-hubby.mp3",
      "duration": 3000
    },
    {
      "id": "kowtow",
      "label": "磕头",
      "action": "kowtow",
      "message": "给老公磕头了",
      "duration": 4000
    },
    {
      "id": "talent-show",
      "label": "上才艺",
      "action": "talent-show",
      "message": "上才艺!",
      "speech": "上才艺",
      "speechAudio": "audio/talent-show.mp3",
      "duration": 3200
    }
  ]
}
```

- [ ] **Step 4: 校验目录**

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/library/laopo
```

Expected: PASS

---

