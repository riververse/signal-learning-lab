#!/usr/bin/env python3
"""Original Allan arithmetic checks, not NXP/NIST code or physical measurements.

K rate samples have K+1 boundary-integrated angles. Each difference compares
adjacent disjoint windows; pair starts overlap with stride one sample.
No downloaded vendor code, scipy, hardware, file datasets or random claims.
"""
import math
import unittest


def validate(rate, dt, m, timestamps=None):
    if isinstance(m, bool) or not isinstance(m, int) or m < 1 or len(rate) < 2*m:
        raise ValueError('Need positive integer m and at least 2m samples')
    if not math.isfinite(dt) or dt <= 0 or not all(math.isfinite(x) for x in rate):
        raise ValueError('Need finite rate and positive finite sample interval')
    if timestamps is not None:
        if len(timestamps) != len(rate) or not all(math.isfinite(t) for t in timestamps):
            raise ValueError('Missing or nonfinite timestamps')
        if any(not math.isclose(b-a, dt, rel_tol=1e-9, abs_tol=1e-12)
               for a, b in zip(timestamps,timestamps[1:])):
            raise ValueError('This minimal model requires uniform contiguous samples')


def direct(rate, dt, m, timestamps=None):
    validate(rate,dt,m,timestamps)
    pairs=len(rate)-2*m+1
    delta=[math.fsum(rate[k+m:k+2*m])/m-math.fsum(rate[k:k+m])/m
           for k in range(pairs)]
    variance=math.fsum(d*d for d in delta)/(2*pairs)
    return variance, math.sqrt(variance), pairs, delta


def integrated(rate, dt, m):
    validate(rate,dt,m)
    theta=[0.]
    for value in rate:theta.append(theta[-1]+value*dt)
    pairs=len(theta)-2*m
    tau=m*dt
    delta=[(theta[k+2*m]-2*theta[k+m]+theta[k])/tau for k in range(pairs)]
    variance=math.fsum(d*d for d in delta)/(2*pairs)
    return variance, math.sqrt(variance), pairs, delta


class AllanModel(unittest.TestCase):
    def test_01_hand_calculation(self):
        v,s,count,delta=direct([0,0,2,2,0,0,2,2],1.,2)
        self.assertEqual(delta,[2,0,-2,0,2]);self.assertEqual(count,5)
        self.assertEqual(v,1.2);self.assertAlmostEqual(s,1.0954451150103321,14)
        self.assertEqual(direct([0,0,2,2,0,0,2,2],1.,2),integrated([0,0,2,2,0,0,2,2],1.,2))
    def test_02_rate_boundary_count_equivalence(self):
        # Binary-exact values avoid mistaking rounding for a definition mismatch.
        for length in range(2,70):
            values=[((n*13)%19-9)/8 for n in range(length)]
            for m in range(1,length//2+1):
                a,b=direct(values,.125,m),integrated(values,.125,m)
                self.assertEqual(a[2],length-2*m+1);self.assertEqual(a[2],b[2])
                self.assertAlmostEqual(a[0],b[0],12)
                for x,y in zip(a[3],b[3]):self.assertAlmostEqual(x,y,13)
    def test_03_constant_bias_is_invisible(self):
        x=[0,0,2,2,0,0,2,2]
        for m in range(1,5):
            a,b=direct(x,1,m),direct([v+10 for v in x],1,m)
            self.assertAlmostEqual(a[0],b[0],13);self.assertAlmostEqual(a[1],b[1],13)
            self.assertEqual(a[2],b[2])
            for u,v in zip(a[3],b[3]):self.assertAlmostEqual(u,v,13)
            self.assertEqual(direct([10]*8,1,m)[0],0)
        self.assertEqual(10*60,600)  # deg/s times s, not an ADEV estimate.
    def test_04_drift_exact_formula(self):
        dt=.01;a=.1;b=3
        x=[b+a*n*dt for n in range(1000)]
        for m in [1,2,10,100,300,500]:
            v,s,pairs,delta=direct(x,dt,m)
            target=abs(a*m*dt)/math.sqrt(2)
            self.assertAlmostEqual(s,target,13)
            self.assertAlmostEqual(v,target*target,13)
            for d in delta:self.assertAlmostEqual(d,a*m*dt,13)
        self.assertAlmostEqual(direct(x,dt,10)[1],.007071067811865475,13)
        self.assertAlmostEqual(direct(x,dt,100)[1],.07071067811865475,13)
    def test_05_white_noise_expected_variance_not_random_run(self):
        # For mutually independent equal-variance variables, variance of a
        # weighted sum is s0^2*sum(weights^2). This is not data generation.
        s0=.2
        for m in [1,10,100]:
            weights=[-1/m]*m+[1/m]*m
            expected=s0*s0*math.fsum(w*w for w in weights)/2
            self.assertAlmostEqual(expected,s0*s0/m,15)
            self.assertAlmostEqual(math.sqrt(expected),s0/math.sqrt(m),14)
        self.assertAlmostEqual(.2/math.sqrt(10),.06324555320336758,14)
    def test_06_wrong_adjacent_sliding_difference(self):
        x=[0,0,2,2,0,0,2,2];m=2
        avg=[sum(x[k:k+m])/m for k in range(len(x)-m+1)]
        wrong=sum((b-a)**2 for a,b in zip(avg,avg[1:]))/(2*(len(avg)-1))
        self.assertEqual(wrong,.5);self.assertNotEqual(wrong,direct(x,1,m)[0])
    def test_07_units(self):
        x=[0,0,2,2,0,0,2,2]
        for m in range(1,5):
            a=direct(x,1,m);b=direct([v*3600 for v in x],1,m)
            self.assertAlmostEqual(b[0],a[0]*3600**2,7)
            self.assertAlmostEqual(b[1],a[1]*3600,10)
            self.assertEqual(b[2],a[2])
    def test_08_invalid_input(self):
        for m in [0,-1,1.5,True,5]:
            with self.assertRaises(ValueError):direct([0]*8,1,m)
        for dt in [0,-1,math.inf,math.nan]:
            with self.assertRaises(ValueError):direct([0]*8,dt,1)
        for bad in [math.nan,math.inf,-math.inf]:
            with self.assertRaises(ValueError):direct([0,bad],1,1)
        with self.assertRaises(ValueError):direct([],1,1)
    def test_09_time_gaps_and_reordering(self):
        x=[0]*8;times=[k*.01 for k in range(8)]
        self.assertEqual(direct(x,.01,2,times)[0],0)
        for wrong in [[0,.01,.02,.04,.05,.06,.07,.08],list(reversed(times)),times[:-1],[math.nan]*8]:
            with self.assertRaises(ValueError):direct(x,.01,2,wrong)
    def test_10_long_tau_counts_and_latency(self):
        self.assertEqual(direct([0]*200,.01,100)[2],1)
        with self.assertRaises(ValueError):direct([0]*199,.01,100)
        self.assertAlmostEqual((100-1)/(2*100),.495,15)
        self.assertGreater((100-1)/(2*100),.05)

if __name__=='__main__':unittest.main(verbosity=2)
