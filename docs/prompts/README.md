# 牛来桌宠制作提示词

本分支（`feature/niulai`）主交付宠物是 **牛来**（`niulai`）。通用播放器仍可导入外部 `.petpack`，但本分支不再预装兄弟判官。

## 怎么用

1. 新会话里的模型先把 `feature/niulai` 拉到本地，再开始制作。
2. 准备同一主体的 1～8 张清晰原图（宠物或人物均可，不要混入其他人/动物）。
3. 打开 [`make-current-branch-pet.txt`](make-current-branch-pet.txt)，按其中「先确认、后动手」流程与用户逐项核对能力与操作系统后再生成动画。
4. 把确认后的全文复制到**新会话**，先附照片再发送。
5. 仓库必须是带当前播放器能力的 `feature/niulai` 分支，不要让代理去重写播放器。
6. 提示词会要求确认 Windows 交付与 macOS 未交付；未得到用户明确答复前禁止生成动画或打包。

## 入口文件

| 文件 | 用途 |
|------|------|
| [`make-current-branch-pet.txt`](make-current-branch-pet.txt) | **本分支制作入口**（Shared Prompt，`git checkout feature/niulai`） |
| [`make-niulai-pet.txt`](make-niulai-pet.txt) | 历史参考（牛来专用旧版，含详细动作清单） |
| [`make-laopo-pet.txt`](make-laopo-pet.txt) | 历史参考（老婆桌宠） |
| [`make-boss-pet.txt`](make-boss-pet.txt) | 历史参考（老板桌宠） |

新制作一律用 `make-current-branch-pet.txt`。能力模板见根目录 [`README.md`](../README.md)「本分支桌宠」一节。
