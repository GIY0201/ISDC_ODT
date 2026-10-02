"""Browser projection must use the same frozen leap table as the server."""
import hashlib
import json
from pathlib import Path
import re
import astropy_iers_data
from astropy.utils import iers

def test_browser_leap_offsets_match_frozen_server_snapshot():
    root=Path(__file__).parents[2]
    source=(root/'user_application/web/scripts/orbit_utc.js').read_text(encoding='utf-8')
    expected=re.search(r"LEAP_SHA256='([0-9a-f]{64})'",source).group(1)
    assert hashlib.sha256(Path(astropy_iers_data.IERS_LEAP_SECOND_FILE).read_bytes()).hexdigest()==expected
    browser=json.loads(re.search(r'LEAP_OFFSETS=(\[.*\]);',source).group(1))
    table=iers.LeapSeconds.open(astropy_iers_data.IERS_LEAP_SECOND_FILE)
    reference=[[int(r['year']),int(r['month']),int(r['tai_utc'])] for r in table if int(r['year'])>=1972]
    assert browser==reference
