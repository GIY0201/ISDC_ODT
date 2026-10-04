"""Capture bundled official IERS-A/UTC snapshot, never overwrite an existing manifest."""
import hashlib,json,shutil
from pathlib import Path
from datetime import datetime,timezone

def prepare(root):
    import astropy_iers_data as files
    root=Path(root)
    if (root/'manifest.json').exists():raise FileExistsError('catalog EOP snapshot already exists')
    root.mkdir(parents=True,exist_ok=True)
    a=Path(files.IERS_A_FILE);leap=Path(files.IERS_LEAP_SECOND_FILE)
    for source in (a,leap):
        target=root/source.name
        if target.exists():raise FileExistsError(target)
        shutil.copyfile(source,target)
    manifest={'version':1,'table_kind':'IERS_A','eop_file':a.name,'leap_file':leap.name,'eop_sha256':hashlib.sha256(a.read_bytes()).hexdigest(),'leap_sha256':hashlib.sha256(leap.read_bytes()).hexdigest(),'source':'https://datacenter.iers.org/data/9/finals2000A.all','distribution':'astropy-iers-data '+files.__version__,'captured_utc':datetime.now(timezone.utc).isoformat()}
    path=root/'manifest.json';path.write_text(json.dumps(manifest,indent=2),encoding='utf-8');return path
if __name__=='__main__':
    from user_application.configs.catalog_geometry import CATALOG_GEOMETRY_MANIFEST
    print(prepare(CATALOG_GEOMETRY_MANIFEST.parent))
