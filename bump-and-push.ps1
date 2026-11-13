# bump-and-push.ps1
# Run from C:\EvenUCan (double-click or: powershell -ExecutionPolicy Bypass -File bump-and-push.ps1)
# Increments the patch version in package.json + src\js\version.js, rebuilds app\EvenUCan.html (node build.js), then commits and pushes to GitHub.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# ---- read current version from package.json ----
$pkgRaw = Get-Content 'package.json' -Raw -Encoding UTF8
$pkgRaw = $pkgRaw -replace '^\xEF\xBB\xBF', ''   # strip BOM if present
if ($pkgRaw -notmatch '"version"\s*:\s*"(\d+\.\d+\.\d+)"') {
    Write-Error "Could not find version in package.json"; exit 1
}
$oldVer = $Matches[1]
if ($oldVer -notmatch '^(\d+)\.(\d+)\.(\d+)$') {
    Write-Error "Unexpected version format: $oldVer"; exit 1
}
$newVer = $Matches[1] + '.' + $Matches[2] + '.' + ([int]$Matches[3] + 1)

Write-Host ""
Write-Host "  Bumping $oldVer  ->  $newVer" -ForegroundColor Cyan
Write-Host ""

# ---- update package.json ----
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$oldVerQ  = '"version": "' + $oldVer + '"'
$newVerQ  = '"version": "' + $newVer + '"'
$pkgNew   = $pkgRaw -replace [regex]::Escape($oldVerQ), $newVerQ
[System.IO.File]::WriteAllText((Resolve-Path 'package.json').Path, $pkgNew, $utf8NoBom)

# ---- update EvenUCan.html ----
$htmlPath = 'src\js\version.js'
$html     = Get-Content $htmlPath -Raw -Encoding UTF8
$oldTag   = "APP_VERSION='" + $oldVer + "'"
$newTag   = "APP_VERSION='" + $newVer + "'"
if ($html -notmatch [regex]::Escape($oldTag)) {
    Write-Error "$oldTag not found in $htmlPath - aborting. Revert package.json manually."
    exit 1
}
$htmlNew  = $html -replace [regex]::Escape($oldTag), $newTag
[System.IO.File]::WriteAllText((Resolve-Path $htmlPath).Path, $htmlNew, $utf8NoBom)

Write-Host "  package.json    updated to $newVer" -ForegroundColor Green
Write-Host "  version.js      updated to $newVer" -ForegroundColor Green

# ---- rebuild app\EvenUCan.html from src\ ----
node build.js
if ($LASTEXITCODE -ne 0) { Write-Error "build.js failed - aborting. Revert package.json and src\js\version.js manually."; exit 1 }
Write-Host "  EvenUCan.html   rebuilt" -ForegroundColor Green

# (UTF-8 without BOM — PowerShell 5's Set-Content -Encoding UTF8 adds a BOM that breaks JSON parsers)

# ---- stage all modified tracked files and push ----
git add -u
git add src build.js

Write-Host ""
Write-Host "  Staged:"
git diff --cached --name-only | ForEach-Object { Write-Host "    $_" }
Write-Host ""

git commit -m "v$newVer"
git tag "v$newVer"
git push
git push origin "v$newVer"

Write-Host ""
Write-Host "  Done - v$newVer pushed to GitHub." -ForegroundColor Green
Write-Host ""
