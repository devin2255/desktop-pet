### Task 5: 兄弟 Duo 资源（动作条 + clips + pet.json）

**Files:**
- Create: `pets/library/brother-duo/animations/slack-jump/01.png`…、`slack-carry/01.png`…
- Create: `pets/library/brother-duo/video/slack/01.webm` 等至少 3 个
- Modify: `pets/work/brother-duo/_write_pet_json.js`
- Test: `scripts/test-brother-duo-petpack.js`

**Interfaces:**
- Consumes: Task 2 validator
- Produces: 可打包的 `duo.slack`

- [ ] **Step 1:** petpack 测试先断言 `duo.slack.jumpAction==='slack-jump'`、`carryAction==='slack-carry'`、`clips.length>=3`、合上菜单 `摸会儿鱼` id `duo-slack`。跑测试失败。

- [ ] **Step 2: 画条**

身份锁定：左红背心圆框眼镜深蓝短裤人字拖；右东北大花短袖军绿短裤人字拖。480×480 透明底，脚底对齐。禁止苹果标、禁止把 K 线/视频画面画进 PNG。

- `slack-jump` ≥4 帧，不循环：两人从「在框里」跳到「在框外两侧、手就位」
- `slack-carry` ≥4 帧，循环：扛机吃力、肩压低、可轻微晃

切帧走现有 `process_animation_strips` 安全门；失败重画，禁止只擦碎片。

- [ ] **Step 3: clips**

用 ffmpeg 做 **静音** 3～6 段 ≤4s 的 `webm`（vp8/vp9），内容为自制「竖屏信息流」抽象画面（色块卡片上滑），**不要**抖音水印、Logo、未授权成片。例如：

```powershell
ffmpeg -y -f lavfi -i "color=c=0x111111:s=360x640:d=3" -an -c:v libvpx -b:v 400k pets/library/brother-duo/video/slack/01.webm
```

再叠加文字/色条做出三条观感不同的循环（也可用几张 PNG `zoompan`）。放入 `video/slack/01.webm`…。

- [ ] **Step 4:** `_write_pet_json.js` 根级增加 jump/carry 动画；`duo.slack` 写入 labels、动作名、clips；`contextMenuActions` 增加 `{ id:'duo-slack', label:'摸会儿鱼' }`（id 须过 `SEQUENCE_ID_PATTERN`：现有 `duo-tent` 已证明 `duo-slack` 合法）。

```js
node pets/work/brother-duo/_write_pet_json.js
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/brother-duo pets/packages/brother-duo.petpack
node scripts/test-brother-duo-petpack.js
```

期望：`ok`。跳过 commit。

---
