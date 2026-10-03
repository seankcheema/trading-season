[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseUrl,
    [string]$StartDate,
    [string]$EndDate,
    [double]$AvailableDiskGb,
    [ValidateSet("parquet", "postgres")]
    [string]$TickStorage = "parquet",
    [switch]$InitializeDisposableDatabase,
    [switch]$Regenerate,
    [switch]$Replace
)

$ErrorActionPreference = "Stop"
$databaseDirectory = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$python = Join-Path $databaseDirectory ".venv\Scripts\python.exe"
$requirements = Join-Path $databaseDirectory "scripts\python\requirements.txt"

if (-not (Test-Path -LiteralPath $python)) {
    Write-Host "[setup] Creating Python virtual environment"
    py -3 -m venv (Join-Path $databaseDirectory ".venv")
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "[setup] Installing Python dependencies"
& $python -m pip install --disable-pip-version-check -r $requirements
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($InitializeDisposableDatabase) {
    Write-Host "[setup] Initializing disposable database (public schema must be empty)"
    & $python (Join-Path $databaseDirectory "scripts\python\0001-initialize-database.py") `
        --database-url $DatabaseUrl --empty-database
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$workflowArguments = @(
    (Join-Path $databaseDirectory "scripts\python\0000-setup-synthetic-market-data.py"),
    "--database-url", $DatabaseUrl
)
if ($StartDate) { $workflowArguments += @("--start-date", $StartDate) }
if ($EndDate) { $workflowArguments += @("--end-date", $EndDate) }
if ($Regenerate) { $workflowArguments += "--regenerate" }
if ($Replace) { $workflowArguments += "--replace" }
$workflowArguments += @("--tick-storage", $TickStorage)
if ($PSBoundParameters.ContainsKey("AvailableDiskGb")) {
    if ($AvailableDiskGb -le 0) { throw "AvailableDiskGb must be greater than zero." }
    $workflowArguments += @("--available-disk-gb", $AvailableDiskGb)
}

& $python @workflowArguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
