[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseUrl
)
$ErrorActionPreference = "Stop"
$databaseDirectory = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$python = Join-Path $databaseDirectory ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $python)) {
    py -3 -m venv (Join-Path $databaseDirectory ".venv")
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
& $python -m pip install --disable-pip-version-check -r (Join-Path $databaseDirectory "scripts\python\requirements.txt")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $python (Join-Path $databaseDirectory "scripts\python\0001-initialize-database.py") --database-url $DatabaseUrl --empty-database
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
