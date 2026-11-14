#!/usr/bin/env python3
"""Original noiseless educational arithmetic; no vendor code or hardware."""
import math,json
checks=0
def near(a,b,tol=1e-10):
 global checks
 assert abs(a-b)<tol,(a,b);checks+=1
def calibrate(plus,minus,raw):
 if not all(math.isfinite(v) for v in (plus,minus,raw)):raise ValueError('nonfinite')
 s=(plus-minus)/2
 if s<=1e-9:raise ValueError('invalid sensitivity/orientation')
 return (raw-(plus+minus)/2)/s
def solve(a,b):
 a=[list(row)+[v] for row,v in zip(a,b)];n=len(b)
 for j in range(n):
  k=max(range(j,n),key=lambda k:abs(a[k][j]))
  if abs(a[k][j])<1e-10:raise ValueError('rank deficient reference orientations')
  a[j],a[k]=a[k],a[j];v=a[j][j];a[j]=[x/v for x in a[j]]
  for k in range(n):
   if k!=j:
    v=a[k][j];a[k]=[x-v*y for x,y in zip(a[k],a[j])]
 return [row[-1] for row in a]
def raw(v):
 x,y,z=v;return [1.05*x+.1*y+.08,.95*y+.03*z-.03,1.02*z-.02*x+.01]
def fit(refs):
 rows=[raw(v)+[1] for v in refs]
 gram=[[sum(r[i]*r[j] for r in rows) for j in range(4)] for i in range(4)]
 return [solve(gram,[sum(r[i]*v[k] for r,v in zip(rows,refs)) for i in range(4)]) for k in range(3)]
near(calibrate(1.13,-.97,.605),.5)
for deg in range(360):
 x=math.sin(math.radians(deg));y=math.cos(math.radians(deg))
 near(calibrate(1.13,-.97,.08+1.05*x),x)
 near(calibrate(.92,-.98,-.03+.95*y),y)
refs=[[s if j==i else 0 for j in range(3)] for i in range(3) for s in (-1,1)]
w=fit(refs)
maxerr=0
for deg in range(1,180):
 v=[math.sin(deg)*math.cos(deg/3),math.sin(deg)*math.sin(deg/3),math.cos(deg)]
 r=raw(v)+[1]
 for row,expected in zip(w,v):
  got=sum(a*b for a,b in zip(row,r));near(got,expected);maxerr=max(maxerr,abs(got-expected))
rejected=0
for args in [(1,1,0),(1,1-1e-12,0),(-1,1,0),(math.nan,-1,0),(1,-1,math.inf)]:
 try:calibrate(*args)
 except ValueError:rejected+=1
 else:raise AssertionError('invalid endpoints accepted')
try:fit([[math.cos(k),math.sin(k),0] for k in range(20)])
except ValueError:rejected+=1
else:raise AssertionError('planar references accepted')
for deg in range(360):
 x=math.sin(math.radians(deg+5));y=math.cos(math.radians(deg+5));near(math.hypot(x,y),1)
angle=math.degrees(math.atan2(.1,1));near(angle,5.710593137499643)
rawangle=math.degrees(math.atan2(.605,.95*math.sqrt(3)/2-.03))
print(json.dumps(dict(kind='original_static_tilt_not_vendor_or_hardware',checks=checks,rejected=rejected,max_affine_error=maxerr,raw_angle_deg=rawangle,cross_axis_or_dc_acceleration_angle_deg=angle,rotation_norm_blind_spot=True,planar_reference_rejected=True)))
