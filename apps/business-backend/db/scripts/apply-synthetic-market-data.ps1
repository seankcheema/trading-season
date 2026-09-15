param(
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$Python = "python",
    [string]$Psql = "",
    [string]$DatasetPath = "",
    [string]$OutputPath = "",
    [switch]$Generate,
    [switch]$SkipGenerate
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    throw "Set DATABASE_URL or pass -DatabaseUrl with a psql-compatible PostgreSQL connection string."
}

if ($Generate -and $SkipGenerate) {
    throw "Use either -Generate or -SkipGenerate, not both."
}

$psqlCommand = $Psql
if ([string]::IsNullOrWhiteSpace($psqlCommand)) {
    $pathCommand = Get-Command psql -ErrorAction SilentlyContinue
    if ($pathCommand) {
        $psqlCommand = $pathCommand.Source
    }
}

if ([string]::IsNullOrWhiteSpace($psqlCommand)) {
    $psqlCommand = Get-ChildItem "C:\Program Files\PostgreSQL" -Recurse -Filter psql.exe -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -like "*\bin\psql.exe" } |
        Sort-Object FullName -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}

if ([string]::IsNullOrWhiteSpace($psqlCommand) -or -not (Test-Path -LiteralPath $psqlCommand)) {
    throw "psql was not found. Pass -Psql with the full path to psql.exe, for example: -Psql 'C:\Program Files\PostgreSQL\18\bin\psql.exe'."
}

$dbRoot = Split-Path -Parent $PSScriptRoot
$schemaFiles = @(
    Join-Path $dbRoot "migrations/V001__Initial_schema.sql"
    Join-Path $dbRoot "migrations/V002__Synthetic_market_data_replay_metadata.sql"
)

foreach ($file in $schemaFiles) {
    if (-not (Test-Path -LiteralPath $file)) {
        throw "Required SQL file not found: $file"
    }

    Write-Host "Applying $file"
    & $psqlCommand $DatabaseUrl -v ON_ERROR_STOP=1 -f $file
    if ($LASTEXITCODE -ne 0) {
        throw "psql failed while applying $file"
    }
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    if ([string]::IsNullOrWhiteSpace($DatasetPath)) {
        $OutputPath = Join-Path $dbRoot "seeds/synthetic-market-data-2026-v1"
    } else {
        $OutputPath = $DatasetPath
    }
}

$manifestPath = Join-Path $OutputPath "manifest.json"
if ($Generate -or ((-not $SkipGenerate) -and (-not (Test-Path -LiteralPath $manifestPath)))) {
    $generator = Join-Path $dbRoot "scripts/generate-synthetic-market-data.py"
    Write-Host "Generating synthetic market data archive at $OutputPath"
    & $Python $generator --output $OutputPath
    if ($LASTEXITCODE -ne 0) {
        throw "Synthetic market data archive generation failed"
    }
}

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Synthetic market data archive not found at $OutputPath. Remove -SkipGenerate or pass -OutputPath with an existing generated archive."
}

$importer = Join-Path $dbRoot "scripts/import-synthetic-market-data.py"
Write-Host "Importing synthetic market data archive from $OutputPath"
& $Python $importer --database-url $DatabaseUrl --dataset $OutputPath
if ($LASTEXITCODE -ne 0) {
    throw "Synthetic market data archive import failed"
}

Write-Host "Business database schema and synthetic market data archive applied."
