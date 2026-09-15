[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseUrl,
    [string]$StartDate,
    [string]$EndDate,
    [switch]$InitializeDisposableDatabase,
    [switch]$Regenerate,
    [switch]$Replace
)

$ErrorActionPreference = "Stop"
$databaseDirectory = $PSScriptRoot
$python = Join-Path $databaseDirectory ".venv\Scripts\python.exe"
$requirements = Join-Path $databaseDirectory "scripts\requirements.txt"

if (-not (Test-Path -LiteralPath $python)) {
    Write-Host "[setup] Creating Python virtual environment"
    py -3 -m venv (Join-Path $databaseDirectory ".venv")
}

Write-Host "[setup] Installing Python dependencies"
& $python -m pip install --disable-pip-version-check -r $requirements

if ($InitializeDisposableDatabase) {
    Write-Host "[setup] Initializing disposable database (existing business tables will be dropped)"
    & $python (Join-Path $databaseDirectory "scripts\0001-initialize-database.py") `
        --database-url $DatabaseUrl --disposable-database
}

$workflowArguments = @(
    (Join-Path $databaseDirectory "scripts\0000-setup-synthetic-market-data.py"),
    "--database-url", $DatabaseUrl
)
if ($StartDate) { $workflowArguments += @("--start-date", $StartDate) }
if ($EndDate) { $workflowArguments += @("--end-date", $EndDate) }
if ($Regenerate) { $workflowArguments += "--regenerate" }
if ($Replace) { $workflowArguments += "--replace" }

& $python @workflowArguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
