import json,unittest
from pathlib import Path
import numpy as np
from sgp4.api import Satrec,WGS72,accelerated
import isdc_sgp4_probe as probe
INPUT=json.loads((Path(__file__).resolve().parent.parent/'sgp4_benchmark/input.json').read_text())
L1,L2=INPUT['line1'],INPUT['line2']
def cpp(times):
    assert accelerated
    source=Satrec.twoline2rv(L1,L2,WGS72); sat=Satrec()
    sat.sgp4init(WGS72,'a',source.satnum,(source.jdsatepoch-2433281.5)+source.jdsatepochF,source.bstar,source.ndot,source.nddot,source.ecco,source.argpo,source.inclo,source.mo,source.no_kozai,source.nodeo)
    e,r,v=sat.sgp4_array(np.full(len(times),source.jdsatepoch),source.jdsatepochF+np.asarray(times)/1440)
    assert np.all(e==0)
    return r,v
class ProbeTests(unittest.TestCase):
    def test_day_results_match_cpp(self):
        times=list(np.arange(1440,dtype=float)); values,_=probe.propagate_batch(L1,L2,times)
        r,v=cpp(times); native=np.asarray(values)
        self.assertLess(float(np.linalg.norm(native[:,0]-r,axis=1).max())*1000,10)
        self.assertLess(float(np.linalg.norm(native[:,1]-v,axis=1).max()),1e-6)
    def test_nonmonotonic_duplicate_negative_times_preserved(self):
        times=[10.,-5.,0.,10.]; values,_=probe.propagate_batch(L1,L2,times)
        r,_=cpp(times); self.assertLess(float(np.linalg.norm(np.asarray(values)[:,0]-r,axis=1).max())*1000,10)
        self.assertEqual(values[0],values[3])
    def test_bad_tle_rejected(self):
        with self.assertRaises(ValueError):probe.propagate_batch('invalid',L2,[0.])
    def test_nonfinite_times_rejected(self):
        for t in [float('nan'),float('inf'),float('-inf')]:
            with self.subTest(t=t):
                with self.assertRaises(ValueError):probe.propagate_batch(L1,L2,[t])
    def test_input_and_result_isolation(self):
        times=[0.,1.]; saved=times.copy(); a,_=probe.propagate_batch(L1,L2,times); a[0][0][0]=0
        b,_=probe.propagate_batch(L1,L2,times)
        self.assertEqual(times,saved); self.assertNotEqual(b[0][0][0],0)
    def test_buffer_result_readonly_and_matches_list(self):
        values,_=probe.propagate_batch(L1,L2,[0.,-5.,10.])
        buffer,n,_=probe.propagate_batch_buffer(L1,L2,[0.,-5.,10.])
        array=np.frombuffer(buffer,dtype='<f8').reshape(n,2,3)
        np.testing.assert_array_equal(array,np.asarray(values))
        self.assertFalse(array.flags.writeable)
        with self.assertRaises(ValueError):array[0,0,0]=0
    def test_buffer_bad_input_rejected(self):
        with self.assertRaises(ValueError):probe.propagate_batch_buffer(L1,L2,[float('nan')])
        with self.assertRaises(ValueError):probe.propagate_batch_buffer('invalid',L2,[0.])
    def test_empty_batch(self):
        values,ms=probe.propagate_batch(L1,L2,[]); self.assertEqual(values,[]); self.assertGreaterEqual(ms,0)
    def test_probe_limit(self):
        with self.assertRaises(ValueError):probe.propagate_batch(L1,L2,[0.]*100001)
if __name__=='__main__': unittest.main()
