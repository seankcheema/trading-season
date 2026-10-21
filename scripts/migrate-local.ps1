[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$DatabaseUrl,
    # Only for a legacy database with no ledger: exact last applied filename.
    [string]$BaselineThrough
)

$ErrorActionPreference = 'Stop'
$psql = (Get-Command psql.exe -ErrorAction Stop).Source
$migrations = @(Get-ChildItem (Join-Path $PSScriptRoot '../db/migrations/V*.sql') -File | Sort-Object Name)
if ($migrations.Count -eq 0) { throw 'No database migrations found.' }
$baselineIndex = -1
if ($BaselineThrough) {
    $baselineIndex = [array]::IndexOf([string[]]$migrations.Name, $BaselineThrough)
    if ($baselineIndex -lt 0) { throw 'BaselineThrough must be an exact migration filename from db/migrations.' }
}

# One session holds a lock for the complete run. Each migration and its ledger
# entry commit together, including files that originally supply BEGIN/COMMIT.
$sql = [System.Collections.Generic.List[string]]::new()
$sql.Add('\set ON_ERROR_STOP on')
$sql.Add('SELECT pg_advisory_lock(2026102101);')
$sql.Add("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS has_ledger \gset")
$sql.Add('\if :has_ledger')
if ($BaselineThrough) {
    $sql.Add("DO `$`$ BEGIN RAISE EXCEPTION 'Baseline refused: schema_migrations already exists'; END `$`$;")
}
$sql.Add('\else')
$sql.Add("SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S')) AS has_schema \gset")
$sql.Add('\if :has_schema')
if (-not $BaselineThrough) {
    $sql.Add("DO `$`$ BEGIN RAISE EXCEPTION 'Existing schema has no migration ledger. Verify the last applied filename and rerun with -BaselineThrough. No migrations were applied.'; END `$`$;")
} else {
    $sql.Add('BEGIN;')
    $sql.Add('CREATE TABLE public.schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());')
    foreach ($migration in $migrations[0..$baselineIndex]) {
        $name = $migration.Name.Replace("'", "''")
        $sql.Add("INSERT INTO public.schema_migrations (filename) VALUES ('$name');")
    }
    $sql.Add('COMMIT;')
}
$sql.Add('\else')
if ($BaselineThrough) {
    $sql.Add("DO `$`$ BEGIN RAISE EXCEPTION 'Baseline refused: database is empty; omit BaselineThrough'; END `$`$;")
}
$sql.Add('\endif')
$sql.Add('\endif')
foreach ($migration in $migrations) {
    $name = $migration.Name.Replace("'", "''")
    $sql.Add("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS has_ledger \gset")
    $sql.Add('\if :has_ledger')
    $sql.Add("SELECT EXISTS (SELECT 1 FROM public.schema_migrations WHERE filename='$name') AS applied \gset")
    $sql.Add('\else')
    $sql.Add('\set applied false')
    $sql.Add('\endif')
    $sql.Add('\if :applied')
    $sql.Add("\echo Skipping $($migration.Name)")
    $sql.Add('\else')
    $sql.Add("\echo Applying $($migration.Name)")
    $sql.Add('BEGIN;')
    # Checked-in migrations use standalone transaction boundary statements.
    $body = Get-Content -LiteralPath $migration.FullName -Raw
    $body = [regex]::Replace($body, '(?im)^\s*(BEGIN|COMMIT);\s*$', '')
    $sql.Add($body)
    $sql.Add('CREATE TABLE IF NOT EXISTS public.schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());')
    $sql.Add("INSERT INTO public.schema_migrations (filename) VALUES ('$name');")
    $sql.Add('COMMIT;')
    $sql.Add('\endif')
}
$sql.Add('SELECT pg_advisory_unlock(2026102101);')
$sql.Add('\echo Migrations up to date')
# stdin avoids persisting a connection URL or generated SQL file on disk.
$sql -join "`n" | & $psql $DatabaseUrl -X -q -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed. See the PostgreSQL error above; services were not started.' }
