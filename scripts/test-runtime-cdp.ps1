param(
  [int]$Port = 9334,
  [int]$SampleSeconds = 8,
  [int]$SamplesPerRole = 50,
  [string]$ReportPath = ""
)

$ErrorActionPreference = 'Stop'
$target = @(Invoke-RestMethod "http://127.0.0.1:$Port/json/list" | Where-Object { $_.type -eq 'page' })[0]
if (-not $target) { throw 'No Electron page target found' }

$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
$nextId = 0

function Invoke-Cdp {
  param([string]$Method, [hashtable]$Params = @{})
  $script:nextId += 1
  $id = $script:nextId
  $payload = @{ id = $id; method = $Method; params = $Params } | ConvertTo-Json -Depth 12 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  [void]$socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  while ($true) {
    $stream = [IO.MemoryStream]::new()
    do {
      $buffer = [byte[]]::new(65536)
      $result = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).GetAwaiter().GetResult()
      $stream.Write($buffer, 0, $result.Count)
    } while (-not $result.EndOfMessage)
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
  const image = document.getElementById('pet-image');
  const pet = document.getElementById('pet');
  const manifest = await window.petApi.getCurrentPet();
  return {
    readyState: document.readyState,
    title: document.title,
    viewport: [innerWidth, innerHeight],
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    petClass: pet.className,
    imageComplete: image.complete,
    naturalSize: [image.naturalWidth, image.naturalHeight],
    imageSource: image.currentSrc,
    manifest: {
      id: manifest.id,
      name: manifest.name,
      actions: Object.keys(manifest.animations).sort(),
      animations: manifest.animations,
      interactionActions: manifest.interactionActions || {}
    },
    apiMethods: Object.keys(window.petApi).sort()
  };
})()
'@

  if ($initial.readyState -ne 'complete') { throw 'Renderer did not finish loading' }
  if (-not $initial.imageComplete -or $initial.naturalSize[0] -le 0 -or $initial.naturalSize[1] -le 0) { throw 'Pet frame did not load' }
  $requiredActions = @('idle', 'reaction', 'sit', 'sleep', 'walk')
  if (@($initial.manifest.actions | Where-Object { $_ -in $requiredActions }).Count -ne 5) { throw 'Required animations are missing' }

  $interactionActions = $initial.manifest.interactionActions
  $visibleInsets = Invoke-Eval "window.__petDebug?.visibleInsets || null"
  $bubbleTop = Invoke-Eval "getComputedStyle(document.getElementById('bubble')).top"
  $windowSize = Invoke-Eval "({width: innerWidth, height: innerHeight})"

  $states = [Collections.Generic.HashSet[string]]::new()
  $sources = [Collections.Generic.HashSet[string]]::new()
  for ($index = 0; $index -lt [Math]::Max(1, $SampleSeconds * 4); $index += 1) {
    $sample = Invoke-Eval "(() => ({ state: document.getElementById('pet').className, source: document.getElementById('pet-image').currentSrc }))()"
    [void]$states.Add([string]$sample.state)
    [void]$sources.Add([string]$sample.source)
    Start-Sleep -Milliseconds 250
  }

  # Enter the production interaction lock so the normal random behavior timer
  # cannot legitimately replace a CDP-driven visual role between animation frames.
  $actualInteractionLock = Invoke-Eval "(() => { window.petApi.startDrag({ screenX: 0, screenY: 0 }); return true; })()"
  Start-Sleep -Milliseconds 100

  $roles = @('drag', 'climb', 'perch', 'hang', 'fall', 'impact', 'recover')
  $roleReports = [ordered]@{}
  $unexpectedResize = 0
  $unexpectedDisplacement = 0
  $unexpectedScale = 0
  $classOrTransformAccumulation = 0

  foreach ($role in $roles) {
    $roleConfig = $interactionActions.$role
    if (-not $roleConfig -or -not $roleConfig.action) { throw "Missing interactionActions mapping for role: $role" }
    $actionName = [string]$roleConfig.action
    $animation = $initial.manifest.animations.$actionName
    if (-not $animation -or @($animation.frames).Count -eq 0) { throw "Mapped animation is missing frames: $role -> $actionName" }
    if ([double]$animation.scale -ne 1) { throw "Action scale must be exactly 1: $role -> $actionName" }

    $expectedFrameSources = @($animation.frames)
    $observedFrameSources = [Collections.Generic.HashSet[string]]::new()
    $classNames = [Collections.Generic.HashSet[string]]::new()
    $transforms = [Collections.Generic.HashSet[string]]::new()
    $baselineAnchor = $null
    $maxAnchorShift = 0.0
    $roleUnexpectedResize = 0
    $roleUnexpectedDisplacement = 0
    $roleUnexpectedScale = 0
    $roleClassOrTransformAccumulation = 0
    $anchorX = if ($null -ne $roleConfig.anchor -and $null -ne $roleConfig.anchor.x) { [double]$roleConfig.anchor.x } else { 0.5 }
    $anchorY = if ($null -ne $roleConfig.anchor -and $null -ne $roleConfig.anchor.y) { [double]$roleConfig.anchor.y } else { 0.5 }

    for ($index = 0; $index -lt [Math]::Max(1, $SamplesPerRole); $index += 1) {
      $frameIndex = $index % $expectedFrameSources.Count
      $expression = @"
(async () => {
  const role = $($role | ConvertTo-Json -Compress);
  const source = $($expectedFrameSources[$frameIndex] | ConvertTo-Json -Compress);
  const image = document.getElementById('pet-image');
  const pet = document.getElementById('pet');
  pet.className = ``pet state-`${role}``;
  pet.style.setProperty('--action-scale', '1');
  image.src = source;
  if (!image.complete) {
    await new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', reject, { once: true });
    });
  }
  if (image.decode) await image.decode().catch(() => {});
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const rect = image.getBoundingClientRect();
  const style = getComputedStyle(pet);
  return {
    role,
    source: image.currentSrc,
    windowSize: { width: innerWidth, height: innerHeight },
    imageRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    actionScale: Number(style.getPropertyValue('--action-scale')),
    className: pet.className,
    transform: style.transform
  };
})()
"@
      $sample = Invoke-Eval $expression
      [void]$observedFrameSources.Add([string]$sample.source)
      [void]$classNames.Add([string]$sample.className)
      [void]$transforms.Add([string]$sample.transform)

      if ($sample.windowSize.width -ne $windowSize.width -or $sample.windowSize.height -ne $windowSize.height) {
        $roleUnexpectedResize += 1
      }
      if ([double]$sample.actionScale -ne 1) { $roleUnexpectedScale += 1 }
      if ([string]$sample.className -ne "pet state-$role" -or [string]$sample.transform -ne 'none') {
        $roleClassOrTransformAccumulation += 1
      }
      $anchor = [ordered]@{
        x = [double]$sample.imageRect.left + [double]$sample.imageRect.width * $anchorX
        y = [double]$sample.imageRect.top + [double]$sample.imageRect.height * $anchorY
      }
      if ($null -eq $baselineAnchor) {
        $baselineAnchor = $anchor
      } else {
        $shift = [Math]::Sqrt(
          [Math]::Pow($anchor.x - $baselineAnchor.x, 2) +
          [Math]::Pow($anchor.y - $baselineAnchor.y, 2)
        )
        $maxAnchorShift = [Math]::Max($maxAnchorShift, $shift)
        if ($shift -gt 2) { $roleUnexpectedDisplacement += 1 }
      }
    }

    $missingFrameSources = @($expectedFrameSources | Where-Object { -not $observedFrameSources.Contains([string]$_) })
    $rolePassed = $roleUnexpectedResize -eq 0 `
      -and $roleUnexpectedDisplacement -eq 0 `
      -and $roleUnexpectedScale -eq 0 `
      -and $roleClassOrTransformAccumulation -eq 0 `
      -and $missingFrameSources.Count -eq 0
    $roleReports[$role] = [ordered]@{
      action = $actionName
      sampleCount = [Math]::Max(1, $SamplesPerRole)
      anchor = @{ x = $anchorX; y = $anchorY }
      baselineAnchor = $baselineAnchor
      maxAnchorShiftDip = [Math]::Round($maxAnchorShift, 3)
      expectedFrameSources = $expectedFrameSources
      observedFrameSources = @($observedFrameSources)
      missingFrameSources = $missingFrameSources
      observedClassNames = @($classNames)
      observedTransforms = @($transforms)
      unexpectedResize = $roleUnexpectedResize
      unexpectedDisplacement = $roleUnexpectedDisplacement
      unexpectedScale = $roleUnexpectedScale
      classOrTransformAccumulation = $roleClassOrTransformAccumulation
      passed = $rolePassed
    }
    $unexpectedResize += $roleUnexpectedResize
    $unexpectedDisplacement += $roleUnexpectedDisplacement
    $unexpectedScale += $roleUnexpectedScale
    $classOrTransformAccumulation += $roleClassOrTransformAccumulation
  }

  $allRolesPassed = @($roleReports.Values | Where-Object { -not $_.passed }).Count -eq 0
  $report = [ordered]@{
    target = @{ title = $target.title; url = $target.url }
    initial = $initial
    interactionActions = $interactionActions
    actualInteractionLock = $actualInteractionLock
    visibleInsets = $visibleInsets
    bubbleTop = $bubbleTop
    windowSize = $windowSize
    sampledStates = @($states)
    sampledImageSourceCount = $sources.Count
    roleSamples = $roleReports
    totals = [ordered]@{
      samplesPerRole = [Math]::Max(1, $SamplesPerRole)
      roleCount = $roles.Count
      transitionCount = [Math]::Max(1, $SamplesPerRole) * $roles.Count
      unexpectedResize = $unexpectedResize
      unexpectedDisplacement = $unexpectedDisplacement
      unexpectedScale = $unexpectedScale
      classOrTransformAccumulation = $classOrTransformAccumulation
    }
    limitations = @(
      'Role sampling enters the real drag interaction lock, then drives renderer DOM roles and real packaged frame URLs through CDP; it does not emulate physical pointer movement or native window discovery.'
      'window.__petDebug.visibleInsets is recorded when exposed by the renderer and remains null otherwise.'
    )
    passed = $allRolesPassed
  }
  if ($ReportPath) {
    $reportJson = $report | ConvertTo-Json -Depth 12
    [IO.File]::WriteAllText($ReportPath, $reportJson, [Text.UTF8Encoding]::new($false))
  }
  $report | ConvertTo-Json -Depth 12
}
finally {
  if ($socket.State -eq [Net.WebSockets.WebSocketState]::Open) {
    [void]$socket.CloseAsync([Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'done', [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  }
  $socket.Dispose()
}
