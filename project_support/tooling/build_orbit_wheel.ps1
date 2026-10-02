# Build from the actual product manifest. Research probe is never installed here.
[CmdletBinding()]
param([string]$PythonPath,[switch]$CheckOnly)
$ErrorActionPreference='Stop'
$taskProject=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if(!$PythonPath){$PythonPath=Join-Path $taskProject 'project_support/.venv/Scripts/python.exe'}
$taskManifest=Join-Path $taskProject 'digital_twin/simulation/orbit_propagation/Cargo.toml'
$taskOutput=Join-Path $taskProject 'project_support/tooling/orbit_wheels'
$taskTarget=Join-Path $taskProject 'project_support/tooling/rust_env/target'
if(!(Test-Path -LiteralPath $PythonPath)){throw 'Project Python is not installed'}
if(!(Test-Path -LiteralPath $taskManifest)){throw 'Product Rust manifest is not implemented yet; do not build the research probe as a product'}
if($CheckOnly){Write-Output 'Product manifest and Python paths exist';return}
. (Join-Path $PSScriptRoot 'use_rust_environment.ps1')
$env:CARGO_TARGET_DIR=$taskTarget
& $PythonPath -m maturin --version
if($LASTEXITCODE -ne 0){throw 'Install the pinned wheel build dependencies in the chosen build environment'}
New-Item -ItemType Directory -Force $taskOutput | Out-Null
& $PythonPath -m maturin build --release --locked --manifest-path $taskManifest --interpreter $PythonPath --out $taskOutput --auditwheel repair
if($LASTEXITCODE -ne 0){throw 'Product wheel build failed'}
Get-ChildItem -LiteralPath $taskOutput -Filter '*.whl' | Get-FileHash -Algorithm SHA256
