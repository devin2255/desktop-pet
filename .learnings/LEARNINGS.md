# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20260818-001] correction

**Logged**: 2026-08-18T13:47:00+08:00
**Priority**: high
**Status**: pending
**Area**: docs

### Summary
《牛来》桌宠人设：没长角的是牛来，带灰角的是妈妈；不能两边都画角。

### Details
先前用夜景群像剧照时，把短角小黄牛当成牛来、大角棕牛当成妈妈。用户用正片屏摄纠正：牛来头顶无角，只有侧向尖耳、橙黄身体、浅米色吻部和较大的深色虹膜眼睛；妈妈才有一对向上的灰褐短角，金黄身体。字幕「妈妈」是牛来在喊妈，不是角色标签。用户要求尽量百分百还原原片，不要干净低多边形游戏风。

### Suggested Action
生成帧时以用户屏摄为头脸真源：牛来全程无角，妈妈全程有角且更高；不要再用「小牛也有短角」的假设。

### Metadata
- Source: user_feedback
- Related Files: pets/library/niulai/
- Tags: niulai, identity, horns, film-match

---

## [LRN-20260818-002] correction

**Logged**: 2026-08-18T13:58:00+08:00
**Priority**: high
**Status**: pending
**Area**: docs

### Summary
牛来闭嘴是厚实浅粉灰唇的水平褶，不是细嘴缝；妈妈体态要粗壮梨形，不能画瘦。

### Details
用户用日落三人全身剧照纠正：闭嘴时上唇厚、肉感、浅粉灰色，贴在鼓出的吻部上，是一条浅浅横褶，不是光滑球鼻上的细线。牛来和妈妈都是短肢、圆肚、粗壮身材；妈妈尤其宽、圆柱/梨形，明显比牛来高且壮。毛皮是粗糙短绒/毡状，颗粒感，不要光滑游戏材质。牛来无角偏橙，妈妈有灰角偏黄。

### Suggested Action
以用户这张日落全身照为闭嘴和体态真源；master 必须先过闭嘴+梨形体态+粗糙质感，再画动作条。

### Metadata
- Source: user_feedback
- Related Files: pets/library/niulai/
- Tags: niulai, mouth, body, texture, film-match

---

## [LRN-20260818-003] correction

**Logged**: 2026-08-18T14:08:00+08:00
**Priority**: high
**Status**: pending
**Area**: docs

### Summary
质感以用户林间近景为准：橙皮/砂纸噪点凹凸，不是绒毛；妈妈体态中等粗壮，不要大肚。

### Details
用户指定一张带角妈妈近景为真实材质：高频率 bump 噪点、哑光芥末黄、浅粉吻部、灰石质短角。前几版做成了毡绒玩偶或过胖梨形。闭嘴仍是浅色吻部上的细横褶。

### Suggested Action
所有帧复制这张的皮肤着色；妈妈对照该近景+日落全身，收腰腹。

### Metadata
- Source: user_feedback
- Related Files: pets/work/niulai/ref/user-texture-mom.png
- Tags: niulai, texture, bump-noise, film-match

---

## [LRN-20260819-001] correction

**Logged**: 2026-08-19T10:15:00+08:00
**Priority**: high
**Status**: pending
**Area**: docs

### Summary
走路条不能只写「six walk frames, alternating legs」。模型会六帧都画成同一只脚在前。必须先做出两张相反的 contact 关键帧，再补 passing。

### Details
`call-mom-walk` 第一版 6 帧全是远侧蹄在前，近侧蹄在后，循环看起来像单腿拖步。一次出整条、或平行出 6 帧，都很容易塌成同一步态。有效做法：1) 先出一张宽步 contact；2) 明确要求「把前后蹄对调」得到相反 contact；3) 再出 passing（两蹄收到腹下）；4) 人工排成 远接触 → 远步 → passing → 近接触 → 近抬脚 → passing。用 near/far（靠镜头/远离镜头）描述蹄，不要用角色自身 left/right。

### Suggested Action
重画 walk 时先锁定一对相反 contact，再填中间帧；拼条前用接触片确认第 1 帧和第 4 帧前蹄不是同一只。

### Metadata
- Source: user_feedback
- Related Files: pets/library/niulai/animations/call-mom-walk/
- Tags: niulai, walk-cycle, gait, imagegen

---

## [LRN-20260819-002] correction

**Logged**: 2026-08-19T10:50:00+08:00
**Priority**: high
**Status**: pending
**Area**: src

### Summary
来电序列走路不能用 `BrowserWindow.setPosition`；挂断切回 idle 时必须在序列结束后再 sendState，否则窗口尺寸不会还原，牛来会看起来变大。

### Details
互动拖拽已经用 `setBounds` 锁死 `currentSize()`。boss-call 走路每 50ms `setPosition`，在 Windows DPI 下窗口宽高会漂。同时 `sendState` 在 `sequence.isActive()` 时跳过 `restorePetWindowSize`，而最后一阶段 idle 是在 active 期间发出的，finishSequence 以前不补发 idle。结果：挂断后牛来按漂大的窗口 `object-fit: contain` 显示，体型变大。修复：走路改 `setBounds` 带固定宽高；finishSequence 在 `active=false` 后再 `sendState('idle')`。

### Suggested Action
序列移动窗口一律 `setBounds({x,y,width,height})`，不要 `setPosition`。结束序列后补一次非 active 的 idle，让尺寸还原。

### Metadata
- Source: user_feedback
- Related Files: src/main-v3.js, src/sequence-controller.js
- Tags: niulai, window-size, sequence, dpi

---

