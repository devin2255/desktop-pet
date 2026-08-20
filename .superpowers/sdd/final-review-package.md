# Final branch review package

## Range
3efae57c7bb635d54ac7b9d30947c9ccc0e42524..1b278da6f92cff9762ecf961697bfde297dfb89d

## Commits
1b278da build: brother-judge photoreal customer delivery
9b1c2bc fix: update brother-judge task/sit bubble copy
40945da feat: photoreal brother-judge frames with kowtow
0a2378b feat: wire brother-judge kowtow animation in pet.json
bce21db docs: lock brother-judge photoreal identity for redesign
fcb1fe4 docs: add brother-judge photoreal redesign implementation plan
ec404d7 docs: add brother-judge photoreal redesign spec
ca2756d fix: don't clear bubble while audio playing, prevents behavior animations interrupting TTS
52ac185 fix: summarize-chat summarizes all messages not just pies; fetch latest 30
3a23f75 feat: shorten task prompts to 50 chars, humorous judge style
375e680 fix: bubble duration scales with text length (300ms/char, 4s-30s)
43c0b18 fix: send task notification to bot p2p chat for instant QwenWork trigger
d4677e1 feat: pet sends instant Feishu message to QwenWork on task trigger
3af6865 fix: increase bubble duration to 6s for readability
bdf524e docs: update SDD progress ledger and task reports
fbf2e84 feat: add '当个事儿办' right-click menu with task file IPC
81f36d8 perf: reduce group poll interval to 3s
9bfec2a feat: poll group @all messages + 3s cooldown
d869a07 fix: use lark-cli-core exe + keep stdin open to prevent event stream EOF exit
75ba60f fix: add crawl-left CSS mirror so pet turns around when crawling left
a635795 fix: replace broken crawl frame 06, set crawl scale 1.3 to match walk body size
38ed42f feat: crawl mode forces all states to kneeling (no standing)
aef6eb0 feat: add crawl animation + right-click crawl mode toggle
a524886 fix: smooth slow 3s climb ascent instead of jumpy steps
3ca190e fix: stepwise climb animation (4 steps with pauses), side-aligned perch position
4e5f51f feat: auto-climb from side edge to top after 1s, then perch
01e2fa0 fix: keep climb anchor original, only flip facing direction
b5cdd36 fix: climb facing toward wall instead of away (butt was against frame)
8912130 fix: CSP media-src, customer-mode guard, larkCliPath fallback, onStatus wiring, restart dedup, name warning, cleanup
ffb6a18 release: brother judge desktop pet 0.5.0 with boss watch radar
74118ac test: boss watch radar end-to-end verification
c30d93e feat: add 7 window-interaction actions to brother judge petpack
4655099 feat: add brother judge petpack with 5 standard actions and watch lines
9263d1e feat: allow watch field in petpack manifests
999b690 feat: integrate boss watch radar into player main process
92a89f5 fix: watcher reconnect lifecycle, hourly restart cap, lifecycle test
c47aa49 feat: add lark message watcher lifecycle and trigger pipeline
246aa6b feat: add edge-tts voice synthesizer with cache
4aad19f feat: add watch config loader with petpack merge
3ed0243 feat: add watch rules filtering pipeline
26a6960 docs: implementation plan for boss watch radar
bed79a5 docs: design boss watch lark monitoring for pet
fac9059 feat: add randomActions menu support for bestie feed gifts
e312e1f test: lock perch milk tea timing
5afc963 docs: design synchronized milk tea perch
d2b4744 fix: keep customer tests out of default suite
36e4a27 feat: land generic pet interaction sequences
a1e6825 test: remove stale climb harness dependencies
303b1d4 Keep side attachments resting in place
05c6092 docs: design side rest and selfie banter
072527f Preserve laopo pet assets and extend talent-show validation.
a8f5ac5 docs: record Task 11 commit hash in report
ef6d6f9 fix: include startup-greeting in customer EXE packaging
5ecb62e Switch demo icons and docs baseline to laopo.
1ed4e3d docs: record Task 9 commit hash in report
66e606b Switch demo baseline from boss to laopo petpack.
c13cb94 docs: add laopo pet creation prompt
95d2f59 feat: support optional speechAudio on behavior items
0c654f0 feat: support optional startupGreeting in pet manifests

## Stat
 .gitignore                                         |   14 +-
 .superpowers/sdd/final-review-package.md           |   54 ++
 .superpowers/sdd/progress.md                       |   57 ++
 .superpowers/sdd/task-1-brief.md                   |  160 ++++
 .superpowers/sdd/task-1-report.md                  |  109 +++
 .superpowers/sdd/task-1-review-package.md          |  263 +++++
 .superpowers/sdd/task-10-brief.md                  |   17 +
 .superpowers/sdd/task-10-report.md                 |   43 +
 .superpowers/sdd/task-11-brief.md                  |   65 ++
 .superpowers/sdd/task-11-report.md                 |   62 ++
 .superpowers/sdd/task-2-brief.md                   |  178 ++++
 .superpowers/sdd/task-2-report.md                  |   90 ++
 .superpowers/sdd/task-2-review-package.md          |  122 +++
 .superpowers/sdd/task-3-brief.md                   |  115 +++
 .superpowers/sdd/task-3-report.md                  |  105 ++
 .superpowers/sdd/task-3-review-package.md          |  305 ++++++
 .superpowers/sdd/task-4-brief.md                   |  242 +++++
 .superpowers/sdd/task-4-report.md                  |  133 +++
 .superpowers/sdd/task-5-brief.md                   |  119 +++
 .superpowers/sdd/task-5-report.md                  |   59 ++
 .superpowers/sdd/task-6-brief.md                   |   33 +
 .superpowers/sdd/task-6-report.md                  |   34 +
 .superpowers/sdd/task-7-brief.md                   |   15 +
 .superpowers/sdd/task-7-report.md                  |  142 +++
 .superpowers/sdd/task-7b-report.md                 |  185 ++++
 .superpowers/sdd/task-8-brief.md                   |   48 +
 .superpowers/sdd/task-8-report.md                  |  255 +++++
 .superpowers/sdd/task-9-brief.md                   |   50 +
 .superpowers/sdd/task-9-report.md                  |  142 +++
 AGENTS.md                                          |    8 +-
 ASSETS_LICENSE.md                                  |    8 +-
 CHANGELOG.md                                       |   21 +
 README.md                                          |   24 +-
 assets/generated/boss-tray.png                     |  Bin 3959 -> 0 bytes
 assets/generated/boss.ico                          |  Bin 66098 -> 0 bytes
 assets/generated/laopo-tray.png                    |  Bin 0 -> 2190 bytes
 assets/generated/laopo.ico                         |  Bin 0 -> 29833 bytes
 build-report.json                                  |   40 +
 delivery/brother-judge/build-report.json           |   40 +
 docs/prompts/make-laopo-pet.txt                    |   36 +
 docs/superpowers/plans/2026-08-01-laopo-pet.md     |  643 +++++++++++++
 docs/superpowers/plans/2026-08-04-bestie-pets.md   |  556 +++++++++++
 .../plans/2026-08-05-perch-milk-tea-slow-sync.md   |  198 ++++
 .../plans/2026-08-05-side-rest-selfie-banter.md    |  191 ++++
 docs/superpowers/plans/2026-08-10-boss-watch.md    | 1012 ++++++++++++++++++++
 .../2026-08-12-brother-judge-realistic-redesign.md |  357 +++++++
 .../specs/2026-08-01-laopo-pet-design.md           |  181 ++++
 .../specs/2026-08-04-bestie-pets-design.md         |  176 ++++
 .../2026-08-05-perch-milk-tea-slow-sync-design.md  |   66 ++
 .../2026-08-05-side-rest-selfie-banter-design.md   |   56 ++
 .../specs/2026-08-10-boss-watch-design.md          |  141 +++
 .../2026-08-12-brother-judge-realistic-redesign.md |   86 ++
 outputs/laopo-verification-report.json             |   72 ++
 package-lock.json                                  |   48 +
 package.json                                       |   24 +-
 pets/library/brother-judge/DESIGN.md               |    9 +
 pets/library/brother-judge/animations/climb/01.png |  Bin 0 -> 58923 bytes
 pets/library/brother-judge/animations/climb/02.png |  Bin 0 -> 58693 bytes
 pets/library/brother-judge/animations/climb/03.png |  Bin 0 -> 60857 bytes
 pets/library/brother-judge/animations/climb/04.png |  Bin 0 -> 61544 bytes
 pets/library/brother-judge/animations/climb/05.png |  Bin 0 -> 59700 bytes
 pets/library/brother-judge/animations/climb/06.png |  Bin 0 -> 56247 bytes
 pets/library/brother-judge/animations/crawl/01.png |  Bin 0 -> 60071 bytes
 pets/library/brother-judge/animations/crawl/02.png |  Bin 0 -> 59915 bytes
 pets/library/brother-judge/animations/crawl/03.png |  Bin 0 -> 56178 bytes
 pets/library/brother-judge/animations/crawl/04.png |  Bin 0 -> 61629 bytes
 pets/library/brother-judge/animations/crawl/05.png |  Bin 0 -> 59883 bytes
 pets/library/brother-judge/animations/crawl/06.png |  Bin 0 -> 54617 bytes
 pets/library/brother-judge/animations/drag/01.png  |  Bin 0 -> 57164 bytes
 pets/library/brother-judge/animations/drag/02.png  |  Bin 0 -> 57480 bytes
 pets/library/brother-judge/animations/drag/03.png  |  Bin 0 -> 58090 bytes
 pets/library/brother-judge/animations/drag/04.png  |  Bin 0 -> 60767 bytes
 pets/library/brother-judge/animations/drag/05.png  |  Bin 0 -> 59481 bytes
 pets/library/brother-judge/animations/drag/06.png  |  Bin 0 -> 53804 bytes
 pets/library/brother-judge/animations/fall/01.png  |  Bin 0 -> 57183 bytes
 pets/library/brother-judge/animations/fall/02.png  |  Bin 0 -> 59244 bytes
 pets/library/brother-judge/animations/fall/03.png  |  Bin 0 -> 61666 bytes
 pets/library/brother-judge/animations/fall/04.png  |  Bin 0 -> 55640 bytes
 pets/library/brother-judge/animations/hang/01.png  |  Bin 0 -> 55704 bytes
 pets/library/brother-judge/animations/hang/02.png  |  Bin 0 -> 58602 bytes
 pets/library/brother-judge/animations/hang/03.png  |  Bin 0 -> 56359 bytes
 pets/library/brother-judge/animations/hang/04.png  |  Bin 0 -> 50007 bytes
 pets/library/brother-judge/animations/idle/01.png  |  Bin 0 -> 53954 bytes
 pets/library/brother-judge/animations/idle/02.png  |  Bin 0 -> 53724 bytes
 pets/library/brother-judge/animations/idle/03.png  |  Bin 0 -> 53448 bytes
 pets/library/brother-judge/animations/idle/04.png  |  Bin 0 -> 53984 bytes
 .../library/brother-judge/animations/impact/01.png |  Bin 0 -> 53309 bytes
 .../library/brother-judge/animations/impact/02.png |  Bin 0 -> 54443 bytes
 .../library/brother-judge/animations/impact/03.png |  Bin 0 -> 58783 bytes
 .../library/brother-judge/animations/impact/04.png |  Bin 0 -> 53009 bytes
 .../library/brother-judge/animations/kowtow/01.png |  Bin 0 -> 53957 bytes
 .../library/brother-judge/animations/kowtow/02.png |  Bin 0 -> 54810 bytes
 .../library/brother-judge/animations/kowtow/03.png |  Bin 0 -> 54633 bytes
 .../library/brother-judge/animations/kowtow/04.png |  Bin 0 -> 50592 bytes
 .../library/brother-judge/animations/kowtow/05.png |  Bin 0 -> 53205 bytes
 .../library/brother-judge/animations/kowtow/06.png |  Bin 0 -> 49261 bytes
 pets/library/brother-judge/animations/perch/01.png |  Bin 0 -> 57228 bytes
 pets/library/brother-judge/animations/perch/02.png |  Bin 0 -> 56590 bytes
 pets/library/brother-judge/animations/perch/03.png |  Bin 0 -> 58529 bytes
 pets/library/brother-judge/animations/perch/04.png |  Bin 0 -> 52947 bytes
 .../brother-judge/animations/reaction/01.png       |  Bin 0 -> 53927 bytes
 .../brother-judge/animations/reaction/02.png       |  Bin 0 -> 52964 bytes
 .../brother-judge/animations/reaction/03.png       |  Bin 0 -> 55163 bytes
 .../brother-judge/animations/reaction/04.png       |  Bin 0 -> 54234 bytes
 .../brother-judge/animations/recover/01.png        |  Bin 0 -> 55201 bytes
 .../brother-judge/animations/recover/02.png        |  Bin 0 -> 53462 bytes
 .../brother-judge/animations/recover/03.png        |  Bin 0 -> 56370 bytes
 .../brother-judge/animations/recover/04.png        |  Bin 0 -> 56654 bytes
 .../brother-judge/animations/recover/05.png        |  Bin 0 -> 57390 bytes
 .../brother-judge/animations/recover/06.png        |  Bin 0 -> 48682 bytes
 pets/library/brother-judge/animations/sit/01.png   |  Bin 0 -> 53636 bytes
 pets/library/brother-judge/animations/sit/02.png   |  Bin 0 -> 57056 bytes
 pets/library/brother-judge/animations/sit/03.png   |  Bin 0 -> 56963 bytes
 pets/library/brother-judge/animations/sit/04.png   |  Bin 0 -> 55478 bytes
 pets/library/brother-judge/animations/sleep/01.png |  Bin 0 -> 52995 bytes
 pets/library/brother-judge/animations/sleep/02.png |  Bin 0 -> 53792 bytes
 pets/library/brother-judge/animations/sleep/03.png |  Bin 0 -> 51934 bytes
 pets/library/brother-judge/animations/sleep/04.png |  Bin 0 -> 49193 bytes
 pets/library/brother-judge/animations/walk/01.png  |  Bin 0 -> 61443 bytes
 pets/library/brother-judge/animations/walk/02.png  |  Bin 0 -> 58971 bytes
 pets/library/brother-judge/animations/walk/03.png  |  Bin 0 -> 52334 bytes
 pets/library/brother-judge/animations/walk/04.png  |  Bin 0 -> 63673 bytes
 pets/library/brother-judge/animations/walk/05.png  |  Bin 0 -> 61294 bytes
 pets/library/brother-judge/animations/walk/06.png  |  Bin 0 -> 52242 bytes
 pets/library/brother-judge/pet.json                |  386 ++++++++
 pets/library/brother-judge/preview.png             |  Bin 0 -> 53954 bytes
 pets/packages/boss.petpack                         |  Bin 5714179 -> 0 bytes
 pets/packages/brother-judge.petpack                |  Bin 0 -> 3795545 bytes
 pets/packages/laopo.petpack                        |  Bin 0 -> 6753854 bytes
 scripts/build-customer.js                          |   18 +-
 scripts/test-bestie-petpack.js                     |  141 +++
 scripts/test-boss-petpack.js                       |   60 --
 scripts/test-boss-watch-e2e.js                     |  316 ++++++
 scripts/test-edge-voice.js                         |   35 +
 scripts/test-interaction-controller.js             |  128 ++-
 scripts/test-laopo-petpack.js                      |   72 ++
 scripts/test-message-watcher.js                    |  129 +++
 scripts/test-petpack-security.js                   |   63 +-
 scripts/test-renderer-interaction.js               |   56 +-
 scripts/test-sequence-controller.js                |   69 ++
 scripts/test-sequences-schema.js                   |  183 ++++
 scripts/test-startup-greeting.js                   |   46 +
 scripts/test-watch-config.js                       |   57 ++
 scripts/test-watch-rules.js                        |   55 ++
 .../desktop-pet-maker/references/petpack-schema.md |   45 +
 .../scripts/create_pet_manifest.py                 |    8 +
 skills/desktop-pet-maker/scripts/petpack_tool.py   |  174 +++-
 .../desktop-pet-maker/scripts/test_petpack_tool.py |   62 ++
 src/edge-voice.js                                  |   32 +
 src/index-v3.html                                  |    2 +-
 src/interaction-controller.js                      |  156 ++-
 src/main-v3.js                                     |  316 +++++-
 src/message-watcher.js                             |  208 ++++
 src/petpack-validator.js                           |  205 +++-
 src/renderer-v3.js                                 |   91 +-
 src/sequence-controller.js                         |  160 ++++
 src/startup-greeting.js                            |   10 +
 src/styles-v3.css                                  |    1 +
 src/watch-config.js                                |  102 ++
 src/watch-rules.js                                 |   58 ++
 160 files changed, 10351 insertions(+), 302 deletions(-)

