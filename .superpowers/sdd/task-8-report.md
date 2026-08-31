# Task 8 Report — 交叉验收

## 资源隔离

| 检查项 | 结果 |
|--------|------|
| `feature/son-mode` 无 `niulai` petpack / library | PASS |
| `feature/son-mode` 含 `brother-judge` 预装 | PASS（预期） |
| `feature/niulai` 无 `brother-judge` 任何路径 | PASS |
| `feature/niulai` 含 `niulai.petpack` | PASS |

## 测试

| Worktree | `npm run test:js` |
|----------|-------------------|
| 主 checkout `feature/bestie-pets-design` | PASS |
| `.worktrees/son-mode` | PASS（含 capability-gates、market-watch、IM 全套） |
| `.worktrees/niulai` | PASS |

## 文档抽查

- 各分支 README 含「本分支桌宠」与 `make-current-branch-pet.txt` 链接
- 提示词含 `git clone`、对应分支名、`macOS` 未交付、确认前禁止生成动画

## 遗留 / 未做

- **未 push** 任何分支（按用户要求）
- `scripts/apply-branch-pet-docs.js` 在主仓库工作区，未单独 commit（工具脚本）
- GUI 手测、EXE 实启、代码签名：不在本 Task 范围

## 待推送分支汇总（供用户决定）

**代码分支（Task 1–4）：**

- `feature/son-mode` @ `1017f76`
- `feature/niulai` @ `d9573fb`

**文档分支（Task 5–7）：**

- `main` @ `38e52a1`
- `feat/laopo-pet` @ `e881df2`
- `feat/medusa-pet` @ `5efcf5e`
- `feature/bestie-pets-design` @ `e8ae423`
- `feature/boss-watch` @ `b0a3eaa`
- `feature/brother-judge-bubble-copy` @ `9d67d1d`
- `feature/dog-and-cat` @ `cf6351f`
- `son-pet-window-interactions` @ `b776fe2`
