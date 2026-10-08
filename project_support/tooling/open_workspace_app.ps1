param([ValidateRange(1,120)][int]$StartupTimeoutSeconds=30)
$ErrorActionPreference='Stop'
$baseUrl='http://127.0.0.1:8891'
function Read-WorkspaceHealth {
    $health=Invoke-RestMethod -Uri ($baseUrl+'/api/health') -TimeoutSec 2
    if ($health.status -ne 'ok' -or $health.name -ne 'SpaceTwin VVP') { throw 'Port 8891 belongs to an unexpected application. No process was stopped.' }
    $database=Invoke-RestMethod -Uri ($baseUrl+'/api/workspace/configurations/status') -TimeoutSec 2
    if (-not $database.enabled -or $database.provider -ne 'postgresql') { throw 'Web server is running without PostgreSQL configuration storage.' }
    $definition=Invoke-RestMethod -Uri ($baseUrl+'/api/workspace/configurations/ground_stations') -TimeoutSec 2
    if ($definition.kind -ne 'ground_stations') { throw 'PostgreSQL configuration read failed.' }
}
$startupLock=New-Object System.Threading.Mutex($false,'Local\ISDC8891WorkspaceStart')
$lockHeld=$false
try {
    $lockHeld=$startupLock.WaitOne(0)
    if (-not $lockHeld) { throw 'Another server startup is in progress. Try again shortly.' }
    $listeners=@(Get-NetTCPConnection -State Listen -LocalPort 8891 -ErrorAction SilentlyContinue)
    if ($listeners.Count -gt 0) {
        Read-WorkspaceHealth
        Write-Host 'ISDC server is already running. No duplicate process was started.'
    } else {
        Write-Host 'Starting PostgreSQL and ISDC web server...'
        & (Join-Path $PSScriptRoot 'start_workspace_app.ps1')
        $ready=$false
        $deadline=(Get-Date).AddSeconds($StartupTimeoutSeconds)
        do {
            try { Read-WorkspaceHealth; $ready=$true; break } catch { $lastStartupError=$_.Exception.Message }
            Start-Sleep -Milliseconds 500
        } while ((Get-Date) -lt $deadline)
        if (-not $ready) { throw ('Server startup did not become ready: '+$lastStartupError+'. See data/workspace/postgresql/application-error.log') }
        Write-Host 'ISDC server is ready. Closing this launcher does not stop the server.'
    }
    Write-Host 'Open: http://103.218.163.201:8891/'
} finally {
    if ($lockHeld) { $startupLock.ReleaseMutex() }
    $startupLock.Dispose()
}
