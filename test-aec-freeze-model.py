"""原创浮点 NLMS 教学实验，不运行 TI 软件，不复现 C54x 定点或真实语音。

allow_update 是外部 oracle 布尔标签，绝非已实现的双讲检测器。
冻结只禁止系数更新；参考历史、FIR 预测、减去回声仍逐样本执行。
0<mu<2 是本模型参数限制，不保证所有真实输入/路径/噪声条件下收敛。
所有路径、噪声、长度、阈值均为任意教学设定，不拟合厂商性能数字。
不实现 DTD、NLP、codec/ADC、固定点或实际声学测试；TCL 不是 ERLE。
"""
import json
import math


def finite(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(name + ' must be a finite number, not bool')


class NLMS:
    def __init__(self, taps=4, mu=.3, eps=1e-6, weights=None):
        if isinstance(taps, bool) or not isinstance(taps, int) or taps < 1:
            raise ValueError('taps must be positive integer')
        finite(mu, 'mu')
        finite(eps, 'eps')
        if not 0 < mu < 2 or eps <= 0:
            raise ValueError('require 0 < mu < 2 and eps > 0')
        if weights is None:
            weights = [0.0]*taps
        if not isinstance(weights, (list, tuple)) or len(weights) != taps:
            raise ValueError('exactly taps initial weights required')
        for weight in weights:
            finite(weight, 'weight')
        self.weights = list(weights)
        self.history = [0.0]*(taps-1)
        self.mu, self.eps = mu, eps

    def step(self, reference, desired, allow_update):
        finite(reference, 'reference')
        finite(desired, 'desired')
        if type(allow_update) is not bool:
            raise ValueError('allow_update must be bool; no inferred DTD')
        vector = [reference]+self.history
        energy = sum(x*x for x in vector)
        predicted = sum(w*x for w, x in zip(self.weights, vector))
        error = desired-predicted
        if not all(math.isfinite(v) for v in (energy, energy+self.eps, predicted, error)):
            raise ValueError('nonfinite arithmetic; state not advanced')
        weights = list(self.weights)
        if allow_update:
            factor = self.mu*(error/(self.eps+energy))
            weights = [w+factor*x for w, x in zip(weights, vector)]
            if not all(math.isfinite(w) for w in weights):
                raise ValueError('update overflow; state not advanced')
        self.weights = weights
        self.history = vector[:-1]
        return {'predicted': predicted, 'error': error, 'reference_energy': energy}


def uniform(count, seed):
    """本地确定性 LCG 合成参考，非语音、非器件噪声模型。"""
    values = []
    for _ in range(count):
        seed = (1664525*seed+1013904223) % 2**32
        values.append(2*(seed/2**32)-1)
    return values


def echo(reference, path):
    return [sum(h*reference[i-k] for k, h in enumerate(path) if i >= k)
            for i in range(len(reference))]


def mse(values):
    return sum(x*x for x in values)/len(values)


def misalignment(weights, path):
    """未归一化系数误差平方和；不是 TCL 或 ERLE。"""
    return sum((w-h)**2 for w, h in zip(weights, path))


def run_checks():
    hand = NLMS(taps=2, mu=.5, eps=1)
    hand.history = [1]
    result = hand.step(2, 3, True)
    assert result['predicted'] == 0 and result['error'] == 3
    assert hand.weights == [.5, .25]
    frozen = NLMS(taps=2, weights=[.5, .25])
    outputs = [frozen.step(x, 0, False)['predicted'] for x in (2, 0, 4)]
    assert outputs == [1, .5, 2]
    assert frozen.weights == [.5, .25] and frozen.history == [4]
    silent = NLMS(weights=[.6, -.25, .12, .05])
    for _ in range(10):
        out = silent.step(0, 1, True)
        assert out == {'predicted': 0, 'error': 1, 'reference_energy': 0}
    assert silent.weights == [.6, -.25, .12, .05]
    tiny = NLMS(taps=1)
    tiny.step(1e-150, 1, True)
    assert all(math.isfinite(w) for w in tiny.weights)
    path = [.6, -.25, .12, .05]
    path2 = [-.2, .45, .1, -.08]
    training, dt_count, change_count = 2000, 400, 600
    reference = uniform(training+dt_count+change_count, 123456)
    actual_echo = echo(reference, path)
    train = NLMS()
    for i in range(training):
        train.step(reference[i], actual_echo[i], True)
    trained_error = misalignment(train.weights, path)
    assert trained_error < 1e-20
    def clone(source):
        copy = NLMS(mu=source.mu, eps=source.eps, weights=source.weights)
        copy.history = list(source.history)
        return copy
    freeze, keep_updating = clone(train), clone(train)
    near = [1.1*x for x in uniform(dt_count, 987654)]
    freeze_residual, update_residual = [], []
    preserved_error, distorted_error = [], []
    for j in range(dt_count):
        i = training+j
        desired = actual_echo[i]+near[j]
        a = freeze.step(reference[i], desired, False)
        b = keep_updating.step(reference[i], desired, True)
        freeze_residual.append(actual_echo[i]-a['predicted'])
        update_residual.append(actual_echo[i]-b['predicted'])
        preserved_error.append(a['error']-near[j])
        distorted_error.append(b['error']-near[j])
    freeze_mse, update_mse = mse(freeze_residual), mse(update_residual)
    assert freeze.weights == train.weights
    assert update_mse > .001 and freeze_mse < 1e-20
    assert misalignment(keep_updating.weights, path) > .001
    # In this synthetic decomposition e-near equals true_echo-prediction.
    # These are the SAME diagnostic, not two independent performance gains.
    assert math.isclose(mse(preserved_error), freeze_mse, abs_tol=1e-28)
    assert math.isclose(mse(distorted_error), update_mse, rel_tol=1e-12)
    changed_echo = echo(reference, path2)
    held, resumed = clone(freeze), clone(freeze)
    held_errors, resumed_errors = [], []
    for i in range(training+dt_count, len(reference)):
        held_errors.append(changed_echo[i]-held.step(reference[i], changed_echo[i], False)['predicted'])
        resumed_errors.append(changed_echo[i]-resumed.step(reference[i], changed_echo[i], True)['predicted'])
    assert misalignment(held.weights, path2) > .5
    assert misalignment(resumed.weights, path2) < 1e-20
    assert mse(resumed_errors[-100:]) < mse(held_errors[-100:])*1e-8
    # Changing block boundaries must not reset weights OR reference history.
    xs = uniform(113, 111)
    ds = echo(xs, path)
    flags = [i % 7 not in (2, 3) for i in range(len(xs))]
    whole, blocked = NLMS(), NLMS()
    expected = [whole.step(x, d, flag) for x, d, flag in zip(xs, ds, flags)]
    actual = []
    start = 0
    for size in (1, 17, 3, 40, 52):
        for i in range(start, start+size):
            actual.append(blocked.step(xs[i], ds[i], flags[i]))
        start += size
    assert actual == expected and blocked.weights == whole.weights
    wrong = []
    for start in range(0, len(xs), 17):
        reset = NLMS()
        wrong.extend(reset.step(xs[i], ds[i], flags[i])
                     for i in range(start, min(start+17, len(xs))))
    assert wrong != expected
    invalid = [lambda: NLMS(taps=0), lambda: NLMS(taps=True),
               lambda: NLMS(mu=0), lambda: NLMS(mu=2),
               lambda: NLMS(mu=float('nan')), lambda: NLMS(eps=0),
               lambda: NLMS(eps=-1), lambda: NLMS(eps=float('inf')),
               lambda: NLMS(weights=[0]), lambda: NLMS(weights=[0, 0, True, 0]),
               lambda: NLMS().step(1, 1, 1), lambda: NLMS().step(1, 1, 'freeze'),
               lambda: NLMS().step(float('nan'), 0, True),
               lambda: NLMS().step(0, float('inf'), False),
               lambda: NLMS().step(True, 0, True),
               lambda: NLMS().step(1e308, 0, False)]
    for call in invalid:
        try:
            call()
        except ValueError:
            pass
        else:
            raise AssertionError('accepted invalid model input')
    saved = (list(train.weights), list(train.history))
    try:
        train.step(1e308, 0, False)
    except ValueError:
        pass
    assert (train.weights, train.history) == saved
    assert 256/8000*1000 == 32
    # 独立教学功率账本：假设交叉项为零，不从上述有限波形估计功率。
    # 加入近端功率会改变远端/总残差比，却不改变已知回声分量的抑制比。
    px, pe, per, pv = 1.0, .25, .0025, .04
    erle = 10*math.log10(pe/per)
    tcl_single = 10*math.log10(px/per)
    tcl_double = 10*math.log10(px/(per+pv))
    assert math.isclose(erle, 20)
    assert math.isclose(tcl_single, 26.020599913279625)
    assert math.isclose(tcl_double, 13.716110699496886)
    assert tcl_double < tcl_single and erle == 20
    return {
        'kind': 'original_float_NLMS_oracle_gating_not_TI_reproduction',
        'parameters': {'taps': 4, 'mu': .3, 'eps': 1e-6, 'training_samples': training,
                       'doubletalk_samples': dt_count, 'path_change_samples': change_count,
                       'path': path, 'changed_path': path2, 'reference_seed': 123456,
                       'near_end_seed': 987654, 'near_end_scale': 1.1},
        'hand_step_weights': hand.weights, 'frozen_predictions': outputs,
        'trained_coefficient_error_squared': trained_error,
        'doubletalk_freeze_echo_only_residual_mse': freeze_mse,
        'doubletalk_update_echo_only_residual_mse': update_mse,
        'doubletalk_update_coefficient_error_squared': misalignment(keep_updating.weights, path),
        'near_end_preservation_mse_equals_echo_only_residual_mse': True,
        'changed_path_frozen_last100_echo_residual_mse': mse(held_errors[-100:]),
        'changed_path_resumed_last100_echo_residual_mse': mse(resumed_errors[-100:]),
        'changed_path_frozen_coefficient_error_squared': misalignment(held.weights, path2),
        'changed_path_resumed_coefficient_error_squared': misalignment(resumed.weights, path2),
        'zero_reference_energy_safe': True, 'block_state_equivalence': True,
        'wrong_block_reset_detected': True, 'invalid_inputs_rejected': len(invalid),
        'vendor_length_arithmetic_only_ms': 32,
        'independent_power_ledger': {
            'assumption': 'arbitrary powers; zero cross terms; not waveform or vendor measurement',
            'far_end_power': px, 'echo_before_power': pe, 'echo_residual_power': per,
            'added_near_end_power': pv, 'echo_only_ERLE_dB_both_conditions': erle,
            'far_end_to_total_residual_TCL_dB_single_talk': tcl_single,
            'far_end_to_total_residual_TCL_dB_with_near_end': tcl_double},
        'not_implemented': ['real DTD', 'TI >200 ms single-talk recovery logic', 'NLP',
                            'fixed-point C54x', 'codec/ADC', 'real acoustic/voice tests'],
        'metric_boundary': 'synthetic echo-only MSE and coefficient error, not TCL or vendor ERLE'
    }


if __name__ == '__main__':
    print(json.dumps(run_checks(), indent=2, allow_nan=False))
