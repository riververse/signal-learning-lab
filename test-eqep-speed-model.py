"""Original ideal edge arithmetic, not an SDK run or hardware benchmark."""
from fractions import Fraction as F
import json

def count(edges, start, stop):
    return sum(d for t,d in edges if start <= t < stop)

def pr(edges,k,now,ttl,max_ticks=None):
    if k<1 or ttl<1 or len(edges)<=k:
        return None,'missing'
    span=edges[-k-1:]
    dt=span[-1][0]-span[0][0]
    age=now-span[-1][0]
    if age<0 or any(a[0]>=b[0] for a,b in zip(span,span[1:])):
        return None,'timestamp'
    if any(abs(d)!=1 or d!=span[1][1] for _,d in span[1:]):
        return None,'direction'
    if max_ticks is not None and dt>max_ticks:
        return None,'overflow'
    if age>=ttl:
        return None,'stale'
    return F(60_000*k*span[1][1],4000*dt),'fresh'

def main():
    checks=0
    for phase in range(20):
        for direction in [-1,1]:
            edges=[(phase+i*20,direction) for i in range(-1,100)]
            for n in range(0,30,2):
                a,b=(count(edges,10*j,10*(j+1)) for j in [n,n+1])
                assert sorted([a,b])==sorted([0,direction])
                assert F(a+b,2)*F(3,2)==direction*F(3,4)
                checks+=2
            for k in [1,2,4,8,16,32,64]:
                assert pr(edges,k,edges[-1][0],60)==(direction*F(3,4),'fresh')
                assert edges[-1][0]-edges[-k-1][0]==20*k
                checks+=2
    assert F(60*200,4000)*100==300
    e=[(0,1),(20,1),(40,1)]
    assert pr(e,1,99,60)==(F(3,4),'fresh')
    assert pr(e,1,100,60)==pr(e,1,101,60)==(None,'stale')
    assert pr(e[:1],1,100,60)==(None,'missing')
    assert pr(e,1,40,60,19)==(None,'overflow')
    assert pr(e[:2]+[(40,-1)],2,40,60)==(None,'direction')
    assert pr(e[:2]+[(20,1)],2,40,60)==(None,'timestamp')
    assert count([(2,1),(5,-1)],0,10)==0
    mod=4096
    for old in [0,1,mod-2,mod-1]:
        for delta in range(-99,100):
            new=(old+delta)%mod
            assert (new-old+mod//2)%mod-mod//2==delta
            checks+=1
    print(json.dumps(dict(kind='original_edge_model_not_vendor_or_hardware',
      checks=checks+9, zero_net_motion=True, stale_boundary_ms=100)))
if __name__=='__main__':main()
