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
        ruleId: "architecture/no-restricted-project-imports"
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
        ruleId: "architecture/no-restricted-project-imports"
      })
    );
  });

  it("blocks core from importing services through deep relative paths", async () => {
    const messages = await lintText({
      filePath: "src/core/domain/deep/model.ts",
      code:
        'import { createBrowserWaveformService } from "../../../services/audio/browserWaveformService";\nexport const value = createBrowserWaveformService;\n'
    });

    expect(messages).toContainEqual(
      expect.objectContaining({
        ruleId: "architecture/no-restricted-project-imports"
      })
    );
  });

  it("blocks services from importing app through deep relative paths", async () => {
    const messages = await lintText({
      filePath: "src/services/audio/deep/service.ts",
      code:
        'import { createRuntime } from "../../../app/runtime";\nexport const value = createRuntime;\n'
    });

    expect(messages).toContainEqual(
      expect.objectContaining({
        ruleId: "architecture/no-restricted-project-imports"
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
    expect(messages).not.toContainEqual(
      expect.objectContaining({
        ruleId: "architecture/no-restricted-project-imports"
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

  it("allows concrete skin adapters to import concrete skin libraries", async () => {
    const messages = await lintText({
      filePath: "src/skins/animalIsland/adapter.tsx",
      code:
        'import { Button } from "animal-island-ui";\nimport "animal-island-ui/style";\nexport const value = Button;\n'
    });

    expect(messages).not.toContainEqual(
      expect.objectContaining({
        ruleId: "architecture/no-business-skin-imports"
      })
    );
  });

  it("blocks raw controls across business UI scope", async () => {
    const businessPaths = [
      "src/App.tsx",
      "src/app/session/View.tsx",
      "src/components/LegacyControl.tsx",
      "src/features/spectrogramViewer/Control.tsx",
      "src/workspaces/transcription/Workspace.tsx"
    ];
    const rawTags = ["button", "input", "select", "textarea"];

    for (const filePath of businessPaths) {
      for (const tag of rawTags) {
        const messages = await lintText({
          filePath,
          code: `export function Control() {\n  return <${tag} aria-label="Control" />;\n}\n`
        });

        expect(messages).toContainEqual(
          expect.objectContaining({
            ruleId: "architecture/no-raw-business-controls"
          })
        );
      }
    }
  });

  it("allows raw controls in ui primitives", async () => {
    const messages = await lintText({
      filePath: "src/ui/components/Button.tsx",
      code:
        "export function Button() {\n  return <button type=\"button\"><input aria-label=\"Label\" /></button>;\n}\n"
    });

    expect(messages).not.toContainEqual(
      expect.objectContaining({
        ruleId: "architecture/no-raw-business-controls"
      })
    );
  });

  it("allows raw controls in test files", async () => {
    const messages = await lintText({
      filePath: "src/features/spectrogramViewer/Control.test.tsx",
      code: "export function TestControl() {\n  return <button type=\"button\"><input aria-label=\"Label\" /></button>;\n}\n"
    });

    expect(messages).not.toContainEqual(
      expect.objectContaining({
        ruleId: "architecture/no-raw-business-controls"
      })
    );
  });

  it("allows raw controls in skin adapters", async () => {
    const messages = await lintText({
      filePath: "src/skins/default/adapter.tsx",
      code:
        "export function SkinButton() {\n  return <button type=\"button\"><input aria-label=\"Label\" /></button>;\n}\n"
    });

    expect(messages).not.toContainEqual(
      expect.objectContaining({
        ruleId: "architecture/no-raw-business-controls"
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
      expect.objectContaining({
        ruleId: "architecture/no-restricted-project-imports"
      })
    );
  });

  it("blocks features from importing legacy components through deep relative paths", async () => {
    const messages = await lintText({
      filePath: "src/features/example/deep/View.tsx",
      code: 'import { WorkbenchShell } from "../../../components/WorkbenchShell";\nexport const value = WorkbenchShell;\n'
    });

    expect(messages).toContainEqual(
      expect.objectContaining({
        ruleId: "architecture/no-restricted-project-imports"
      })
    );
  });

  it("blocks electron/platform from importing src renderer files", async () => {
    const messages = await lintText({
      filePath: "electron/platform/ipc/settingsHandlers.ts",
      code: 'import { App } from "../../../src/App";\nexport const value = App;\n'
    });

    expect(messages).toContainEqual(
      expect.objectContaining({
        ruleId: "architecture/no-restricted-project-imports"
      })
    );
  });

  it("allows workspaces to import features", async () => {
    const messages = await lintText({
      filePath: "src/workspaces/transcription/TranscriptionWorkspace.tsx",
      code: 'import { ProjectSidebar } from "../../features/projectSidebar";\nexport const value = ProjectSidebar;\n'
    });

    expect(messages).not.toContainEqual(
      expect.objectContaining({
        ruleId: "architecture/no-restricted-project-imports"
      })
    );
  });

  it("ignores files under .worktrees", async () => {
    const ignored = await eslint.isPathIgnored(
      path.join(process.cwd(), ".worktrees/example/src/App.tsx")
    );

    expect(ignored).toBe(true);
  });
});

async function lintText({ filePath, code }) {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(process.cwd(), filePath)
  });

  return result.messages;
}
