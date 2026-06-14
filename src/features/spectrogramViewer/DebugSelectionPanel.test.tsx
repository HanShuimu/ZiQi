import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PitchEnergyOverview } from "../../core/audio/types";
import { createMockProjectSummary } from "../../core/project/mockProject";
import type { ProjectSummary } from "../../core/project/types";
import { getSkinDefinition } from "../../skins/registry";
import { UiProvider } from "../../ui";
import { DebugSelectionPanel } from "./DebugSelectionPanel";

describe("DebugSelectionPanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders null when closed", () => {
    const { container } = render(
      <DebugSelectionPanel isOpen={false} project={createMockProjectSummary()} onClose={vi.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("shows the no project status without copy actions", () => {
    renderDebugSelectionPanel(
      <DebugSelectionPanel isOpen={true} project={null} onClose={vi.fn()} />
    );

    expect(screen.getByText("Please open a project first.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copy Text" })).toBeNull();
  });

  it("shows the missing selected range status when a project exists", () => {
    renderDebugSelectionPanel(
      <DebugSelectionPanel isOpen={true} project={createProject()} onClose={vi.fn()} />
    );

    expect(screen.getByText("Please select a time range first.")).toBeTruthy();
  });

  it("shows the selected range and unavailable status without analysis data", () => {
    renderDebugSelectionPanel(
      <DebugSelectionPanel isOpen={true} project={createProjectWithSelection()} onClose={vi.fn()} />
    );

    expect(screen.getByText("analysis unavailable")).toBeTruthy();
    expect(screen.getByText("1.000-2.500")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copy Text" })).toBeNull();
  });

  it("shows generated text, structured JSON, and copy actions when analysis overlaps the selection", () => {
    renderDebugSelectionPanel(
      <DebugSelectionPanel
        isOpen={true}
        project={createProjectWithSelection()}
        pitchEnergyOverview={createPitchEnergyOverview()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Selected range 1.000-2.500")).toBeTruthy();
    expect(screen.getByText("Natural Language")).toBeTruthy();
    expect(screen.getByText("Structured JSON")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy Text" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy JSON" })).toBeTruthy();
    expect(screen.getAllByText(/Demo Track Study/).length).toBeGreaterThan(0);
    expect(screen.getByText(/1.000s to 2.500s/)).toBeTruthy();
    expect(screen.getByText(/"projectName": "Demo Track Study"/)).toBeTruthy();
  });

  it("copies the generated text and JSON", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    renderDebugSelectionPanel(
      <DebugSelectionPanel
        isOpen={true}
        project={createProjectWithSelection()}
        pitchEnergyOverview={createPitchEnergyOverview()}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Copy Text" }));
    await user.click(screen.getByRole("button", { name: "Copy JSON" }));

    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenNthCalledWith(1, expect.stringContaining("Demo Track Study"));
    expect(writeText).toHaveBeenNthCalledWith(2, expect.stringContaining('"projectName": "Demo Track Study"'));
  });

  it("calls onClose from the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderDebugSelectionPanel(
      <DebugSelectionPanel isOpen={true} project={createMockProjectSummary()} onClose={onClose} />
    );

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});

function renderDebugSelectionPanel(ui: React.ReactElement) {
  const skin = getSkinDefinition("default");
  return render(
    <UiProvider skinId={skin.id} adapter={skin.adapter}>
      {ui}
    </UiProvider>
  );
}

function createProject(): ProjectSummary {
  const project = createMockProjectSummary();

  return {
    ...project,
    workspace: {
      ...project.workspace,
      selectedTimeRange: undefined
    }
  };
}

function createProjectWithSelection(): ProjectSummary {
  const project = createMockProjectSummary();

  return {
    ...project,
    workspace: {
      ...project.workspace,
      selectedTimeRange: {
        startMs: 1_000,
        endMs: 2_500
      }
    }
  };
}

function createPitchEnergyOverview(): PitchEnergyOverview {
  return {
    durationMs: 6_000,
    framesPerSecond: 2,
    minMidiNumber: 21,
    maxMidiNumber: 108,
    notesPerFrame: 88,
    frames: [
      {
        startMs: 1_200,
        endMs: 1_700,
        energies: Array.from({ length: 88 }, (_, index) => (index === 39 ? 0.9 : 0))
      }
    ]
  };
}
