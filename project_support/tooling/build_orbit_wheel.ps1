# Build from the actual product manifest. Research probe is never installed here.
[CmdletBinding()]
param([string]$PythonPath,[switch]$CheckOnly)
$ErrorActionPreference='Stop'
$taskProject=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if(!$PythonPath){$PythonPath=Join-Path $taskProject 'project_support/.venv/Scripts/python.exe'}
$taskManifest=Join-Path $taskProject 'digital_twin/simulation/orbit_propagation/Cargo.toml'
$taskOutput=Join-Path $taskProject ('project_support/tooling/orbit_wheels/'+(Get-Date -Format 'yyyyMMdd_HHmmss_fff'))
$taskTarget=Join-Path $taskProject 'project_support/tooling/rust_env/target'
if(!(Test-Path -LiteralPath $PythonPath)){throw 'Project Python is not installed'}
if(!(Test-Path -LiteralPath $taskManifest)){throw 'Product Rust manifest is not implemented yet; do not build the research probe as a product'}
if($CheckOnly){Write-Output 'Product manifest and Python paths exist';return}
. (Join-Path $PSScriptRoot 'use_rust_environment.ps1')
$env:CARGO_TARGET_DIR=$taskTarget
& $PythonPath -m maturin --version
if($LASTEXITCODE -ne 0){throw 'Install the pinned wheel build dependencies in the chosen build environment'}
$taskMaturin=& $PythonPath -m maturin --version
if($taskMaturin -ne 'maturin 1.15.0'){throw 'This build receipt requires pinned maturin 1.15.0'}
$taskPythonBase=& $PythonPath -c 'import sys; print(sys.base_prefix)'
if($LASTEXITCODE -ne 0){throw 'Cannot resolve build interpreter origin'}
# Prefer the chosen interpreter's own dependencies over unrelated app DLLs on PATH.
$env:PATH=$taskPythonBase+';'+(Join-Path $taskPythonBase 'Library/bin')+';'+$env:PATH
New-Item -ItemType Directory -Force $taskOutput | Out-Null
& $PythonPath -m maturin build --release --locked --manifest-path $taskManifest --interpreter $PythonPath --out $taskOutput --auditwheel repair
if($LASTEXITCODE -ne 0){throw 'Product wheel build failed'}
# Repair can bundle a dependency of the interpreter DLL. Verify every copied DLL
# against its installed package and retain its license before publishing a wheel.
$taskReceiptCode=@'
import base64,csv,hashlib,io,json,pathlib,subprocess,sys,zipfile
output=pathlib.Path(sys.argv[1]); manifest=pathlib.Path(sys.argv[2])
wheel=next(output.glob('*.whl')); base=pathlib.Path(sys.base_prefix)
sha=lambda data:hashlib.sha256(data).hexdigest()
with zipfile.ZipFile(wheel) as archive:
    entries={name:archive.read(name) for name in archive.namelist()}
info=next(name.rsplit('/',1)[0] for name in entries if name.endswith('/WHEEL'))
assert b'Tag: cp314-cp314-win_amd64' in entries[info+'/WHEEL'], 'Only CPython 3.14 Windows x64 has been validated'
provenance=[]
for name,payload in list(entries.items()):
    if not name.lower().endswith('.dll'): continue
    assert '/zlib-' in name, f'Unreviewed bundled DLL: {name}'
    records=list((base/'conda-meta').glob('libzlib-*.json'))
    assert len(records)==1, 'libzlib provenance requires the exact installed package receipt'
    package=json.loads(records[0].read_text(encoding='utf-8'))
    candidates=[base/path for path in package['files'] if path.lower().endswith('zlib.dll')]
    source=next((path for path in candidates if path.exists() and sha(path.read_bytes())==sha(payload)),None)
    assert source is not None, 'Bundled DLL differs from installed libzlib package'
    cache=base/'pkgs'/f"{package['name']}-{package['version']}-{package['build']}"
    license_file=cache/'info/licenses/LICENSE'
    license_bytes=license_file.read_bytes()
    assert package['license']=='Zlib' and b'Permission is granted' in license_bytes
    entries[info+'/licenses/libzlib_LICENSE.txt']=license_bytes
    provenance.append({'wheel_member':name,'dll_sha256':sha(payload),'source':str(source),
       'package_url':package['url'],'package_sha256':package['sha256'],'license':'Zlib',
       'license_sha256':sha(license_bytes)})
record=info+'/RECORD'; entries.pop(record)
rows=[]
for name,payload in entries.items():
    digest=base64.urlsafe_b64encode(hashlib.sha256(payload).digest()).decode().rstrip('=')
    rows.append([name,'sha256='+digest,str(len(payload))])
rows.append([record,'','']); stream=io.StringIO();csv.writer(stream,lineterminator='\n').writerows(rows)
entries[record]=stream.getvalue().encode()
with zipfile.ZipFile(wheel,'w',zipfile.ZIP_DEFLATED) as archive:
    for name,payload in entries.items(): archive.writestr(name,payload)
with zipfile.ZipFile(wheel) as archive:
    pyd=next(name for name in entries if name.endswith('.pyd'))
    binary=output/pathlib.Path(pyd).name;binary.write_bytes(archive.read(pyd))
imports=subprocess.run(['dumpbin','/dependents',str(binary)],check=True,capture_output=True,text=True).stdout
(output/'native_dependencies.txt').write_text(imports,encoding='utf-8')
metadata=json.loads(subprocess.run(['cargo','metadata','--locked','--offline','--format-version','1','--manifest-path',str(manifest)],check=True,capture_output=True,text=True).stdout)
licenses=[{'name':p['name'],'version':p['version'],'license':p['license'],'source':p['source']} for p in metadata['packages']]
receipt={'python':sys.version,'platform':sys.platform,'base_prefix':str(base),'wheel':wheel.name,
 'wheel_sha256':sha(wheel.read_bytes()),'manifest_sha256':sha(manifest.read_bytes()),
 'cargo_lock_sha256':sha(manifest.with_name('Cargo.lock').read_bytes()),'bundled_dlls':provenance,
 'rust_packages':licenses,'native_dependencies':imports,
 'support':'Local CPython 3.14 Windows x64 only; other PCs and free-threaded Python unverified'}
(output/'build_receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
print(json.dumps({'wheel':str(wheel),'sha256':receipt['wheel_sha256'],'bundled_dlls':provenance}))
'@
& $PythonPath -c $taskReceiptCode $taskOutput $taskManifest
if($LASTEXITCODE -ne 0){throw 'Wheel DLL provenance/license receipt failed; do not publish this output'}
Get-ChildItem -LiteralPath $taskOutput -Filter '*.whl' | Get-FileHash -Algorithm SHA256
