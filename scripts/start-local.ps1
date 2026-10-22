[CmdletBinding()]
param(
    # A Kafka distribution to start a broker from when none is listening on
    # localhost:29092, for a machine without Docker. Defaults to KAFKA_HOME.
    [string]$KafkaHome = $env:KAFKA_HOME,

    # Minutes between report runs. Short by default so a trade placed locally
    # reaches the Reporting UI quickly; the Compose stack uses 15.
    [ValidateRange(1, 1440)][int]$ReportIntervalMinutes = 1,

    # Start without the Reporting Service and its consumer, which need Python.
    [switch]$SkipReporting,

    # Stream every service's raw log into this console. By default each service
    # gets one status line and only errors are echoed; the logs stay in the
    # temporary folder named at startup until the script exits.
    [switch]$ShowLogs
)

# This script requires Node.js 24.8.0 (exactly), npm 11.16.0, JDK 21, and Maven 3.9+,
# and Python 3.14 for the Reporting Service unless -SkipReporting is passed.
# See README.md for strict dependency requirements.

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$authDirectory = Join-Path $repoRoot 'apps/auth-service'
$clientUiDirectory = Join-Path $repoRoot 'apps/client-ui'
$reportingUiDirectory = Join-Path $repoRoot 'apps/reporting-ui'
$reportingDirectory = Join-Path $repoRoot 'apps/reporting-service'
$reportingPython = Join-Path $reportingDirectory 'venv/Scripts/python.exe'
$holdingsDirectory = Join-Path $repoRoot 'apps/holdings-and-trade-service'
$orderDirectory = Join-Path $repoRoot 'apps/order-and-sell-service'
$backendDirectory = Join-Path $repoRoot 'apps/market-data'
$envFile = Join-Path $authDirectory '.env'
# The host-facing broker address every service defaults to, and the topics the
# Compose stack's kafka container creates.
$brokerPort = 29092
$tradeEventsTopic = 'trade-events'
$platformRecordsTopic = 'platform-records'

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

function Assert-DependenciesInstalled {
    param([Parameter(Mandatory)][string]$Project)

    # Each app is its own npm project. Without its node_modules the process
    # exits as soon as it starts and takes the rest of the stack down with it.
    $modules = Join-Path $repoRoot "apps/$Project/node_modules"
    if (-not (Test-Path -LiteralPath $modules -PathType Container)) {
        throw "Dependencies for apps/$Project are not installed. Run: npm --prefix apps/$Project ci"
    }
}

function Assert-PortAvailable {
    param([Parameter(Mandatory)][int]$Port)

    if (Test-PortListening -Port $Port) {
        throw "Port $Port is already in use. Stop the existing service before starting the local stack."
    }
}

function Test-PortOpen {
    param([Parameter(Mandatory)][int]$Port)

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        return $client.ConnectAsync('127.0.0.1', $Port).Wait(1000) -and $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

# Unlike Test-PortOpen this also sees a server that listens on IPv6 only, as a
# dev server bound to "localhost" can.
function Test-PortListening {
    param([Parameter(Mandatory)][int]$Port)

    # Avoid the Windows CIM provider, which can hang in Get-NetTCPConnection.
    # The OS listener table includes IPv4, IPv6 and wildcard bindings.
    $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    foreach ($listener in $listeners) {
        if ($listener.Port -eq $Port) {
            return $true
        }
    }
    return $false
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

Assert-DependenciesInstalled -Project 'auth-service'
Assert-DependenciesInstalled -Project 'client-ui'
Assert-DependenciesInstalled -Project 'reporting-ui'
if (-not $SkipReporting -and -not (Test-Path -LiteralPath $reportingPython -PathType Leaf)) {
    throw 'Dependencies for apps/reporting-service are not installed. Run: python -m venv apps/reporting-service/venv; apps/reporting-service/venv/Scripts/python -m pip install -r apps/reporting-service/requirements.txt (or pass -SkipReporting to start without reporting).'
}

$npm = Get-RequiredCommand -Name 'npm.cmd'
$maven = Get-RequiredCommand -Name 'mvn.cmd'
$pgIsReady = Get-RequiredCommand -Name 'pg_isready.exe'

# One database serves every service, auth included. The auth service owns
# user_accounts and refresh_tokens inside it and creates neither, so the
# migrations must already have been applied.
& $pgIsReady -h $dbHost -p $parsedDbPort -q
if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL is not accepting connections at ${dbHost}:${parsedDbPort}."
}

Assert-PortAvailable -Port 3001
Assert-PortAvailable -Port 4200
Assert-PortAvailable -Port 4300
Assert-PortAvailable -Port 8081
Assert-PortAvailable -Port 8082
if (-not $SkipReporting) {
    Assert-PortAvailable -Port 8083
}

# Events need a broker, and reporting has nothing else: it reads Kafka, not the
# database. Use the broker already listening, such as the Compose stack's kafka
# service; otherwise start one from -KafkaHome; otherwise run without events,
# which leaves the Reporting UI with whatever it had already consumed.
$brokerRunning = Test-PortOpen -Port $brokerPort
if ($KafkaHome) {
    if (-not (Test-Path -LiteralPath (Join-Path $KafkaHome 'libs') -PathType Container)) {
        throw "KafkaHome '$KafkaHome' is not a Kafka distribution: it has no libs directory."
    }
    $java = Get-RequiredCommand -Name 'java.exe'
    $kafkaClasspath = Join-Path $KafkaHome 'libs\*'
    $kafkaLogConfig = ([System.Uri](Join-Path $KafkaHome 'config\tools-log4j2.yaml')).AbsoluteUri
}
$eventsEnabled = $brokerRunning -or [bool]$KafkaHome

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
        [Parameter(Mandatory)][string]$WorkingDirectory,
        # Variables the process starts with; this shell's own values are restored.
        [hashtable]$Environment = @{},
        # Name shown in status lines, and the port that tells the console the
        # service is ready (0 when it has none).
        [string]$Label = $Name,
        [int]$Port = 0
    )

    $stdout = Join-Path $logDirectory "$Name.out.log"
    $stderr = Join-Path $logDirectory "$Name.err.log"
    $previous = @{}
    foreach ($variable in $Environment.Keys) {
        $previous[$variable] = [Environment]::GetEnvironmentVariable($variable, 'Process')
        [Environment]::SetEnvironmentVariable($variable, $Environment[$variable], 'Process')
    }
    try {
        $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList `
            -WorkingDirectory $WorkingDirectory -NoNewWindow -PassThru `
            -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        # Opening the handle now is what lets ExitCode be read after the process
        # has exited; without it the code comes back empty.
        $null = $process.Handle
    }
    finally {
        foreach ($variable in $previous.Keys) {
            [Environment]::SetEnvironmentVariable($variable, $previous[$variable], 'Process')
        }
    }

    return [pscustomobject]@{
        Name = $Name
        Label = $Label
        Port = $Port
        Process = $process
        Stdout = $stdout
        Stderr = $stderr
        StdoutLine = 0
        StderrLine = 0
    }
}

function Write-Status {
    param(
        [Parameter(Mandatory)][string]$State,
        [Parameter(Mandatory)][string]$Label,
        [string]$Detail = '',
        [ConsoleColor]$Color = 'Green'
    )

    Write-Host ('  {0,-9}' -f $State) -ForegroundColor $Color -NoNewline
    Write-Host ('{0,-26}{1}' -f $Label, $Detail)
}

# Lines worth showing when the raw logs are not streamed.
$errorLinePattern = '\b(ERROR|FATAL|SEVERE)\b|Exception in thread|Traceback \(most recent call last\)'

function Write-NewLogLines {
    param(
        [Parameter(Mandatory)]$Service,
        # Print only error lines; the position still moves past the rest.
        [switch]$ErrorsOnly
    )

    foreach ($stream in @('Stdout', 'Stderr')) {
        $path = $Service.$stream
        if (-not (Test-Path -LiteralPath $path)) {
            continue
        }
        $lines = @(Get-Content -LiteralPath $path)
        $offsetProperty = "${stream}Line"
        for ($index = $Service.$offsetProperty; $index -lt $lines.Count; $index++) {
            if (-not $ErrorsOnly -or $lines[$index] -match $errorLinePattern) {
                Write-Host "[$($Service.Name)] $($lines[$index])"
            }
        }
        $Service.$offsetProperty = $lines.Count
    }
}

function Show-LogTail {
    param([Parameter(Mandatory)]$Service, [int]$Lines = 40)

    foreach ($stream in @('Stderr', 'Stdout')) {
        $path = $Service.$stream
        if (-not (Test-Path -LiteralPath $path)) {
            continue
        }
        $tail = @(Get-Content -LiteralPath $path -Tail $Lines)
        if ($tail.Count -gt 0) {
            Write-Host "--- last $($tail.Count) lines of $($Service.Label) ($($stream.ToLower())) ---" -ForegroundColor DarkGray
            foreach ($line in $tail) {
                Write-Host "  $line"
            }
        }
    }
}

function Start-KafkaBroker {
    # A single-node KRaft broker on the Compose stack's host port, bound to
    # IPv4 loopback only. Its data is kept between runs: the reporting consumer
    # skips offsets it has already stored, so a broker that restarted from
    # offset 0 would lose it new events.
    $kafkaRoot = Join-Path $env:LOCALAPPDATA 'trading-season\kafka'
    $dataDirectory = Join-Path $kafkaRoot 'data'
    $configFile = Join-Path $kafkaRoot 'server.properties'
    New-Item -ItemType Directory -Force -Path $kafkaRoot | Out-Null
    $controllerPort = $brokerPort + 1
    @(
        'process.roles=broker,controller'
        'node.id=1'
        "controller.quorum.voters=1@127.0.0.1:$controllerPort"
        "listeners=PLAINTEXT://127.0.0.1:$brokerPort,CONTROLLER://127.0.0.1:$controllerPort"
        "advertised.listeners=PLAINTEXT://127.0.0.1:$brokerPort"
        'controller.listener.names=CONTROLLER'
        'inter.broker.listener.name=PLAINTEXT'
        'listener.security.protocol.map=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT'
        "log.dirs=$($dataDirectory.Replace('\', '/'))"
        'offsets.topic.replication.factor=1'
        'transaction.state.log.replication.factor=1'
        'transaction.state.log.min.isr=1'
        'share.coordinator.state.topic.replication.factor=1'
        'share.coordinator.state.topic.min.isr=1'
        'group.initial.rebalance.delay.ms=0'
        'auto.create.topics.enable=false'
        # Windows cannot rename the memory-mapped index files the log cleaner
        # swaps in, so the first compaction fails and Kafka shuts the broker
        # down. Compaction only saves disk here; the consumer tolerates the
        # extra duplicates.
        'log.cleaner.enable=false'
        # The same limit applies to retention: deleting a segment older than the
        # default seven days fails on its memory-mapped files, Kafka takes the
        # log directory offline and the broker shuts down. Keep everything.
        'log.retention.ms=-1'
    ) | Set-Content -LiteralPath $configFile -Encoding Ascii

    if (-not (Test-Path -LiteralPath (Join-Path $dataDirectory 'meta.properties') -PathType Leaf)) {
        $clusterId = & $java -cp $kafkaClasspath "-Dlog4j2.configurationFile=$kafkaLogConfig" `
            kafka.tools.StorageTool random-uuid | Select-Object -Last 1
        & $java -cp $kafkaClasspath "-Dlog4j2.configurationFile=$kafkaLogConfig" `
            kafka.tools.StorageTool format -t $clusterId -c $configFile | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Could not format Kafka storage in $dataDirectory."
        }
    }

    # Kafka renames an obsolete cluster-metadata snapshot to *.deleted and
    # removes it a minute later. When this script stops the broker inside that
    # minute the file is left behind, read-only, and Windows then refuses the
    # delete Kafka retries at the next start (AccessDeniedException), so the
    # broker never listens. These files are already marked for deletion.
    Get-ChildItem -LiteralPath $dataDirectory -Recurse -Filter '*.deleted' -File -Force -ErrorAction SilentlyContinue |
        ForEach-Object {
            $_.IsReadOnly = $false
            Remove-Item -LiteralPath $_.FullName -Force
        }

    $broker = Start-LocalService -Name 'kafka' -Label 'Kafka' -Port $brokerPort -FilePath $java -WorkingDirectory $kafkaRoot -ArgumentList @(
        '-Xmx512m', '-Xms256m', '-Djava.net.preferIPv4Stack=true', '-cp', "`"$kafkaClasspath`"",
        "`"-Dlog4j2.configurationFile=$kafkaLogConfig`"", 'kafka.Kafka', "`"$configFile`"")

    for ($attempt = 0; $attempt -lt 60 -and -not (Test-PortOpen -Port $brokerPort); $attempt++) {
        $broker.Process.Refresh()
        if ($broker.Process.HasExited) {
            break
        }
        Start-Sleep -Seconds 1
    }
    return $broker
}

function Confirm-Topics {
    # As the Compose stack's kafka container creates them. Three partitions each: one key's messages
    # share a partition and keep their order. platform-records is compacted,
    # because each message is the current state of one row and only the latest
    # per key is ever needed.
    $topics = @(
        @{ Name = $tradeEventsTopic; Config = @() }
        @{ Name = $platformRecordsTopic; Config = @('--config', 'cleanup.policy=compact') }
    )
    foreach ($topic in $topics) {
        & $java -cp $kafkaClasspath "-Dlog4j2.configurationFile=$kafkaLogConfig" `
            org.apache.kafka.tools.TopicCommand --bootstrap-server "127.0.0.1:$brokerPort" `
            --create --if-not-exists --topic $topic.Name --partitions 3 --replication-factor 1 `
            @($topic.Config) | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Could not create the $($topic.Name) topic on localhost:$brokerPort."
        }
    }
}

$startedAt = [System.Diagnostics.Stopwatch]::StartNew()
try {
    Write-Host 'Trading Season local stack'
    if ($ShowLogs) {
        Write-Host "  Logs stream below; they are also in $logDirectory"
    }
    else {
        Write-Host "  Logs: $logDirectory (removed on exit; -ShowLogs streams them here)" -ForegroundColor DarkGray
    }
    Write-Host ''
    Write-Status -State 'ready' -Label 'PostgreSQL' -Detail "${dbHost}:${parsedDbPort}"

    if ($KafkaHome) {
        if ($brokerRunning) {
            Write-Status -State 'ready' -Label 'Kafka' -Detail "localhost:$brokerPort (already running)"
        }
        else {
            Write-Status -State 'starting' -Label 'Kafka' -Detail "broker from $KafkaHome" -Color Yellow
            $broker = Start-KafkaBroker
            $processes += $broker
            if (-not (Test-PortOpen -Port $brokerPort)) {
                Show-LogTail -Service $broker
                throw "The Kafka broker did not start listening on localhost:$brokerPort."
            }
            Write-Status -State 'ready' -Label 'Kafka' -Detail "localhost:$brokerPort"
        }
        Confirm-Topics
    }
    elseif ($brokerRunning) {
        Write-Status -State 'ready' -Label 'Kafka' -Detail "localhost:$brokerPort (already running)"
    }
    else {
        Write-Status -State 'off' -Label 'Kafka' -Detail "no broker on localhost:$brokerPort; events are off (pass -KafkaHome, see README.md)" -Color Yellow
    }

    # The auth service publishes every sign-in it changes for reporting. By
    # address: its Kafka client may try IPv6 first for "localhost" and the
    # broker listens on IPv4 only. Without a broker it must not try at all.
    $authEnvironment = @{ KAFKA_BOOTSTRAP_SERVERS = "127.0.0.1:$brokerPort" }
    if (-not $eventsEnabled -and [string]::IsNullOrWhiteSpace($env:EVENTS_ENABLED)) {
        $authEnvironment.EVENTS_ENABLED = 'false'
    }
    $processes += Start-LocalService -Name 'auth' -Label 'Auth service' -Port 3001 -FilePath $npm `
        -ArgumentList @('run', 'start:dev') -WorkingDirectory $authDirectory -Environment $authEnvironment

    $businessEnvironment = @{
        SPRING_DATASOURCE_PASSWORD = $businessPassword
        # Ensure Java services connect to trading_season database
        SPRING_DATASOURCE_URL = "jdbc:postgresql://${dbHost}:${parsedDbPort}/trading_season"
    }
    if (-not $eventsEnabled -and [string]::IsNullOrWhiteSpace($env:APP_EVENTS_ENABLED)) {
        # Without a broker the Java services would wait on one at every order.
        $businessEnvironment.APP_EVENTS_ENABLED = 'false'
    }
    $processes += Start-LocalService -Name 'holdings-and-trade' -Label 'Holdings and Trade' -Port 8082 -FilePath $maven `
        -ArgumentList @('spring-boot:run') -WorkingDirectory $holdingsDirectory -Environment $businessEnvironment

    $processes += Start-LocalService -Name 'order-and-sell' -Label 'Order and Sell' -Port 8081 -FilePath $maven `
        -ArgumentList @('spring-boot:run') -WorkingDirectory $orderDirectory -Environment $businessEnvironment

    if (-not $SkipReporting) {
        # No database setting: reporting is given a broker and nothing else.
        $reportingEnvironment = @{
            AUTH_SERVICE_URL = 'http://localhost:3001'
            AUTH_JWT_ISSUER = $issuer
            FLASK_ENV = 'development'
            REPORTING_SERVICE_HOST = '127.0.0.1'
            SCHEDULER_INTERVAL_MINUTES = "$ReportIntervalMinutes"
            # By address: the Kafka client tries IPv6 first for "localhost" and
            # waits out a timeout when the broker listens on IPv4 only.
            KAFKA_BOOTSTRAP_SERVERS = "127.0.0.1:$brokerPort"
            PYTHONUNBUFFERED = '1'
        }
        # Both processes run from the service directory, so they share its
        # default files directory, data/reporting.
        $processes += Start-LocalService -Name 'reporting' -Label 'Reporting service' -Port 8083 -FilePath $reportingPython `
            -ArgumentList @('app.py') -WorkingDirectory $reportingDirectory -Environment $reportingEnvironment

        if ($eventsEnabled) {
            $processes += Start-LocalService -Name 'reporting-consumer' -Label 'Reporting consumer' -FilePath $reportingPython `
                -ArgumentList @('consumer.py') -WorkingDirectory $reportingDirectory -Environment $reportingEnvironment
        }
    }
    else {
        Write-Status -State 'skipped' -Label 'Reporting service' -Detail 'the reporting UI signs in but cannot load a report' -Color Yellow
    }

    $processes += Start-LocalService -Name 'ui' -Label 'Client UI' -Port 4200 -FilePath $npm `
        -ArgumentList @('start') -WorkingDirectory $clientUiDirectory

    # Serves on 4300 and proxies /auth to the auth service and /api/reporting to
    # the Reporting Service, both started above.
    $processes += Start-LocalService -Name 'reporting-ui' -Label 'Reporting UI' -Port 4300 -FilePath $npm `
        -ArgumentList @('start') -WorkingDirectory $reportingUiDirectory

    Write-Host ''
    Write-Host 'Starting services (the first start compiles the apps and can take a minute or two)...'

    # Services still to report ready; a service without a port is ready once it
    # is running. Ports are probed once a second, logs scanned every two.
    $pending = @($processes | Where-Object { $_.Name -ne 'kafka' })
    $probeClock = [System.Diagnostics.Stopwatch]::StartNew()
    $logClock = [System.Diagnostics.Stopwatch]::StartNew()
    while ($true) {
        foreach ($service in $processes) {
            if ($ShowLogs) {
                Write-NewLogLines -Service $service
            }
            $service.Process.Refresh()
            if ($service.Process.HasExited) {
                if (-not $ShowLogs) {
                    Show-LogTail -Service $service
                }
                throw "$($service.Label) exited with code $($service.Process.ExitCode)."
            }
        }

        if (-not $ShowLogs -and $logClock.ElapsedMilliseconds -ge 2000) {
            $logClock.Restart()
            foreach ($service in $processes) {
                Write-NewLogLines -Service $service -ErrorsOnly
            }
        }

        if ($pending.Count -gt 0 -and $probeClock.ElapsedMilliseconds -ge 1000) {
            $probeClock.Restart()
            foreach ($service in @($pending)) {
                if (-not $service.Port -or (Test-PortListening -Port $service.Port)) {
                    $detail = if ($service.Port) { "http://localhost:$($service.Port)" } else { 'running' }
                    Write-Status -State 'ready' -Label $service.Label -Detail $detail
                    $pending = @($pending | Where-Object { $_ -ne $service })
                }
            }
            if ($pending.Count -eq 0) {
                Write-Host ''
                Write-Host ("All services ready in {0:N0}s. Press Ctrl+C to stop them." -f $startedAt.Elapsed.TotalSeconds) -ForegroundColor Green
                if ($eventsEnabled -and -not $SkipReporting) {
                    Write-Host "Anything the services publish from now on reaches the reporting console within seconds and its report within $ReportIntervalMinutes minute(s). History written earlier, or by SQL, needs db/tools/republish_history.py once (see db/README.md)." -ForegroundColor DarkGray
                }
                elseif (-not $eventsEnabled) {
                    Write-Host 'Events are off, so the reporting UI shows nothing new: no report, or the last one written, and the console as it last stood.' -ForegroundColor Yellow
                }
            }
        }
        Start-Sleep -Milliseconds 250
    }
}
finally {
    # Newest first, so the broker outlives the services that talk to it.
    if ($processes.Count -gt 0) {
        Write-Host ''
        Write-Host 'Stopping services...'
    }
    [array]::Reverse($processes)
    foreach ($service in $processes) {
        if ($ShowLogs) {
            Write-NewLogLines -Service $service
        }
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
