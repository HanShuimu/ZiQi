import { ESLint } from "eslint";
import path from "node:path";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

describe("architecture lint boundaries", () => {
  it("blocks React imports from core", async () => {
    const messages = await lintText({
      filePath: "src/core/project/model.ts",
      code: 'import { useMemo } from "react";\nexport const value = useMemo;\n'
    });

    expect(messages).toContainEqual(
      expect.objectContaining({
        ruleId: "no-restricted-imports"
      })
    );
  });

  it("blocks browser runtime globals from core", async () => {
    const messages = await lintText({
      filePath: "src/core/audio/runtime.ts",
      code: "export const audioContext = new AudioContext();\n"
    });

    expect(messages).toContainEqual(
      expect.objectContaining({
        ruleId: "no-restricted-globals"
      })
    );
  });

  it("blocks services from importing concrete features", async () => {
    const messages = await lintText({
      filePath: "src/services/playback/createPlaybackService.ts",
      code:
        'import { AnnotationEditor } from "../../features/annotationEditor";\nexport const value = AnnotationEditor;\n'
    });

    expect(messages).toContainEqual(
      expect.objectContaining({
        ruleId: "no-restricted-imports"
      })
    );
  });

  it("blocks capabilities from importing workspaces", async () => {
    const messages = await lintText({
      filePath: "src/capabilities/timeRangeSelection/index.ts",
      code:
        'import { TranscriptionWorkspace } from "../../workspaces/transcription";\nexport const value = TranscriptionWorkspace;\n'
    });

    expect(messages).toContainEqual(
      expect.objectContaining({
        ruleId: "no-restricted-imports"
      })
    );
  });

  it("blocks feature-to-feature imports", async () => {
    const messages = await lintText({
      filePath: "src/features/annotationEditor/components/Editor.tsx",
      code:
        'import { SpectrogramViewer } from "../../spectrogramViewer";\nexport const value = SpectrogramViewer;\n'
    });

    expect(messages).toContainEqual(
      expect.objectContaining({
        ruleId: "architecture/no-cross-feature-imports"
      })
    );
  });

  it("allows features to import capabilities", async () => {
    const messages = await lintText({
      filePath: "src/features/annotationEditor/components/Editor.tsx",
      code:
        'import { createRange } from "../../../capabilities/timeRangeSelection";\nexport const value = createRange;\n'
    });

    expect(messages).not.toContainEqual(
      expect.objectContaining({
        ruleId: "architecture/no-cross-feature-imports"
      })
    );
  });

  it("blocks business modules from importing concrete skins", async () => {
    const messages = await lintText({
      filePath: "src/features/spectrogramViewer/components/View.tsx",
      code:
        'import { animalIslandAdapter } from "../../../skins/animalIsland/adapter";\nexport const value = animalIslandAdapter;\n'
    });

    expect(messages).toContainEqual(
      expect.objectContaining({
        ruleId: "architecture/no-business-skin-imports"
      })
    );
  });

  it("allows skin adapters to import their concrete UI library", async () => {
    const messages = await lintText({
      filePath: "src/skins/animalIsland/adapter.tsx",
      code:
        'import { Button } from "animal-island-ui";\nexport const value = Button;\n'
    });

    expect(messages).not.toContainEqual(
      expect.objectContaining({
        ruleId: "architecture/no-business-skin-imports"
      })
    );
  });

  it("blocks services from importing React", async () => {
    const messages = await lintText({
      filePath: "src/services/playback/createPlaybackService.ts",
      code: 'import { useState } from "react";\nexport const value = useState;\n'
    });

    expect(messages).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports" })
    );
  });

  it("blocks features from importing legacy components", async () => {
    const messages = await lintText({
      filePath: "src/features/projectSidebar/ProjectSidebar.tsx",
      code: 'import { WorkbenchShell } from "../../components/WorkbenchShell";\nexport const value = WorkbenchShell;\n'
    });

    expect(messages).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports" })
    );
  });

  it("allows spectrogramViewer to import SpectrogramView during transition", async () => {
    const messages = await lintText({
      filePath: "src/features/spectrogramViewer/SpectrogramViewer.tsx",
      code: 'import { SpectrogramView } from "../../components/SpectrogramView";\nexport const value = SpectrogramView;\n'
    });

    expect(messages).not.toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports" })
    );
  });

  it("blocks electron/platform from importing src renderer files", async () => {
    const messages = await lintText({
      filePath: "electron/platform/ipc/settingsHandlers.ts",
      code: 'import { App } from "../../src/App";\nexport const value = App;\n'
    });

    expect(messages).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports" })
    );
  });

  it("allows workspaces to import features", async () => {
    const messages = await lintText({
      filePath: "src/workspaces/transcription/TranscriptionWorkspace.tsx",
      code: 'import { ProjectSidebar } from "../../features/projectSidebar";\nexport const value = ProjectSidebar;\n'
    });

    expect(messages).not.toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports" })
    );
  });
});

async function lintText({ filePath, code }) {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(process.cwd(), filePath)
  });

  return result.messages;
}
