"""Explicit IERS-A snapshot loader; independent from historical stored orbit bundle."""
import json,re
from pathlib import Path
from data.earth_orientation import EarthOrientationSnapshot

def load_geometry_snapshot(manifest_path):
    path=Path(manifest_path).resolve();root=path.parent;m=json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(m,dict) or type(m.get('version')) is not int or m.get('version')!=1 or m.get('table_kind')!='IERS_A':raise ValueError('unsupported catalog EOP manifest')
    if any(not isinstance(m.get(key),str) or re.fullmatch(r'[a-fA-F0-9]{64}',m[key]) is None for key in ('eop_sha256','leap_sha256')):raise ValueError('invalid EOP snapshot hash')
    def local(name):
        if not isinstance(name,str) or not name or Path(name).is_absolute():raise ValueError('invalid EOP path')
        value=(root/name).resolve()
        if not value.is_relative_to(root):raise ValueError('EOP path outside manifest')
        return value
    return EarthOrientationSnapshot.load(local(m['eop_file']),local(m['leap_file']),eop_sha256=m['eop_sha256'],leap_sha256=m['leap_sha256'],table_kind='IERS_A')
