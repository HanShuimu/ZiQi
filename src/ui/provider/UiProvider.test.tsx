import type { ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  Field,
  NumberField,
  Panel,
  PanelSection,
  SegmentedControl,
  SliderField,
  Toggle,
  UiProvider
} from "../../ui";
import { getSkinDefinition } from "../../skins/registry";
import type { UiAdapter } from "../../ui";

function createAdapter(label: string): UiAdapter {
  return {
    Background: () => <div data-testid={`${label}-background`} />,
    Button: ({ children, onClick }) => (
      <button data-testid={`${label}-button`} onClick={onClick}>
        {children}
      </button>
    ),
    Panel: ({ children }) => <section data-testid={`${label}-panel`}>{children}</section>,
    Tabs: ({ children }) => <nav data-testid={`${label}-tabs`}>{children}</nav>,
    ListItem: ({ children }) => <div data-testid={`${label}-list-item`}>{children}</div>
  };
}

function renderWithDefaultSkin(ui: ReactElement) {
  const skin = getSkinDefinition("default");

  return render(
    <UiProvider skinId={skin.id} adapter={skin.adapter}>
      {ui}
    </UiProvider>
  );
}

describe("UiProvider", () => {
  it("renders active adapter background and data-skin", () => {
    render(
      <UiProvider skinId="animal-island" adapter={createAdapter("animal")}>
        <div>Workbench</div>
      </UiProvider>
    );

    expect(screen.getByTestId("animal-background")).toBeTruthy();
    expect(screen.getByText("Workbench").closest("[data-skin]")?.getAttribute("data-skin")).toBe(
      "animal-island"
    );
  });

  it("forwards primitive props to the active adapter", async () => {
    const onClick = vi.fn();

    render(
      <UiProvider skinId="default" adapter={createAdapter("default")}>
        <Panel>
          <Button onClick={onClick}>Save</Button>
        </Panel>
      </UiProvider>
    );

    screen.getByTestId("default-button").click();

    expect(screen.getByTestId("default-panel")).toBeTruthy();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders Field label and children", () => {
    renderWithDefaultSkin(
      <Field label="Project name">
        <input />
      </Field>
    );

    expect(screen.getByText("Project name")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Project name" })).toBeTruthy();
  });

  it("renders NumberField with accessible label and reports numeric changes", () => {
    const onChange = vi.fn();

    renderWithDefaultSkin(<NumberField label="Tempo" value={120} onChange={onChange} />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Tempo" }), {
      target: { value: "128" }
    });

    expect(onChange).toHaveBeenCalledWith(128);
  });

  it("renders SliderField with accessible label and reports numeric changes", () => {
    const onChange = vi.fn();

    renderWithDefaultSkin(
      <SliderField label="Zoom" value={4} min={1} max={8} step={1} onChange={onChange} />
    );

    fireEvent.change(screen.getByRole("slider", { name: "Zoom" }), {
      target: { value: "6" }
    });

    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("renders SegmentedControl options, selected state, and reports option changes", () => {
    const onChange = vi.fn();

    renderWithDefaultSkin(
      <SegmentedControl
        ariaLabel="Playback speed"
        value="normal"
        options={[
          { label: "Slow", value: "slow" },
          { label: "Normal", value: "normal" },
          { label: "Fast", value: "fast" }
        ]}
        onChange={onChange}
      />
    );

    expect(screen.getByRole("group", { name: "Playback speed" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Normal" }).getAttribute("aria-pressed")).toBe(
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Fast" }));

    expect(onChange).toHaveBeenCalledWith("fast");
  });

  it("renders Toggle with accessible label and reports checked changes", () => {
    const onChange = vi.fn();

    renderWithDefaultSkin(<Toggle label="Loop playback" checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Loop playback" }));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders PanelSection label, title, and children", () => {
    renderWithDefaultSkin(
      <PanelSection label="Inspector controls" title="Inspector">
        <button>Apply</button>
      </PanelSection>
    );

    expect(screen.getByText("Inspector controls")).toBeTruthy();
    expect(screen.getByText("Inspector")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();
  });
});
