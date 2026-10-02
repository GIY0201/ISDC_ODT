# Dot-source this script to activate only the current PowerShell process.
$taskRustRoot = Join-Path $PSScriptRoot 'rust_env'
$env:CARGO_HOME = Join-Path $taskRustRoot 'cargo'
$env:RUSTUP_HOME = Join-Path $taskRustRoot 'rustup'
$env:CARGO_TARGET_DIR = Join-Path $taskRustRoot 'target'
$taskVsWhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
if (-not (Test-Path -LiteralPath $taskVsWhere)) { throw 'Visual Studio Build Tools locator unavailable' }
$taskVsPath = & $taskVsWhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $taskVsPath) { throw 'MSVC Build Tools unavailable' }
& (Join-Path $taskVsPath 'Common7/Tools/Launch-VsDevShell.ps1') -Arch amd64 -HostArch amd64 -SkipAutomaticLocation
if (-not (Test-Path -LiteralPath (Join-Path $env:CARGO_HOME 'bin/rustc.exe'))) { throw 'Project Rust toolchain unavailable' }
$env:PATH = (Join-Path $env:CARGO_HOME 'bin') + ';' + $env:PATH
