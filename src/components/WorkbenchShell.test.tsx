import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    expect(screen.getByRole("img", { name: "Audio spectrogram" })).toBeTruthy();
    expect(screen.getByLabelText("Piano pitch axis")).toBeTruthy();
    expect(screen.getAllByTestId("waveform-point")).toHaveLength(3);
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
