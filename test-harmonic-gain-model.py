#!/usr/bin/env python3
"""Original dimensionless arithmetic only. No vendor code, data or hardware."""
import math,json,unittest

def corrected(b,g):
    if not math.isfinite(b) or b<0 or not math.isfinite(g) or g<=0: raise ValueError('outside synthetic magnitude domain')
    return b/g

def checks():
    n=0
    for a5 in [.01,.05,.1,.25]:
      for g1 in [.2,.7,.98,1.]:
       for g5 in [.1,.5,.8,1.]:
        b1,b5=g1,a5*g5
        for k in [.25,1,4]:
          assert math.isclose(k*b5/(k*b1),b5/b1,rel_tol=1e-12);n+=1
        assert math.isclose(corrected(b5,g5)/corrected(b1,g1),a5,rel_tol=1e-12);n+=1
        e=.005
        assert math.isclose(corrected(b5+e,g5)-corrected(b5,g5),e/g5,rel_tol=1e-12);n+=1
    for g in [0,-1,float('nan'),float('inf')]:
      try:corrected(.1,g)
      except ValueError:n+=1
      else:raise AssertionError('invalid gain accepted')
    for b in [-1,float('nan'),float('inf')]:
      try:corrected(b,1)
      except ValueError:n+=1
      else:raise AssertionError('invalid magnitude accepted')
    raw=.08/.98;good=corrected(.08,.8)/corrected(.98,.98);wrong=corrected(.08,.9)
    assert math.isclose(raw,.0816326530612245)
    assert math.isclose(good,.1)
    assert math.isclose(wrong,.0888888888888889)
    assert math.isclose(math.hypot(1,.1),1.004987562112089)
    return dict(kind='original_gain_model_not_vendor_or_hardware',checks=n+4,raw_thd=raw,corrected_thd=good,wrong_gain_thd=wrong,output_error=.005,input_equivalent_error=.00625)
if __name__=='__main__':print(json.dumps(checks(),indent=2))
