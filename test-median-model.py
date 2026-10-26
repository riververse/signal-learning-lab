"""Original finite causal median teaching model; no vendor library or hardware."""
import itertools
import json
import math

class CausalMedian:
    """Odd full windows only; None marks startup; state persists across blocks."""
    def __init__(self, width):
        if isinstance(width, bool) or not isinstance(width, int) or width < 1 or width % 2 == 0:
            raise ValueError('width must be a positive odd integer')
        self.width = width
        self.history = []

    def process(self, samples):
        samples = list(samples)
        if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in samples):
            raise ValueError('finite real samples required; rejected block does not mutate state')
        output = []
        for x in samples:
            self.history.append(x)
            self.history = self.history[-self.width:]
            output.append(sorted(self.history)[self.width // 2] if len(self.history) == self.width else None)
        return output

def centered(samples, width, mode):
    """Independent padding illustration, NOT an implementation of a vendor API."""
    if mode not in ('zero', 'nearest'):
        raise ValueError('unsupported padding')
    CausalMedian(width)  # same width validation
    half = width // 2
    def at(i):
        if 0 <= i < len(samples): return samples[i]
        return 0 if mode == 'zero' else samples[min(max(i, 0), len(samples)-1)]
    return [sorted(at(j) for j in range(i-half, i+half+1))[half] for i in range(len(samples))]

def main():
    run = lambda x: CausalMedian(5).process(x)
    isolated = [0]*8+[100]+[0]*12
    assert all(x == 0 for x in run(isolated)[4:])
    mean_peak = max(sum(isolated[i-4:i+1])/5 for i in range(4,len(isolated)))
    assert mean_peak == 20
    burst_peaks = []
    for length in (1,2,3):
        burst_peaks.append(max(run([0]*8+[100]*length+[0]*8)[4:]))
    assert burst_peaks == [0,0,100]
    step = run([0]*8+[1]*12)
    first_high = step.index(1)
    assert first_high == 10
    ramp = run(list(range(20)))
    assert ramp[:4] == [None]*4 and ramp[4:] == list(range(2,18))
    # Exact majority property for a CONSTANT baseline, not arbitrary trends.
    checked = 0
    for count in range(3):
        for positions in itertools.combinations(range(5),count):
            for signs in itertools.product((-100,100),repeat=count):
                window = [7]*5
                for p,s in zip(positions,signs): window[p] = s
                assert run(window)[-1] == 7
                checked += 1
    assert checked == 51
    a,b=[1,0,0,0,0],[0,1,1,0,0]
    assert run(a)[-1]+run(b)[-1] == 0
    assert run([x+y for x,y in zip(a,b)])[-1] == 1
    samples=[(i*17)%23 for i in range(40)]
    expected=run(samples);engine=CausalMedian(5);actual=[];offset=0;reset=[]
    for size in [1,7,2,13,17]:
        part=samples[offset:offset+size];offset+=size
        actual.extend(engine.process(part));reset.extend(run(part))
    assert actual == expected and reset != expected
    assert engine.process([]) == []
    edge=[10,1,1,1,1]
    assert centered(edge,5,'zero')[0] == 1
    assert centered(edge,5,'nearest')[0] == 10
    rejected=0
    for width in (0,-1,2,4,2.5,True):
        try: CausalMedian(width)
        except ValueError: rejected+=1
        else: raise AssertionError('invalid width accepted')
    for bad in (float('nan'),float('inf'),float('-inf'),True,'1'):
        before=engine.history[:]
        try: engine.process([1,bad])
        except ValueError: rejected+=1
        else: raise AssertionError('invalid sample accepted')
        assert engine.history == before
    assert CausalMedian(1).process([1,2,3]) == [1,2,3]
    print(json.dumps(dict(width=5,startup_invalid_samples=4,step_first_high_index=first_high,
        step_delay_samples=first_high-8,delay_ms_at_1khz=(first_high-8),burst_peaks=burst_peaks,
        mean_isolated_peak=mean_peak,constant_majority_windows=checked,invalid_cases_rejected=rejected,
        block_equivalence=True,padding_first_values=[1,10],status='PASS; original synthetic model only'),indent=2))

if __name__ == '__main__': main()
