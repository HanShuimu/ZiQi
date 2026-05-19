import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UiAdapter } from "../types";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import { UiProvider } from "./UiProvider";

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
});
