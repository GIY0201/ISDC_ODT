"""Research validation only. No application imports or product changes."""
import contextlib,io,runpy,json,time,unittest,hashlib
from pathlib import Path
import numpy as np
from astropy.time import Time
from astropy import units as u
from astropy.coordinates import TEME,ITRS,AltAz,CartesianRepresentation,CartesianDifferential
from astropy.utils import iers
import isdc_sgp4_probe as rust
with contextlib.redirect_stdout(io.StringIO()):
    base=runpy.run_path(str(Path(__file__).with_name('validate.py')))
out=base['out'];start=base['start'];table=base['table'];site=base['site'];l1=base['l1'];l2=base['l2']
metrics={}

def checked(times):
    if not np.all(np.isfinite(times.jd)):raise ValueError('nonfinite time')
    dut,status=table.ut1_utc(times,return_status=True)
    if np.any(np.asarray(status)<0):raise ValueError('EOP outside stored interval')
    times.delta_ut1_utc=dut.to_value(u.s)
    return table.pm_xy(times)

def pipeline(seconds):
    times=start+np.asarray(seconds)*u.s
    xp,yp=checked(times)
    # Match Vallado/SGP4 UTC Julian-date convention, not silently SI elapsed time.
    minutes=((times.jd1-start.jd1)+(times.jd2-start.jd2))*1440
    buffer,n,_=rust.propagate_batch_buffer(l1,l2,minutes.tolist())
    raw=np.frombuffer(buffer,dtype='<f8').reshape(n,2,3)
    position=base['transform'](raw[:,0,:],times,xp.to_value(u.rad),yp.to_value(u.rad))
    return base['elev'](position,site),position

def extrema(fn,left,right,maximize=True):
    sign=1 if maximize else -1
    for _ in range(48):
        a=left+(right-left)/3;b=right-(right-left)/3
        if sign*fn(a)<sign*fn(b):left=a
        else:right=b
    t=(left+right)/2
    return t,fn(t)

def intervals(fn,left,right,step=10):
    grid=np.arange(left,right,step).tolist()+[right]
    values=[fn(t) for t in grid]
    additions=[]
    # Detect sampled extrema and refine. Requires smooth, isolated unimodal extrema per bracket.
    for i in range(1,len(grid)-1):
        if values[i]>=values[i-1] and values[i]>=values[i+1]:
            additions.append(extrema(fn,grid[i-1],grid[i+1],True)[0])
        elif values[i]<=values[i-1] and values[i]<=values[i+1]:
            additions.append(extrema(fn,grid[i-1],grid[i+1],False)[0])
    knots=sorted(set(grid+additions));roots=[];contacts=[]
    for x in additions:
        if abs(fn(x))<1e-10:contacts.append(x)
    for a,b in zip(knots[:-1],knots[1:]):
        fa,fb=fn(a),fn(b)
        if fa*fb<0:
            while b-a>.001:
                m=(a+b)/2;fm=fn(m)
                if (fa>=0)==(fm>=0):a=m;fa=fm
                else:b=m
            roots.append((a+b)/2)
    bounds=[left]+roots+[right];visible=[]
    for a,b in zip(bounds[:-1],bounds[1:]):
        if fn((a+b)/2)>0:visible.append([a,b])
    return visible,contacts

class Validation(unittest.TestCase):
    def test_full_rust_position_and_elevation(self):
        seconds=np.arange(86401,dtype=float)
        alt,pos=pipeline(seconds)
        # Independent Astropy orchestration and C++ propagation from prior tool.
        ref_alt,ref_pos=base['calculate'](seconds)[1],base['calculate'](seconds)[3]
        metrics['rust_chain_position_difference_m']=float(np.max(np.linalg.norm(pos-ref_pos,axis=1))*1000)
        metrics['rust_chain_elevation_difference_deg']=float(np.max(np.abs(alt-ref_alt)))
        assert metrics['rust_chain_position_difference_m']<10
        assert metrics['rust_chain_elevation_difference_deg']<.01
        metrics['dense_1s_crossings']=int(np.sum((alt[:-1]-10)*(alt[1:]-10)<0))
        assert metrics['dense_1s_crossings']==8
    def test_rust_boundary_comparison(self):
        roots=[]
        for reference in base['rb']:
            a,b=reference-1,reference+1
            fa=pipeline([a])[0][0]-10
            for _ in range(12):
                m=(a+b)/2;fm=pipeline([m])[0][0]-10
                if (fa>=0)==(fm>=0):a=m;fa=fm
                else:b=m
            roots.append((a+b)/2)
        metrics['rust_boundary_difference_s']=float(np.max(np.abs(np.array(roots)-base['rb'])))
        assert metrics['rust_boundary_difference_s']<1
    def test_short_pass_between_samples(self):
        fn=lambda t: .01-(t-15.123)**2
        assert all(fn(t)<0 for t in [0,10,20,30])
        passes,_=intervals(fn,0,30)
        assert len(passes)==1
        np.testing.assert_allclose(passes[0],[15.023,15.223],atol=.001)
    def test_tangent_contact(self):
        passes,contacts=intervals(lambda t:-(t-15.123)**2,0,30)
        assert not passes and len(contacts)==1
        assert abs(contacts[0]-15.123)<.001
    def test_clipped_and_no_pass(self):
        assert intervals(lambda t:1,0,30)[0]==[[0,30]]
        assert intervals(lambda t:-1,0,30)[0]==[]
        p,_=intervals(lambda t:t-12.123,0,30)
        assert abs(p[0][0]-12.123)<.001 and p[0][1]==30
    def test_actual_narrow_pass(self):
        peak_t,peak=extrema(lambda t:float(pipeline([t])[0][0]),1949,2213)
        threshold=peak-1e-6
        fn=lambda t:float(pipeline([t])[0][0])-threshold
        p,_=intervals(fn,peak_t-15.123,peak_t+14.877)
        assert len(p)==1 and p[0][1]-p[0][0]<1
        metrics['actual_high_threshold_short_pass_duration_s']=p[0][1]-p[0][0]
        metrics['short_pass_threshold_deg']=threshold
    def test_eop_outside_range(self):
        for date in ['1900-01-01','2100-01-01']:
            with self.assertRaises(ValueError):checked(Time([date],scale='utc'))
    def test_invalid_rust_inputs(self):
        for value in [float('nan'),float('inf'),-float('inf')]:
            with self.assertRaises(ValueError):rust.propagate_batch_buffer(l1,l2,[value])
        with self.assertRaises(ValueError):rust.propagate_batch_buffer('broken',l2,[0])
    def test_nonmonotonic_and_duplicates(self):
        a,_=pipeline([100,0,100,-10])
        assert a[0]==a[2]
        np.testing.assert_allclose(a[[1,3]],pipeline([0,-10])[0],atol=1e-10)
    def test_geometry_above_horizon_below(self):
        origin=site.get_itrs().cartesian.xyz.to_value(u.km)
        lat,lon=site.lat.rad,site.lon.rad
        up=np.array([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)])
        east=np.array([-np.sin(lon),np.cos(lon),0])
        a=base['elev'](np.array([origin+up*100,origin+east*100,origin-up*100]),site)
        np.testing.assert_allclose(a,[90,0,-90],atol=1e-10)
    def test_midnight_and_leap_contract(self):
        times=Time(['2016-12-31T23:59:59','2016-12-31T23:59:60','2017-01-01T00:00:00'],scale='utc')
        checked(times)
        np.testing.assert_allclose(np.diff(times.tai.jd1+times.tai.jd2)*86400,[1,1],atol=5e-5)
        utc_delta=np.diff(times.jd1+times.jd2)*86400
        assert np.all(utc_delta>0)
        metrics['leap_utc_jd_intervals_s']=utc_delta.tolist()
        metrics['leap_contract']='SGP4 UTC Julian dates; SI-duration controls converted through UTC, leap day is not assumed 86400 UTC-JD seconds'
        # Direct calls on both sides confirm finite transformation with stored EOP.
        xp,yp=checked(times)
        fixed=np.repeat(np.array([[7000.,0,0]]),3,axis=0)
        assert np.all(np.isfinite(base['transform'](fixed,times,xp.to_value(u.rad),yp.to_value(u.rad))))
    def test_velocity_rotation(self):
        times=start+np.array([0,1000,50000])*u.s
        xp,yp=checked(times)
        minutes=((times.jd1-start.jd1)+(times.jd2-start.jd2))*1440
        buffer,n,_=rust.propagate_batch_buffer(l1,l2,minutes.tolist())
        raw=np.frombuffer(buffer,dtype='<f8').reshape(n,2,3)
        r,v=raw[:,0],raw[:,1]
        theta=base['erfa'].gmst82(times.ut1.jd1,times.ut1.jd2)
        c,s=np.cos(theta),np.sin(theta)
        pef=np.column_stack((c*r[:,0]+s*r[:,1],-s*r[:,0]+c*r[:,1],r[:,2]))
        vr=np.column_stack((c*v[:,0]+s*v[:,1],-s*v[:,0]+c*v[:,1],v[:,2]))
        omega=7.29211514670698e-5
        vr-=np.cross(np.array([0,0,omega]),pef)
        polar=base['erfa'].pom00(xp.to_value(u.rad),yp.to_value(u.rad),np.zeros(n))
        calculated=np.einsum('nij,nj->ni',polar,vr)
        reference=TEME(CartesianRepresentation(r.T*u.km,differentials=CartesianDifferential(v.T*u.km/u.s)),obstime=times).transform_to(ITRS(obstime=times)).cartesian.differentials['s'].d_xyz.to_value(u.km/u.s).T
        error=float(np.max(np.linalg.norm(reference-calculated,axis=1))*1000)
        metrics['zero_lod_velocity_reference_difference_m_s']=error
        assert error<.01
        # Explicit LOD correction sensitivity; no unstated physical LOD assumption.
        lod_s=.002
        corrected=np.einsum('nij,nj->ni',polar,vr+np.cross(np.array([0,0,omega*lod_s/86400]),pef))
        metrics['synthetic_lod_2ms_velocity_effect_m_s']=float(np.max(np.linalg.norm(corrected-calculated,axis=1))*1000)
        assert metrics['synthetic_lod_2ms_velocity_effect_m_s']>0
    def test_station_validation_policy(self):
        def valid(lat,lon,height):
            if not all(np.isfinite([lat,lon,height])) or abs(lat)>90 or abs(lon)>180:raise ValueError('invalid geodetic station')
        for args in [(91,0,0),(0,181,0),(0,0,float('nan'))]:
            with self.assertRaises(ValueError):valid(*args)
        valid(-90,-180,-10)
    def test_short_gap_between_samples(self):
        fn=lambda t:(t-15.123)**2-.01
        visible,_=intervals(fn,0,30)
        assert len(visible)==2
        np.testing.assert_allclose([visible[0][1],visible[1][0]],[15.023,15.223],atol=.001)
    def test_complete_visibility_benchmark(self):
        def search():
            times=np.arange(86401,dtype=float)
            altitude,_=pipeline(times)
            crossings=np.flatnonzero((altitude[:-1]-10)*(altitude[1:]-10)<0)
            bounds=[]
            # Refine all crossings as a batch at each iteration.
            left=times[crossings];right=left+1;sign=altitude[crossings]>=10
            for _ in range(12):
                mid=(left+right)/2
                value=pipeline(mid)[0]>=10
                select=value==sign
                left=np.where(select,mid,left);right=np.where(select,right,mid)
            bounds=(left+right)/2
            assert len(bounds)==8
            return bounds
        search();durations=[]
        for _ in range(20):
            begin=time.perf_counter();search();durations.append((time.perf_counter()-begin)*1000)
        metrics['visibility_24h_ms']={'median':float(np.median(durations)),'p95':float(np.percentile(durations,95)),'max':max(durations),'raw':durations}
        assert metrics['visibility_24h_ms']['p95']<1000
    def test_rust_cpp_across_leap_second(self):
        # Synthetic epoch shift for library convention testing, not observed ISS elements.
        first=l1[:18]+'16366.50000000'+l1[32:68]
        checksum=sum(int(c) if c.isdigit() else 1 if c=='-' else 0 for c in first)%10
        first+=str(checksum)
        cpp=base['Satrec'].twoline2rv(first,l2,base['WGS72'])
        matched=base['Satrec']()
        matched.sgp4init(base['WGS72'],'a',cpp.satnum,(cpp.jdsatepoch-2433281.5)+cpp.jdsatepochF,cpp.bstar,cpp.ndot,cpp.nddot,cpp.ecco,cpp.argpo,cpp.inclo,cpp.mo,cpp.no_kozai,cpp.nodeo)
        times=Time(['2016-12-31T23:59:59','2016-12-31T23:59:60','2017-01-01T00:00:00'],scale='utc')
        epoch=Time(cpp.jdsatepoch,cpp.jdsatepochF,format='jd',scale='utc')
        minutes=((times.jd1-epoch.jd1)+(times.jd2-epoch.jd2))*1440
        buffer,n,_=rust.propagate_batch_buffer(first,l2,minutes.tolist())
        rp=np.frombuffer(buffer,dtype='<f8').reshape(n,2,3)[:,0,:]
        error,cp,_=matched.sgp4_array(times.jd1,times.jd2)
        assert not np.any(error)
        difference=float(np.max(np.linalg.norm(rp-cp,axis=1))*1000)
        metrics['synthetic_epoch_leap_rust_cpp_difference_m']=difference
        assert difference<10
    def test_whole_chain_benchmark(self):
        samples=np.arange(86400,dtype=float)
        for _ in range(3):pipeline(samples)
        ms=[]
        for _ in range(20):
            begin=time.perf_counter();pipeline(samples);ms.append((time.perf_counter()-begin)*1000)
        metrics['chain_86400_ms']={'median':float(np.median(ms)),'p95':float(np.percentile(ms,95)),'max':max(ms),'raw':ms}
        assert metrics['chain_86400_ms']['p95']<1000

suite=unittest.defaultTestLoader.loadTestsFromTestCase(Validation)
result=unittest.TextTestRunner(verbosity=2).run(suite)
report={'tests':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'metrics':metrics,'scope':'research Rust propagation -> Python coordinate/elevation chain; no product UI or Rust coordinate kernel','source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'limitations':['extrema search assumes smooth isolated extrema; not proof for arbitrary functions','same ERFA kernels in coordinate reference','velocity checked against Astropy with explicit zero LOD; synthetic LOD sensitivity only, no measured Doppler validation','historical data, virtual station, no real RF verification','UI/game fps and clean different-PC deployment require later implementation']}
(out/'extended_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
raise SystemExit(not result.wasSuccessful())



