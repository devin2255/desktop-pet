# Task 6 Report — petpack 工具链兼容 watch 字段

## 现状调研（实现前阅读代码的发现）

### src/petpack-validator.js
- `validateManifest`（第 71 行起）对顶层字段采用 **allow-any** 策略：只对已知字段逐个做类型/结构校验，不枚举"允许的顶层字段集合"，也不拒绝未知字段。因此 `watch` 字段在改动前既不被校验也不被拒绝（缺省即放行）。
- `referencedFiles`（第 46 行起）收集 pet.json、preview、animations.frames、contextMenuActions 中的 speechAudio、behavior.random/perched 的 speechAudio。`watch` 不含资源路径，无需进入 `referencedFiles`。
- 可选顶层字段（`description`/`personality`/`speechGender`/`startupGreeting`）的模式是 `if (manifest.xxx !== undefined) { 校验 }`。我沿用了这一模式给 `watch`。

### skills/desktop-pet-maker/scripts/create_pet_manifest.py
- 可选参数（`--personality`、`--description`、`--package-version`）通过 `parser.add_argument(...)` 注册，随后在 `manifest.update({...})` 中写入 manifest dict。
- 我照此模式新增 `--watch`（type=Path，default=None），并在 `manifest.update` 之后用 `if args.watch is not None:` 读 JSON 文件、断言为 dict、赋值给 `manifest["watch"]`。

### scripts/test-petpack-security.js
- 测试风格：直接 `require('../src/petpack-validator')` 拿 `validateManifest`/`referencedFiles`/`validatePetpack`，对从 laopo.petpack 读出的 manifest 做修改后用 `assert.doesNotThrow`/`assert.throws(regex)` 断言。
- 我在该文件末尾、最终 console.log 之前追加了 watch 用例。

### 并行的 python 校验器（petpack_tool.py）
- 另一份独立实现 `validate_manifest_shape`，同样是 allow-any（不拒绝未知顶层字段），但 **未** 被本任务列为改动对象。它已能"容忍" watch（不报错），但不做结构校验。`validate:demo` 校验 laopo.petpack（无 watch 字段），不受影响。本任务按 brief 只动 JS 校验器。

## 改动内容（带行号）

### 1. src/petpack-validator.js — 新增 watch 校验（约第 95-120 行）
在 `startupGreeting` 校验之后、`safeRelative(manifest.preview)` 之前插入：
```js
if (manifest.watch !== undefined) {
  const watch = manifest.watch;
  if (!watch || typeof watch !== 'object' || Array.isArray(watch)) {
    throw new Error('watch 必须是对象');
  }
  if (watch.keywords !== undefined) {
    if (!watch.keywords || typeof watch.keywords !== 'object' || Array.isArray(watch.keywords)) {
      throw new Error('watch.keywords 必须是对象');
    }
    for (const [key, lines] of Object.entries(watch.keywords)) {
      if (typeof key !== 'string' || !key) {
        throw new Error('watch.keywords 的键必须是非空字符串');
      }
      if (!Array.isArray(lines) || lines.length === 0
        || lines.some((line) => typeof line !== 'string' || !line)) {
        throw new Error(`watch.keywords.${key} 必须是非空字符串数组`);
      }
    }
  }
  if (watch.fallback !== undefined && typeof watch.fallback !== 'string') {
    throw new Error('watch.fallback 必须是字符串');
  }
  if (watch.state !== undefined && typeof watch.state !== 'string') {
    throw new Error('watch.state 必须是字符串');
  }
}
```
- `referencedFiles` 未改动：watch 不含资源路径，不会进入资源引用检查。

### 2. skills/desktop-pet-maker/scripts/create_pet_manifest.py
- argparse 新增 `--watch`（type=Path, default=None）。
- `manifest.update({...})` 之后新增：
```python
if args.watch is not None:
    watch_data = json.loads(args.watch.read_text(encoding="utf-8"))
    if not isinstance(watch_data, dict):
        raise SystemExit(f"--watch must contain a JSON object, got {type(watch_data).__name__}")
    manifest["watch"] = watch_data
```

### 3. scripts/test-petpack-security.js — 追加 watch 用例
- 合法 watch（含 keywords/fallback/state）通过 `validateManifest`。
- `referencedFiles(manifest)` 不包含 `'watch'`/`'manifest.watch'`（确认 watch 非资源引用字段）。
- `watch.keywords` 值为字符串（非数组）→ 拒绝（`/watch\.keywords\..*必须是非空字符串数组/`）。
- 额外边界用例：keywords 空数组、watch 非对象、fallback 非字符串、state 非字符串均被拒绝。
- 向后兼容：删除 watch 后 `validateManifest` 仍通过。

## 测试结果

### node scripts/test-petpack-security.js
```
petpack archive security checks passed
```

### npm run test:js（完整 JS 链）
全绿，末尾输出（节选）：
```
petpack archive security checks passed
...
watch-rules: all tests passed
watch-config: all tests passed
edge-voice: all tests passed
message-watcher: all tests passed
```

### create_pet_manifest.py --watch 手动验证
- `--help` 正确显示 `--watch WATCH` 参数。
- 用 `pets/library/dog-and-cat` 的 preview/animations 做干跑（sample watch JSON），生成的 `pet.json` 中 `watch` 字段完整写入：`{"keywords": {"画饼": [...], "吹牛": [...]}, "fallback": "...", "state": "reaction"}`。

### npm run test:python
失败，但是 **预存环境问题**：`ModuleNotFoundError: No module named 'PIL'`（Pillow 未安装）。本任务未改动 `petpack_tool.py` / `test_petpack_tool.py` / `test_process_animation_strips.py`，失败与 watch 改动无关。`create_pet_manifest.py` 不依赖 PIL，`--help` 与干跑均正常。

### npm run validate:demo
同样因 PIL 缺失无法运行（`petpack_tool.py` 顶部 `from PIL import Image`）。laopo.petpack 无 watch 字段，逻辑上不受本改动影响；在已安装 Pillow 的环境应正常。

## 自查
- 向后兼容：无 `watch` 字段的 manifest 仍通过校验（测试已显式覆盖：`delete manifest.watch` 后 `doesNotThrow`）。laopo.petpack 无 watch，test:js 中 `test-laopo-petpack.js` 通过。
- 非法 watch 被拒绝：keywords 值非数组/空数组、watch 非对象、fallback/state 非字符串均抛错。
- watch 不进入资源引用检查：`referencedFiles` 未改，测试显式断言 `!referencedFiles(manifest).has('watch')`。
- 未把 watch 写成 referenced-file 字段，未引入新的资源路径检查。

## 提交
- `9263d1e` feat: allow watch field in petpack manifests
  - src/petpack-validator.js
  - skills/desktop-pet-maker/scripts/create_pet_manifest.py
  - scripts/test-petpack-security.js

## 遗留/注意
- python 侧 `petpack_tool.py` 的 `validate_manifest_shape` 仍是 allow-any（容忍 watch 但不结构校验）。本任务 brief 只点名 JS 校验器，故未改 python 校验器。若后续需要 python 侧也结构校验 watch，可另行追加。
- 环境缺 Pillow 导致 `test:python`/`validate:demo` 无法在当前机器运行，属预存问题，非本任务引入。
