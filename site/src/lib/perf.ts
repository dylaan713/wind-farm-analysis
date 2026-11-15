/**
 * Watches frame times. `push` returns true exactly once: when, over the last two seconds' worth
 * of frames (at least 20 of them), more than half were over the limit. Judging by time rather
 * than a fixed number of frames means a very slow device is helped in two seconds, not thirty;
 * counting slow frames rather than averaging means a short burst of jank is not mistaken for one.
 */
export function frameBudget(limitMs = 24, spanMs = 2000, minFrames = 20): { push(ms: number): boolean } {
  const samples: number[] = [];
  let sum = 0, slow = 0, tripped = false;
  return {
    push(ms: number): boolean {
      const v = Math.min(ms, 100); // one long stall (a tab switch) is not a slow device
      samples.push(v);
      sum += v;
      if (v > limitMs) slow++;
      // Keep only the most recent frames that still add up to the span.
      while (samples.length > minFrames && sum - samples[0]! >= spanMs) {
        const gone = samples.shift()!;
        sum -= gone;
        if (gone > limitMs) slow--;
      }
      if (tripped || samples.length < minFrames || sum < spanMs || slow * 2 <= samples.length) return false;
      tripped = true;
      return true;
    },
  };
}
