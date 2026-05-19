import { describe, expect, it, vi } from "vitest";
import { getSkinDefinition, skinDefinitions } from "./registry";

vi.mock("animal-island-ui", () => ({ Button: "button", Card: "div" }));
vi.mock("animal-island-ui/style", () => ({}));

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
