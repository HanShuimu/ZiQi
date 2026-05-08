import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { ProjectSummary } from "./domain/project/types";

class FakeAudioElement {
  static instances: FakeAudioElement[] = [];

  currentTime = 0;
  duration = 12;
  playbackRate = 1;
  preservesPitch = false;
  src = "";

  constructor() {
    FakeAudioElement.instances.push(this);
  }

  async play() {}

  pause() {}

  load() {}
}

describe("App local audio import", () => {
  beforeEach(() => {
    FakeAudioElement.instances = [];
    const audioData = new ArrayBuffer(8);
    let objectUrlIndex = 0;

    Object.defineProperty(window, "ziqiApp", {
      configurable: true,
      value: {
        getVersion: vi.fn().mockResolvedValue("test-version"),
        openProject: vi.fn().mockResolvedValue(null),
        saveProject: vi.fn().mockResolvedValue(null),
        selectAudioFile: vi.fn().mockResolvedValue({
          audioData,
          filePath: "D:\\Music Library\\demo track.wav"
        })
      }
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => {
        objectUrlIndex += 1;
        return `blob:audio-${objectUrlIndex}`;
      })
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn()
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
    const audioData = new ArrayBuffer(8);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
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
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenCalledWith(audioData);
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
  });

  it("creates the playback blob before waveform decoding can detach the audio data", async () => {
    const audioData = new ArrayBuffer(8);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockImplementation(async (receivedAudioData) => {
        structuredClone(receivedAudioData, { transfer: [receivedAudioData] });
        return {
          pointsPerSecond: 50,
          durationMs: 12_000,
          points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
        };
      })
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ size: 8 }));
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
  });

  it("does nothing when file selection is canceled", async () => {
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue(null);
    const waveformService = {
      buildOverviewFromAudioData: vi.fn()
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(waveformService.buildOverviewFromAudioData).not.toHaveBeenCalled();
  });

  it("shows a stable error when selected file bytes cannot be loaded", async () => {
    window.ziqiApp.selectAudioFile = vi
      .fn()
      .mockRejectedValue(new Error("Failed to load audio file."));
    const waveformService = {
      buildOverviewFromAudioData: vi.fn()
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Failed to load audio file.")).toBeTruthy();
    });
    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(waveformService.buildOverviewFromAudioData).not.toHaveBeenCalled();
    expect(FakeAudioElement.instances[0].src).toBe("");
  });

  it("shows a stable error when waveform decoding fails", async () => {
    const waveformService = {
      buildOverviewFromAudioData: vi
        .fn()
        .mockRejectedValue(new Error("Failed to decode audio waveform."))
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Failed to decode audio waveform.")).toBeTruthy();
    });
    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("");
  });

  it("keeps the current project and shows a stable error when a later import fails", async () => {
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
      buildOverviewFromAudioData: vi
        .fn()
        .mockResolvedValueOnce({
          pointsPerSecond: 50,
          durationMs: 12_000,
          points: [
            { startMs: 0, endMs: 20, peak: 0.2 },
            { startMs: 20, endMs: 40, peak: 0.8 }
          ]
        })
        .mockRejectedValueOnce(new Error("Failed to decode audio waveform."))
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenLastCalledWith(firstAudioData);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Failed to decode audio waveform.")).toBeTruthy();
    });
    expect(screen.getByText("demo track")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenLastCalledWith(secondAudioData);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:audio-2");
  });

  it("keeps the current project and shows a stable error when a later selected file cannot be loaded", async () => {
    const firstAudioData = new ArrayBuffer(8);
    window.ziqiApp.selectAudioFile = vi
      .fn()
      .mockResolvedValueOnce({
        audioData: firstAudioData,
        filePath: "D:\\Music Library\\demo track.wav"
      })
      .mockRejectedValueOnce(new Error("Failed to load audio file."));
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
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
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Failed to load audio file.")).toBeTruthy();
    });
    expect(screen.getByText("demo track")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenCalledOnce();
  });

  it("keeps the current project and shows a stable error when media loading fails", async () => {
    class ErrorLoadingAudioElement extends FakeAudioElement {
      override duration = Number.NaN;
      private listeners = new Map<string, Set<() => void>>();

      addEventListener(type: string, listener: () => void) {
        const listeners = this.listeners.get(type) ?? new Set<() => void>();
        listeners.add(listener);
        this.listeners.set(type, listeners);
      }

      removeEventListener(type: string, listener: () => void) {
        this.listeners.get(type)?.delete(listener);
      }

      override load() {
        queueMicrotask(() => {
          for (const listener of this.listeners.get("error") ?? []) {
            listener();
          }
        });
      }
    }

    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: ErrorLoadingAudioElement
    });
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.2 }]
      })
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Failed to load audio file.")).toBeTruthy();
    });
    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:audio-1");
  });

  it("saves an imported project and updates it to project audio path", async () => {
    const audioData = new ArrayBuffer(8);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    window.ziqiApp.saveProject = vi.fn().mockImplementation(async (request) => ({
      project: {
        ...request.project,
        sourceAudio: {
          ...request.project.sourceAudio,
          filePath: "audio/demo track.wav"
        }
      },
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    }));
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    await user.click(screen.getByRole("button", { name: "Save Project" }));

    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledOnce();
    });
    expect(window.ziqiApp.saveProject).toHaveBeenCalledWith({
      project: expect.objectContaining({
        sourceAudio: expect.objectContaining({
          filePath: "D:\\Music Library\\demo track.wav"
        })
      })
    });
  });

  it("saves an already saved project using existing location", async () => {
    const openedAudioData = new ArrayBuffer(8);
    window.ziqiApp.openProject = vi.fn().mockResolvedValue({
      audioData: openedAudioData,
      project: createProjectSummary("audio/demo track.wav"),
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    });
    window.ziqiApp.saveProject = vi.fn().mockImplementation(async (request) => ({
      project: request.project,
      projectFilePath: request.projectFilePath,
      projectRootPath: request.projectRootPath
    }));
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getByRole("button", { name: "Open Project" }));
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    await user.click(screen.getByRole("button", { name: "Save Project" }));

    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledOnce();
    });
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

  it("opens a saved project and rebuilds waveform data from project audio bytes", async () => {
    const openedAudioData = new ArrayBuffer(16);
    window.ziqiApp.openProject = vi.fn().mockResolvedValue({
      audioData: openedAudioData,
      project: createProjectSummary("audio/demo track.wav"),
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    });
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getByRole("button", { name: "Open Project" }));

    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenCalledWith(openedAudioData);
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
    expect(screen.getByLabelText("Audio waveform")).toBeTruthy();
  });

  it("open cancel does nothing", async () => {
    window.ziqiApp.openProject = vi.fn().mockResolvedValue(null);
    const waveformService = {
      buildOverviewFromAudioData: vi.fn()
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getByRole("button", { name: "Open Project" }));

    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(waveformService.buildOverviewFromAudioData).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("open failure keeps current project and current playback URL, shows error", async () => {
    const importedAudioData = new ArrayBuffer(8);
    const openedAudioData = new ArrayBuffer(16);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData: importedAudioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    window.ziqiApp.openProject = vi.fn().mockResolvedValue({
      audioData: openedAudioData,
      project: createProjectSummary("audio/broken track.wav"),
      projectFilePath: "D:\\ZiQi Projects\\Broken\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Broken"
    });
    const waveformService = {
      buildOverviewFromAudioData: vi
        .fn()
        .mockResolvedValueOnce({
          pointsPerSecond: 50,
          durationMs: 12_000,
          points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
        })
        .mockRejectedValueOnce(new Error("Failed to decode project audio."))
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");

    await user.click(screen.getByRole("button", { name: "Open Project" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to decode project audio.")).toBeTruthy();
    });
    expect(screen.getByText("demo track")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenLastCalledWith(openedAudioData);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:audio-2");
  });
});

function createProjectSummary(filePath: string): ProjectSummary {
  return {
    id: "project-demo",
    name: "demo track",
    sourceAudio: {
      id: "source-demo",
      name: "demo track.wav",
      durationMs: 12_000,
      sampleRate: 0,
      channelCount: 2,
      filePath
    },
    assets: [],
    analysisRuns: [],
    annotations: [],
    workspace: {
      preset: "spectrum-analysis",
      activeDock: "analysis",
      gridEnabled: true,
      bpm: 120,
      beatOffsetMs: 0,
      playbackRate: 1
    }
  };
}
