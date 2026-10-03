"""Versioned official announcement snapshot; never live reception evidence."""
import hashlib
import json
import math
from datetime import date, datetime
from pathlib import Path


PACKAGE = Path(__file__).resolve().parent / 'packages' / 'iss_aprs_receive_v1'


def load_iss_receive_profile(package: Path = PACKAGE) -> dict:
    """Read on explicit query, returning a fresh copy; no import-time IO."""
    try:
        profile = json.loads((package / 'profile.json').read_text(encoding='utf-8'))
        manifest = json.loads((package / 'manifest.json').read_text(encoding='utf-8'))
        canonical = json.dumps(profile, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')
        digest = hashlib.sha256(canonical).hexdigest()
        if manifest != {'schema_version': 1, 'profile_id': 'iss_aprs_receive_v1', 'profile_sha256': digest}:
            raise ValueError('manifest mismatch')
        expected = {'schema_version': 1, 'profile_id': 'iss_aprs_receive_v1', 'satellite_catalog_number': 25544,
                    'service': 'APRS', 'station': 'RS0ISS', 'direction': 'receive_only',
                    'communication_status': 'unknown', 'equipment_status': 'not_selected'}
        if any(profile.get(key) != value for key, value in expected.items()):
            raise ValueError('profile identity/status mismatch')
        source = profile['source']
        if source['url'] != 'https://www.ariss.org/current-status-of-iss-stations.html':
            raise ValueError('unsupported source')
        published = date.fromisoformat(source['status_as_of'])
        checked = datetime.fromisoformat(source['checked_utc'].replace('Z', '+00:00'))
        if not source['checked_utc'].endswith('Z') or published > checked.date():
            raise ValueError('invalid source time')
        mhz = profile['frequency_mhz']
        known = profile['known_inputs']
        if set(known) != {'frequency_ghz'} or type(mhz) not in (float, int) or not math.isfinite(mhz) or not 100 < mhz <= 300000 or type(known['frequency_ghz']) not in (float, int) or not math.isclose(known['frequency_ghz'], mhz / 1000, rel_tol=0, abs_tol=1e-12):
            raise ValueError('invalid confirmed frequency')
        if not isinstance(profile['source_report'], str) or not isinstance(profile['notes'], list) or not all(isinstance(note, str) for note in profile['notes']):
            raise ValueError('invalid source description')
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
        raise ValueError('ISS 수신 조건 패키지가 없거나 손상되었습니다.') from exc
    return {**profile, 'profile_sha256': digest}
