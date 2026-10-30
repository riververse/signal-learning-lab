"""Original synthetic mathematics, no external code or hardware."""
import math,cmath,unittest,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent
FS=8000;N=800;A=.2

def detect(chunks,reset=False):
    i=q=0.;n=0;count=0
    for chunk in chunks:
        if reset:n=0
        for x in chunk:
            i+=x*math.cos(math.pi*n/2);q-=x*math.sin(math.pi*n/2);n+=1;count+=1
    return 2*i/count,2*q/count
class LockInTests(unittest.TestCase):
    def test_phase_and_units(self):
        for deg in [0,60,90,-60,180]:
            phi=math.radians(deg);x=[A*math.cos(math.pi*n/2+phi) for n in range(N)]
            i,q=detect([x]);self.assertAlmostEqual(i,A*math.cos(phi),12);self.assertAlmostEqual(q,A*math.sin(phi),12);self.assertAlmostEqual(math.hypot(i,q),A,12)
    def test_irregular_blocks(self):
        x=[A*math.cos(math.pi*n/2+math.pi/3) for n in range(N)]
        chunks=[x[:7],x[7:20],x[20:]]
        self.assertEqual(detect([x]),detect(chunks));self.assertGreater(math.dist(detect([x]),detect(chunks,True)),.001)
    def test_reference_sequence(self):
        self.assertEqual([round(math.cos(math.pi*n/2)) for n in range(4)],[1,0,-1,0]);self.assertEqual([round(-math.sin(math.pi*n/2)) for n in range(4)],[0,-1,0,1])
    def test_frequency_offset(self):
        for df in [0,1,5,10]:
            y=sum(A*cmath.exp(2j*math.pi*df*n/FS) for n in range(N))/N
            ratio=1 if df==0 else abs(math.sin(math.pi*N*df/FS)/(N*math.sin(math.pi*df/FS)))
            self.assertAlmostEqual(abs(y),A*ratio,12)
            if df==5:self.assertAlmostEqual(abs(y),.127324036,8)
    def test_block_deadlines(self):
        self.assertEqual(32/400000*1e6,80);self.assertEqual(32/100000*1e6,320);self.assertGreater(100,80);self.assertLess(100,320)
    def test_case_contract(self):
        d=json.loads((ROOT/'engineering-cases.json').read_text());c=next(c for c in d['cases'] if c['id']=='microchip-lockin-continuity');s=json.dumps(c,ensure_ascii=False)
        self.assertEqual(c['id'],'microchip-lockin-continuity');self.assertEqual(c['status'],'待学习');self.assertEqual(c['reproduction_status'],'未本站实物复现')
        for token in ['2007','2015-06-24','2021-09-24','fs/4','atan2(Q,I)','−sin','缺口','峰值','未下载','32点','80 μs','320 μs','0.127324','100 kSPS','400 kSPS']:self.assertIn(token,s)
        expected='f735a86e9fc0074bb06c04b70064dd5f4dd1aec209addb692081b06bfda998d4';actual=hashlib.sha256(json.dumps(d['cases'][:12],ensure_ascii=False,sort_keys=True).encode()).hexdigest();self.assertEqual(actual,expected)
if __name__=='__main__':unittest.main()
