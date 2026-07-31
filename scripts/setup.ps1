$ErrorActionPreference = 'Stop'

function Require-Command {
    param([Parameter(Mandatory = $true)][string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found."
    }
}

Require-Command node
Require-Command npm
Require-Command python

$nodeText = (& node --version).Trim().TrimStart('v')
$nodeVersion = [version]($nodeText.Split('-')[0])
if ($nodeVersion -lt [version]'22.12.0') {
    throw "Node.js 22.12 or newer is required; found $nodeText. Node.js 24 LTS is recommended."
}

$pythonText = (& python -c "import sys; print('.'.join(map(str, sys.version_info[:3])))").Trim()
$pythonVersion = [version]$pythonText
if ($pythonVersion -lt [version]'3.11.0') {
    throw "Python 3.11 or newer is required; found $pythonText."
}

Write-Host "Using Node.js $nodeText and Python $pythonText."
& python -m pip install --requirement requirements-dev.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }

& npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

& npm test
if ($LASTEXITCODE -ne 0) { throw 'Test suite failed.' }

Write-Host 'Setup complete. Run npm start to launch the player.'
