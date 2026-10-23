#!/usr/bin/env python3
"""Offline content/build checks. Optional --baseline DIR verifies preservation.

These checks do not run vendor code, access hardware or claim browser visual QA.

2026-10-19 theme migration: the final stylesheet is river-experiments.css, the
shared navigation also has studio-nav, and the hardware entry is a studio-topic
link. Resource ordering, navigation destinations/current state, and the hardware
destination remain asserted. The --baseline checks preserve the prior five
cases and unrelated files, allowing only this append-only case release's files.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
from datetime import date
import importlib.util,json,re,sys,unittest,subprocess,hashlib,math,cmath
ROOT=Path(__file__).resolve().parent
BASE=None
if '--baseline' in sys.argv:
    i=sys.argv.index('--baseline');BASE=Path(sys.argv[i+1]).resolve();del sys.argv[i:i+2]
def read(p):return (ROOT/p).read_text()
def data(p):return json.loads(read(p))
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
class Doc(HTMLParser):
    def __init__(self,text):
        super().__init__();self.ids=[];self.links=[];self.scripts=[];self.styles=[];self.tags=[];self.feed(text)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs);self.tags.append((tag,a))
        if 'id' in a:self.ids.append(a['id'])
        if tag=='a' and 'href' in a:self.links.append(a['href'])
        if tag=='script':self.scripts.append(a.get('src',''))
        if tag=='link' and a.get('rel')=='stylesheet':self.styles.append(a['href'])
class CasesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cases=data('engineering-cases.json')['cases'];cls.catalog=data('exploration-catalog.json');cls.html=read('engineering-cases.html');cls.doc=Doc(cls.html);cls.renderer=module('case_builder','build-engineering-cases.py');cls.explore=module('explore_builder','build-exploration.py')
    def test_01_nine_substantial_distinct_cases(self):
        self.assertEqual(len(self.cases),9);self.assertEqual(len({x['vendor'] for x in self.cases}),8)
        self.assertEqual([c['id'] for c in self.cases],['nxp-magnetic-calibration','adi-vibration-chain','ti-ultrasonic-level','ti-fixed-point-fft','arm-biquad-state-precision','amd-cic-decimation-contract','ni-psd-window-normalization','px4-innovation-gating-contract','nxp-allan-averaging-contract'])
        for c in self.cases:
            self.assertGreater(len(json.dumps(c,ensure_ascii=False)),3500)
            for field in ['problem','constraints','decisions','results','pitfalls','reproduction','environment','publication','evidence','exercise','sources','license']:self.assertTrue(c[field])
            self.assertGreaterEqual(len(c['reproduction']),4);self.assertGreaterEqual(len(c['sources']),3)
    def test_02_learning_and_reproduction_boundaries(self):
        for c in self.cases:
            self.assertEqual(c['status'],'待学习');self.assertEqual(c['reproduction_status'],'未本站实物复现')
            self.assertLessEqual(date.fromisoformat(c['last_verified']),date.fromisoformat(data('engineering-cases.json')['verified_at']))
        self.assertEqual([c['last_verified'] for c in self.cases],['2026-10-17']*3+['2026-10-18','2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23'])
        self.assertIn('拟议复现',self.html);self.assertIn('未编译或执行',self.html);self.assertIn('没有本案例的独立实测',self.html)
        self.assertNotIn('data-learning-complete',self.html);self.assertNotIn('learning-progress.js',self.html)
    def test_03_dates_are_separate(self):
        for c in self.cases:
            date.fromisoformat(c['last_verified']);self.assertNotEqual(c['publication'],c['last_verified'])
            for s in c['sources']:self.assertTrue(s['date']);self.assertTrue(s['kind'])
        self.assertIn('2021-05',self.cases[1]['publication']);self.assertIn('未标明发布日期',self.cases[0]['publication'])
    def test_04_evidence_not_universal_specifications(self):
        self.assertIn('不是 3.5°',self.html);self.assertIn('32 kSPS',self.html);self.assertIn('13.9 kHz',self.html)
        self.assertIn('23.8 µV rms',self.html);self.assertIn('33.2 µV rms',self.html);self.assertIn('MCLK/16',self.html)
        self.assertIn('不是新的实物测试',self.html);self.assertIn('0.38875038',self.html)
    def test_05_only_primary_source_hosts(self):
        hosts=set()
        for c in self.cases:
            for s in c['sources']:
                u=urlsplit(s['url']);self.assertEqual(u.scheme,'https');self.assertIn(u.hostname,self.renderer.HOSTS);hosts.add(u.hostname)
        self.assertGreaterEqual(len(hosts),5);self.assertEqual([s['url'] for c in self.cases for s in c['sources'] if urlsplit(s['url']).hostname=='github.com'],['https://github.com/scipy/scipy/blob/v1.16.0/LICENSE.txt', 'https://github.com/PX4/PX4-Autopilot/blob/30e763b6780061d70a14894e3e8b06e6a656f9b8/src/modules/ekf2/EKF/ekf.h#L1182-L1221', 'https://github.com/PX4/PX4-Autopilot/blob/30e763b6780061d70a14894e3e8b06e6a656f9b8/src/modules/ekf2/EKF/ekf_helper.cpp#L369-L499', 'https://github.com/PX4/PX4-Autopilot/releases/tag/v1.15.0', 'https://github.com/PX4/PX4-Autopilot/blob/30e763b6780061d70a14894e3e8b06e6a656f9b8/LICENSE'])
    def test_06_all_case_citations_resolve(self):
        allids=[]
        for c in self.cases:
            ids={s['id'] for s in c['sources']};allids+=list(ids)
            for field in ['constraints','decisions','results','pitfalls']:
                for b in c[field]:self.assertTrue(set(b.get('refs',[]))<=ids)
        self.assertEqual(len(allids),len(set(allids)))
    def test_07_html_ids_unique(self):
        self.assertEqual(len(self.doc.ids),len(set(self.doc.ids)))
        for c in self.cases:self.assertIn(c['id'],self.doc.ids)
    def test_08_local_links_and_fragments(self):
        for file in ['engineering-cases.html','exploration.html']:
            d=Doc(read(file))
            for href in d.links:
                u=urlsplit(href)
                if u.scheme or u.netloc:continue
                dest=ROOT/(unquote(u.path) or file);self.assertTrue(dest.is_file(),href)
                if u.fragment:self.assertIn(unquote(u.fragment),Doc(dest.read_text()).ids,href)
    def test_09_new_resources_exist(self):
        for s in self.doc.scripts+self.doc.styles:self.assertTrue((ROOT/urlsplit(s).path).is_file(),s)
        self.assertEqual(self.doc.styles[-1].split('?')[0],'river-experiments.css')
        self.assertEqual([x.split('?')[0] for x in self.doc.styles[-3:]],['river-design.css','river-reading.css','river-experiments.css'])
        self.assertIn('question-helper.js?v=20261020-cic-r1',self.doc.scripts)
    def test_09b_components_have_scoped_layout(self):
        css=read('engineering-cases.css')
        self.assertIn('.engineering-cases-page .case-chain{display:flex;flex-wrap:wrap',css)
        self.assertIn('.engineering-cases-page .case-transfer .project-links{display:flex;flex-wrap:wrap',css)
        self.assertIn('max-width:700px',css)
    def test_10_existing_navigation(self):
        nav=re.search(r'<nav\b[^>]*\bclass="[^"]*\barchitecture-nav\b[^"]*"[^>]*>.*?</nav>',self.html,re.S).group()
        links=Doc(nav).links
        self.assertEqual(links,['knowledge.html','simulation.html','next-learning.html','exploration.html'])
        self.assertEqual(nav.count('aria-current="page"'),1)
    def test_11_catalog_schema_and_required_fields(self):
        self.assertEqual(self.catalog['schema_version'],1);self.assertEqual(len(self.catalog['projects']),11)
        required=set(self.catalog['projects'][0])
        # Keep the original catalog entries; later reading cases live in the page index.
        for c in self.cases[:3]:
            p=next(p for p in self.catalog['projects'] if p['id']==c['id'])
            self.assertTrue(required<=set(p));self.assertEqual(p['status'],'待学习');self.assertEqual(p['reproduction_status'],'未在本站复现')
            self.assertEqual(p['learning_links'][0]['url'],'engineering-cases.html#'+c['id'])
    def test_12_deterministic_builds(self):
        for script,output in [('build-engineering-cases.py','engineering-cases.html'),('build-exploration.py','exploration.html')]:
            before=(ROOT/output).read_bytes();subprocess.run([sys.executable,str(ROOT/script)],check=True,capture_output=True);self.assertEqual(before,(ROOT/output).read_bytes())
    def test_13_url_validation_rejects_unsafe_values(self):
        for m in [self.renderer,self.explore]:
            func=getattr(m,'url',getattr(m,'safe_url',None))
            for v in ['javascript:alert(1)','https://evil.example/a','https://www.ti.com@evil.example/a','https://www.ti.com:443/a','https://www.ti.com/a\nx']:
                with self.assertRaises(ValueError,msg=v):func(v,True)
            for v in ['../index.html','//evil.example/a','javascript:alert(1)','evil.html']:
                with self.assertRaises(ValueError,msg=v):func(v)
    def test_14_escape_content(self):
        self.assertEqual(self.renderer.txt('<img src=x onerror="bad">'),'&lt;img src=x onerror=&quot;bad&quot;&gt;')
    def test_15_reading_page_no_data_collection(self):
        self.assertFalse(any(not s for s in self.doc.scripts))
        self.assertNotRegex(self.html,r'<(?:form|iframe|object|embed)\b')
        for c in self.cases:self.assertNotRegex(json.dumps(c),r'file:///|/workspace/|localhost|@gmail|@openai')
    def test_16_ti_arithmetic_on_public_numbers(self):
        # TIDU616 p.6 Table 3: numeric data only; arithmetic, never a new physical test.
        h=[39,70,98,133,164,212.5,271,402,457.5,550,630,760,781,876]
        t=[51.42,93.05,129.57,175.85,220.77,285.57,365.10,539.41,613.59,738.05,845.89,1018.77,1047.61,1174.43]
        e=[x-y*1491.50/2000 for x,y in zip(h,t)]
        self.assertAlmostEqual(sum(map(abs,e))/len(e),.6514410714285671,12)
        self.assertAlmostEqual(sum(e)/len(e),.05079214285713819,12)
        self.assertAlmostEqual(sum(abs(y)/x*100 for x,y in zip(h,e))/len(e),.4853390815996133,12)
        self.assertAlmostEqual(1491.5/2000,.74575,12)
        self.assertGreater(abs(sum(map(abs,e))/len(e)-.38875038),.2)
    def test_17_knowledge_alias(self):
        self.assertEqual((ROOT/'index.html').read_bytes(),(ROOT/'knowledge.html').read_bytes())
        for c in self.cases[:3]:self.assertIn('engineering-cases.html#'+c['id'],read('index.html'))
        for c in self.cases:self.assertIn('#'+c['id'],self.doc.links)
        hardware=[a for tag,a in Doc(read('index.html')).tags if tag=='a' and a.get('href')=='hardware-filters.html' and 'studio-topic' in a.get('class','').split()]
        self.assertEqual(len(hardware),1,'The homepage subject index must retain the hardware topic entry')
    @unittest.skipUnless(BASE,'Pass --baseline DIR for preservation checks')
    def test_18_all_unrelated_files_preserved(self):
        changed={'engineering-cases.json','engineering-cases.html','build-engineering-cases.py','test-engineering-cases.py','question-helper.js','test-question-helper.cjs'}
        for p in BASE.iterdir():
            if p.is_file() and p.name not in changed:self.assertEqual(p.read_bytes(),(ROOT/p.name).read_bytes(),p.name)
        self.assertEqual(len(list(BASE.glob('*.html'))),len(list(ROOT.glob('*.html'))))
        self.assertTrue(all((ROOT/p.name).exists() for p in BASE.glob('*.html')))
    def test_18a_question_helper_case_context(self):
        subprocess.run(['node',str(ROOT/'test-question-helper.cjs')],check=True,capture_output=True)
    @unittest.skipUnless(BASE,'Pass --baseline DIR for preservation checks')
    def test_18b_question_helper_preserved(self):
        guard="    if(file==='engineering-cases.html')return '';\n"
        helper=read('question-helper.js')
        self.assertEqual(helper.count(guard),1)
        self.assertEqual(helper,(BASE/'question-helper.js').read_text())
    @unittest.skipUnless(BASE,'Pass --baseline DIR for preservation checks')
    def test_19_existing_lesson_html_byte_preserved(self):
        for name in ['index.html','knowledge.html']:
            self.assertEqual((ROOT/name).read_bytes(),(BASE/name).read_bytes())
    @unittest.skipUnless(BASE,'Pass --baseline DIR for preservation checks')
    def test_20_existing_catalog_entries_preserved(self):
        for name in ['exploration-catalog.json','exploration.html','build-exploration.py']:
            self.assertEqual((ROOT/name).read_bytes(),(BASE/name).read_bytes())
    @unittest.skipUnless(BASE,'Pass --baseline DIR for preservation checks')
    def test_21_existing_cases_unchanged(self):
        old=json.loads((BASE/'engineering-cases.json').read_text())
        self.assertEqual(self.cases[:len(old['cases'])],old['cases'])
        for c in old['cases']:
            pattern=r'<article class="case-study" id="'+re.escape(c['id'])+r'".*?</article>'
            self.assertEqual(re.search(pattern,self.html,re.S).group(),re.search(pattern,(BASE/'engineering-cases.html').read_text(),re.S).group())
    def test_22_fixed_point_case_contracts(self):
        case=next(c for c in self.cases if c['id']=='ti-fixed-point-fft');text=json.dumps(case,ensure_ascii=False)
        for token in ['1.30.00.02','MSP430FR5994','512 字节','1792 字节','31.25 ms','15.625 ms','MSP_LEA_INVALID_ADDRESS','MSP_LEA_INCORRECT_REVISION','Software Manifest','未确认','无本站或独立第三方板卡实测']:
            self.assertIn(token,text)
        self.assertIn('工程阅读 / 9 个案例',self.html)
        self.assertNotIn('第一批 3 个案例',self.html)
        self.assertEqual(case['id'],'ti-fixed-point-fft')
        self.assertNotIn(case['id'],[p['id'] for p in self.catalog['projects']])
    def test_23_own_fft_model_not_vendor_execution(self):
        # Independent ideal DFT only: no Q15 kernel, vendor source or hardware.
        n,fs,amplitude,k=256,8192,.5,32
        signal=[amplitude*math.cos(2*math.pi*k*i/n) for i in range(n)]
        coefficient=sum(x*cmath.exp(-2j*math.pi*k*i/n) for i,x in enumerate(signal))
        fixed=abs(coefficient)/(n/2)
        self.assertAlmostEqual(abs(coefficient),64,10)
        self.assertAlmostEqual(fixed,.5,12)
        self.assertAlmostEqual(2*fixed/n,.00390625,12)
        self.assertAlmostEqual(fixed/(2*fixed/n),128,12)
        self.assertEqual(fs/n,32);self.assertEqual(k*fs/n,1024)
        self.assertEqual(200/(fs/n),6.25);self.assertEqual(2100/(fs/n),65.625)
        self.assertEqual(n/fs*1000,31.25);self.assertEqual((n/2)/fs*1000,15.625)
        self.assertEqual((256+256+384)*2,1792)
        self.assertEqual(2*n,512)
    def test_24_new_primary_host_still_strict(self):
        self.renderer.url('https://software-dl.ti.com/msp430/',True)
        for value in ['https://software-dl.ti.com.evil.example/x','https://software-dl.ti.com@evil.example/x','http://software-dl.ti.com/x']:
            with self.assertRaises(ValueError):self.renderer.url(value,True)
    def test_25_biquad_case_evidence_and_migration_contract(self):
        c=next(c for c in self.cases if c['id']=='arm-biquad-state-precision')
        content=json.dumps(c,ensure_ascii=False)
        for token in ['1.14.3','2023-01-20','postShift','1.99798583984375','0.998992919921875','168 字节','32 ms','未下载、编译或执行','不是整机应用报告','LICENSE.txt','Apache 2.0','无本站或独立第三方板卡实测']:
            self.assertIn(token,content)
        self.assertEqual(c['last_verified'],'2026-10-19')
        self.assertNotIn(c['id'],[p['id'] for p in self.catalog['projects']])
        self.assertTrue(all('/v1.14.3/' in s['url'] for s in c['sources'] if 'arm-software.github.io' in s['url']))
        self.assertEqual({urlsplit(s['url']).hostname for s in c['sources']},{'arm-software.github.io','www.keil.arm.com'})
        self.assertIn('knowledge.html?topic=iir-fir',[link['url'] for link in c['learning_links']])
        self.assertIn('没有模拟 CMSIS-DSP',content)
    @staticmethod
    def own_df1(samples,coeffs,state=(0.,0.,0.,0.)):
        # Original ideal recurrence, not a vendor implementation or Q15 emulator.
        # Keep one explicit state per stream; do not download or execute CMSIS-DSP.
        b0,b1,b2,a1,a2=coeffs;x1,x2,y1,y2=state;out=[]
        for x in samples:
            y=b0*x+b1*x1+b2*x2+a1*y1+a2*y2
            out.append(y);x1,x2,y1,y2=x,x1,y,y1
        return out,(x1,x2,y1,y2)
    def test_26_own_biquad_exact_baseline_and_wrong_sign(self):
        coeffs=[.0625,0,0,1.5,-.5625]
        stored=[round(c*2**14) for c in coeffs]
        self.assertEqual(stored,[1024,0,0,24576,-9216])
        self.assertEqual([stored[0],0,*stored[1:]],[1024,0,0,0,24576,-9216])
        self.assertEqual([c/2**14 for c in stored],coeffs)
        response,_=self.own_df1([.25,0,0,0],coeffs)
        self.assertEqual(response,[.015625,.0234375,.0263671875,.0263671875])
        self.assertEqual([y*2**15 for y in response],[512,768,864,864])
        self.assertEqual(coeffs[0]/(1-coeffs[3]-coeffs[4]),1)
        a1,a2=-1.5,.5625
        poles=[(a1+cmath.sqrt(a1*a1+4*a2))/2,(a1-cmath.sqrt(a1*a1+4*a2))/2]
        self.assertAlmostEqual(poles[0].real,.3106601717798212,14)
        self.assertAlmostEqual(poles[1].real,-1.8106601717798212,14)
        self.assertGreater(max(map(abs,poles)),1.8)
    def test_27_own_near_unit_coefficient_failure(self):
        # Exact decimal rational inputs, nearest-integer conversion only.
        from fractions import Fraction as F
        r=F(999,1000)
        q=[round(c*2**14) for c in [(1-r)**2,0,0,2*r,-r*r]]
        self.assertEqual(q,[0,0,0,32735,-16351])
        b0,b1,b2,a1,a2=[F(c,2**14) for c in q]
        self.assertEqual(b0,0);self.assertEqual(a1+a2,1)
        # Characteristic polynomial has roots 1 and 16351/16384.
        for z in [F(1),F(16351,16384)]:self.assertEqual(z*z-a1*z-a2,0)
        output,_=self.own_df1([.25,-.25,.125]*20,list(map(float,[b0,b1,b2,a1,a2])))
        self.assertEqual(output,[0.]*60)
        # Own floor-quantized positive-state recurrence. No claim of vendor bit equivalence.
        y1=y2=64
        for _ in range(128):
            y=(q[3]*y1+q[4]*y2)//2**14
            self.assertEqual(y,64);y1,y2=y,y1
    def test_28_own_cascade_preserves_nonzero_input_and_dc(self):
        from fractions import Fraction as F
        r=F(999,1000);b=round((1-r)*2**15);a=round(r*2**15)
        self.assertEqual([b,0,0,0,a,0],[33,0,0,0,32735,0])
        self.assertGreater(b,0);self.assertLess(F(a,2**15),1)
        self.assertEqual(F(a,2**15),F('0.998992919921875'))
        self.assertEqual((F(b,2**15)/(1-F(a,2**15)))**2,1)
        self.assertNotEqual(F(a,2**15),r)
        y=64
        for _ in range(64):y=a*y//2**15
        self.assertEqual(y,0)
    def test_29_own_stream_block_and_channel_invariants(self):
        coeffs=[.0625,0,0,1.5,-.5625]
        a=[.25]+[0.]*63;b=[0.]*8+[-.125]*56
        expected,final=self.own_df1(a,coeffs)
        state=(0.,0.,0.,0.);chunked=[];offset=0
        for size in [1,7,24,32]:
            part,state=self.own_df1(a[offset:offset+size],coeffs,state)
            chunked.extend(part);offset+=size
        self.assertEqual(offset,len(a));self.assertEqual(chunked,expected);self.assertEqual(state,final)
        reset_output=[];offset=0
        for size in [1,7,24,32]:
            part,_=self.own_df1(a[offset:offset+size],coeffs)
            reset_output.extend(part);offset+=size
        self.assertNotEqual(reset_output,expected);self.assertEqual(reset_output[1],0)
        states=[(0.,0.,0.,0.)]*2;outputs=[[],[]]
        for i in range(64):
            for channel,samples in enumerate([a,b]):
                part,states[channel]=self.own_df1([samples[i]],coeffs,states[channel])
                outputs[channel].extend(part)
        self.assertEqual(outputs,[self.own_df1(samples,coeffs)[0] for samples in [a,b]])
        self.assertEqual(self.own_df1(a,coeffs)[0],expected)
    def test_30_biquad_memory_and_service_budget(self):
        self.assertEqual((6+4)*2,20)
        self.assertEqual((6+4)*2*2,40)
        self.assertEqual((6+4)*2*2+2*32*2,168)
        self.assertEqual(32/1000*1000,32)
    def test_31_arm_source_host_validation_is_exact(self):
        for value in ['https://arm-software.github.io/CMSIS-DSP/v1.14.3/index.html','https://www.keil.arm.com/packs/cmsis-dsp-arm/versions/']:
            self.renderer.url(value,True)
        for host in ['arm-software.github.io','www.keil.arm.com']:
            for value in [f'https://{host}.evil.example/a',f'https://{host}@evil.example/a',f'http://{host}/a',f'https://{host}:443/a']:
                with self.assertRaises(ValueError):self.renderer.url(value,True)
        with self.assertRaises(ValueError):self.renderer.url('https://other.github.io/CMSIS-DSP/v1.14.3/index.html',True)
    def test_32_biquad_keeps_general_question_context(self):
        script="const a=require('node:assert/strict'),h=require('./question-helper.js');a.equal(h.inferTopic('/engineering-cases.html','','#arm-biquad-state-precision',''),'');a.equal(h.inferTopic('/engineering-cases.html','?topic=iir-fir','#arm-biquad-state-precision',''),'iir-fir');"
        subprocess.run(['node','-e',script],cwd=ROOT,check=True,capture_output=True)
    def test_33_cic_evidence_scope_and_source_contract(self):
        c=next(c for c in self.cases if c['id']=='amd-cic-decimation-contract')
        content=json.dumps(c,ensure_ascii=False)
        for token in ['PG140','2026-07-22','2026-10-20','25 位','48 kSPS','6 kSPS','218.75 µs','150 位','162000','0.8726587924','0.007350932944','0.8423605','38.510 dB','未下载、编译或执行','无本站或独立第三方板卡实测','End User License','未接受协议','不是厂商规格']:
            self.assertIn(token,content)
        self.assertEqual(c['status'],'待学习')
        self.assertNotIn(c['id'],[p['id'] for p in self.catalog['projects']])
        self.assertEqual({urlsplit(s['url']).hostname for s in c['sources']},{'docs.amd.com'})
        self.assertTrue(all('/pg140-cic-compiler/' in s['url'] and 'contentId=' in s['url'] for s in c['sources']))
        self.assertEqual(data('engineering-cases.json')['verified_at'],'2026-10-23')
    @staticmethod
    def own_cic_coefficients():
        # Original finite convolution, no AMD model/HDL/code or copied coefficients.
        coefficients=[1]
        for _ in range(3):
            next_coefficients=[0]*(len(coefficients)+7)
            for i,value in enumerate(coefficients):
                for j in range(8):next_coefficients[i+j]+=value
            coefficients=next_coefficients
        return coefficients
    @classmethod
    def own_cic_fir(cls,samples):
        h=cls.own_cic_coefficients()
        # Exactly n=7,15,23,...; zero before input; no appended tail samples.
        return [sum(h[k]*samples[n-k] for k in range(min(len(h),n+1))) for n in range(7,len(samples),8)]
    @staticmethod
    def own_cic(samples,bits=None,saturate=False,state=None):
        # Original accepted-sample recurrence: N=3, R=8, M=1. No IP pipeline,
        # bit pruning or AXI buffering. Explicit modulo avoids undefined overflow.
        state=state or {'integrators':[0]*3,'comb':[0]*3,'count':0,'range_events':0}
        integrators=state['integrators'][:];comb=state['comb'][:]
        count=state['count'];range_events=state['range_events'];output=[]
        def cast(value):
            nonlocal range_events
            if bits is None:return value
            half=1<<(bits-1)
            if not -half<=value<half:range_events+=1
            return max(-half,min(half-1,value)) if saturate else (value+half)%(2*half)-half
        for sample in samples:
            value=sample
            for stage in range(3):
                integrators[stage]=cast(integrators[stage]+value)
                value=integrators[stage]
            count+=1
            if count==8:
                count=0
                for stage in range(3):
                    previous_input=value
                    value=cast(value-comb[stage]);comb[stage]=previous_input
                output.append(value)
        return output,{'integrators':integrators,'comb':comb,'count':count,'range_events':range_events}
    @staticmethod
    def own_cic_magnitude(frequency):
        if frequency==0:return 1.
        return abs(math.sin(math.pi*frequency*8/48000)/(8*math.sin(math.pi*frequency/48000)))**3
    def test_34_cic_finite_response_and_budget(self):
        h=self.own_cic_coefficients()
        self.assertEqual(h,[1,3,6,10,15,21,28,36,42,46,48,48,46,42,36,28,21,15,10,6,3,1])
        self.assertEqual(len(h),22);self.assertEqual(h,h[::-1]);self.assertEqual(sum(h),512)
        self.assertEqual(16+math.ceil(math.log2(sum(h))),25)
        self.assertEqual((len(h)-1)/2/48000*1e6,218.75)
        self.assertEqual(48000/8,6000)
        self.assertEqual((3+3)*25,150)
        self.assertEqual(3*48000+3*6000,162000)
        for value in [-32768,32767]:
            peak=value*sum(h)
            self.assertGreaterEqual(peak,-2**24);self.assertLessEqual(peak,2**24-1)
    def test_35_cic_frequency_and_alias_budget_reject_candidate(self):
        h=self.own_cic_coefficients()
        for frequency in [0,500,1000,3000,5000,5500,6000,12000,18000,24000]:
            from_fir=abs(sum(value*cmath.exp(-2j*math.pi*frequency*k/48000) for k,value in enumerate(h)))/512
            self.assertAlmostEqual(from_fir,self.own_cic_magnitude(frequency),13)
        desired=self.own_cic_magnitude(1000);interference=self.own_cic_magnitude(5000)
        self.assertAlmostEqual(desired,.872658792443122,14)
        self.assertAlmostEqual(interference,.007350932944101025,15)
        self.assertAlmostEqual(20*math.log10(desired),-1.183110624749309,12)
        self.assertAlmostEqual(20*math.log10(interference),-42.67315077814558,12)
        self.assertAlmostEqual(100*interference/desired,.8423604973395307,13)
        self.assertAlmostEqual(20*math.log10(100*interference/desired/.01),38.50995984660373,11)
        self.assertLess(20*math.log10(desired),-.5)
        self.assertGreater(100*interference/desired,.01)
        self.assertEqual(abs((5000+3000)%6000-3000),1000)
        # Direct filtered tones, then decimate: both appear at the same 1 kHz
        # output bin. Separate contributions; no unsupported phase summation.
        for frequency,amplitude in [(1000,1),(5000,100)]:
            samples=[amplitude*math.cos(2*math.pi*frequency*n/48000) for n in range(768)]
            output=[v/512 for v in self.own_cic_fir(samples)][6:]
            self.assertEqual(len(output),90)  # 15 complete output cycles, transient excluded.
            measured=2/len(output)*abs(sum(value*cmath.exp(-2j*math.pi*1000*m/6000) for m,value in enumerate(output)))
            self.assertAlmostEqual(measured,amplitude*self.own_cic_magnitude(frequency),11)
    def test_36_cic_full_width_modulo_matches_independent_fir(self):
        import random
        rng=random.Random(20261020)
        streams=[[32767]*128,[-32768]*128,[0]*128,
                 [rng.randrange(-32768,32768) for _ in range(4096)]]
        streams += [[0]*phase+[32767]+[0]*(127-phase) for phase in range(8)]
        for samples in streams:
            expected=self.own_cic_fir(samples)
            unbounded,_=self.own_cic(samples)
            actual,state=self.own_cic(samples,bits=25)
            self.assertEqual(actual,expected);self.assertEqual(unbounded,expected)
            self.assertEqual(len(actual),len(samples)//8)
            self.assertEqual(state['count'],len(samples)%8)
        _,state=self.own_cic([32767]*128,bits=25)
        self.assertGreater(state['range_events'],0,'Must exercise actual modulo boundaries')
    def test_37_cic_saturation_and_insufficient_width_are_failures(self):
        samples=[32767]*128;reference=self.own_cic_fir(samples)
        self.assertEqual(reference[:3],[3932040,14941752,16776704])
        self.assertEqual(reference[2:],[16776704]*14)
        narrowed,_=self.own_cic(samples,bits=24)
        saturated,_=self.own_cic(samples,bits=25,saturate=True)
        self.assertNotEqual(narrowed,reference);self.assertEqual(narrowed[2:],[-512]*14)
        self.assertNotEqual(saturated,reference);self.assertEqual(saturated[-4:],[0]*4)
        negative,_=self.own_cic([-32768]*128,bits=25)
        self.assertEqual(negative[2:],[-16777216]*14)
    def test_38_cic_block_phase_is_part_of_state(self):
        samples=[(i*997)%65536-32768 for i in range(128)]
        expected,final=self.own_cic(samples,bits=25)
        state=None;actual=[];offset=0
        for size in [1,7,13,2,37,68]:
            part,state=self.own_cic(samples[offset:offset+size],bits=25,state=state)
            actual.extend(part);offset+=size
        self.assertEqual(offset,len(samples));self.assertEqual(actual,expected);self.assertEqual(state,final)
        state=None;wrong=[];offset=0
        for size in [1,7,13,2,37,68]:
            if state:state['count']=0  # Negative case: keep values but lose decimation phase.
            part,state=self.own_cic(samples[offset:offset+size],bits=25,state=state)
            wrong.extend(part);offset+=size
        self.assertNotEqual(wrong,expected)
        for length in range(33):
            output,state=self.own_cic(samples[:length],bits=25)
            self.assertEqual(len(output),length//8);self.assertEqual(state['count'],length%8)
    def test_39_cic_wait_cycles_do_not_create_samples(self):
        samples=[(i*937)%5000-2500 for i in range(137)]
        # Synthetic channel trace, not AMD AXI simulation: idle, held payload,
        # then one acceptance per sample. Count only valid AND ready.
        cycles=[]
        for index,sample in enumerate(samples):
            cycles.append((False,True,0))
            cycles.extend([(True,False,sample)]*(index%3))
            cycles.append((True,True,sample))
        accepted=[sample for valid,ready,sample in cycles if valid and ready]
        wrongly_repeated=[sample for valid,ready,sample in cycles if valid]
        self.assertEqual(accepted,samples)
        reference=self.own_cic(samples,bits=25)
        self.assertEqual(self.own_cic(accepted,bits=25),reference)
        self.assertNotEqual(self.own_cic(wrongly_repeated,bits=25)[0],reference[0])
    def test_40_cic_host_validation_remains_exact(self):
        self.renderer.url('https://docs.amd.com/r/en-US/pg140-cic-compiler/CIC-Decimator',True)
        for value in ['https://docs.amd.com.evil.example/a','https://docs.amd.com@evil.example/a','http://docs.amd.com/a','https://docs.amd.com:443/a','https://download.amd.com/a']:
            with self.assertRaises(ValueError):self.renderer.url(value,True)
    def test_41_px4_source_contract_and_model(self):
        c=next(c for c in self.cases if c['id']=='px4-innovation-gating-contract')
        text=json.dumps(c,ensure_ascii=False)
        for token in ['30e763b6780061d70a14894e3e8b06e6a656f9b8','2024-09-18','3.418803','13.675214','null','BSD-3-Clause','CC BY 4.0','Joseph','NIS']:
            self.assertIn(token,text)
        subprocess.run([sys.executable,str(ROOT/'test-innovation-gate.py')],check=True,capture_output=True)
        self.assertNotIn(c['id'],[p['id'] for p in self.catalog['projects']])
        for host in ['docs.px4.io','api.github.com']:
            for bad in [f'https://{host}.evil.example/a',f'https://{host}@evil.example/a',f'http://{host}/a',f'https://{host}:443/a',f'https://{host}/unreviewed']:
                with self.assertRaises(ValueError):self.renderer.url(bad,True)
        with self.assertRaises(ValueError):self.renderer.url('https://github.com/PX4/PX4-Autopilot/blob/main/LICENSE',True)
    def test_42_allan_original_model_and_content_contract(self):
        c=next(c for c in self.cases if c['id']=='nxp-allan-averaging-contract')
        text=json.dumps(c,ensure_ascii=False)
        for token in ['AN5087','2015-02','2008-07-01','K−2m+1','K+1','1.095445115','0.495 s','没有由公开曲线','未实现置信区间','不是白噪声']:
            self.assertIn(token,text)
        subprocess.run([sys.executable,str(ROOT/'test-allan-model.py')],check=True,capture_output=True)
        for host in ['nvlpubs.nist.gov','www.nist.gov']:
            for bad in [f'https://{host}.evil.example/a',f'https://{host}@evil.example/a',f'http://{host}/a',f'https://{host}:443/a']:
                with self.assertRaises(ValueError):self.renderer.url(bad,True)
        self.assertNotIn(c['id'],[p['id'] for p in self.catalog['projects']])
if __name__=='__main__':unittest.main(verbosity=2)
