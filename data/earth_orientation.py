"""Explicit, hash-checked Earth orientation snapshot. No auto-download."""
from dataclasses import dataclass,field
import hashlib
import math
from pathlib import Path
import numpy as np
from astropy import units as u
from astropy.time import Time
from astropy.utils import iers
from digital_twin.contracts.orbit import EarthOrientationPoint,EarthOrientationVector
from foundation.orbit_time import UtcInstant

@dataclass(frozen=True)
class EarthOrientationSnapshot:
    eop_sha256: str
    leap_sha256: str
    _table: object=field(repr=False,compare=False)

    @classmethod
    def load(cls,eop_path,leap_path,*,eop_sha256,leap_sha256,table_kind="IERS_B"):
        if table_kind not in ("IERS_B","IERS_A"):raise ValueError("unsupported EOP table kind")
        for path,digest in [(eop_path,eop_sha256),(leap_path,leap_sha256)]:
            if hashlib.sha256(Path(path).read_bytes()).hexdigest()!=digest.lower():raise ValueError('Earth orientation hash mismatch')
        # Explicit initialization of static time-scale data, never at import time.
        iers.LeapSeconds.open(str(leap_path)).update_erfa_leap_seconds(initialize_erfa=True)
        return cls(eop_sha256.lower(),leap_sha256.lower(),getattr(iers,table_kind).open(str(eop_path)))

    def at(self,instant:UtcInstant)->EarthOrientationPoint:
        time=instant.as_time()
        if not np.isfinite(time.jd):raise ValueError('nonfinite UTC')
        value,status=self._table.ut1_utc(time,return_status=True)
        if int(status)<0:raise ValueError('UTC outside EOP snapshot range')
        xp,yp=self._table.pm_xy(time)
        return EarthOrientationPoint(float(value.to_value(u.s)),float(xp.to_value(u.rad)),float(yp.to_value(u.rad)),self.eop_sha256,self.leap_sha256)

    def at_many(self,instants)->tuple[EarthOrientationPoint,...]:
        """Interpolate the same immutable EOP table for a vector of UTC rows."""
        instants=tuple(instants)
        if any(not isinstance(t,UtcInstant) or not math.isfinite(t.jd1) or
               not math.isfinite(t.jd2) for t in instants):raise ValueError('nonfinite UTC')
        if not instants:return ()
        time=Time([t.jd1 for t in instants],[t.jd2 for t in instants],format='jd',scale='utc')
        values,status=self._table.ut1_utc(time,return_status=True)
        if np.any(status<0):raise ValueError('UTC outside EOP snapshot range')
        xp,yp=self._table.pm_xy(time)
        return tuple(EarthOrientationPoint(float(v),float(x),float(y),self.eop_sha256,self.leap_sha256)
                     for v,x,y in zip(values.to_value(u.s),xp.to_value(u.rad),yp.to_value(u.rad)))

    def at_times(self,time:Time)->EarthOrientationVector:
        if not isinstance(time,Time) or time.scale!='utc' or time.ndim!=1 or not np.isfinite(time.jd).all():
            raise ValueError('finite UTC Time vector required')
        value,status=self._table.ut1_utc(time,return_status=True)
        if np.any(status<0):raise ValueError('UTC outside EOP snapshot range')
        xp,yp=self._table.pm_xy(time)
        return EarthOrientationVector(value.to_value(u.s),xp.to_value(u.rad),yp.to_value(u.rad),self.eop_sha256,self.leap_sha256)

    def quality(self,instant:UtcInstant)->dict:
        time=instant.as_time()
        _,ut=self._table.ut1_utc(time,return_status=True)
        _,_,pm=self._table.pm_xy(time,return_status=True)
        labels={iers.FROM_IERS_B:'final_b',iers.FROM_IERS_A:'observed_a',iers.FROM_IERS_A_PREDICTION:'predicted_a'}
        if int(ut) not in labels or int(pm) not in labels:raise ValueError('UTC outside EOP snapshot range')
        return {'ut1':labels[int(ut)],'polar_motion':labels[int(pm)]}
