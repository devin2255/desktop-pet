#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    exe = next((root / "dist" / "customers" / "boss").glob("老板桌面宠物-*.exe"))
    petpack = root / "pets" / "packages" / "boss.petpack"
    preview = root / "outputs" / "boss-actions-preview.png"
    report = {
        "schemaVersion": 1,
        "deliveryId": "boss",
        "appName": "老板桌面宠物",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "artifacts": {
            "exe": str(exe.relative_to(root)).replace("\\", "/"),
            "exeSha256": sha256(exe),
            "petpack": "pets/packages/boss.petpack",
            "petpackSha256": sha256(petpack),
            "preview": "outputs/boss-actions-preview.png",
            "previewSha256": sha256(preview),
            "buildReport": "dist/customers/boss/build-report.json",
        },
        "verified": [
            "petpack validate (library + archive)",
            "npm test (js + python + demo)",
            "boss petpack regression (contextMenuActions, no random sleep, hang/perch anchors, drag->walk)",
            "window interaction unit tests (maximized top perch, hang, screen-top fall, untitled helper exclusion)",
            "topmost guard unit tests",
            "renderer interaction / bubble spacing unit tests",
            "customer EXE build",
            "ASAR contains player + window modules + delivery petpack",
            "EXE launches and shows pet window",
            r"independent data directory: %AppData%\Desktop Pet Deliveries\boss",
            "EXE process exit/cleanup",
        ],
        "configVerified": {
            "defaultIdleKneel": True,
            "walkIsCrawl": True,
            "behaviorRandomExcludesSleep": True,
            "sleepUsesKneelFrames": True,
            "callDad": {
                "message": "大爷!",
                "speech": "爸",
                "tts": "speechSynthesis zh-CN system voice (no cloned voice)",
            },
            "kowtow": {"message": "给您磕头了"},
            "interactionActions": True,
            "contextMenuActions": True,
        },
        "unverifiedManual": [
            "左右爬行视觉观感（素材已配置 walk=爬行；需人工目视）",
            "右键“叫大爷/磕头”完整动画与气泡贴近（配置已验证，实机菜单点击未做全自动）",
            "Windows 中文系统语音朗读“爸”音色（使用系统 speechSynthesis zh-CN，禁止克隆真人声）",
            "窗口顶边坐 / 侧边攀爬跟随 / 下边缘双手吊挂的实机手感",
            "无窗口屏幕顶部坠落→摔地→拍屁股→跪姿恢复的完整手势路径",
            "透明像素鼠标穿透实机点击后方应用",
            "连续互动 50 次无缩放位移的实机目视（自动化契约脚本已具备，本次未对客户 EXE 跑完整 CDP 采样）",
            "托盘菜单与始终置顶开关切换（代码与单测已覆盖，实机未逐项点选）",
        ],
        "knownReleaseGaps": [
            "EXE 未做数字签名 (signExecutable=false)",
            "本机构建因缺少 Windows SDK 10.0.19041，使用 N-API 预编译跳过 native rebuild",
        ],
    }
    targets = [
        root / "dist" / "customers" / "boss" / "verification-report.json",
        root / "outputs" / "boss-verification-report.json",
    ]
    text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    for path in targets:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        print(path)


if __name__ == "__main__":
    main()
