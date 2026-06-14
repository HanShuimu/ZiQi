import { timeToViewportPercent, type SpectrogramViewport } from "../../core/spectrogramViewport";

const NICE_INTERVALS_MS = [
  50,
  100,
  200,
  500,
  1_000,
  2_000,
  5_000,
  10_000,
  15_000,
  30_000,
  60_000,
  120_000,
  300_000
] as const;

const MAX_TIME_RULER_TICKS = 1_000;
const MAX_BAR_BEAT_TICKS = 1_000;

export interface TimeRulerTick {
  kind: "major" | "medium" | "minor";
  timeMs: number;
  leftPercent: number;
  label?: string;
}

export interface BarBeatTick {
  kind: "bar" | "beat";
  timeMs: number;
  leftPercent: number;
  label?: string;
}

export function createTimeRulerTicks({
  viewport,
  targetMajorTickCount = 6
}: {
  viewport: SpectrogramViewport;
  targetMajorTickCount?: number;
}): TimeRulerTick[] {
  if (
    !Number.isFinite(viewport.startMs) ||
    !Number.isFinite(viewport.durationMs) ||
    viewport.durationMs <= 0 ||
    !Number.isFinite(targetMajorTickCount) ||
    targetMajorTickCount <= 0
  ) {
    return [];
  }

  const intervalMs = chooseNiceInterval(viewport.durationMs / targetMajorTickCount);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return [];
  }

  const endTimeMs = viewport.startMs + viewport.durationMs;
  if (!Number.isFinite(endTimeMs)) {
    return [];
  }

  const startTimeMs = Math.ceil(viewport.startMs / intervalMs) * intervalMs;
  if (!Number.isFinite(startTimeMs)) {
    return [];
  }

  const majorTickCount = Math.floor((endTimeMs - startTimeMs) / intervalMs) + 1;
  if (
    !Number.isFinite(majorTickCount) ||
    majorTickCount <= 0 ||
    majorTickCount * 4 > MAX_TIME_RULER_TICKS
  ) {
    return [];
  }

  const ticks: TimeRulerTick[] = [];

  for (let tickIndex = 0; tickIndex < majorTickCount; tickIndex += 1) {
    const timeMs = startTimeMs + tickIndex * intervalMs;
    if (!Number.isFinite(timeMs) || timeMs > endTimeMs) {
      break;
    }

    ticks.push({
      kind: "major",
      timeMs,
      leftPercent: timeToViewportPercent(timeMs, viewport),
      label: formatRulerTime(timeMs, intervalMs)
    });

    const mediumTimeMs = timeMs + intervalMs / 2;
    if (mediumTimeMs < endTimeMs) {
      ticks.push({
        kind: "medium",
        timeMs: mediumTimeMs,
        leftPercent: timeToViewportPercent(mediumTimeMs, viewport)
      });
    }

    const quarterMs = intervalMs / 4;
    for (const minorTimeMs of [timeMs + quarterMs, timeMs + quarterMs * 3]) {
      if (minorTimeMs < endTimeMs) {
        ticks.push({
          kind: "minor",
          timeMs: minorTimeMs,
          leftPercent: timeToViewportPercent(minorTimeMs, viewport)
        });
      }
    }
  }

  return ticks.filter((tick) => tick.leftPercent >= 0 && tick.leftPercent <= 100);
}

export function createBarBeatTicks({
  viewport,
  bpm,
  beatsPerBar,
  beatOffsetMs
}: {
  viewport: SpectrogramViewport;
  bpm: number;
  beatsPerBar: number;
  beatOffsetMs: number;
}): BarBeatTick[] {
  if (
    !Number.isFinite(viewport.startMs) ||
    !Number.isFinite(viewport.durationMs) ||
    viewport.durationMs <= 0 ||
    !Number.isFinite(bpm) ||
    !Number.isFinite(beatsPerBar) ||
    !Number.isFinite(beatOffsetMs) ||
    bpm <= 0 ||
    beatsPerBar <= 0 ||
    !Number.isInteger(beatsPerBar)
  ) {
    return [];
  }

  const beatDurationMs = 60_000 / bpm;
  if (!Number.isFinite(beatDurationMs) || beatDurationMs <= 0) {
    return [];
  }

  const viewportEndMs = viewport.startMs + viewport.durationMs;
  if (!Number.isFinite(viewportEndMs) || viewportEndMs <= viewport.startMs) {
    return [];
  }

  const firstBeatIndex = Math.ceil((viewport.startMs - beatOffsetMs) / beatDurationMs);
  if (!Number.isFinite(firstBeatIndex) || !Number.isSafeInteger(firstBeatIndex)) {
    return [];
  }

  const firstBeatTimeMs = beatOffsetMs + firstBeatIndex * beatDurationMs;
  if (!isSafeBeatTime(firstBeatTimeMs)) {
    return [];
  }

  const beatTickCount =
    Math.floor((viewportEndMs - firstBeatTimeMs) / beatDurationMs) + 1;
  if (
    !Number.isFinite(beatTickCount) ||
    beatTickCount <= 0 ||
    beatTickCount > MAX_BAR_BEAT_TICKS
  ) {
    return [];
  }

  const lastBeatIndex = firstBeatIndex + beatTickCount - 1;
  if (!Number.isSafeInteger(lastBeatIndex)) {
    return [];
  }

  const lastBeatTimeMs = beatOffsetMs + lastBeatIndex * beatDurationMs;
  if (!isSafeBeatTime(lastBeatTimeMs)) {
    return [];
  }

  const ticks: BarBeatTick[] = [];

  for (let tickOffset = 0; tickOffset < beatTickCount; tickOffset += 1) {
    const beatIndex = firstBeatIndex + tickOffset;
    const timeMs = beatOffsetMs + beatIndex * beatDurationMs;
    if (!isSafeBeatTime(timeMs)) {
      return [];
    }

    if (timeMs < viewport.startMs) {
      continue;
    }

    const normalizedBeatIndex = Math.round(beatIndex);
    const isBar = normalizedBeatIndex % beatsPerBar === 0;
    const barNumber = Math.floor(normalizedBeatIndex / beatsPerBar) + 1;

    ticks.push({
      kind: isBar ? "bar" : "beat",
      timeMs,
      leftPercent: timeToViewportPercent(timeMs, viewport),
      label: isBar ? `${barNumber}:1` : undefined
    });
  }

  return ticks.filter((tick) => tick.leftPercent >= 0 && tick.leftPercent <= 100);
}

function chooseNiceInterval(rawIntervalMs: number) {
  return NICE_INTERVALS_MS.find((interval) => interval >= rawIntervalMs) ?? NICE_INTERVALS_MS.at(-1)!;
}

function isSafeBeatTime(timeMs: number) {
  return Number.isFinite(timeMs) && Number.isSafeInteger(Math.round(timeMs));
}

function formatRulerTime(timeMs: number, intervalMs: number) {
  const safeTimeMs = Math.max(0, Math.round(timeMs));
  const totalSeconds = Math.floor(safeTimeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (intervalMs < 1_000) {
    const milliseconds = safeTimeMs % 1000;

    if (minutes > 0) {
      return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(
        3,
        "0"
      )}`;
    }

    return `${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  }

  const tenths = Math.floor((safeTimeMs % 1000) / 100);

  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
  }

  return `${String(seconds).padStart(2, "0")}.${tenths}`;
}
