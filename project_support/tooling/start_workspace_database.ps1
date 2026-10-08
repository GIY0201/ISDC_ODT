$ErrorActionPreference = 'Stop'
$databaseRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$databaseBin = Join-Path $databaseRoot 'project_support/tooling/postgresql/pgsql/bin/pg_ctl.exe'
$databaseData = Join-Path $databaseRoot 'data/workspace/postgresql/cluster'
$databaseLog = Join-Path $databaseRoot 'data/workspace/postgresql/server.log'
& $databaseBin -D $databaseData status *> $null
if ($LASTEXITCODE -ne 0) { & $databaseBin -D $databaseData -l $databaseLog -w start; if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL start failed' } }
