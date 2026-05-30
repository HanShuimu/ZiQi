# Pitch Heatmap Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current continuous spectrogram with an Essentia.js-powered A0-C8 pitch heatmap, with project-persisted display sliders in the existing control area.

**Architecture:** Add pitch-specific core types and display settings, then introduce a `PitchEnergyService` that produces `PitchEnergyOverview` from decoded audio via Essentia.js `SpectrumCQ`. Thread the new overview and display settings through app session/project commands, then replace the main spectrogram canvas with an 88-lane pitch heatmap renderer that redraws immediately when display settings change.

**Tech Stack:** React 19, TypeScript, Vite, Electron, Vitest/jsdom, Web Audio, Essentia.js WebAssembly.

---

## File Structure

- Modify `package.json` and `package-lock.json`: add the `essentia.js` runtime dependency.
- Modify `src/core/audio/types.ts`: add `PitchEnergyOverview`, `PitchEnergyFrame`, and `PitchHeatmapDisplaySettings`.
- Create `src/core/audio/pitchHeatmap.ts`: MIDI constants, default display settings, clamp/reset helpers, note-index mapping, and display value mapping.
- Create `src/core/audio/pitchHeatmap.test.ts`: focused tests for note mapping and display setting behavior.
- Modify `src/core/project/types.ts`: add `analysisView.pitchHeatmapDisplay` to `ProjectSummary`.
- Create `src/core/project/analysisView.ts`: normalize project analysis view settings.
- Create `src/core/project/analysisView.test.ts`: defaults and clamp behavior for saved project settings.
- Modify `src/core/project/createProjectFromAudio.ts` and test: initialize default `analysisView`.
- Modify `electron/platform/projectFiles/projectFiles.test.ts`: assert project payload preserves `analysisView`.
- Create `src/services/audio/browserPitchEnergyService.ts`: decode audio and generate `PitchEnergyOverview` through an injectable Essentia adapter.
- Create `src/services/audio/browserPitchEnergyService.test.ts`: mock Web Audio and Essentia adapter.
- Modify `src/app/session/types.ts`, `src/app/session/AppSessionProvider.tsx`, and `src/app/commands/projectCommandTypes.ts`: add pitch overview/service state.
- Modify `src/app/commands/importAudioCommand.ts`, `src/app/commands/openProjectCommand.ts`, `src/app/commands/saveProjectCommand.ts`, and command tests: generate and preserve pitch heatmap state.
- Modify `src/workspaces/transcription/TranscriptionWorkspace.tsx`: pass pitch overview to the main viewer.
- Modify `src/features/spectrogramViewer/SpectrogramViewer.tsx`: rename user-facing heading to Pitch Heatmap and wire display setting updates.
- Modify `src/features/spectrogramViewer/WorkspaceControlZone.tsx`: add Heatmap Display sliders and reset button.
- Create or modify `src/features/spectrogramViewer/PitchHeatmapView.tsx`: 88-lane canvas renderer, waveform strip, piano axis, viewport, and navigator.
- Modify `src/features/spectrogramViewer/SpectrogramView.tsx` or replace its internals with `PitchHeatmapView` while keeping exports stable for a narrow diff.
- Modify `src/features/spectrogramViewer/SpectrogramView.test.tsx` and `src/features/spectrogramViewer/SpectrogramViewer.test.tsx`: assert 88 lanes, slider behavior, no analysis on slider changes, and saved workspace updates.
- Modify `src/styles.css`: compact control-zone slider styling and 528 px pitch heatmap minimum height.

## Task 1: Add Essentia.js Dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install Essentia.js**

Run:

```powershell
npm install essentia.js
```

Expected: `package.json` gains this dependency entry, with the version resolved by npm:

```json
"dependencies": {
  "animal-island-ui": "^0.9.2",
  "essentia.js": "^0.1.3",
  "react": "^19.1.0",
  "react-dom": "^19.1.0"
}
```

The exact resolved version may be newer; keep the npm-resolved version.

- [ ] **Step 2: Verify dependency metadata**

Run:

```powershell
npm test -- --runInBand
```

Expected: Vitest may reject `--runInBand`; if so, rerun the repo-native command:

```powershell
npm test
```

Expected: Existing tests pass before code changes, or any failure is unrelated to Essentia installation and should be investigated before continuing.

- [ ] **Step 3: Commit dependency update**

```powershell
git add -- package.json package-lock.json
git commit -m "Add Essentia.js dependency"
```

## Task 2: Add Pitch Heatmap Core Types and Helpers

**Files:**
- Modify: `src/core/audio/types.ts`
- Create: `src/core/audio/pitchHeatmap.ts`
- Create: `src/core/audio/pitchHeatmap.test.ts`

- [ ] **Step 1: Write failing tests for note mapping and settings**

Create `src/core/audio/pitchHeatmap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
  MAX_PITCH_MIDI_NUMBER,
  MIN_PITCH_MIDI_NUMBER,
  PITCH_HEATMAP_NOTE_COUNT,
  clampPitchHeatmapDisplaySettings,
  createPitchEnergyFrame,
  getMidiNumberForPitchIndex,
  getPitchIndexForMidiNumber,
  mapPitchEnergyToDisplayValue
} from "./pitchHeatmap";

describe("pitch heatmap helpers", () => {
  it("maps A0-C8 to stable 88-key indexes", () => {
    expect(MIN_PITCH_MIDI_NUMBER).toBe(21);
    expect(MAX_PITCH_MIDI_NUMBER).toBe(108);
    expect(PITCH_HEATMAP_NOTE_COUNT).toBe(88);
    expect(getMidiNumberForPitchIndex(0)).toBe(21);
    expect(getMidiNumberForPitchIndex(48)).toBe(69);
    expect(getMidiNumberForPitchIndex(87)).toBe(108);
    expect(getPitchIndexForMidiNumber(21)).toBe(0);
    expect(getPitchIndexForMidiNumber(69)).toBe(48);
    expect(getPitchIndexForMidiNumber(108)).toBe(87);
  });

  it("creates fixed-width pitch energy frames", () => {
    expect(createPitchEnergyFrame({ startMs: 0, endMs: 42 }).energies).toHaveLength(88);
  });

  it("clamps display settings loaded from project files", () => {
    expect(
      clampPitchHeatmapDisplaySettings({
        gainDb: 99,
        contrast: -1,
        dynamicRangeDb: 999,
        noiseFloorDb: 0,
        colorIntensity: 99
      })
    ).toEqual({
      gainDb: 36,
      contrast: 0.5,
      dynamicRangeDb: 120,
      noiseFloorDb: -40,
      colorIntensity: 2
    });
  });

  it("fills missing display settings with defaults", () => {
    expect(clampPitchHeatmapDisplaySettings({ gainDb: 6 })).toEqual({
      ...DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
      gainDb: 6
    });
  });

  it("maps energy through display controls into 0..1", () => {
    const dim = mapPitchEnergyToDisplayValue(0.01, DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS);
    const bright = mapPitchEnergyToDisplayValue(1, DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS);
    expect(dim).toBeGreaterThanOrEqual(0);
    expect(bright).toBeLessThanOrEqual(1);
    expect(bright).toBeGreaterThan(dim);
  });

  it("uses noise floor as background cutoff", () => {
    expect(
      mapPitchEnergyToDisplayValue(0, {
        ...DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
        noiseFloorDb: -40
      })
    ).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/core/audio/pitchHeatmap.test.ts
```

Expected: FAIL because `src/core/audio/pitchHeatmap.ts` does not exist.

- [ ] **Step 3: Add types to `src/core/audio/types.ts`**

Append:

```ts
export interface PitchEnergyFrame {
  startMs: number;
  endMs: number;
  energies: number[];
}

export interface PitchEnergyOverview {
  durationMs: number;
  framesPerSecond: number;
  minMidiNumber: 21;
  maxMidiNumber: 108;
  notesPerFrame: 88;
  frames: PitchEnergyFrame[];
}

export interface PitchHeatmapDisplaySettings {
  gainDb: number;
  contrast: number;
  dynamicRangeDb: number;
  noiseFloorDb: number;
  colorIntensity: number;
}
```

- [ ] **Step 4: Implement `src/core/audio/pitchHeatmap.ts`**

```ts
import type { PitchEnergyFrame, PitchHeatmapDisplaySettings } from "./types";

export const MIN_PITCH_MIDI_NUMBER = 21;
export const MAX_PITCH_MIDI_NUMBER = 108;
export const PITCH_HEATMAP_NOTE_COUNT = 88;
export const MIN_PITCH_FREQUENCY_HZ = 27.5;
export const PITCH_HEATMAP_MIN_LANE_HEIGHT_PX = 6;
export const PITCH_HEATMAP_MIN_HEIGHT_PX =
  PITCH_HEATMAP_NOTE_COUNT * PITCH_HEATMAP_MIN_LANE_HEIGHT_PX;

export const DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS: PitchHeatmapDisplaySettings = {
  gainDb: 0,
  contrast: 1,
  dynamicRangeDb: 80,
  noiseFloorDb: -90,
  colorIntensity: 1
};

const SETTING_RANGES = {
  gainDb: { min: -24, max: 36 },
  contrast: { min: 0.5, max: 3 },
  dynamicRangeDb: { min: 40, max: 120 },
  noiseFloorDb: { min: -120, max: -40 },
  colorIntensity: { min: 0.5, max: 2 }
} as const;

export function getMidiNumberForPitchIndex(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= PITCH_HEATMAP_NOTE_COUNT) {
    throw new Error("Pitch index is outside A0-C8.");
  }

  return MIN_PITCH_MIDI_NUMBER + index;
}

export function getPitchIndexForMidiNumber(midiNumber: number) {
  if (
    !Number.isInteger(midiNumber) ||
    midiNumber < MIN_PITCH_MIDI_NUMBER ||
    midiNumber > MAX_PITCH_MIDI_NUMBER
  ) {
    throw new Error("MIDI number is outside A0-C8.");
  }

  return midiNumber - MIN_PITCH_MIDI_NUMBER;
}

export function createPitchEnergyFrame({
  startMs,
  endMs,
  energies = new Array(PITCH_HEATMAP_NOTE_COUNT).fill(0)
}: {
  startMs: number;
  endMs: number;
  energies?: number[];
}): PitchEnergyFrame {
  return {
    startMs,
    endMs,
    energies: normalizeEnergyArray(energies)
  };
}

export function clampPitchHeatmapDisplaySettings(
  settings: Partial<PitchHeatmapDisplaySettings> | null | undefined
): PitchHeatmapDisplaySettings {
  const source = settings ?? {};

  return {
    gainDb: clampNumber(source.gainDb, SETTING_RANGES.gainDb, DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.gainDb),
    contrast: clampNumber(source.contrast, SETTING_RANGES.contrast, DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.contrast),
    dynamicRangeDb: clampNumber(
      source.dynamicRangeDb,
      SETTING_RANGES.dynamicRangeDb,
      DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.dynamicRangeDb
    ),
    noiseFloorDb: clampNumber(
      source.noiseFloorDb,
      SETTING_RANGES.noiseFloorDb,
      DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.noiseFloorDb
    ),
    colorIntensity: clampNumber(
      source.colorIntensity,
      SETTING_RANGES.colorIntensity,
      DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.colorIntensity
    )
  };
}

export function mapPitchEnergyToDisplayValue(
  energy: number,
  settings: PitchHeatmapDisplaySettings
) {
  const safeEnergy = Math.max(0, Number.isFinite(energy) ? energy : 0);
  const db = 20 * Math.log10(Math.max(safeEnergy, 1e-12)) + settings.gainDb;

  if (db <= settings.noiseFloorDb) {
    return 0;
  }

  const rangeTopDb = settings.noiseFloorDb + settings.dynamicRangeDb;
  const normalized = (db - settings.noiseFloorDb) / Math.max(1, rangeTopDb - settings.noiseFloorDb);
  const contrasted = normalized ** (1 / settings.contrast);

  return clamp01(contrasted * settings.colorIntensity);
}

function normalizeEnergyArray(energies: number[]) {
  return Array.from({ length: PITCH_HEATMAP_NOTE_COUNT }, (_, index) => {
    const value = energies[index] ?? 0;
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  });
}

function clampNumber(
  value: number | undefined,
  range: { min: number; max: number },
  fallback: number
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(range.max, Math.max(range.min, value));
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```powershell
npm test -- src/core/audio/pitchHeatmap.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit core pitch helpers**

```powershell
git add -- src/core/audio/types.ts src/core/audio/pitchHeatmap.ts src/core/audio/pitchHeatmap.test.ts
git commit -m "Add pitch heatmap core model"
```

## Task 3: Persist Heatmap Display Settings in Project Data

**Files:**
- Modify: `src/core/project/types.ts`
- Create: `src/core/project/analysisView.ts`
- Create: `src/core/project/analysisView.test.ts`
- Modify: `src/core/project/createProjectFromAudio.ts`
- Modify: `src/core/project/createProjectFromAudio.test.ts`
- Modify: `electron/platform/projectFiles/projectFiles.test.ts` if existing project save/open assertions need updates.

- [ ] **Step 1: Write failing tests for analysis view normalization**

Create `src/core/project/analysisView.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS } from "../audio/pitchHeatmap";
import { normalizeProjectAnalysisView } from "./analysisView";

describe("normalizeProjectAnalysisView", () => {
  it("supplies default pitch heatmap settings for old projects", () => {
    expect(normalizeProjectAnalysisView(undefined)).toEqual({
      pitchHeatmapDisplay: DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS
    });
  });

  it("clamps saved pitch heatmap settings", () => {
    expect(
      normalizeProjectAnalysisView({
        pitchHeatmapDisplay: {
          gainDb: 90,
          contrast: 10,
          dynamicRangeDb: 1,
          noiseFloorDb: 0,
          colorIntensity: -1
        }
      })
    ).toEqual({
      pitchHeatmapDisplay: {
        gainDb: 36,
        contrast: 3,
        dynamicRangeDb: 40,
        noiseFloorDb: -40,
        colorIntensity: 0.5
      }
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/core/project/analysisView.test.ts
```

Expected: FAIL because `analysisView.ts` does not exist.

- [ ] **Step 3: Add project types**

Modify `src/core/project/types.ts`:

```ts
import type { PitchHeatmapDisplaySettings } from "../audio/types";
```

Add before `ProjectSummary`:

```ts
export interface ProjectAnalysisView {
  pitchHeatmapDisplay: PitchHeatmapDisplaySettings;
}
```

Add to `ProjectSummary`:

```ts
analysisView: ProjectAnalysisView;
```

- [ ] **Step 4: Implement `src/core/project/analysisView.ts`**

```ts
import {
  DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
  clampPitchHeatmapDisplaySettings
} from "../audio/pitchHeatmap";
import type { ProjectAnalysisView } from "./types";

export function createDefaultProjectAnalysisView(): ProjectAnalysisView {
  return {
    pitchHeatmapDisplay: DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS
  };
}

export function normalizeProjectAnalysisView(
  analysisView: Partial<ProjectAnalysisView> | null | undefined
): ProjectAnalysisView {
  return {
    pitchHeatmapDisplay: clampPitchHeatmapDisplaySettings(
      analysisView?.pitchHeatmapDisplay
    )
  };
}
```

- [ ] **Step 5: Initialize new projects**

Modify `src/core/project/createProjectFromAudio.ts` to import and use the default:

```ts
import { createDefaultProjectAnalysisView } from "./analysisView";
```

In the returned project object, add:

```ts
analysisView: createDefaultProjectAnalysisView(),
```

- [ ] **Step 6: Update create-project test**

Modify `src/core/project/createProjectFromAudio.test.ts` to assert:

```ts
expect(project.analysisView.pitchHeatmapDisplay).toEqual(
  DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS
);
```

Import:

```ts
import { DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS } from "../audio/pitchHeatmap";
```

- [ ] **Step 7: Run project tests**

Run:

```powershell
npm test -- src/core/project/analysisView.test.ts src/core/project/createProjectFromAudio.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit project persistence model**

```powershell
git add -- src/core/project/types.ts src/core/project/analysisView.ts src/core/project/analysisView.test.ts src/core/project/createProjectFromAudio.ts src/core/project/createProjectFromAudio.test.ts
git commit -m "Persist pitch heatmap display settings"
```

## Task 4: Add Pitch Energy Service With Essentia Adapter

**Files:**
- Create: `src/services/audio/browserPitchEnergyService.ts`
- Create: `src/services/audio/browserPitchEnergyService.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `src/services/audio/browserPitchEnergyService.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserPitchEnergyService,
  type PitchEnergyEngine
} from "./browserPitchEnergyService";

class FakeAudioBuffer {
  readonly duration = 1;
  readonly numberOfChannels = 1;
  readonly sampleRate = 44_100;

  getChannelData() {
    return new Float32Array(44_100).fill(0.5);
  }
}

describe("createBrowserPitchEnergyService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "AudioContext");
  });

  it("decodes audio data and builds 88-key pitch frames", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const decodeAudioData = vi.fn().mockResolvedValue(new FakeAudioBuffer());
    const analyzeFrame = vi.fn<PitchEnergyEngine["analyzeFrame"]>(() =>
      Array.from({ length: 88 }, (_, index) => index)
    );

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { close, decodeAudioData };
      })
    });

    const service = createBrowserPitchEnergyService({
      loadEngine: async () => ({ analyzeFrame })
    });
    const overview = await service.buildOverviewFromAudioData(new ArrayBuffer(8), {
      framesPerSecond: 4
    });

    expect(decodeAudioData).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(overview.minMidiNumber).toBe(21);
    expect(overview.maxMidiNumber).toBe(108);
    expect(overview.notesPerFrame).toBe(88);
    expect(overview.frames).toHaveLength(4);
    expect(overview.frames[0].energies).toHaveLength(88);
    expect(analyzeFrame).toHaveBeenCalledWith(expect.any(Float32Array), 44_100);
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

    const service = createBrowserPitchEnergyService({
      loadEngine: async () => ({
        analyzeFrame: () => new Array(88).fill(0)
      })
    });

    await expect(service.buildOverviewFromAudioData(new ArrayBuffer(8))).rejects.toThrow(
      "Failed to generate pitch heatmap."
    );
  });

  it("throws a stable error when the engine cannot load", async () => {
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return {
          close: vi.fn().mockResolvedValue(undefined),
          decodeAudioData: vi.fn().mockResolvedValue(new FakeAudioBuffer())
        };
      })
    });

    const service = createBrowserPitchEnergyService({
      loadEngine: async () => {
        throw new Error("wasm missing");
      }
    });

    await expect(service.buildOverviewFromAudioData(new ArrayBuffer(8))).rejects.toThrow(
      "Failed to load pitch analysis engine."
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/services/audio/browserPitchEnergyService.test.ts
```

Expected: FAIL because the service file does not exist.

- [ ] **Step 3: Implement service with injectable engine**

Create `src/services/audio/browserPitchEnergyService.ts`:

```ts
import type { PitchEnergyOverview } from "../../core/audio/types";
import {
  MIN_PITCH_FREQUENCY_HZ,
  MIN_PITCH_MIDI_NUMBER,
  MAX_PITCH_MIDI_NUMBER,
  PITCH_HEATMAP_NOTE_COUNT,
  createPitchEnergyFrame
} from "../../core/audio/pitchHeatmap";

export interface PitchEnergyBuildOptions {
  framesPerSecond?: number;
}

export interface PitchEnergyEngine {
  analyzeFrame(frame: Float32Array, sampleRate: number): number[];
}

export interface PitchEnergyService {
  buildOverviewFromAudioData(
    audioData: ArrayBuffer,
    options?: PitchEnergyBuildOptions
  ): Promise<PitchEnergyOverview>;
}

interface BrowserPitchEnergyServiceDependencies {
  loadEngine?: () => Promise<PitchEnergyEngine>;
}

const DEFAULT_FRAMES_PER_SECOND = 24;

export function createBrowserPitchEnergyService({
  loadEngine = loadEssentiaPitchEnergyEngine
}: BrowserPitchEnergyServiceDependencies = {}): PitchEnergyService {
  return {
    async buildOverviewFromAudioData(audioData, options = {}) {
      const framesPerSecond = options.framesPerSecond ?? DEFAULT_FRAMES_PER_SECOND;
      const audioContext = new AudioContext();
      let decodedAudio: AudioBuffer;

      try {
        decodedAudio = await audioContext.decodeAudioData(audioData);
      } catch {
        await closeAudioContext(audioContext);
        throw new Error("Failed to generate pitch heatmap.");
      }

      await closeAudioContext(audioContext);

      let engine: PitchEnergyEngine;
      try {
        engine = await loadEngine();
      } catch {
        throw new Error("Failed to load pitch analysis engine.");
      }

      try {
        return createPitchEnergyOverviewFromBuffer(decodedAudio, engine, {
          framesPerSecond
        });
      } catch {
        throw new Error("Failed to generate pitch heatmap.");
      }
    }
  };
}

export function createPitchEnergyOverviewFromBuffer(
  buffer: AudioBuffer,
  engine: PitchEnergyEngine,
  options: Required<PitchEnergyBuildOptions>
): PitchEnergyOverview {
  const durationMs = Math.round(buffer.duration * 1000);
  const sampleCount = Math.max(0, Math.floor(buffer.duration * buffer.sampleRate));
  const monoSamples = mixToMono(buffer, sampleCount);
  const frameCount = Math.ceil(buffer.duration * options.framesPerSecond);
  const samplesPerFrame = buffer.sampleRate / options.framesPerSecond;

  return {
    durationMs,
    framesPerSecond: options.framesPerSecond,
    minMidiNumber: MIN_PITCH_MIDI_NUMBER,
    maxMidiNumber: MAX_PITCH_MIDI_NUMBER,
    notesPerFrame: PITCH_HEATMAP_NOTE_COUNT,
    frames: Array.from({ length: frameCount }, (_, index) => {
      const startSample = Math.floor(index * samplesPerFrame);
      const endSample = Math.min(sampleCount, Math.floor((index + 1) * samplesPerFrame));
      const frame = monoSamples.slice(startSample, Math.max(startSample + 1, endSample));

      return createPitchEnergyFrame({
        startMs: Math.round((index / options.framesPerSecond) * 1000),
        endMs: Math.min(durationMs, Math.round(((index + 1) / options.framesPerSecond) * 1000)),
        energies: engine.analyzeFrame(frame, buffer.sampleRate)
      });
    })
  };
}

async function loadEssentiaPitchEnergyEngine(): Promise<PitchEnergyEngine> {
  const [{ default: Essentia }, wasmModule] = await Promise.all([
    import("essentia.js/dist/essentia.js-core.es.js"),
    import("essentia.js/dist/essentia-wasm.es.js")
  ]);
  const essentia = new Essentia(wasmModule.default ?? wasmModule);

  return {
    analyzeFrame(frame, sampleRate) {
      const vector = essentia.arrayToVector(frame);
      const result = essentia.SpectrumCQ(
        vector,
        12,
        MIN_PITCH_FREQUENCY_HZ,
        4,
        PITCH_HEATMAP_NOTE_COUNT,
        sampleRate,
        1,
        0.01,
        "hann",
        true
      );
      return Array.from(result.spectrumCQ as number[]);
    }
  };
}

function mixToMono(buffer: AudioBuffer, sampleCount: number) {
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

async function closeAudioContext(audioContext: AudioContext) {
  try {
    await audioContext.close?.();
  } catch {
    // Ignore cleanup failures so they do not mask the primary result or error.
  }
}
```

If TypeScript cannot resolve Essentia build declarations, add `src/types/essentia-js.d.ts` in this same task:

```ts
declare module "essentia.js/dist/essentia.js-core.es.js";
declare module "essentia.js/dist/essentia-wasm.es.js";
```

- [ ] **Step 4: Run service test**

Run:

```powershell
npm test -- src/services/audio/browserPitchEnergyService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run build to catch Essentia import typing**

Run:

```powershell
npm run build
```

Expected: PASS. If Vite cannot bundle the exact Essentia import paths, inspect `node_modules/essentia.js/dist` and adjust only the import strings in `loadEssentiaPitchEnergyEngine`; keep the public `PitchEnergyService` interface unchanged.

- [ ] **Step 6: Commit pitch energy service**

```powershell
git add -- src/services/audio/browserPitchEnergyService.ts src/services/audio/browserPitchEnergyService.test.ts src/types/essentia-js.d.ts
git commit -m "Add browser pitch energy service"
```

## Task 5: Thread Pitch Overview Through Session and Project Commands

**Files:**
- Modify: `src/app/session/types.ts`
- Modify: `src/app/session/AppSessionProvider.tsx`
- Modify: `src/app/commands/projectCommandTypes.ts`
- Modify: `src/app/commands/importAudioCommand.ts`
- Modify: `src/app/commands/openProjectCommand.ts`
- Modify: `src/app/commands/projectCommands.ts`
- Modify command/session tests that construct these dependencies.

- [ ] **Step 1: Write or update command tests first**

In existing command tests for import/open project, add assertions equivalent to:

```ts
expect(pitchEnergyService.buildOverviewFromAudioData).toHaveBeenCalledWith(expect.any(ArrayBuffer));
expect(setPitchEnergyOverview).toHaveBeenCalledWith({
  durationMs: 1_000,
  framesPerSecond: 24,
  minMidiNumber: 21,
  maxMidiNumber: 108,
  notesPerFrame: 88,
  frames: []
});
```

Also add failure assertions:

```ts
pitchEnergyService.buildOverviewFromAudioData.mockRejectedValue(
  new Error("Failed to generate pitch heatmap.")
);
await importAudio();
expect(setProject).not.toHaveBeenCalled();
expect(setImportError).toHaveBeenCalledWith("Failed to generate pitch heatmap.");
```

- [ ] **Step 2: Run relevant command tests to verify failure**

Run:

```powershell
npm test -- src/app/commands
```

Expected: FAIL because pitch service dependencies do not exist.

- [ ] **Step 3: Add pitch state/service types**

Modify `src/app/session/types.ts` imports:

```ts
import type { PitchEnergyOverview, SpectrogramOverview, WaveformOverview } from "../../core/audio/types";
import type { PitchEnergyService } from "../../services/audio/browserPitchEnergyService";
```

Add to `AppSessionState`:

```ts
pitchEnergyOverview: PitchEnergyOverview | null;
```

Add to `AppSessionServices`:

```ts
pitchEnergyService: PitchEnergyService;
```

Modify `src/app/commands/projectCommandTypes.ts` similarly:

```ts
import type { PitchEnergyOverview, SpectrogramOverview, WaveformOverview } from "../../core/audio/types";
import type { PitchEnergyService } from "../../services/audio/browserPitchEnergyService";
```

Add:

```ts
pitchEnergyService: PitchEnergyService;
setPitchEnergyOverview: Dispatch<SetStateAction<PitchEnergyOverview | null>>;
```

- [ ] **Step 4: Create provider state and service**

Modify `src/app/session/AppSessionProvider.tsx` imports:

```ts
import {
  createBrowserPitchEnergyService,
  type PitchEnergyService
} from "../../services/audio/browserPitchEnergyService";
import type { PitchEnergyOverview, SpectrogramOverview, WaveformOverview } from "../../core/audio/types";
```

Add prop:

```ts
pitchEnergyService?: PitchEnergyService;
```

Add state:

```ts
const [pitchEnergyOverview, setPitchEnergyOverview] = useState<PitchEnergyOverview | null>(null);
```

Add memo:

```ts
const activePitchEnergyService = useMemo(
  () => pitchEnergyService ?? createBrowserPitchEnergyService(),
  [pitchEnergyService]
);
```

Pass to `createProjectCommands`:

```ts
pitchEnergyService: activePitchEnergyService,
setPitchEnergyOverview,
```

Return in context value:

```ts
pitchEnergyOverview,
pitchEnergyService: activePitchEnergyService,
```

Add dependencies to the `useMemo` dependency array:

```ts
pitchEnergyOverview,
activePitchEnergyService,
```

- [ ] **Step 5: Generate pitch overview during import**

Modify `src/app/commands/importAudioCommand.ts` destructuring:

```ts
pitchEnergyService,
setPitchEnergyOverview,
```

After creating `spectrogramAudioData`, add a pitch-safe copy:

```ts
const pitchAudioData = selectedFile.audioData.slice(0);
```

After spectrogram generation:

```ts
const nextPitchEnergyOverview =
  await pitchEnergyService.buildOverviewFromAudioData(pitchAudioData);
```

After `setSpectrogramOverview(nextSpectrogramOverview);` add:

```ts
setPitchEnergyOverview(nextPitchEnergyOverview);
```

- [ ] **Step 6: Generate pitch overview during open**

Modify `src/app/commands/openProjectCommand.ts` destructuring:

```ts
pitchEnergyService,
setPitchEnergyOverview,
```

After `spectrogramAudioData`:

```ts
const pitchAudioData = openedProject.audioData.slice(0);
```

After spectrogram generation:

```ts
const nextPitchEnergyOverview =
  await pitchEnergyService.buildOverviewFromAudioData(pitchAudioData);
```

Before `setProjectLocation`, add:

```ts
setPitchEnergyOverview(nextPitchEnergyOverview);
```

- [ ] **Step 7: Run command/session tests**

Run:

```powershell
npm test -- src/app/commands src/app/session
```

Expected: PASS after updating test dependency factories to include `pitchEnergyService` and `setPitchEnergyOverview`.

- [ ] **Step 8: Commit session threading**

```powershell
git add -- src/app/session src/app/commands
git commit -m "Thread pitch heatmap analysis through project commands"
```

## Task 6: Replace Main Spectrogram Rendering With Pitch Heatmap

**Files:**
- Modify: `src/workspaces/transcription/TranscriptionWorkspace.tsx`
- Modify: `src/features/spectrogramViewer/SpectrogramViewer.tsx`
- Modify: `src/features/spectrogramViewer/SpectrogramView.tsx`
- Modify: `src/features/spectrogramViewer/spectrogramViewport.ts`
- Modify: `src/features/spectrogramViewer/SpectrogramView.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Update view tests for pitch lanes**

Modify `src/features/spectrogramViewer/SpectrogramView.test.tsx` helper type/imports:

```ts
import type { PitchEnergyOverview, WaveformOverview } from "../../core/audio/types";
```

Replace `createSpectrogramOverview` with:

```ts
function createPitchEnergyOverview(): PitchEnergyOverview {
  return {
    durationMs: 12_000,
    framesPerSecond: 1,
    minMidiNumber: 21,
    maxMidiNumber: 108,
    notesPerFrame: 88,
    frames: [
      { startMs: 0, endMs: 1_000, energies: Array.from({ length: 88 }, (_, index) => (index === 48 ? 1 : 0)) },
      { startMs: 9_000, endMs: 10_000, energies: Array.from({ length: 88 }, (_, index) => (index === 49 ? 1 : 0)) },
      { startMs: 10_000, endMs: 11_000, energies: Array.from({ length: 88 }, () => 0.25) }
    ]
  };
}
```

Update assertions:

```ts
expect(screen.getByRole("img", { name: "Pitch heatmap" })).toBeTruthy();
expect(screen.getByLabelText("Piano pitch axis")).toBeTruthy();
expect(screen.getAllByTestId("piano-key")).toHaveLength(88);
expect(drawCalls.filter((call) => call.height === 6).length).toBeGreaterThan(0);
```

Add a test:

```ts
it("draws A4 and A#4 as adjacent independent lanes", () => {
  renderSpectrogramView(
    <SpectrogramView
      currentTimeMs={0}
      durationMs={12_000}
      pitchEnergyOverview={createPitchEnergyOverview()}
      pitchHeatmapDisplay={DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS}
      waveformOverview={createWaveformOverview()}
      onSeek={vi.fn()}
      onViewportChange={vi.fn()}
      viewport={undefined}
    />
  );

  const laneCalls = drawCalls.filter((call) => call.height === 6);
  const a4Call = laneCalls.find((call) => call.y === (87 - 48) * 6);
  const aSharp4Call = laneCalls.find((call) => call.y === (87 - 49) * 6);

  expect(a4Call).toBeTruthy();
  expect(aSharp4Call).toBeTruthy();
  expect(a4Call?.y).not.toBe(aSharp4Call?.y);
});
```

- [ ] **Step 2: Run view test to verify failure**

Run:

```powershell
npm test -- src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: FAIL because props and renderer still use `spectrogramOverview`.

- [ ] **Step 3: Update workspace prop flow**

Modify `src/workspaces/transcription/TranscriptionWorkspace.tsx` imports and props:

```ts
import type { PitchEnergyOverview, WaveformOverview } from "../../core/audio/types";
```

Replace `spectrogramOverview` prop with:

```ts
pitchEnergyOverview?: PitchEnergyOverview | null;
```

Pass to viewer:

```tsx
pitchEnergyOverview={pitchEnergyOverview}
```

Modify parent callers in `src/App.tsx` to pass `pitchEnergyOverview` from session.

- [ ] **Step 4: Update `SpectrogramViewer` props**

Modify imports:

```ts
import type { PitchEnergyOverview, PlaybackState, WaveformOverview } from "../../core/audio/types";
```

Replace prop:

```ts
pitchEnergyOverview?: PitchEnergyOverview | null;
```

Change heading:

```tsx
<h2>Pitch Heatmap</h2>
```

Pass to view:

```tsx
<SpectrogramView
  currentTimeMs={playbackState.currentTimeMs}
  durationMs={durationMs}
  onSeek={handleSeek}
  onViewportChange={(spectrogramViewport) => onWorkspaceChange({ spectrogramViewport })}
  pitchEnergyOverview={pitchEnergyOverview}
  pitchHeatmapDisplay={project.analysisView.pitchHeatmapDisplay}
  viewport={project.workspace.spectrogramViewport}
  waveformOverview={waveformOverview}
/>
```

- [ ] **Step 5: Rewrite `SpectrogramView` pitch props and drawing**

Modify `src/features/spectrogramViewer/SpectrogramView.tsx` props to:

```ts
interface SpectrogramViewProps {
  currentTimeMs: number;
  durationMs: number;
  pitchEnergyOverview: PitchEnergyOverview | null | undefined;
  pitchHeatmapDisplay: PitchHeatmapDisplaySettings;
  viewport?: SpectrogramViewport;
  waveformOverview: WaveformOverview | null | undefined;
  onSeek: (timeMs: number) => Promise<void> | void;
  onViewportChange: (viewport: SpectrogramViewport) => void;
}
```

Set canvas height:

```ts
const CANVAS_HEIGHT = PITCH_HEATMAP_MIN_HEIGHT_PX;
```

In drawing effect, use:

```ts
const laneHeight = PITCH_HEATMAP_MIN_LANE_HEIGHT_PX;

for (let columnIndex = 0; columnIndex < renderedColumnCount; columnIndex += 1) {
  const startFrameIndex = Math.floor((columnIndex * visibleFrames.length) / renderedColumnCount);
  const endFrameIndex = Math.max(
    startFrameIndex + 1,
    Math.floor(((columnIndex + 1) * visibleFrames.length) / renderedColumnCount)
  );

  for (let pitchIndex = 0; pitchIndex < PITCH_HEATMAP_NOTE_COUNT; pitchIndex += 1) {
    const energy = getMaxEnergyForColumn(visibleFrames, startFrameIndex, endFrameIndex, pitchIndex);
    const displayValue = mapPitchEnergyToDisplayValue(energy, pitchHeatmapDisplay);
    context.fillStyle = magnitudeToSpectrogramColor(displayValue);
    context.fillRect(
      columnIndex * frameWidth,
      canvas.height - (pitchIndex + 1) * laneHeight,
      Math.ceil(frameWidth),
      laneHeight
    );
  }
}
```

Add helper:

```ts
function getMaxEnergyForColumn(
  frames: PitchEnergyOverview["frames"],
  startFrameIndex: number,
  endFrameIndex: number,
  pitchIndex: number
) {
  let maxEnergy = 0;

  for (let frameIndex = startFrameIndex; frameIndex < endFrameIndex; frameIndex += 1) {
    maxEnergy = Math.max(maxEnergy, frames[frameIndex]?.energies[pitchIndex] ?? 0);
  }

  return maxEnergy;
}
```

Keep `magnitudeToSpectrogramColor` temporarily for color ramp reuse.

- [ ] **Step 6: Update viewport filtering helper**

Modify `src/features/spectrogramViewer/spectrogramViewport.ts` to accept `PitchEnergyOverview`:

```ts
import type { PitchEnergyOverview, WaveformOverview } from "../../core/audio/types";

export function filterPitchEnergyFramesForViewport(
  overview: PitchEnergyOverview | null | undefined,
  viewport: SpectrogramViewport
) {
  if (!overview) {
    return [];
  }

  const viewportEndMs = viewport.startMs + viewport.durationMs;
  return overview.frames.filter(
    (frame) => frame.endMs >= viewport.startMs && frame.startMs <= viewportEndMs
  );
}
```

- [ ] **Step 7: Update styles**

Modify `src/styles.css`:

```css
.spectrogram-canvas-frame {
  min-height: var(--spectrogram-display-height);
  overflow-y: auto;
}

.spectrogram-canvas {
  min-height: var(--spectrogram-display-height);
}
```

Keep existing class names if that avoids broad CSS churn.

- [ ] **Step 8: Run view tests**

Run:

```powershell
npm test -- src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit pitch heatmap renderer**

```powershell
git add -- src/App.tsx src/workspaces/transcription/TranscriptionWorkspace.tsx src/features/spectrogramViewer src/styles.css
git commit -m "Replace spectrogram view with pitch heatmap"
```

## Task 7: Add Heatmap Display Sliders in the Control Area

**Files:**
- Modify: `src/features/spectrogramViewer/WorkspaceControlZone.tsx`
- Modify: `src/features/spectrogramViewer/SpectrogramViewer.tsx`
- Modify: `src/features/spectrogramViewer/SpectrogramViewer.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing control-zone tests**

In `src/features/spectrogramViewer/SpectrogramViewer.test.tsx`, add:

```ts
it("updates project heatmap display settings from control sliders", () => {
  const onWorkspaceChange = vi.fn();
  renderSpectrogramViewer({ onWorkspaceChange });

  fireEvent.change(screen.getByLabelText("Gain"), { target: { value: "6" } });

  expect(onWorkspaceChange).toHaveBeenCalledWith({
    analysisView: {
      pitchHeatmapDisplay: {
        ...DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
        gainDb: 6
      }
    }
  });
});
```

This test should use a new `onProjectAnalysisViewChange` prop instead of overloading `onWorkspaceChange`, because workspace patches only accept `WorkspaceState` fields.

- [ ] **Step 2: Run viewer test to verify failure**

Run:

```powershell
npm test -- src/features/spectrogramViewer/SpectrogramViewer.test.tsx
```

Expected: FAIL because sliders do not exist.

- [ ] **Step 3: Add control props**

Modify `WorkspaceControlZoneProps`:

```ts
import type { PitchHeatmapDisplaySettings } from "../../core/audio/types";

pitchHeatmapDisplay: PitchHeatmapDisplaySettings;
onPitchHeatmapDisplayChange: (settings: PitchHeatmapDisplaySettings) => void;
```

Render:

```tsx
<div className="workspace-control-group heatmap-display-controls" aria-label="Heatmap Display">
  <div className="workspace-control-label">Heatmap Display</div>
  <label>
    Gain
    <input
      aria-label="Gain"
      max={36}
      min={-24}
      onChange={(event) =>
        onPitchHeatmapDisplayChange({
          ...pitchHeatmapDisplay,
          gainDb: Number(event.currentTarget.value)
        })
      }
      step={1}
      type="range"
      value={pitchHeatmapDisplay.gainDb}
    />
  </label>
  <label>
    Contrast
    <input
      aria-label="Contrast"
      max={3}
      min={0.5}
      onChange={(event) =>
        onPitchHeatmapDisplayChange({
          ...pitchHeatmapDisplay,
          contrast: Number(event.currentTarget.value)
        })
      }
      step={0.1}
      type="range"
      value={pitchHeatmapDisplay.contrast}
    />
  </label>
  <label>
    Range
    <input
      aria-label="Range"
      max={120}
      min={40}
      onChange={(event) =>
        onPitchHeatmapDisplayChange({
          ...pitchHeatmapDisplay,
          dynamicRangeDb: Number(event.currentTarget.value)
        })
      }
      step={1}
      type="range"
      value={pitchHeatmapDisplay.dynamicRangeDb}
    />
  </label>
  <label>
    Floor
    <input
      aria-label="Floor"
      max={-40}
      min={-120}
      onChange={(event) =>
        onPitchHeatmapDisplayChange({
          ...pitchHeatmapDisplay,
          noiseFloorDb: Number(event.currentTarget.value)
        })
      }
      step={1}
      type="range"
      value={pitchHeatmapDisplay.noiseFloorDb}
    />
  </label>
  <label>
    Intensity
    <input
      aria-label="Intensity"
      max={2}
      min={0.5}
      onChange={(event) =>
        onPitchHeatmapDisplayChange({
          ...pitchHeatmapDisplay,
          colorIntensity: Number(event.currentTarget.value)
        })
      }
      step={0.1}
      type="range"
      value={pitchHeatmapDisplay.colorIntensity}
    />
  </label>
  <button
    onClick={() => onPitchHeatmapDisplayChange(DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS)}
  >
    Reset
  </button>
</div>
```

Import `DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS`.

- [ ] **Step 4: Add project analysis view update action**

Add to `AppSessionActions`:

```ts
updateProjectAnalysisView: (analysisViewPatch: Partial<ProjectAnalysisView>) => void;
```

Implement in `projectCommands` or a new command:

```ts
setProject((currentProject) => {
  if (!currentProject) {
    return currentProject;
  }

  return {
    ...currentProject,
    analysisView: normalizeProjectAnalysisView({
      ...currentProject.analysisView,
      ...analysisViewPatch
    })
  };
});
```

Pass it to `TranscriptionWorkspace` and `SpectrogramViewer` as `onProjectAnalysisViewChange`.

- [ ] **Step 5: Wire sliders to viewer**

In `SpectrogramViewer`, implement:

```ts
function handlePitchHeatmapDisplayChange(nextSettings: PitchHeatmapDisplaySettings) {
  onProjectAnalysisViewChange({
    pitchHeatmapDisplay: clampPitchHeatmapDisplaySettings(nextSettings)
  });
}
```

Pass to `WorkspaceControlZone`:

```tsx
pitchHeatmapDisplay={project.analysisView.pitchHeatmapDisplay}
onPitchHeatmapDisplayChange={handlePitchHeatmapDisplayChange}
```

- [ ] **Step 6: Style compact sliders**

Add CSS:

```css
.heatmap-display-controls {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  gap: 8px 12px;
}

.heatmap-display-controls label {
  display: grid;
  gap: 4px;
  font-size: 12px;
}

.heatmap-display-controls input[type="range"] {
  width: 100%;
}
```

- [ ] **Step 7: Run viewer tests**

Run:

```powershell
npm test -- src/features/spectrogramViewer/SpectrogramViewer.test.tsx src/features/spectrogramViewer/WorkspaceControlZone.test.tsx
```

Expected: PASS. If `WorkspaceControlZone.test.tsx` does not exist, run the viewer test only.

- [ ] **Step 8: Commit heatmap display controls**

```powershell
git add -- src/app src/workspaces/transcription src/features/spectrogramViewer src/styles.css
git commit -m "Add pitch heatmap display controls"
```

## Task 8: Save and Open Project Analysis View

**Files:**
- Modify: `src/app/commands/openProjectCommand.ts`
- Modify: `src/app/commands/saveProjectCommand.ts`
- Modify: `electron/platform/projectFiles/projectFiles.ts`
- Modify: `electron/platform/projectFiles/projectFiles.test.ts`
- Modify project command tests.

- [ ] **Step 1: Write failing save/open tests**

In `electron/platform/projectFiles/projectFiles.test.ts`, add to the sample project:

```ts
analysisView: {
  pitchHeatmapDisplay: {
    gainDb: 6,
    contrast: 1.5,
    dynamicRangeDb: 70,
    noiseFloorDb: -80,
    colorIntensity: 1.2
  }
}
```

Assert saved and opened project preserves it:

```ts
expect(openedProject.project.analysisView.pitchHeatmapDisplay.gainDb).toBe(6);
```

Add old-project fixture assertion:

```ts
expect(openedProject.project.analysisView.pitchHeatmapDisplay).toEqual(
  DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS
);
```

- [ ] **Step 2: Run project file tests to verify failure**

Run:

```powershell
npm test -- electron/platform/projectFiles/projectFiles.test.ts
```

Expected: FAIL if opened projects are not normalized.

- [ ] **Step 3: Normalize opened project payload**

In the project open path, after parsing the project JSON and before returning it to renderer, normalize:

```ts
project: {
  ...project,
  analysisView: normalizeProjectAnalysisView(project.analysisView)
}
```

Import `normalizeProjectAnalysisView` from `src/core/project/analysisView.ts`; this file is in `src/core`, matching the existing shared project-type boundary.

- [ ] **Step 4: Normalize renderer open command as defense-in-depth**

In `src/app/commands/openProjectCommand.ts`, when building `normalizedProject`, add:

```ts
analysisView: normalizeProjectAnalysisView(openedProject.project.analysisView),
```

Import:

```ts
import { normalizeProjectAnalysisView } from "../../core/project/analysisView";
```

- [ ] **Step 5: Run persistence tests**

Run:

```powershell
npm test -- electron/platform/projectFiles/projectFiles.test.ts src/app/commands
```

Expected: PASS.

- [ ] **Step 6: Commit persistence handling**

```powershell
git add -- electron/platform/projectFiles src/app/commands src/core/project
git commit -m "Restore pitch heatmap display settings from projects"
```

## Task 9: Final Verification and Electron Smoke

**Files:**
- No planned code changes unless verification reveals a bug.

- [ ] **Step 1: Run full unit suite**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 3: Start Vite dev server**

Run:

```powershell
$proc = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev','--','--host','127.0.0.1' -WorkingDirectory 'D:\WORKSPACE\ZiQi' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 6
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173' -TimeoutSec 5
```

Expected: status code `200`.

- [ ] **Step 4: Run Electron smoke after build**

Run:

```powershell
$electron = 'D:\WORKSPACE\ZiQi\node_modules\.bin\electron.cmd'
$args = @('--remote-debugging-port=9222', 'dist-electron\main.js')
$proc = Start-Process -FilePath $electron -ArgumentList $args -WorkingDirectory 'D:\WORKSPACE\ZiQi' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 5
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:9222/json' -TimeoutSec 5
```

Expected: JSON page list from Electron remote debugging.

- [ ] **Step 5: Manual smoke checklist**

In Electron:

1. Import a real audio file.
2. Confirm the primary view title says `Pitch Heatmap`.
3. Confirm the heatmap canvas appears with piano-axis lanes.
4. Confirm `Gain`, `Contrast`, `Range`, `Floor`, and `Intensity` sliders appear in the control area.
5. Move each slider and confirm the heatmap redraws without loading or analysis progress restarting.
6. Save the project.
7. Open the saved project.
8. Confirm slider values are restored.
9. Confirm playback, seek, rate, loop, and viewport controls still work.

- [ ] **Step 6: Commit any verification fixes**

Only if verification required a fix:

```powershell
git add -- <fixed-files>
git commit -m "Fix pitch heatmap verification issues"
```

## Self-Review

Spec coverage:

- 88-key A0-C8 pitch model: Task 2 and Task 6.
- Essentia.js `SpectrumCQ`: Task 1 and Task 4.
- Pitch-specific data model: Task 2.
- Display sliders in existing control area: Task 7.
- `.ziqi` persistence and old-project defaults: Task 3 and Task 8.
- Slider redraw without analysis: Task 6 and Task 7 tests.
- Import/open failure preserving current project state: Task 5 command tests.
- Electron runtime smoke including `window.ziqiApp` and Essentia loading: Task 9.

Placeholder scan:

- No placeholder markers or unspecified implementation steps remain.
- The only conditional branch is the Essentia declaration file and import-path adjustment, both with exact files and unchanged public interface.

Type consistency:

- `PitchEnergyOverview`, `PitchEnergyFrame`, and `PitchHeatmapDisplaySettings` are introduced in Task 2 and reused consistently.
- Project persistence uses `analysisView.pitchHeatmapDisplay` consistently.
- Service dependency name is `pitchEnergyService`, and state name is `pitchEnergyOverview` throughout the plan.
