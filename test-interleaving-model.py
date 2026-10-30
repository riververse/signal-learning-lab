"""原创功率账本与回归：不是 AD9625 频谱复现，也不是通道时序仿真。

只假设不相关功率相加、指定残余杂散平均分配、固定积分带宽。
carrier=1 是教学归一化，不是把厂商 dBFS 偷换为 dBc。
SNR/SINAD 是功率比的 dB；单条功率和每 bin 噪声相对载波以 dBc 表示。
每 bin 值不是 dBc/Hz：模型没有指定采样率、FFT、窗函数或 bin 带宽。
32 条线与 4096 个噪声格是任意教学选择，不是厂商图 5 的谱线计数。
IL 功率专为演示 2 dB 差额构造，没有从原图提取精确功率或峰值统计。
不实现专有 channel shuffling，不涉及 JESD scrambler，无外部依赖。
"""
import json
import math


def _power(value, name, zero=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(name + ' must be numeric')
    if not math.isfinite(value) or value < 0 or (not zero and value == 0):
        raise ValueError(name + ' must be finite and positive (IL may be zero)')


def _count(value, name):
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError(name + ' must be a positive integer')


def budget(carrier=1.0, noise=1e-6, il=(10**0.2-1)*1e-6,
           harmonic=10**-7.2, lines=32, bins=4096):
    """功率搬家，不是随机数生成器；SFDR 只取离散谱线，不把噪声 bin 当杂散。"""
    for name, value in [('carrier', carrier), ('noise', noise), ('il', il),
                        ('harmonic', harmonic)]:
        _power(value, name, zero=name == 'il')
    _count(lines, 'lines')
    _count(bins, 'bins')
    total_error = noise + il + harmonic
    if not math.isfinite(total_error):
        raise ValueError('total error power overflow')
    # Difference of logs avoids a ratio overflowing for valid extreme powers.
    def ratio_db(numerator, denominator):
        return 10*(math.log10(numerator)-math.log10(denominator))
    line = il/lines
    before_bin = noise/bins
    after_bin = (noise+il)/bins
    if min(before_bin, after_bin) <= 0 or (il and line == 0):
        raise ValueError('power allocation underflow')
    before = {
        'noise_power': noise, 'discrete_il_power': il,
        'harmonic_power': harmonic,
        'snr_dB': ratio_db(carrier, noise),
        'sfdr_dB': ratio_db(carrier, max(harmonic, line)),
        'sinad_dB': ratio_db(carrier, total_error),
        'largest_discrete_spur_power': max(harmonic, line),
        'limiting_spur': 'HD3' if harmonic >= line else 'IL',
        'noise_power_per_bin_dBc': ratio_db(before_bin, carrier),
    }
    after = {
        'noise_power': noise+il, 'discrete_il_power': 0.0,
        'harmonic_power': harmonic,
        'snr_dB': ratio_db(carrier, noise+il),
        'sfdr_dB': ratio_db(carrier, harmonic),
        'sinad_dB': ratio_db(carrier, total_error),
        'largest_discrete_spur_power': harmonic,
        'limiting_spur': 'HD3',
        'noise_power_per_bin_dBc': ratio_db(after_bin, carrier),
    }
    return {
        'kind': 'original_power_budget_not_hardware_or_fft',
        'carrier_power': carrier, 'il_line_count': lines, 'noise_bin_count': bins,
        'il_to_base_noise_ratio': il/noise,
        'il_total_dBc': ratio_db(il, carrier) if il else None,
        'il_each_line_dBc': ratio_db(line, carrier) if il else None,
        'error_power_before': total_error,
        'error_power_after': (noise+il)+harmonic,
        'before': before, 'after': after,
        'snr_loss_dB': before['snr_dB']-after['snr_dB'],
        'noise_per_bin_rise_dB': ratio_db(after_bin, before_bin),
    }


def run_checks():
    r = budget()
    assert math.isclose(r['il_to_base_noise_ratio'], 10**0.2-1, abs_tol=1e-14)
    assert math.isclose(r['before']['snr_dB'], 60, abs_tol=1e-12)
    assert math.isclose(r['after']['snr_dB'], 58, abs_tol=1e-12)
    for stage in ['before', 'after']:
        assert math.isclose(r[stage]['sfdr_dB'], 72, abs_tol=1e-12)
        assert r[stage]['limiting_spur'] == 'HD3'
        assert r[stage]['harmonic_power'] == 10**-7.2
    assert r['before']['sinad_dB'] == r['after']['sinad_dB']
    assert math.isclose(r['snr_loss_dB'], 2, abs_tol=1e-12)
    assert math.isclose(r['noise_per_bin_rise_dB'], 2, abs_tol=1e-12)
    assert math.isclose(r['error_power_before'], r['error_power_after'], rel_tol=1e-15)
    il = (10**0.2-1)*1e-6
    # Explicitly sum allocations, independently of the total-return fields.
    assert math.isclose(math.fsum([il/32]*32), il, rel_tol=1e-15)
    assert math.isclose(math.fsum([(1e-6+il)/4096]*4096), 1e-6+il, rel_tol=1e-15)
    strong = budget(lines=1)
    assert strong['before']['limiting_spur'] == 'IL'
    assert strong['after']['limiting_spur'] == 'HD3'
    assert strong['after']['sfdr_dB'] > strong['before']['sfdr_dB']
    weak = budget(il=1e-8)
    assert 0 < weak['snr_loss_dB'] < .05
    assert weak['before']['sfdr_dB'] == weak['after']['sfdr_dB']
    zero = budget(il=0)
    assert zero['snr_loss_dB'] == 0
    assert zero['il_total_dBc'] is None
    # Doubling bin count lowers per-bin floor, not integrated noise or SNR.
    double = budget(bins=8192)
    assert double['after']['snr_dB'] == r['after']['snr_dB']
    assert math.isclose(r['after']['noise_power_per_bin_dBc']-
                        double['after']['noise_power_per_bin_dBc'],
                        10*math.log10(2), abs_tol=1e-12)
    bad = [{'carrier': 0}, {'noise': 0}, {'il': -1}, {'harmonic': 0},
           {'carrier': float('nan')}, {'noise': float('inf')}, {'il': True},
           {'lines': 0}, {'lines': 1.5}, {'bins': -1}, {'bins': True},
           {'carrier': '1'}, {'noise': 1e308, 'il': 1e308},
           {'noise': 5e-324}]
    for kw in bad:
        try:
            budget(**kw)
        except ValueError:
            pass
        else:
            raise AssertionError('accepted invalid allocation: ' + repr(kw))
    r['strong_single_line'] = {
        'sfdr_before_dB': strong['before']['sfdr_dB'],
        'sfdr_after_dB': strong['after']['sfdr_dB'],
    }
    r['small_residual_snr_loss_dB'] = weak['snr_loss_dB']
    r['invalid_cases_rejected'] = len(bad)
    r['allocation_conservation_checked'] = True
    r['bin_count_does_not_change_integrated_snr'] = True
    return r


if __name__ == '__main__':
    print(json.dumps(run_checks(), indent=2, allow_nan=False))
