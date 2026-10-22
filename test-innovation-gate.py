"""Original pedagogic scalar KF/gating checks. Does not import or execute PX4."""
import json, math

def ratio(residual, variance, gate):
    # Stricter pedagogic input contract; not a port of PX4.
    if not all(math.isfinite(v) for v in (residual, variance, gate)) or variance <= 0 or gate <= 0:
        return None
    return (residual / math.sqrt(variance) / gate) ** 2

def update(x, p, measurement, r, gate=3):
    if measurement is None:
        return {'state':x,'variance':p,'fused':False,'reason':'missing','ratio':None}
    residual=measurement-x
    s=p+r
    t=ratio(residual,s,gate)
    if t is None or t>1:
        return {'state':x,'variance':p,'fused':False,'reason':'invalid' if t is None else 'gate','ratio':t}
    k=p/s
    return {'state':x+k*residual,'variance':(1-k)**2*p+k*k*r,'fused':True,'reason':'accepted','ratio':t,'gain':k}

out={}
out['nominal']=update(10,.04,10.3,.09)
out['outlier']=update(10,.04,12,.09)
out['inflated_r']=update(10,.04,12,4)
assert out['nominal']['fused'] and math.isclose(out['nominal']['state'],10.092307692307692)
assert math.isclose(out['nominal']['variance'],.02769230769230769)
assert not out['outlier']['fused'] and out['outlier']['variance']==.04
assert out['inflated_r']['fused'] and math.isclose(out['inflated_r']['state'],10.01980198019802)
out['exact_boundary']=ratio(1,.25,2)
assert out['exact_boundary']==1 and update(0,0,1,.25,2)['fused']
for residual,variance,gate in [(float('nan'),1,3),(1,0,3),(1,-1,3),(1,float('inf'),3),(1,1,0)]:
    assert ratio(residual,variance,gate) is None
out['delay_200ms_at_20mps']={'residual':-20*.2,'ratio':ratio(-20*.2,.13,3),'aligned_ratio':ratio(0,.13,3)}
assert out['delay_200ms_at_20mps']['ratio']>1
out['units_m_vs_cm']=[ratio(2,.13,3),ratio(200,1300,3)]
assert math.isclose(*out['units_m_vs_cm'])
out['missing_after_prediction']=update(10,.04+.01,None,.09)
assert out['missing_after_prediction']['ratio'] is None and out['missing_after_prediction']['variance']==.05
out['squared_vs_amplitude']={'squared':4,'amplitude':math.sqrt(4)}
a,b,rho=2,-2,.9
nis=(a*a-2*rho*a*b+b*b)/(1-rho*rho)
out['correlated_axes']={'component_ratios':[ratio(a,1,3),ratio(b,1,3)],'joint_NIS':nis,'diagonal_only_NIS':a*a+b*b}
assert all(t<1 for t in out['correlated_axes']['component_ratios']) and math.isclose(nis,80)
print(json.dumps({'test_status':'passed','scope':'original synthetic mathematics only; no PX4 execution, hardware, replay or flight','results':out},ensure_ascii=False,indent=2))
