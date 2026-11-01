/** `--perf-log` no argv ou `SALINHA_PERF_LOG=1` ligam a medição (só para dev). */
export function isPerfLogEnabled(
  argv: readonly string[],
  env: Record<string, string | undefined>
): boolean {
  return argv.includes('--perf-log') || env.SALINHA_PERF_LOG === '1'
}
