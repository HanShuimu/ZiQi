import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockProjectAudioFacade } from "../domain/audio/mockFacade";
import { createMockProjectSummary } from "../domain/project/mockProject";
import { WorkbenchShell } from "./WorkbenchShell";

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
  });

  it("starts playback through the injected audio facade when play from cursor is clicked", async () => {
    const user = userEvent.setup();
    const project = createMockProjectSummary();
    const play = vi.fn().mockResolvedValue(undefined);
    const audioFacade = {
      ...mockProjectAudioFacade,
      playback: {
        ...mockProjectAudioFacade.playback,
        play
      }
    };

    render(<WorkbenchShell project={project} audioFacade={audioFacade} />);

    await user.click(screen.getByRole("button", { name: "Play from Cursor" }));

    expect(play).toHaveBeenCalledWith(43_120);
  });

  it("pauses and seeks through the injected audio facade from the transport", async () => {
    const user = userEvent.setup();
    const project = createMockProjectSummary();
    const pause = vi.fn().mockResolvedValue(undefined);
    const seek = vi.fn().mockResolvedValue(undefined);
    const audioFacade = {
      ...mockProjectAudioFacade,
      playback: {
        ...mockProjectAudioFacade.playback,
        pause,
        seek
      }
    };

    render(<WorkbenchShell project={project} audioFacade={audioFacade} />);

    await user.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.change(screen.getByRole("slider", { name: "Seek position" }), {
      target: { value: "64000" }
    });

    expect(pause).toHaveBeenCalledOnce();
    expect(seek).toHaveBeenCalledWith(64_000);
  });

  it("shows an empty state and starts audio import from the command strip", async () => {
    const user = userEvent.setup();
    const onImportAudio = vi.fn().mockResolvedValue(undefined);

    render(<WorkbenchShell project={null} onImportAudio={onImportAudio} />);

    expect(screen.getByText("No project loaded")).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    expect(onImportAudio).toHaveBeenCalledOnce();
  });
});
