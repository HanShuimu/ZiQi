# Static Spectrogram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-version fixed-resolution full-song spectrogram view with a waveform overview strip, log-frequency A0-C8 vertical mapping, a left piano-key coordinate rail, wavetone-style black/blue/green/yellow/red coloring, fixed time grid, and synchronized playback cursor.

**Architecture:** Add a pure spectrogram domain module for data types, log-frequency mapping, display color mapping, and spectrogram construction from decoded audio buffers. Add a browser service wrapper that decodes `ArrayBuffer` with Web Audio, then wire `App` to generate spectrogram data alongside waveform data before committing imported or opened projects. Keep rendering in focused React components so `WorkbenchShell` remains an orchestration shell rather than a canvas drawing module.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Electron preload/main boundaries already in place, browser Web Audio APIs.

---

## Scope Notes

This plan implements only the approved first phase from `docs/superpowers/specs/2026-05-10-static-spectrogram-design.md`.

It does not add zoom, pan, hover readouts, BPM grids, saved spectrogram caches, worker execution, multi-channel views, provider tasks, or click-to-seek.

## File Structure

- Create `src/domain/audio/spectrogram.ts`
  - Owns `SpectrogramOverview`, `SpectrogramFrame`, piano-key metadata, log-frequency mapping, energy color mapping, and pure decoded-buffer spectrogram generation.
- Create `src/domain/audio/spectrogram.test.ts`
  - Tests the pure spectrogram model, frequency mapping, color mapping, normalization, and silence behavior.
- Create `src/domain/audio/browserSpectrogramService.ts`
  - Owns Web Audio decoding and stable error mapping for spectrogram generation.
- Create `src/domain/audio/browserSpectrogramService.test.ts`
  - Tests browser service decode success, decode failure, and cleanup behavior.
- Modify `src/domain/audio/types.ts`
  - Re-export spectrogram types for UI consumers.
- Modify `src/App.tsx`
  - Adds injectable `spectrogramService`, current `spectrogramOverview` state, and import/open orchestration.
- Modify `src/App.test.tsx`
  - Adds spectrogram service fakes to relevant import/open tests and new failure-path tests.
- Create `src/components/SpectrogramView.tsx`
  - Renders the waveform overview strip, piano keyboard rail, spectrogram canvas, fixed time grid, and synchronized cursor.
- Create `src/components/SpectrogramView.test.tsx`
  - Tests canvas rendering contract, piano keys, waveform strip, time grid, and cursor position.
- Modify `src/components/WorkbenchShell.tsx`
  - Passes waveform, spectrogram, playback position, and duration into `SpectrogramView`.
- Modify `src/components/WorkbenchShell.test.tsx`
  - Updates expectations from standalone waveform panel to spectrogram-first panel.
- Modify `src/styles.css`
  - Adds stable dimensions and visual styling for the spectrogram layout, waveform strip, piano rail, grid, and canvas.

---

### Task 1: Add Pure Spectrogram Domain Model

**Files:**
- Create: `src/domain/audio/spectrogram.ts`
- Create: `src/domain/audio/spectrogram.test.ts`
- Modify: `src/domain/audio/types.ts`

- [ ] **Step 1: Write failing tests for piano range, log mapping, color mapping, and silence**

Create `src/domain/audio/spectrogram.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  MAX_PIANO_FREQUENCY_HZ,
  MIN_PIANO_FREQUENCY_HZ,
  PIANO_KEYS,
  createSpectrogramOverviewFromBuffer,
  frequencyToLogPosition,
  magnitudeToSpectrogramColor
} from "./spectrogram";

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

describe("spectrogram domain", () => {
  it("defines a stable 88-key A0-C8 piano range", () => {
    expect(PIANO_KEYS).toHaveLength(88);
    expect(PIANO_KEYS[0]).toMatchObject({
      midiNumber: 21,
      name: "A0",
      isBlackKey: false
    });
    expect(PIANO_KEYS[87]).toMatchObject({
      midiNumber: 108,
      name: "C8",
      isBlackKey: false
    });
    expect(MIN_PIANO_FREQUENCY_HZ).toBeCloseTo(27.5, 1);
    expect(MAX_PIANO_FREQUENCY_HZ).toBeCloseTo(4186, 0);
  });

  it("maps frequencies onto a monotonic log-frequency display axis", () => {
    const low = frequencyToLogPosition(MIN_PIANO_FREQUENCY_HZ);
    const middle = frequencyToLogPosition(440);
    const high = frequencyToLogPosition(MAX_PIANO_FREQUENCY_HZ);

    expect(low).toBe(0);
    expect(middle).toBeGreaterThan(low);
    expect(middle).toBeLessThan(high);
    expect(high).toBe(1);
  });

  it("maps normalized magnitudes to the wavetone-style color ramp", () => {
    expect(magnitudeToSpectrogramColor(0)).toBe("rgb(0, 0, 24)");
    expect(magnitudeToSpectrogramColor(0.25)).toBe("rgb(0, 0, 255)");
    expect(magnitudeToSpectrogramColor(0.5)).toBe("rgb(0, 255, 0)");
    expect(magnitudeToSpectrogramColor(0.75)).toBe("rgb(255, 255, 0)");
    expect(magnitudeToSpectrogramColor(1)).toBe("rgb(255, 0, 0)");
  });

  it("creates fixed-rate log-frequency spectrogram frames with normalized magnitudes", () => {
    const samples = new Float32Array(4096);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.sin((2 * Math.PI * 440 * index) / 4096);
    }
    const buffer = new FakeAudioBuffer([samples], 4096);

    const overview = createSpectrogramOverviewFromBuffer(buffer, {
      binsPerFrame: 24,
      framesPerSecond: 8,
      fftSize: 512
    });

    expect(overview.durationMs).toBe(1000);
    expect(overview.framesPerSecond).toBe(8);
    expect(overview.binsPerFrame).toBe(24);
    expect(overview.minFrequencyHz).toBe(MIN_PIANO_FREQUENCY_HZ);
    expect(overview.maxFrequencyHz).toBe(MAX_PIANO_FREQUENCY_HZ);
    expect(overview.frames).toHaveLength(8);
    for (const frame of overview.frames) {
      expect(frame.magnitudes).toHaveLength(24);
      expect(Math.min(...frame.magnitudes)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...frame.magnitudes)).toBeLessThanOrEqual(1);
    }
  });

  it("mixes multiple channels into mono before analysis", () => {
    const left = new Float32Array([1, 1, 1, 1, 1, 1, 1, 1]);
    const right = new Float32Array([-1, -1, -1, -1, -1, -1, -1, -1]);
    const buffer = new FakeAudioBuffer([left, right], 8);

    const overview = createSpectrogramOverviewFromBuffer(buffer, {
      binsPerFrame: 8,
      framesPerSecond: 2,
      fftSize: 8
    });

    expect(overview.frames.flatMap((frame) => frame.magnitudes)).toEqual(
      expect.arrayContaining([0])
    );
    expect(Math.max(...overview.frames.flatMap((frame) => frame.magnitudes))).toBe(0);
  });

  it("returns empty frames for empty audio", () => {
    const buffer = new FakeAudioBuffer([new Float32Array()], 44_100);

    const overview = createSpectrogramOverviewFromBuffer(buffer);

    expect(overview.durationMs).toBe(0);
    expect(overview.frames).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- src/domain/audio/spectrogram.test.ts`

Expected: FAIL because `src/domain/audio/spectrogram.ts` does not exist.

- [ ] **Step 3: Implement the pure spectrogram module**

Create `src/domain/audio/spectrogram.ts`:

```ts
export interface SpectrogramOverview {
  durationMs: number;
  framesPerSecond: number;
  minFrequencyHz: number;
  maxFrequencyHz: number;
  binsPerFrame: number;
  frames: SpectrogramFrame[];
}

export interface SpectrogramFrame {
  startMs: number;
  endMs: number;
  magnitudes: number[];
}

export interface SpectrogramBuildOptions {
  binsPerFrame?: number;
  framesPerSecond?: number;
  fftSize?: number;
}

interface DecodedAudioBuffer {
  duration: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export interface PianoKey {
  midiNumber: number;
  name: string;
  frequencyHz: number;
  isBlackKey: boolean;
  position: number;
}

const DEFAULT_BINS_PER_FRAME = 96;
const DEFAULT_FRAMES_PER_SECOND = 24;
const DEFAULT_FFT_SIZE = 2048;
const A4_MIDI_NUMBER = 69;
const A4_FREQUENCY_HZ = 440;
const PIANO_START_MIDI = 21;
const PIANO_END_MIDI = 108;
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const MIN_PIANO_FREQUENCY_HZ = midiToFrequency(PIANO_START_MIDI);
export const MAX_PIANO_FREQUENCY_HZ = midiToFrequency(PIANO_END_MIDI);

export const PIANO_KEYS: PianoKey[] = Array.from(
  { length: PIANO_END_MIDI - PIANO_START_MIDI + 1 },
  (_, index) => {
    const midiNumber = PIANO_START_MIDI + index;
    const noteIndex = midiNumber % 12;
    const name = `${NOTE_NAMES[noteIndex]}${Math.floor(midiNumber / 12) - 1}`;
    const frequencyHz = midiToFrequency(midiNumber);

    return {
      midiNumber,
      name,
      frequencyHz,
      isBlackKey: name.includes("#"),
      position: frequencyToLogPosition(frequencyHz)
    };
  }
);

export function createSpectrogramOverviewFromBuffer(
  buffer: DecodedAudioBuffer,
  options: SpectrogramBuildOptions = {}
): SpectrogramOverview {
  const binsPerFrame = options.binsPerFrame ?? DEFAULT_BINS_PER_FRAME;
  const framesPerSecond = options.framesPerSecond ?? DEFAULT_FRAMES_PER_SECOND;
  const fftSize = normalizeFftSize(options.fftSize ?? DEFAULT_FFT_SIZE);
  const durationMs = Math.round(buffer.duration * 1000);
  const sampleCount = Math.max(0, Math.floor(buffer.duration * buffer.sampleRate));

  if (sampleCount === 0 || buffer.numberOfChannels === 0) {
    return {
      durationMs: 0,
      framesPerSecond,
      minFrequencyHz: MIN_PIANO_FREQUENCY_HZ,
      maxFrequencyHz: MAX_PIANO_FREQUENCY_HZ,
      binsPerFrame,
      frames: []
    };
  }

  const monoSamples = mixToMono(buffer, sampleCount);
  const frameCount = Math.ceil(buffer.duration * framesPerSecond);
  const samplesPerFrame = buffer.sampleRate / framesPerSecond;
  const binRanges = createLogFrequencyBinRanges({
    binsPerFrame,
    fftSize,
    sampleRate: buffer.sampleRate
  });
  const rawFrames = Array.from({ length: frameCount }, (_, index) => {
    const centerSample = Math.floor(index * samplesPerFrame);
    const spectrum = calculateWindowSpectrum(monoSamples, centerSample, fftSize);
    const magnitudes = binRanges.map(({ startIndex, endIndex }) =>
      averageRange(spectrum, startIndex, endIndex)
    );

    return {
      startMs: Math.round((index / framesPerSecond) * 1000),
      endMs: Math.min(durationMs, Math.round(((index + 1) / framesPerSecond) * 1000)),
      magnitudes
    };
  });
  const maxMagnitude = Math.max(0, ...rawFrames.flatMap((frame) => frame.magnitudes));

  return {
    durationMs,
    framesPerSecond,
    minFrequencyHz: MIN_PIANO_FREQUENCY_HZ,
    maxFrequencyHz: MAX_PIANO_FREQUENCY_HZ,
    binsPerFrame,
    frames: rawFrames.map((frame) => ({
      ...frame,
      magnitudes: frame.magnitudes.map((value) => normalizeMagnitude(value, maxMagnitude))
    }))
  };
}

export function frequencyToLogPosition(frequencyHz: number) {
  const clampedFrequency = Math.min(
    MAX_PIANO_FREQUENCY_HZ,
    Math.max(MIN_PIANO_FREQUENCY_HZ, frequencyHz)
  );
  const minLog = Math.log2(MIN_PIANO_FREQUENCY_HZ);
  const maxLog = Math.log2(MAX_PIANO_FREQUENCY_HZ);
  return roundPosition((Math.log2(clampedFrequency) - minLog) / (maxLog - minLog));
}

export function magnitudeToSpectrogramColor(magnitude: number) {
  const value = Math.min(1, Math.max(0, magnitude));
  const stops = [
    { value: 0, color: [0, 0, 24] },
    { value: 0.25, color: [0, 0, 255] },
    { value: 0.5, color: [0, 255, 0] },
    { value: 0.75, color: [255, 255, 0] },
    { value: 1, color: [255, 0, 0] }
  ];

  for (let index = 0; index < stops.length - 1; index += 1) {
    const start = stops[index];
    const end = stops[index + 1];
    if (value >= start.value && value <= end.value) {
      const ratio = (value - start.value) / (end.value - start.value);
      const [red, green, blue] = start.color.map((channel, channelIndex) =>
        Math.round(channel + (end.color[channelIndex] - channel) * ratio)
      );
      return `rgb(${red}, ${green}, ${blue})`;
    }
  }

  return "rgb(255, 0, 0)";
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

function calculateWindowSpectrum(samples: Float32Array, centerSample: number, fftSize: number) {
  const real = new Float32Array(fftSize);
  const imaginary = new Float32Array(fftSize);
  const windowStart = centerSample - Math.floor(fftSize / 2);

  for (let index = 0; index < fftSize; index += 1) {
    const sample = samples[windowStart + index] ?? 0;
    real[index] = sample * hannWindow(index, fftSize);
  }

  fft(real, imaginary);

  const usableBinCount = Math.floor(fftSize / 2);
  return Array.from({ length: usableBinCount }, (_, index) =>
    Math.hypot(real[index], imaginary[index])
  );
}

function createLogFrequencyBinRanges({
  binsPerFrame,
  fftSize,
  sampleRate
}: {
  binsPerFrame: number;
  fftSize: number;
  sampleRate: number;
}) {
  return Array.from({ length: binsPerFrame }, (_, index) => {
    const startRatio = index / binsPerFrame;
    const endRatio = (index + 1) / binsPerFrame;
    const startFrequency = logPositionToFrequency(startRatio);
    const endFrequency = logPositionToFrequency(endRatio);
    const startIndex = frequencyToFftIndex(startFrequency, fftSize, sampleRate);
    const endIndex = Math.max(
      startIndex + 1,
      frequencyToFftIndex(endFrequency, fftSize, sampleRate)
    );

    return { startIndex, endIndex };
  });
}

function logPositionToFrequency(position: number) {
  return (
    MIN_PIANO_FREQUENCY_HZ *
    (MAX_PIANO_FREQUENCY_HZ / MIN_PIANO_FREQUENCY_HZ) ** Math.min(1, Math.max(0, position))
  );
}

function frequencyToFftIndex(frequencyHz: number, fftSize: number, sampleRate: number) {
  return Math.min(Math.floor(fftSize / 2) - 1, Math.max(0, Math.round((frequencyHz * fftSize) / sampleRate)));
}

function averageRange(values: number[], startIndex: number, endIndex: number) {
  let total = 0;
  let count = 0;

  for (let index = startIndex; index < endIndex; index += 1) {
    total += values[index] ?? 0;
    count += 1;
  }

  return count === 0 ? 0 : total / count;
}

function normalizeMagnitude(value: number, maxMagnitude: number) {
  if (maxMagnitude <= 0) {
    return 0;
  }

  return Math.round(Math.min(1, Math.max(0, value / maxMagnitude)) * 1000) / 1000;
}

function hannWindow(index: number, length: number) {
  if (length <= 1) {
    return 1;
  }

  return 0.5 * (1 - Math.cos((2 * Math.PI * index) / (length - 1)));
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

function normalizeFftSize(value: number) {
  const rounded = Math.max(8, Math.floor(value));
  return 2 ** Math.ceil(Math.log2(rounded));
}

function roundPosition(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
```

- [ ] **Step 4: Re-export spectrogram types**

Modify `src/domain/audio/types.ts` by adding this export at the end:

```ts
export type { SpectrogramFrame, SpectrogramOverview } from "./spectrogram";
```

- [ ] **Step 5: Run tests for the pure domain module**

Run: `npm test -- src/domain/audio/spectrogram.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the pure domain model**

```bash
git add src/domain/audio/spectrogram.ts src/domain/audio/spectrogram.test.ts src/domain/audio/types.ts
git commit -m "Add spectrogram domain model"
```

---

### Task 2: Add Browser Spectrogram Service

**Files:**
- Create: `src/domain/audio/browserSpectrogramService.ts`
- Create: `src/domain/audio/browserSpectrogramService.test.ts`

- [ ] **Step 1: Write failing browser service tests**

Create `src/domain/audio/browserSpectrogramService.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserSpectrogramService } from "./browserSpectrogramService";

class FakeAudioBuffer {
  readonly duration = 1;
  readonly numberOfChannels = 1;
  readonly sampleRate = 4096;

  getChannelData() {
    const samples = new Float32Array(4096);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.sin((2 * Math.PI * 440 * index) / 4096);
    }
    return samples;
  }
}

class ThrowingAudioBuffer extends FakeAudioBuffer {
  getChannelData() {
    throw new Error("spectrogram failed");
  }
}

describe("createBrowserSpectrogramService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "fetch");
    Reflect.deleteProperty(globalThis, "AudioContext");
  });

  it("decodes audio data into a spectrogram overview", async () => {
    const arrayBuffer = new ArrayBuffer(8);
    const decodeAudioData = vi.fn().mockResolvedValue(new FakeAudioBuffer());
    const close = vi.fn().mockRejectedValue(new Error("close failed"));

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: vi.fn()
    });
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { close, decodeAudioData };
      })
    });

    const service = createBrowserSpectrogramService();
    const overview = await service.buildOverviewFromAudioData(arrayBuffer, {
      binsPerFrame: 24,
      framesPerSecond: 8,
      fftSize: 512
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(decodeAudioData).toHaveBeenCalledWith(arrayBuffer);
    expect(overview.framesPerSecond).toBe(8);
    expect(overview.binsPerFrame).toBe(24);
    expect(overview.frames).toHaveLength(8);
    expect(close).toHaveBeenCalledOnce();
  });

  it("throws a stable error when decoding fails", async () => {
    const close = vi.fn().mockRejectedValue(new Error("close failed"));

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return {
          close,
          decodeAudioData: vi.fn().mockRejectedValue(new Error("bad file"))
        };
      })
    });

    const service = createBrowserSpectrogramService();

    await expect(service.buildOverviewFromAudioData(new ArrayBuffer(8))).rejects.toThrow(
      "Failed to generate spectrogram."
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not remap spectrogram generation errors", async () => {
    const close = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return {
          close,
          decodeAudioData: vi.fn().mockResolvedValue(new ThrowingAudioBuffer())
        };
      })
    });

    const service = createBrowserSpectrogramService();

    await expect(service.buildOverviewFromAudioData(new ArrayBuffer(8))).rejects.toThrow(
      "spectrogram failed"
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- src/domain/audio/browserSpectrogramService.test.ts`

Expected: FAIL because `browserSpectrogramService.ts` does not exist.

- [ ] **Step 3: Implement browser spectrogram service**

Create `src/domain/audio/browserSpectrogramService.ts`:

```ts
import {
  createSpectrogramOverviewFromBuffer,
  type SpectrogramBuildOptions,
  type SpectrogramOverview
} from "./spectrogram";

export interface SpectrogramService {
  buildOverviewFromAudioData(
    audioData: ArrayBuffer,
    options?: SpectrogramBuildOptions
  ): Promise<SpectrogramOverview>;
}

export function createBrowserSpectrogramService(): SpectrogramService {
  return {
    async buildOverviewFromAudioData(audioData, options) {
      const audioContext = new AudioContext();
      let decodedAudio: AudioBuffer;

      try {
        decodedAudio = await audioContext.decodeAudioData(audioData);
      } catch {
        throw new Error("Failed to generate spectrogram.");
      } finally {
        await closeAudioContext(audioContext);
      }

      return createSpectrogramOverviewFromBuffer(decodedAudio, options);
    }
  };
}

async function closeAudioContext(audioContext: AudioContext) {
  try {
    await audioContext.close?.();
  } catch {
    // Ignore cleanup failures so they do not mask the primary result or error.
  }
}
```

- [ ] **Step 4: Run browser spectrogram service tests**

Run: `npm test -- src/domain/audio/browserSpectrogramService.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit browser spectrogram service**

```bash
git add src/domain/audio/browserSpectrogramService.ts src/domain/audio/browserSpectrogramService.test.ts
git commit -m "Add browser spectrogram service"
```

---

### Task 3: Wire Spectrogram Generation Into App Import/Open Flow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Update App tests to require spectrogram generation on import**

In `src/App.test.tsx`, import the type:

```ts
import type { SpectrogramOverview, WaveformOverview } from "./domain/audio/types";
```

Add these helpers near the bottom, before `createProjectSummary`:

```ts
function createWaveformOverview(): WaveformOverview {
  return {
    pointsPerSecond: 50,
    durationMs: 12_000,
    points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
  };
}

function createSpectrogramOverview(): SpectrogramOverview {
  return {
    durationMs: 12_000,
    framesPerSecond: 24,
    minFrequencyHz: 27.5,
    maxFrequencyHz: 4186,
    binsPerFrame: 4,
    frames: [
      { startMs: 0, endMs: 42, magnitudes: [0, 0.25, 0.5, 1] },
      { startMs: 42, endMs: 84, magnitudes: [1, 0.5, 0.25, 0] }
    ]
  };
}

function createSpectrogramService(overrides?: {
  buildOverviewFromAudioData?: ReturnType<typeof vi.fn>;
}) {
  return {
    buildOverviewFromAudioData:
      overrides?.buildOverviewFromAudioData ?? vi.fn().mockResolvedValue(createSpectrogramOverview())
  };
}
```

Update the first import test by adding a spectrogram fake and assertion:

```ts
const spectrogramService = createSpectrogramService();

render(<App waveformService={waveformService} spectrogramService={spectrogramService} />);

await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

await waitFor(() => {
  expect(screen.getByText("demo track")).toBeTruthy();
});
expect(screen.getByLabelText("Audio spectrogram")).toBeTruthy();
expect(spectrogramService.buildOverviewFromAudioData).toHaveBeenCalledWith(audioData);
```

- [ ] **Step 2: Run the updated App test and verify failure**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because `AppProps` does not accept `spectrogramService`, and `WorkbenchShell` does not render an audio spectrogram.

- [ ] **Step 3: Update App to build and store spectrogram overview**

Modify `src/App.tsx` imports:

```ts
import {
  createBrowserSpectrogramService,
  type SpectrogramService
} from "./domain/audio/browserSpectrogramService";
import type { SpectrogramOverview, WaveformOverview } from "./domain/audio/types";
```

Change `AppProps`:

```ts
interface AppProps {
  waveformService?: WaveformService;
  spectrogramService?: SpectrogramService;
}
```

Change the component signature and add state/service:

```ts
export function App({ waveformService, spectrogramService }: AppProps) {
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [projectLocation, setProjectLocation] = useState<ProjectLocation | null>(null);
  const [waveformOverview, setWaveformOverview] = useState<WaveformOverview | null>(null);
  const [spectrogramOverview, setSpectrogramOverview] = useState<SpectrogramOverview | null>(null);
```

Add the service memo:

```ts
const activeSpectrogramService = useMemo(
  () => spectrogramService ?? createBrowserSpectrogramService(),
  [spectrogramService]
);
```

In `handleImportAudio`, after waveform generation, add spectrogram generation before loading the audio facade:

```ts
const nextWaveformOverview =
  await activeWaveformService.buildOverviewFromAudioData(selectedFile.audioData);
const nextSpectrogramOverview =
  await activeSpectrogramService.buildOverviewFromAudioData(selectedFile.audioData);
const metadata = await audioFacade.source.load(selectedFile.filePath, nextPlaybackUrl);
```

When committing import state, add:

```ts
setSpectrogramOverview(nextSpectrogramOverview);
```

In `handleOpenProject`, generate spectrogram before `audioFacade.source.load`:

```ts
const nextWaveformOverview =
  await activeWaveformService.buildOverviewFromAudioData(openedProject.audioData);
const nextSpectrogramOverview =
  await activeSpectrogramService.buildOverviewFromAudioData(openedProject.audioData);
await audioFacade.source.load(openedProject.project.sourceAudio.filePath, nextPlaybackUrl);
```

When committing opened state, add:

```ts
setSpectrogramOverview(nextSpectrogramOverview);
```

Pass the overview to `WorkbenchShell`:

```tsx
<WorkbenchShell
  audioFacade={audioFacade}
  importError={importError}
  isImporting={isImporting}
  isOpeningProject={isOpeningProject}
  isSavingProject={isSavingProject}
  onImportAudio={handleImportAudio}
  onOpenProject={handleOpenProject}
  onSaveProject={handleSaveProject}
  project={project}
  spectrogramOverview={spectrogramOverview}
  waveformOverview={waveformOverview}
/>
```

- [ ] **Step 4: Add explicit App failure-path tests for spectrogram failures**

Add this test in the import group:

```ts
it("keeps the current project and shows a stable error when spectrogram generation fails", async () => {
  const firstAudioData = new ArrayBuffer(8);
  const secondAudioData = new ArrayBuffer(16);
  window.ziqiApp.selectAudioFile = vi
    .fn()
    .mockResolvedValueOnce({
      audioData: firstAudioData,
      filePath: "D:\\Music Library\\demo track.wav"
    })
    .mockResolvedValueOnce({
      audioData: secondAudioData,
      filePath: "D:\\Music Library\\broken track.wav"
    });
  const waveformService = {
    buildOverviewFromAudioData: vi.fn().mockResolvedValue(createWaveformOverview())
  };
  const spectrogramService = createSpectrogramService({
    buildOverviewFromAudioData: vi
      .fn()
      .mockResolvedValueOnce(createSpectrogramOverview())
      .mockRejectedValueOnce(new Error("Failed to generate spectrogram."))
  });
  const user = userEvent.setup();

  render(<App waveformService={waveformService} spectrogramService={spectrogramService} />);

  await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);
  await waitFor(() => {
    expect(screen.getByText("demo track")).toBeTruthy();
  });

  await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

  await waitFor(() => {
    expect(screen.getByText("Failed to generate spectrogram.")).toBeTruthy();
  });
  expect(screen.getByText("demo track")).toBeTruthy();
  expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:audio-2");
});
```

Add this test near open failure tests:

```ts
it("keeps the current project and location when opened project spectrogram generation fails", async () => {
  const firstOpenedAudioData = new ArrayBuffer(8);
  const secondOpenedAudioData = new ArrayBuffer(16);
  window.ziqiApp.openProject = vi
    .fn()
    .mockResolvedValueOnce({
      audioData: firstOpenedAudioData,
      project: createProjectSummary("audio/demo track.wav"),
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    })
    .mockResolvedValueOnce({
      audioData: secondOpenedAudioData,
      project: createProjectSummary("audio/broken track.wav"),
      projectFilePath: "D:\\ZiQi Projects\\Broken\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Broken"
    });
  window.ziqiApp.saveProject = vi.fn().mockImplementation(async (request) => ({
    project: request.project,
    projectFilePath: request.projectFilePath,
    projectRootPath: request.projectRootPath
  }));
  const waveformService = {
    buildOverviewFromAudioData: vi.fn().mockResolvedValue(createWaveformOverview())
  };
  const spectrogramService = createSpectrogramService({
    buildOverviewFromAudioData: vi
      .fn()
      .mockResolvedValueOnce(createSpectrogramOverview())
      .mockRejectedValueOnce(new Error("Failed to generate spectrogram."))
  });
  const user = userEvent.setup();

  render(<App waveformService={waveformService} spectrogramService={spectrogramService} />);

  await user.click(screen.getByRole("button", { name: "Open Project" }));
  await waitFor(() => {
    expect(screen.getByText("demo track")).toBeTruthy();
  });

  await user.click(screen.getByRole("button", { name: "Open Project" }));
  await waitFor(() => {
    expect(screen.getByText("Failed to generate spectrogram.")).toBeTruthy();
  });

  await user.click(screen.getByRole("button", { name: "Save Project" }));
  await waitFor(() => {
    expect(window.ziqiApp.saveProject).toHaveBeenCalledOnce();
  });
  expect(window.ziqiApp.activateOpenedProject).toHaveBeenCalledTimes(1);
  expect(window.ziqiApp.saveProject).toHaveBeenCalledWith({
    project: expect.objectContaining({
      sourceAudio: expect.objectContaining({
        filePath: "audio/demo track.wav"
      })
    }),
    projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
    projectRootPath: "D:\\ZiQi Projects\\Demo"
  });
});
```

- [ ] **Step 5: Replace repetitive inline waveform fixtures in touched tests**

For tests touched while adding `spectrogramService`, replace repeated one-point waveform objects with:

```ts
const waveformService = {
  buildOverviewFromAudioData: vi.fn().mockResolvedValue(createWaveformOverview())
};
```

Do not refactor untouched tests in this task.

- [ ] **Step 6: Run App tests**

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit App spectrogram orchestration**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "Generate spectrograms during project activation"
```

---

### Task 4: Add Spectrogram View Component

**Files:**
- Create: `src/components/SpectrogramView.tsx`
- Create: `src/components/SpectrogramView.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing component tests**

Create `src/components/SpectrogramView.test.tsx`:

```ts
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpectrogramOverview, WaveformOverview } from "../domain/audio/types";
import { SpectrogramView } from "./SpectrogramView";

const drawCalls: Array<{ fillStyle: string; x: number; y: number; width: number; height: number }> = [];

function createWaveformOverview(): WaveformOverview {
  return {
    pointsPerSecond: 50,
    durationMs: 12_000,
    points: [
      { startMs: 0, endMs: 20, peak: 0.2 },
      { startMs: 20, endMs: 40, peak: 0.8 },
      { startMs: 40, endMs: 60, peak: 0.4 }
    ]
  };
}

function createSpectrogramOverview(): SpectrogramOverview {
  return {
    durationMs: 12_000,
    framesPerSecond: 24,
    minFrequencyHz: 27.5,
    maxFrequencyHz: 4186,
    binsPerFrame: 4,
    frames: [
      { startMs: 0, endMs: 42, magnitudes: [0, 0.25, 0.5, 1] },
      { startMs: 42, endMs: 84, magnitudes: [1, 0.5, 0.25, 0] }
    ]
  };
}

describe("SpectrogramView", () => {
  beforeEach(() => {
    drawCalls.length = 0;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ({
        clearRect: vi.fn(),
        fillRect: vi.fn(function (
          this: { fillStyle: string },
          x: number,
          y: number,
          width: number,
          height: number
        ) {
          drawCalls.push({ fillStyle: this.fillStyle, x, y, width, height });
        }),
        fillStyle: ""
      }))
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders waveform strip, piano rail, time grid, and spectrogram canvas", () => {
    render(
      <SpectrogramView
        currentTimeMs={3_000}
        durationMs={12_000}
        spectrogramOverview={createSpectrogramOverview()}
        waveformOverview={createWaveformOverview()}
      />
    );

    expect(screen.getByRole("img", { name: "Audio waveform overview" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Audio spectrogram" })).toBeTruthy();
    expect(screen.getByLabelText("Piano pitch axis")).toBeTruthy();
    expect(screen.getAllByTestId("piano-key")).toHaveLength(88);
    expect(screen.getAllByTestId("spectrogram-time-grid-line").length).toBeGreaterThan(1);
    expect(screen.getByTestId("spectrogram-cursor")).toHaveStyle({ left: "25%" });
    expect(drawCalls.some((call) => call.fillStyle === "rgb(255, 0, 0)")).toBe(true);
  });

  it("shows an empty spectrogram state without drawing bins", () => {
    render(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        spectrogramOverview={null}
        waveformOverview={createWaveformOverview()}
      />
    );

    expect(screen.getByText("Generating spectrogram...")).toBeTruthy();
    expect(drawCalls).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the failing component tests**

Run: `npm test -- src/components/SpectrogramView.test.tsx`

Expected: FAIL because `SpectrogramView.tsx` does not exist.

- [ ] **Step 3: Implement SpectrogramView**

Create `src/components/SpectrogramView.tsx`:

```tsx
import { useEffect, useMemo, useRef } from "react";
import {
  PIANO_KEYS,
  frequencyToLogPosition,
  magnitudeToSpectrogramColor
} from "../domain/audio/spectrogram";
import type { SpectrogramOverview, WaveformOverview } from "../domain/audio/types";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 420;
const MAX_RENDERED_WAVEFORM_POINTS = 800;

interface SpectrogramViewProps {
  currentTimeMs: number;
  durationMs: number;
  spectrogramOverview: SpectrogramOverview | null | undefined;
  waveformOverview: WaveformOverview | null | undefined;
}

export function SpectrogramView({
  currentTimeMs,
  durationMs,
  spectrogramOverview,
  waveformOverview
}: SpectrogramViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderedWaveformPoints = useMemo(
    () => getRenderedWaveformPoints(waveformOverview),
    [waveformOverview]
  );
  const progressPercent =
    durationMs > 0 ? Math.min(100, Math.max(0, (currentTimeMs / durationMs) * 100)) : 0;
  const timeGridLines = useMemo(() => createTimeGridLines(durationMs), [durationMs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !spectrogramOverview) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgb(0, 0, 0)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const frameWidth = canvas.width / Math.max(1, spectrogramOverview.frames.length);
    const binHeight = canvas.height / Math.max(1, spectrogramOverview.binsPerFrame);

    spectrogramOverview.frames.forEach((frame, frameIndex) => {
      frame.magnitudes.forEach((magnitude, binIndex) => {
        context.fillStyle = magnitudeToSpectrogramColor(magnitude);
        context.fillRect(
          frameIndex * frameWidth,
          canvas.height - (binIndex + 1) * binHeight,
          Math.ceil(frameWidth),
          Math.ceil(binHeight)
        );
      });
    });
  }, [spectrogramOverview]);

  return (
    <div className="spectrogram-view">
      <div className="waveform-overview" aria-label="Audio waveform overview" role="img">
        <div className="waveform-grid waveform-grid-compact">
          {renderedWaveformPoints.map((point) => (
            <div
              key={`${point.startMs}-${point.endMs}`}
              className="waveform-point"
              data-testid="waveform-point"
              style={{ height: `${Math.max(2, point.peak * 100)}%` }}
            />
          ))}
        </div>
        <div className="cursor-line cursor-line-vertical" style={{ left: `${progressPercent}%` }} />
      </div>

      <div className="spectrogram-body">
        <div className="piano-axis" aria-label="Piano pitch axis">
          {PIANO_KEYS.map((key) => (
            <div
              key={key.midiNumber}
              className={key.isBlackKey ? "piano-key piano-key-black" : "piano-key piano-key-white"}
              data-testid="piano-key"
              style={{
                bottom: `${frequencyToLogPosition(key.frequencyHz) * 100}%`
              }}
              title={key.name}
            />
          ))}
        </div>

        <div className="spectrogram-canvas-frame">
          <canvas
            aria-label="Audio spectrogram"
            className="spectrogram-canvas"
            height={CANVAS_HEIGHT}
            ref={canvasRef}
            role="img"
            width={CANVAS_WIDTH}
          />
          {!spectrogramOverview ? (
            <div className="spectrogram-empty">Generating spectrogram...</div>
          ) : null}
          {timeGridLines.map((position) => (
            <div
              key={position}
              className="spectrogram-time-grid-line"
              data-testid="spectrogram-time-grid-line"
              style={{ left: `${position}%` }}
            />
          ))}
          <div
            className="cursor-line cursor-line-vertical"
            data-testid="spectrogram-cursor"
            style={{ left: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

type RenderedWaveformPoint = WaveformOverview["points"][number];

function getRenderedWaveformPoints(
  waveformOverview: WaveformOverview | null | undefined
): RenderedWaveformPoint[] {
  const points = waveformOverview?.points ?? [];
  if (points.length <= MAX_RENDERED_WAVEFORM_POINTS) {
    return points;
  }

  return Array.from({ length: MAX_RENDERED_WAVEFORM_POINTS }, (_, index) => {
    const startIndex = Math.floor((index * points.length) / MAX_RENDERED_WAVEFORM_POINTS);
    const endIndex = Math.floor(((index + 1) * points.length) / MAX_RENDERED_WAVEFORM_POINTS);
    const group = points.slice(startIndex, Math.max(startIndex + 1, endIndex));

    return {
      startMs: group[0].startMs,
      endMs: group[group.length - 1].endMs,
      peak: Math.max(...group.map((point) => point.peak))
    };
  });
}

function createTimeGridLines(durationMs: number) {
  if (durationMs <= 0) {
    return [];
  }

  const durationSeconds = durationMs / 1000;
  const intervalSeconds = chooseGridIntervalSeconds(durationSeconds);
  const lineCount = Math.floor(durationSeconds / intervalSeconds);

  return Array.from({ length: lineCount }, (_, index) =>
    Math.round((((index + 1) * intervalSeconds) / durationSeconds) * 1000) / 10
  ).filter((position) => position > 0 && position < 100);
}

function chooseGridIntervalSeconds(durationSeconds: number) {
  if (durationSeconds <= 30) {
    return 5;
  }

  if (durationSeconds <= 180) {
    return 15;
  }

  return 30;
}
```

- [ ] **Step 4: Add spectrogram styles**

Append these focused styles to `src/styles.css`:

```css
.spectrogram-view {
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;
}

.waveform-overview {
  position: relative;
  height: 72px;
  border: 1px solid #d8c8b3;
  border-radius: 12px;
  background: #fff7ef;
  overflow: hidden;
  padding: 0.45rem;
}

.waveform-grid-compact {
  height: 100%;
}

.spectrogram-body {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 0.5rem;
  min-height: 420px;
}

.piano-axis {
  position: relative;
  min-height: 420px;
  border: 1px solid #211d1a;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f3eb;
}

.piano-key {
  position: absolute;
  left: 0;
  height: 1.4%;
  border-bottom: 1px solid rgba(25, 21, 18, 0.2);
}

.piano-key-white {
  width: 100%;
  background: #fbf8f1;
}

.piano-key-black {
  width: 62%;
  background: #191512;
  z-index: 1;
}

.spectrogram-canvas-frame {
  position: relative;
  min-width: 0;
  min-height: 420px;
  border: 1px solid #211d1a;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}

.spectrogram-canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

.spectrogram-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #d8c8b3;
  background: #000;
}

.spectrogram-time-grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255, 255, 255, 0.16);
  pointer-events: none;
}
```

- [ ] **Step 5: Run SpectrogramView tests**

Run: `npm test -- src/components/SpectrogramView.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit SpectrogramView**

```bash
git add src/components/SpectrogramView.tsx src/components/SpectrogramView.test.tsx src/styles.css
git commit -m "Add spectrogram view component"
```

---

### Task 5: Replace Workbench Main Canvas With Spectrogram View

**Files:**
- Modify: `src/components/WorkbenchShell.tsx`
- Modify: `src/components/WorkbenchShell.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Update WorkbenchShell tests for spectrogram-first display**

In `src/components/WorkbenchShell.test.tsx`, update the type import:

```ts
import type { SpectrogramOverview, WaveformOverview } from "../domain/audio/types";
```

Add helper:

```ts
function createSpectrogramOverview(): SpectrogramOverview {
  return {
    durationMs: 120_000,
    framesPerSecond: 24,
    minFrequencyHz: 27.5,
    maxFrequencyHz: 4186,
    binsPerFrame: 4,
    frames: [{ startMs: 0, endMs: 42, magnitudes: [0, 0.25, 0.5, 1] }]
  };
}
```

Update `"renders real waveform overview data when a project is loaded"` so it passes spectrogram data and expects both layers:

```tsx
render(
  <WorkbenchShell
    project={project}
    audioFacade={mockProjectAudioFacade}
    spectrogramOverview={createSpectrogramOverview()}
    waveformOverview={waveformOverview}
  />
);

expect(screen.getByRole("img", { name: "Audio waveform overview" })).toBeTruthy();
expect(screen.getByRole("img", { name: "Audio spectrogram" })).toBeTruthy();
expect(screen.getByLabelText("Piano pitch axis")).toBeTruthy();
expect(screen.getAllByTestId("waveform-point")).toHaveLength(3);
```

Update `"limits rendered waveform points for long overviews"` to pass `spectrogramOverview={createSpectrogramOverview()}` and expect the same 800 waveform points.

- [ ] **Step 2: Run updated WorkbenchShell tests and verify failure**

Run: `npm test -- src/components/WorkbenchShell.test.tsx`

Expected: FAIL because `WorkbenchShell` does not accept `spectrogramOverview` and still renders the old waveform canvas.

- [ ] **Step 3: Modify WorkbenchShell to use SpectrogramView**

In `src/components/WorkbenchShell.tsx`, add imports:

```ts
import type { PlaybackState, SpectrogramOverview, WaveformOverview } from "../domain/audio/types";
import { SpectrogramView } from "./SpectrogramView";
```

Update props:

```ts
interface WorkbenchShellProps {
  project: ProjectSummary | null;
  audioFacade?: ProjectAudioFacade;
  waveformOverview?: WaveformOverview | null;
  spectrogramOverview?: SpectrogramOverview | null;
  importError?: string | null;
  isImporting?: boolean;
  isOpeningProject?: boolean;
  isSavingProject?: boolean;
  onImportAudio?: () => Promise<void> | void;
  onOpenProject?: () => Promise<void> | void;
  onSaveProject?: () => Promise<void> | void;
}
```

Destructure `spectrogramOverview`:

```ts
spectrogramOverview,
```

Replace the old waveform canvas block whose opening element is `<div className="spectrum-canvas waveform-canvas" aria-label="Audio waveform" role="img">` with:

```tsx
<SpectrogramView
  currentTimeMs={playbackState.currentTimeMs}
  durationMs={durationMs}
  spectrogramOverview={spectrogramOverview}
  waveformOverview={waveformOverview}
/>
```

Remove `renderedWaveformPoints` and `getRenderedWaveformPoints` from `WorkbenchShell.tsx`, because that logic now lives in `SpectrogramView.tsx`.

- [ ] **Step 4: Remove old large waveform canvas CSS that is no longer referenced**

In `src/styles.css`, leave `.waveform-grid` and `.waveform-point` because `SpectrogramView` uses them.

Remove only these no-longer-used selectors if `rg` confirms they are unused:

```css
.spectrum-grid
.spectrum-column
.spectrum-bin
.waveform-canvas
.waveform-empty
.cursor-line-horizontal
.grid-overlay
```

Run this check before deleting selectors:

```bash
rg "spectrum-grid|spectrum-column|spectrum-bin|waveform-canvas|waveform-empty|cursor-line-horizontal|grid-overlay" src
```

Expected before deletion: matches only in `src/styles.css`. Expected after deletion: no matches.

- [ ] **Step 5: Run WorkbenchShell and SpectrogramView tests**

Run: `npm test -- src/components/WorkbenchShell.test.tsx src/components/SpectrogramView.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit Workbench UI integration**

```bash
git add src/components/WorkbenchShell.tsx src/components/WorkbenchShell.test.tsx src/styles.css
git commit -m "Show spectrogram in the workbench"
```

---

### Task 6: Complete App Test Coverage and Typecheck

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/components/WorkbenchShell.test.tsx`
- Modify: files needed only to fix type errors from previous tasks

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: PASS. If failures show tests that instantiate `<App waveformService={...} />` without a spectrogram service, use this rule:

- For tests that are about import/open success, inject `spectrogramService={createSpectrogramService()}` so success includes spectrogram generation.
- For tests that never click `Import Audio` or `Open Project`, leave them without injection.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: PASS. Fix only TypeScript/build errors caused by this feature.

- [ ] **Step 3: Commit test/build fixes if any files changed**

If `git status --short` shows changes after Step 1 or Step 2, commit them:

```bash
git add src
git commit -m "Stabilize spectrogram integration tests"
```

If no files changed, do not create an empty commit.

---

### Task 7: Real Electron Smoke Test

**Files:**
- No planned file changes.

- [ ] **Step 1: Build the app**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 2: Start Electron against the built app**

Run:

```powershell
$electron = 'D:\WORKSPACE\ZiQi\node_modules\.bin\electron.cmd'
$args = @('--remote-debugging-port=9222', 'dist-electron\main.js')
$proc = Start-Process -FilePath $electron -ArgumentList $args -WorkingDirectory 'D:\WORKSPACE\ZiQi' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 5
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:9222/json' -TimeoutSec 5 | Select-Object -ExpandProperty Content
```

Expected: JSON output with at least one inspectable Electron page.

- [ ] **Step 3: Manually import a real audio file**

In the Electron window:

1. Click `Import Audio`.
2. Choose a real local audio file.
3. Wait for import to finish.

Expected:

- The workbench shows the project name.
- The main panel displays a black spectrogram with blue, green, yellow, and red energy.
- The left rail shows piano-key blocks.
- The waveform strip remains visible above the spectrogram.
- Fixed time grid lines are visible.
- `Play`, `Pause`, and transport seek still work.
- The cursor moves across both the waveform strip and spectrogram.

- [ ] **Step 4: Save and reopen the project**

In the Electron window:

1. Click `Save Project`.
2. Choose a project parent folder.
3. Click `Open Project`.
4. Select the saved `.ziqi` file.

Expected:

- The reopened project displays a regenerated spectrogram from project-local audio.
- Playback still works.
- The spectrogram was not added to the `.ziqi` JSON file.

- [ ] **Step 5: Record smoke result in final implementation summary**

If the smoke test passes, include this exact verification line in the implementation final answer:

```text
Electron smoke: imported real audio, displayed spectrogram with piano axis and time grid, saved and reopened project successfully.
```

If the smoke test cannot be completed because of environment limits, include this exact risk line:

```text
Electron smoke not completed: [specific reason]. Remaining risk is real runtime rendering and file-dialog behavior.
```

---

## Plan Self-Review

Spec coverage:

- Fixed-resolution full-song spectrogram: Task 1 and Task 2.
- Import and open regeneration: Task 3.
- Black background with blue/green/yellow/red energy: Task 1 color function and Task 4 canvas rendering.
- Log-frequency A0-C8 axis: Task 1 mapping and Task 4 piano axis.
- Left 88-key piano UI: Task 4.
- Waveform overview strip: Task 4 and Task 5.
- Fixed time grid: Task 4.
- Playback cursor sync: Task 4 and Task 5.
- No `.ziqi` spectrogram persistence: Task 3 does not touch Electron project file format, and Task 7 smoke checks JSON.
- Failure paths preserving current project: Task 3.
- Verification: Task 6 and Task 7.

Placeholder scan:

- The plan contains no reserved placeholder markers, vague validation steps, or unspecified tests.
- Each code-changing task includes concrete code snippets and exact commands.

Type consistency:

- `SpectrogramOverview`, `SpectrogramFrame`, and `SpectrogramService` names are introduced before use.
- `buildOverviewFromAudioData` matches the existing `WaveformService` naming pattern.
- UI imports use re-exported types from `src/domain/audio/types.ts`.
