/** Measures elapsed time in milliseconds using the monotonic high-resolution clock. */
export class HighResolutionTimer {
  private readonly start: bigint = process.hrtime.bigint();

  elapsed(): number {
    return Number(process.hrtime.bigint() - this.start) / 1_000_000;
  }

  /** Elapsed milliseconds rounded to the given number of decimals. */
  elapsedRounded(decimals = 2): number {
    const factor = 10 ** decimals;
    return Math.round(this.elapsed() * factor) / factor;
  }
}
