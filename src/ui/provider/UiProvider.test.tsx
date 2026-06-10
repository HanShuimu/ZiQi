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

  it("connects NumberField hint text to the input description", () => {
    renderWithDefaultSkin(
      <NumberField
        label="Tempo with hint"
        value={120}
        hint="Whole beats per minute"
        onChange={vi.fn()}
      />
    );

    const input = screen.getByRole("spinbutton", { name: "Tempo with hint" });
    const hint = screen.getByText("Whole beats per minute");

    expect(hint.id).not.toBe("");
    expect(input.getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("ignores non-finite NumberField changes", () => {
    const onChange = vi.fn();

    renderWithDefaultSkin(<NumberField label="Invalid tempo" value={120} onChange={onChange} />);

    const input = screen.getByRole("spinbutton", { name: "Invalid tempo" });
    Object.defineProperty(input, "valueAsNumber", {
      configurable: true,
      value: Number.NaN
    });

    fireEvent.change(input);

    expect(onChange).not.toHaveBeenCalled();
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

  it("connects SliderField hint text to the input description", () => {
    renderWithDefaultSkin(
      <SliderField
        label="Zoom with hint"
        value={4}
        min={1}
        max={8}
        step={1}
        hint="Controls horizontal scale"
        onChange={vi.fn()}
      />
    );

    const input = screen.getByRole("slider", { name: "Zoom with hint" });
    const hint = screen.getByText("Controls horizontal scale");

    expect(hint.id).not.toBe("");
    expect(input.getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("passes SliderField ariaValueText to the range input", () => {
    renderWithDefaultSkin(
      <SliderField
        label="Zoom with aria text"
        value={4}
        min={1}
        max={8}
        step={1}
        ariaValueText="Four bars"
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole("slider", { name: "Zoom with aria text" }).getAttribute("aria-valuetext")
    ).toBe("Four bars");
  });

  it("ignores non-finite SliderField changes", () => {
    const onChange = vi.fn();

    renderWithDefaultSkin(
      <SliderField label="Invalid zoom" value={4} min={1} max={8} step={1} onChange={onChange} />
    );

    const input = screen.getByRole("slider", { name: "Invalid zoom" });
    Object.defineProperty(input, "valueAsNumber", {
      configurable: true,
      value: Number.NaN
    });

    fireEvent.change(input);

    expect(onChange).not.toHaveBeenCalled();
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

  it("reports numeric SegmentedControl option values as numbers", () => {
    const onChange = vi.fn();

    renderWithDefaultSkin(
      <SegmentedControl
        ariaLabel="Grid density"
        value={1}
        options={[
          { label: "One", value: 1 },
          { label: "Two", value: 2 }
        ]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Two" }));

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("renders Toggle with accessible label and reports checked changes", () => {
    const onChange = vi.fn();

    renderWithDefaultSkin(<Toggle label="Loop playback" checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Loop playback" }));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("connects Toggle hint text to the input description", () => {
    renderWithDefaultSkin(
      <Toggle
        label="Loop playback with hint"
        checked={false}
        hint="Repeats the active loop range"
        onChange={vi.fn()}
      />
    );

    const input = screen.getByRole("checkbox", { name: "Loop playback with hint" });
    const hint = screen.getByText("Repeats the active loop range");

    expect(hint.id).not.toBe("");
    expect(input.getAttribute("aria-describedby")).toBe(hint.id);
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
