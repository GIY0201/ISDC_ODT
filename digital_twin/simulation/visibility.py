"""Injected geometric visibility search; no runtime, file or HTTP ownership.

One-second SI grid, isolated smooth extremum refinement, and <=0.01s root
brackets. Unresolved failures split known intervals. Arbitrary sub-grid
oscillations are outside the supported extremum assumption. No RF inference.
"""
import math
import numbers
import numpy as np
from astropy.time import TimeDelta
from foundation.orbit_time import parse_utc, advance_seconds
from digital_twin.contracts.orbit import (
    OrbitCalculation, OrbitSample, VisibilityInterval, VisibilityContact,
    VisibilityError, VisibilityResult,
)

CONTACT_TOLERANCE_DEG = 1e-9
BOUNDARY_BRACKET_SECONDS = .01


def _finite(value):
    return (not isinstance(value, (bool, np.bool_)) and
            isinstance(value, numbers.Real) and math.isfinite(value))


def search_visibility(*, calculate, start_utc, end_utc, minimum_elevation_deg):
    """Return immutable known intervals/contacts and per-evaluation failures.

    calculate(tuple[UTC,...]) must return matching OrbitCalculation rows under
    a single EOP/leap/frame/profile identity. Errors remain explicit; malformed
    contracts raise ValueError. Grid size is bounded by the 24h SI range.
    """
    if not callable(calculate):
        raise ValueError('visibility evaluator required')
    if not _finite(minimum_elevation_deg) or not 0 <= minimum_elevation_deg <= 90:
        raise ValueError('minimum elevation outside 0..90 degrees')
    start, end = parse_utc(start_utc), parse_utc(end_utc)
    duration = float((end.as_time().tai-start.as_time().tai).sec)
    # Double-double time subtraction may leave sub-nanosecond rounding at 24h.
    if not 0 < duration <= 86400 + 1e-8:
        raise ValueError('visibility range must be >0 and <=24h SI')
    duration = min(duration, 86400.)
    threshold = float(minimum_elevation_deg)
    cache = {}  # Local query evaluations only, never current runtime state.
    provenance = None

    def utc(t):
        if t == 0.: return start.iso_utc
        if t == duration: return end.iso_utc
        return advance_seconds(start, t).iso_utc

    def evaluate(offsets, timestamps=None):
        nonlocal provenance
        missing = [float(t) for t in offsets if float(t) not in cache]
        if not missing: return
        times = tuple(timestamps) if timestamps is not None else tuple(utc(t) for t in missing)
        result = calculate(times)
        if not isinstance(result, OrbitCalculation) or type(result.rows) is not tuple or len(result.rows) != len(times):
            raise ValueError('invalid visibility calculation contract')
        identity = (result.eop_sha256, result.leap_sha256, result.frame, result.profile)
        if (result.frame != 'ITRF' or result.profile != 'WGS72_AFSPC' or
                not all(isinstance(v,str) and v for v in identity)):
            raise ValueError('invalid visibility provenance')
        if provenance is not None and identity != provenance:
            raise ValueError('visibility calculation provenance changed')
        provenance = identity
        for t,stamp,row in zip(missing,times,result.rows):
            if not isinstance(row,OrbitSample) or row.utc != stamp:
                raise ValueError('visibility calculation UTC mismatch')
            if row.error_code is not None:
                if not isinstance(row.error_code,str) or not row.error_code or row.position_m is not None or row.elevation_deg is not None:
                    raise ValueError('invalid visibility failure row')
                cache[t] = (None, VisibilityError(stamp,row.error_code))
            else:
                if (type(row.position_m) is not tuple or len(row.position_m) != 3 or
                        not all(_finite(v) for v in row.position_m) or
                        not _finite(row.elevation_deg) or not -90 <= row.elevation_deg <= 90):
                    raise ValueError('invalid visibility success row')
                cache[t] = (float(row.elevation_deg)-threshold, None)

    def value(t):
        evaluate([t])
        return cache[float(t)][0]

    grid = np.arange(0., duration, 1.).tolist()+[duration]
    times = start.as_time()+TimeDelta(np.asarray(grid),format='sec',scale='tai')
    times.precision = 9
    timestamps = [stamp+'Z' for stamp in times.utc.isot]
    timestamps[0],timestamps[-1] = start.iso_utc,end.iso_utc
    evaluate(grid,timestamps)

    def extremum(a,b,maximize):
        # Ternary refinement is bounded and assumes a unimodal bracket.
        for _ in range(40):
            if b-a < 1e-6: break
            x,y = a+(b-a)/3, b-(b-a)/3
            evaluate([x,y])
            fx,fy = value(x),value(y)
            if fx is None or fy is None: return
            if fx == fy == value(a) == value(b): return
            if (fx < fy) == maximize: a = x
            else: b = y
        t = (a+b)/2
        v = value(t)
        if v is not None and abs(v) <= CONTACT_TOLERANCE_DEG:
            cache[t] = (0.,None)

    # Only refine visible sampled slope reversals. Flat runs need no search.
    for i in range(1,len(grid)-1):
        a,b,c = (cache[grid[j]][0] for j in (i-1,i,i+1))
        if a is None or b is None or c is None: continue
        if b >= a and b >= c and (b > a or b > c):
            extremum(grid[i-1],grid[i+1],True)
        elif b <= a and b <= c and (b < a or b < c):
            extremum(grid[i-1],grid[i+1],False)

    # A peak/trough inside the first or last cell has no three-grid-point
    # slope reversal. Refine those cells under the same unimodal assumption.
    edge_cells = {(grid[0],grid[1]), (grid[-2],grid[-1])}
    for a,b in edge_cells:
        fa,fb = cache[a][0],cache[b][0]
        if fa is not None and fb is not None:
            extremum(a,b,True)
            extremum(a,b,False)

    roots = set()
    knots = sorted(cache)
    for left,right in zip(knots,knots[1:]):
        a,b = left,right
        fa,fb = cache[a][0],cache[b][0]
        if fa is None or fb is None or fa*fb >= 0: continue
        valid = True
        while b-a > BOUNDARY_BRACKET_SECONDS:
            m = (a+b)/2
            fm = value(m)
            if fm is None:
                valid = False
                break
            if fm == 0:
                a = b = m
                break
            if (fa > 0) == (fm > 0): a,fa = m,fm
            else: b = m
        if valid:
            root = (a+b)/2
            value(root)
            if cache[root][0] is not None:
                roots.add(root)

    # Root positions are bounded estimates, represented as the threshold.
    # Keep refinement evaluations too: every failure remains a hard break.
    knots = sorted(cache)
    for root in roots: cache[root] = (0.,None)
    segments = []
    for a,b in zip(knots,knots[1:]):
        fa,fb = cache[a][0],cache[b][0]
        if fa is not None and fb is not None and fa >= 0 and fb >= 0:
            if segments and segments[-1][1] == a: segments[-1][1] = b
            else: segments.append([a,b])

    # Float equality near an isolated tangent can produce several zero knots
    # a few nanoseconds apart. Do not turn this numerical cluster into a pass.
    segments = [[a,b] for a,b in segments if b-a > BOUNDARY_BRACKET_SECONDS or
                (a == 0. and b == duration) or
                any(v[0] is not None and v[0] > 0 for t,v in cache.items() if a <= t <= b)]
    intervals = []
    for a,b in segments:
        candidates = [(v[0],t) for t,v in cache.items() if a <= t <= b and v[0] is not None]
        best,peak = max(candidates,key=lambda pair: pair[0])
        intervals.append(VisibilityInterval(utc(a),utc(b),utc(peak),best+threshold,
                                            a == 0.,b == duration))
    contacts = []
    for t in knots:
        if cache[t][0] == 0 and not any(a <= t <= b for a,b in segments):
            if not contacts or abs(t-contacts[-1]) > BOUNDARY_BRACKET_SECONDS:
                contacts.append(t)
    errors = tuple(v[1] for t,v in sorted(cache.items()) if v[1] is not None)
    if errors:
        status = 'partial' if any(v[0] is not None for v in cache.values()) else 'error'
    else:
        status = 'complete' if intervals or contacts else 'none'
    return VisibilityResult(start.iso_utc,end.iso_utc,threshold,tuple(intervals),
        tuple(VisibilityContact(utc(t)) for t in contacts),status,errors,*provenance)
