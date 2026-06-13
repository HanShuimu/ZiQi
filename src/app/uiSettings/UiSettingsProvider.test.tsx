import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RuntimeProvider } from "../runtime";
import { UiSettingsProvider } from "./UiSettingsProvider";
import { useUiSettings } from "./useUiSettings";

function Probe() {
  const { changeSkin, uiSkin } = useUiSettings();

  return (
    <>
      <div>{uiSkin}</div>
      <button type="button" onClick={() => void changeSkin("animal-island")}>
        Switch
      </button>
    </>
  );
}

describe("UiSettingsProvider", () => {
  beforeEach(() => {
    Object.defineProperty(window, "ziqiApp", {
      configurable: true,
      value: {
        activateOpenedProject: vi.fn().mockResolvedValue(undefined),
        getVersion: vi.fn().mockResolvedValue("test-version"),
        log: vi.fn(),
        openProject: vi.fn().mockResolvedValue(null),
        saveProject: vi.fn().mockResolvedValue(null),
        selectAudioFile: vi.fn().mockResolvedValue(null),
        onMenuCommand: vi.fn(() => () => {}),
        getUserSettings: vi.fn().mockResolvedValue({ uiSkin: "default" }),
        updateUserSettings: vi.fn().mockResolvedValue({ uiSkin: "animal-island" })
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loads the UI skin and persists skin changes", async () => {
    render(
      <RuntimeProvider>
        <UiSettingsProvider>
          <Probe />
        </UiSettingsProvider>
      </RuntimeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("default")).toBeTruthy();
    });

    await userEvent.click(screen.getByRole("button", { name: "Switch" }));

    await waitFor(() => {
      expect(screen.getByText("animal-island")).toBeTruthy();
    });
    expect(window.ziqiApp!.updateUserSettings).toHaveBeenCalledWith({
      uiSkin: "animal-island"
    });
  });
});
