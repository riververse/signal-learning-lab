"""Original teaching arithmetic, not vendor code or hardware data."""
import math, json

def jitter_snr(f, s):
    if not math.isfinite(f) or not math.isfinite(s) or f <= 0 or s <= 0:
        raise ValueError('positive finite frequency and rms jitter required')
    return -20 * math.log10(2 * math.pi * f * s)

def combine_snr(*snrs):
    return -10 * math.log10(sum(10**(-s/10) for s in snrs))

r={}
r['vendor_rss_fs']=math.hypot(250,387)
r['10ps_snr_100k_1M_dB']=[jitter_snr(f,10e-12) for f in [100e3,1e6]]
r['80dB_at_1MHz_jitter_ps']=10**(-80/20)/(2*math.pi*1e6)*1e12
r['80dB_adc_and_80dB_jitter_dB']=combine_snr(80,80)
r['1dB_loss_jitter_snr_dB']=-10*math.log10(10**(-79/10)-10**(-80/10))
r['1dB_loss_jitter_ps']=10**(-r['1dB_loss_jitter_snr_dB']/20)/(2*math.pi*1e6)*1e12
r['fixed_1us_skew_deg_at_10k']=360*1e4*1e-6
# Exact finite ensemble: uniform signal phases, each paired with +/- sigma.
# Independent sign at every phase in this mathematical ensemble, not a clock trace.
f=1e5; sigma=1e-8; phase_error=2*math.pi*f*sigma
N=128
signal=sum(math.sin(2*math.pi*k/N)**2 for k in range(N))/N
err=sum((2*math.cos(2*math.pi*k/N+sgn*phase_error/2)*math.sin(sgn*phase_error/2))**2 for k in range(N) for sgn in [-1,1])/(2*N)
exact=1-math.cos(phase_error)
assert math.isclose(err,exact,rel_tol=1e-10,abs_tol=1e-14)
r['ensemble_exact_snr_dB']=10*math.log10(signal/err)
r['ensemble_linear_snr_dB']=jitter_snr(f,sigma)
assert abs(r['ensemble_exact_snr_dB']-r['ensemble_linear_snr_dB'])<0.00002
assert math.isclose(r['10ps_snr_100k_1M_dB'][0]-r['10ps_snr_100k_1M_dB'][1],20,abs_tol=1e-12)
assert math.isclose(combine_snr(80,80),80-10*math.log10(2))
for args in [(0,1),(1,0),(-1,1),(1,float('nan')),(float('inf'),1)]:
    try: jitter_snr(*args)
    except ValueError: pass
    else: raise AssertionError('invalid input accepted')
print(json.dumps(r,indent=2))
