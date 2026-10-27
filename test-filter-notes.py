#!/usr/bin/env python3
"""Offline checks for reorganized filter notes; no hardware or candidate code."""
import cmath
from collections import Counter
from html.parser import HTMLParser
import json
import math
from pathlib import Path
import unittest
from urllib.parse import urlsplit, unquote
ROOT=Path(__file__).resolve().parent
class Document(HTMLParser):
    def __init__(self,text):
        super().__init__();self.ids=[];self.links=[];self.feed(text)
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if 'id' in d:self.ids.append(d['id'])
        if tag=='a' and 'href' in d:self.links.append(d['href'])
class Filters(unittest.TestCase):
    def test_ema_exact_halfpower_and_scale(self):
        def design(fs,fc):
            d=1-math.cos(2*math.pi*fc/fs)
            return math.sqrt(d*d+2*d)-d
        a=design(1000,10)
        self.assertAlmostEqual(a,.0608792299230623,14)
        self.assertEqual(a,design(2000,20))
        h=a/(1-(1-a)*cmath.exp(-2j*math.pi*10/1000))
        self.assertAlmostEqual(abs(h)**2,.5,13)
        self.assertAlmostEqual(20*math.log10(abs(h)),-3.010299956639812,11)
        self.assertAlmostEqual(design(1000,500),2*(math.sqrt(2)-1),14)
        self.assertGreater(.9/(2-.9),1/math.sqrt(2))
    def test_biquad_signs_poles_and_response(self):
        k=math.tan(math.pi*50/1000);d=1+math.sqrt(2)*k+k*k
        b=[k*k/d,2*k*k/d,k*k/d];a=[1,2*(k*k-1)/d,(1-math.sqrt(2)*k+k*k)/d]
        for got,want in zip(b,[.02008336556421,.04016673112842,.02008336556421]):self.assertAlmostEqual(got,want,13)
        self.assertAlmostEqual(a[1],-1.56101807580072,13)
        self.assertAlmostEqual(a[2],.64135153805756,13)
        pole=(-a[1]+cmath.sqrt(a[1]**2-4*a[2]))/2
        self.assertAlmostEqual(abs(pole),.80084426579552,13)
        for f,want in [(10,-.006726),(20,-.106805),(50,-3.010300),(100,-12.721074),(200,-26.471738)]:
            z=cmath.exp(-2j*math.pi*f/1000)
            h=sum(v*z**i for i,v in enumerate(b))/sum(v*z**i for i,v in enumerate(a))
            self.assertAlmostEqual(20*math.log10(abs(h)),want,5)
        # Difference equation: negative stored a1 is subtracted once.
        x1=x2=y1=y2=0
        out=[]
        for x in [1,0,0]:
            y=b[0]*x+b[1]*x1+b[2]*x2-a[1]*y1-a[2]*y2
            out.append(y);x2,x1=x1,x;y2,y1=y1,y
        self.assertAlmostEqual(out[1],b[1]-a[1]*b[0],14)
    def test_order_and_two_constraints(self):
        ratio=math.tan(math.pi*100/1000)/math.tan(math.pi*50/1000)
        n=math.ceil(math.log((10**4-1)/(10**.1-1))/(2*math.log(ratio)))
        self.assertEqual(n,8)
        fcmax=1000/math.pi*math.atan(math.tan(math.pi*100/1000)/(10**4-1)**.25)
        fcmin=1000/math.pi*math.atan(math.tan(math.pi*50/1000)/(10**.1-1)**.25)
        self.assertAlmostEqual(fcmax,10.3391,4);self.assertAlmostEqual(fcmin,69.5473,4)
        self.assertLess(fcmax,fcmin)
    def test_pages_unique_ids_local_deep_links_and_privacy(self):
        for name in ['notes-iir-fir.html','notes-filter-families.html']:
            text=(ROOT/name).read_text();doc=Document(text)
            self.assertEqual(len(doc.ids),len(set(doc.ids)),name)
            self.assertNotIn('chatgpt.com/c/',text);self.assertNotIn('chatgpt.com/g/',text)
            self.assertIn('独立',text);self.assertIn('待',text)
            for link in doc.links:
                u=urlsplit(link)
                if u.scheme or u.netloc:continue
                target=ROOT/(unquote(u.path) or name)
                self.assertTrue(target.is_file(),link)
                if u.fragment:self.assertIn(unquote(u.fragment),Document(target.read_text()).ids,link)
        doc=Document((ROOT/'notes-iir-fir.html').read_text())
        for anchor in ['filter-start','filter-impulse','filter-coefficients','filter-frequency','filter-ema','filter-average','filter-boundaries','filter-check','filter-sources','filter-ema-derivation']:self.assertIn(anchor,doc.ids)
        profile=json.loads((ROOT/'learning-profile.json').read_text())
        for lesson in ['filters-ema-design-check','filters-biquad-spec-check']:
            self.assertEqual(profile['evidence'][lesson]['status'],'pending')
            self.assertNotIn('observedAt',profile['evidence'][lesson])
if __name__=='__main__':unittest.main()
