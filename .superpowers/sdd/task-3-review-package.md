# Task 3 review package (focused excerpts; working tree uncommitted)

## preload-v3.js
slackExit: () => ipcRenderer.send('pet:slack-exit'),

## main-v3.js makeDuoController
slackEnabled: hasDuoSlack(activeManifest)

## windowSize options
slackExtraHeight: TENT_EXTRA_HEIGHT

## scheduleBehavior / runBehavior / canRunOfficeBus / isSuspended / duo-pointer-move / context-menu
mode === 'slack' treated like tent (pause roam, mute office bus, no gesture unfold, short menu)

## applySlackPresentation / slackViaMenu / leaveSlackViaMenu
See src/main-v3.js:1496-1598 and pet:slack-exit at 2112.

applySlackPresentation sends overlay { progress:1, phase:'slack', slackStage, introLeft, introRight, clips, board:null } and pushMarketStatus.

slackViaMenu: folded only, pauseBehavior, beginSlack, intro 700ms, jump (if jumpAction), then carry.

leaveSlackViaMenu: leaveSlack, overlay off, restore size, idle, scheduleBehavior 1200.

buildSlackMenu: leaveLabel or 收工了, hide, quit. No radar, no unfold, no tent.

onTrustedWin('pet:slack-exit') -> leaveSlackViaMenu()

## src/main-v3.js:1496-1600 (verbatim in implementer checkout)

clearSlackTimer, slackConfig, slackAction, slackIntroFrame, slackClips, applySlackPresentation, slackViaMenu (intro 700ms then jump then carry), leaveSlackViaMenu, buildSlackMenu as in working tree.

## tests
test-capability-gates.js asserts hasDuoSlack(activeManifest), id==='duo-slack', pet:slack-exit, canRunOfficeBus slack, slackEnabled, slackExtraHeight
test-duo-renderer-contract.js asserts preload slackExit
