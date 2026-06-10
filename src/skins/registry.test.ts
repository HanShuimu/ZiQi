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
  "--skin-background-glow-primary",
  "--skin-background-glow-secondary",
  "--analysis-playhead",
  "--analysis-hover",
  "--analysis-time-grid",
  "--analysis-bar-grid",
  "--analysis-waveform-start",
  "--analysis-waveform-end",
  "--analysis-spectrogram-bg",
  "--analysis-axis-bg",
  "--analysis-axis-white-key",
  "--analysis-axis-black-key",
  "--analysis-piano-active-fill"
];

const tokenFiles = [
  "src/skins/default/tokens.css",
  "src/skins/animalIsland/tokens.css"
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
  for (const tokenFile of tokenFiles) {
    it(`${tokenFile} defines required UI and analysis tokens`, () => {
      const css = readFileSync(tokenFile, "utf8");

      for (const token of requiredTokens) {
        expect(css).toMatch(tokenDeclarationPattern(token));
      }
    });
  }

  it("defines every non-local styles.css token in both skins", () => {
    const stylesCss = readFileSync("src/styles.css", "utf8");
    const localTokens = extractCustomPropertyDeclarations(stylesCss);
    const consumedTokens = [...extractVarReferences(stylesCss)]
      .filter((token) => !localTokens.has(token))
      .sort();

    for (const tokenFile of tokenFiles) {
      const tokenCss = readFileSync(tokenFile, "utf8");

      for (const token of consumedTokens) {
        expect(tokenCss).toMatch(tokenDeclarationPattern(token));
      }
    }
  });

  it("preserves tokenized visual values from the fixed CSS", () => {
    expect(readTokenValue("src/skins/default/tokens.css", "--skin-control-selected-bg")).toBe(
      "#8b4a14"
    );

    for (const tokenFile of tokenFiles) {
      expect(readTokenValue(tokenFile, "--analysis-piano-active-fill")).toBe(
        "rgba(56, 189, 248, 0.2)"
      );
    }
  });

  it("uses generic skin background glow tokens", () => {
    const stylesCss = readFileSync("src/styles.css", "utf8");

    expect(stylesCss).not.toMatch(/--animal-island-background-glow/);
    expect(stylesCss).toMatch(tokenReferencePattern("--skin-background-glow-primary"));
    expect(stylesCss).toMatch(tokenReferencePattern("--skin-background-glow-secondary"));
  });

  it("keeps style token lint case-insensitive and deterministic", () => {
    const lintScript = readFileSync("scripts/lint-style-tokens.mjs", "utf8");

    expect(lintScript).toContain(
      "const colorPattern = /#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\(/i;"
    );
    expect(lintScript).toContain(
      ".sort((left, right) => left.name.localeCompare(right.name))"
    );
  });
});

function extractCustomPropertyDeclarations(css: string) {
  return new Set(
    [...css.matchAll(/(^|[;{\s])(--[A-Za-z0-9-]+)\s*:/g)].map((match) => match[2])
  );
}

function extractVarReferences(css: string) {
  return new Set(
    [...css.matchAll(/var\(\s*(--[A-Za-z0-9-]+)\b/g)].map((match) => match[1])
  );
}

function readTokenValue(tokenFile: string, token: string) {
  const css = readFileSync(tokenFile, "utf8");
  const match = css.match(new RegExp(`${escapeRegex(token)}\\s*:\\s*([^;]+);`));

  if (!match) {
    throw new Error(`${tokenFile} does not define ${token}`);
  }

  return match[1].trim();
}

function tokenDeclarationPattern(token: string) {
  return new RegExp(`${escapeRegex(token)}\\s*:`);
}

function tokenReferencePattern(token: string) {
  return new RegExp(`var\\(\\s*${escapeRegex(token)}\\b`);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
