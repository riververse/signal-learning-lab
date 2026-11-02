"""原创浮点 L/M SRC 契约测试，不读取或移植 ADI/Microchip 代码。

phase 0 起步，收到 N 个真实样本后输出 q=floor(mM/L)<N 的所有结果。
finish 才把已声明结束的有限记录补零至卷积支撑末端；未知 gap 不是零。
本简化 API 要求 K>=L，以避免在线输出越过短滤波器的有限卷积支撑。
保留全部历史只是易审阅教学实现，不是嵌入式内存优化或音频质量保证。
示例9tap不是合格音频抗镜像/抗混叠滤波器；无时钟漂移补偿。
"""
import json
import math


def positive_integer(value, name):
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError(name + ' must be a positive integer')


def finite(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError('finite numeric sample/tap required; gap is not zero')


class RationalSRC:
    def __init__(self, up, down, taps):
        positive_integer(up, 'L')
        positive_integer(down, 'M')
        if not isinstance(taps, (list, tuple)) or len(taps) < up:
            raise ValueError('this teaching contract requires K >= L')
        for value in taps:
            finite(value)
        self.up, self.down, self.taps = up, down, tuple(taps)
        self.samples, self.next_m, self.closed = [], 0, False

    def _output(self, samples, m):
        p, q = (m*self.down) % self.up, (m*self.down) // self.up
        terms = [self.taps[p+j*self.up]*samples[q-j]
                 for j in range((len(self.taps)-1-p)//self.up+1)
                 if 0 <= q-j < len(samples)]
        result = sum(terms)
        if not math.isfinite(result):
            raise ValueError('arithmetic overflow, no state committed')
        return result

    def push(self, block):
        if self.closed:
            raise ValueError('cannot append after finish')
        if not isinstance(block, (list, tuple)):
            raise ValueError('explicit real-sample list required')
        for value in block:
            finite(value)
        candidate = self.samples+list(block)
        m, output = self.next_m, []
        while (m*self.down)//self.up < len(candidate):
            output.append(self._output(candidate, m))
            m += 1
        self.samples, self.next_m = candidate, m
        return output

    def finish(self):
        if self.closed:
            return []  # Idempotent: never duplicate the tail.
        m, output = self.next_m, []
        if self.samples:
            last_support = (len(self.samples)-1)*self.up+len(self.taps)-1
            while m*self.down <= last_support:
                output.append(self._output(self.samples, m))
                m += 1
        self.next_m, self.closed = m, True
        return output


def direct(samples, up, down, taps):
    """独立参考：实际插零、普通完整卷积、再取索引0,M,2M，不用多相公式。"""
    if not samples:
        return []
    inserted = [0.0]*((len(samples)-1)*up+1)
    for i, value in enumerate(samples):
        inserted[i*up] = value
    convolution = [0.0]*(len(inserted)+len(taps)-1)
    for i, value in enumerate(inserted):
        for j, tap in enumerate(taps):
            convolution[i+j] += value*tap
    return convolution[::down]


def close_lists(a, b):
    return len(a) == len(b) and all(math.isclose(x, y, abs_tol=1e-12, rel_tol=1e-12)
                                   for x, y in zip(a, b))


def run_checks():
    taps = [x/6 for x in (1, 2, 3, 3, 2, 1, 2, 2, 2)]
    samples = [1, -2, .5, 3, 0, -1, 2, 4, -3, .25, 1]
    src = RationalSRC(3, 2, taps)
    online = src.push(samples)
    tail = src.finish()
    reference = direct(samples, 3, 2, taps)
    assert close_lists(online+tail, reference)
    assert len(online) == (len(samples)*3+1)//2 == 17
    assert len(reference) == ((len(samples)-1)*3+len(taps)-1)//2+1 == 20
    assert len(tail) == 3 and src.finish() == []
    hand = RationalSRC(3, 2, taps)
    hand_online = hand.push([1, 2, 3])
    hand_tail = hand.finish()
    assert close_lists(hand_online, [1/6, 1/2, 1, 11/6, 13/6])
    assert close_lists(hand_tail, [5/3, 1, 1])
    assert close_lists(hand_online+hand_tail, direct([1, 2, 3], 3, 2, taps))
    phases = [(m*2)%3 for m in range(9)]
    q = [(m*2)//3 for m in range(9)]
    assert phases == [0, 2, 1, 0, 2, 1, 0, 2, 1]
    assert q == [0, 0, 1, 2, 2, 3, 4, 4, 5]
    blocked, result, start = RationalSRC(3, 2, taps), [], 0
    sizes = [0, 1, 2, 0, 1, 4, 3, 0]
    per_block = []
    for size in sizes:
        part = blocked.push(samples[start:start+size])
        result.extend(part)
        per_block.append(len(part))
        start += size
        assert len(result) == (start*3+1)//2
    result.extend(blocked.finish())
    assert close_lists(result, reference)
    wrong, start = [], 0
    for size in sizes:
        if size:
            wrong.extend(RationalSRC(3, 2, taps).push(samples[start:start+size]))
        start += size
    assert len(wrong) == 18 and not close_lists(wrong, online)
    # Counterexample: retain global N/m/phase but incorrectly discard prior data.
    # Zero placeholders preserve indices only; they intentionally model the bug.
    lost_history, lost_output, start = RationalSRC(3, 2, taps), [], 0
    for size in sizes:
        if size:
            lost_history.samples = [0.0]*len(lost_history.samples)
        lost_output.extend(lost_history.push(samples[start:start+size]))
        start += size
    assert len(lost_output) == len(online)
    assert lost_history.next_m == len(online)
    assert not close_lists(lost_output, online)
    # Sum(h)=L is necessary here; individual phase sums=1 ensure DC on every phase.
    phase_gains = [sum(taps[p::3]) for p in range(3)]
    assert all(math.isclose(gain, 1) for gain in phase_gains)
    dc = RationalSRC(3, 2, taps).push([1]*12)
    assert close_lists(dc[:3], [1/6, 1/2, 2/3])
    assert all(math.isclose(value, 1) for value in dc[3:])
    wrong_dc = RationalSRC(3, 2, [x/3 for x in taps]).push([1]*12)
    assert all(math.isclose(value, 1/3) for value in wrong_dc[3:])
    # Total gain alone is insufficient: same sum 3 but unequal phase sums.
    unequal = [1, 2, 0]
    assert sum(unequal) == 3
    assert RationalSRC(3, 2, unequal).push([1]*3) == [1, 0, 2, 1, 0]
    unequal_taps = list(taps)
    unequal_taps[0] += .5
    unequal_taps[2] -= .5
    unequal_gains = [sum(unequal_taps[p::3]) for p in range(3)]
    assert math.isclose(sum(unequal_taps), 3)
    assert close_lists(unequal_gains, [1.5, 1, .5])
    unequal_dc = RationalSRC(3, 2, unequal_taps).push([1]*12)
    assert close_lists(unequal_dc[3:], [1.5, .5, 1]*5)
    empty = RationalSRC(3, 2, taps)
    assert empty.push([]) == [] and empty.finish() == [] and empty.finish() == []
    # Cross-check downsampling, unity rate and another rational rate as well.
    cross_checks = 0
    for up, down, h in [(1, 3, [.2, .3, .5]), (1, 1, [1, -.5]),
                       (2, 5, [.1, .2, .3, .4]), (4, 3, [.25]*8)]:
        for count in range(1, 13):
            x = samples[:count] if count <= len(samples) else samples+[.7]
            stream = RationalSRC(up, down, h)
            out = []
            for value in x:
                out.extend(stream.push([value]))
            out.extend(stream.finish())
            assert close_lists(out, direct(x, up, down, h))
            cross_checks += 1
    # 44.1 -> 48 kHz count-only demo. Taps are phase-gain placeholders, not audio LPF.
    count_src, chunk_counts = RationalSRC(160, 147, [1]*160), []
    for size in [44]*9+[45]:
        chunk_counts.append(len(count_src.push([0]*size)))
    assert sum(chunk_counts) == 480
    assert sum(math.ceil(size*160/147) for size in [44]*9+[45]) == 481
    assert count_src.finish() == []
    invalid = [lambda: RationalSRC(0, 2, taps), lambda: RationalSRC(True, 2, taps),
               lambda: RationalSRC(3, 0, taps), lambda: RationalSRC(3, 2.0, taps),
               lambda: RationalSRC(3, 2, []), lambda: RationalSRC(3, 2, [1, 1]),
               lambda: RationalSRC(1, 1, [float('inf')]),
               lambda: RationalSRC(1, 1, [True]),
               lambda: RationalSRC(3, 2, taps).push(None),
               lambda: RationalSRC(3, 2, taps).push([float('nan')]),
               lambda: RationalSRC(3, 2, taps).push([False]),
               lambda: RationalSRC(1, 1, [1e308]).push([1e308]),
               lambda: src.push([1])]
    for call in invalid:
        try:
            call()
        except ValueError:
            pass
        else:
            raise AssertionError('invalid input accepted')
    intact = RationalSRC(3, 2, taps)
    intact.push([1])
    before = (list(intact.samples), intact.next_m, intact.closed)
    for bad in ([2, None], [2, float('nan')], None):
        try:
            intact.push(bad)
        except ValueError:
            pass
        else:
            raise AssertionError('gap/invalid data accepted')
        assert (intact.samples, intact.next_m, intact.closed) == before
    overflow = RationalSRC(1, 1, [1e308])
    overflow.push([0])
    before_overflow = (list(overflow.samples), overflow.next_m, overflow.closed,
                       overflow.up, overflow.down, overflow.taps)
    try:
        overflow.push([1e308])
    except ValueError:
        pass
    else:
        raise AssertionError('overflow must reject entire push')
    assert (overflow.samples, overflow.next_m, overflow.closed,
            overflow.up, overflow.down, overflow.taps) == before_overflow
    drift = 44100*100e-6*60
    assert math.isclose(drift, 264.6)
    return {'kind': 'original_rational_polyphase_teaching_not_vendor_algorithm',
            'L': 3, 'M': 2, 'taps': taps, 'phase_sequence': phases, 'q_sequence': q,
            'input_samples': len(samples), 'online_output_count': len(online),
            'tail_output_count': len(tail), 'full_output_count': len(reference),
            'online_outputs': online, 'tail_outputs': tail,
            'hand_input': [1, 2, 3], 'hand_online_outputs': hand_online,
            'hand_tail_outputs': hand_tail,
            'block_sizes': sizes, 'block_output_counts': per_block,
            'wrong_reset_output_count': len(wrong), 'phase_dc_gains': phase_gains,
            'unequal_phase_dc_gains': unequal_gains,
            'unequal_phase_steady_output_cycle': unequal_dc[3:6],
            'startup_dc_outputs': dc[:3], 'wrong_sum_one_steady_dc': wrong_dc[3],
            'additional_direct_comparisons': cross_checks,
            'invalid_inputs_rejected': len(invalid), 'invalid_push_state_preserved': True,
            'history_only_loss_preserves_count_but_changes_values': True,
            'overflow_push_state_preserved': True,
            'finish_idempotent': True,
            '44100_to_48000': {'L': 160, 'M': 147, 'mono_input_count': 441,
                              'mono_output_count': 480, 'per_block_counts': chunk_counts,
                              'wrong_sum_individual_ceilings': 481,
                              'stereo_interleaved_input_scalars': 882,
                              'stereo_interleaved_output_scalars': 960},
            '100ppm_60s_input_drift_samples_arithmetic_only': drift,
            'boundary': 'no audio quality, real clock tracking, or Microchip 2x plus polynomial implementation'}


if __name__ == '__main__':
    print(json.dumps(run_checks(), indent=2, allow_nan=False))
