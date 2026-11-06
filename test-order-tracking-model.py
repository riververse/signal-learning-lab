#!/usr/bin/env python3
"""Original angle-domain arithmetic, not NI/MATLAB code or hardware validation.

The ideal case evaluates a known analytical function at exact angular positions.
A separate linear-interpolation check uses finite synthetic time samples and is
not a production antialias/resampling filter or a tachometer estimator. Only the
standard library is used, with no files, network, devices or external datasets.
"""
import bisect
import cmath
import json
import math


def finite(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError('finite numeric value required')
    return value


def revolutions(t):
    finite(t)
    if not 0 <= t <= 2:
        raise ValueError('this fixture is restricted to 0 <= t <= 2 seconds')
    return 10*t + 2.5*t*t


def inverse_time(rev):
    finite(rev)
    if not 0 <= rev <= 30:
        raise ValueError('this fixture is restricted to 0 <= rev <= 30')
    # Algebraically identical to (-10+sqrt(100+10*rev))/5; stable near zero.
    return 2*rev/(10+math.sqrt(100+10*rev))


def peak_bin_amplitude(values, k):
    if len(values)<2 or isinstance(k,bool) or not isinstance(k,int) or not 0<=k<=len(values)//2:
        raise ValueError('finite record and a nonnegative one-sided integer bin required')
    for x in values:
        finite(x)
    factor=1 if k==0 or (len(values)%2==0 and k==len(values)//2) else 2
    return factor*abs(sum(x*cmath.exp(-2j*math.pi*k*n/len(values))
                          for n,x in enumerate(values)))/len(values)


def interpolate(times, values, targets, max_gap):
    """Reject gaps and nonmonotonic time; no extrapolation or invented zeros."""
    finite(max_gap)
    if max_gap <= 0 or len(times) != len(values) or len(times) < 2:
        raise ValueError('matching samples and positive allowed gap required')
    for value in list(times)+list(values)+list(targets):
        finite(value)
    if any(b <= a or b-a > max_gap for a,b in zip(times,times[1:])):
        raise ValueError('nonmonotonic timestamps or unapproved gap')
    if any(b <= a for a,b in zip(targets,targets[1:])):
        raise ValueError('strictly increasing target positions required')
    out=[]
    for target in targets:
        if target < times[0] or target > times[-1]:
            raise ValueError('no extrapolation')
        j=min(len(times)-2,max(0,bisect.bisect_right(times,target)-1))
        a=(target-times[j])/(times[j+1]-times[j])
        out.append((1-a)*values[j]+a*values[j+1])
    return out


def order_limits(fs, points_per_rev, max_rev_per_second):
    for value in (fs, points_per_rev, max_rev_per_second):
        finite(value)
        if value <= 0:
            raise ValueError('positive rates required')
    return points_per_rev/2, fs/(2*max_rev_per_second)


def run_checks():
    points_per_rev, total_rev, order = 64, 30, 3
    n=points_per_rev*total_rev
    angles=[i/points_per_rev for i in range(n)]
    target_times=[inverse_time(r) for r in angles]
    ideal=[math.cos(2*math.pi*order*r) for r in angles]
    assert n == 1920 and order*total_rev == 90
    assert revolutions(2)==30 and inverse_time(30)==2
    for t in [0,.001,.1,.5,1,1.7,2]:
        assert math.isclose(inverse_time(revolutions(t)),t,abs_tol=1e-14)
    for r,t in zip(angles,target_times):
        assert math.isclose(revolutions(t),r,abs_tol=2e-14)
    assert max(abs(math.cos(2*math.pi*order*revolutions(t))-x)
               for t,x in zip(target_times,ideal)) < 2e-13
    amplitude=peak_bin_amplitude(ideal,90)
    assert math.isclose(amplitude,1,abs_tol=1e-13)
    assert peak_bin_amplitude([1]*64,0)==1
    assert math.isclose(peak_bin_amplitude([(-1)**i for i in range(64)],32),1,abs_tol=1e-14)
    assert math.isclose(math.sqrt(math.fsum(x*x for x in ideal)/n),1/math.sqrt(2),abs_tol=1e-14)
    assert math.isclose(math.sqrt(sum(x*x for x in [1]*64)/64),1)
    assert math.isclose(math.sqrt(sum(x*x for x in [(-1)**i for i in range(64)])/64),1)
    neighbors=[peak_bin_amplitude(ideal,k) for k in [0,1,88,89,91,92,300]]
    assert max(neighbors)<1e-13
    assert math.isclose(points_per_rev/n,1/30)
    assert 3*(600/60)==30 and 3*(1200/60)==60
    # One-second scalar time conversion does not make angular grid uniform in time.
    intervals=[b-a for a,b in zip(target_times,target_times[1:])]
    assert min(intervals) < .0008 and max(intervals) > .0015
    # Time-domain samples include t=2 as an interpolation support endpoint, but
    # angular FFT uses [0,30) revolutions so it does not repeat the endpoint.
    fs=1000
    times=[i/fs for i in range(2*fs+1)]
    samples=[math.cos(2*math.pi*order*revolutions(t)) for t in times]
    interpolated=interpolate(times,samples,target_times,.001001)
    error=max(abs(a-b) for a,b in zip(interpolated,ideal))
    assert 0 < error < .018
    assert .98 < peak_bin_amplitude(interpolated,90) < 1
    # Refining this low-frequency teaching grid reduces interpolation error,
    # not evidence for a general-purpose antialias filter.
    fine_times=[i/4000 for i in range(8001)]
    fine=interpolate(fine_times,[math.cos(2*math.pi*order*revolutions(t)) for t in fine_times],target_times,.000251)
    fine_error=max(abs(a-b) for a,b in zip(fine,ideal))
    assert fine_error < error/10
    angular,time=order_limits(1000,64,20)
    assert (angular,time)==(32,25)
    assert min(angular,time)==25  # Necessary strict bound, not achievable bandwidth.
    # Two different continuous-time tones yield identical fixed-time samples:
    # no later interpolation or increased points/revolution can distinguish them.
    aliased600=[math.cos(2*math.pi*600*i/1000) for i in range(100)]
    alias400=[math.cos(2*math.pi*400*i/1000) for i in range(100)]
    assert max(abs(a-b) for a,b in zip(aliased600,alias400))<1e-12
    # Independent angular alias example, with no finite-time sampling claim.
    assert max(abs(math.cos(2*math.pi*35*i/64)-math.cos(2*math.pi*29*i/64))
               for i in range(640))<5e-13
    fixed_hz_orders=[100/(rpm/60) for rpm in (600,1200)]
    assert fixed_hz_orders==[10,5]
    speed_scale=1.01
    observed_order=order/speed_scale
    assert math.isclose(observed_order,2.9702970297029703)
    assert math.isclose(360*order*.001,1.08)
    assert math.isclose(360*order*20*.0005,10.8)
    # Rotation identity uses the integral, not instantaneous speed times time.
    assert revolutions(2)==30 and (10+5*2)*2==40
    bad=[lambda: inverse_time(-1),lambda: inverse_time(31),
         lambda: revolutions(True),lambda: revolutions(math.nan),
         lambda: order_limits(0,64,20),lambda: order_limits(1000,64,0),
         lambda: order_limits(1000,math.inf,20),
         lambda: interpolate([0,1,1],[0,1,2],[.5],2),
         lambda: interpolate([1,0],[0,1],[.5],2),
         lambda: interpolate([0,1,3],[0,1,3],[.5],1.01),
         lambda: interpolate([0,1],[0,1],[1.1],2),
         lambda: interpolate([0,1],[0,1],[.7,.6],2),
         lambda: interpolate([0,1],[0,math.nan],[.5],2),
         lambda: interpolate([0,1],[0],[.5],2),
         lambda: interpolate([0,1],[0,1],[.5],0),
         lambda: peak_bin_amplitude([1,2],-1),
         lambda: peak_bin_amplitude([1,2],2),
         lambda: peak_bin_amplitude([1,2],True),
         lambda: peak_bin_amplitude([1,math.nan],0)]
    for call in bad:
        try: call()
        except ValueError: pass
        else: raise AssertionError('invalid data accepted')
    return {'kind':'original_order_tracking_arithmetic_not_NI_MATLAB_or_hardware',
            'total_revolutions':total_rev,'angular_samples':n,'order_bin':90,
            'order_bin_spacing':1/30,'ideal_three_order_peak_amplitude':amplitude,
            'ideal_three_order_rms':1/math.sqrt(2),'dc_nyquist_endpoint_scaling_checked':True,
            'neighbor_bin_max':max(neighbors),'linear_interpolation_max_error':error,
            'refined_interpolation_max_error':fine_error,
            'angular_nyquist_order':angular,'time_nyquist_at_max_speed_order':time,
            'fixed_100hz_order_range':fixed_hz_orders,'one_percent_speed_bias_order':observed_order,
            'phase_error_0001_rev_degrees':1.08,'phase_error_05ms_at20rps_degrees':10.8,
            'invalid_inputs_rejected':len(bad),
            'boundary':'strict Nyquist ceilings need margin and filtering; no tach estimator, RPM-gap repair, fault diagnosis or production resampler'}


if __name__=='__main__':
    print(json.dumps(run_checks(),indent=2,allow_nan=False))
