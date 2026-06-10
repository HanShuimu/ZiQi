import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS } from "../core/audio/pitchHeatmap";
import { mockProjectAudioFacade } from "../services/projectAudio/mockFacade";
import type { SpectrogramOverview, WaveformOverview } from "../core/audio/types";
import { createMockProjectSummary } from "../core/project/mockProject";
import { WorkbenchShell } from "./WorkbenchShell";
import { getSkinDefinition } from "../skins/registry";
import { UiProvider } from "../ui";

describe("WorkbenchShell transport controls", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    Object.defineProperty(window, "ziqiApp", {
      configurable: true,
      value: {
        getVersion: vi.fn().mockResolvedValue("test-version")
      }
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ({
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        fillStyle: ""
      }))
    });
  });

  it("does not render the mixed command strip actions", () => {
    const project = createMockProjectSummary();

    renderWorkbenchShell(<WorkbenchShell project={project} />);

    expect(screen.queryByRole("button", { name: "Open Project" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save Project" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Import Audio" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Play from Cursor" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Toggle Grid" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Run Stem Provider" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Run Analysis" })).toBeNull();
  });

  it("renders loaded project metadata in the topbar without preset", () => {
    const project = createMockProjectSummary();

    renderWorkbenchShell(<WorkbenchShell project={project} />);

    expect(screen.getByRole("heading", { name: "Demo Track Study" })).toBeTruthy();
    expect(screen.getByText("demo-track.wav")).toBeTruthy();
    const meta = screen.getByLabelText("Source audio metadata");
    expect(within(meta).getByText("4:02")).toBeTruthy();
    expect(within(meta).getByText("2ch")).toBeTruthy();
    expect(within(meta).getByText("48kHz")).toBeTruthy();
    expect(screen.queryByText(/Preset:/)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Transcription Workbench" })).toBeNull();
  });

  it("does not render the project rail or bottom docks in the focused workspace", () => {
    const project = createMockProjectSummary();

    renderWorkbenchShell(<WorkbenchShell project={project} />);

    expect(screen.queryByText("Assets")).toBeNull();
    expect(screen.queryByText("Annotations")).toBeNull();
    expect(screen.queryByText("Vocals Stem")).toBeNull();
    expect(screen.queryByText("Possible tonic shift")).toBeNull();
    expect(screen.queryByText("Analysis")).toBeNull();
    expect(screen.queryByText("Stems")).toBeNull();
    expect(screen.queryByText("Session Notes")).toBeNull();
    expect(screen.queryByText("Compare")).toBeNull();
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("renders an empty startup placeholder without an import button", () => {
    renderWorkbenchShell(<WorkbenchShell project={null} />);

    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Import Audio" })).toBeNull();
  });

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

    renderWorkbenchShell(
      <WorkbenchShell
        project={project}
        audioFacade={mockProjectAudioFacade}
        spectrogramOverview={createSpectrogramOverview()}
        waveformOverview={waveformOverview}
      />
    );

    expect(screen.getByRole("img", { name: "Audio waveform overview" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Pitch heatmap" })).toBeTruthy();
    expect(screen.getByLabelText("Piano pitch axis")).toBeTruthy();
    expect(screen.getAllByTestId("waveform-point")).toHaveLength(3);
  });

  it("aligns waveform, spectrum, and navigator in the shared time grid", () => {
    const project = createMockProjectSummary();

    renderWorkbenchShell(
      <WorkbenchShell
        project={project}
        audioFacade={mockProjectAudioFacade}
        spectrogramOverview={createSpectrogramOverview()}
      />
    );

    expect(document.querySelector(".spectrogram-time-grid")).toBeTruthy();
    expect(document.querySelector(".spectrogram-waveform-row")).toBeTruthy();
    expect(document.querySelector(".spectrogram-body")).toBeTruthy();
    expect(document.querySelector(".spectrogram-navigator-row")).toBeTruthy();
  });

  it("uses high-contrast playhead classes for waveform and spectrogram cursors", () => {
    const project = createMockProjectSummary();
    const waveformOverview: WaveformOverview = {
      pointsPerSecond: 50,
      durationMs: 120_000,
      points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
    };

    const playbackVisibleFacade = {
      ...mockProjectAudioFacade,
      playback: {
        ...mockProjectAudioFacade.playback,
        getState: () => ({ ...mockProjectAudioFacade.playback.getState(), currentTimeMs: 5000 })
      }
    };

    renderWorkbenchShell(
      <WorkbenchShell
        project={project}
        audioFacade={playbackVisibleFacade}
        spectrogramOverview={createSpectrogramOverview()}
        waveformOverview={waveformOverview}
      />
    );

    expect(document.querySelector(".waveform-cursor")).toBeTruthy();
    expect(document.querySelector(".spectrogram-cursor")).toBeTruthy();
  });

  it("renders grouped workspace controls above the waveform", () => {
    const project = createMockProjectSummary();

    renderWorkbenchShell(<WorkbenchShell project={project} />);

    const controlZone = screen.getByLabelText("Workspace controls");
    const waveform = screen.getByRole("img", { name: "Audio waveform overview" });

    expect(controlZone.compareDocumentPosition(waveform) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Playback")).toBeTruthy();
    expect(screen.getByText("Speed")).toBeTruthy();
    expect(screen.getByText("Loop")).toBeTruthy();
  });

  it("renders bar grid controls above the waveform", () => {
    const project = createMockProjectSummary();

    renderWorkbenchShell(<WorkbenchShell project={project} />);

    expect(screen.getByText("Bar Grid")).toBeTruthy();
    expect(screen.getByLabelText("Beats per bar")).toMatchObject({
      type: "number",
      value: "4"
    });
    expect(screen.getByLabelText("BPM")).toMatchObject({
      type: "number",
      value: "120"
    });
    expect(screen.getByLabelText("Beat offset milliseconds")).toMatchObject({
      type: "number",
      value: "0"
    });
    expect(screen.getByRole("button", { name: "Decrease BPM" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Increase BPM" })).toBeTruthy();
  });

  it("reports bar grid control changes for persistence", () => {
    const project = createMockProjectSummary();
    const onWorkspaceChange = vi.fn();

    renderWorkbenchShell(
      <WorkbenchShell
        project={project}
        audioFacade={mockProjectAudioFacade}
        onWorkspaceChange={onWorkspaceChange}
        spectrogramOverview={createSpectrogramOverview()}
      />
    );

    fireEvent.change(screen.getByLabelText("Beats per bar"), { target: { value: "3.7" } });
    fireEvent.change(screen.getByLabelText("BPM"), { target: { value: "96.6" } });
    fireEvent.change(screen.getByLabelText("Beat offset milliseconds"), { target: { value: "-250.6" } });

    expect(onWorkspaceChange).toHaveBeenCalledWith({ beatsPerBar: 4 });
    expect(onWorkspaceChange).toHaveBeenCalledWith({ bpm: 97 });
    expect(onWorkspaceChange).toHaveBeenCalledWith({ beatOffsetMs: -251 });
  });

  it("steps BPM by one from the bar grid arrow buttons", async () => {
    const user = userEvent.setup();
    const project = createMockProjectSummary();
    const onWorkspaceChange = vi.fn();

    renderWorkbenchShell(
      <WorkbenchShell
        project={project}
        audioFacade={mockProjectAudioFacade}
        onWorkspaceChange={onWorkspaceChange}
        spectrogramOverview={createSpectrogramOverview()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Decrease BPM" }));
    await user.click(screen.getByRole("button", { name: "Increase BPM" }));

    expect(onWorkspaceChange).toHaveBeenCalledWith({ bpm: 119 });
    expect(onWorkspaceChange).toHaveBeenCalledWith({ bpm: 121 });
  });

  it("keeps BPM at one when decreasing from the minimum bar grid value", async () => {
    const user = userEvent.setup();
    const project = {
      ...createMockProjectSummary(),
      workspace: {
        ...createMockProjectSummary().workspace,
        bpm: 1
      }
    };
    const onWorkspaceChange = vi.fn();

    renderWorkbenchShell(
      <WorkbenchShell
        project={project}
        audioFacade={mockProjectAudioFacade}
        onWorkspaceChange={onWorkspaceChange}
        spectrogramOverview={createSpectrogramOverview()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Decrease BPM" }));

    expect(onWorkspaceChange).toHaveBeenCalledWith({ bpm: 1 });
    expect(onWorkspaceChange).not.toHaveBeenCalledWith({ bpm: 0 });
  });

  it("renders a single play toggle in the spectrum timeline controls", async () => {
    const user = userEvent.setup();
    const project = createMockProjectSummary();
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn().mockResolvedValue(undefined);
    const audioFacade = {
      ...mockProjectAudioFacade,
      playback: {
        ...mockProjectAudioFacade.playback,
        getState: vi.fn(() => ({
          isPlaying: false,
          currentTimeMs: 43_120,
          playbackRate: 1
        })),
        play,
        pause
      }
    };

    renderWorkbenchShell(<WorkbenchShell project={project} audioFacade={audioFacade} />);

    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Play" }));

    expect(play).toHaveBeenCalledWith(43_120);
    expect(pause).not.toHaveBeenCalled();
  });

  it("shows Pause while playback is active and pauses from the toggle", async () => {
    const user = userEvent.setup();
    const project = createMockProjectSummary();
    const pause = vi.fn().mockResolvedValue(undefined);
    const audioFacade = {
      ...mockProjectAudioFacade,
      playback: {
        ...mockProjectAudioFacade.playback,
        getState: vi.fn(() => ({
          isPlaying: true,
          currentTimeMs: 43_120,
          playbackRate: 1
        })),
        pause
      }
    };

    renderWorkbenchShell(<WorkbenchShell project={project} audioFacade={audioFacade} />);

    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Pause" }));

    expect(pause).toHaveBeenCalledOnce();
  });

  it("toggles playback with Space when a project is loaded", async () => {
    const user = userEvent.setup();
    const project = createMockProjectSummary();
    const play = vi.fn().mockResolvedValue(undefined);
    const audioFacade = {
      ...mockProjectAudioFacade,
      playback: {
        ...mockProjectAudioFacade.playback,
        getState: vi.fn(() => ({
          isPlaying: false,
          currentTimeMs: 43_120,
          playbackRate: 1
        })),
        play
      }
    };

    renderWorkbenchShell(<WorkbenchShell project={project} audioFacade={audioFacade} />);

    await user.keyboard(" ");

    expect(play).toHaveBeenCalledWith(43_120);
  });

  it("does not steal Space from focused controls", async () => {
    const user = userEvent.setup();
    const project = createMockProjectSummary();
    const play = vi.fn().mockResolvedValue(undefined);
    const audioFacade = {
      ...mockProjectAudioFacade,
      playback: {
        ...mockProjectAudioFacade.playback,
        getState: vi.fn(() => ({
          isPlaying: false,
          currentTimeMs: 43_120,
          playbackRate: 1
        })),
        play
      }
    };

    renderWorkbenchShell(<WorkbenchShell project={project} audioFacade={audioFacade} />);

    screen.getByRole("button", { name: "Play" }).focus();
    await user.keyboard(" ");

    expect(play).not.toHaveBeenCalled();
  });

  it("changes playback rate through the playback service and reports workspace updates", async () => {
    const user = userEvent.setup();
    const project = createMockProjectSummary();
    const setPlaybackRate = vi.fn().mockResolvedValue(undefined);
    const onWorkspaceChange = vi.fn();
    const audioFacade = {
      ...mockProjectAudioFacade,
      playback: {
        ...mockProjectAudioFacade.playback,
        getState: vi.fn(() => ({
          isPlaying: false,
          currentTimeMs: 3_000,
          playbackRate: 1
        })),
        setPlaybackRate
      }
    };

    renderWorkbenchShell(
      <WorkbenchShell
        project={project}
        audioFacade={audioFacade}
        onWorkspaceChange={onWorkspaceChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "0.75x" }));

    expect(setPlaybackRate).toHaveBeenCalledWith(0.75);
    expect(onWorkspaceChange).toHaveBeenCalledWith({
      playbackRate: 0.75
    });
  });

  it("uses an existing loop start when setting a loop end, then clears the range", async () => {
    const user = userEvent.setup();
    const project = {
      ...createMockProjectSummary(),
      workspace: {
        ...createMockProjectSummary().workspace,
        loopRange: {
          startMs: 1_000,
          endMs: 4_000
        }
      }
    };
    const setLoopRange = vi.fn().mockResolvedValue(undefined);
    const clearLoopRange = vi.fn().mockResolvedValue(undefined);
    const onWorkspaceChange = vi.fn();
    const audioFacade = {
      ...mockProjectAudioFacade,
      playback: {
        ...mockProjectAudioFacade.playback,
        clearLoopRange,
        getState: vi.fn(() => ({
          isPlaying: false,
          currentTimeMs: 3_000,
          playbackRate: 1,
          loopRange: {
            startMs: 1_000,
            endMs: 4_000
          }
        })),
        setLoopRange
      }
    };

    renderWorkbenchShell(
      <WorkbenchShell
        project={project}
        audioFacade={audioFacade}
        onWorkspaceChange={onWorkspaceChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Set Loop End" }));

    expect(setLoopRange).toHaveBeenCalledWith(1_000, 3_000);
    expect(onWorkspaceChange).toHaveBeenLastCalledWith({
      loopRange: {
        startMs: 1_000,
        endMs: 3_000
      }
    });

    await user.click(screen.getByRole("button", { name: "Clear Loop" }));

    expect(clearLoopRange).toHaveBeenCalledOnce();
    expect(onWorkspaceChange).toHaveBeenLastCalledWith({
      loopRange: undefined
    });
  });

  it("reports viewport changes for persistence", () => {
    const project = createMockProjectSummary();
    const onWorkspaceChange = vi.fn();

    renderWorkbenchShell(
      <WorkbenchShell
        project={project}
        audioFacade={mockProjectAudioFacade}
        onWorkspaceChange={onWorkspaceChange}
        spectrogramOverview={createSpectrogramOverview()}
      />
    );

    fireEvent.wheel(document.querySelector(".spectrogram-canvas-frame") as HTMLElement, {
      ctrlKey: true,
      deltaY: -100,
      clientX: 250
    });

    expect(onWorkspaceChange).toHaveBeenCalledWith({
      spectrogramViewport: expect.objectContaining({
        startMs: expect.any(Number),
        durationMs: expect.any(Number)
      })
    });
  });

  it("reports pitch heatmap display changes for persistence", () => {
    const project = createMockProjectSummary();
    const onProjectAnalysisViewChange = vi.fn();

    renderWorkbenchShell(
      <WorkbenchShell
        project={project}
        audioFacade={mockProjectAudioFacade}
        onProjectAnalysisViewChange={onProjectAnalysisViewChange}
        spectrogramOverview={createSpectrogramOverview()}
      />
    );

    expect(screen.getByLabelText("Gain")).toMatchObject({ min: "-48", max: "24" });
    expect(screen.getByLabelText("Contrast")).toMatchObject({ min: "0.6", max: "1.8" });
    expect(screen.getByLabelText("Range")).toMatchObject({ min: "80", max: "150" });
    expect(screen.getByLabelText("Floor")).toMatchObject({ min: "-80", max: "0" });
    expect(screen.getByLabelText("Intensity")).toMatchObject({ min: "0.5", max: "1.4" });

    fireEvent.change(screen.getByLabelText("Gain"), { target: { value: "6" } });

    expect(onProjectAnalysisViewChange).toHaveBeenCalledWith({
      pitchHeatmapDisplay: {
        ...DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
        gainDb: 6
      }
    });
  });

  it("limits rendered waveform points for long overviews", async () => {
    const project = createMockProjectSummary();
    const waveformOverview: WaveformOverview = {
      pointsPerSecond: 50,
      durationMs: 20_000,
      points: Array.from({ length: 1000 }, (_, index) => ({
        startMs: index * 20,
        endMs: index * 20 + 20,
        peak: (index % 10) / 10
      }))
    };

    renderWorkbenchShell(
      <WorkbenchShell
        project={project}
        audioFacade={mockProjectAudioFacade}
        spectrogramOverview={createSpectrogramOverview()}
        waveformOverview={waveformOverview}
      />
    );

    expect(screen.getAllByTestId("waveform-point")).toHaveLength(500);
  });
});

function renderWorkbenchShell(ui: React.ReactElement) {
  const skin = getSkinDefinition("default");
  return render(
    <UiProvider skinId={skin.id} adapter={skin.adapter}>
      {ui}
    </UiProvider>
  );
}

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

