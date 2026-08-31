# Windows 播放器商城同步 MVP 设计（Phase 2）

> 权威副本同步自 `desktop-pet-store`：  
> `docs/superpowers/specs/2026-08-09-windows-player-mvp-design.md`  
> 若两仓不一致，以 store 仓库该文件为准，并回写本文件。

日期：2026-08-09  
状态：已确认（待实现计划）  
范围仓库：`desktop-pet`（主）+ `desktop-pet-store`（demo pack / `/me` 入口）  
前置：Phase 1 petpack commerce + store API contract  
上层规格：store `2026-08-08-petpack-player-commerce-design.md`

## 1. 目标

让用户走通：

```text
网页登录 → 复制设备 Token → 播放器粘贴
  → 同步 library → 下载双清单 .petpack
  → 合并 1 base + N actions → 桌面播放
```

成功标准：

1. 本地商店 + 播放器可联调上述路径
2. 商城标品 demo 为可播双清单包（从现有播放器资源拆出）
3. `/me` 有客户端下载说明与 Token 入口
4. 无 entitlement 的 pack 不会被装入合成宠

## 2. 已确认决策

| 决策点 | 选择 |
| --- | --- |
| 鉴权 | 网页签发设备 Token，播放器粘贴保存（不做客户端短信） |
| 包格式 | 双清单：`petpack.json`（商城）+ `pet.json`/帧（播放） |
| 组装 | 客户端运行时合并 base + 已购兼容 actions |
| 仓库范围 | 播放器同步层 + 商城可播 demo + `/me` 客户端入口 |
| Demo 素材 | 复用 `desktop-pet` 现有宠物资源拆包 |
| UI 深度 | 同步层 + 托盘/简单对话框（非完整账号面板） |

## 3. 架构

```text
[desktop-pet-store]
  /me → 复制 Token / 下载客户端说明
  GET /api/client/library
  GET /api/client/packs/download?packId=

[desktop-pet Electron]
  settings: storeBaseUrl + clientToken
  store-sync → fetch library → cache packs → compose → libraryRoot
  existing player → 播放合成后的本地宠
```

实现风格：**同步层挂到现有播放器**，不重写渲染/漫游/置顶。

## 4. 鉴权与配置

### 4.1 播放器设置（`userData`）

| 字段 | 说明 |
| --- | --- |
| `storeBaseUrl` | 默认 `http://localhost:3000`；生产可改为站点域名 |
| `clientToken` | 64-char hex，来自 `POST /api/client/token` |

第一期 Token 明文存本地；过期/401 时提示回网页重新签发。

### 4.2 请求

- Header：`Authorization: Bearer <clientToken>`
- 契约见 store：`docs/superpowers/plans/2026-08-08-windows-player-api-contract.md`
- 不实现播放器内短信、cookie 会话

### 4.3 UI 入口（托盘 / 简单对话框）

- 连接商城（编辑 baseUrl + 粘贴 Token）
- 同步库（拉 library + 下载缺失/过期 pack + 合成）
- 切换已同步宠物（若多只）
- 保留现有「导入 .petpack」本地路径

## 5. 双清单 `.petpack`

### 5.1 布局

```text
petpack.json      # 商城/授权：packId, type, species, contentVersion, …
pet.json          # 播放器 schemaVersion 1（现有校验器）
preview.png
animations/…
```

### 5.2 规则

| type | `pet.json` 要求 | 说明 |
| --- | --- | --- |
| `base` | 至少含 `idle`（帧数满足现有校验） | 未购动作也能站住 |
| `action` | 仅含该动作动画条目 | 声明 `compatibleSpecies`；定制可加 `compatiblePetIds` |

- 商城上传/校验继续以 `petpack.json` 为准
- 播放器下载后：校验 `petpack.json` 与 entitlement 对齐；导入/合并时走现有 `pet.json` 校验
- `contentVersion` 升高则重新下载并重合成

### 5.3 Demo 拆包（商城）

从本仓库现有资源拆出猫/狗底宠 + 若干动作，对齐 store seed 的 `packId`，替换 store `make-demo-petpacks` 输出。

物种标签与真实形象不完全一致时，在 README 注明「演示用」。

## 6. 运行时合并

### 6.1 缓存

```text
userData/store-cache/
  <packId>/
    meta.json
    pack.petpack
```

### 6.2 合成

对每只 library 中的 `PetInstance`：

1. 取 `base` pack
2. 取 `actions[]` 中已下载且物种兼容的动作
3. 合并动画与 manifest → 写出到现有 `libraryRoot/<composedId>/`
4. `composedId`：稳定派生自 `petInstanceId`（不满足 pet id 正则则 slug 化）

默认：同步该宠全部已购兼容动作（无细粒度勾选 UI）。

### 6.3 失败与安全

- 401：提示重贴 Token
- 403 / 未授权：跳过并日志
- 无 base：该宠不可播放
- 本地手动导入路径不变

## 7. 商城配合

可播 demo、`/me` 客户端说明、README 联调；API 契约不改。

## 8. 非目标

播放器内短信/内购、macOS、DRM、完整账号面板、服务端合并 zip。

## 9. 建议任务切分

1. settings + store API client + 测试  
2. cache download + compose + 测试  
3. 托盘/对话框接入  
4. store：可播 demo pack  
5. store：`/me` + README  
6. 联调清单

## 10. 开放实现细节

- 狗 demo 形象映射  
- `petInstanceId` → pet id slug 规则  
- Release 托管方式  
