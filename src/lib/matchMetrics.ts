export type MetricDirection = "higher" | "lower";

/** Midrank percentile handles ties without letting one outlier dominate the verdict. */
export function compareMetric(value: number, values: number[], direction: MetricDirection = "higher") {
  const valid = values.filter(Number.isFinite);
  const better = (v: number) => direction === "lower" ? v < value : v > value;
  const worse = (v: number) => direction === "lower" ? v > value : v < value;
  const rank = 1 + valid.filter(better).length;
  const equal = valid.filter((v) => v === value).length;
  const percentile = valid.length > 1 ? (valid.filter(worse).length + Math.max(0, equal - 1) / 2) / (valid.length - 1) : 0.5;
  return {
    rank, count: valid.length,
    avg: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0,
    percentile,
    tone: percentile > 0.5 ? "good" : percentile < 0.5 ? "bad" : "neutral",
  } as const;
}