param(
  [int]$Port = 9334,
  [string]$PetpackPath = "outputs/son-pet.petpack",
  [string]$ReportPath = ".superpowers/sdd/task-8-supplemental.json"
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression.FileSystem
$resolvedPetpack = (Resolve-Path -LiteralPath $PetpackPath).Path
$archive = [IO.Compression.ZipFile]::OpenRead($resolvedPetpack)
try {
  $entry = @($archive.Entries | Where-Object { $_.FullName -eq 'pet.json' })[0]
  if (-not $entry) { throw 'pet.json is missing from the packaged petpack' }
  $reader = [IO.StreamReader]::new($entry.Open(), [Text.Encoding]::UTF8)
  try { $packagedManifest = $reader.ReadToEnd() | ConvertFrom-Json }
  finally { $reader.Dispose() }
}
finally {
  $archive.Dispose()
}

$target = @(Invoke-RestMethod "http://127.0.0.1:$Port/json/list" | Where-Object { $_.type -eq 'page' })[0]
if (-not $target) { throw 'No Electron page target found' }
$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
$nextId = 0

function Invoke-Cdp {
  param([string]$Method, [hashtable]$Params = @{})
  $script:nextId += 1
  $id = $script:nextId
  $payload = @{ id = $id; method = $Method; params = $Params } | ConvertTo-Json -Depth 12 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  $socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  while ($true) {
    $stream = [IO.MemoryStream]::new()
    do {
      $buffer = [byte[]]::new(65536)
      $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).GetAwaiter().GetResult()
      $stream.Write($buffer, 0, $received.Count)
    } while (-not $received.EndOfMessage)
    $message = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
    if ($message.id -eq $id) {
      if ($message.error) { throw ($message.error | ConvertTo-Json -Compress) }
      return $message.result
    }
  }
}

function Invoke-Eval([string]$Expression) {
  $result = Invoke-Cdp 'Runtime.evaluate' @{ expression = $Expression; returnByValue = $true; awaitPromise = $true }
  if ($result.exceptionDetails) { throw ($result.exceptionDetails | ConvertTo-Json -Depth 8 -Compress) }
  return $result.result.value
}

try {
  Invoke-Cdp 'Runtime.enable' | Out-Null
  $initial = Invoke-Eval @'
(async () => {
  const manifest = await window.petApi.getCurrentPet();
  window.__supplementalStateEvents = [];
  window.petApi.onState(payload => window.__supplementalStateEvents.push(payload));
  return {
    apiMethods: Object.keys(window.petApi).sort(),
    contextMenuActions: manifest.contextMenuActions || [],
    walkFrames: manifest.animations.walk.frames
  };
})()
'@

  $randomStates = @($packagedManifest.behavior.random | ForEach-Object { [string]$_.state })
  $behaviorRandomExcludesSleep = 'sleep' -notin $randomStates
  $contextMenuActions = @($initial.contextMenuActions)

  Invoke-Eval "(() => { window.petApi.startDrag({ screenX: 0, screenY: 0 }); return true; })()" | Out-Null
  Start-Sleep -Milliseconds 500
  $drag = Invoke-Eval @'
(() => {
  const pet = document.getElementById('pet');
  const image = document.getElementById('pet-image');
  return {
    events: window.__supplementalStateEvents,
    className: pet.className,
    source: image.currentSrc,
    actionScale: Number(getComputedStyle(pet).getPropertyValue('--action-scale'))
  };
})()
'@
  $dragEvent = @($drag.events | Where-Object { $_.logicalRole -eq 'drag' })[-1]
  $dragResolvesToWalk = $null -ne $dragEvent `
    -and [string]$drag.className -eq 'pet state-drag' `
    -and [string]$drag.source -in @($initial.walkFrames) `
    -and [double]$drag.actionScale -eq 1

  $apiMethods = @($initial.apiMethods)
  $canSelectContextAction = 'runContextMenuAction' -in $apiMethods
  $canSelectSize = 'setPetSize' -in $apiMethods
  $callDad = @($contextMenuActions | Where-Object { $_.id -eq 'call-dad' })[0]
  $kowtow = @($contextMenuActions | Where-Object { $_.id -eq 'kowtow' })[0]
  $speechRequestInvoked = $false
  $bubbleSpacingBySize = @('small', 'medium', 'large' | ForEach-Object {
    [ordered]@{
      size = $_
      callDad = @{ status = 'unverified'; reason = 'The packaged preload API exposes native-menu opening but not native-menu action selection.' }
      kowtow = @{ status = 'unverified'; reason = 'The packaged preload API exposes native-menu opening but not native-menu action selection.' }
    }
  })
  $unverified = @(
    'call-dad real context-action trigger, bubble text, speech request, and return-to-kneel'
    'kowtow real context-action trigger, bubble text, and return-to-kneel'
    'small/medium/large size selection and visible-alpha-to-bubble spacing'
    'audible Windows Chinese system voice'
  )

  $report = [ordered]@{
    schemaVersion = 1
    target = @{ title = $target.title; url = $target.url }
    publicApiReachability = [ordered]@{
      methods = $apiMethods
      startDrag = 'startDrag' -in $apiMethods
      openNativeContextMenu = 'openMenu' -in $apiMethods
      selectContextMenuAction = $canSelectContextAction
      selectPetSize = $canSelectSize
    }
    contextMenuActions = [ordered]@{
      callDadDeclared = $null -ne $callDad
      callDad = $callDad
      kowtowDeclared = $null -ne $kowtow
      kowtow = $kowtow
    }
    behaviorRandomStates = $randomStates
    behaviorRandomExcludesSleep = $behaviorRandomExcludesSleep
    dragResolvesToWalk = [ordered]@{
      passed = $dragResolvesToWalk
      stateEvent = $dragEvent
      className = $drag.className
      currentSource = $drag.source
      walkFrames = @($initial.walkFrames)
      actionScale = $drag.actionScale
    }
    speechRequestInvoked = $speechRequestInvoked
    bubbleSpacingBySize = $bubbleSpacingBySize
    unverified = $unverified
    passed = $behaviorRandomExcludesSleep -and $dragResolvesToWalk -and $null -ne $callDad -and $null -ne $kowtow
    completedAt = [DateTime]::UtcNow.ToString('o')
  }
  $json = $report | ConvertTo-Json -Depth 12
  [IO.File]::WriteAllText($ReportPath, $json, [Text.UTF8Encoding]::new($false))
  $json
}
finally {
  if ($socket.State -eq [Net.WebSockets.WebSocketState]::Open) {
    $socket.CloseAsync([Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'done', [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  }
  $socket.Dispose()
}
