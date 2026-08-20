# DingTalk UIA scan: enumerate windows owned by DingTalk processes and dump basics.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File dingtalk-uia-scan.ps1 [-Deep] [-Hwnd <hwnd>]
param(
  [switch]$Deep,
  [long]$Hwnd = 0,
  [int]$MaxDepth = 12,
  [string]$OutFile = ''
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$procs = Get-Process | Where-Object { $_.ProcessName -match 'Ding' }
$pids = @($procs | ForEach-Object { $_.Id })
Write-Output ("PROCS: " + ($procs | ForEach-Object { "$($_.ProcessName) pid=$($_.Id) main='$($_.MainWindowTitle)' hwnd=$($_.MainWindowHandle)" }) -join ' | ')

$root = [System.Windows.Automation.AutomationElement]::RootElement
$cond = [System.Windows.Automation.Condition]::TrueCondition
$top = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)

$results = New-Object System.Collections.Generic.List[object]

foreach ($el in $top) {
  try {
    $pidVal = $el.Current.ProcessId
  } catch { continue }
  if ($pids -notcontains $pidVal) { continue }
  $hwndVal = 0
  try { $hwndVal = $el.Current.NativeWindowHandle } catch {}
  $name = ''
  try { $name = $el.Current.Name } catch {}
  $cls = ''
  try { $cls = $el.Current.ClassName } catch {}
  $rect = $null
  try { $rect = $el.Current.BoundingRectangle } catch {}
  $ctrl = ''
  try { $ctrl = $el.Current.ControlType.ProgrammaticName } catch {}
  $line = "WIN hwnd=$hwndVal pid=$pidVal ctrl=$ctrl class='$cls' name='$name' rect=$($rect.Left),$($rect.Top),$($rect.Width),$($rect.Height)"
  Write-Output $line
  $results.Add($line)

  if ($Deep -and ($Hwnd -eq 0 -or $Hwnd -eq $hwndVal)) {
    $sb = New-Object System.Text.StringBuilder
    $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
    function Dump-Element($node, $depth) {
      if ($depth -gt $MaxDepth) { return }
      try {
        $n = $node.Current.Name
        $c = $node.Current.ClassName
        $ct = $node.Current.ControlType.ProgrammaticName
        $r = $node.Current.BoundingRectangle
        $auto = $node.Current.AutomationId
        $indent = '  ' * $depth
        $sb.AppendLine("$indent[$ct] auto='$auto' class='$c' name='$n' rect=$([int]$r.Left),$([int]$r.Top),$([int]$r.Width)x$([int]$r.Height)")
        $child = $walker.GetFirstChild($node)
        while ($child -ne $null) {
          Dump-Element $child ($depth + 1)
          $child = $walker.GetNextSibling($child)
        }
      } catch {}
    }
    Dump-Element $el 0
    $tree = $sb.ToString()
    Write-Output '---- TREE ----'
    Write-Output $tree
    if ($OutFile -ne '') {
      [System.IO.File]::WriteAllText($OutFile, $tree, [System.Text.Encoding]::UTF8)
      Write-Output ("TREE-SAVED: " + $OutFile)
    }
  }
}
