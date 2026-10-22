# Runs only against a new temporary PostgreSQL cluster; never uses the local app database.
[CmdletBinding()]
param([int]$Port = 55439)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runner = Join-Path $repoRoot 'scripts/migrate-local.ps1'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('trading-migrations-' + [guid]::NewGuid().ToString('N'))
$data = Join-Path $testRoot 'data'
New-Item -ItemType Directory -Path $testRoot | Out-Null
$started = $false
function Invoke-TestSql([string]$Database, [string]$Sql) {
    $result = & psql.exe -h 127.0.0.1 -p $Port -U postgres -d $Database -X -At -v ON_ERROR_STOP=1 -c $Sql
    if ($LASTEXITCODE -ne 0) { throw 'Test SQL failed.' }
    return $result
}
function Assert-Equal($Actual, $Expected, [string]$Label) {
    if ("$Actual" -ne "$Expected") { throw "${Label}: expected '$Expected', got '$Actual'." }
}
try {
    & initdb.exe -D $data -U postgres -A trust --no-locale -E UTF8 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not initialize temporary PostgreSQL cluster.' }
    & pg_ctl.exe -D $data -l (Join-Path $testRoot 'server.log') -o "-p $Port -h 127.0.0.1" -w start | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not start temporary PostgreSQL cluster.' }
    $started = $true
    $count = @(Get-ChildItem (Join-Path $repoRoot 'db/migrations/V*.sql')).Count
    Invoke-TestSql postgres 'CREATE DATABASE fresh' | Out-Null
    $freshUrl = "postgresql://postgres@127.0.0.1:$Port/fresh"
    $refused = $false
    try { & $runner -DatabaseUrl $freshUrl -BaselineThrough 'V013__Order_audit_lifecycle.sql' } catch { $refused = $true }
    Assert-Equal $refused $true 'Empty database cannot be baselined'
    & $runner -DatabaseUrl $freshUrl
    & $runner -DatabaseUrl $freshUrl
    Assert-Equal (Invoke-TestSql fresh 'SELECT count(*) FROM schema_migrations') $count 'Fresh and repeated migration'
    Assert-Equal (Invoke-TestSql fresh "SELECT count(*) FROM schema_migrations WHERE filename LIKE 'V009%'") 2 'Duplicate version filenames'

    Invoke-TestSql postgres 'CREATE DATABASE legacy' | Out-Null
    $legacyUrl = "postgresql://postgres@127.0.0.1:$Port/legacy"
    foreach ($file in Get-ChildItem (Join-Path $repoRoot 'db/migrations/V*.sql') | Sort-Object Name) {
        if ($file.Name -gt 'V009__Analyst_role.sql') { break }
        & psql.exe $legacyUrl -X -q -v ON_ERROR_STOP=1 -f $file.FullName
        if ($LASTEXITCODE -ne 0) { throw 'Legacy setup failed.' }
    }
    Invoke-TestSql legacy 'CREATE TABLE migration_sentinel (value text); INSERT INTO migration_sentinel VALUES (''keep me''); CREATE INDEX accounts_owner_status_idx ON accounts(user_id)' | Out-Null
    $refused = $false
    try { & $runner -DatabaseUrl $legacyUrl } catch { $refused = $true }
    Assert-Equal $refused $true 'Untracked schema refusal'
    Assert-Equal (Invoke-TestSql legacy "SELECT to_regclass('public.schema_migrations') IS NULL") t 'Refusal leaves schema unchanged'
    $failed = $false
    try { & $runner -DatabaseUrl $legacyUrl -BaselineThrough 'V009__Analyst_role.sql' } catch { $failed = $true }
    Assert-Equal $failed $true 'Deliberate V010 index conflict'
    Assert-Equal (Invoke-TestSql legacy "SELECT count(*) FROM information_schema.columns WHERE table_name='accounts' AND column_name='status'") 0 'Failed migration rolled back'
    Assert-Equal (Invoke-TestSql legacy "SELECT count(*) FROM schema_migrations WHERE filename LIKE 'V010%'") 0 'Failed migration not recorded'
    Invoke-TestSql legacy 'DROP INDEX accounts_owner_status_idx' | Out-Null
    & $runner -DatabaseUrl $legacyUrl
    Assert-Equal (Invoke-TestSql legacy 'SELECT count(*) FROM schema_migrations') $count 'Legacy upgrade resumes'
    Assert-Equal (Invoke-TestSql legacy 'SELECT value FROM migration_sentinel') 'keep me' 'Existing data retained'
    Assert-Equal (Invoke-TestSql legacy "SELECT count(*) FROM information_schema.columns WHERE table_name='cash_transactions' AND column_name='client_reference'") 1 'Cash history column'
    $refused = $false
    try { & $runner -DatabaseUrl $legacyUrl -BaselineThrough 'V013__Order_audit_lifecycle.sql' } catch { $refused = $true }
    Assert-Equal $refused $true 'Existing ledger cannot be baselined again'
    Write-Host 'PASS: fresh database, repeat run, legacy baseline, refusal, rollback, resume and data preservation.'
}
finally {
    if ($started) { & pg_ctl.exe -D $data -m fast -w stop | Out-Null }
    # Keep diagnostic files for inspection; this test never deletes database directories.
    Write-Host "Temporary test cluster (stopped): $testRoot"
}
