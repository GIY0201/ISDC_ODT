"""Explicit, hash-checked Earth orientation snapshot. No auto-download."""
from dataclasses import dataclass,field
import hashlib
from pathlib import Path
import numpy as np
from astropy import units as u
from astropy.utils import iers
from digital_twin.contracts.orbit import EarthOrientationPoint
from foundation.orbit_time import UtcInstant

@dataclass(frozen=True)
class EarthOrientationSnapshot:
    eop_sha256: str
    leap_sha256: str
    _table: object=field(repr=False,compare=False)

    @classmethod
    def load(cls,eop_path,leap_path,*,eop_sha256,leap_sha256):
        for path,digest in [(eop_path,eop_sha256),(leap_path,leap_sha256)]:
            if hashlib.sha256(Path(path).read_bytes()).hexdigest()!=digest.lower():raise ValueError('Earth orientation hash mismatch')
        # Explicit initialization of static time-scale data, never at import time.
        iers.LeapSeconds.open(str(leap_path)).update_erfa_leap_seconds(initialize_erfa=True)
        return cls(eop_sha256.lower(),leap_sha256.lower(),iers.IERS_B.open(str(eop_path)))

    def at(self,instant:UtcInstant)->EarthOrientationPoint:
        time=instant.as_time()
        if not np.isfinite(time.jd):raise ValueError('nonfinite UTC')
        value,status=self._table.ut1_utc(time,return_status=True)
        if int(status)<0:raise ValueError('UTC outside EOP snapshot range')
        xp,yp=self._table.pm_xy(time)
        return EarthOrientationPoint(float(value.to_value(u.s)),float(xp.to_value(u.rad)),float(yp.to_value(u.rad)),self.eop_sha256,self.leap_sha256)
