#!/usr/bin/env python3
"""Original bounded teaching model: DFT convolution, not a vendor FFT/runtime.

Standard library only. No downloads, network, devices, third-party code, timing
benchmark or deployment implementation. Direct O(N^2) DFT sums deliberately make
normalization visible. Input: <=256 real samples, <=16 taps, transform <=32,
absolute sample/coefficient value <=16. Empty packets do not flush the stream.
"""
import cmath
import json
import math
from numbers import Real


def real_vector(values, limit, empty=True):
    if not isinstance(values, (list, tuple)) or len(values) > limit or (not values and not empty):
        raise ValueError('Expected a bounded list or tuple')
    if any(isinstance(x, bool) or not isinstance(x, Real) or
           abs(x) > 16 or not math.isfinite(x) for x in values):
        raise ValueError('Expected finite real values with absolute value <=16')
    return [float(x) for x in values]


def dft(values, inverse=False):
    n = len(values)
    sign = 1 if inverse else -1
    scale = n if inverse else 1
    return [sum(x * cmath.exp(sign * 2j * math.pi * k * j / n)
                for j, x in enumerate(values)) / scale for k in range(n)]


def circular_by_dft(x, h, n):
    """Internal bounded transform kernel, forward unscaled / inverse divided by N."""
    a = dft(list(x) + [0.] * (n - len(x)))
    b = dft(list(h) + [0.] * (n - len(h)))
    y = dft([u * v for u, v in zip(a, b)], inverse=True)
    assert max(abs(v.imag) for v in y) < 1e-9
    return [v.real for v in y]


def direct(x, h):
    """Independent time-domain full convolution, zero outside a finite record."""
    if not x:
        return []
    y = [0.] * (len(x) + len(h) - 1)
    for i, value in enumerate(x):
        for j, coefficient in enumerate(h):
            y[i + j] += value * coefficient
    return y


class BlockFIR:
    """Unaligned output values plus explicit buffering, not MATLAB's delayed API."""
    def __init__(self, h, n, method):
        self.h = real_vector(h, 16, empty=False)
        if isinstance(n, bool) or not isinstance(n, int) or not len(self.h) <= n <= 32:
            raise ValueError('Need integer tap_count <= N <=32')
        if method not in ('add', 'save'):
            raise ValueError('Need add or save')
        self.n, self.method = n, method
        self.b = n - len(self.h) + 1
        self.pending = []
        self.state = [0.] * (len(self.h) - 1)
        self.total = self.emitted = 0
        self.closed = False

    def _block(self, block):
        m = len(self.h)
        if self.method == 'add':
            y = circular_by_dft(block, self.h, self.n)
            for i, v in enumerate(self.state):
                y[i] += v
            self.state = y[self.b:]
            return y[:self.b]
        joined = self.state + block
        y = circular_by_dft(joined, self.h, self.n)
        self.state = joined[-(m - 1):] if m > 1 else []
        return y[m - 1:]

    def _drain(self):
        out = []
        while len(self.pending) >= self.b:
            block, self.pending = self.pending[:self.b], self.pending[self.b:]
            out.extend(self._block(block))
        return out

    def push(self, packet):
        if self.closed:
            raise ValueError('Record already finished')
        values = real_vector(packet, 256)
        if self.total + len(values) > 256:
            raise ValueError('Teaching record exceeds 256 real samples')
        # Validate the entire packet before changing any state.
        self.pending.extend(values)
        self.total += len(values)
        out = self._drain()
        self.emitted += len(out)
        return out

    def finish(self):
        if self.closed:
            return []
        self.closed = True
        if not self.total:
            return []
        remaining = self.total + len(self.h) - 1 - self.emitted
        self.pending.extend([0.] * (len(self.h) - 1))
        self.pending.extend([0.] * ((-len(self.pending)) % self.b))
        out = self._drain()[:remaining]
        self.emitted += len(out)
        return out


def close(actual, expected):
    assert len(actual) == len(expected), (len(actual), len(expected))
    error = max((abs(a - b) for a, b in zip(actual, expected)), default=0.)
    assert error < 1e-9, error
    return error


def main():
    h = [v / 9 for v in (1, 2, 3, 2, 1)]
    impulse = [0.] * 7 + [1.]
    folded = circular_by_dft(impulse, h, 8)
    close(folded[:4], [2/9, 3/9, 2/9, 1/9])
    assert direct(impulse, h)[:4] == [0.] * 4
    # Circular convolution checked with a different, modular time-domain sum.
    expected_circular = [sum(h[k] * impulse[(j-k) % 8] for k in range(5)) for j in range(8)]
    close(folded, expected_circular)
    close(circular_by_dft([1.] + [0.] * 7, [1.], 8), [1.] + [0.] * 7)

    comparisons, max_error = 0, 0.
    # M=1, N=M, non-power-of-two N, overlap longer than B, and short finals.
    fixtures = [(h, 8), (h, 16), (h, 5), (h, 6), ([1.], 1),
                ([.5, -.25, .125], 4), ([.25, 0., -.5, .25], 8)]
    for coefficients, n in fixtures:
        for length in (1, 2, 3, 4, 7, 8, 9, 11, 17):
            samples = [(((j * 7) % 19) - 9) / 8 for j in range(length)]
            layouts = [[samples], [[v] for v in samples],
                       [[], samples[:3], [], samples[3:7], samples[7:], []]]
            for mode in ('add', 'save'):
                for packets in layouts:
                    model = BlockFIR(coefficients, n, mode)
                    out = []
                    for packet in packets:
                        out.extend(model.push(packet))
                        assert model.emitted == model.total // model.b * model.b
                        assert len(model.pending) < model.b
                        assert len(model.state) == len(coefficients) - 1
                    out.extend(model.finish())
                    max_error = max(max_error, close(out, direct(samples, coefficients)))
                    assert model.finish() == []
                    comparisons += 1

    # Boundary impulse: the previous block's tail must enter the next output.
    boundary = [0., 0., 0., 1., 0., 0., 0., 0., 0., 0., 0.]
    for mode in ('add', 'save'):
        model = BlockFIR(h, 8, mode)
        first = model.push(boundary[:4])
        close(first, [0., 0., 0., 1/9])
        second = model.push(boundary[4:8])
        close(second, [2/9, 3/9, 2/9, 1/9])
        last_online = model.push(boundary[8:])
        assert last_online == []
        tail = model.finish()
        close(first + second + tail, direct(boundary, h))
        assert len(tail) == 7  # 3 pending valid outputs plus 4 decay outputs.
        wrong = BlockFIR(h, 8, mode).push(boundary[4:8])
        assert max(abs(a-b) for a, b in zip(second, wrong)) > .3

    invalid = 0
    def rejected(fn):
        nonlocal invalid
        try:
            fn()
        except ValueError:
            invalid += 1
        else:
            raise AssertionError('Invalid input accepted')
    for taps, n, mode in [([], 8, 'add'), ([1.]*17, 32, 'save'),
                          ([math.nan], 8, 'add'), ([17.], 8, 'add'),
                          ([True], 8, 'save'), ([1+1j], 8, 'save'),
                          (h, 4, 'save'), (h, 33, 'save'), (h, 8.0, 'add'),
                          (h, True, 'add'), (h, 8, 'unknown')]:
        rejected(lambda taps=taps, n=n, mode=mode: BlockFIR(taps, n, mode))
    for mode in ('add', 'save'):
        model = BlockFIR(h, 8, mode)
        assert model.push([1., 2.]) == []
        for bad in ([math.nan], [math.inf], [True], [1+1j], [17.], None,
                    '1', [0.] * 257, [0.] * 255):
            before = json.dumps(model.__dict__, sort_keys=True)
            rejected(lambda bad=bad: model.push(bad))
            assert json.dumps(model.__dict__, sort_keys=True) == before
        assert model.push([]) == []
        close(model.push([3., 4.]) + model.finish(), direct([1., 2., 3., 4.], h))
        rejected(lambda: model.push([]))
        empty = BlockFIR(h, 8, mode)
        assert empty.finish() == empty.finish() == []
        # Independent channels do not leak state.
        a, b = BlockFIR(h, 8, mode), BlockFIR(h, 8, mode)
        close(a.push([1.]*8) + a.finish(), direct([1.]*8, h))
        close(b.push([0.]*8) + b.finish(), [0.]*12)

    # Real symmetric FIR group delay, away from response zeros.
    for omega in (.1, .4, .8):
        response = lambda w: sum(v * cmath.exp(-1j*w*k) for k, v in enumerate(h))
        epsilon = 1e-6
        delay = -cmath.phase(response(omega+epsilon)/response(omega-epsilon))/(2*epsilon)
        assert abs(delay-2.) < 1e-8
    block_sizes = [n - len(h) + 1 for n in (8, 16)]
    gather_wait_ms = [(b - 1) / 1000 * 1000 for b in block_sizes]
    assert gather_wait_ms == [3., 11.]
    print(json.dumps({
        'kind': 'original_bounded_DFT_block_convolution_not_MATLAB_SciPy_or_hardware',
        'direct_comparisons': comparisons, 'max_absolute_error': max_error,
        'invalid_inputs_rejected': invalid,
        'circular_wrap_first_four': [round(v, 12) for v in folded[:4]],
        'block_size': 4, 'online_count_for_11_inputs': 8,
        'finish_count_for_11_inputs': 7, 'full_count_for_11_inputs': 15,
        'fir_group_delay_samples': 2,
        'first_sample_gather_wait_ms_at_1khz': gather_wait_ms,
        'documented_MATLAB_latency_samples_arithmetic_only': block_sizes,
        'packet_state_invariance': True, 'reset_negative_control': True,
        'invalid_packet_atomic': True, 'finish_idempotent': True,
        'channel_isolation': True, 'normalization_checked': True,
        'not_a_fast_FFT_or_timing_benchmark': True
    }, indent=2))


if __name__ == '__main__':
    main()
