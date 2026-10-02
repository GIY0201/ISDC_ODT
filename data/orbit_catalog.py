"""Explicit local manifest load, path confinement and source integrity."""
from dataclasses import dataclass
from pathlib import Path
import json
from digital_twin.contracts.orbit import OrbitInput
from data.orbit_inputs import load_orbit_input
from data.earth_orientation import EarthOrientationSnapshot

@dataclass(frozen=True)
class StoredOrbitBundle:
    inputs: tuple[OrbitInput,...]
    eop: EarthOrientationSnapshot

def _local(root,name):
    if not isinstance(name,str) or not name or Path(name).is_absolute():raise ValueError('invalid bundle path')
    path=(root/name).resolve()
    if not path.is_relative_to(root):raise ValueError('bundle file outside manifest directory')
    return path

def load_stored_orbit(manifest_path):
    manifest_path=Path(manifest_path).resolve();root=manifest_path.parent
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    if not isinstance(manifest,dict) or type(manifest.get('version')) is not int or manifest.get('version')!=1 or not isinstance(manifest.get('inputs'),list) or not 1<=len(manifest['inputs'])<=2:raise ValueError('unsupported orbit manifest')
    records=[]
    for item in manifest['inputs']:
        records.append(load_orbit_input(_local(root,item['file']),format=item['format'],source=item['source'],fetched_utc=item['fetched_utc'],expected_sha256=item['sha256']))
    if len({r.format for r in records})!=len(records) or len({r.input_id for r in records})!=len(records) or {r.satellite_id for r in records}!={25544}:raise ValueError('first bundle requires one ISS in distinct formats')
    correction=manifest['earth_orientation']
    eop=EarthOrientationSnapshot.load(_local(root,correction['eop_file']),_local(root,correction['leap_file']),eop_sha256=correction['eop_sha256'],leap_sha256=correction['leap_sha256'])
    return StoredOrbitBundle(tuple(records),eop)
