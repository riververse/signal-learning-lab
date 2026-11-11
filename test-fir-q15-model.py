#!/usr/bin/env python3
"""Original bounded integer FIR model. No CMSIS code, hardware or timing test."""
import json,random
checks=0
def check(ok):
    global checks
    if not ok:raise AssertionError(checks)
    checks+=1
def valid(v):return type(v) is int and -32768<=v<=32767
def wrap(v):return (v+2**31)%2**32-2**31
def sat(v):return max(-32768,min(32767,v))
def dot(h,x,fast=False):
    if not h or len(h)>64 or len(h)!=len(x) or not all(valid(v) for v in [*h,*x]):raise ValueError('bounded Q15 vectors required')
    a=0;events=0
    for c,v in zip(h,x):
        a+=c*v
        if fast:
            events+=not -2**31<=a<=2**31-1
            a=wrap(a)
    return sat(a//32768),a,events
# Coefficients here use conventional time order; this is not the API buffer.
def stream(h,x,fast=False,state=None):
    if not h or len(h)>64 or not all(valid(v) for v in [*h,*x]):raise ValueError('bounded Q15 stream required')
    s=list(state) if state is not None else [0]*(len(h)-1)
    if len(s)!=len(h)-1 or not all(valid(v) for v in s):raise ValueError('state length/range')
    y=[]
    for v in x:
        window=[v]+s[::-1];y.append(dot(h,window,fast)[0]);s=(s+[v])[-(len(h)-1):] if len(h)>1 else []
    return y,s
h=[24576]*4
check(dot(h,h)==(32767,2415919104,0))
check(dot(h,h,True)==(-32768,-1879048192,1))
check(dot(h,[12288]*4)==(32767,1207959552,0))
check(dot(h,[12288]*4,True)==dot(h,[12288]*4))
check(dot(h,[6144]*4)==(18432,603979776,0))
check(dot(h,[6144]*4,True)==dot(h,[6144]*4))
signs=[24576,-24576,24576,-24576]
check(sum(signs)==0);check(sum(map(abs,signs))==98304)
check(dot(signs,signs,True)==dot(h,h,True))
check(32767*32768==1073709056)
check(dot([-32768],[-32768])[0]==32767)
check(dot([16384],[-32768])[0]==-16384)
check(dot([1],[-1])[0]==-1) # Arithmetic floor, not truncation toward zero.
check(wrap(2**31)==-2**31);check(wrap(-2**31-1)==2**31-1)
# Construct 150 safe cases using quantized coefficient absolute-sum budget.
rng=random.Random(20261111)
for _ in range(150):
    coeff=[rng.randrange(-12000,12001) for _ in range(4)]
    S=sum(map(abs,coeff));limit=min(32767,1073709056//max(1,S))
    samples=[rng.randrange(-limit,limit+1) for _ in coeff]
    reference=dot(coeff,samples);fast=dot(coeff,samples,True)
    check(reference==fast);check(abs(reference[1])<=1073709056)
    # Worst sign-aligned case realizes the norm bound exactly.
    aligned=[limit if v>=0 else -limit for v in coeff]
    check(dot(coeff,aligned)[1]==limit*S)
    check(dot(coeff,aligned,True)==dot(coeff,aligned))
# Non-symmetric impulse and segmented state invariance.
h=[4096,8192,-4096,2048];x=[16384]+[0]*15
check(stream(h,x)[0][:4]==[2048,4096,-2048,1024])
x=[rng.randrange(-16000,16001) for _ in range(200)]
whole,state=stream(h,x,True);out=[];s=None;offset=0
for size in [1,7,32,4,63,93]:
    ys,s=stream(h,x[offset:offset+size],True,s);out+=ys;offset+=size
check(offset==len(x));check(out==whole);check(s==state)
wrong=[];offset=0
for size in [1,7,32,4,63,93]:
    ys,_=stream(h,x[offset:offset+size],True);wrong+=ys;offset+=size
check(wrong!=whole)
for a,b in [([],[]),([1],[1,2]),([1],[32768]),([-32769],[1]),([True],[1]),([1],[.5]),([1]*65,[1]*65)]:
    try:dot(a,b)
    except ValueError:check(True)
    else:check(False)
print(json.dumps({'kind':'original_integer_model_not_CMSIS_or_hardware','checks':checks,'wrap_output':-32768,'standard_output':32767,'safe_output':18432,'state_and_norm_bound_checked':True}))
