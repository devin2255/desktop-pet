# Changelog

All notable changes to this project are documented here.

## 0.4.0 - 2026-07-28

- Upgrade the runtime from Electron 31 to Electron 43.
- Enable renderer process sandboxing and restrict navigation, new windows, and IPC senders.
- Add a shared JavaScript `.petpack` validator with archive, path, manifest, and PNG limits.
- Harden the Python validator before extraction and reject extra or conflicting files.
- Add malicious-package regression tests, CI, Dependabot, and draft release automation.
- Separate public source files from private photos, customer workspaces, and build artifacts.
