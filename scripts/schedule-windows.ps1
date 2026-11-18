<#
  Registers (or updates) a Windows scheduled task that runs promo-radar every N minutes.

  Usage:   powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1 [-Minutes 20] [-Name PromoRadar]
  Remove:  schtasks /Delete /TN PromoRadar /F
  Note:    the task runs while your Windows user is signed in (it needs the installed Google Chrome).
#>
param(
  [int]$Minutes = 20,
  [string]$Name = 'PromoRadar'
)

$script = Join-Path $PSScriptRoot 'run.cmd'
if (-not (Test-Path $script)) { throw "run.cmd not found: $script" }

schtasks /Create /TN $Name /TR "`"$script`"" /SC MINUTE /MO $Minutes /F
if ($LASTEXITCODE -ne 0) { throw 'Could not create the scheduled task.' }
Write-Host "Task '$Name' created: runs every $Minutes minutes. Log: data\run.log"
