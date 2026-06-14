import type {
  PitchEnergyFrame,
  PitchEnergyOverview,
  SpectrogramFrame,
  SpectrogramOverview
} from "../../core/audio/types";
import type { SelectedTimeRange } from "../../core/project/types";
import { PIANO_KEYS } from "../../services/audio/spectrogram";

export interface SelectedRangeSummaryRequest {
  projectName: string;
  audioName: string;
  selectedTimeRange: SelectedTimeRange;
  beatSettings: BeatSettings;
  pitchEnergyOverview: PitchEnergyOverview | null | undefined;
  spectrogramOverview: SpectrogramOverview | null | undefined;
}

export interface BeatSettings {
  bpm: number;
  beatsPerBar: number;
  beatOffsetMs: number;
}

export interface SelectedRangeDescription {
  text: string;
  json: SelectedRangeSummaryJson;
}

export interface SelectedRangeSummaryJson {
  range: {
    startMs: number;
    endMs: number;
    durationMs: number;
  };
  beatContext: {
    bpm: number;
    beatsPerBar: number;
    beatOffsetMs: number;
    startBarBeat: string;
    endBarBeat: string;
  };
  pitchSummary: PitchSummary;
  source: {
    projectName: string;
    audioName: string;
    analysisKind: "pitch-energy" | "spectrogram";
  };
}

export interface PitchSummary {
  strongestMidiRange?: {
    startMidiNumber: number;
    endMidiNumber: number;
  };
  strongestNoteRange?: {
    startNote: string;
    endNote: string;
  };
  peakMoments: PeakMoment[];
  averageEnergyByPitchBand: {
    low: number;
    mid: number;
    high: number;
  };
}

export interface PeakMoment {
  startMs: number;
  endMs: number;
  timeMs: number;
  midiNumber: number;
  noteName: string;
  energy: number;
}

const FALLBACK_MIN_MIDI_NUMBER = 21;
const PEAK_MOMENT_LIMIT = 3;

export function describeSelectedRangeForLlm(
  request: SelectedRangeSummaryRequest
): SelectedRangeDescription {
  const { selectedTimeRange, beatSettings, pitchEnergyOverview, spectrogramOverview } = request;
  const durationMs = selectedTimeRange.endMs - selectedTimeRange.startMs;
  const range = {
    startMs: selectedTimeRange.startMs,
    endMs: selectedTimeRange.endMs,
    durationMs
  };
  const overlappingPitchFrames = filterOverlappingFrames(
    pitchEnergyOverview?.frames ?? [],
    selectedTimeRange
  );
  const overlappingSpectrogramFrames = filterOverlappingFrames(
    spectrogramOverview?.frames ?? [],
    selectedTimeRange
  );
  const pitchSummary = summarizePitchFrames({
    frames: overlappingPitchFrames,
    selectedTimeRange,
    minMidiNumber: pitchEnergyOverview?.minMidiNumber ?? FALLBACK_MIN_MIDI_NUMBER,
    notesPerFrame: pitchEnergyOverview?.notesPerFrame
  });
  const beatContext = {
    ...beatSettings,
    startBarBeat: formatBarBeat(selectedTimeRange.startMs, beatSettings),
    endBarBeat: formatBarBeat(selectedTimeRange.endMs, beatSettings)
  };
  const analysisKind =
    overlappingPitchFrames.length > 0
      ? "pitch-energy"
      : overlappingSpectrogramFrames.length > 0
        ? "spectrogram"
        : pitchEnergyOverview
          ? "pitch-energy"
          : "spectrogram";

  return {
    text: createSummaryText({
      projectName: request.projectName,
      audioName: request.audioName,
      range,
      beatContext,
      pitchSummary,
      hasPitchFrames: overlappingPitchFrames.length > 0,
      hasSpectrogramFrames: overlappingSpectrogramFrames.length > 0
    }),
    json: {
      range,
      beatContext,
      pitchSummary,
      source: {
        projectName: request.projectName,
        audioName: request.audioName,
        analysisKind
      }
    }
  };
}

function filterOverlappingFrames<Frame extends Pick<PitchEnergyFrame | SpectrogramFrame, "startMs" | "endMs">>(
  frames: Frame[],
  selectedTimeRange: SelectedTimeRange
) {
  return frames.filter(
    (frame) =>
      frame.endMs > selectedTimeRange.startMs && frame.startMs < selectedTimeRange.endMs
  );
}

function summarizePitchFrames({
  frames,
  selectedTimeRange,
  minMidiNumber,
  notesPerFrame
}: {
  frames: PitchEnergyFrame[];
  selectedTimeRange: SelectedTimeRange;
  minMidiNumber: number;
  notesPerFrame: number | undefined;
}): PitchSummary {
  const pitchCount = getPitchCount(frames, notesPerFrame);
  const averageEnergyByPitchBand = averageBands(frames, pitchCount);

  if (frames.length === 0 || pitchCount === 0) {
    return {
      peakMoments: [],
      averageEnergyByPitchBand
    };
  }

  const averageByMidi = averageByPitch(frames, pitchCount, minMidiNumber);
  const strongestPitch = averageByMidi.reduce(
    (best, pitch) => (pitch.energy > best.energy ? pitch : best),
    { midiNumber: minMidiNumber, energy: 0 }
  );
  const peakMoments = frames
    .map((frame) => getPeakMoment(frame, selectedTimeRange, minMidiNumber))
    .filter((moment): moment is PeakMoment => moment !== null)
    .sort((left, right) => right.energy - left.energy || left.timeMs - right.timeMs)
    .slice(0, PEAK_MOMENT_LIMIT);

  if (strongestPitch.energy <= 0) {
    return {
      peakMoments,
      averageEnergyByPitchBand
    };
  }

  const noteName = getNoteName(strongestPitch.midiNumber);

  return {
    strongestMidiRange: {
      startMidiNumber: strongestPitch.midiNumber,
      endMidiNumber: strongestPitch.midiNumber
    },
    strongestNoteRange: {
      startNote: noteName,
      endNote: noteName
    },
    peakMoments,
    averageEnergyByPitchBand
  };
}

function getPitchCount(frames: PitchEnergyFrame[], notesPerFrame: number | undefined) {
  if (notesPerFrame && notesPerFrame > 0) {
    return notesPerFrame;
  }

  return frames.reduce((maxCount, frame) => Math.max(maxCount, frame.energies.length), 0);
}

function averageByPitch(
  frames: PitchEnergyFrame[],
  pitchCount: number,
  minMidiNumber: number
) {
  return Array.from({ length: pitchCount }, (_, pitchIndex) => {
    const total = frames.reduce(
      (sum, frame) => sum + clampEnergy(frame.energies[pitchIndex] ?? 0),
      0
    );

    return {
      midiNumber: minMidiNumber + pitchIndex,
      energy: roundEnergy(total / frames.length)
    };
  });
}

function averageBands(frames: PitchEnergyFrame[], pitchCount: number) {
  if (frames.length === 0 || pitchCount === 0) {
    return { low: 0, mid: 0, high: 0 };
  }

  const totals = { low: 0, mid: 0, high: 0 };
  const counts = { low: 0, mid: 0, high: 0 };

  for (const frame of frames) {
    for (let pitchIndex = 0; pitchIndex < pitchCount; pitchIndex += 1) {
      const band = getPitchBand(pitchIndex, pitchCount);
      totals[band] += clampEnergy(frame.energies[pitchIndex] ?? 0);
      counts[band] += 1;
    }
  }

  return {
    low: counts.low === 0 ? 0 : roundEnergy(totals.low / counts.low),
    mid: counts.mid === 0 ? 0 : roundEnergy(totals.mid / counts.mid),
    high: counts.high === 0 ? 0 : roundEnergy(totals.high / counts.high)
  };
}

function getPeakMoment(
  frame: PitchEnergyFrame,
  selectedTimeRange: SelectedTimeRange,
  minMidiNumber: number
): PeakMoment | null {
  let peakPitchIndex = 0;
  let peakEnergy = 0;

  for (let pitchIndex = 0; pitchIndex < frame.energies.length; pitchIndex += 1) {
    const energy = clampEnergy(frame.energies[pitchIndex] ?? 0);
    if (energy > peakEnergy) {
      peakEnergy = energy;
      peakPitchIndex = pitchIndex;
    }
  }

  if (peakEnergy <= 0) {
    return null;
  }

  const startMs = Math.max(frame.startMs, selectedTimeRange.startMs);
  const endMs = Math.min(frame.endMs, selectedTimeRange.endMs);
  const midiNumber = minMidiNumber + peakPitchIndex;

  return {
    startMs,
    endMs,
    timeMs: Math.round((startMs + endMs) / 2),
    midiNumber,
    noteName: getNoteName(midiNumber),
    energy: roundEnergy(peakEnergy)
  };
}

function getPitchBand(pitchIndex: number, pitchCount: number): "low" | "mid" | "high" {
  const ratio = (pitchIndex + 0.5) / pitchCount;

  if (ratio < 1 / 3) {
    return "low";
  }

  if (ratio < 2 / 3) {
    return "mid";
  }

  return "high";
}

function createSummaryText({
  projectName,
  audioName,
  range,
  beatContext,
  pitchSummary,
  hasPitchFrames,
  hasSpectrogramFrames
}: {
  projectName: string;
  audioName: string;
  range: SelectedRangeSummaryJson["range"];
  beatContext: SelectedRangeSummaryJson["beatContext"];
  pitchSummary: PitchSummary;
  hasPitchFrames: boolean;
  hasSpectrogramFrames: boolean;
}) {
  const rangeText = `${formatSeconds(range.startMs)} to ${formatSeconds(range.endMs)}`;
  const beatText = `${beatContext.startBarBeat} to ${beatContext.endBarBeat} at ${beatContext.bpm} BPM, ${beatContext.beatsPerBar}/4, offset ${beatContext.beatOffsetMs} ms`;
  const pitchText =
    hasPitchFrames && pitchSummary.strongestMidiRange && pitchSummary.strongestNoteRange
      ? `Strongest pitch area: ${pitchSummary.strongestNoteRange.startNote} (MIDI ${pitchSummary.strongestMidiRange.startMidiNumber}); peak moments: ${formatPeakMoments(pitchSummary.peakMoments)}.`
      : `No pitch-energy frames are available for this selection${hasSpectrogramFrames ? "; spectrogram frames overlap the range" : ""}.`;

  return `Project "${projectName}", audio "${audioName}", selected range ${rangeText} (${formatSeconds(range.durationMs)} duration). Beat context: ${beatText}. ${pitchText}`;
}

function formatPeakMoments(peakMoments: PeakMoment[]) {
  if (peakMoments.length === 0) {
    return "none";
  }

  return peakMoments
    .map(
      (moment) =>
        `${formatSeconds(moment.timeMs)} ${moment.noteName} MIDI ${moment.midiNumber} energy ${moment.energy}`
    )
    .join(", ");
}

function formatBarBeat(timeMs: number, beatSettings: BeatSettings) {
  const { bpm, beatsPerBar, beatOffsetMs } = beatSettings;

  if (
    !Number.isFinite(timeMs) ||
    !Number.isFinite(bpm) ||
    !Number.isFinite(beatsPerBar) ||
    !Number.isFinite(beatOffsetMs) ||
    bpm <= 0 ||
    beatsPerBar <= 0
  ) {
    return "unknown";
  }

  const beatDurationMs = 60_000 / bpm;
  const beatIndex = Math.floor((timeMs - beatOffsetMs) / beatDurationMs + 1e-9);
  const barNumber = Math.floor(beatIndex / beatsPerBar) + 1;
  const beatNumber = mod(beatIndex, beatsPerBar) + 1;

  return `${barNumber}:${beatNumber}`;
}

function mod(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function getNoteName(midiNumber: number) {
  return PIANO_KEYS.find((key) => key.midiNumber === midiNumber)?.name ?? `MIDI ${midiNumber}`;
}

function clampEnergy(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function roundEnergy(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

function formatSeconds(timeMs: number) {
  return `${(timeMs / 1000).toFixed(3)}s`;
}
