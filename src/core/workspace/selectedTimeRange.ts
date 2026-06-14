import type { SelectedTimeRange } from "../project/types";

export function normalizeSelectedTimeRange(
  value: unknown,
  durationMs: number
): SelectedTimeRange | undefined {
  if (!isSelectedTimeRange(value) || !Number.isFinite(durationMs) || durationMs <= 0) {
    return undefined;
  }

  const startMs = clampTime(Math.round(value.startMs), durationMs);
  const endMs = clampTime(Math.round(value.endMs), durationMs);

  if (endMs <= startMs) {
    return undefined;
  }

  return { startMs, endMs };
}

function clampTime(value: number, durationMs: number) {
  return Math.min(durationMs, Math.max(0, value));
}

function isSelectedTimeRange(value: unknown): value is SelectedTimeRange {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isFinite((value as SelectedTimeRange).startMs) &&
    Number.isFinite((value as SelectedTimeRange).endMs)
  );
}
