# Local Audio Waveform Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the minimum local audio loop: import a local audio file, create a project, generate a real mono waveform overview from decoded PCM data, render it in the workbench, and keep play/pause/seek synchronized with real playback.

**Architecture:** Keep waveform analysis separate from UI rendering. Renderer-side Web Audio decodes the selected audio file and produces stable time-based waveform data at `50 points/sec`; React only consumes that data and draws it. Electron remains responsible only for file selection.

**Tech Stack:** Electron, React 19, TypeScript, Vite, Vitest, Testing Library, Web Audio API, `HTMLAudioElement`.

---

## File Structure

- Create `src/domain/audio/audioFileUrl.ts`
  - Converts Windows/local/URL audio paths into browser-readable audio URLs.
  - Replaces the private URL helper currently inside `browserProjectAudioFacade.ts`.

- Create `src/domain/audio/audioFileUrl.test.ts`
  - Covers Windows paths, already-formed URLs, and relative/local paths.

- Create `src/domain/audio/waveform.ts`
  - Defines `WaveformOverview`, `WaveformPoint`, and pure waveform generation from decoded PCM-like audio buffers.
  - Has no React, DOM, Electron, or UI-width dependency.

- Create `src/domain/audio/waveform.test.ts`
  - Tests point rate, mono mixing, peak normalization, and empty buffers.

- Create `src/domain/audio/browserWaveformService.ts`
  - Fetches an audio URL, decodes it with `AudioContext.decodeAudioData`, and delegates point generation to `waveform.ts`.

- Create `src/domain/audio/browserWaveformService.test.ts`
  - Tests fetch/decode delegation and failure behavior with mocked browser APIs.

- Modify `src/domain/audio/types.ts`
  - Export waveform types if consumers should import them from the existing audio type surface.

- Modify `src/domain/audio/browserProjectAudioFacade.ts`
  - Use `toAudioUrl` from `audioFileUrl.ts`.
  - Keep playback source loading behavior focused on `HTMLAudioElement`.

- Modify `src/App.tsx`
  - Generate waveform data during import.
  - Store waveform state next to current project state.
  - Pass waveform data into `WorkbenchShell`.

- Create `src/App.test.tsx`
  - Covers import success, cancel, and decode failure from the user workflow level.

- Modify `src/components/WorkbenchShell.tsx`
  - Accept optional `waveformOverview`.
  - Replace mock spectrum display with real waveform display when waveform data exists.
  - Keep existing controls wired to the injected audio facade.

- Modify `src/components/WorkbenchShell.test.tsx`
  - Assert waveform rendering and cursor/seek behavior.

- Modify `src/styles.css`
  - Add waveform layout styles.
  - Keep changes scoped to replacing the current spectrum placeholder surface.

---

## Task 1: Extract Audio File URL Conversion

**Files:**
- Create: `src/domain/audio/audioFileUrl.ts`
- Create: `src/domain/audio/audioFileUrl.test.ts`
- Modify: `src/domain/audio/browserProjectAudioFacade.ts`

- [ ] **Step 1: Write the failing URL helper test**

Create `src/domain/audio/audioFileUrl.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toAudioUrl } from "./audioFileUrl";

describe("toAudioUrl", () => {
  it("converts Windows file paths into encoded file URLs", () => {
    expect(toAudioUrl("D:\\Music Library\\demo track.wav")).toBe(
      "file:///D:/Music%20Library/demo%20track.wav"
    );
  });

  it("keeps existing URL strings unchanged", () => {
    expect(toAudioUrl("https://example.com/audio/demo.mp3")).toBe(
      "https://example.com/audio/demo.mp3"
    );
  });

  it("converts non-URL local paths into encoded file URLs", () => {
    expect(toAudioUrl("fixtures/demo track.wav")).toBe("file:///fixtures/demo%20track.wav");
  });
});
```

- [ ] **Step 2: Run the new failing test**

Run:

```powershell
npm test -- src/domain/audio/audioFileUrl.test.ts
```

Expected: FAIL because `src/domain/audio/audioFileUrl.ts` does not exist.

- [ ] **Step 3: Add the URL helper**

Create `src/domain/audio/audioFileUrl.ts`:

```ts
export function toAudioUrl(filePath: string) {
  if (/^[a-z]:[\\/]/i.test(filePath)) {
    const normalizedPath = filePath.replace(/\\/g, "/");
    return `file:///${encodeURI(normalizedPath)}`;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(filePath)) {
    return filePath;
  }

  const normalizedPath = filePath.replace(/\\/g, "/");
  return `file:///${encodeURI(normalizedPath)}`;
}
```

- [ ] **Step 4: Run the URL helper test**

Run:

```powershell
npm test -- src/domain/audio/audioFileUrl.test.ts
```

Expected: PASS.

- [ ] **Step 5: Use the helper from the playback facade**

Modify `src/domain/audio/browserProjectAudioFacade.ts`:

```ts
import type { ProjectAudioFacade } from "./interfaces";
import { mockProjectAudioFacade } from "./mockFacade";
import { BrowserPlaybackService, type BrowserPlaybackMedia } from "./browserPlaybackService";
import { toAudioUrl } from "./audioFileUrl";

interface BrowserProjectAudioMedia extends BrowserPlaybackMedia {
  duration?: number;
  src?: string;
  load?: () => void;
}

export function createBrowserProjectAudioFacade(
  media: BrowserProjectAudioMedia
): ProjectAudioFacade {
  const playback = new BrowserPlaybackService(media);

  return {
    source: {
      async load(filePath) {
        if ("src" in media) {
          media.src = toAudioUrl(filePath);
        }

        media.load?.();
        await waitForMetadata(media);

        return {
          durationMs: Number.isFinite(media.duration) ? Math.round((media.duration ?? 0) * 1000) : 0,
          sampleRate: 0,
          channelCount: 2
        };
      },
      async unload() {
        await playback.pause();
        if ("src" in media) {
          media.src = "";
        }
      }
    },
    playback,
    analysis: mockProjectAudioFacade.analysis,
    processing: mockProjectAudioFacade.processing
  };
}

function waitForMetadata(media: BrowserProjectAudioMedia) {
  if (Number.isFinite(media.duration) && (media.duration ?? 0) > 0) {
    return Promise.resolve();
  }

  if (!media.addEventListener || !media.removeEventListener) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const cleanup = () => {
      media.removeEventListener?.("loadedmetadata", handleLoadedMetadata);
      media.removeEventListener?.("error", handleError);
    };
    const handleLoadedMetadata = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      resolve();
    };

    media.addEventListener?.("loadedmetadata", handleLoadedMetadata);
    media.addEventListener?.("error", handleError);
  });
}
```

- [ ] **Step 6: Run the facade tests**

Run:

```powershell
npm test -- src/domain/audio/browserProjectAudioFacade.test.ts src/domain/audio/audioFileUrl.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

Run:

```powershell
git add -- src/domain/audio/audioFileUrl.ts src/domain/audio/audioFileUrl.test.ts src/domain/audio/browserProjectAudioFacade.ts
git commit -m "Extract browser audio URL helper"
```

---

## Task 2: Add Pure Waveform Generation

**Files:**
- Create: `src/domain/audio/waveform.ts`
- Create: `src/domain/audio/waveform.test.ts`
- Modify: `src/domain/audio/types.ts`

- [ ] **Step 1: Write failing waveform tests**

Create `src/domain/audio/waveform.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createWaveformOverviewFromBuffer } from "./waveform";

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

describe("createWaveformOverviewFromBuffer", () => {
  it("creates points at a fixed time-based rate", () => {
    const buffer = new FakeAudioBuffer([new Float32Array([0, 0.5, -1, 0.25])], 4);

    const overview = createWaveformOverviewFromBuffer(buffer, { pointsPerSecond: 2 });

    expect(overview).toEqual({
      pointsPerSecond: 2,
      durationMs: 1000,
      points: [
        { startMs: 0, endMs: 500, peak: 0.5 },
        { startMs: 500, endMs: 1000, peak: 1 }
      ]
    });
  });

  it("mixes multiple channels into mono before calculating peak", () => {
    const left = new Float32Array([0.2, 0.2, 0.2, 0.2]);
    const right = new Float32Array([1, 1, 0, 0]);
    const buffer = new FakeAudioBuffer([left, right], 4);

    const overview = createWaveformOverviewFromBuffer(buffer, { pointsPerSecond: 2 });

    expect(overview.points).toEqual([
      { startMs: 0, endMs: 500, peak: 0.6 },
      { startMs: 500, endMs: 1000, peak: 0.2 }
    ]);
  });

  it("clamps peaks into the 0..1 range", () => {
    const buffer = new FakeAudioBuffer([new Float32Array([0, 2, -3, 0])], 4);

    const overview = createWaveformOverviewFromBuffer(buffer, { pointsPerSecond: 2 });

    expect(overview.points.map((point) => point.peak)).toEqual([1, 1]);
  });

  it("returns an empty overview for empty audio", () => {
    const buffer = new FakeAudioBuffer([new Float32Array()], 44_100);

    const overview = createWaveformOverviewFromBuffer(buffer, { pointsPerSecond: 50 });

    expect(overview).toEqual({
      pointsPerSecond: 50,
      durationMs: 0,
      points: []
    });
  });
});
```

- [ ] **Step 2: Run the failing waveform tests**

Run:

```powershell
npm test -- src/domain/audio/waveform.test.ts
```

Expected: FAIL because `src/domain/audio/waveform.ts` does not exist.

- [ ] **Step 3: Add waveform types and pure generator**

Create `src/domain/audio/waveform.ts`:

```ts
export interface WaveformOverview {
  pointsPerSecond: number;
  durationMs: number;
  points: WaveformPoint[];
}

export interface WaveformPoint {
  startMs: number;
  endMs: number;
  peak: number;
}

export interface WaveformBuildOptions {
  pointsPerSecond?: number;
}

interface DecodedAudioBuffer {
  duration: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

const DEFAULT_POINTS_PER_SECOND = 50;

export function createWaveformOverviewFromBuffer(
  buffer: DecodedAudioBuffer,
  options: WaveformBuildOptions = {}
): WaveformOverview {
  const pointsPerSecond = options.pointsPerSecond ?? DEFAULT_POINTS_PER_SECOND;
  const durationMs = Math.round(buffer.duration * 1000);
  const sampleCount = Math.max(0, Math.floor(buffer.duration * buffer.sampleRate));

  if (sampleCount === 0 || buffer.numberOfChannels === 0) {
    return {
      pointsPerSecond,
      durationMs: 0,
      points: []
    };
  }

  const pointCount = Math.ceil(buffer.duration * pointsPerSecond);
  const samplesPerPoint = buffer.sampleRate / pointsPerSecond;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const startSample = Math.floor(index * samplesPerPoint);
    const endSample = Math.min(sampleCount, Math.floor((index + 1) * samplesPerPoint));
    const peak = calculateMonoPeak(buffer, startSample, endSample);

    return {
      startMs: Math.round((startSample / buffer.sampleRate) * 1000),
      endMs: Math.min(durationMs, Math.round((endSample / buffer.sampleRate) * 1000)),
      peak
    };
  });

  return {
    pointsPerSecond,
    durationMs,
    points
  };
}

function calculateMonoPeak(buffer: DecodedAudioBuffer, startSample: number, endSample: number) {
  let peak = 0;

  for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex += 1) {
    let mixedSample = 0;

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      mixedSample += buffer.getChannelData(channel)[sampleIndex] ?? 0;
    }

    mixedSample /= buffer.numberOfChannels;
    peak = Math.max(peak, Math.abs(mixedSample));
  }

  return clamp01(roundPeak(peak));
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function roundPeak(value: number) {
  return Math.round(value * 1000) / 1000;
}
```

- [ ] **Step 4: Re-export waveform types from audio types**

Modify `src/domain/audio/types.ts` by adding this export at the end:

```ts
export type { WaveformOverview, WaveformPoint } from "./waveform";
```

- [ ] **Step 5: Run waveform tests**

Run:

```powershell
npm test -- src/domain/audio/waveform.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run all audio domain tests**

Run:

```powershell
npm test -- src/domain/audio
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add -- src/domain/audio/types.ts src/domain/audio/waveform.ts src/domain/audio/waveform.test.ts
git commit -m "Add mono waveform overview generation"
```

---

## Task 3: Add Browser Waveform Service

**Files:**
- Create: `src/domain/audio/browserWaveformService.ts`
- Create: `src/domain/audio/browserWaveformService.test.ts`

- [ ] **Step 1: Write failing browser waveform service tests**

Create `src/domain/audio/browserWaveformService.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserWaveformService } from "./browserWaveformService";

class FakeAudioBuffer {
  readonly duration = 1;
  readonly numberOfChannels = 1;
  readonly sampleRate = 4;

  getChannelData() {
    return new Float32Array([0, 0.25, -1, 0.5]);
  }
}

describe("createBrowserWaveformService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "fetch");
    Reflect.deleteProperty(globalThis, "AudioContext");
  });

  it("fetches and decodes an audio URL into a waveform overview", async () => {
    const arrayBuffer = new ArrayBuffer(8);
    const decodeAudioData = vi.fn().mockResolvedValue(new FakeAudioBuffer());
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(arrayBuffer)
    });

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetch
    });
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(() => ({ decodeAudioData }))
    });

    const service = createBrowserWaveformService();
    const overview = await service.buildOverview("file:///D:/demo.wav");

    expect(fetch).toHaveBeenCalledWith("file:///D:/demo.wav");
    expect(decodeAudioData).toHaveBeenCalledWith(arrayBuffer);
    expect(overview.pointsPerSecond).toBe(50);
    expect(overview.durationMs).toBe(1000);
    expect(overview.points).toHaveLength(50);
  });

  it("throws a stable error when fetching the audio file fails", async () => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: vi.fn().mockResolvedValue({ ok: false })
    });
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(() => ({ decodeAudioData: vi.fn() }))
    });

    const service = createBrowserWaveformService();

    await expect(service.buildOverview("file:///D:/missing.wav")).rejects.toThrow(
      "Failed to load audio file."
    );
  });

  it("throws a stable error when decoding fails", async () => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
      })
    });
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(() => ({
        decodeAudioData: vi.fn().mockRejectedValue(new Error("bad file"))
      }))
    });

    const service = createBrowserWaveformService();

    await expect(service.buildOverview("file:///D:/bad.wav")).rejects.toThrow(
      "Failed to decode audio waveform."
    );
  });
});
```

- [ ] **Step 2: Run the failing service tests**

Run:

```powershell
npm test -- src/domain/audio/browserWaveformService.test.ts
```

Expected: FAIL because `src/domain/audio/browserWaveformService.ts` does not exist.

- [ ] **Step 3: Add browser waveform service**

Create `src/domain/audio/browserWaveformService.ts`:

```ts
import {
  createWaveformOverviewFromBuffer,
  type WaveformBuildOptions,
  type WaveformOverview
} from "./waveform";

export interface WaveformService {
  buildOverview(audioUrl: string, options?: WaveformBuildOptions): Promise<WaveformOverview>;
}

export function createBrowserWaveformService(): WaveformService {
  return {
    async buildOverview(audioUrl, options) {
      let response: Response;

      try {
        response = await fetch(audioUrl);
      } catch {
        throw new Error("Failed to load audio file.");
      }

      if (!response.ok) {
        throw new Error("Failed to load audio file.");
      }

      const audioContext = new AudioContext();

      try {
        const audioData = await response.arrayBuffer();
        const decodedAudio = await audioContext.decodeAudioData(audioData);
        return createWaveformOverviewFromBuffer(decodedAudio, options);
      } catch {
        throw new Error("Failed to decode audio waveform.");
      }
    }
  };
}
```

- [ ] **Step 4: Run browser waveform service tests**

Run:

```powershell
npm test -- src/domain/audio/browserWaveformService.test.ts src/domain/audio/waveform.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```powershell
git add -- src/domain/audio/browserWaveformService.ts src/domain/audio/browserWaveformService.test.ts
git commit -m "Add browser waveform service"
```

---

## Task 4: Wire Import Flow Through App

**Files:**
- Modify: `src/App.tsx`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write failing App import tests**

Create `src/App.test.tsx`:

```tsx
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

class FakeAudioElement {
  currentTime = 0;
  duration = 12;
  playbackRate = 1;
  preservesPitch = false;
  src = "";

  async play() {}

  pause() {}

  load() {}
}

describe("App local audio import", () => {
  beforeEach(() => {
    Object.defineProperty(window, "ziqiApp", {
      configurable: true,
      value: {
        getVersion: vi.fn().mockResolvedValue("test-version"),
        selectAudioFile: vi.fn().mockResolvedValue({
          filePath: "D:\\Music Library\\demo track.wav"
        })
      }
    });

    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: FakeAudioElement
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("creates a project and shows waveform data after importing audio", async () => {
    const waveformService = {
      buildOverview: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [
          { startMs: 0, endMs: 20, peak: 0.2 },
          { startMs: 20, endMs: 40, peak: 0.8 }
        ]
      })
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(screen.getByLabelText("Audio waveform")).toBeTruthy();
    expect(waveformService.buildOverview).toHaveBeenCalledWith(
      "file:///D:/Music%20Library/demo%20track.wav"
    );
  });

  it("does nothing when file selection is canceled", async () => {
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue(null);
    const waveformService = {
      buildOverview: vi.fn()
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(waveformService.buildOverview).not.toHaveBeenCalled();
  });

  it("shows a stable error when waveform decoding fails", async () => {
    const waveformService = {
      buildOverview: vi.fn().mockRejectedValue(new Error("Failed to decode audio waveform."))
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Failed to decode audio waveform.")).toBeTruthy();
    });
    expect(screen.getByText("No project loaded")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the failing App tests**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: FAIL because `App` does not accept `waveformService` and `WorkbenchShell` does not render waveform data.

- [ ] **Step 3: Wire waveform import state into App**

Modify `src/App.tsx`:

```tsx
import { useMemo, useState } from "react";
import { WorkbenchShell } from "./components/WorkbenchShell";
import { createBrowserProjectAudioFacade } from "./domain/audio/browserProjectAudioFacade";
import type { ProjectSummary } from "./domain/project/types";
import { createProjectFromAudio } from "./domain/project/createProjectFromAudio";
import {
  createBrowserWaveformService,
  type WaveformService
} from "./domain/audio/browserWaveformService";
import { toAudioUrl } from "./domain/audio/audioFileUrl";
import type { WaveformOverview } from "./domain/audio/types";

interface AppProps {
  waveformService?: WaveformService;
}

export function App({ waveformService }: AppProps) {
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [waveformOverview, setWaveformOverview] = useState<WaveformOverview | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const audioFacade = useMemo(() => createBrowserProjectAudioFacade(new Audio()), []);
  const activeWaveformService = useMemo(
    () => waveformService ?? createBrowserWaveformService(),
    [waveformService]
  );

  async function handleImportAudio() {
    setIsImporting(true);
    setImportError(null);

    try {
      const selectedFile = await window.ziqiApp.selectAudioFile();
      if (!selectedFile) {
        return;
      }

      const audioUrl = toAudioUrl(selectedFile.filePath);
      const metadata = await audioFacade.source.load(selectedFile.filePath);
      const nextWaveformOverview = await activeWaveformService.buildOverview(audioUrl);
      await audioFacade.playback.seek(0);
      setProject(
        createProjectFromAudio({
          filePath: selectedFile.filePath,
          metadata
        })
      );
      setWaveformOverview(nextWaveformOverview);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to import audio.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <WorkbenchShell
      audioFacade={audioFacade}
      importError={importError}
      isImporting={isImporting}
      onImportAudio={handleImportAudio}
      project={project}
      waveformOverview={waveformOverview}
    />
  );
}
```

- [ ] **Step 4: Run App tests**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: still FAIL until `WorkbenchShell` accepts and renders `waveformOverview`; this confirms App wiring is waiting on the UI task.

- [ ] **Step 5: Do not commit Task 4 yet**

Task 4 depends on Task 5 UI rendering to pass. Leave these changes unstaged until Task 5 completes, then commit the App and Workbench changes together.

---

## Task 5: Render Real Waveform in Workbench

**Files:**
- Modify: `src/components/WorkbenchShell.tsx`
- Modify: `src/components/WorkbenchShell.test.tsx`
- Modify: `src/styles.css`
- Modify: `src/App.tsx`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Extend Workbench tests for waveform display**

Modify `src/components/WorkbenchShell.test.tsx` by adding the import and test below.

Add to the existing imports:

```ts
import type { WaveformOverview } from "../domain/audio/types";
```

Add this test inside the existing `describe` block:

```tsx
it("renders real waveform overview data when a project is loaded", async () => {
  const project = createMockProjectSummary();
  const waveformOverview: WaveformOverview = {
    pointsPerSecond: 50,
    durationMs: 120_000,
    points: [
      { startMs: 0, endMs: 20, peak: 0.2 },
      { startMs: 20, endMs: 40, peak: 0.8 },
      { startMs: 40, endMs: 60, peak: 0.4 }
    ]
  };

  render(
    <WorkbenchShell
      project={project}
      audioFacade={mockProjectAudioFacade}
      waveformOverview={waveformOverview}
    />
  );

  expect(screen.getByLabelText("Audio waveform")).toBeTruthy();
  expect(screen.getAllByTestId("waveform-point")).toHaveLength(3);
});
```

- [ ] **Step 2: Run failing Workbench tests**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: FAIL because `WorkbenchShell` does not accept `waveformOverview` yet.

- [ ] **Step 3: Update WorkbenchShell props and render waveform**

Modify `src/components/WorkbenchShell.tsx`.

Update imports:

```tsx
import { useEffect, useMemo, useState } from "react";
import type { ProjectSummary } from "../domain/project/types";
import { mockProjectAudioFacade } from "../domain/audio/mockFacade";
import type { ProjectAudioFacade } from "../domain/audio/interfaces";
import type { PlaybackState, SpectrumFrame, WaveformOverview } from "../domain/audio/types";
```

Update props:

```tsx
interface WorkbenchShellProps {
  project: ProjectSummary | null;
  audioFacade?: ProjectAudioFacade;
  waveformOverview?: WaveformOverview | null;
  importError?: string | null;
  isImporting?: boolean;
  onImportAudio?: () => Promise<void> | void;
}
```

Update function signature:

```tsx
export function WorkbenchShell({
  project,
  audioFacade = mockProjectAudioFacade,
  waveformOverview,
  importError,
  isImporting = false,
  onImportAudio
}: WorkbenchShellProps) {
```

Replace the current `<div className="spectrum-canvas">...</div>` block with:

```tsx
            <div className="spectrum-canvas waveform-canvas" aria-label="Audio waveform">
              {waveformOverview && waveformOverview.points.length > 0 ? (
                <div className="waveform-grid">
                  {waveformOverview.points.map((point) => (
                    <div
                      key={`${point.startMs}-${point.endMs}`}
                      className="waveform-point"
                      data-testid="waveform-point"
                      style={{
                        height: `${Math.max(2, point.peak * 100)}%`
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="waveform-empty">Import audio to generate a waveform.</div>
              )}

              <div
                className="cursor-line cursor-line-vertical"
                style={{ left: `${progressPercent}%` }}
              />
              <div className="grid-overlay" />
            </div>
```

- [ ] **Step 4: Add waveform styles**

Modify `src/styles.css` by adding these rules near the existing spectrum rules:

```css
.waveform-canvas {
  display: grid;
  align-items: center;
}

.waveform-grid {
  display: flex;
  align-items: center;
  gap: 1px;
  height: 100%;
  min-width: 100%;
}

.waveform-point {
  flex: 1 1 1px;
  min-width: 1px;
  border-radius: 999px;
  background: linear-gradient(180deg, #f4b36e, #b96a30);
}

.waveform-empty {
  color: #6e6256;
  justify-self: center;
}
```

- [ ] **Step 5: Run Workbench tests**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run App tests**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Tasks 4 and 5**

Run:

```powershell
git add -- src/App.tsx src/App.test.tsx src/components/WorkbenchShell.tsx src/components/WorkbenchShell.test.tsx src/styles.css
git commit -m "Wire waveform import into workbench"
```

---

## Task 6: Full Verification and Manual Electron Check

**Files:**
- Verify only unless a prior task left a failure.

- [ ] **Step 1: Run all tests**

Run:

```powershell
npm test
```

Expected: PASS with all test files green.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build
```

Expected: PASS with TypeScript and Vite build complete.

- [ ] **Step 3: Launch the local app for manual verification**

Run:

```powershell
$env:ZIQI_RENDERER_DEV_URL='http://127.0.0.1:5173'; npm run dev -- --host 127.0.0.1
```

In another terminal after Vite is ready:

```powershell
npm run build
npm start
```

Expected manual result:

- The app opens.
- Clicking `Import Audio` opens the file chooser.
- Selecting an audio file creates a project with the file name.
- The main workspace shows a real waveform.
- `Play` starts real audio playback.
- `Pause` stops playback.
- Dragging the seek slider changes playback position.
- The waveform cursor and transport progress move with playback position.

- [ ] **Step 4: Fix only verification failures in touched files**

If a verification step fails, make the smallest fix in the files touched by this plan, then rerun the failing command. Do not add provider, project save/open, stereo waveform, or real spectrum behavior while fixing this task.

- [ ] **Step 5: Commit verification fixes if any were needed**

If Step 4 changed files, run:

```powershell
git add -- src
git commit -m "Stabilize waveform import verification"
```

If Step 4 did not change files, do not create an empty commit.

---

## Self-Review

### Spec Coverage

- Local file selection is covered by Task 1 and Task 4.
- Real audio playback source loading is preserved and verified through Task 1 and existing facade tests.
- Real mono waveform generation is covered by Task 2 and Task 3.
- Project creation during import is covered by Task 4.
- Workbench waveform rendering and cursor progress are covered by Task 5.
- Play, pause, and seek behavior remains covered by existing Workbench tests and the manual verification in Task 6.
- Cancel and decode failure paths are covered by Task 4.
- Excluded scope is preserved: no stereo display, project persistence, provider flow, real spectrum, waveform cache, or worker implementation appears in implementation tasks.

### Placeholder Scan

This plan contains no deferred-work markers, unresolved placeholder steps, or references to undefined functions. All new functions, types, tests, and commands are introduced before later tasks depend on them.

### Type Consistency

- `WaveformOverview` and `WaveformPoint` are defined in `src/domain/audio/waveform.ts` and re-exported from `src/domain/audio/types.ts`.
- `WaveformService.buildOverview(audioUrl, options?)` is defined in Task 3 and injected into `App` in Task 4.
- `WorkbenchShell` receives `waveformOverview?: WaveformOverview | null` in Task 5, matching the `App` state introduced in Task 4.
