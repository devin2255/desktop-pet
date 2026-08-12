# Task 6 Report: 客户 EXE 构建与实机抽查

## Status
**DONE**（EXE 已构建并启动；GUI 手测项仍未验证）

## Commits
- `9b1c2bc` `fix: update brother-judge task/sit bubble copy`
- （本报告提交）`build: brother-judge photoreal customer delivery`

## Build
```text
node scripts/build-customer.js --pet pets/packages/brother-judge.petpack --name "兄弟判官桌面宠物" --delivery-id brother-judge
```
注：`npm run build:customer -- ...` 在本机 npm 会吞掉 `--pet` 等参数，需直接用 node。

## EXE
`D:\Vibe_Coding\desktop-pet\dist\customers\brother-judge\兄弟判官桌面宠物-1.0.0.exe`  
（`dist/` 与 `*.exe` 被 gitignore；交付报告在 `delivery/brother-judge/build-report.json` 与根目录 `build-report.json`）

## Verified
- 便携 EXE 构建成功；独立 userData `%APPDATA%/Desktop Pet Deliveries/brother-judge/`
- 双击启动后进程在跑，内置 pet 落地，`player-settings` 指向 brother-judge（漫游/跪爬开启）
- 帧数 idle4/walk6/sit4/sleep4/reaction4/kowtow6；idle 写实脸抽查通过
- 菜单配置：叫爸→「爸」；磕头→kowtow 无文案；睡会儿→sleep

## Unverified（需人手 GUI）
- 透明像素鼠标穿透；静止连点无放大/平移
- 右键实机点选气泡/动画；漫游朝向跪爬画面；托盘退出
- 数字签名（构建刻意 `signExecutable: false`）

## Report paths
- `delivery/brother-judge/build-report.json`
- `build-report.json`
- `dist/customers/brother-judge/build-report.json`（本机，未入库）
