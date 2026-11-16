"""Original closed-form AM and direct DFT checks; no vendor data/code/hardware."""
import math, cmath, json
N=4096
T=[n/N for n in range(N)]
def amp(x,k):
    return 2*abs(sum(v*cmath.exp(-2j*math.pi*k*n/N) for n,v in enumerate(x)))/N
def main():
    checks=0
    for m in [0,0.1,0.4,0.9]:
        for phase in [0,0.7,2.4]:
            a=[1+m*math.cos(2*math.pi*40*t) for t in T]
            z=[v*cmath.exp(1j*(2*math.pi*800*t+phase)) for v,t in zip(a,T)]
            x=[v.real for v in z]
            for k,want in [(40,0),(760,m/2),(800,1),(840,m/2)]:
                assert abs(amp(x,k)-want)<1e-10; checks+=1
            env=[abs(v) for v in z]
            assert max(abs(u-v) for u,v in zip(env,a))<1e-12; checks+=1
            assert abs(amp([v-1 for v in env],40)-m)<1e-10; checks+=1
            sq=[v*v for v in env]
            for k,want in [(40,2*m),(80,m*m/2)]:
                assert abs(amp(sq,k)-want)<1e-10; checks+=1
            assert abs(sum(sq)/N-(1+m*m/2))<1e-12;checks+=1
            narrow=[abs(cmath.exp(1j*(2*math.pi*800*t+phase))) for t in T]
            assert amp(narrow,40)<1e-12;checks+=1
    a=[1+1.2*math.cos(2*math.pi*40*t) for t in T]
    assert min(a)<0 and max(abs(v)-v for v in a)>0.39;checks+=1
    print(json.dumps(dict(kind='original_AM_not_vendor_or_hardware',checks=checks,sideband_amplitude=0.2,envelope_40Hz=0.4,squared_80Hz=0.08,narrow_band_loses_modulation=True)))
if __name__=='__main__':main()
