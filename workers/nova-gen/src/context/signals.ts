import type { Signal } from '@nova/shared-types';

/**
 * Signal interpretation — generic signal processing for generative pipeline.
 * No hardcoded persona assumptions; signals are weighted dynamically.
 */

export interface RawSignal {
  type: string;
  value: string;
  source?: string;
}

export function interpretSignals(
  rawSignals: RawSignal[],
  signalWeights?: Record<string, number>,
): Signal[] {
  return rawSignals.map((raw) => ({
    type: raw.type,
    value: raw.value,
    weight: signalWeights?.[raw.type] ?? 1.0,
  }));
}

export function summarizeSignals(signals: Signal[]): string {
  if (!signals.length) return 'No signals available.';

  const grouped: Record<string, string[]> = {};
  for (const signal of signals) {
    if (!grouped[signal.type]) grouped[signal.type] = [];
    grouped[signal.type].push(signal.value);
  }

  return Object.entries(grouped)
    .map(([type, values]) => `${type}: ${values.join(', ')}`)
    .join('; ');
}
