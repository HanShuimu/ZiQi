import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { getSkinDefinition, skinDefinitions } from "./registry";

vi.mock("animal-island-ui", () => ({ Button: "button", Card: "div" }));
vi.mock("animal-island-ui/style", () => ({}));

const requiredTokens = [
  "--skin-focus-ring",
  "--skin-danger",
  "--skin-control-selected-bg",
  "--skin-control-selected-text",
  "--analysis-playhead",
  "--analysis-hover",
  "--analysis-time-grid",
  "--analysis-bar-grid",
  "--analysis-waveform-start",
  "--analysis-waveform-end",
  "--analysis-spectrogram-bg",
  "--analysis-axis-bg",
  "--analysis-axis-white-key",
  "--analysis-axis-black-key"
];

describe("skin registry", () => {
  it("registers default and animal island skins", () => {
    expect(skinDefinitions.map((skin) => [skin.id, skin.label])).toEqual([
      ["default", "Default"],
      ["animal-island", "Animal Island"]
    ]);
  });

  it("falls back to default for unknown skin ids", () => {
    expect(getSkinDefinition("missing").id).toBe("default");
  });
});

describe("skin token coverage", () => {
  for (const tokenFile of [
    "src/skins/default/tokens.css",
    "src/skins/animalIsland/tokens.css"
  ]) {
    it(`${tokenFile} defines required UI and analysis tokens`, () => {
      const css = readFileSync(tokenFile, "utf8");

      for (const token of requiredTokens) {
        expect(css).toContain(token);
      }
    });
  }
});
