"""Read and validate a stored source without changing it or starting a network."""
import calendar
from datetime import datetime,timedelta,timezone
import hashlib,json,math
from pathlib import Path
from foundation.orbit_time import parse_utc
from digital_twin.contracts.orbit import OrbitInput

_DEFAULTS={'CENTER_NAME':'EARTH','REF_FRAME':'TEME','TIME_SYSTEM':'UTC','MEAN_ELEMENT_THEORY':'SGP4'}
_FIELDS=('MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY','BSTAR','MEAN_MOTION_DOT','MEAN_MOTION_DDOT')


def _number(value):
    if isinstance(value,bool):raise ValueError('boolean orbital element')
    result=float(value)
    if not math.isfinite(result):raise ValueError('nonfinite orbital element')
    return result


def _tle(lines):
    if len(lines)==3:lines=lines[1:]
    if len(lines)!=2:raise ValueError('TLE requires two element lines')
    for index,line in enumerate(lines,1):
        if len(line)!=69 or not line.startswith(str(index)+' '):raise ValueError('invalid TLE line')
        checksum=sum(int(c) if c.isdigit() else 1 if c=='-' else 0 for c in line[:68])%10
        if not line[-1].isdigit() or checksum!=int(line[-1]):raise ValueError('TLE checksum mismatch')
    first,second=lines
    satellite=int(first[2:7])
    if satellite!=int(second[2:7]):raise ValueError('TLE satellite identifiers differ')
    short=int(first[18:20]);year=1900+short if short>=57 else 2000+short
    day=_number(first[20:32])
    upper_day=367 if calendar.isleap(year) else 366
    if not 1<=day<upper_day:
        raise ValueError('invalid TLE epoch day')
    epoch=datetime(year,1,1,tzinfo=timezone.utc)+timedelta(days=day-1)
    epoch_utc=parse_utc(epoch.isoformat().replace('+00:00','Z')).iso_utc
    # Native TLE parser remains the source of propagation elements.
    inclination=_number(second[8:16]);eccentricity=_number('0.'+second[26:33]);motion=_number(second[52:63])
    if not 0<=inclination<=180 or not 0<=eccentricity<1 or motion<=0:raise ValueError('invalid TLE orbit')
    return satellite,epoch_utc,tuple(lines),()


def load_orbit_input(path,*,format:str,source:str,fetched_utc:str,expected_sha256:str)->OrbitInput:
    return load_orbit_input_bytes(Path(path).read_bytes(),format=format,source=source,fetched_utc=fetched_utc,expected_sha256=expected_sha256)


def load_orbit_input_bytes(raw:bytes,*,format:str,source:str,fetched_utc:str,expected_sha256:str)->OrbitInput:
    if not isinstance(source,str) or not source.strip():raise ValueError('source is required')
    fetched=parse_utc(fetched_utc).iso_utc
    digest=hashlib.sha256(raw).hexdigest()
    if digest!=expected_sha256.lower():raise ValueError('orbit input hash mismatch')
    text=raw.decode('utf-8-sig');defaults=()
    if format=='TLE':
        satellite,epoch,tle,elements=_tle(text.splitlines())
    elif format=='OMM':
        payload=json.loads(text)
        if not isinstance(payload,dict):raise ValueError('one OMM JSON object is required')
        missing_fields=set(_FIELDS+('NORAD_CAT_ID','EPOCH'))-payload.keys()
        if missing_fields:raise ValueError('required OMM fields missing: '+', '.join(sorted(missing_fields)))
        missing={}
        for key,value in _DEFAULTS.items():
            if key not in payload:missing[key]=value
            elif payload[key]!=value:raise ValueError('unsupported OMM '+key)
        defaults=tuple(missing.items())
        identifier=payload['NORAD_CAT_ID']
        if isinstance(identifier,bool) or int(identifier)!=_number(identifier) or int(identifier)<=0:raise ValueError('invalid NORAD identifier')
        satellite=int(identifier)
        epoch_text=payload['EPOCH']
        if not isinstance(epoch_text,str):raise ValueError('invalid OMM epoch')
        if not epoch_text.endswith(('Z','+00:00')):epoch_text+='Z'
        epoch=parse_utc(epoch_text).iso_utc
        values={key:_number(payload[key]) for key in _FIELDS}
        if values['MEAN_MOTION']<=0 or not 0<=values['ECCENTRICITY']<1 or not 0<=values['INCLINATION']<=180:raise ValueError('invalid OMM orbit')
        elements=tuple(values.items());tle=None
    else:raise ValueError('unsupported orbit format')
    return OrbitInput(str(satellite)+':'+digest,satellite,format,digest,source,fetched,epoch,'WGS72_AFSPC',tle,elements,defaults)

