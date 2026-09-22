[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$authDirectory = Join-Path $repoRoot 'apps/auth-service'
$holdingsDirectory = Join-Path $repoRoot 'apps/holdings-and-trade-service'
$orderDirectory = Join-Path $repoRoot 'apps/order-and-sell-service'
$backendDirectory = Join-Path $repoRoot 'apps/market-data'
$envFile = Join-Path $authDirectory '.env'

function Get-RequiredCommand {
    param([Parameter(Mandatory)][string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Required command '$Name' was not found on PATH."
    }
    return $command.Source
}

function Get-EnvSetting {
    param(
        [Parameter(Mandatory)][string]$Content,
        [Parameter(Mandatory)][string]$Name
    )

    $matches = [regex]::Matches($Content, "(?m)^$([regex]::Escape($Name))=(.*)$")
    if ($matches.Count -ne 1) {
        throw "Expected exactly one $Name entry in apps/auth-service/.env."
    }
    return $matches[0].Groups[1].Value.Trim().Trim('"').Trim("'")
}

function Assert-PortAvailable {
    param([Parameter(Mandatory)][int]$Port)

    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    if ($listener) {
        throw "Port $Port is already in use. Stop the existing service before starting the local stack."
    }
}

if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    throw 'Missing apps/auth-service/.env. Copy .env.example, remove its three JWT placeholder lines, then generate development keys.'
}

$envContent = Get-Content -LiteralPath $envFile -Raw
$privateKey = Get-EnvSetting -Content $envContent -Name 'JWT_PRIVATE_KEY'
$publicKey = Get-EnvSetting -Content $envContent -Name 'JWT_PUBLIC_KEY'
$issuer = Get-EnvSetting -Content $envContent -Name 'JWT_ISSUER'

if ($privateKey -notmatch '^-----BEGIN PRIVATE KEY-----\\n.+\\n-----END PRIVATE KEY-----$' -or
    $publicKey -notmatch '^-----BEGIN PUBLIC KEY-----\\n.+\\n-----END PUBLIC KEY-----$' -or
    $privateKey.Contains('...') -or $publicKey.Contains('...') -or [string]::IsNullOrWhiteSpace($issuer)) {
    throw 'JWT values are missing or still placeholders. Remove the three JWT lines copied from .env.example, then run the development key generator.'
}

$dbHost = Get-EnvSetting -Content $envContent -Name 'DB_HOST'
$dbPort = Get-EnvSetting -Content $envContent -Name 'DB_PORT'
if ($dbHost -notin @('127.0.0.1', 'localhost')) {
    throw 'Local startup requires DB_HOST=127.0.0.1 (or localhost) in apps/auth-service/.env.'
}

$parsedDbPort = 0
if (-not [int]::TryParse($dbPort, [ref]$parsedDbPort) -or $parsedDbPort -lt 1 -or $parsedDbPort -gt 65535) {
    throw 'DB_PORT in apps/auth-service/.env must be a valid TCP port.'
}

$npm = Get-RequiredCommand -Name 'npm.cmd'
$maven = Get-RequiredCommand -Name 'mvn.cmd'
$pgIsReady = Get-RequiredCommand -Name 'pg_isready.exe'

& $pgIsReady -h 127.0.0.1 -p 5432 -q
if ($LASTEXITCODE -ne 0) {
    throw 'The business PostgreSQL database is not accepting connections at 127.0.0.1:5432.'
}

& $pgIsReady -h $dbHost -p $parsedDbPort -q
if ($LASTEXITCODE -ne 0) {
    throw "The auth PostgreSQL database is not accepting connections at ${dbHost}:${parsedDbPort}."
}

Assert-PortAvailable -Port 3001
Assert-PortAvailable -Port 4200
Assert-PortAvailable -Port 8081
Assert-PortAvailable -Port 8082

$businessPassword = $env:SPRING_DATASOURCE_PASSWORD
if ([string]::IsNullOrWhiteSpace($businessPassword)) {
    $securePassword = Read-Host 'Business database password for trading_season' -AsSecureString
    $businessPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password
    if ([string]::IsNullOrWhiteSpace($businessPassword)) {
        throw 'The business database password cannot be empty.'
    }
}

$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$logDirectory = Join-Path $tempRoot "trading-season-$PID-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $logDirectory | Out-Null
$processes = @()

function Start-LocalService {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(Mandatory)][string[]]$ArgumentList,
        [Parameter(Mandatory)][string]$WorkingDirectory
    )

    $stdout = Join-Path $logDirectory "$Name.out.log"
    $stderr = Join-Path $logDirectory "$Name.err.log"
    $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList `
        -WorkingDirectory $WorkingDirectory -NoNewWindow -PassThru `
        -RedirectStandardOutput $stdout -RedirectStandardError $stderr

    return [pscustomobject]@{
        Name = $Name
        Process = $process
        Stdout = $stdout
        Stderr = $stderr
        StdoutLine = 0
        StderrLine = 0
    }
}

function Write-NewLogLines {
    param([Parameter(Mandatory)]$Service)

    foreach ($stream in @('Stdout', 'Stderr')) {
        $path = $Service.$stream
        if (-not (Test-Path -LiteralPath $path)) {
            continue
        }
        $lines = @(Get-Content -LiteralPath $path)
        $offsetProperty = "${stream}Line"
        for ($index = $Service.$offsetProperty; $index -lt $lines.Count; $index++) {
            Write-Host "[$($Service.Name)] $($lines[$index])"
        }
        $Service.$offsetProperty = $lines.Count
    }
}

try {
    $processes += Start-LocalService -Name 'auth' -FilePath $npm `
        -ArgumentList @('run', 'start:dev') -WorkingDirectory $authDirectory

    $oldBusinessPassword = $env:SPRING_DATASOURCE_PASSWORD
    $env:SPRING_DATASOURCE_PASSWORD = $businessPassword
    try {
        $processes += Start-LocalService -Name 'holdings-and-trade' -FilePath $maven `
            -ArgumentList @('spring-boot:run') -WorkingDirectory $holdingsDirectory

        $processes += Start-LocalService -Name 'order-and-sell' -FilePath $maven `
            -ArgumentList @('spring-boot:run') -WorkingDirectory $orderDirectory
    }
    finally {
        $env:SPRING_DATASOURCE_PASSWORD = $oldBusinessPassword
    }

    $processes += Start-LocalService -Name 'ui' -FilePath $npm `
        -ArgumentList @('--workspace', 'business-logic-ui', 'start') -WorkingDirectory $repoRoot

    Write-Host 'Starting UI :4200, auth :3001, holdings-and-trade :8081, and order-and-sell :8082. Press Ctrl+C to stop all services.'
    while ($true) {
        foreach ($service in $processes) {
            Write-NewLogLines -Service $service
            $service.Process.Refresh()
            if ($service.Process.HasExited) {
                throw "$($service.Name) exited with code $($service.Process.ExitCode)."
            }
        }
        Start-Sleep -Milliseconds 250
    }
}
finally {
    foreach ($service in $processes) {
        Write-NewLogLines -Service $service
        $service.Process.Refresh()
        if (-not $service.Process.HasExited) {
            Start-Process -FilePath 'taskkill.exe' -ArgumentList @('/PID', $service.Process.Id, '/T', '/F') `
                -WindowStyle Hidden -Wait | Out-Null
        }
    }

    $resolvedLogDirectory = [System.IO.Path]::GetFullPath($logDirectory)
    if ($resolvedLogDirectory.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
        (Split-Path -Leaf $resolvedLogDirectory).StartsWith('trading-season-')) {
        Remove-Item -LiteralPath $resolvedLogDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
}
