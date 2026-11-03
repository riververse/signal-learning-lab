#!/usr/bin/env python3
"""Original offline teaching model, not vendor software or a hardware test.

Inputs are calibrated acceleration in m/s^2 on a continuous uniform time grid.
The DFT fixtures use even-length, coherent rectangular records. The periodic
inverse defines zero-mean band-limited velocity, not absolute velocity. The
optional high-pass is an analytical analog frequency response, not firmware,
digital filter coefficients, a causal implementation, or convertVibration.
Only Python's standard library is used. No files, network or hardware are used.
"""
import cmath
import json
import math
from numbers import Real


def real(value):
    if isinstance(value, bool) or not isinstance(value, Real) or not math.isfinite(value):
        raise ValueError('Expected a finite real number')
    return float(value)


def vector(values, minimum=4, even=False):
    if not isinstance(values, (list, tuple)) or len(values) < minimum:
        raise ValueError('Expected a nonempty numeric record')
    if even and len(values) % 2:
        raise ValueError('This teaching DFT requires an even record length')
    return [real(value) for value in values]


def rate(fs):
    fs = real(fs)
    if fs <= 0:
        raise ValueError('Sampling rate must be positive')
    return fs


def band_limits(fs, band):
    fs = rate(fs)
    if not isinstance(band, (tuple, list)) or len(band) != 2:
        raise ValueError('An explicit low/high frequency pair is required')
    low, high = map(real, band)
    if not 0 < low < high < fs / 2:
        raise ValueError('Require 0 < low < high < Nyquist')
    return low, high


def highpass_cutoff(fc):
    if fc is None:
        return None
    fc = real(fc)
    if fc <= 0:
        raise ValueError('High-pass cutoff must be positive or None')
    return fc


def response(frequency, fc):
    """An original first-order analog high-pass comparison, in Hz."""
    return 1 + 0j if fc is None else 1j * frequency / (fc + 1j * frequency)


def tone_velocity_rms(tones, fs, band, fc=None):
    """RSS for distinct orthogonal tones; values are (Hz, acceleration RMS)."""
    low, high = band_limits(fs, band)
    fc = highpass_cutoff(fc)
    if not isinstance(tones, (list, tuple)) or not tones:
        raise ValueError('At least one tone is required')
    seen = set()
    power = 0.0
    for tone in tones:
        if not isinstance(tone, (tuple, list)) or len(tone) != 2:
            raise ValueError('Expected frequency and RMS amplitude')
        f, a = map(real, tone)
        if not 0 < f < fs / 2 or a < 0 or f in seen:
            raise ValueError('Require distinct positive sub-Nyquist tones and nonnegative RMS')
        seen.add(f)
        if low <= f <= high:
            power += (a * abs(response(f, fc)) / (2 * math.pi * f)) ** 2
    if not math.isfinite(power):
        raise ValueError('Nonfinite output')
    return math.sqrt(power)


def one_sided_dft(samples, fs):
    samples = vector(samples, even=True)
    rate(fs)
    n = len(samples)
    # Direct finite sum, deliberately transparent rather than a vendor FFT.
    return [sum(value * cmath.exp(-2j * math.pi * k * i / n)
                for i, value in enumerate(samples)) for k in range(n // 2 + 1)]


def one_sided_psd(samples, fs):
    coeffs = one_sided_dft(samples, fs)
    n = len(samples)
    # DC and Nyquist are not doubled; all positive interior bins are doubled.
    return [abs(value) ** 2 / (fs * n) * (1 if k in (0, n // 2) else 2)
            for k, value in enumerate(coeffs)]


def psd_velocity_rms(acceleration_psd, fs, band, fc=None):
    """Rectangular-bin integral of calibrated one-sided acceleration PSD.

    Array covers every bin from DC to Nyquist of an even-length record.
    Values are (m/s^2)^2/Hz; df = fs / n. The band excludes both DC and Nyquist.
    A passed fc applies an ADDITIONAL filter. Do not reapply one already in PSD.
    """
    low, high = band_limits(fs, band)
    fc = highpass_cutoff(fc)
    values = vector(acceleration_psd, minimum=3)
    if any(value < 0 for value in values):
        raise ValueError('PSD must be nonnegative')
    df = fs / (2 * (len(values) - 1))
    terms = []
    for k, value in enumerate(values):
        f = k * df
        if low <= f <= high:
            terms.append(value * abs(response(f, fc)) ** 2 / (2 * math.pi * f) ** 2 * df)
    power = math.fsum(terms)
    if not math.isfinite(power):
        raise ValueError('Nonfinite output')
    return math.sqrt(power)


def periodic_velocity(samples, fs, band, fc=None):
    """Zero DC, periodic inverse, in m/s. Does NOT recover initial velocity."""
    low, high = band_limits(fs, band)
    fc = highpass_cutoff(fc)
    coeffs = one_sided_dft(samples, fs)
    n = len(samples)
    converted = []
    for k, value in enumerate(coeffs):
        f = k * fs / n
        if low <= f <= high:
            converted.append((k, value * response(f, fc) / (2j * math.pi * f)))
    # The factor 2 accounts for the negative-frequency conjugate; no DC/Nyquist.
    return [2 * math.fsum((value * cmath.exp(2j * math.pi * k * i / n)).real
                         for k, value in converted) / n for i in range(n)]


def uniform_integral(samples, fs, initial=0):
    """Original trapezoid rule, with an explicit initial velocity."""
    samples = vector(samples, minimum=2)
    fs = rate(fs)
    result = [real(initial)]
    for left, right in zip(samples, samples[1:]):
        value = result[-1] + (left + right) / (2 * fs)
        if not math.isfinite(value):
            raise ValueError('Nonfinite integral')
        result.append(value)
    return result


def rms(samples):
    return math.sqrt(math.fsum(x * x for x in samples) / len(samples))


def close(actual, expected, atol=1e-12):
    assert math.isclose(actual, expected, rel_tol=1e-11, abs_tol=atol), (actual, expected)


def run_checks():
    fs, n, band = 1024, 512, (5, 200)
    tones = [(10, .1), (100, .1)]
    phases = [.3, -.7]
    a = [sum(math.sqrt(2) * amp * math.sin(2 * math.pi * f * i / fs + phase)
             for (f, amp), phase in zip(tones, phases)) for i in range(n)]
    v = [sum(-math.sqrt(2) * amp / (2 * math.pi * f) *
             math.cos(2 * math.pi * f * i / fs + phase)
             for (f, amp), phase in zip(tones, phases)) for i in range(n)]
    components = [.1 / (2 * math.pi * f) * 1000 for f in (10, 100)]
    analytic = tone_velocity_rms(tones, fs, band)
    close(analytic * 1000, 1.5994873825601217)
    close(rms(v), analytic)
    close(rms(a), math.sqrt(.02))
    psd = one_sided_psd(a, fs)
    df = fs / n
    close(sum(psd) * df, rms(a) ** 2)  # Parseval normalization check.
    close(psd_velocity_rms(psd, fs, band), analytic)
    actual_v = periodic_velocity(a, fs, band)
    waveform_error = max(abs(x - y) for x, y in zip(actual_v, v))
    assert waveform_error < 1e-14
    # Omitting the -90 degree integration phase fails even if RMS looks right.
    wrong_phase = [sum(math.sqrt(2) * amp / (2 * math.pi * f) *
                       math.sin(2 * math.pi * f * i / fs + phase)
                       for (f, amp), phase in zip(tones, phases)) for i in range(n)]
    close(rms(wrong_phase), analytic)
    assert rms([x - y for x, y in zip(wrong_phase, v)]) > analytic
    wrong_single_frequency = rms(a) / (2 * math.pi * 100)
    close(wrong_single_frequency * 1000, .22507907903927651)
    assert wrong_single_frequency < analytic / 7

    ideal_cut = tone_velocity_rms(tones, fs, (20, 200))
    close(ideal_cut * 1000, .15915494309189535)
    close(psd_velocity_rms(psd, fs, (20, 200)), ideal_cut)
    hp = tone_velocity_rms(tones, fs, band, fc=20)
    ratios = [abs(response(f, 20)) for f in (10, 100)]
    for f, amplitude_ratio in zip((10, 100), ratios):
        close(amplitude_ratio, f / math.hypot(f, 20))
        close(amplitude_ratio ** 2, f * f / (f * f + 400))
    close(hp * 1000, .7286713744699089)
    close(psd_velocity_rms(psd, fs, band, fc=20), hp)
    hp_v = periodic_velocity(a, fs, band, fc=20)
    close(rms(hp_v), hp)
    # Time-wave reference includes BOTH the high-pass phase and integration.
    hp_reference = [sum((math.sqrt(2) * amp * cmath.exp(1j * phase) *
                         response(f, 20) / (2j * math.pi * f) *
                         cmath.exp(2j * math.pi * f * i / fs)).imag
                        for (f, amp), phase in zip(tones, phases)) for i in range(n)]
    assert max(abs(x - y) for x, y in zip(hp_v, hp_reference)) < 1e-14
    # Applying |H| rather than |H|^2 to power is detectably wrong.
    wrong_hp = math.sqrt(sum((amp / (2 * math.pi * f)) ** 2 * abs(response(f, 20))
                            for f, amp in tones))
    assert wrong_hp > hp * 1.4

    bias = .001 * 9.80665
    ramp = uniform_integral([bias] * 1001, fs=100)
    close(ramp[-1] * 1000, 98.0665, atol=1e-9)
    close(ramp[500], bias * 5)
    initial_shift = uniform_integral([bias] * 1001, fs=100, initial=.2)
    close(initial_shift[-1] - ramp[-1], .2)
    bias_psd = one_sided_psd([bias] * n, fs)
    assert psd_velocity_rms(bias_psd, fs, band) < 1e-16
    biased_psd = one_sided_psd([value + bias for value in a], fs)
    close(psd_velocity_rms(biased_psd, fs, band), analytic)
    # Adding any constant initial velocity leaves acceleration unchanged.
    constant_speed_shift = .2
    close(sum(x + constant_speed_shift for x in v) / n, constant_speed_shift)
    assert abs(sum(actual_v) / n) < 1e-15

    # Same physical tones, changed coherent sample grid and independent phases.
    phase_grid_checks = 0
    for other_fs, size in [(512, 256), (1024, 512)]:
        for phase in [0, .5, 2.1]:
            record = [sum(math.sqrt(2) * amp * math.sin(2 * math.pi * f * i / other_fs + phase * (j + 1))
                          for j, (f, amp) in enumerate(tones)) for i in range(size)]
            close(psd_velocity_rms(one_sided_psd(record, other_fs), other_fs, band), analytic)
            phase_grid_checks += 1
    # Calibrated white acceleration PSD: finite-band numerical quadrature agrees
    # with the continuous 1/f^2 integral as bin width is made small. Not a sensor.
    fine_df, level = .01, 1e-6
    fine_fs = 512
    fine_psd = [level] * (int(fine_fs / (2 * fine_df)) + 1)
    # Inclusive rectangle centers create a small documented endpoint error.
    weighted_white = psd_velocity_rms(fine_psd, fine_fs, (10, 100))
    white_exact = math.sqrt(level / (4 * math.pi ** 2) * (1 / 10 - 1 / 100))
    assert abs(weighted_white / white_exact - 1) < .0003

    invalid_calls = [
        lambda: tone_velocity_rms(tones, 0, band),
        lambda: tone_velocity_rms(tones, True, band),
        lambda: tone_velocity_rms(tones, math.inf, band),
        lambda: tone_velocity_rms(tones, fs, (0, 200)),
        lambda: tone_velocity_rms(tones, fs, (-1, 200)),
        lambda: tone_velocity_rms(tones, fs, (20, 20)),
        lambda: tone_velocity_rms(tones, fs, (200, 20)),
        lambda: tone_velocity_rms(tones, fs, (5, fs / 2)),
        lambda: tone_velocity_rms(tones, fs, (5, math.nan)),
        lambda: tone_velocity_rms(tones, fs, (5,)),
        lambda: tone_velocity_rms([], fs, band),
        lambda: tone_velocity_rms([(0, .1)], fs, band),
        lambda: tone_velocity_rms([(fs / 2, .1)], fs, band),
        lambda: tone_velocity_rms([(10, -.1)], fs, band),
        lambda: tone_velocity_rms([(10, .1), (10, .2)], fs, band),
        lambda: tone_velocity_rms([(10, True)], fs, band),
        lambda: tone_velocity_rms([(10, math.nan)], fs, band),
        lambda: tone_velocity_rms([(10, .1, 0)], fs, band),
        lambda: tone_velocity_rms(tones, fs, band, fc=0),
        lambda: tone_velocity_rms(tones, fs, band, fc=-20),
        lambda: tone_velocity_rms(tones, fs, band, fc=math.inf),
        lambda: one_sided_psd([0, 1, 2], fs),
        lambda: one_sided_psd([0, 1, 2, 3, 4], fs),
        lambda: one_sided_psd([0, 1, math.nan, 3], fs),
        lambda: one_sided_psd([0, 1, True, 3], fs),
        lambda: one_sided_psd([0, 1, '2', 3], fs),
        lambda: one_sided_psd([0, 1, 2, 3], -1),
        lambda: psd_velocity_rms([0, -1, 0], fs, band),
        lambda: psd_velocity_rms([0, math.inf, 0], fs, band),
        lambda: psd_velocity_rms([0, 1], fs, band),
        lambda: psd_velocity_rms(psd, fs, (0, 200)),
        lambda: periodic_velocity(a, fs, (0, 200)),
        lambda: uniform_integral([bias], 100),
        lambda: uniform_integral([bias, bias], 0),
        lambda: uniform_integral([bias, math.inf], 100),
        lambda: uniform_integral([bias, bias], 100, initial=math.nan),
    ]
    for call in invalid_calls:
        try:
            call()
        except ValueError:
            pass
        else:
            raise AssertionError('Invalid input accepted')
    close(tone_velocity_rms([(10, 0)], fs, band), 0)
    close(psd_velocity_rms([0] * len(psd), fs, band), 0)

    return {
        'kind': 'original_band_limited_vibration_not_vendor_or_hardware',
        'components_mm_s_rms': components,
        'combined_mm_s_rms': analytic * 1000,
        'wrong_total_rms_at_100hz_mm_s': wrong_single_frequency * 1000,
        'ideal_20_to_200hz_mm_s_rms': ideal_cut * 1000,
        'first_order_20hz_highpass_amplitude_ratios': ratios,
        'first_order_highpass_mm_s_rms': hp * 1000,
        'bias_1mg_10s_endpoint_mm_s': ramp[-1] * 1000,
        'max_waveform_error_m_s': waveform_error,
        'parseval_and_psd_checked': True,
        'integration_and_highpass_phase_checked': True,
        'unknown_initial_velocity_not_recovered': True,
        'phase_and_sample_grid_checks': phase_grid_checks,
        'white_psd_quadrature_relative_error': abs(weighted_white / white_exact - 1),
        'invalid_inputs_rejected': len(invalid_calls),
    }


if __name__ == '__main__':
    print(json.dumps(run_checks(), indent=2, sort_keys=True))
