# SDD Progress Ledger — feature/bestie-pets-design
Plan: docs/superpowers/plans/2026-08-04-bestie-pets.md
Branch start: 072527f00cdf6884ebbb87b56ff6e547ebe15c67

Task 1: complete (working tree, no commit; review clean; minors: messageGapMs assert, dispose coverage, unused now)

Task 2: complete (working tree, no commit; review clean; minors: python test thin, schema duration wording)

Task 2: complete (working tree, no commit; review clean; minors: python test thin, schema duration wording)

Task 3: complete (working tree, no commit; review clean after hidePet fix)

Task 4: complete (no commit; workspace + IDENTITY.md; controller verified files)

Task 5: complete (working tree; idle+drag fix approved; minors: walk 3/4, necklace drift)

Task 6: complete (working tree; review clean; minors: outfit drift, flat-side 0.18)

Task 7: complete (working tree; shy/hug fix pass 2 approved; minors: model outfit drift, anchors faint)

Task 8: complete (working tree; validate+test-bestie ok; minor: build:bestie name encoding may be garbled)

Task 9: complete (working tree; gates PASS; EXE built+launched; GUI hand-test unverified; fixed build-customer sequence-controller pack)

Task 9: complete (EXE + build-report; review clean; GUI hand QA pending)

Final review: Ready with notes; fixed sequence.start false hang; GUI hand QA + commits still pending

Plan: docs/superpowers/plans/2026-08-05-side-rest-selfie-banter.md
Task 1: complete (commits 05c6092..303b1d4, review clean; minor: stale test harness climb-delay comment)
Task 2: complete (local ignored/untracked outputs, review clean; package manifest and 82 assets verified)
Task 3: complete (commits 303b1d4..d2b4744, task review clean; final review Ready to merge: Yes)
Final limitations: GUI acceptance not performed; npm test has six approved missing-xiaogou.petpack baseline errors.

Plan: docs/superpowers/plans/2026-08-05-perch-milk-tea-slow-sync.md
Task 1: complete (commits 5afc963..e312e1f, review clean; ignored manifest/package timing synced)
Task 2: complete (ignored candidate 68 promoted; source gate + 7 tests pass; visual review clean)
Task 3: complete (ignored package rebuilt; isolated runtime smoke + 84-file parity pass; review clean; minor: no retained pre-task per-entry hash inventory)


# SDD Progress Ledger — feature/boss-watch
Plan: docs/superpowers/plans/2026-08-10-boss-watch.md
Branch start: 26a6960

Task 1: complete (commits 26a6960..3ed0243, review clean Approved; minors: dedupe FIFO-not-LRU, inQuietHours getHours local-tz, missing node --check src/watch-rules.js in test:js, pickLine empty-pool untested, pickLine rng=1.0 boundary)
Task 2: complete (commits 3ed0243..4aad19f, review clean Approved; minors: asStrings/asStringArray dup, keywords accepts array, splitBosses no-trim)
Task 3: complete (commits 4aad19f..246aa6b, review clean Approved; minors: dead voice var in test, cacheDir undefined unchecked at construction, no in-flight dedup)
Task 4: complete (commits 246aa6b..92a89f5 incl fix; review clean Approved after fix; minors: double scheduleRestart on error+exit overcounts, lifecycle test doesn't assert stdout sent.length)
Task 5: complete (commits 92a89f5..999b690, review clean Approved; minors: unused parseEventLine import in main-v3 per brief)
Task 6: complete (commits 999b690..9263d1e, review clean Approved; minors: dead typeof key check, __proto__ non-risk, no size cap on watch json — all defensive/non-blocking; Pillow installed 12.3.0 for asset line)
Task 7a: complete (commits 9263d1e..4655099, controller-verified assets — reviewer cannot view binary images; verified pet.json structure, validate pass, 7/7 anim tests, 3 key frames inspected: judge hat + glasses + tanktop/shorts/flipflops consistent, reaction has brush pen, walk faces right; concerns accepted: alpha-area metric, edge-contract, reaction 2-component — all justified for human character)
Task 7b: complete (commits 4655099..c30d93e, controller-verified: 12 actions total, interactionActions 7 items, watch retained, drag/perch frames inspected identity consistent, gates pass; concerns accepted: fall frame3 flip-flop 2-comp, anchors may need tuning)
Task 8: BLOCKED on feishu user auth (commits c30d93e..74118ac; event stream works, e2e script written; blocker: user must `lark-cli auth login --scope im:message` — QR at outputs/lark-auth-qrcode.png; side-finding: Windows .cmd+shell:true stdin EOF in non-interactive — e2e works around by spawning lark-cli-core exe directly; resume after user authorizes)
Task 9: complete (commits 74118ac..ffb6a18, EXE built 89.9MiB; key fix: build-customer.js files array gained 4 boss-watch modules; concerns: GUI manual QA pending, digital sig not done, delivery ver 1.0.0 vs player 0.5.0 by design)
Final review fix: complete (commits ffb6a18..8912130; fixed Critical CSP media-src, Important #2-6 customer-guard/larkCliPath/onStatus/restart-dedup/name-warning, Minor #7/9/10; all tests green)
Final review: Ready with notes (after fix commit 8912130)
Pending: Task 8 e2e BLOCKED on user feishu auth (im:message scope); GUI manual launch QA; edge-tts CC-BY-NC-SA license note for delivery; name-to-open_id resolution deferred (warning shown)

# SDD Progress Ledger — feature/son-mode / brother-duo
Plan: docs/superpowers/plans/2026-09-11-brother-duo.md
Branch start: 1017f76c73dc652a0cc1e44e211315cdbbe076b0

Task 1: complete (working tree, no commit; review clean Approved; minors: snapProgress option untested, folding reverse-drag untested, createDuoController menuSlopPx/commitPx unused on instance)
Task 2: complete (working tree, no commit; review clean after fix; Important Python 动画路径冲突 fixed; schema mojibake was review-package encoding false positive; minors: JS/Python id/name/watch/gesture negative cases thin; xiaogou temp fixture in test_petpack_tool.py)
Task 3: complete (working tree, no commit; review Approved by controller after 2 fix passes; Important preload finite + contextmenu/mouseleave/12px fixed; leftover reviewer flags adjudicated: left-click hearts/interact is existing pet interaction not Duo fold; cancel-on-left-drag is Task 4 pet:drag-start; minor none)
Task 4: complete (working tree, no commit; review Approved after left-manifest fix; minors: peer no independent roam, sequences/setPetSize not half-clamped, drag can transiently cross midline)
Task 5: complete (working tree, no commit; review clean Approved; floral-face.jpg 181390 bytes + IDENTITY.md)
Task 6: complete (working tree, no commit; review Approved after 2 fix passes; minors: sleep/04 Zzz, walk floral pocket flicker, sleep/01 fist vs later idle-sleep)
Task 7: complete (working tree, no commit; judge copied; floral idle4/walk6/sit4/sleep4/reaction4/drag6; window-seven mapped; strip tests OK)
Task 8: complete (working tree, no commit; pet.json + preview + brother-duo.petpack validate+test ok)
Task 9: complete (working tree, no commit; targetWatchWindow source gates added)
Task 10: complete (EXE 兄弟桌宠 Duo-1.0.0.exe ~102MiB + build-report.json; GUI hand QA of fold/unfold/radar pending; no code signing)

# SDD Progress Ledger — feature/son-mode / duo-slack-fish
Plan: docs/superpowers/plans/2026-09-15-duo-slack-fish.md
Branch start: working tree (no commit)

Task 1: complete (working tree, no commit; review clean Approved)

Task 2: complete (working tree, no commit; review Approved after controller adjudication — tent main-v3 asserts in test-capability-gates.js are pre-existing, Task 2 only added hasDuoSlack)

Task 3: complete (working tree, no commit; review clean Approved)

Task 4: complete (working tree, no commit; review Approved after removing overlay setState jump/carry)

Task 5: complete (working tree, no commit; review Approved after leaveLabel=收工了 and carry phone removed; minor: jump/carry still idle composites, leftover red fragment between figures)

Task 6: complete (working tree, no commit; EXE built+launched; GUI overlay hand-test unverified; no code signing)
