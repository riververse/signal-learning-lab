"""原创 DTMF 能量门控/事件时序教学模型，非 TI 软件或接收规范认证。

Goertzel 用任意指定频率，并以独立有限 DFT 验算。输入是人工合成样本。
Fs=8000、N=136、hop=120 用于窗长算术，不证明 23/45 ms 或 talk-off 性能。
行强 8 dB / 列强 4 dB 对应 Erow/Ecol 的 [-4,+8] dB。
其余门槛（总能量 1、组内 6 dB、谐波 -12 dB）均为原创教学假设。
连续两帧确认、连续两个低能 pause 重置是原创保守事件策略，不复刻 TI。
能量 fixture 与事件 fixture 分开测试；不是完整音频到事件的 DTMF 接收机。
"""
import cmath
import json
import math

ROWS = (697, 770, 852, 941)
COLS = (1209, 1336, 1477, 1633)
DIGITS = ('123A', '456B', '789C', '*0#D')


def number(x, name, positive=False):
    if isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x):
        raise ValueError(name + ' must be finite numeric')
    if positive and x <= 0:
        raise ValueError(name + ' must be positive')


def goertzel_power(samples, frequency, fs, n):
    """恰好 n 个有效输入后取未归一化 |sum x[k] exp(-j*w*k)|²。"""
    number(fs, 'fs', True)
    number(frequency, 'frequency')
    if not 0 <= frequency <= fs/2:
        raise ValueError('frequency outside [0, fs/2]')
    if isinstance(n, bool) or not isinstance(n, int) or n <= 0:
        raise ValueError('n must be positive integer')
    if not isinstance(samples, (list, tuple)) or len(samples) != n:
        raise ValueError('exactly n samples required; no padding or gap stitching')
    c = 2*math.cos(2*math.pi*frequency/fs)
    s1 = s2 = 0.0
    for x in samples:
        number(x, 'sample')
        s = x+c*s1-s2
        s2, s1 = s1, s
    result = s1*s1+s2*s2-c*s1*s2
    if not math.isfinite(result):
        raise ValueError('arithmetic overflow')
    return max(0.0, result)  # Roundoff alone can make zero power slightly negative.


def gate(row, col, row_harmonic, col_harmonic,
         threshold=1.0, dominance_db=6.0, harmonic_db=-12.0):
    """人工平方模能量：门槛与上下界均包含等号；无频偏/语音认证功能。"""
    for values in (row, col, row_harmonic, col_harmonic):
        if not isinstance(values, (list, tuple)) or len(values) != 4:
            raise ValueError('each energy group must contain four values')
        for value in values:
            number(value, 'energy')
            if value < 0:
                raise ValueError('negative energy')
    number(threshold, 'threshold', True)
    number(dominance_db, 'dominance_db')
    number(harmonic_db, 'harmonic_db')
    if not 0 < dominance_db <= 100 or not -100 <= harmonic_db <= 0:
        raise ValueError('unsupported educational gate thresholds')
    ri = max(range(4), key=row.__getitem__)
    ci = max(range(4), key=col.__getitem__)
    er, ec = row[ri], col[ci]
    if not math.isfinite(er+ec):
        raise ValueError('energy sum overflow')
    if er+ec < threshold or er == 0 or ec == 0:
        return {'digit': None, 'reason': 'weak_or_missing_group'}
    ratio = er/ec
    if not 10**(-4/10) <= ratio <= 10**(8/10):
        return {'digit': None, 'reason': 'row_col_ratio'}
    dominance = 10**(dominance_db/10)
    if er < sorted(row)[-2]*dominance or ec < sorted(col)[-2]*dominance:
        return {'digit': None, 'reason': 'ambiguous_group'}
    limit = 10**(harmonic_db/10)
    if row_harmonic[ri] > er*limit or col_harmonic[ci] > ec*limit:
        return {'digit': None, 'reason': 'second_harmonic'}
    return {'digit': DIGITS[ri][ci], 'reason': 'candidate',
            'row_over_col_dB': 10*math.log10(ratio)}


class EventGate:
    """输入分类已由上游作出；只有真正低能 pause 可重置，噪声不能冒充。"""
    def __init__(self):
        self.armed = True
        self.previous = None
        self.count = self.pauses = 0

    def feed(self, kind, digit=None):
        if kind not in ('tone', 'pause', 'noise', 'invalid', 'gap'):
            raise ValueError('unknown frame kind')
        if kind == 'tone':
            if not isinstance(digit, str) or len(digit) != 1 or digit not in ''.join(DIGITS):
                raise ValueError('invalid candidate digit')
        elif digit is not None:
            raise ValueError('non-tone frame cannot contain a digit')
        if kind == 'tone':
            self.pauses = 0
            if not self.armed:
                return None
            self.count = self.count+1 if digit == self.previous else 1
            self.previous = digit
            if self.count == 2:
                self.armed = False
                self.previous = None
                self.count = 0
                return digit
            return None
        self.previous = None
        self.count = 0
        if kind == 'pause':
            self.pauses = min(2, self.pauses+1)
            if self.pauses == 2:
                self.armed = True
        else:
            self.pauses = 0
            if kind == 'gap':
                self.armed = False
        return None


def run_checks():
    fs, n, hop = 8000, 136, 120
    samples = [math.sin(2*math.pi*770*k/fs)+.8*math.sin(2*math.pi*1336*k/fs+.3)
               for k in range(n)]
    errors = []
    for freq in (0, 697, 770, 852, 941, 1209, 1336, 1477, 1633, 1540, 2672, 4000):
        got = goertzel_power(samples, freq, fs, n)
        direct = abs(sum(x*cmath.exp(-2j*math.pi*freq*k/fs)
                         for k, x in enumerate(samples)))**2
        errors.append(abs(got-direct)/max(1.0, direct))
        assert math.isclose(got, direct, rel_tol=1e-10, abs_tol=1e-9)
    row_power = [goertzel_power(samples, f, fs, n) for f in ROWS]
    col_power = [goertzel_power(samples, f, fs, n) for f in COLS]
    assert ROWS[max(range(4), key=row_power.__getitem__)] == 770
    assert COLS[max(range(4), key=col_power.__getitem__)] == 1336
    assert goertzel_power([0]*n, 770, fs, n) == 0
    assert math.isclose(goertzel_power([1]*n, 0, fs, n), n*n)
    assert math.isclose(goertzel_power([(-1)**k for k in range(n)], fs/2, fs, n), n*n)
    r, c, h = [.01, 1, .01, .01], [.01, 1, .01, .01], [0]*4
    accepted = gate(r, c, h, h)
    assert accepted['digit'] == '5'
    outcomes = {
        'weak': gate([.001]*4, [.001]*4, h, h)['reason'],
        'two_in_same_group': gate([1, 1, 0, 0], h, h, h)['reason'],
        'third_peak': gate([.01, 1, .5, .01], c, h, h)['reason'],
        'row_too_strong': gate([0, 7, 0, 0], c, h, h)['reason'],
        'col_too_strong': gate(r, [0, 3, 0, 0], h, h)['reason'],
        'strong_harmonic': gate(r, c, [0, .1, 0, 0], h)['reason'],
    }
    assert all(value != 'candidate' for value in outcomes.values())
    assert outcomes['third_peak'] == 'ambiguous_group'
    assert outcomes['strong_harmonic'] == 'second_harmonic'
    # Inclusive threshold and ratio limits, just-outside cases rejected.
    assert gate(r, c, h, h, threshold=2)['digit'] == '5'
    assert gate(r, c, h, h, threshold=2.000001)['digit'] is None
    for boundary in (-4, 8):
        row = [0, 10**(boundary/10), 0, 0]
        assert gate(row, c, h, h)['digit'] == '5'
    for outside in (-4.00001, 8.00001):
        assert gate([0, 10**(outside/10), 0, 0], c, h, h)['digit'] is None
    dominance = 10**.6
    assert gate([1, dominance, 0, 0], [0, dominance, 0, 0], h, h)['digit'] == '5'
    assert gate([1.000001, dominance, 0, 0], [0, dominance, 0, 0], h, h)['digit'] is None
    limit = 10**-1.2
    assert gate(r, c, [0, limit, 0, 0], h)['digit'] == '5'
    assert gate(r, c, [0, limit*1.000001, 0, 0], h)['digit'] is None
    def events(sequence):
        machine = EventGate()
        return [out for kind, digit in sequence if (out := machine.feed(kind, digit)) is not None]
    tone = lambda digit: ('tone', digit)
    pause, noise, invalid, gap = [('pause', None), ('noise', None), ('invalid', None), ('gap', None)]
    assert events([tone('5')]*20) == ['5']
    assert events([tone('5')]*2+[tone('6')]*3) == ['5']
    assert events([tone('5')]*2+[pause]+[tone('5')]*2) == ['5']
    assert events([tone('5')]*2+[pause, pause]+[tone('5')]*2) == ['5', '5']
    assert events([tone('5')]*2+[pause, noise, pause]+[tone('6')]*2) == ['5']
    assert events([tone('5'), invalid, tone('5')]) == []
    assert events([tone('5'), tone('6'), tone('5')]) == []
    assert events([tone('5'), gap]+[tone('5')]*3) == []
    assert events([tone('5'), gap, pause, pause]+[tone('6')]*2) == ['6']
    assert events([tone('5')]*2+[invalid, invalid]+[tone('6')]*2) == ['5']
    invalid_calls = [
        lambda: goertzel_power(samples[:-1], 770, fs, n),
        lambda: goertzel_power(samples+[0], 770, fs, n),
        lambda: goertzel_power(samples, -1, fs, n),
        lambda: goertzel_power(samples, 4001, fs, n),
        lambda: goertzel_power(samples, 770, 0, n),
        lambda: goertzel_power(samples, 770, fs, True),
        lambda: goertzel_power([float('nan')], 0, fs, 1),
        lambda: goertzel_power([True], 0, fs, 1),
        lambda: gate(r[:-1], c, h, h),
        lambda: gate([-1, 1, 0, 0], c, h, h),
        lambda: gate(r, c, [float('inf')]*4, h),
        lambda: gate(r, c, h, h, threshold=0),
        lambda: gate(r, c, h, h, dominance_db=0),
        lambda: gate(r, c, h, h, harmonic_db=1),
        lambda: EventGate().feed('tone', '55'),
        lambda: EventGate().feed('tone', None),
        lambda: EventGate().feed('pause', '5'),
        lambda: EventGate().feed('unknown'),
    ]
    for call in invalid_calls:
        try:
            call()
        except ValueError:
            pass
        else:
            raise AssertionError('invalid input accepted')
    timing = {'window_ms': n/fs*1000, 'hop_ms': hop/fs*1000,
              'overlap_ms': (n-hop)/fs*1000, 'two_window_span_ms': (n+hop)/fs*1000}
    assert timing == {'window_ms': 17, 'hop_ms': 15, 'overlap_ms': 2, 'two_window_span_ms': 32}
    return {'kind': 'original_synthetic_teaching_model_not_TI_or_compliance_test',
            'sample_count': n, 'sample_rate_Hz': fs, 'synthetic_digit': '5',
            'goertzel_dft_frequencies_checked': len(errors),
            'max_scaled_power_error': max(errors),
            'synthetic_row_peak_Hz': 770, 'synthetic_col_peak_Hz': 1336,
            'fixture_candidate': accepted, 'rejected_fixtures': outcomes,
            'timing': timing, 'event_sequences_checked': 10,
            'invalid_inputs_rejected': len(invalid_calls),
            'boundary_tests_passed': True, 'gap_requires_pause_rearm': True,
            'claim': '32 ms is only two-window span, not a universal recognition threshold'}


if __name__ == '__main__':
    print(json.dumps(run_checks(), indent=2, allow_nan=False))
