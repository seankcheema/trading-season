[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseUrl,
    [string]$MigrationsDirectory
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($MigrationsDirectory)) {
    $MigrationsDirectory = Join-Path $repoRoot 'db\migrations'
}

$psql = Get-Command psql.exe -ErrorAction SilentlyContinue
if (-not $psql) {
    throw 'psql.exe was not found on PATH. Install the PostgreSQL client tools or run the migrations in pgAdmin.'
}
if (-not (Test-Path -LiteralPath $MigrationsDirectory -PathType Container)) {
    throw "Migrations directory was not found: $MigrationsDirectory"
}

function Invoke-Psql {
    param([Parameter(Mandatory)][string[]]$Arguments)

    & $psql.Source @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "psql failed with exit code $LASTEXITCODE."
    }
}

function Get-PsqlValue {
    param([Parameter(Mandatory)][string]$Query)

    $result = & $psql.Source $DatabaseUrl -X -q -tA -v ON_ERROR_STOP=1 -c $Query
    if ($LASTEXITCODE -ne 0) {
        throw "psql failed with exit code $LASTEXITCODE."
    }
    return ([string]$result).Trim()
}

$hasLedger = Get-PsqlValue -Query "SELECT to_regclass('public.schema_migrations') IS NOT NULL"
$hasAuthTable = Get-PsqlValue -Query "SELECT to_regclass('public.user_accounts') IS NOT NULL"
if ($hasLedger -eq 'f' -and $hasAuthTable -eq 't') {
    Invoke-Psql -Arguments @(
        $DatabaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1',
        '-c', 'CREATE TABLE public.schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
    )
    $v001Applied = Get-PsqlValue -Query "SELECT count(*) FROM public.schema_migrations WHERE filename = 'V001__Initialize_database.sql'"
    if ($v001Applied -eq '0') {
        Invoke-Psql -Arguments @(
            $DatabaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1',
            '-c', "INSERT INTO public.schema_migrations (filename) VALUES ('V001__Initialize_database.sql') ON CONFLICT DO NOTHING"
        )
        Write-Host '[MIGRATIONS] Existing schema detected; recorded V001 as applied.'
    }
}

foreach ($migration in @(Get-ChildItem -LiteralPath $MigrationsDirectory -Filter 'V*.sql' -File | Sort-Object Name)) {
    $filename = $migration.Name.Replace("'", "''")
    $applied = '0'
    if ((Get-PsqlValue -Query "SELECT to_regclass('public.schema_migrations') IS NOT NULL") -eq 't') {
        $applied = Get-PsqlValue -Query "SELECT count(*) FROM public.schema_migrations WHERE filename = '$filename'"
    }
    if ($applied -ne '0') {
        Write-Host "[MIGRATIONS] $($migration.Name) already applied; skipping."
        continue
    }

    Write-Host "[MIGRATIONS] Applying $($migration.Name)"
    Invoke-Psql -Arguments @(
        $DatabaseUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-f', $migration.FullName
    )
    if ($migration.Name -eq 'V001__Initialize_database.sql') {
        Invoke-Psql -Arguments @(
            $DatabaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1',
            '-c', 'CREATE TABLE IF NOT EXISTS public.schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
        )
    }
    Invoke-Psql -Arguments @(
        $DatabaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1',
        '-c', "INSERT INTO public.schema_migrations (filename) VALUES ('$filename')"
    )
}

Write-Host '[MIGRATIONS] Database is up to date.'
