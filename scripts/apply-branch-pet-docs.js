#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

const SHARED_PROMPT_TEMPLATE = `请根据我附上的照片，在本仓库制作完整桌面宠物，并交付可运行的客户安装包。

## 0. 先拉项目，未确认前禁止动手

1. 若当前工作区不是本仓库：git clone https://github.com/devin2255/desktop-pet.git 并进入仓库。
2. 若已在仓库：git fetch origin。
3. git checkout CHECKOUT_BRANCH
4. 阅读该分支 README.md 中「本分支桌宠」一节。那是能力模板，不是必须沿用的角色名或外形。
5. 用白话向用户复述：动作、气泡/台词、互动、托盘/右键、交付形态。
6. 对照清单逐项请用户确认：要 / 不要 / 改文案。确认用户上传的图片要做成哪些动作。
7. 确认操作系统：
   - Windows：本仓库当前可交付便携 EXE（node scripts/build-customer.js）。
   - macOS：本仓库没有 mac 构建，不能交付 .dmg 或 .app。若用户只要 macOS，停止并改方案。
   - 两个都要：先交 Windows；把 macOS 列为未交付。
8. 确认交付物：客户专属 Windows 便携 EXE + build-report.json；双击即出宠；不必装开发环境、不必手导 petpack；客户版默认隐藏导入、切换宠物、打开宠物库。
9. 以上全部得到用户明确答复之前，禁止生成动画、修改 pet.json、打包或构建 EXE。

## 1. 确认后再实现

遵循仓库根目录 AGENTS.md 与 desktop-pet-maker。不要在播放器里写死这只宠物的名字、性格或动画路径。身份、帧、文案、语音全部进入 .petpack / pet.json。

切帧前必须通过单元格安全门禁；失败就重生成，禁止只擦串帧碎片。互动帧连播 50 次不得缩放/平移。透明像素必须鼠标穿透。

## 2. 交付

验证 petpack 后执行：

python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/<id> pets/packages/<id>.petpack
node scripts/build-customer.js --pet pets/packages/<id>.petpack --name "<程序名称>" --delivery-id <id>

实际启动成品。交付 EXE、build-report.json 和验证结果。列出已验证项与未验证项（必须包括：未做代码签名；macOS 未交付）。不要只交付 .petpack。
`;

const onlyBranch = process.argv[2] || null;

const branches = [
  {
    path: '.worktrees/main',
    branch: 'main',
    pet: 'boss',
    section: `## 本分支桌宠

本分支主交付：**牛斯克**（\`boss\` / 老板桌面宠物）。播放器通用，外形与台词来自 petpack。

制作提示词：[docs/prompts/make-current-branch-pet.txt](docs/prompts/make-current-branch-pet.txt)

### 身份

- id / delivery-id：\`boss\`
- 显示名：牛斯克
- 性格：严肃、恭敬、粘人；默认跪姿待机，爬行移动

### 动作

标准：idle（跪姿）、walk（跪爬）、sit、sleep、reaction
窗口：drag、climb、perch、perch-cross-phone、perch-look、hang、fall、impact、pat-butt
其它：call-dad、kowtow、self-slap、serve-tea

### 气泡与台词

- 右键叫大爷：「大爷!」
- 右键磕头：「给您磕头了」
- 右键错了没?：「我真该死」
- 漫游端茶：「大爷喝茶!」
- 坐窗打电话：「喂, 军儿吗?」
- 左键点击：触发 reaction（播放器写死互动）

### 互动

拖动、漫游、窗口顶/侧/底互动、坠落恢复、透明穿透、小/中/大、置顶、开机启动。无跪爬模式开关、无画饼雷达。

### 托盘与右键

宠物项：叫大爷 / 磕头 / 错了没?
播放器项：叫宠物回来、切换/导入/打开宠物库（客户版隐藏）、大小、散步、置顶、开机、藏起来、退出。

### 交付

\`\`\`text
npm run build:boss
# 或
node scripts/build-customer.js --pet pets/packages/boss.petpack --name "老板桌面宠物" --delivery-id boss
\`\`\`

Windows 便携 EXE，未签名。macOS 未交付。

`,
  },
  {
    path: '.worktrees/feat-laopo-pet',
    branch: 'feat/laopo-pet',
    pet: 'laopo',
    section: `## 本分支桌宠

本分支主交付：**老婆**（\`laopo\` / 老婆桌面宠物）。

制作提示词：[docs/prompts/make-current-branch-pet.txt](docs/prompts/make-current-branch-pet.txt)

设计文档：[docs/superpowers/specs/2026-08-01-laopo-pet-design.md](docs/superpowers/specs/2026-08-01-laopo-pet-design.md)

### 身份

- id：\`laopo\`；性格：俏皮、粘人、甜蜜
- 启动问候：「老公，我来啦~」

### 动作

标准五动作 + drag、climb、perch、hang、fall、impact、pat-butt、perch-hair-flip、perch-blow-kiss、perch-look、call-hubby、kowtow、talent-show、serve-tea、love-you、praise、encourage

### 气泡与台词

- 叫老公「老公!」；磕头「给老公磕头了」；上才艺「上才艺!」
- 漫游：「老公喝茶」「爱你老公」「宝贝真棒」「老公辛苦了」

### 互动

拖动、漫游、窗口边、坠落恢复、女声 TTS/预录音、透明穿透、置顶、开机启动。

### 托盘与右键

叫老公 / 磕头 / 上才艺 + 播放器固定项。

### 交付

\`npm run build:laopo\`。Windows 便携 EXE，未签名。macOS 未交付。

`,
  },
  {
    path: '.worktrees/feat-medusa-pet',
    branch: 'feat/medusa-pet',
    pet: 'medusa',
    section: `## 本分支桌宠

本分支主交付：**美杜莎**（\`medusa\` / 美杜莎桌面宠物）。

制作提示词：[docs/prompts/make-current-branch-pet.txt](docs/prompts/make-current-branch-pet.txt)

设计文档：[docs/superpowers/specs/2026-08-02-medusa-pet-design.md](docs/superpowers/specs/2026-08-02-medusa-pet-design.md)

### 身份

- id：\`medusa\`；性格：高冷、傲娇、女王范
- 启动问候：「本女王来了。」

### 动作

标准五动作 + drag、lean、climb、perch、hang、fall、impact、pat-butt、perch-chin-rest、perch-hair-sweep、perch-look、cold-smile、heaven-python、kneel-before-me、talent-show、inspect、command、smirk-line

### 气泡与台词

- 冷笑「哼。」；吞天蟒「吞天。」；跪安「跪下。」；上才艺「给本座看好了。」
- 漫游：「看你表现」「侍奉本座」「有趣」

### 互动

侧边立刻 lean（不爬顶）、遇边掉头、尺寸含超大、窗口边、透明穿透。

### 托盘与右键

冷笑 / 七彩吞天蟒 / 跪安 / 上才艺 + 播放器固定项（含超大尺寸）。

### 交付

\`npm run build:medusa\`。Windows 便携 EXE，未签名。macOS 未交付。

`,
  },
  {
    path: '.',
    branch: 'feature/bestie-pets-design',
    pet: 'guimi',
    section: `## 本分支桌宠

本分支主交付：**闺蜜桌宠**（\`guimi\` / 闺蜜桌宠）。一体双人闺蜜，不是小美&小甜分支主宠。

制作提示词：[docs/prompts/make-current-branch-pet.txt](docs/prompts/make-current-branch-pet.txt)

设计文档：[docs/superpowers/specs/2026-08-27-guimi-fan-pet-design.md](docs/superpowers/specs/2026-08-27-guimi-fan-pet-design.md)

### 身份

- id：\`guimi\`；程序名：闺蜜桌宠
- 启动问候：「我们是闺蜜桌宠～今天也要一起玩。」

### 动作

标准五动作 + drag、cuddle、whisper、cheer、selfie、crawl、call-dad、kowtow、kowtow-crawl、perch、hang、feed-poop*、relax 分镜；侧爬关闭（climb.enabled: false）

### 气泡与台词

- 合影：「我站后面！」「不行，后面显脸小！」「那一起往后挤～」
- 投喂臭粑粑：「这是什么味儿…」「臭粑粑！？」等
- 去放松序列无 waitForClick

### 互动

跪爬模式、一体双人、投喂随机、去放松剧情、透明穿透、鼠标穿透采样。

### 托盘与右键

贴贴 / 合个影 / 说悄悄话 / 加油鸭 / 去放松 / 去睡觉 / 投喂 / 叫爸 / 下跪 + 跪爬模式 + 播放器固定项。

### 交付

\`npm run build:guimi\`。Windows 便携 EXE，未签名。macOS 未交付。

`,
  },
  {
    path: '.worktrees/feature-boss-watch',
    branch: 'feature/boss-watch',
    pet: 'brother-judge',
    section: `## 本分支桌宠

本分支主交付：**兄弟判官**（文言版 + 画饼雷达）。

制作提示词：[docs/prompts/make-current-branch-pet.txt](docs/prompts/make-current-branch-pet.txt)

设计文档：[docs/superpowers/specs/2026-08-10-boss-watch-design.md](docs/superpowers/specs/2026-08-10-boss-watch-design.md)

### 身份

- id：\`brother-judge\`；白背心大裤衩判官帽
- 启动：「本官到了，有冤的报冤，有饼的退下！」

### 动作

标准 + 窗口七动作 + crawl（无 kowtow 专帧时磕头用 reaction）

### 气泡与台词

- 升堂 / 退堂 / 歇息（文言）
- 画饼雷达：「老板画的饼别吃，你啃不动！」等文言词库

### 互动

飞书画饼雷达、跪爬、当个事儿办（飞书任务）、窗口边、透明穿透。

### 托盘与右键

升堂 / 退堂 / 歇息 + 当个事儿办 + 跪爬 + 画饼雷达 + 播放器固定项。

### 交付

\`\`\`text
node scripts/build-customer.js --pet pets/packages/brother-judge.petpack --name "兄弟判官桌面宠物" --delivery-id brother-judge
\`\`\`

Windows 便携 EXE，未签名。macOS 未交付。

`,
  },
  {
    path: '.worktrees/feature-brother-judge-bubble-copy',
    branch: 'feature/brother-judge-bubble-copy',
    pet: 'brother-judge',
    section: `## 本分支桌宠

本分支主交付：**兄弟判官**（白话写实版 + 画饼雷达）。

制作提示词：[docs/prompts/make-current-branch-pet.txt](docs/prompts/make-current-branch-pet.txt)

设计文档：[docs/superpowers/specs/2026-08-12-brother-judge-realistic-redesign.md](docs/superpowers/specs/2026-08-12-brother-judge-realistic-redesign.md)

### 身份

- id：\`brother-judge\`；写实风儿子模式判官
- 启动：「爸，我来了！」

### 动作

标准 + 窗口七动作 + crawl + kowtow + kowtow-crawl

### 气泡与台词

- 叫爸「爸」；磕头无气泡；睡会儿「睡会儿」
- 雷达白话：「这孙子在画饼，狗都不信！」等

### 互动

飞书雷达、跪爬、预录音、当个事儿办、窗口边。

### 托盘与右键

叫爸 / 磕头 / 睡会儿 + 当个事儿办 + 跪爬 + 画饼雷达 + 播放器固定项。

### 交付

\`\`\`text
node scripts/build-customer.js --pet pets/packages/brother-judge.petpack --name "兄弟判官桌面宠物" --delivery-id brother-judge
\`\`\`

Windows 便携 EXE，未签名。macOS 未交付。

`,
  },
  {
    path: '.worktrees/feature-dog-and-cat',
    branch: 'feature/dog-and-cat',
    pet: 'dog-and-cat',
    section: `## 本分支桌宠

本分支目标主交付：**旺财与咪咪**（\`dog-and-cat\` / 一体双人柴犬+橘猫）。**petpack 尚未生成时，下列能力为计划中 / 未交付。**

制作提示词：[docs/prompts/make-current-branch-pet.txt](docs/prompts/make-current-branch-pet.txt)

文档：[docs/blender-free-dog-and-cat.md](docs/blender-free-dog-and-cat.md)

### 身份（计划）

- id：\`dog-and-cat\`；显示名：旺财与咪咪
- 性格：安静陪伴、亲近、默契

### 动作（计划）

标准五动作 + 窗口七动作；Blender 双主体切帧

### 气泡与台词（计划）

- 过来一下「来了。」；趴一会儿「好，歇一下。」；去睡觉「那我们眯一会儿。」

### 互动（计划）

一体双人同框、窗口边、透明穿透。

### 托盘与右键（计划）

过来一下 / 趴一会儿 / 去睡觉 + 播放器固定项。

### 交付（计划）

\`\`\`text
node scripts/build-customer.js --pet pets/packages/dog-and-cat.petpack --name "桌面宠物" --delivery-id dog-and-cat
\`\`\`

当前开发播放器内置演示仍是牛斯克（\`boss\`），不是本分支目标宠。Windows 便携 EXE，未签名。macOS 未交付。

`,
  },
  {
    path: '.worktrees/son-pet-window-interactions',
    branch: 'son-pet-window-interactions',
    pet: 'xiaogou',
    section: `## 本分支桌宠

本分支主交付：**小狗**（\`xiaogou\` / 小狗桌面宠物）。本分支重点是窗口边互动状态机，宠物本身只有标准五动作。

制作提示词：[docs/prompts/make-current-branch-pet.txt](docs/prompts/make-current-branch-pet.txt)

设计文档：[docs/superpowers/specs/2026-07-29-window-edge-interactions-design.md](docs/superpowers/specs/2026-07-29-window-edge-interactions-design.md)

### 身份

- id：\`xiaogou\`；显示名：小狗；性格：胆小、粘人

### 动作

仅 idle、walk、sit、sleep、reaction。窗口互动缺专用帧时 fallback 到 walk/sit/reaction。

### 气泡与台词

无固定 pet.json 台词；左键触发 reaction。

### 互动

窗口发现、拖到顶/侧/底、屏顶坠落、置顶守卫、透明穿透。无自定义右键菜单项。

### 托盘与右键

仅播放器固定项：叫宠物回来、切换/导入/宠物库、大小、散步、置顶、开机、藏起来、退出。

### 交付

\`\`\`text
node scripts/build-customer.js --pet pets/packages/xiaogou.petpack --name "小狗桌面宠物" --delivery-id xiaogou
\`\`\`

Windows 便携 EXE，未签名。macOS 未交付。

`,
  },
];

function insertPetSection(readmePath, section) {
  const text = fs.readFileSync(readmePath, 'utf8');
  if (text.includes('## 本分支桌宠')) {
    return false;
  }
  const patterns = [
    /(当前版本：\*\*[^*]+\*\*。\r?\n\r?\n)/,
    /(全部来自可移植的 `\.petpack` 包。\r?\n\r?\n)/,
  ];
  let updated = null;
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      updated = text.replace(pattern, `$1${section}\n`);
      break;
    }
  }
  if (!updated) {
    throw new Error(`Cannot find version anchor in ${readmePath}`);
  }
  fs.writeFileSync(readmePath, updated, 'utf8');
  return true;
}

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit', encoding: 'utf8' });
}

const results = [];

const targetBranches = onlyBranch
  ? branches.filter((info) => info.branch === onlyBranch || info.pet === onlyBranch)
  : branches;

if (onlyBranch && targetBranches.length === 0) {
  console.error(`Unknown branch filter: ${onlyBranch}`);
  process.exit(1);
}

for (const info of targetBranches) {
  const dir = path.resolve(root, info.path);
  const readmePath = path.join(dir, 'README.md');
  const promptDir = path.join(dir, 'docs', 'prompts');
  const promptPath = path.join(promptDir, 'make-current-branch-pet.txt');

  fs.mkdirSync(promptDir, { recursive: true });
  insertPetSection(readmePath, info.section);
  const prompt = SHARED_PROMPT_TEMPLATE.replace(/CHECKOUT_BRANCH/g, info.branch);
  fs.writeFileSync(promptPath, prompt, 'utf8');

  run('git add README.md docs/prompts/make-current-branch-pet.txt', dir);
  run(
    `git commit -m "docs: document ${info.pet} capabilities and confirm-first prompt on ${info.branch}"`,
    dir
  );
  const sha = execSync('git rev-parse --short HEAD', { cwd: dir, encoding: 'utf8' }).trim();
  results.push(`${info.branch} -> ${sha}`);
}

for (const line of results) {
  console.log(line);
}
