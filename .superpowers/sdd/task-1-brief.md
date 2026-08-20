### Task 1: 身份卡 + 定妆主图（用户确认门禁）

**Files:**
- Create: `pets/work/brother-judge/IDENTITY.md`
- Create: `pets/work/brother-judge/source/refs/master-realistic.png`
- Create: `pets/work/brother-judge/source/realistic/generated-originals/master-realistic-*.png`（归档，不覆盖）

**Interfaces:**
- Consumes: `ref-face-closeup.png`, `ref-portrait.png`
- Produces: 已确认的 `master-realistic.png` + `IDENTITY.md` 文本（后续 Task 全部复用）

- [ ] **Step 1: 写 IDENTITY.md**

写入并保存：

```markdown
# 兄弟判官 IDENTITY

- 人物：年轻东亚男性，短黑发，浅胡茬，银色细圆框眼镜
- 脸：以 ref-face-closeup 为准；笑容/表情可参考 ref-portrait
- 帽：黑色判官官帽，两侧长弯帽翅，帽翅边缘白色珠饰
- 服：白色背心 + 深色宽松大裤衩 + 人字拖
- 道具：可选判官笔，不挡脸
- 风格：照片级写实，皮肤与布料纹理清晰，小尺寸仍可辨认是同一人
- 禁止：动漫大眼、工装衬衫、黑粗框方眼镜、文字、阴影底板、地面
```

- [ ] **Step 2: 生成定妆主图**

用图像生成工具，同时附上两张原片作参考。Prompt：

```text
Photorealistic full-body three-quarter standing desktop-pet master of the SAME young East Asian man from the reference face close-up.
Exact face match: short black hair, light stubble, thin silver round glasses, same eyes nose mouth.
Wear a traditional Chinese judge hat (black guanmao with long curved side wings edged in white beads) like the hat reference.
Outfit: white tank top, dark loose shorts, flip-flops. Optional judge brush in one hand, not covering face.
Solid flat #00FF00 background, generous padding, no text, no shadow floor, no border.
Photoreal skin and fabric detail, not anime, not cartoon.
```

保存生成原文到 `source/realistic/generated-originals/`，再复制工作文件到 `source/refs/master-realistic.png`。

- [ ] **Step 3: 人工门禁 — 停下来让用户确认主图**

向用户展示 `master-realistic.png`，明确询问是否认得出是本人、帽翅与服装是否正确。  
**未获用户确认前，禁止进入 Task 2。**

- [ ] **Step 4: 提交身份卡（主图若在 gitignore 的 work 目录则只提交 IDENTITY 若可跟踪；work 被 ignore 时本步可跳过 git）**

`pets/work/` 被 `.gitignore` 忽略。若无法提交主图，在进度说明中记录本地路径即可。可提交的文档若放到 `pets/library/brother-judge/DESIGN.md`，复制 IDENTITY 摘要过去：

```powershell
Copy-Item pets/work/brother-judge/IDENTITY.md pets/library/brother-judge/DESIGN.md -Force
git add pets/library/brother-judge/DESIGN.md
git commit -m "docs: lock brother-judge photoreal identity for redesign"
```

---
