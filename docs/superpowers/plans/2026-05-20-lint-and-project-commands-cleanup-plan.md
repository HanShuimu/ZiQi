# Lint And Project Commands Cleanup Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `npm run lint` pass in the current workspace and split the oversized `projectCommands.ts` command module into focused command files.

**Architecture:** Fix lint at the boundary layer first so it verifies only the active workspace and recognizes project paths robustly under sandboxed execution. Then split app project commands by use case while preserving the existing AppSessionProvider contract.

**Tech Stack:** ESLint flat config, Vitest, React 19, TypeScript 5.8, Vite 7.

---

## Current Evidence

Fresh verification after `npm install`:

- `npm test` exits `0`: `20` test files and `147` tests pass.
- `npm run lint` fails.
- Lint failure includes `.worktrees/**`, so ESLint ignore coverage is incomplete.
- Lint failure reports `architecture/no-business-skin-imports` inside `src/skins/animalIsland/adapter.tsx`, which should be an allowed importer. This indicates the local architecture plugin path normalization is not robust under the current sandbox path shape.
- `src/app/commands/projectCommands.ts` is about `241` lines and combines import audio, save project, open project, and workspace patching.

## File Structure

- Modify: `eslint.config.js`
  - Ignore `.worktrees/**` and nested build outputs.
  - Normalize project paths by detecting `/src/` and `/electron/` segments rather than relying only on `path.relative(workspaceRoot, filePath)`.
  - Keep `src/skins/**` allowed to import concrete skin libraries.
- Modify: `eslint.config.test.mjs`
  - Add regression coverage for skin adapter imports under normal paths.
  - Add regression coverage for worktree paths being ignored if practical through ESLint API.
- Create: `src/app/commands/projectCommandTypes.ts`
  - Shared dependency interface for project command factories.
- Create: `src/app/commands/importAudioCommand.ts`
  - Import-audio use case.
- Create: `src/app/commands/saveProjectCommand.ts`
  - Save-project use case.
- Create: `src/app/commands/openProjectCommand.ts`
  - Open-project use case.
- Create: `src/app/commands/workspaceCommand.ts`
  - Workspace patch use case.
- Modify: `src/app/commands/projectCommands.ts`
  - Become a small aggregator that composes the focused command factories.
- Modify: `src/app/session/AppSessionProvider.tsx`
  - No behavior change expected; imports should continue to use `createProjectCommands`.

## Task 1: Fix ESLint Workspace Scoping And Path Normalization

**Files:**
- Modify: `eslint.config.js`
- Modify: `eslint.config.test.mjs`

- [ ] **Step 1: Expand ESLint ignores**

In `eslint.config.js`, change the first config object from:

```js
{
  ignores: ["dist/**", "dist-electron/**", "node_modules/**"]
}
```

to:

```js
{
  ignores: [
    "**/.worktrees/**",
    "**/dist/**",
    "**/dist-electron/**",
    "**/node_modules/**"
  ]
}
```

- [ ] **Step 2: Replace project path normalization**

In `eslint.config.js`, replace `toProjectPath` with this implementation:

```js
function toProjectPath(filePath) {
  if (!filePath || filePath === "<text>") {
    return "";
  }

  const normalized = normalizePath(filePath);
  const srcIndex = normalized.lastIndexOf("/src/");
  if (srcIndex >= 0) {
    return normalized.slice(srcIndex + 1);
  }

  const electronIndex = normalized.lastIndexOf("/electron/");
  if (electronIndex >= 0) {
    return normalized.slice(electronIndex + 1);
  }

  return normalizePath(path.relative(workspaceRoot, filePath));
}
```

This keeps the architecture plugin stable when ESLint reports files through a sandbox path that differs from the config file path.

- [ ] **Step 3: Add skin adapter regression test**

In `eslint.config.test.mjs`, add this test inside `describe("architecture lint boundaries", () => { ... })`:

```js
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
```

- [ ] **Step 4: Add worktree ignore regression test**

In `eslint.config.test.mjs`, add this test:

```js
  it("ignores files under .worktrees", async () => {
    const ignored = await eslint.isPathIgnored(
      path.join(process.cwd(), ".worktrees/example/src/App.tsx")
    );

    expect(ignored).toBe(true);
  });
```

- [ ] **Step 5: Run lint tests**

Run:

```powershell
npm test -- eslint.config.test.mjs
```

Expected: command exits `0`.

- [ ] **Step 6: Run lint**

Run:

```powershell
npm run lint
```

Expected: command exits `0`, or only warnings remain. If errors remain, fix the rule or source issue directly; do not disable architecture rules broadly.

- [ ] **Step 7: Commit lint cleanup**

Run:

```powershell
git add -- eslint.config.js eslint.config.test.mjs
git commit -m "Fix architecture lint workspace scoping"
```

Expected: commit succeeds with only lint config/test changes.

## Task 2: Split Project Command Dependencies

**Files:**
- Create: `src/app/commands/projectCommandTypes.ts`
- Modify: `src/app/commands/projectCommands.ts`

- [ ] **Step 1: Create shared project command types**

Create `src/app/commands/projectCommandTypes.ts`:

```ts
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { SpectrogramOverview, WaveformOverview } from "../../core/audio/types";
import type { ProjectSummary } from "../../core/project/types";
import type { SpectrogramService } from "../../services/audio/browserSpectrogramService";
import type { WaveformService } from "../../services/audio/browserWaveformService";
import type { ProjectAudioFacade } from "../../services/projectAudio/interfaces";
import type { ProjectLocation } from "../session/types";

export interface ProjectCommandDependencies {
  project: ProjectSummary | null;
  projectLocation: ProjectLocation | null;
  activePlaybackUrl: MutableRefObject<string | null>;
  audioFacade: ProjectAudioFacade;
  waveformService: WaveformService;
  spectrogramService: SpectrogramService;
  setProject: Dispatch<SetStateAction<ProjectSummary | null>>;
  setProjectLocation: Dispatch<SetStateAction<ProjectLocation | null>>;
  setWaveformOverview: Dispatch<SetStateAction<WaveformOverview | null>>;
  setSpectrogramOverview: Dispatch<SetStateAction<SpectrogramOverview | null>>;
  setIsImporting: Dispatch<SetStateAction<boolean>>;
  setIsOpeningProject: Dispatch<SetStateAction<boolean>>;
  setIsSavingProject: Dispatch<SetStateAction<boolean>>;
  setImportError: Dispatch<SetStateAction<string | null>>;
}
```

- [ ] **Step 2: Update `projectCommands.ts` imports**

In `src/app/commands/projectCommands.ts`, remove the local `ProjectCommandDependencies` interface and React/core/service imports that are only needed by individual command implementations.

Keep only:

```ts
import type { WorkspaceState } from "../../core/project/types";
import { createImportAudioCommand } from "./importAudioCommand";
import { createOpenProjectCommand } from "./openProjectCommand";
import type { ProjectCommandDependencies } from "./projectCommandTypes";
import { createSaveProjectCommand } from "./saveProjectCommand";
import { createUpdateWorkspaceCommand } from "./workspaceCommand";
```

- [ ] **Step 3: Replace project command aggregator**

Replace `createProjectCommands` in `src/app/commands/projectCommands.ts` with:

```ts
export function createProjectCommands(dependencies: ProjectCommandDependencies) {
  const importAudio = createImportAudioCommand(dependencies);
  const openProject = createOpenProjectCommand(dependencies);
  const saveProject = createSaveProjectCommand(dependencies);
  const updateWorkspace = createUpdateWorkspaceCommand(dependencies);

  return {
    importAudio,
    saveProject,
    openProject,
    updateWorkspace: (workspacePatch: Partial<WorkspaceState>) =>
      updateWorkspace(workspacePatch)
  };
}
```

- [ ] **Step 4: Run focused typecheck**

Run:

```powershell
npm run build
```

Expected: build may fail because the command implementation files do not exist yet. The failure should name missing imports for `importAudioCommand`, `openProjectCommand`, `saveProjectCommand`, or `workspaceCommand`.

## Task 3: Extract Import Audio Command

**Files:**
- Create: `src/app/commands/importAudioCommand.ts`
- Modify: `src/app/commands/projectCommands.ts`

- [ ] **Step 1: Create import audio command file**

Create `src/app/commands/importAudioCommand.ts`:

```ts
import { createProjectFromAudio } from "../../core/project/createProjectFromAudio";
import { normalizeWorkspaceState } from "../../core/workspace/workspaceState";
import type { ProjectCommandDependencies } from "./projectCommandTypes";

export function createImportAudioCommand({
  activePlaybackUrl,
  audioFacade,
  waveformService,
  spectrogramService,
  setProject,
  setProjectLocation,
  setWaveformOverview,
  setSpectrogramOverview,
  setIsImporting,
  setImportError
}: ProjectCommandDependencies) {
  return async function importAudio() {
    setIsImporting(true);
    setImportError(null);

    try {
      const selectedFile = await window.ziqiApp.selectAudioFile();
      if (!selectedFile) {
        return;
      }

      const nextPlaybackUrl = URL.createObjectURL(new Blob([selectedFile.audioData]));
      const spectrogramAudioData = selectedFile.audioData.slice(0);
      try {
        const nextWaveformOverview =
          await waveformService.buildOverviewFromAudioData(selectedFile.audioData);
        const nextSpectrogramOverview =
          await spectrogramService.buildOverviewFromAudioData(spectrogramAudioData);
        const metadata = await audioFacade.source.load(selectedFile.filePath, nextPlaybackUrl);
        const importedProject = createProjectFromAudio({
          filePath: selectedFile.filePath,
          metadata
        });
        setProject({
          ...importedProject,
          workspace: normalizeWorkspaceState(importedProject.workspace, metadata.durationMs)
        });
        await audioFacade.playback.setPlaybackRate(1);
        await audioFacade.playback.clearLoopRange();
        await audioFacade.playback.seek(0);
        setProjectLocation(null);
        setWaveformOverview(nextWaveformOverview);
        setSpectrogramOverview(nextSpectrogramOverview);
        if (activePlaybackUrl.current) {
          URL.revokeObjectURL(activePlaybackUrl.current);
        }
        activePlaybackUrl.current = nextPlaybackUrl;
      } catch (error) {
        URL.revokeObjectURL(nextPlaybackUrl);
        throw error;
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to import audio.");
    } finally {
      setIsImporting(false);
    }
  };
}
```

- [ ] **Step 2: Remove old `importAudio` local function**

Delete the old `async function importAudio(...)` implementation from `src/app/commands/projectCommands.ts`.

- [ ] **Step 3: Run focused app tests**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: command exits `0`.

## Task 4: Extract Save, Open, And Workspace Commands

**Files:**
- Create: `src/app/commands/saveProjectCommand.ts`
- Create: `src/app/commands/openProjectCommand.ts`
- Create: `src/app/commands/workspaceCommand.ts`
- Modify: `src/app/commands/projectCommands.ts`

- [ ] **Step 1: Create save project command file**

Create `src/app/commands/saveProjectCommand.ts`:

```ts
import type { ProjectCommandDependencies } from "./projectCommandTypes";

export function createSaveProjectCommand({
  project,
  projectLocation,
  setProject,
  setProjectLocation,
  setIsSavingProject,
  setImportError
}: ProjectCommandDependencies) {
  return async function saveProject() {
    if (!project) {
      return;
    }

    setIsSavingProject(true);
    setImportError(null);

    try {
      const savedProject = await window.ziqiApp.saveProject({
        project,
        ...(projectLocation ?? {})
      });
      if (!savedProject) {
        return;
      }

      setProject(savedProject.project);
      setProjectLocation({
        projectFilePath: savedProject.projectFilePath,
        projectRootPath: savedProject.projectRootPath
      });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to save project.");
    } finally {
      setIsSavingProject(false);
    }
  };
}
```

- [ ] **Step 2: Create open project command file**

Create `src/app/commands/openProjectCommand.ts`:

```ts
import { normalizeWorkspaceState } from "../../core/workspace/workspaceState";
import type { ProjectCommandDependencies } from "./projectCommandTypes";

export function createOpenProjectCommand({
  project,
  activePlaybackUrl,
  audioFacade,
  waveformService,
  spectrogramService,
  setProject,
  setProjectLocation,
  setWaveformOverview,
  setSpectrogramOverview,
  setIsOpeningProject,
  setImportError
}: ProjectCommandDependencies) {
  return async function openProject() {
    setIsOpeningProject(true);
    setImportError(null);

    try {
      const openedProject = await window.ziqiApp.openProject();
      if (!openedProject) {
        return;
      }

      const previousPlaybackUrl = activePlaybackUrl.current;
      const nextPlaybackUrl = URL.createObjectURL(new Blob([openedProject.audioData]));
      const spectrogramAudioData = openedProject.audioData.slice(0);
      try {
        const nextWaveformOverview =
          await waveformService.buildOverviewFromAudioData(openedProject.audioData);
        const nextSpectrogramOverview =
          await spectrogramService.buildOverviewFromAudioData(spectrogramAudioData);
        await audioFacade.source.load(openedProject.project.sourceAudio.filePath, nextPlaybackUrl);
        const normalizedProject = {
          ...openedProject.project,
          workspace: normalizeWorkspaceState(
            openedProject.project.workspace,
            openedProject.project.sourceAudio.durationMs
          )
        };
        await audioFacade.playback.setPlaybackRate(normalizedProject.workspace.playbackRate);
        if (normalizedProject.workspace.loopRange) {
          await audioFacade.playback.setLoopRange(
            normalizedProject.workspace.loopRange.startMs,
            normalizedProject.workspace.loopRange.endMs
          );
        } else {
          await audioFacade.playback.clearLoopRange();
        }
        await audioFacade.playback.seek(0);
        await window.ziqiApp.activateOpenedProject({
          projectFilePath: openedProject.projectFilePath,
          projectRootPath: openedProject.projectRootPath
        });
        setProject(normalizedProject);
        setWaveformOverview(nextWaveformOverview);
        setSpectrogramOverview(nextSpectrogramOverview);
        setProjectLocation({
          projectFilePath: openedProject.projectFilePath,
          projectRootPath: openedProject.projectRootPath
        });
        if (activePlaybackUrl.current) {
          URL.revokeObjectURL(activePlaybackUrl.current);
        }
        activePlaybackUrl.current = nextPlaybackUrl;
      } catch (error) {
        URL.revokeObjectURL(nextPlaybackUrl);
        try {
          if (previousPlaybackUrl && project) {
            await audioFacade.source.load(project.sourceAudio.filePath, previousPlaybackUrl);
            await audioFacade.playback.setPlaybackRate(project.workspace.playbackRate);
            if (project.workspace.loopRange) {
              await audioFacade.playback.setLoopRange(
                project.workspace.loopRange.startMs,
                project.workspace.loopRange.endMs
              );
            } else {
              await audioFacade.playback.clearLoopRange();
            }
          } else {
            await audioFacade.source.unload();
          }
        } catch {
          // Keep the original open failure as the user-facing error.
        }
        throw error;
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to open project.");
    } finally {
      setIsOpeningProject(false);
    }
  };
}
```

- [ ] **Step 3: Create workspace command file**

Create `src/app/commands/workspaceCommand.ts`:

```ts
import type { WorkspaceState } from "../../core/project/types";
import type { ProjectCommandDependencies } from "./projectCommandTypes";

export function createUpdateWorkspaceCommand({ setProject }: ProjectCommandDependencies) {
  return function updateWorkspace(workspacePatch: Partial<WorkspaceState>) {
    setProject((currentProject) => {
      if (!currentProject) {
        return currentProject;
      }

      return {
        ...currentProject,
        workspace: {
          ...currentProject.workspace,
          ...workspacePatch
        }
      };
    });
  };
}
```

- [ ] **Step 4: Remove old local functions from aggregator**

Delete these local functions from `src/app/commands/projectCommands.ts`:

```text
saveProject
openProject
updateWorkspace
```

Expected final file size:

```powershell
(Get-Content 'src/app/commands/projectCommands.ts').Count
```

Expected output: below `35`.

- [ ] **Step 5: Run app tests**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: command exits `0`.

## Task 5: Final Verification

**Files:**
- No planned file changes.

- [ ] **Step 1: Verify command file sizes**

Run:

```powershell
(Get-Content 'src/app/commands/projectCommands.ts').Count
(Get-Content 'src/app/commands/importAudioCommand.ts').Count
(Get-Content 'src/app/commands/saveProjectCommand.ts').Count
(Get-Content 'src/app/commands/openProjectCommand.ts').Count
(Get-Content 'src/app/commands/workspaceCommand.ts').Count
```

Expected:

```text
projectCommands.ts below 35
importAudioCommand.ts below 90
saveProjectCommand.ts below 60
openProjectCommand.ts below 130
workspaceCommand.ts below 35
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm run lint
npm test
npm run build
```

Expected: all three commands exit `0`.

- [ ] **Step 3: Inspect git status**

Run:

```powershell
git status --short
```

Expected: no output after commits, or only intentional uncommitted files if the executor has not committed yet.

- [ ] **Step 4: Commit command cleanup**

If command cleanup changes are not committed yet, run:

```powershell
git add -- src/app/commands src/app/session eslint.config.js eslint.config.test.mjs
git commit -m "Split project session commands"
```

Expected: commit succeeds with only lint and app command cleanup files.

## Self-Review

- Spec coverage: This plan addresses the current lint failure causes and the oversized `projectCommands.ts` module.
- Scope control: The plan does not change user-facing behavior or UI. It only fixes verification boundaries and splits app command implementation by use case.
- Completeness scan: No unfinished markers, vague filler steps, or missing verification commands remain.
