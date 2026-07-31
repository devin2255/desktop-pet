# Desktop Pet Repository Reinitialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Rebrand the working tree as Desktop Pet, preserve mandatory upstream attribution, remove the inherited Git history, and create a clean \`main\` repository owned by devin2255.

**Architecture:** Documentation and package metadata are updated without changing runtime source code, dependencies, scripts, or the \`.petpack\` format. The old \`.git\` directory is deleted only after validation, then the current ignored-safe tree is committed as a single new root commit.

**Tech Stack:** Markdown, JSON, Node.js/npm, Python, Git, PowerShell, Electron

---

## File map

- Modify \`README.md\`: public project overview, setup, usage, build, testing, security, license, and upstream attribution.
- Modify \`package.json\`: npm package name, description, author, Electron product name, and portable artifact name.
- Modify \`package-lock.json\`: synchronize root package name and metadata generated from \`package.json\`.
- Modify \`LICENSE\`: retain upstream MIT copyright and add devin2255 copyright.
- Preserve \`ASSETS_LICENSE.md\`: retain the CC BY 4.0 attribution for the bundled sample assets.
- Create \`docs/superpowers/plans/2026-07-31-reinitialize-repository.md\`: this execution plan.
- Replace \`.git\`: discard old history/remotes and create a new \`main\` repository.

### Task 1: Rewrite project documentation

**Files:**
- Modify: \`README.md\`
- Verify: \`ASSETS_LICENSE.md\`

- [ ] **Step 1: Replace the README title and project positioning**

Write a UTF-8 Chinese README beginning with \`# Desktop Pet\`, identify \`devin2255\` as the current maintainer, and describe the application as a generic Windows transparent desktop-pet player driven by \`.petpack\` resources.

- [ ] **Step 2: Document supported workflows**

Include exact commands for setup, startup, tests, generic portable build, customer build, and \`.petpack\` validation:

\`\`\`powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\setup.ps1
npm start
npm test
npm run build
npm run build:customer -- --pet pets/packages/xiaogou.petpack --name "小狗桌面宠物" --delivery-id xiaogou
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/xiaogou.petpack
\`\`\`

- [ ] **Step 3: Document security and licensing**

State that external \`.petpack\` files are untrusted input, private customer photos must not be committed, source code remains MIT licensed, sample assets remain CC BY 4.0, and this project is based on \`redniu123/pet-player\`.

- [ ] **Step 4: Verify README content**

Run \`Get-Content -Raw -Encoding UTF8 README.md\` and search for the required markers \`# Desktop Pet\`, \`devin2255\`, \`redniu123/pet-player\`, \`MIT\`, and \`CC BY 4.0\`. Expected: every marker is present and Chinese text renders correctly.

### Task 2: Synchronize package metadata

**Files:**
- Modify: \`package.json\`
- Modify: \`package-lock.json\`

- [ ] **Step 1: Update package metadata using Node.js**

Set \`name\` to \`desktop-pet\`, \`description\` to \`通用 Windows 桌面宠物播放器，支持安全导入 .petpack 和生成客户专属便携版。\`, \`author\` to \`devin2255\`, \`build.productName\` to \`Desktop Pet\`, and \`build.portable.artifactName\` to \`Desktop-Pet-\${version}.\${ext}\`. Retain version \`0.4.0\`, entry point, scripts, dependencies, and build file lists.

- [ ] **Step 2: Regenerate lockfile metadata without changing dependencies**

Run \`npm install --package-lock-only --ignore-scripts\`. Expected: \`package-lock.json\` root metadata uses \`desktop-pet\`; dependency resolution remains unchanged.

- [ ] **Step 3: Parse and assert metadata**

Use Node.js to assert the package name, author, product name, artifact name, and lockfile root name. Expected output: \`metadata ok\`.

### Task 3: Update MIT copyright without removing attribution

**Files:**
- Modify: \`LICENSE\`
- Verify: \`ASSETS_LICENSE.md\`

- [ ] **Step 1: Add the maintainer copyright**

Keep the existing line and add the new line directly beneath it:

\`\`\`text
Copyright (c) 2026 redniu123
Copyright (c) 2026 devin2255
\`\`\`

Do not modify the remaining MIT License text.

- [ ] **Step 2: Verify code and asset attribution**

Search \`LICENSE\` for both copyright holders and \`ASSETS_LICENSE.md\` for \`CC BY 4.0\` and \`redniu123\`. Expected: every marker is found.

### Task 4: Validate the unchanged application

**Files:**
- Test: \`src/main-v3.js\`
- Test: \`src/preload-v3.js\`
- Test: \`src/renderer-v3.js\`
- Test: \`scripts/test-renderer-interaction.js\`
- Test: \`skills/desktop-pet-maker/scripts/test_process_animation_strips.py\`
- Test: \`pets/packages/xiaogou.petpack\`

- [ ] **Step 1: Run the complete automated suite**

Run \`npm test\`. Expected: JavaScript syntax checks, security tests, interaction tests, Python tests, and demo package validation all pass.

- [ ] **Step 2: Run the required focused regression checks**

Run \`node scripts/test-renderer-interaction.js\` and \`python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v\`. Expected: both commands exit with status 0.

- [ ] **Step 3: Smoke-start the development application**

Start Electron hidden with \`Start-Process -WindowStyle Hidden -PassThru\`, wait long enough to ensure it does not exit immediately, then stop only the process started by this check. Expected: the process remains alive during the smoke window and is cleanly terminated by the test harness.

### Task 5: Reinitialize Git safely

**Files:**
- Delete: \`.git/\`
- Create: \`.git/\`

- [ ] **Step 1: Verify the destructive target**

Resolve the workspace root and Git target. Abort unless the resolved target is exactly \`D:\\vibe_coding\\desktop-pet\\.git\`, its parent is exactly \`D:\\vibe_coding\\desktop-pet\`, and it is a directory.

- [ ] **Step 2: Delete only the verified old Git directory**

Use native PowerShell \`Remove-Item\` with \`-LiteralPath\`, \`-Recurse\`, and \`-Force\` against the verified absolute path. Expected: project files remain and Git reports that the directory is not yet a repository.

- [ ] **Step 3: Initialize the new repository and local identity**

Run \`git init -b main\`, set local \`user.name\` to \`devin2255\`, and set local \`user.email\` to \`devin2255@users.noreply.github.com\`. Expected: current branch is \`main\`; no remote is configured.

- [ ] **Step 4: Review the complete initial file set**

Run \`git add .\` and \`git status --short\`. Expected: ignored customer photos, generated workspaces, build products, local runtime data, and non-demo pet packages are absent from the staged list.

- [ ] **Step 5: Create the new root commit**

Run \`git commit -m "chore: initialize Desktop Pet"\`. Expected: a new root commit is created under the devin2255 local identity.

### Task 6: Verify the rebuilt repository

**Files:**
- Verify: \`.git/\`
- Verify: all tracked files

- [ ] **Step 1: Assert repository identity and history**

Run \`git branch --show-current\`, \`git remote -v\`, \`git rev-list --count HEAD\`, \`git log -1 --format=fuller\`, and \`git status --short --branch\`. Expected: branch \`main\`, no remote output, commit count \`1\`, author \`devin2255\`, and a clean working tree.

- [ ] **Step 2: Assert key files are tracked**

Confirm Git tracks \`README.md\`, \`LICENSE\`, \`ASSETS_LICENSE.md\`, \`package.json\`, \`package-lock.json\`, the approved design, and this plan.

- [ ] **Step 3: Report the next publishing command without running it**

After the user creates the destination GitHub repository, run \`git remote add origin https://github.com/devin2255/desktop-pet.git\` and \`git push -u origin main\`. Do not add or push a remote during this task.
