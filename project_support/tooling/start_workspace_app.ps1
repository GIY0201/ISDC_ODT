param([string]$ResumePath)
$ErrorActionPreference = 'Stop'
$applicationRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (Get-NetTCPConnection -State Listen -LocalPort 8891 -ErrorAction SilentlyContinue) { throw 'Existing 8891 application must be preserved or explicitly stopped first.' }
& (Join-Path $PSScriptRoot 'start_workspace_database.ps1')
$env:ISDC_DATABASE_CONFIG = Join-Path $applicationRoot 'data/workspace/postgresql/connection.json'
$applicationFactory = 'user_application.web.application:create_stored_orbit_app'
if ($ResumePath) { $env:ISDC_DEV_RESUME_PATH = (Resolve-Path $ResumePath).Path; $applicationFactory = 'project_support.tooling.resume_development_app:create_app' }
$applicationPython = Join-Path $applicationRoot 'project_support/.venv/Scripts/python.exe'
Start-Process -FilePath $applicationPython -ArgumentList @('-m','uvicorn',$applicationFactory,'--factory','--host','0.0.0.0','--port','8891') -WorkingDirectory $applicationRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $applicationRoot 'data/workspace/postgresql/application.log') -RedirectStandardError (Join-Path $applicationRoot 'data/workspace/postgresql/application-error.log')
