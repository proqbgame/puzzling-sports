# Run the NBA data pipeline (Windows)
# Usage: .\build.ps1
#        .\build.ps1 -Sample
#        .\build.ps1 -RefreshAll

param(
    [switch]$Sample,
    [switch]$RefreshAll,
    [switch]$SkipAwards
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

$args = @("-u", "build.py")
if ($Sample) { $args += "--sample" }
if ($RefreshAll) { $args += "--refresh-all" }
if ($SkipAwards) { $args += "--skip-awards" }

& $python @args
