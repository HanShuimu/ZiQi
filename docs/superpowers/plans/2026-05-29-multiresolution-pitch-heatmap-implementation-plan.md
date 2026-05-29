# Multiresolution Pitch Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default pitch heatmap analysis path with a multiresolution STFT pipeline that outputs 100 fps, 88-key semitone-separated pitch energy without Essentia.

**Architecture:** Add a pure audio analysis module that mixes decoded audio to mono, creates downsampled analysis buffers, runs small FFTs with different effective window sizes, and projects magnitudes into A0-C8 semitone bands. Wire `browserPitchEnergyService` to call that module directly, preserving the existing `PitchEnergyOverview` contract and display controls.

**Tech Stack:** TypeScript, Vitest, Web Audio `AudioContext`, existing renderer logger, existing pitch heatmap core types, local FFT implementation adapted from the spectrogram service.

---

## File Structure

- Create `src/services/audio/pitchStft.ts`
  - Pure multiresolution STFT pitch analysis.
  - Exports `DEFAULT_PITCH_ENERGY_FRAMES_PER_SECOND`, `createMultiresolutionPitchEnergyOverviewFromBuffer`, `createPitchResolutionPlans`, and `selectPitchResolutionPlan`.
  - Owns note band calculation, downsample buffers, Hann windows, FFT, and pitch energy normalization.

- Create `src/services/audio/pitchStft.test.ts`
  - Unit coverage for 100 fps default, A0-C8 output shape, resolution selection, synthetic adjacent semitone separation, progress callbacks, and silent/empty buffers.

- Modify `src/services/audio/browserPitchEnergyService.ts`
  - Remove the production Essentia engine loading path.
  - Decode audio as before, then call `createMultiresolutionPitchEnergyOverviewFromBuffer`.
  - Preserve user-facing decode and analysis errors.
  - Keep best-effort trace logging, replacing engine-load logs with STFT config logs.

- Modify `src/services/audio/browserPitchEnergyService.test.ts`
  - Remove Essentia package loading expectations.
  - Assert the browser service calls the new default path, returns 100 fps by default, logs progress, and no longer emits `Failed to load pitch analysis engine.` for normal analysis.

- Keep unchanged unless tests reveal a direct break:
  - `src/core/audio/types.ts`
  - `src/core/audio/pitchHeatmap.ts`
  - `src/features/spectrogramViewer/SpectrogramView.tsx`
  - `src/app/commands/importAudioCommand.ts`
  - `src/app/commands/openProjectCommand.ts`

---

### Task 1: Add Pure Multiresolution STFT Tests

**Files:**
- Create: `src/services/audio/pitchStft.test.ts`
- Read: `src/core/audio/pitchHeatmap.ts`
- Read: `src/core/audio/types.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `src/services/audio/pitchStft.test.ts` with this content:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PITCH_ENERGY_FRAMES_PER_SECOND,
  createMultiresolutionPitchEnergyOverviewFromBuffer,
  createPitchResolutionPlans,
  selectPitchResolutionPlan
} from "./pitchStft";

class FakeAudioBuffer {
  readonly duration: number;
  readonly numberOfChannels: number;
  readonly sampleRate: number;

  constructor(private readonly channels: Float32Array[], sampleRate: number) {
    this.numberOfChannels = channels.length;
    this.sampleRate = sampleRate;
    this.duration = channels.length === 0 ? 0 : channels[0].length / sampleRate;
  }

  getChannelData(channel: number) {
    return this.channels[channel] ?? new Float32Array();
  }
}

function createSineSamples({
  durationSeconds,
  frequencyHz,
  sampleRate
}: {
  durationSeconds: number;
  frequencyHz: number;
  sampleRate: number;
}) {
  const sampleCount = Math.floor(durationSeconds * sampleRate);
  const samples = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = Math.sin((2 * Math.PI * frequencyHz * index) / sampleRate);
  }

  return samples;
}

function findStrongestPitchIndex(energies: number[]) {
  let strongestIndex = 0;
  let strongestEnergy = -Infinity;

  for (let index = 0; index < energies.length; index += 1) {
    if (energies[index] > strongestEnergy) {
      strongestEnergy = energies[index];
      strongestIndex = index;
    }
  }

  return strongestIndex;
}

describe("multiresolution pitch STFT", () => {
  it("uses 100 frames per second by default", () => {
    expect(DEFAULT_PITCH_ENERGY_FRAMES_PER_SECOND).toBe(100);

    const samples = new Float32Array(4_800);
    const buffer = new FakeAudioBuffer([samples], 48_000);
    const overview = createMultiresolutionPitchEnergyOverviewFromBuffer(buffer);

    expect(overview.framesPerSecond).toBe(100);
    expect(overview.frames).toHaveLength(10);
  });

  it("creates A0-C8 pitch frames with 88 energies per frame", () => {
    const samples = createSineSamples({
      durationSeconds: 0.2,
      frequencyHz: 440,
      sampleRate: 48_000
    });
    const buffer = new FakeAudioBuffer([samples], 48_000);

    const overview = createMultiresolutionPitchEnergyOverviewFromBuffer(buffer, {
      framesPerSecond: 20
    });

    expect(overview.minMidiNumber).toBe(21);
    expect(overview.maxMidiNumber).toBe(108);
    expect(overview.notesPerFrame).toBe(88);
    expect(overview.frames).toHaveLength(4);
    expect(overview.frames[0].energies).toHaveLength(88);
  });

  it("selects longer effective windows for lower notes and shorter windows for higher notes", () => {
    const plans = createPitchResolutionPlans(48_000);
    const a0Plan = selectPitchResolutionPlan({ midiNumber: 21, sampleRate: 48_000, plans });
    const a4Plan = selectPitchResolutionPlan({ midiNumber: 69, sampleRate: 48_000, plans });
    const c8Plan = selectPitchResolutionPlan({ midiNumber: 108, sampleRate: 48_000, plans });

    expect(a0Plan.effectiveWindowSamples).toBeGreaterThan(a4Plan.effectiveWindowSamples);
    expect(a4Plan.effectiveWindowSamples).toBeGreaterThan(c8Plan.effectiveWindowSamples);
    expect(a0Plan.frequencyBinWidthHz).toBeLessThan(1);
    expect(c8Plan.downsampleFactor).toBe(1);
  });

  it("separates adjacent A4 and A#4 synthetic semitones into different bins", () => {
    const sampleRate = 48_000;
    const durationSeconds = 0.75;
    const a4 = new FakeAudioBuffer(
      [createSineSamples({ durationSeconds, frequencyHz: 440, sampleRate })],
      sampleRate
    );
    const aSharp4 = new FakeAudioBuffer(
      [createSineSamples({ durationSeconds, frequencyHz: 466.1637615, sampleRate })],
      sampleRate
    );

    const a4Overview = createMultiresolutionPitchEnergyOverviewFromBuffer(a4, {
      framesPerSecond: 4
    });
    const aSharpOverview = createMultiresolutionPitchEnergyOverviewFromBuffer(aSharp4, {
      framesPerSecond: 4
    });

    const a4Index = findStrongestPitchIndex(a4Overview.frames[1].energies);
    const aSharpIndex = findStrongestPitchIndex(aSharpOverview.frames[1].energies);

    expect(a4Index).toBe(48);
    expect(aSharpIndex).toBe(49);
  });

  it("reports progress after each analyzed frame", () => {
    const samples = createSineSamples({
      durationSeconds: 0.25,
      frequencyHz: 440,
      sampleRate: 48_000
    });
    const buffer = new FakeAudioBuffer([samples], 48_000);
    const onProgress = vi.fn();

    createMultiresolutionPitchEnergyOverviewFromBuffer(buffer, {
      framesPerSecond: 8,
      onProgress
    });

    expect(onProgress).toHaveBeenCalledWith({ frameIndex: 1, frameCount: 2 });
    expect(onProgress).toHaveBeenCalledWith({ frameIndex: 2, frameCount: 2 });
  });

  it("returns empty frames for empty audio", () => {
    const buffer = new FakeAudioBuffer([new Float32Array()], 48_000);

    const overview = createMultiresolutionPitchEnergyOverviewFromBuffer(buffer);

    expect(overview.durationMs).toBe(0);
    expect(overview.frames).toEqual([]);
  });

  it("keeps silent audio near zero across all pitch bins", () => {
    const buffer = new FakeAudioBuffer([new Float32Array(4_800)], 48_000);

    const overview = createMultiresolutionPitchEnergyOverviewFromBuffer(buffer);

    expect(Math.max(...overview.frames.flatMap((frame) => frame.energies))).toBe(0);
  });
});
```

- [ ] **Step 2: Run the new test file and verify it fails because the module is missing**

Run:

```bash
npm test -- src/services/audio/pitchStft.test.ts
```

Expected: FAIL with a module resolution error for `./pitchStft`.

- [ ] **Step 3: Commit the failing tests**

Run:

```bash
git add -- src/services/audio/pitchStft.test.ts
git commit -m "Add multiresolution pitch STFT tests"
```

---

### Task 2: Implement Pure Multiresolution STFT Analysis

**Files:**
- Create: `src/services/audio/pitchStft.ts`
- Test: `src/services/audio/pitchStft.test.ts`

- [ ] **Step 1: Add the pure analysis module**

Create `src/services/audio/pitchStft.ts` with this implementation:

```ts
import {
  MAX_PITCH_MIDI_NUMBER,
  MIN_PITCH_MIDI_NUMBER,
  PITCH_HEATMAP_NOTE_COUNT,
  createPitchEnergyFrame
} from "../../core/audio/pitchHeatmap";
import type { PitchEnergyOverview } from "../../core/audio/types";

export interface PitchStftBuildOptions {
  framesPerSecond?: number;
  onProgress?: (progress: { frameIndex: number; frameCount: number }) => void;
}

interface DecodedAudioBuffer {
  duration: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export interface PitchResolutionPlan {
  downsampleFactor: number;
  fftSize: number;
  effectiveWindowSamples: number;
  frequencyBinWidthHz: number;
  nyquistHz: number;
}

interface NoteAnalysisPlan {
  midiNumber: number;
  pitchIndex: number;
  resolution: PitchResolutionPlan;
  startBin: number;
  centerBin: number;
  endBin: number;
}

interface AnalysisBuffer {
  plan: PitchResolutionPlan;
  samples: Float32Array;
  window: Float32Array;
  real: Float32Array;
  imaginary: Float32Array;
  magnitudes: Float32Array;
}

export const DEFAULT_PITCH_ENERGY_FRAMES_PER_SECOND = 100;

const A4_MIDI_NUMBER = 69;
const A4_FREQUENCY_HZ = 440;
const BASE_FFT_SIZE = 4096;
const MIN_NOTE_BINS = 4;
const RESOLUTION_DOWNSAMPLE_FACTORS = [16, 8, 4, 2, 1] as const;

export function createMultiresolutionPitchEnergyOverviewFromBuffer(
  buffer: DecodedAudioBuffer,
  options: PitchStftBuildOptions = {}
): PitchEnergyOverview {
  const framesPerSecond = options.framesPerSecond ?? DEFAULT_PITCH_ENERGY_FRAMES_PER_SECOND;
  const durationMs = Math.round(buffer.duration * 1000);
  const sampleCount = Math.max(0, Math.floor(buffer.duration * buffer.sampleRate));

  if (sampleCount === 0 || buffer.numberOfChannels === 0) {
    return createEmptyOverview(durationMs, framesPerSecond);
  }

  const monoSamples = mixToMono(buffer, sampleCount);
  const frameCount = Math.ceil(buffer.duration * framesPerSecond);
  const sourceHopSamples = buffer.sampleRate / framesPerSecond;
  const resolutionPlans = createPitchResolutionPlans(buffer.sampleRate);
  const notePlans = createNoteAnalysisPlans(buffer.sampleRate, resolutionPlans);
  const analysisBuffers = createAnalysisBuffers(monoSamples, resolutionPlans);
  const frames = new Array<PitchEnergyOverview["frames"][number]>(frameCount);

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const sourceCenterSample = Math.round((frameIndex + 0.5) * sourceHopSamples);
    const energies = new Array(PITCH_HEATMAP_NOTE_COUNT).fill(0);

    for (const analysisBuffer of analysisBuffers) {
      calculateSpectrumAtSourceSample(analysisBuffer, sourceCenterSample);
    }

    for (const notePlan of notePlans) {
      const analysisBuffer = analysisBuffers.find(
        (candidate) => candidate.plan === notePlan.resolution
      );
      energies[notePlan.pitchIndex] = analysisBuffer
        ? readWeightedBandEnergy(analysisBuffer.magnitudes, notePlan)
        : 0;
    }

    frames[frameIndex] = createPitchEnergyFrame({
      startMs: Math.round((frameIndex / framesPerSecond) * 1000),
      endMs: Math.min(durationMs, Math.round(((frameIndex + 1) / framesPerSecond) * 1000)),
      energies
    });

    options.onProgress?.({
      frameIndex: frameIndex + 1,
      frameCount
    });
  }

  return {
    durationMs,
    framesPerSecond,
    minMidiNumber: MIN_PITCH_MIDI_NUMBER,
    maxMidiNumber: MAX_PITCH_MIDI_NUMBER,
    notesPerFrame: PITCH_HEATMAP_NOTE_COUNT,
    frames
  };
}

export function createPitchResolutionPlans(sampleRate: number): PitchResolutionPlan[] {
  return RESOLUTION_DOWNSAMPLE_FACTORS.map((downsampleFactor) => {
    const analysisSampleRate = sampleRate / downsampleFactor;
    return {
      downsampleFactor,
      fftSize: BASE_FFT_SIZE,
      effectiveWindowSamples: BASE_FFT_SIZE * downsampleFactor,
      frequencyBinWidthHz: analysisSampleRate / BASE_FFT_SIZE,
      nyquistHz: analysisSampleRate / 2
    };
  });
}

export function selectPitchResolutionPlan({
  midiNumber,
  sampleRate,
  plans = createPitchResolutionPlans(sampleRate)
}: {
  midiNumber: number;
  sampleRate: number;
  plans?: PitchResolutionPlan[];
}) {
  const centerFrequency = midiToFrequency(midiNumber);
  const { lowerFrequencyHz, upperFrequencyHz } = getMidiBandBounds(midiNumber);
  const noteBandWidthHz = upperFrequencyHz - lowerFrequencyHz;
  const sortedPlans = [...plans].sort(
    (left, right) => left.effectiveWindowSamples - right.effectiveWindowSamples
  );

  return (
    sortedPlans.find(
      (plan) =>
        centerFrequency < plan.nyquistHz * 0.85 &&
        plan.frequencyBinWidthHz <= noteBandWidthHz / MIN_NOTE_BINS
    ) ?? sortedPlans[sortedPlans.length - 1]
  );
}

function createEmptyOverview(
  durationMs: number,
  framesPerSecond: number
): PitchEnergyOverview {
  return {
    durationMs,
    framesPerSecond,
    minMidiNumber: MIN_PITCH_MIDI_NUMBER,
    maxMidiNumber: MAX_PITCH_MIDI_NUMBER,
    notesPerFrame: PITCH_HEATMAP_NOTE_COUNT,
    frames: []
  };
}

function createNoteAnalysisPlans(sampleRate: number, plans: PitchResolutionPlan[]) {
  return Array.from({ length: PITCH_HEATMAP_NOTE_COUNT }, (_, pitchIndex) => {
    const midiNumber = MIN_PITCH_MIDI_NUMBER + pitchIndex;
    const resolution = selectPitchResolutionPlan({ midiNumber, sampleRate, plans });
    const { lowerFrequencyHz, centerFrequencyHz, upperFrequencyHz } =
      getMidiBandBounds(midiNumber);

    return {
      midiNumber,
      pitchIndex,
      resolution,
      startBin: frequencyToBin(lowerFrequencyHz, resolution),
      centerBin: frequencyToBin(centerFrequencyHz, resolution),
      endBin: Math.max(
        frequencyToBin(lowerFrequencyHz, resolution) + 1,
        frequencyToBin(upperFrequencyHz, resolution)
      )
    };
  });
}

function createAnalysisBuffers(
  sourceSamples: Float32Array,
  plans: PitchResolutionPlan[]
): AnalysisBuffer[] {
  return plans.map((plan) => ({
    plan,
    samples: downsample(sourceSamples, plan.downsampleFactor),
    window: createHannWindow(plan.fftSize),
    real: new Float32Array(plan.fftSize),
    imaginary: new Float32Array(plan.fftSize),
    magnitudes: new Float32Array(plan.fftSize / 2)
  }));
}

function calculateSpectrumAtSourceSample(
  analysisBuffer: AnalysisBuffer,
  sourceCenterSample: number
) {
  const centerSample = Math.round(sourceCenterSample / analysisBuffer.plan.downsampleFactor);
  const windowStart = centerSample - Math.floor(analysisBuffer.plan.fftSize / 2);

  analysisBuffer.real.fill(0);
  analysisBuffer.imaginary.fill(0);

  for (let index = 0; index < analysisBuffer.plan.fftSize; index += 1) {
    const sourceIndex = windowStart + index;
    analysisBuffer.real[index] =
      (sourceIndex >= 0 && sourceIndex < analysisBuffer.samples.length
        ? analysisBuffer.samples[sourceIndex]
        : 0) * analysisBuffer.window[index];
  }

  fft(analysisBuffer.real, analysisBuffer.imaginary);

  for (let index = 0; index < analysisBuffer.magnitudes.length; index += 1) {
    analysisBuffer.magnitudes[index] = Math.hypot(
      analysisBuffer.real[index],
      analysisBuffer.imaginary[index]
    );
  }
}

function readWeightedBandEnergy(magnitudes: Float32Array, notePlan: NoteAnalysisPlan) {
  let weightedTotal = 0;
  let weightTotal = 0;
  const startBin = Math.max(0, Math.min(magnitudes.length - 1, notePlan.startBin));
  const endBin = Math.max(startBin + 1, Math.min(magnitudes.length, notePlan.endBin + 1));
  const centerBin = Math.max(startBin, Math.min(endBin - 1, notePlan.centerBin));

  for (let binIndex = startBin; binIndex < endBin; binIndex += 1) {
    const leftDistance = Math.max(1, centerBin - startBin);
    const rightDistance = Math.max(1, endBin - 1 - centerBin);
    const weight =
      binIndex <= centerBin
        ? 1 - (centerBin - binIndex) / leftDistance
        : 1 - (binIndex - centerBin) / rightDistance;
    const safeWeight = Math.max(0.1, weight);

    weightedTotal += magnitudes[binIndex] * safeWeight;
    weightTotal += safeWeight;
  }

  return weightTotal === 0 ? 0 : weightedTotal / weightTotal;
}

function getMidiBandBounds(midiNumber: number) {
  const centerFrequencyHz = midiToFrequency(midiNumber);
  const previousFrequencyHz =
    midiNumber <= MIN_PITCH_MIDI_NUMBER ? centerFrequencyHz : midiToFrequency(midiNumber - 1);
  const nextFrequencyHz =
    midiNumber >= MAX_PITCH_MIDI_NUMBER ? centerFrequencyHz : midiToFrequency(midiNumber + 1);

  return {
    lowerFrequencyHz:
      midiNumber <= MIN_PITCH_MIDI_NUMBER
        ? centerFrequencyHz / 2 ** (1 / 24)
        : Math.sqrt(previousFrequencyHz * centerFrequencyHz),
    centerFrequencyHz,
    upperFrequencyHz:
      midiNumber >= MAX_PITCH_MIDI_NUMBER
        ? centerFrequencyHz * 2 ** (1 / 24)
        : Math.sqrt(centerFrequencyHz * nextFrequencyHz)
  };
}

function frequencyToBin(frequencyHz: number, plan: PitchResolutionPlan) {
  return Math.min(
    plan.fftSize / 2 - 1,
    Math.max(0, Math.round(frequencyHz / plan.frequencyBinWidthHz))
  );
}

function midiToFrequency(midiNumber: number) {
  return A4_FREQUENCY_HZ * 2 ** ((midiNumber - A4_MIDI_NUMBER) / 12);
}

function mixToMono(buffer: DecodedAudioBuffer, sampleCount: number) {
  const monoSamples = new Float32Array(sampleCount);

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    let mixedSample = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      mixedSample += buffer.getChannelData(channel)[sampleIndex] ?? 0;
    }
    monoSamples[sampleIndex] = mixedSample / buffer.numberOfChannels;
  }

  return monoSamples;
}

function downsample(samples: Float32Array, factor: number) {
  if (factor <= 1) {
    return samples;
  }

  const downsampled = new Float32Array(Math.ceil(samples.length / factor));

  for (let outputIndex = 0; outputIndex < downsampled.length; outputIndex += 1) {
    let total = 0;
    let count = 0;
    const startIndex = outputIndex * factor;
    const endIndex = Math.min(samples.length, startIndex + factor);

    for (let inputIndex = startIndex; inputIndex < endIndex; inputIndex += 1) {
      total += samples[inputIndex];
      count += 1;
    }

    downsampled[outputIndex] = count === 0 ? 0 : total / count;
  }

  return downsampled;
}

function createHannWindow(length: number) {
  const window = new Float32Array(length);

  if (length <= 1) {
    window.fill(1);
    return window;
  }

  for (let index = 0; index < length; index += 1) {
    window[index] = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (length - 1)));
  }

  return window;
}

function fft(real: Float32Array, imaginary: Float32Array) {
  const length = real.length;
  let j = 0;

  for (let i = 1; i < length; i += 1) {
    let bit = length >> 1;
    while ((j & bit) !== 0) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
    }
  }

  for (let size = 2; size <= length; size <<= 1) {
    const halfSize = size >> 1;
    const phaseStep = (-2 * Math.PI) / size;

    for (let start = 0; start < length; start += size) {
      for (let offset = 0; offset < halfSize; offset += 1) {
        const phase = phaseStep * offset;
        const cos = Math.cos(phase);
        const sin = Math.sin(phase);
        const evenIndex = start + offset;
        const oddIndex = evenIndex + halfSize;
        const oddReal = real[oddIndex] * cos - imaginary[oddIndex] * sin;
        const oddImaginary = real[oddIndex] * sin + imaginary[oddIndex] * cos;

        real[oddIndex] = real[evenIndex] - oddReal;
        imaginary[oddIndex] = imaginary[evenIndex] - oddImaginary;
        real[evenIndex] += oddReal;
        imaginary[evenIndex] += oddImaginary;
      }
    }
  }
}
```

- [ ] **Step 2: Run the pure STFT tests**

Run:

```bash
npm test -- src/services/audio/pitchStft.test.ts
```

Expected: PASS.

- [ ] **Step 3: If the adjacent semitone test fails by one bin, inspect the strongest bins before changing code**

Temporarily add this assertion detail inside the failing test, run once, then remove it before committing:

```ts
expect({
  a4Index,
  a4Energies: a4Overview.frames[1].energies.slice(45, 52),
  aSharpIndex,
  aSharpEnergies: aSharpOverview.frames[1].energies.slice(45, 52)
}).toEqual({});
```

Expected: The failure output shows whether the projection is shifted or too broad. Fix only the band bound or weighting logic needed to make A4 peak at index 48 and A#4 peak at index 49.

- [ ] **Step 4: Commit the pure STFT implementation**

Run:

```bash
git add -- src/services/audio/pitchStft.ts src/services/audio/pitchStft.test.ts
git commit -m "Add multiresolution pitch STFT analysis"
```

---

### Task 3: Wire Browser Pitch Service To STFT

**Files:**
- Modify: `src/services/audio/browserPitchEnergyService.ts`
- Modify: `src/services/audio/browserPitchEnergyService.test.ts`
- Test: `src/services/audio/browserPitchEnergyService.test.ts`

- [ ] **Step 1: Replace browser service tests**

Replace `src/services/audio/browserPitchEnergyService.test.ts` with:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserPitchEnergyService } from "./browserPitchEnergyService";

class FakeAudioBuffer {
  readonly duration: number;
  readonly numberOfChannels: number;
  readonly sampleRate: number;

  constructor(private readonly channels = [new Float32Array(4_800).fill(0.5)]) {
    this.duration = channels[0].length / 48_000;
    this.numberOfChannels = channels.length;
    this.sampleRate = 48_000;
  }

  getChannelData(channel: number) {
    return this.channels[channel] ?? new Float32Array();
  }
}

describe("createBrowserPitchEnergyService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "AudioContext");
  });

  it("decodes audio data and builds 100 fps 88-key pitch frames by default", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const decodeAudioData = vi.fn().mockResolvedValue(new FakeAudioBuffer());

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { close, decodeAudioData };
      })
    });

    const service = createBrowserPitchEnergyService();
    const overview = await service.buildOverviewFromAudioData(new ArrayBuffer(8));

    expect(decodeAudioData).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(overview.framesPerSecond).toBe(100);
    expect(overview.minMidiNumber).toBe(21);
    expect(overview.maxMidiNumber).toBe(108);
    expect(overview.notesPerFrame).toBe(88);
    expect(overview.frames).toHaveLength(10);
    expect(overview.frames[0].energies).toHaveLength(88);
  });

  it("honors an explicit frames-per-second override", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const decodeAudioData = vi.fn().mockResolvedValue(new FakeAudioBuffer());

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { close, decodeAudioData };
      })
    });

    const service = createBrowserPitchEnergyService();
    const overview = await service.buildOverviewFromAudioData(new ArrayBuffer(8), {
      framesPerSecond: 4
    });

    expect(overview.framesPerSecond).toBe(4);
    expect(overview.frames).toHaveLength(1);
  });

  it("logs pitch heatmap progress while analyzing frames", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const decodeAudioData = vi.fn().mockResolvedValue(new FakeAudioBuffer());
    const logger = { trace: vi.fn() };

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { close, decodeAudioData };
      })
    });

    const service = createBrowserPitchEnergyService({ logger });

    await service.buildOverviewFromAudioData(new ArrayBuffer(8), {
      framesPerSecond: 4
    });

    expect(logger.trace).toHaveBeenCalledWith(
      "pitchHeatmap.progress",
      "Analyzed pitch heatmap frame",
      expect.objectContaining({ frameIndex: 1, frameCount: 1 })
    );
  });

  it("continues analysis and closes the audio context when logging fails", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const decodeAudioData = vi.fn().mockResolvedValue(new FakeAudioBuffer());
    const logger = {
      trace: vi.fn(() => {
        throw new Error("logger failed");
      })
    };

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { close, decodeAudioData };
      })
    });

    const service = createBrowserPitchEnergyService({ logger });
    const overview = await service.buildOverviewFromAudioData(new ArrayBuffer(8), {
      framesPerSecond: 4
    });

    expect(overview.frames).toHaveLength(1);
    expect(decodeAudioData).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("throws a stable error when decoding fails", async () => {
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return {
          close: vi.fn().mockResolvedValue(undefined),
          decodeAudioData: vi.fn().mockRejectedValue(new Error("bad file"))
        };
      })
    });

    const service = createBrowserPitchEnergyService();

    await expect(service.buildOverviewFromAudioData(new ArrayBuffer(8))).rejects.toThrow(
      "Failed to generate pitch heatmap."
    );
  });

  it("throws a stable error when STFT analysis fails", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const decodeAudioData = vi.fn().mockResolvedValue(new FakeAudioBuffer());
    const logger = { trace: vi.fn() };

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { close, decodeAudioData };
      })
    });

    const service = createBrowserPitchEnergyService({
      buildOverviewFromBuffer: () => {
        throw new Error("analysis exploded");
      },
      logger
    });

    await expect(service.buildOverviewFromAudioData(new ArrayBuffer(8))).rejects.toThrow(
      "Failed to generate pitch heatmap."
    );
    expect(logger.trace).toHaveBeenCalledWith(
      "pitchHeatmap.overview.fail",
      "Failed to build pitch heatmap overview",
      expect.objectContaining({ errorMessage: "analysis exploded" })
    );
  });
});
```

- [ ] **Step 2: Run the browser service tests and verify they fail against the old service**

Run:

```bash
npm test -- src/services/audio/browserPitchEnergyService.test.ts
```

Expected: FAIL because `buildOverviewFromBuffer` is not accepted and the default path still loads Essentia.

- [ ] **Step 3: Replace the browser service implementation**

Modify `src/services/audio/browserPitchEnergyService.ts` so the service imports the STFT builder:

```ts
import {
  DEFAULT_PITCH_ENERGY_FRAMES_PER_SECOND,
  createMultiresolutionPitchEnergyOverviewFromBuffer
} from "./pitchStft";
```

Remove these exported types and functions from `browserPitchEnergyService.ts`:

```ts
export interface PitchEnergyEngine {
  analyzeFrame(frame: Float32Array, sampleRate: number): number[];
}

export async function loadEssentiaPitchEnergyEngine(): Promise<PitchEnergyEngine> {
  // remove this function completely
}
```

Use this dependency shape:

```ts
interface BrowserPitchEnergyServiceDependencies {
  buildOverviewFromBuffer?: typeof createMultiresolutionPitchEnergyOverviewFromBuffer;
  logger?: RendererLogger;
}
```

Set the default frames per second from the STFT module:

```ts
const DEFAULT_FRAMES_PER_SECOND = DEFAULT_PITCH_ENERGY_FRAMES_PER_SECOND;
```

Inside `createBrowserPitchEnergyService`, default the dependency:

```ts
export function createBrowserPitchEnergyService({
  buildOverviewFromBuffer = createMultiresolutionPitchEnergyOverviewFromBuffer,
  logger = rendererLogger
}: BrowserPitchEnergyServiceDependencies = {}): PitchEnergyService {
```

Delete the entire engine load stage and replace the overview call with:

```ts
const overview = buildOverviewFromBuffer(decodedAudio, {
  framesPerSecond,
  onProgress(progress) {
    options.onProgress?.(progress);
    if (shouldLogProgress(progress.frameIndex, progress.frameCount)) {
      traceAudioLog(logger, "pitchHeatmap.progress", "Analyzed pitch heatmap frame", {
        frameIndex: progress.frameIndex,
        frameCount: progress.frameCount,
        percent: Math.round((progress.frameIndex / progress.frameCount) * 100)
      });
    }
  }
});
```

Add STFT-specific details to the overview start log:

```ts
analysisEngine: "multiresolution-stft"
```

Keep `closeAudioContext`, `shouldLogProgress`, `traceAudioLog`, `nowMs`, `elapsedMs`, and `getErrorMessage`.

Remove now-unused helpers from `browserPitchEnergyService.ts`:

```ts
createPitchEnergyOverviewFromBuffer
extractCenteredFrame
unwrapEssentiaWASM
isEssentiaWASM
isRecord
mixToMono
```

- [ ] **Step 4: Run browser service tests**

Run:

```bash
npm test -- src/services/audio/browserPitchEnergyService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run pure STFT tests again**

Run:

```bash
npm test -- src/services/audio/pitchStft.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the browser service wiring**

Run:

```bash
git add -- src/services/audio/browserPitchEnergyService.ts src/services/audio/browserPitchEnergyService.test.ts
git commit -m "Use multiresolution STFT for pitch heatmaps"
```

---

### Task 4: Remove Essentia Package Dependency From Pitch Path

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `src/services/audio/browserPitchEnergyService.test.ts`
- Test: `src/services/audio/pitchStft.test.ts`

- [ ] **Step 1: Remove the unused runtime dependency**

Run:

```bash
npm uninstall essentia.js
```

Expected: `package.json` and `package-lock.json` no longer list `essentia.js`.

- [ ] **Step 2: Search for remaining Essentia usage**

Run:

```bash
rg -n "essentia|SpectrumCQ|loadEssentia" src package.json package-lock.json
```

Expected: no matches in `src`, `package.json`, or `package-lock.json`.

- [ ] **Step 3: Run pitch-related tests**

Run:

```bash
npm test -- src/services/audio/pitchStft.test.ts src/services/audio/browserPitchEnergyService.test.ts src/core/audio/pitchHeatmap.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit dependency cleanup**

Run:

```bash
git add -- package.json package-lock.json src/services/audio/browserPitchEnergyService.test.ts
git commit -m "Remove Essentia pitch analysis dependency"
```

---

### Task 5: Verify Existing Viewer And Command Contracts

**Files:**
- Read: `src/features/spectrogramViewer/SpectrogramView.test.tsx`
- Read: `src/app/commands/importAudioCommand.ts`
- Read: `src/app/commands/openProjectCommand.ts`
- Test: affected test suites

- [ ] **Step 1: Run viewer tests**

Run:

```bash
npm test -- src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: PASS. The renderer still receives `PitchEnergyOverview` and does not need a contract change.

- [ ] **Step 2: Run command and project tests that use pitch heatmap state**

Run:

```bash
npm test -- src/core/project/createProjectFromAudio.test.ts src/core/project/analysisView.test.ts src/core/workspace/workspaceState.test.ts
```

Expected: PASS.

- [ ] **Step 3: If command tests fail due to old service mocks, update only the mocks**

When a test mock expects `framesPerSecond: 24`, change that expected value to `100`. Use this shape:

```ts
const pitchEnergyOverview = {
  durationMs: 1000,
  framesPerSecond: 100,
  minMidiNumber: 21,
  maxMidiNumber: 108,
  notesPerFrame: 88,
  frames: []
};
```

- [ ] **Step 4: Commit any contract test adjustments**

If files changed, run:

```bash
git add -- src
git commit -m "Update pitch heatmap contract tests for STFT defaults"
```

If no files changed, skip this commit.

---

### Task 6: Full Verification And Runtime Smoke

**Files:**
- Read logs under `logs/`
- Verify app build and Electron runtime

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with no lint errors.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Start the built Electron app for a smoke test**

Run:

```bash
npm start
```

Expected:

- The app opens without `Failed to load pitch analysis engine.`
- Opening the known slow project produces `pitchHeatmap.overview.start`, `pitchHeatmap.progress`, and `pitchHeatmap.overview.end` log lines.
- Logs include `analysisEngine: "multiresolution-stft"`.
- `pitchHeatmap.overview.end.durationMs` is in the tens-of-seconds range for the reference 225-second audio, or the log makes the remaining bottleneck explicit.
- The heatmap renders 88 separate lanes and the existing gain/contrast sliders still visibly affect intensity.

- [ ] **Step 5: Capture the verification log path and performance numbers**

Record the newest log file under:

```text
logs/Ziqi-<start timestamp>.log
```

Summarize:

```text
pitchHeatmap.overview.start frameCount=<value> framesPerSecond=100 analysisEngine=multiresolution-stft
pitchHeatmap.overview.end durationMs=<value>
```

- [ ] **Step 6: Commit final verification notes only if a doc is changed**

If no docs are changed for verification notes, do not create a commit.

---

## Completion Criteria

- `src/services/audio/pitchStft.test.ts` proves A4 and A#4 peak in separate semitone bins.
- `createBrowserPitchEnergyService()` defaults to 100 fps.
- `browserPitchEnergyService.ts` does not import or load Essentia.
- `rg -n "essentia|SpectrumCQ|loadEssentia" src package.json package-lock.json` returns no active runtime usage.
- `npm test`, `npm run lint`, and `npm run build` pass.
- Electron smoke test confirms project open no longer fails with `Failed to load pitch analysis engine.`
- Runtime logs show the reference pitch heatmap analysis completing rather than aborting.
