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

$repositoryRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..\..")
$marketDataSetup = Join-Path $repositoryRoot "apps\market-data\db\setup-market-data.ps1"

if (-not (Test-Path -LiteralPath $marketDataSetup)) {
    throw "Could not find market data setup script at $marketDataSetup."
}

Write-Warning "apps/business-backend/db/setup-market-data.ps1 is kept for compatibility. Use apps/market-data/db/setup-market-data.ps1 for new commands."
& $marketDataSetup @PSBoundParameters
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
