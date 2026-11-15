/** Watches frame times. `push` returns true exactly once, when a full window of frames has averaged over the limit. */
export function frameBudget(limitMs = 24, window = 90): { push(ms: number): boolean } {
  const samples: number[] = [];
  let sum = 0, tripped = false;
  return {
    push(ms: number): boolean {
      const v = Math.min(ms, 100); // one long stall (a tab switch) is not a slow device
      samples.push(v);
      sum += v;
      if (samples.length > window) sum -= samples.shift()!;
      if (tripped || samples.length < window || sum / window <= limitMs) return false;
      tripped = true;
      return true;
    },
  };
}
