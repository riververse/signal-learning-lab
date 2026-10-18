#!/usr/bin/env python3
"""Offline content/build checks. Optional --baseline DIR verifies preservation.

These checks do not run vendor code, access hardware or claim browser visual QA.
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
    def test_01_four_substantial_distinct_cases(self):
        self.assertEqual(len(self.cases),4);self.assertEqual(len({x['vendor'] for x in self.cases}),3)
        self.assertEqual([c['id'] for c in self.cases],['nxp-magnetic-calibration','adi-vibration-chain','ti-ultrasonic-level','ti-fixed-point-fft'])
        for c in self.cases:
            self.assertGreater(len(json.dumps(c,ensure_ascii=False)),3500)
            for field in ['problem','constraints','decisions','results','pitfalls','reproduction','environment','publication','evidence','exercise','sources','license']:self.assertTrue(c[field])
            self.assertGreaterEqual(len(c['reproduction']),4);self.assertGreaterEqual(len(c['sources']),3)
    def test_02_learning_and_reproduction_boundaries(self):
        for c in self.cases:
            self.assertEqual(c['status'],'待学习');self.assertEqual(c['reproduction_status'],'未本站实物复现')
            self.assertLessEqual(date.fromisoformat(c['last_verified']),date.fromisoformat(data('engineering-cases.json')['verified_at']))
        self.assertEqual([c['last_verified'] for c in self.cases],['2026-10-17']*3+['2026-10-18'])
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
        self.assertGreaterEqual(len(hosts),5);self.assertNotIn('github.com',hosts)
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
        self.assertEqual(self.doc.styles[-1].split('?')[0],'signal-design.css')
        self.assertIn('question-helper.js?v=20261017-cases-r2',self.doc.scripts)
    def test_09b_components_have_scoped_layout(self):
        css=read('engineering-cases.css')
        self.assertIn('.engineering-cases-page .case-chain{display:flex;flex-wrap:wrap',css)
        self.assertIn('.engineering-cases-page .case-transfer .project-links{display:flex;flex-wrap:wrap',css)
        self.assertIn('max-width:700px',css)
    def test_10_existing_navigation(self):
        nav=re.search(r'<nav class="architecture-nav".*?</nav>',self.html,re.S).group()
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
        self.assertIn('topic-card--hardware',read('index.html'))
    @unittest.skipUnless(BASE,'Pass --baseline DIR for preservation checks')
    def test_18_all_unrelated_files_preserved(self):
        changed={'engineering-cases.json','engineering-cases.html','build-engineering-cases.py','test-engineering-cases.py'}
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
        case=self.cases[-1];text=json.dumps(case,ensure_ascii=False)
        for token in ['1.30.00.02','MSP430FR5994','512 字节','1792 字节','31.25 ms','15.625 ms','MSP_LEA_INVALID_ADDRESS','MSP_LEA_INCORRECT_REVISION','Software Manifest','未确认','无本站或独立第三方板卡实测']:
            self.assertIn(token,text)
        self.assertIn('工程阅读 / 4 个案例',self.html)
        self.assertNotIn('第一批 3 个案例',self.html)
        self.assertEqual(self.cases[-1]['id'],'ti-fixed-point-fft')
        self.assertNotIn(self.cases[-1]['id'],[p['id'] for p in self.catalog['projects']])
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
if __name__=='__main__':unittest.main(verbosity=2)
