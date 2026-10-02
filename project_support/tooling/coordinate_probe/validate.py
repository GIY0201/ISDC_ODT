import hashlib,json,sys
from pathlib import Path
import numpy as np
import astropy,erfa,astropy_iers_data
from astropy import units as u
from astropy.time import Time
from astropy.coordinates import TEME,ITRS,AltAz,EarthLocation,CartesianRepresentation
from astropy.utils import iers
from sgp4.api import Satrec,WGS72

iers.conf.auto_download=False
ROOT=Path(__file__).resolve().parents[3]
out=ROOT/'data/workspace/validation/coordinate_probe_20261001'
out.mkdir(parents=True,exist_ok=True)
snapshot=out/'eopc04.1962-now'
leap_snapshot=out/'Leap_Second.dat'
if not snapshot.exists():snapshot.write_bytes(Path(astropy_iers_data.IERS_B_FILE).read_bytes())
if not leap_snapshot.exists():leap_snapshot.write_bytes(Path(astropy_iers_data.IERS_LEAP_SECOND_FILE).read_bytes())
assert hashlib.sha256(snapshot.read_bytes()).hexdigest()=='31bb7f67a30f629ad87562cb2b9c22b86e252767cbdda44e40c0afd39b6dccc7'
assert hashlib.sha256(leap_snapshot.read_bytes()).hexdigest()=='6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7'
iers.LeapSeconds.open(str(leap_snapshot)).update_erfa_leap_seconds(initialize_erfa=True)
table=iers.IERS_B.open(str(snapshot))
iers.earth_orientation_table.set(table)

def transform(r,t,xp,yp):
    theta=erfa.gmst82(t.ut1.jd1,t.ut1.jd2)
    c,s=np.cos(theta),np.sin(theta)
    pef=np.column_stack((c*r[:,0]+s*r[:,1],-s*r[:,0]+c*r[:,1],r[:,2]))
    polar=erfa.pom00(xp,yp,np.zeros_like(xp))
    return np.einsum('nij,nj->ni',polar,pef)

def elev(r,site):
    delta=r-site.get_itrs().cartesian.xyz.to_value(u.km)
    lat,lon=site.lat.rad,site.lon.rad
    east=-np.sin(lon)*delta[:,0]+np.cos(lon)*delta[:,1]
    north=-np.sin(lat)*np.cos(lon)*delta[:,0]-np.sin(lat)*np.sin(lon)*delta[:,1]+np.cos(lat)*delta[:,2]
    up=np.cos(lat)*np.cos(lon)*delta[:,0]+np.cos(lat)*np.sin(lon)*delta[:,1]+np.sin(lat)*delta[:,2]
    return np.degrees(np.arctan2(up,np.hypot(east,north)))

# Published position fixture uses its own explicit EOP, not table values.
tf=Time(['2004-04-06T07:51:28.386'],scale='utc');tf.delta_ut1_utc=-.439961
r=np.array([[5094.18016210,6127.64465950,6380.34453270]])
expected=np.array([[-1033.47938300,7901.29527540,6380.35659580]])
converted=transform(r,tf,np.array([-.140682])*u.arcsec.to(u.rad),np.array([.333309])*u.arcsec.to(u.rad))
fixture_error=float(np.linalg.norm(converted-expected)*1000)
assert fixture_error<.3,(converted,fixture_error)

l1='1 25544U 98067A   20194.88612269 -.00002218  00000-0 -31515-4 0  9992'
l2='2 25544  51.6461 221.2784 0001413  89.1723 280.4612 15.49507896236008'
src=Satrec.twoline2rv(l1,l2,WGS72)
sat=Satrec();sat.sgp4init(WGS72,'a',src.satnum,(src.jdsatepoch-2433281.5)+src.jdsatepochF,src.bstar,src.ndot,src.nddot,src.ecco,src.argpo,src.inclo,src.mo,src.no_kozai,src.nodeo)
site=EarthLocation.from_geodetic(126.5312*u.deg,33.4996*u.deg,0*u.m)
start=Time(src.jdsatepoch,src.jdsatepochF,format='jd',scale='utc')

def calculate(seconds):
    times=start+np.asarray(seconds)*u.s
    errors,r,v=sat.sgp4_array(times.jd1,times.jd2)
    assert not np.any(errors)
    xp,yp=table.pm_xy(times)
    manual=transform(r,times,xp.to_value(u.rad),yp.to_value(u.rad))
    reference=TEME(CartesianRepresentation(r.T*u.km),obstime=times).transform_to(ITRS(obstime=times))
    top=reference.cartesian-site.get_itrs(obstime=times).cartesian
    alt=ITRS(top,obstime=times,location=site).transform_to(AltAz(obstime=times,location=site,pressure=0*u.hPa)).alt.deg
    return elev(manual,site),alt,manual,reference.cartesian.xyz.to_value(u.km).T

seconds=np.arange(0,86401,10,dtype=float)
a,b,manual,ref=calculate(seconds)
position_error=float(np.max(np.linalg.norm(manual-ref,axis=1))*1000)
elevation_error=float(np.max(np.abs(a-b)))
assert position_error<=10 and elevation_error<=.01

def roots(which):
    values=(a,b)[which]-10
    result=[]
    for index in np.flatnonzero(values[:-1]*values[1:]<0):
        left,right=seconds[index],seconds[index+1]
        sign=values[index]>=0
        while right-left>.05:
            mid=(left+right)/2
            value=calculate([mid])[which][0]-10
            if (value>=0)==sign:left=mid
            else:right=mid
        result.append((left+right)/2)
    return result
ra,rb=roots(0),roots(1)
assert len(ra)==len(rb) and ra
boundary_error=float(np.max(np.abs(np.array(ra)-rb)))
assert boundary_error<=1
files={}
for name,path in [('iers_b',snapshot),('leap_seconds',leap_snapshot)]:
    path=Path(path);destination=out/path.name;destination.write_bytes(path.read_bytes())
    files[name]={'filename':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
np.savez(out/'reference_samples.npz',utc_jd1=(start+seconds*u.s).jd1,utc_jd2=(start+seconds*u.s).jd2,position_itrf_km=ref,elevation_deg=b)
t0=start
xp,yp=table.pm_xy(t0)
report={'versions':{'python':sys.version,'astropy':astropy.__version__,'erfa':erfa.__version__,'iers_data':astropy_iers_data.__version__},'files':files,'fixture_position_error_m':fixture_error,'max_position_difference_m':position_error,'max_elevation_difference_deg':elevation_error,'max_boundary_difference_s':boundary_error,'crossings_seconds_from_epoch':rb,'sample_count':len(seconds),'station_assumption':{'latitude_deg':33.4996,'longitude_deg':126.5312,'ellipsoid_height_m':0},'tle':[l1,l2],'eop_at_epoch':{'ut1_minus_utc_s':float(table.ut1_utc(t0).to_value(u.s)),'xp_arcsec':float(xp.to_value(u.arcsec)),'yp_arcsec':float(yp.to_value(u.arcsec))},'limitations':['shared ERFA gmst82/pom00 kernels, not independent theory','10s crossing scan does not prove all short or tangent passes found','historical ISS, no real communication or orbit truth','no leap boundary or velocity validation','station coordinates/height remain test assumptions','Rust propagation previously verified; current coordinate probe uses C++ sgp4']}
(out/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))


