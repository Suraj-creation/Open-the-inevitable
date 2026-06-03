/**
 * Minimal metrics surface. Cognitive health metrics (drift, confidence calibration, policy
 * intervention rate, …) are recorded through this interface. Spec: spec/observability/cognitive-observability.md.
 * The in-memory meter supports tests and local inspection; a real OTel meter can implement the
 * same interface later.
 */
export interface Counter {
  add(value?: number, labels?: Record<string, string>): void;
}

export interface Histogram {
  record(value: number, labels?: Record<string, string>): void;
}

export interface Meter {
  counter(name: string): Counter;
  histogram(name: string): Histogram;
}

function labelKey(labels: Record<string, string> | undefined): string {
  if (!labels) return "";
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`)
    .join(",");
}

export interface MetricSnapshot {
  readonly counters: Record<string, number>;
  readonly histograms: Record<string, number[]>;
}

export class InMemoryMeter implements Meter {
  private readonly counters = new Map<string, number>();
  private readonly histograms = new Map<string, number[]>();

  counter(name: string): Counter {
    return {
      add: (value = 1, labels) => {
        const key = labelKey(labels) ? `${name}{${labelKey(labels)}}` : name;
        this.counters.set(key, (this.counters.get(key) ?? 0) + value);
      },
    };
  }

  histogram(name: string): Histogram {
    return {
      record: (value, labels) => {
        const key = labelKey(labels) ? `${name}{${labelKey(labels)}}` : name;
        const series = this.histograms.get(key) ?? [];
        series.push(value);
        this.histograms.set(key, series);
      },
    };
  }

  snapshot(): MetricSnapshot {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(this.histograms),
    };
  }
}
