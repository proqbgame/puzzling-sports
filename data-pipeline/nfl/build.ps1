# Run the NFL data pipeline (Windows)
# Usage: .\build.ps1
#        .\build.ps1 -Spike
#        .\build.ps1 -Sample

param(
    [switch]$Spike,
    [switch]$Sample,
    [switch]$Modern,
    [switch]$RefreshAll,
    [switch]$SkipAwards,
    [switch]$SkipHistorical
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$python = $null
foreach ($candidate in @("python", "py", "python3")) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) {
        $python = $candidate
        break
    }
}

if (-not $python) {
    Write-Host "Python not found. Install from https://www.python.org/downloads/ and try again." -ForegroundColor Red
    exit 1
}

Write-Host "Using Python: $python"
Write-Host "Installing packages..."
& $python -m pip install -r requirements.txt
Write-Host "Packages installed. Starting build..."
Write-Host ""

$pyArgs = @("-u", "build.py")
if ($Spike) { $pyArgs += "--spike" }
if ($Sample) { $pyArgs += "--sample" }
if ($Modern) { $pyArgs += "--modern" }
if ($RefreshAll) { $pyArgs += "--refresh-all" }
if ($SkipAwards) { $pyArgs += "--skip-awards" }
if ($SkipHistorical) { $pyArgs += "--skip-historical" }

& $python @pyArgs
