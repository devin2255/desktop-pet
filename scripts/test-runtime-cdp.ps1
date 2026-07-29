param(
  [int]$Port = 9334,
  [int]$SampleSeconds = 8,
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
  $socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
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
    manifest: { id: manifest.id, name: manifest.name, actions: Object.keys(manifest.animations).sort() },
    apiMethods: Object.keys(window.petApi).sort()
  };
})()
'@

  if ($initial.readyState -ne 'complete') { throw 'Renderer did not finish loading' }
  if (-not $initial.imageComplete -or $initial.naturalSize[0] -le 0 -or $initial.naturalSize[1] -le 0) { throw 'Pet frame did not load' }
  $requiredActions = @('idle', 'reaction', 'sit', 'sleep', 'walk')
  if (@($initial.manifest.actions | Where-Object { $_ -in $requiredActions }).Count -ne 5) { throw 'Required animations are missing' }

  $states = [Collections.Generic.HashSet[string]]::new()
  $sources = [Collections.Generic.HashSet[string]]::new()
  for ($index = 0; $index -lt [Math]::Max(1, $SampleSeconds * 4); $index += 1) {
    $sample = Invoke-Eval "(() => ({ state: document.getElementById('pet').className, source: document.getElementById('pet-image').currentSrc }))()"
    [void]$states.Add([string]$sample.state)
    [void]$sources.Add([string]$sample.source)
    Start-Sleep -Milliseconds 250
  }

  $report = [ordered]@{
    target = @{ title = $target.title; url = $target.url }
    initial = $initial
    sampledStates = @($states)
    sampledImageSourceCount = $sources.Count
    passed = $true
  }
  if ($ReportPath) {
    $report | ConvertTo-Json -Depth 12 | Set-Content -Encoding utf8NoBOM -LiteralPath $ReportPath
  }
  $report | ConvertTo-Json -Depth 12
}
finally {
  if ($socket.State -eq [Net.WebSockets.WebSocketState]::Open) {
    $socket.CloseAsync([Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'done', [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  }
  $socket.Dispose()
}
