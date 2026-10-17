#!/usr/bin/env python3
"""Offline content/build checks. Optional --baseline DIR verifies preservation.

These checks do not run vendor code, access hardware or claim browser visual QA.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
from datetime import date
import importlib.util,json,re,sys,unittest,subprocess,hashlib
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
    def test_01_three_substantial_distinct_cases(self):
        self.assertEqual(len(self.cases),3);self.assertEqual(len({x['vendor'] for x in self.cases}),3)
        for c in self.cases:
            self.assertGreater(len(json.dumps(c,ensure_ascii=False)),3500)
            for field in ['problem','constraints','decisions','results','pitfalls','reproduction','environment','publication','evidence','exercise','sources','license']:self.assertTrue(c[field])
            self.assertGreaterEqual(len(c['reproduction']),4);self.assertGreaterEqual(len(c['sources']),3)
    def test_02_learning_and_reproduction_boundaries(self):
        for c in self.cases:
            self.assertEqual(c['status'],'待学习');self.assertEqual(c['reproduction_status'],'未本站实物复现');self.assertEqual(c['last_verified'],'2026-10-17')
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
        for c in self.cases:
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
        for c in self.cases:self.assertIn('engineering-cases.html#'+c['id'],read('index.html'))
        self.assertIn('topic-card--hardware',read('index.html'))
    @unittest.skipUnless(BASE,'Pass --baseline DIR for preservation checks')
    def test_18_all_unrelated_files_preserved(self):
        changed={'index.html','knowledge.html','build-exploration.py','exploration-catalog.json','exploration.html','question-helper.js'}
        for p in BASE.iterdir():
            if p.is_file() and p.name not in changed:self.assertEqual(p.read_bytes(),(ROOT/p.name).read_bytes(),p.name)
        self.assertEqual(len(list(BASE.glob('*.html'))),16)
        self.assertTrue(all((ROOT/p.name).exists() for p in BASE.glob('*.html')))
    def test_18a_question_helper_case_context(self):
        subprocess.run(['node',str(ROOT/'test-question-helper.cjs')],check=True,capture_output=True)
    @unittest.skipUnless(BASE,'Pass --baseline DIR for preservation checks')
    def test_18b_question_helper_additive_guard_only(self):
        guard="    if(file==='engineering-cases.html')return '';\n"
        helper=read('question-helper.js')
        self.assertEqual(helper.count(guard),1)
        self.assertEqual(helper.replace(guard,'',1),(BASE/'question-helper.js').read_text())
    @unittest.skipUnless(BASE,'Pass --baseline DIR for preservation checks')
    def test_19_existing_lesson_html_byte_preserved(self):
        s=re.sub(r'<!-- engineering-cases:addition -->.*?<!-- /engineering-cases:addition -->','',read('index.html'),flags=re.S)
        self.assertEqual(s,(BASE/'index.html').read_text())
    @unittest.skipUnless(BASE,'Pass --baseline DIR for preservation checks')
    def test_20_existing_catalog_entries_preserved(self):
        old=json.loads((BASE/'exploration-catalog.json').read_text())
        for key in ['schema_version','categories','scope','radar_guide']:self.assertEqual(self.catalog[key],old[key],key)
        self.assertEqual(self.catalog['projects'][:len(old['projects'])],old['projects'])
        self.assertEqual(self.catalog['recent_updates'][:len(old['recent_updates'])],old['recent_updates'])
if __name__=='__main__':unittest.main(verbosity=2)
