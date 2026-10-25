"""Original educational sin/cos model, not vendor code or hardware validation."""
import math
import json

def wrap(a):
    return math.atan2(math.sin(a), math.cos(a))

def observe(t, bx=0.0, by=0.0, ax=1.0, ay=1.0, delta=0.0):
    return bx + ax*math.cos(t), by + ay*math.sin(t+delta)

def correct(x, y, bx=0.0, by=0.0, ax=1.0, ay=1.0, delta=0.0):
    if not all(math.isfinite(v) for v in (x,y,bx,by,ax,ay,delta)):
        raise ValueError('nonfinite input')
    if ax <= 0 or ay <= 0 or abs(math.cos(delta)) < 1e-3:
        raise ValueError('nonpositive gain or ill-conditioned geometry')
    u=(x-bx)/ax
    v=((y-by)/ay-u*math.sin(delta))/math.cos(delta)
    if math.hypot(u,v)<1e-12:
        raise ValueError('undefined angle at near-zero vector')
    return math.atan2(v,u)

def main():
    angles=[2*math.pi*i/4096 for i in range(4096)]
    common=max(abs(wrap(math.atan2(*observe(t,ax=3,ay=3)[::-1])-t)) for t in angles)
    assert common<2e-15
    assert abs(math.degrees(wrap(math.radians(-179)-math.radians(179)))-2)<1e-12
    assert abs(0.02/2000-0.00001)<1e-18
    p=dict(bx=0.03,by=-0.02,ax=1.02,ay=0.98,delta=math.radians(2))
    raw=[];fixed=[]
    for t in angles:
        x,y=observe(t,**p)
        raw.append(wrap(math.atan2(y,x)-t))
        fixed.append(wrap(correct(x,y,**p)-t))
    assert max(map(abs,fixed))<2e-15
    # Full angular coverage, deliberately nonuniform dwell weights.
    xs=[math.cos(t)+0.03 for t in angles]
    uniform=sum(xs)/len(xs)
    weights=[1+0.8*math.cos(t) for t in angles]
    biased=sum(x*w for x,w in zip(xs,weights))/sum(weights)
    assert abs(uniform-0.03)<1e-14
    assert abs(biased-0.43)<1e-14
    assert abs((max(xs)+min(xs))/2-0.03)<1e-14
    rejected=0
    for kw in (dict(delta=math.pi/2),dict(delta=math.acos(0.0005)),dict(ax=0),dict(ay=-1),dict(bx=float('nan'))):
        try: correct(1,1,**kw)
        except ValueError: rejected+=1
        else: raise AssertionError(kw)
    try: correct(0,0)
    except ValueError: rejected+=1
    else: raise AssertionError('origin accepted')
    # First-order prediction, errors intentionally small; approximation is not exact.
    gx,gy,bx,by,d=0.0002,-0.0003,0.0001,-0.0002,0.0004
    approx_error=[]
    for t in angles:
        x,y=observe(t,bx,by,1+gx,1+gy,d)
        predicted=by*math.cos(t)-bx*math.sin(t)+(gy-gx)*math.sin(t)*math.cos(t)+d*math.cos(t)**2
        approx_error.append(abs(wrap(math.atan2(y,x)-t)-predicted))
    assert max(approx_error)<1e-6
    output={'samples':len(angles),'raw_max_error_deg':math.degrees(max(map(abs,raw))),
            'raw_rms_error_deg':math.degrees(math.sqrt(sum(v*v for v in raw)/len(raw))),
            'corrected_max_error_rad':max(map(abs,fixed)), 'common_gain_max_error_rad':common,
            'uniform_offset_mean':uniform,'nonuniform_offset_mean':biased,
            'first_order_max_remainder_rad':max(approx_error),'invalid_cases_rejected':rejected,
            'status':'PASS; synthetic model only, not hardware'}
    print(json.dumps(output,indent=2))
if __name__=='__main__': main()
