# Desktop Pet 仓库重建设计

## 目标

把当前基于 `redniu123/pet-player` 修改而来的工作目录重新建立为名为 **Desktop Pet**、由 **devin2255** 维护的独立开源 Git 仓库。新仓库不保留旧 Git 提交历史，但保留上游代码和示例素材许可证要求的版权与署名。

## 变更范围

1. 重写根目录 `README.md`，使用项目名 Desktop Pet，介绍当前 0.4.0 通用播放器架构、主要功能、开发与构建方式、`.petpack` 格式、测试、安全边界和贡献入口。
2. README 明确说明项目基于 `redniu123/pet-player` 二次开发，并分别说明源代码 MIT License 与示例素材 CC BY 4.0 的授权关系。
3. 更新 `package.json`：项目包名调整为 `desktop-pet`，产品显示名调整为 `Desktop Pet`，作者调整为 `devin2255`；不改变应用入口、版本、脚本、依赖和功能配置。
4. 更新 `LICENSE`：保留 `Copyright (c) 2026 redniu123`，增加 `Copyright (c) 2026 devin2255`，继续采用 MIT License。
5. 保留 `ASSETS_LICENSE.md` 中 redniu123 对示例宠物包、图标和托盘图片的 CC BY 4.0 署名，不把这些素材宣称为 devin2255 原创。
6. 删除且仅删除工作区根目录 `D:\vibe_coding\desktop-pet\.git`，随后以 `main` 为初始分支重新初始化 Git。
7. 不自动添加远端。用户创建或确定新的 GitHub 仓库后，可另行运行 `git remote add origin https://github.com/账号/仓库名.git`。
8. 在新仓库中提交当前受 `.gitignore` 约束后的项目文件，形成一个全新的初始提交。

## 安全与合规

- 删除前解析并核对 `.git` 的绝对路径，确保目标严格等于当前工作区根目录下的 `.git`。
- 不删除项目源码、资源包、用户本地素材或其他目录。
- MIT 许可证要求原版权声明随软件保留；因此不能移除 redniu123 的版权行。
- 示例素材使用 CC BY 4.0，必须继续保留 `ASSETS_LICENSE.md` 和 README 中的署名说明。
- `.gitignore` 继续排除客户照片、客户宠物包、生成工作区、构建产物和本地运行数据。

## 验证标准

- `README.md` 标题为 Desktop Pet，不再把 redniu123 标记为当前维护者。
- `package.json` 可被 Node.js 正常解析，作者为 devin2255，应用入口及脚本保持有效。
- JavaScript 入口语法检查、渲染器互动测试、Python 动画处理测试和示例 `.petpack` 验证通过。
- `.git` 已被重新创建，当前分支为 `main`，不存在旧远端和旧提交历史。
- 新仓库只有一个初始提交，工作区最终保持干净。
