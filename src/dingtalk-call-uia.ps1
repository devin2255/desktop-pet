# DingTalk incoming-call UIA bridge.
# Modes are passed via environment variables (script is piped through stdin,
# so param() is not usable):
#   DINGTALK_UIA_MODE = locate | invoke | dump
#   DINGTALK_UIA_OUT  = output file for dump mode
# Output: a single UTF-8 JSON object on stdout. Never throws to stderr.

$ErrorActionPreference = 'Stop'
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
} catch {
  [Console]::WriteLine('{"ok":false,"found":false,"error":"uia-unavailable"}')
  exit 0
}

$mode = $env:DINGTALK_UIA_MODE
if (-not $mode) { $mode = 'locate' }

function Emit($obj) {
  $json = $obj | ConvertTo-Json -Depth 6 -Compress
  [Console]::WriteLine($json)
}

function MakeRect($r) {
  return @{
    x = [int]$r.Left
    y = [int]$r.Top
    width = [int]$r.Width
    height = [int]$r.Height
  }
}

try {
  $procs = @(Get-Process | Where-Object { $_.ProcessName -match 'Ding|tblive' })
  if ($procs.Count -eq 0) {
    Emit @{ found = $false; ok = $false; reason = 'no-dingtalk-process' }
    exit 0
  }
  $pids = @($procs | ForEach-Object { $_.Id })
} catch {
  Emit @{ found = $false; ok = $false; reason = 'process-enumeration-failed' }
  exit 0
}

$watch = [System.Diagnostics.Stopwatch]::StartNew()
$timeBudgetMs = 2500

$rejectNameRegex = '拒绝|拒接|挂断|decline|reject|hangup|hang up'
$rejectAutoRegex = 'reject|refuse|decline|hangup|hang_up'
$callTextRegex = '语音|通话|来电|呼叫|邀请|voip|incoming'
$boilerplateRegex = '拒绝|拒接|挂断|接听|语音通话|语音来电|来电|呼叫|邀请|正在|通话中|分钟|秒|取消|麦克风|扬声器|扬声器|等待|网络|加密|钉钉|DingTalk|安全|连接|质量|音量|静音|免提|摄像头|切换|设置|最小化|关闭'

$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker

function ScanWindow($win, $nodeCap) {
  $result = @{ texts = New-Object System.Collections.Generic.List[object]; buttons = New-Object System.Collections.Generic.List[object]; keywordHits = New-Object System.Collections.Generic.List[string]; nodes = 0 }
  try {
    $queue = New-Object System.Collections.Generic.Queue[object]
    $queue.Enqueue(@{ el = $win; depth = 0 })
    while ($queue.Count -gt 0) {
      if ($result.nodes -ge $nodeCap) { break }
      if ($watch.ElapsedMilliseconds -gt $timeBudgetMs) { break }
      $item = $queue.Dequeue()
      $el = $item.el
      $depth = $item.depth
      $result.nodes++
      $name = ''
      $auto = ''
      $ct = $null
      $rect = $null
      try { $name = $el.Current.Name } catch {}
      try { $auto = $el.Current.AutomationId } catch {}
      try { $ct = $el.Current.ControlType } catch {}
      try { $rect = $el.Current.BoundingRectangle } catch {}
      if ($name -and $name -match $callTextRegex) {
        $result.keywordHits.Add($name)
      }
      if ($ct -eq [System.Windows.Automation.ControlType]::Text -and $name) {
        $result.texts.Add(@{ name = $name; y = [int]$rect.Top; auto = $auto })
      }
      $isButton = ($ct -eq [System.Windows.Automation.ControlType]::Button) -or ($ct -eq [System.Windows.Automation.ControlType]::CheckBox)
      if ($isButton -and $rect -and ($rect.Width -gt 0)) {
        $isReject = (($name -and $name -match $rejectNameRegex) -or ($auto -and $auto -match $rejectAutoRegex))
        if ($isReject) {
          $result.buttons.Add(@{ name = $name; auto = $auto; rect = $rect; el = $el })
        }
      }
      if ($depth -lt 18) {
        try {
          $child = $walker.GetFirstChild($el)
          while ($child -ne $null) {
            $queue.Enqueue(@{ el = $child; depth = $depth + 1 })
            $child = $walker.GetNextSibling($child)
          }
        } catch {}
      }
    }
  } catch {}
  return $result
}

function FindCallWindow {
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $top = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
  $candidates = New-Object System.Collections.Generic.List[object]
  foreach ($el in $top) {
    try {
      $procId = $el.Current.ProcessId
      $rect = $el.Current.BoundingRectangle
      if (-not $rect -or $rect.Width -le 0 -or $rect.Height -le 0) { continue }
      $name = ''
      try { $name = $el.Current.Name } catch {}
      $cls = ''
      try { $cls = $el.Current.ClassName } catch {}
      $sig = ($cls -match 'VoIP') -or ($name -match '语音通话|视频通话|来电')
      if (($pids -notcontains $procId) -and (-not $sig)) { continue }
      $hwnd = 0
      try { $hwnd = $el.Current.NativeWindowHandle } catch {}
      $candidates.Add(@{ el = $el; rect = $rect; name = $name; hwnd = $hwnd; sig = $sig; area = [double]$rect.Width * [double]$rect.Height })
    } catch {}
  }
  # Signature-matched call windows first, then small windows: the popup is much smaller than the main window.
  $sorted = $candidates | Sort-Object @{ Expression = { $_.sig }; Descending = $true }, @{ Expression = { $_.area } }
  foreach ($cand in $sorted) {
    if ($watch.ElapsedMilliseconds -gt $timeBudgetMs) { break }
    $scan = ScanWindow $cand.el 2500
    if ($scan.buttons.Count -gt 0) {
      $btn = $scan.buttons[0]
      $title = $cand.name
      if (-not $title -and $scan.keywordHits.Count -gt 0) { $title = $scan.keywordHits[0] }
      $displayName = ''
      foreach ($t in $scan.texts) {
        if ($t.auto -and $t.auto -match 'label_name|label_image') {
          $displayName = [string]$t.name
          break
        }
      }
      if (-not $displayName) {
        foreach ($t in $scan.texts) {
          $n = [string]$t.name
          if (-not $n) { continue }
          if ($n.Length -gt 24) { continue }
          if ($n -match $boilerplateRegex) { continue }
          if ($n -match $rejectNameRegex) { continue }
          $displayName = $n
          break
        }
      }
      return @{
        found = $true
        hwnd = $cand.hwnd
        title = $title
        displayName = $displayName
        windowBounds = (MakeRect $cand.rect)
        rejectBounds = (MakeRect $btn.rect)
        keywordHits = @($scan.keywordHits)
        texts = @($scan.texts | ForEach-Object { $_.name })
        buttons = @($scan.buttons | ForEach-Object { $_.name })
      }
    }
  }
  return $null
}

if ($mode -eq 'locate') {
  try {
    $found = FindCallWindow
    if ($found) {
      Emit $found
    } else {
      Emit @{ found = $false }
    }
  } catch {
    Emit @{ found = $false; error = ($_.Exception.Message) }
  }
  exit 0
}

if ($mode -eq 'invoke') {
  try {
    $found = FindCallWindow
    if (-not $found) {
      Emit @{ ok = $false; reason = 'call-window-gone' }
      exit 0
    }
    # Re-find the button element to invoke; scan again but keep the element ref.
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $target = [System.Windows.Automation.AutomationElement]::FromHandle([intptr]$found.hwnd)
    $scan = ScanWindow $target 2500
    if ($scan.buttons.Count -eq 0) {
      Emit @{ ok = $false; reason = 'reject-button-gone' }
      exit 0
    }
    $btn = $scan.buttons[0]
    $el = $btn.el
    $method = ''
    $ok = $false
    try {
      $pattern = $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
      $pattern.Invoke()
      $method = 'invoke-pattern'
      $ok = $true
    } catch {
      try {
        $legacy = $el.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern)
        $legacy.DoDefault()
        $method = 'legacy-default'
        $ok = $true
      } catch {
        # Last resort: physical mouse click at button center.
        try {
          Add-Type -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, int dwExtraInfo);
'@ -Name 'DingUiaMouse' -Namespace 'DingUia'
          $r = $btn.rect
          $cx = [int]($r.Left + $r.Width / 2)
          $cy = [int]($r.Top + $r.Height / 2)
          [DingUia.DingUiaMouse]::SetCursorPos($cx, $cy)
          [DingUia.DingUiaMouse]::mouse_event(0x0002, 0, 0, 0, 0)
          [DingUia.DingUiaMouse]::mouse_event(0x0004, 0, 0, 0, 0)
          $method = 'mouse-click'
          $ok = $true
        } catch {
          $ok = $false
        }
      }
    }
    Emit @{ ok = $ok; method = $method; displayName = $found.displayName }
  } catch {
    Emit @{ ok = $false; error = ($_.Exception.Message) }
  }
  exit 0
}

if ($mode -eq 'dump') {
  $outFile = $env:DINGTALK_UIA_OUT
  if (-not $outFile) { $outFile = 'dingtalk-uia-dump.txt' }
  try {
    $sb = New-Object System.Text.StringBuilder
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $top = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($el in $top) {
      try {
        $procId = $el.Current.ProcessId
        $dname = ''
        try { $dname = $el.Current.Name } catch {}
        $dcls = ''
        try { $dcls = $el.Current.ClassName } catch {}
        $dsig = ($dcls -match 'VoIP') -or ($dname -match '语音通话|视频通话|来电')
        if (($pids -notcontains $procId) -and (-not $dsig)) { continue }
        $name = $dname
        $hwnd = 0
        try { $hwnd = $el.Current.NativeWindowHandle } catch {}
        $rect = $el.Current.BoundingRectangle
        [void]$sb.AppendLine("=== WINDOW hwnd=$hwnd name='$name' rect=$([int]$rect.Left),$([int]$rect.Top),$([int]$rect.Width)x$([int]$rect.Height) ===")
        $queue = New-Object System.Collections.Generic.Queue[object]
        $queue.Enqueue(@{ el = $el; depth = 0 })
        $count = 0
        while ($queue.Count -gt 0 -and $count -lt 8000) {
          $item = $queue.Dequeue()
          $node = $item.el
          $depth = $item.depth
          $count++
          try {
            $n = $node.Current.Name
            $a = $node.Current.AutomationId
            $c = $node.Current.ClassName
            $ct = $node.Current.ControlType.ProgrammaticName
            $r = $node.Current.BoundingRectangle
            $indent = '  ' * $depth
            [void]$sb.AppendLine("$indent[$ct] auto='$a' class='$c' name='$n' rect=$([int]$r.Left),$([int]$r.Top),$([int]$r.Width)x$([int]$r.Height)")
            if ($depth -lt 20) {
              $child = $walker.GetFirstChild($node)
              while ($child -ne $null) {
                $queue.Enqueue(@{ el = $child; depth = $depth + 1 })
                $child = $walker.GetNextSibling($child)
              }
            }
          } catch {}
        }
      } catch {}
    }
    [System.IO.File]::WriteAllText($outFile, $sb.ToString(), [System.Text.Encoding]::UTF8)
    Emit @{ ok = $true; outFile = $outFile }
  } catch {
    Emit @{ ok = $false; error = ($_.Exception.Message) }
  }
  exit 0
}

Emit @{ ok = $false; found = $false; reason = "unknown-mode:$mode" }
