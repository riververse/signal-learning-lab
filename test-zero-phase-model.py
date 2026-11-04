"""Original standard-library teaching checks, not SciPy or hardware execution.

Infinite bilateral analytical kernel is distinct from the finite zero-state
forward/reverse negative example. No padding or Gustafsson algorithm is copied.
"""
import cmath
import math
import unittest


def valid_a(a):
    if isinstance(a, bool) or not isinstance(a, (int,float)) or not math.isfinite(a) or not 0 < a < 1:
        raise ValueError('a must be finite and strictly between zero and one')


def causal(samples, a=.8, state=0.):
    valid_a(a)
    samples=list(samples)
    if not all(isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x) for x in samples+[state]):
        raise ValueError('finite numeric inputs required')
    out=[]
    for x in samples:
        state=(1-a)*x+a*state
        out.append(state)
    return out,state


def finite_forward_reverse(samples,a=.8):
    """Deliberately zero-state both directions: not filtfilt default behavior."""
    y,_=causal(samples,a)
    z,_=causal(reversed(y),a)
    return list(reversed(z))


def kernel(n,a=.8):
    valid_a(a)
    if isinstance(n,bool) or not isinstance(n,int):raise ValueError('integer n required')
    return (1-a)/(1+a)*a**abs(n)


class ZeroPhaseTests(unittest.TestCase):
    def test_bilateral_impulse_and_step(self):
        self.assertAlmostEqual(kernel(-5),.0364088888888889,14)
        self.assertAlmostEqual(sum(kernel(-1-k) for k in range(500)),4/9,14)
        self.assertAlmostEqual(sum(kernel(-k) for k in range(500)),5/9,14)
        self.assertAlmostEqual(sum(kernel(n) for n in range(-500,501)),1,14)
        self.assertTrue(all(kernel(n)==kernel(-n) for n in range(80)))

    def test_independent_convolution_and_frequency(self):
        for a in [.1,.4,.8,.95]:
            for n in [-19,-5,0,7,20]:
                # h[k] h[k-n], both one-sided; independent finite sum.
                actual=sum((1-a)**2*a**k*a**(k-n) for k in range(max(0,n),2000))
                self.assertAlmostEqual(actual,kernel(n,a),13)
            for w in [0,.1,.7,1.3,math.pi]:
                H=(1-a)/(1-a*cmath.exp(-1j*w))
                G=sum(kernel(n,a)*cmath.exp(-1j*w*n) for n in range(-2000,2001))
                self.assertLess(abs(G-abs(H)**2),2e-13)
                self.assertLess(abs(G.imag),2e-13)

    def test_cutoff_and_double_order_distinction(self):
        single=1/math.sqrt(2)
        self.assertAlmostEqual(20*math.log10(single),-3.010299956639812,12)
        self.assertAlmostEqual(20*math.log10(single**2),-6.020599913279624,12)
        for N in [1,2,4]:
            r=1
            forward_reverse=1/(1+r**(2*N))
            ordinary_double=1/math.sqrt(1+r**(4*N))
            self.assertEqual(forward_reverse,.5)
            self.assertGreater(ordinary_double-forward_reverse,.2)

    def test_causal_chunks_retain_state(self):
        x=[0.]*17+[1.]*35+[-.3]*28
        expected,_=causal(x)
        for lengths in [[1]*80,[17,35,28],[32,32,16],[79,1]]:
            actual=[];state=0.;i=0
            for size in lengths:
                out,state=causal(x[i:i+size],state=state);actual+=out;i+=size
            self.assertEqual(actual,expected)
        reset=causal(x[:40])[0]+causal(x[40:])[0]
        self.assertGreater(max(abs(a-b) for a,b in zip(reset,expected)),.5)

    def test_forward_reverse_new_edges(self):
        x=[1.]*80
        whole=finite_forward_reverse(x)
        split=finite_forward_reverse(x[:40])+finite_forward_reverse(x[40:])
        self.assertGreater(abs(whole[39]-split[39]),.7)
        self.assertGreater(abs(whole[40]-split[40]),.4)
        # Later changed sample affects an earlier output in the noncausal operator.
        early=finite_forward_reverse([0.]*20+[1.]+[0.]*20)
        self.assertGreater(early[15],.036)
        self.assertEqual(causal([0.]*20+[1.]+[0.]*20)[0][15],0)

    def test_inputs_and_empty_block(self):
        for a in [0,1,-.1,float('nan'),float('inf'),True,'0.8']:
            with self.assertRaises(ValueError):causal([1],a)
        for x in [[float('nan')],[float('inf')],[True],['x']]:
            with self.assertRaises(ValueError):causal(x)
        with self.assertRaises(ValueError):causal([1],state=float('nan'))
        with self.assertRaises(ValueError):kernel(.5)
        self.assertEqual(causal([],state=.4),([],.4))
        self.assertEqual(finite_forward_reverse([]),[])

if __name__=='__main__':unittest.main(verbosity=2)
