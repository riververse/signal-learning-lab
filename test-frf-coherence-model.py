#!/usr/bin/env python3
"""Original bounded spectral arithmetic, not FFT acquisition or vendor/hardware test."""
import cmath,json,math

def estimate(x,y):
    if not 1<=len(x)<=64 or len(x)!=len(y):raise ValueError('segment count')
    for z in [*x,*y]:
        if not isinstance(z,(int,float,complex)) or not math.isfinite(complex(z).real) or not math.isfinite(complex(z).imag) or abs(z)>16:raise ValueError('bounded finite coefficient')
    a=sum(abs(z)**2 for z in x)/len(x)
    b=sum(abs(z)**2 for z in y)/len(y)
    c=sum(complex(u).conjugate()*v for u,v in zip(x,y))/len(x)
    return (c/a if a else None,b/c.conjugate() if c else None,abs(c)**2/(a*b) if a*b else None)

checks=0
def check(ok):
    global checks
    if not ok:raise AssertionError(checks)
    checks+=1
def near(a,b):check(a is not None and abs(a-b)<1e-12)
for actual,want in zip(estimate([1,1],[1,3]),[2,2.5,.8]):near(actual,want)
for actual,want in zip(estimate([.5,1.5],[2,2]),[1.6,2,.8]):near(actual,want)
for i in range(1,25):
    x=complex(i/10,.3);y=complex(.7,i/8)
    h1,h2,g=estimate([x],[y]);near(g,1);near(h1,y/x);near(h2,y/x)
for angle in [-120,-60,0,60,120]:
    h=2*cmath.exp(1j*math.radians(angle));x=[1,1j,-1,-1j]
    h1,h2,g=estimate(x,[h*z for z in x]);near(h1,h);near(h2,h);near(g,1)
    wrong=sum(complex(v).conjugate()*u for u,v in zip(x,[h*z for z in x]))/4
    near(wrong,h.conjugate())
for scale in [.1,.5,2,3]:
    h1,h2,g=estimate([scale,scale],[1,3]);near(h1,2/scale);near(h2,2.5/scale);near(g,.8)
h=cmath.exp(-2j*math.pi*100*.001)
h1,h2,g=estimate([1,1j],[h,1j*h]);near(math.degrees(cmath.phase(h1)),-36);near(g,1)
near(estimate([1,1j],[2.2,2.2j])[2],1)
check(estimate([0,0],[1,2])==(None,None,None))
check(estimate([1,2],[0,0])==(0j,None,None))
check(estimate([1,1],[1,-1])==(0j,None,0))
for x,y in [([],[]),([1],[1,2]),([1]*65,[1]*65),([float('nan')],[1]),([float('inf')],[1]),([17],[1]),([1],[complex(0,float('inf'))])]:
    try:estimate(x,y)
    except ValueError:check(True)
    else:check(False)
print(json.dumps({'kind':'original_spectral_arithmetic_not_vendor_or_hardware','checks':checks,'single_segment_degeneracy':True,'noise_location_and_phase_checked':True}))
