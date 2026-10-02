"""Product wheel installation, isolated from project imports and existing site packages."""
import base64
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid
import zipfile

ROOT = Path(__file__).resolve().parents[2]


def product_wheel():
    configured = os.environ.get("ISDC_ORBIT_INSTALL_WHEEL")
    if configured:
        return Path(configured).resolve()
    candidates = sorted((ROOT / "project_support/tooling/orbit_wheels").rglob("*.whl"),
                        key=lambda path: path.stat().st_mtime)
    assert candidates, "Build the product wheel before installation validation"
    return candidates[-1]


def test_product_wheel_tag_record_and_bundled_dll_license():
    with zipfile.ZipFile(product_wheel()) as archive:
        names = archive.namelist()
        wheel = next(name for name in names if name.endswith("/WHEEL"))
        assert b"Tag: cp314-cp314-win_amd64" in archive.read(wheel)
        record = next(name for name in names if name.endswith("/RECORD"))
        for name, digest, size in csv.reader(io.StringIO(archive.read(record).decode())):
            if not digest:
                assert name == record
                continue
            payload = archive.read(name)
            assert digest == "sha256=" + base64.urlsafe_b64encode(hashlib.sha256(payload).digest()).decode().rstrip("=")
            assert int(size) == len(payload)
        dlls = [name for name in names if name.lower().endswith(".dll")]
        assert dlls, "This CPython build requires the repaired libzlib dependency"
        assert all("/zlib-" in name for name in dlls), "Unreviewed bundled DLL"
        license_name = next((name for name in names if name.endswith("/licenses/libzlib_LICENSE.txt")), None)
        assert license_name, "Bundled libzlib must retain its license"
        assert b"Permission is granted" in archive.read(license_name)


def test_product_native_call_in_clean_venv(tmp_path):
    assert sys.version_info[:2] == (3, 14) and sys.platform == "win32"
    env_path = tmp_path / "isolated"
    subprocess.run([sys.executable, "-m", "venv", str(env_path)], check=True, timeout=60)
    python = env_path / "Scripts/python.exe"
    subprocess.run([str(python), "-m", "pip", "install", "--no-index", "--no-deps",
                    str(product_wheel())], check=True, capture_output=True, timeout=60)
    case = __import__("tomllib").loads((ROOT / "project_support/tests/fixtures/orbit/sgp4_test_cases.toml").read_text(encoding="utf-8"))["list"][0]
    expected = next(state for state in case["states"] if "position" in state)
    code = """
import json, pathlib, struct, sys
import isdc_orbit_propagation as native
case=json.loads(sys.argv[1]); sample=json.loads(sys.argv[2])
assert pathlib.Path(native.__file__).is_relative_to(pathlib.Path(sys.prefix))
assert sys.prefix != sys.base_prefix
assert native.calculation_profile == 'WGS72_AFSPC'
buffer, errors=native.propagate_tle(case['line1'], case['line2'], [sample['time']])
assert isinstance(buffer, bytes) and errors == [None]
row=struct.unpack('<6d', buffer)
assert all(abs(a-b)<=1e-6 for a,b in zip(row[:3],sample['position']))
assert all(abs(a-b)<=1e-9 for a,b in zip(row[3:],sample['velocity']))
try: native.propagate_tle('bad','bad',[0.])
except ValueError: pass
else: raise AssertionError('invalid TLE accepted')
print(json.dumps({'python':sys.version,'native_file':native.__file__,'profile':native.calculation_profile,'row':row}))
"""
    tle = {key: case[key] for key in ("line1", "line2")}
    sample = {key: expected[key] for key in ("time", "position", "velocity")}
    result = subprocess.run([str(python), "-I", "-c", code, json.dumps(tle), json.dumps(sample)],
                            cwd=tmp_path, check=True, capture_output=True, text=True, timeout=30)
    receipt = json.loads(result.stdout)
    assert receipt["profile"] == "WGS72_AFSPC"
    receipt["wheel"] = str(product_wheel())
    receipt["wheel_sha256"] = hashlib.sha256(product_wheel().read_bytes()).hexdigest()
    destination = ROOT / "data/workspace/validation/install" / uuid.uuid4().hex
    destination.mkdir(parents=True)
    (destination / "isolated_call.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
