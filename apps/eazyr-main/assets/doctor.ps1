# Environment check for <PROJECT>. Read-only: this script changes nothing.
# Usage: .\scripts\doctor.ps1
#
# EDIT ONLY THE CHECKS BLOCK BELOW. The runner beneath it is complete.
# Keep these checks in sync with scripts/doctor.sh.

$ErrorActionPreference = 'Continue'

# ---------------------------------------------------------------------------
# CHECKS
# ---------------------------------------------------------------------------
# Check -Severity required|optional -Label '...' -Fix '...' -Test { $true/$false }

function Invoke-Checks {
# --- CHECKS-START --- (eazyr regenerates between these markers; edit freely)

  Check -Severity required -Label 'Node.js >= 20' `
        -Fix 'Install Node 20+: https://nodejs.org (or: nvm install 20)' -Test {
    (Test-Command node) -and (Test-VersionAtLeast (node -v) '20.0.0')
  }

  Check -Severity required -Label 'pnpm installed' `
        -Fix 'corepack enable; corepack prepare pnpm@latest --activate' -Test {
    Test-Command pnpm
  }

  Check -Severity required -Label '.env exists' `
        -Fix 'Copy-Item .env.example .env' -Test {
    Test-Path .env
  }

  Check -Severity required -Label 'DATABASE_URL set' `
        -Fix 'Set DATABASE_URL in .env (see .env.example for the local default)' -Test {
    (Test-Path .env) -and ((Get-Content .env) -match '^DATABASE_URL=.+')
  }

  Check -Severity required -Label 'port 3000 free' `
        -Fix 'Stop whatever holds it: Get-NetTCPConnection -LocalPort 3000 | Stop-Process -Id {$_.OwningProcess}' -Test {
    -not (Test-PortInUse 3000)
  }

  Check -Severity optional -Label 'Docker running' `
        -Fix 'Start Docker Desktop - needed only for integration tests' -Test {
    (Test-Command docker) -and $(docker info *>$null; $?)
  }

# --- CHECKS-END ---
}

# ---------------------------------------------------------------------------
# RUNNER - no edits needed below this line
# ---------------------------------------------------------------------------

$script:Failed = 0
$script:Warned = 0

function Test-Command([string]$Name) {
  $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

# Numeric, segment by segment. Tolerates a leading 'v' and prerelease suffixes.
function Test-VersionAtLeast([string]$Current, [string]$Minimum) {
  if (-not $Current) { return $false }
  $clean = ([regex]::Match($Current, '\d+(\.\d+)*')).Value
  if (-not $clean) { return $false }
  $c = @($clean -split '\.' | ForEach-Object { [int]$_ })
  $m = @($Minimum -split '\.' | ForEach-Object { [int]$_ })
  for ($i = 0; $i -lt [Math]::Max($c.Count, $m.Count); $i++) {
    $cv = if ($i -lt $c.Count) { $c[$i] } else { 0 }
    $mv = if ($i -lt $m.Count) { $m[$i] } else { 0 }
    if ($cv -gt $mv) { return $true }
    if ($cv -lt $mv) { return $false }
  }
  return $true
}

function Test-PortInUse([int]$Port) {
  if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  }
  return [bool](netstat -an | Select-String ":$Port\s.*LISTENING")
}

function Check {
  param(
    [ValidateSet('required', 'optional')][string]$Severity,
    [string]$Label,
    [string]$Fix,
    [scriptblock]$Test
  )

  $ok = $false
  try { $ok = [bool](& $Test) } catch { $ok = $false }

  if ($ok) {
    Write-Host "OK  " -ForegroundColor Green -NoNewline
    Write-Host $Label
  }
  elseif ($Severity -eq 'optional') {
    $script:Warned++
    Write-Host "--  " -ForegroundColor Yellow -NoNewline
    Write-Host "$Label (optional)"
    if ($Fix) { Write-Host "    -> $Fix" -ForegroundColor DarkGray }
  }
  else {
    $script:Failed++
    Write-Host "XX  " -ForegroundColor Red -NoNewline
    Write-Host $Label
    if ($Fix) { Write-Host "    -> $Fix" -ForegroundColor DarkGray }
  }
}

Set-Location (Join-Path $PSScriptRoot '..')

Write-Host "`nChecking your environment...`n"
Invoke-Checks
Write-Host ''

if ($script:Failed -gt 0) {
  Write-Host "$($script:Failed) required check(s) failed." -ForegroundColor Red -NoNewline
  Write-Host " Fix the items above, then run this again.`n"
  exit 1
}

if ($script:Warned -gt 0) {
  Write-Host "Ready" -ForegroundColor Green -NoNewline
  Write-Host " - with $($script:Warned) optional item(s) unavailable.`n"
}
else {
  Write-Host "Ready.`n" -ForegroundColor Green
}
exit 0
