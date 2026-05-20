# Long-Term Architecture Refactor Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the long-term ZiQi architecture refactor so app composition, core domain logic, services, reusable capabilities, user-facing features, workspace composition, UI primitives, skins, and Electron platform code have explicit ownership boundaries.

**Architecture:** Execute the refactor as staged, behavior-preserving migrations. Each stage moves one architectural boundary into place, keeps existing tests passing, and ends with a commit before the next stage starts.

**Tech Stack:** Electron 37, React 19, TypeScript 5.8, Vite 7, Vitest, Testing Library, ESLint architecture rules from the lint boundary plan.

---

## Source Specs And Plans

Primary design:

`docs/superpowers/specs/2026-05-20-long-term-architecture-lint-design.md`

First prerequisite plan:

`docs/superpowers/plans/2026-05-20-long-term-architecture-lint-implementation-plan.md`

This master plan assumes the lint implementation plan either has already run or will run first. If `npm run lint` is not available when this plan starts, execute the lint implementation plan before Task 2.

## Current Architecture Gap

The current project is still mostly in prototype layout:

- Present: `src/core`, but only for spectrogram viewport helpers.
- Missing: `src/app`.
- Missing: `src/services`.
- Missing: `src/capabilities`.
- Missing: `src/features`.
- Missing: `src/workspaces`.
- Present: `src/ui` and `src/skins`, already close to target.
- Present: `electron`, but no `electron/platform` decomposition.
- Hotspot: `src/App.tsx` still owns project import/open/save, object URL lifecycle, user settings, skin updates, menu command routing, waveform/spectrogram generation, and playback facade setup.
- Hotspot: `src/components/WorkbenchShell.tsx` still combines app shell layout, project panels, playback wiring, spectrogram workspace, dock panels, and future feature slots.
- Hotspot: `electron/main.ts` still owns startup, protocol handling, menu dispatch, settings IPC, audio file selection, project save/open IPC, and project activation.

The refactor is not complete until these hotspots become composition or registration files rather than business workflow containers.

## Execution Strategy

Use these rules throughout:

- Move one boundary at a time.
- Keep public behavior unchanged unless a task explicitly says otherwise.
- Prefer re-export shims during a move so the diff stays reviewable.
- Run focused tests after each move and the full verification at the end of each task.
- Do not combine unrelated feature work with architecture migration.

## Target End State

```text
src/
  app/
    App.tsx
    AppProviders.tsx
    commands/
    session/
    menu/
  core/
    audio/
    project/
    workspace/
    userSettings/
    spectrogramViewport.ts
  services/
    audio/
    playback/
    projectAudio/
    projectPersistence/
    settings/
  capabilities/
    timelineViewport/
    timeRangeSelection/
  features/
    projectFiles/
    spectrogramViewer/
    playbackControls/
    projectSidebar/
    workbenchDocks/
    skinSwitcher/
  workspaces/
    transcription/
  ui/
  skins/
  types/

electron/
  main.ts
  preload.cts
  platform/
    appLifecycle/
    ipc/
    menu/
    protocol/
    projectFiles/
    userSettings/
```

## Task 1: Complete First Lint Boundary

**Files:**
- Follow: `docs/superpowers/plans/2026-05-20-long-term-architecture-lint-implementation-plan.md`

- [ ] **Step 1: Execute the lint implementation plan if needed**

Run:

```powershell
npm pkg get scripts.lint
```

Expected if already done:

```text
"eslint ."
```

If npm reports no `lint` script, execute every task in:

```text
docs/superpowers/plans/2026-05-20-long-term-architecture-lint-implementation-plan.md
```

- [ ] **Step 2: Verify lint baseline**

Run:

```powershell
npm run lint
```

Expected: command exits `0`.

- [ ] **Step 3: Verify build baseline**

Run:

```powershell
npm run build
```

Expected: command exits `0`.

- [ ] **Step 4: Commit only if the prerequisite plan produced uncommitted changes**

Run:

```powershell
git status --short
```

Expected: no output. If there are lint prerequisite changes, commit them according to the prerequisite plan before continuing.

## Task 2: Move Domain Models Into Core

**Files:**
- Create: `src/core/audio/types.ts`
- Create: `src/core/project/types.ts`
- Create: `src/core/project/createProjectFromAudio.ts`
- Create: `src/core/project/createProjectFromAudio.test.ts`
- Create: `src/core/project/mockProject.ts`
- Create: `src/core/workspace/workspaceState.ts`
- Create: `src/core/workspace/workspaceState.test.ts`
- Create: `src/core/userSettings/types.ts`
- Modify: existing imports from `src/domain/audio/types.ts`
- Modify: existing imports from `src/domain/project/types.ts`
- Modify: existing imports from `src/domain/project/createProjectFromAudio.ts`
- Modify: existing imports from `src/domain/project/mockProject.ts`
- Modify: existing imports from `src/domain/project/workspaceState.ts`
- Modify: existing imports from `src/domain/userSettings/types.ts`
- Replace existing `src/domain/*` files with temporary re-export shims, then remove them after all imports are migrated.

- [ ] **Step 1: Move audio and project types**

Move these files without changing their exported names:

```text
src/domain/audio/types.ts -> src/core/audio/types.ts
src/domain/project/types.ts -> src/core/project/types.ts
src/domain/userSettings/types.ts -> src/core/userSettings/types.ts
```

Keep temporary shims at the old paths:

```ts
export type * from "../../core/audio/types";
```

for `src/domain/audio/types.ts`.

```ts
export type * from "../../core/project/types";
```

for `src/domain/project/types.ts`.

```ts
export * from "../../core/userSettings/types";
```

for `src/domain/userSettings/types.ts`.

- [ ] **Step 2: Move project pure functions and tests**

Move:

```text
src/domain/project/createProjectFromAudio.ts -> src/core/project/createProjectFromAudio.ts
src/domain/project/createProjectFromAudio.test.ts -> src/core/project/createProjectFromAudio.test.ts
src/domain/project/mockProject.ts -> src/core/project/mockProject.ts
src/domain/project/workspaceState.ts -> src/core/workspace/workspaceState.ts
src/domain/project/workspaceState.test.ts -> src/core/workspace/workspaceState.test.ts
```

Update imports inside moved files so they point to core paths:

```ts
import type { AudioMetadata } from "../audio/types";
```

becomes, from `src/core/project/createProjectFromAudio.ts`:

```ts
import type { AudioMetadata } from "../audio/types";
```

and workspace imports from `src/core/project` to `src/core/workspace` use:

```ts
import { createDefaultWorkspaceState } from "../workspace/workspaceState";
```

- [ ] **Step 3: Add temporary shims for moved project functions**

Create these old-path shims:

`src/domain/project/createProjectFromAudio.ts`

```ts
export * from "../../core/project/createProjectFromAudio";
```

`src/domain/project/mockProject.ts`

```ts
export * from "../../core/project/mockProject";
```

`src/domain/project/workspaceState.ts`

```ts
export * from "../../core/workspace/workspaceState";
```

- [ ] **Step 4: Update imports across `src`**

Replace imports so product code uses core paths directly:

```text
../domain/audio/types -> ../core/audio/types
./domain/audio/types -> ./core/audio/types
../domain/project/types -> ../core/project/types
./domain/project/types -> ./core/project/types
../domain/project/createProjectFromAudio -> ../core/project/createProjectFromAudio
./domain/project/createProjectFromAudio -> ./core/project/createProjectFromAudio
../domain/project/mockProject -> ../core/project/mockProject
../domain/project/workspaceState -> ../core/workspace/workspaceState
./domain/project/workspaceState -> ./core/workspace/workspaceState
../domain/userSettings/types -> ../core/userSettings/types
./domain/userSettings/types -> ./core/userSettings/types
```

Use `rg` to confirm:

```powershell
rg "domain/(audio/types|project/types|project/createProjectFromAudio|project/mockProject|project/workspaceState|userSettings/types)" src
```

Expected: no output except old shim files if they are still present.

- [ ] **Step 5: Remove temporary shims once imports are migrated**

Delete:

```text
src/domain/audio/types.ts
src/domain/project/types.ts
src/domain/project/createProjectFromAudio.ts
src/domain/project/createProjectFromAudio.test.ts
src/domain/project/mockProject.ts
src/domain/project/workspaceState.ts
src/domain/project/workspaceState.test.ts
src/domain/userSettings/types.ts
```

Do not delete `src/domain/audio` service implementation files yet.

- [ ] **Step 6: Run focused tests**

Run:

```powershell
npm test -- src/core/project/createProjectFromAudio.test.ts src/core/workspace/workspaceState.test.ts src/core/spectrogramViewport.test.ts
```

Expected: command exits `0`.

- [ ] **Step 7: Run lint and build**

Run:

```powershell
npm run lint
npm run build
```

Expected: both commands exit `0`.

- [ ] **Step 8: Commit core domain migration**

Run:

```powershell
git add -- src
git commit -m "Move domain models into core"
```

Expected: commit succeeds with only core/domain import migration changes.

## Task 3: Move Audio Services Into Services Layer

**Files:**
- Create: `src/services/audio/waveform.ts`
- Create: `src/services/audio/waveform.test.ts`
- Create: `src/services/audio/spectrogram.ts`
- Create: `src/services/audio/spectrogram.test.ts`
- Create: `src/services/audio/audioFileUrl.ts`
- Create: `src/services/audio/audioFileUrl.test.ts`
- Create: `src/services/playback/browserPlaybackService.ts`
- Create: `src/services/playback/browserPlaybackService.test.ts`
- Create: `src/services/projectAudio/browserProjectAudioFacade.ts`
- Create: `src/services/projectAudio/browserProjectAudioFacade.test.ts`
- Create: `src/services/projectAudio/interfaces.ts`
- Create: `src/services/projectAudio/mockFacade.ts`
- Modify: imports from `src/domain/audio/*`
- Delete or shim old `src/domain/audio/*` service files after migration.

- [ ] **Step 1: Move pure audio algorithms to `services/audio`**

Move:

```text
src/domain/audio/waveform.ts -> src/services/audio/waveform.ts
src/domain/audio/waveform.test.ts -> src/services/audio/waveform.test.ts
src/domain/audio/spectrogram.ts -> src/services/audio/spectrogram.ts
src/domain/audio/spectrogram.test.ts -> src/services/audio/spectrogram.test.ts
src/domain/audio/audioFileUrl.ts -> src/services/audio/audioFileUrl.ts
src/domain/audio/audioFileUrl.test.ts -> src/services/audio/audioFileUrl.test.ts
```

Update type imports to use `src/core/audio/types`.

- [ ] **Step 2: Move browser audio adapters**

Move:

```text
src/domain/audio/browserWaveformService.ts -> src/services/audio/browserWaveformService.ts
src/domain/audio/browserWaveformService.test.ts -> src/services/audio/browserWaveformService.test.ts
src/domain/audio/browserSpectrogramService.ts -> src/services/audio/browserSpectrogramService.ts
src/domain/audio/browserSpectrogramService.test.ts -> src/services/audio/browserSpectrogramService.test.ts
src/domain/audio/browserPlaybackService.ts -> src/services/playback/browserPlaybackService.ts
src/domain/audio/browserPlaybackService.test.ts -> src/services/playback/browserPlaybackService.test.ts
src/domain/audio/browserProjectAudioFacade.ts -> src/services/projectAudio/browserProjectAudioFacade.ts
src/domain/audio/browserProjectAudioFacade.test.ts -> src/services/projectAudio/browserProjectAudioFacade.test.ts
src/domain/audio/interfaces.ts -> src/services/projectAudio/interfaces.ts
src/domain/audio/mockFacade.ts -> src/services/projectAudio/mockFacade.ts
```

Use these import directions:

```text
services/audio -> core/audio
services/playback -> core/audio, services/projectAudio interfaces if needed
services/projectAudio -> core/audio, services/audio, services/playback
```

- [ ] **Step 3: Update application and component imports**

Update imports in:

```text
src/App.tsx
src/App.test.tsx
src/components/WorkbenchShell.tsx
src/components/WorkbenchShell.test.tsx
src/components/SpectrogramView.tsx
src/components/SpectrogramView.test.tsx
src/components/spectrogramViewport.ts
src/components/spectrogramViewport.test.ts if still present
```

Expected examples:

```ts
import { createBrowserProjectAudioFacade } from "./services/projectAudio/browserProjectAudioFacade";
import { mockProjectAudioFacade } from "../services/projectAudio/mockFacade";
import type { ProjectAudioFacade } from "../services/projectAudio/interfaces";
import type { SpectrogramOverview, WaveformOverview } from "../core/audio/types";
```

- [ ] **Step 4: Confirm no old audio domain imports remain**

Run:

```powershell
rg "domain/audio" src
```

Expected: no output.

- [ ] **Step 5: Remove empty `src/domain/audio` files**

Delete old files under `src/domain/audio` after imports are migrated.

If `src/domain` becomes empty, delete the empty directory.

- [ ] **Step 6: Run focused service tests**

Run:

```powershell
npm test -- src/services/audio src/services/playback src/services/projectAudio
```

Expected: command exits `0`.

- [ ] **Step 7: Run app behavior tests**

Run:

```powershell
npm test -- src/App.test.tsx src/components/WorkbenchShell.test.tsx src/components/SpectrogramView.test.tsx
```

Expected: command exits `0`.

- [ ] **Step 8: Run lint and build**

Run:

```powershell
npm run lint
npm run build
```

Expected: both commands exit `0`.

- [ ] **Step 9: Commit services migration**

Run:

```powershell
git add -- src
git commit -m "Move audio services into services layer"
```

Expected: commit succeeds with only audio service migration changes.

## Task 4: Extract App Session And Commands

**Files:**
- Create: `src/app/session/AppSessionProvider.tsx`
- Create: `src/app/session/AppSessionContext.tsx`
- Create: `src/app/session/useAppSession.ts`
- Create: `src/app/session/types.ts`
- Create: `src/app/commands/projectCommands.ts`
- Create: `src/app/commands/skinCommands.ts`
- Create: `src/app/menu/useMenuCommands.ts`
- Create: `src/app/AppProviders.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Define app session state shape**

Create `src/app/session/types.ts`:

```ts
import type { SpectrogramOverview, WaveformOverview } from "../../core/audio/types";
import type { ProjectSummary, WorkspaceState } from "../../core/project/types";
import type { SkinId } from "../../core/userSettings/types";
import type { ProjectAudioFacade } from "../../services/projectAudio/interfaces";
import type { SpectrogramService } from "../../services/audio/browserSpectrogramService";
import type { WaveformService } from "../../services/audio/browserWaveformService";

export interface ProjectLocation {
  projectFilePath: string;
  projectRootPath: string;
}

export interface AppSessionState {
  project: ProjectSummary | null;
  projectLocation: ProjectLocation | null;
  waveformOverview: WaveformOverview | null;
  spectrogramOverview: SpectrogramOverview | null;
  isImporting: boolean;
  isOpeningProject: boolean;
  isSavingProject: boolean;
  importError: string | null;
  uiSkin: SkinId;
}

export interface AppSessionServices {
  audioFacade: ProjectAudioFacade;
  waveformService: WaveformService;
  spectrogramService: SpectrogramService;
}

export interface AppSessionActions {
  importAudio: () => Promise<void>;
  saveProject: () => Promise<void>;
  openProject: () => Promise<void>;
  changeSkin: (nextSkin: SkinId) => Promise<void>;
  updateWorkspace: (workspacePatch: Partial<WorkspaceState>) => void;
}

export interface AppSessionValue extends AppSessionState, AppSessionServices, AppSessionActions {}
```

- [ ] **Step 2: Create context and hook**

Create `src/app/session/AppSessionContext.tsx`:

```tsx
import { createContext } from "react";
import type { AppSessionValue } from "./types";

export const AppSessionContext = createContext<AppSessionValue | null>(null);
```

Create `src/app/session/useAppSession.ts`:

```ts
import { useContext } from "react";
import { AppSessionContext } from "./AppSessionContext";

export function useAppSession() {
  const value = useContext(AppSessionContext);
  if (!value) {
    throw new Error("useAppSession must be used within AppSessionProvider.");
  }

  return value;
}
```

- [ ] **Step 3: Move current `App.tsx` workflow logic into provider**

Create `src/app/session/AppSessionProvider.tsx` by moving current state and handlers from `src/App.tsx` into a provider component.

The provider props should be:

```ts
interface AppSessionProviderProps {
  children: React.ReactNode;
  waveformService?: WaveformService;
  spectrogramService?: SpectrogramService;
}
```

The provider must keep the existing object URL lifecycle and existing behavior for:

```text
importAudio
saveProject
openProject
changeSkin
updateWorkspace
```

- [ ] **Step 4: Extract menu command hook**

Create `src/app/menu/useMenuCommands.ts`:

```ts
import { useEffect } from "react";
import type { SkinId } from "../../core/userSettings/types";

interface UseMenuCommandsOptions {
  importAudio: () => Promise<void>;
  openProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  changeSkin: (nextSkin: SkinId) => Promise<void>;
}

export function useMenuCommands({
  importAudio,
  openProject,
  saveProject,
  changeSkin
}: UseMenuCommandsOptions) {
  useEffect(() => {
    if (typeof window.ziqiApp.onMenuCommand !== "function") {
      return;
    }

    return window.ziqiApp.onMenuCommand((command) => {
      if (command === "import-audio") {
        void importAudio();
        return;
      }

      if (command === "open-project") {
        void openProject();
        return;
      }

      if (command === "save-project") {
        void saveProject();
        return;
      }

      if (command === "set-skin-default") {
        void changeSkin("default");
        return;
      }

      if (command === "set-skin-animal-island") {
        void changeSkin("animal-island");
      }
    });
  }, [changeSkin, importAudio, openProject, saveProject]);
}
```

- [ ] **Step 5: Slim `src/App.tsx` into composition**

Modify `src/App.tsx` so it creates service defaults, wraps the app in `AppSessionProvider`, then renders the transcription workspace or current shell.

Expected shape:

```tsx
export function App({ waveformService, spectrogramService }: AppProps) {
  return (
    <AppSessionProvider waveformService={waveformService} spectrogramService={spectrogramService}>
      <AppContent />
    </AppSessionProvider>
  );
}

function AppContent() {
  const session = useAppSession();
  const skinDefinition = getSkinDefinition(session.uiSkin);

  useMenuCommands(session);

  return (
    <UiProvider skinId={skinDefinition.id} adapter={skinDefinition.adapter}>
      <WorkbenchShell
        audioFacade={session.audioFacade}
        importError={session.importError}
        onWorkspaceChange={session.updateWorkspace}
        project={session.project}
        spectrogramOverview={session.spectrogramOverview}
        waveformOverview={session.waveformOverview}
      />
    </UiProvider>
  );
}
```

- [ ] **Step 6: Run app tests**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: command exits `0`.

- [ ] **Step 7: Run full renderer tests**

Run:

```powershell
npm test -- src
```

Expected: command exits `0`.

- [ ] **Step 8: Run lint and build**

Run:

```powershell
npm run lint
npm run build
```

Expected: both commands exit `0`.

- [ ] **Step 9: Commit app session extraction**

Run:

```powershell
git add -- src
git commit -m "Extract app session and menu commands"
```

Expected: commit succeeds with only app session and import updates.

## Task 5: Extract Transcription Workspace And Features

**Files:**
- Create: `src/workspaces/transcription/TranscriptionWorkspace.tsx`
- Create: `src/workspaces/transcription/index.ts`
- Create: `src/features/projectSidebar/ProjectSidebar.tsx`
- Create: `src/features/projectSidebar/index.ts`
- Create: `src/features/spectrogramViewer/SpectrogramViewer.tsx`
- Create: `src/features/spectrogramViewer/index.ts`
- Create: `src/features/playbackControls/PlaybackControls.tsx`
- Create: `src/features/playbackControls/index.ts`
- Create: `src/features/workbenchDocks/WorkbenchDocks.tsx`
- Create: `src/features/workbenchDocks/index.ts`
- Create: `src/capabilities/timelineViewport/index.ts`
- Modify: `src/components/WorkbenchShell.tsx`
- Modify: `src/components/SpectrogramView.tsx`
- Modify: related tests

- [ ] **Step 1: Create transcription workspace shell**

Create `src/workspaces/transcription/TranscriptionWorkspace.tsx` by moving the current loaded-project layout from `WorkbenchShell` into a workspace component.

Props:

```ts
import type { ProjectSummary, WorkspaceState } from "../../core/project/types";
import type { ProjectAudioFacade } from "../../services/projectAudio/interfaces";
import type { SpectrogramOverview, WaveformOverview } from "../../core/audio/types";

export interface TranscriptionWorkspaceProps {
  project: ProjectSummary;
  audioFacade: ProjectAudioFacade;
  waveformOverview?: WaveformOverview | null;
  spectrogramOverview?: SpectrogramOverview | null;
  onWorkspaceChange: (workspacePatch: Partial<WorkspaceState>) => void;
}
```

- [ ] **Step 2: Extract project sidebar feature**

Create `src/features/projectSidebar/ProjectSidebar.tsx` with props:

```ts
import type { ProjectSummary } from "../../core/project/types";

export interface ProjectSidebarProps {
  project: ProjectSummary;
}
```

Move project metadata, assets, and annotations side rail markup from `WorkbenchShell` into this feature.

- [ ] **Step 3: Extract workbench docks feature**

Create `src/features/workbenchDocks/WorkbenchDocks.tsx` with props:

```ts
import type { ProjectSummary } from "../../core/project/types";

export interface WorkbenchDocksProps {
  project: ProjectSummary;
}
```

Move Analysis, Stems, and Session Notes dock markup from `WorkbenchShell` into this feature.

- [ ] **Step 4: Keep spectrogram viewer as current component wrapper**

Create `src/features/spectrogramViewer/SpectrogramViewer.tsx` as the feature boundary around `SpectrogramView`.

Props should match current workspace needs:

```ts
import type { ProjectSummary, WorkspaceState } from "../../core/project/types";
import type { ProjectAudioFacade } from "../../services/projectAudio/interfaces";
import type { SpectrogramOverview, WaveformOverview } from "../../core/audio/types";

export interface SpectrogramViewerProps {
  project: ProjectSummary;
  audioFacade: ProjectAudioFacade;
  waveformOverview?: WaveformOverview | null;
  spectrogramOverview?: SpectrogramOverview | null;
  onWorkspaceChange: (workspacePatch: Partial<WorkspaceState>) => void;
}
```

Move playback state polling and playback handlers from `WorkbenchShell` into `SpectrogramViewer` for now. Later extraction of `playbackControls` can split visual controls when the playback UI grows.

- [ ] **Step 5: Simplify `WorkbenchShell`**

Keep `src/components/WorkbenchShell.tsx` as a thin shell:

```tsx
export function WorkbenchShell(props: WorkbenchShellProps) {
  if (!props.project) {
    return <EmptyWorkspace importError={props.importError} />;
  }

  return <TranscriptionWorkspace {...loadedProjectProps} />;
}
```

The topbar can remain in `WorkbenchShell` until a later app shell extraction.

- [ ] **Step 6: Add index files**

Create:

```ts
export * from "./TranscriptionWorkspace";
```

in `src/workspaces/transcription/index.ts`.

Create equivalent public API files for each feature:

```ts
export * from "./ProjectSidebar";
```

```ts
export * from "./SpectrogramViewer";
```

```ts
export * from "./WorkbenchDocks";
```

- [ ] **Step 7: Run focused workspace tests**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx src/components/SpectrogramView.test.tsx
```

Expected: command exits `0`.

- [ ] **Step 8: Run lint and build**

Run:

```powershell
npm run lint
npm run build
```

Expected: both commands exit `0`.

- [ ] **Step 9: Commit workspace and feature extraction**

Run:

```powershell
git add -- src
git commit -m "Extract transcription workspace features"
```

Expected: commit succeeds with only workspace and feature extraction changes.

## Task 6: Split Electron Platform Modules

**Files:**
- Create: `electron/platform/protocol/appProtocol.ts`
- Create: `electron/platform/menu/applicationMenu.ts`
- Create: `electron/platform/ipc/appInfoHandlers.ts`
- Create: `electron/platform/ipc/settingsHandlers.ts`
- Create: `electron/platform/ipc/audioFileHandlers.ts`
- Create: `electron/platform/ipc/projectFileHandlers.ts`
- Create: `electron/platform/projectFiles/projectFiles.ts`
- Create: `electron/platform/projectFiles/projectFiles.test.ts`
- Create: `electron/platform/userSettings/userSettings.ts`
- Create: `electron/platform/userSettings/userSettings.test.ts`
- Modify: `electron/main.ts`
- Modify: `electron/appMenu.ts` or move it to platform menu
- Modify: `electron/projectFiles.ts` or move it to platform project files
- Modify: `electron/userSettings.ts` or move it to platform user settings
- Modify: related Electron tests

- [ ] **Step 1: Move pure Electron platform modules**

Move:

```text
electron/projectFiles.ts -> electron/platform/projectFiles/projectFiles.ts
electron/projectFiles.test.ts -> electron/platform/projectFiles/projectFiles.test.ts
electron/userSettings.ts -> electron/platform/userSettings/userSettings.ts
electron/userSettings.test.ts -> electron/platform/userSettings/userSettings.test.ts
electron/appMenu.ts -> electron/platform/menu/applicationMenu.ts
electron/appMenu.test.ts -> electron/platform/menu/applicationMenu.test.ts
```

Update relative imports to preserve behavior.

- [ ] **Step 2: Extract protocol registration**

Create `electron/platform/protocol/appProtocol.ts`:

```ts
import { protocol } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

export function registerAppProtocol(rendererDistDir: string) {
  protocol.handle("ziqi", async (request) => {
    const requestUrl = new URL(request.url);
    const requestedPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = requestedPath === "/" ? "index.html" : requestedPath.slice(1);
    const filePath = path.normalize(path.join(rendererDistDir, relativePath));

    if (!filePath.startsWith(rendererDistDir)) {
      return new Response("Not found", { status: 404 });
    }

    try {
      const file = await fs.readFile(filePath);
      return new Response(file, {
        headers: {
          "content-type": getContentType(filePath)
        }
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

function getContentType(filePath: string) {
  switch (path.extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}
```

- [ ] **Step 3: Extract IPC registration modules**

Create IPC modules with these registration function names and explicit dependency objects:

```ts
export function registerAppInfoHandlers(): void;
export function registerSettingsHandlers(dependencies: SettingsHandlerDependencies): void;
export function registerAudioFileHandlers(dependencies: AudioFileHandlerDependencies): void;
export function registerProjectFileHandlers(dependencies: ProjectFileHandlerDependencies): void;
```

Move existing `ipcMain.handle(...)` bodies from `electron/main.ts` into these functions. Keep the same IPC channel names:

```text
app:get-version
settings:get-user-settings
settings:update-user-settings
audio:select-file
project:save
project:open
project:activate-opened
```

- [ ] **Step 4: Slim `electron/main.ts`**

`electron/main.ts` should retain:

```text
protocol.registerSchemesAsPrivileged(...)
path setup
createWindow()
app.whenReady()
app window lifecycle
module registrations
```

It should not contain project save/open business logic after this task.

- [ ] **Step 5: Run Electron-focused tests**

Run:

```powershell
npm test -- electron
```

Expected: command exits `0`.

- [ ] **Step 6: Run lint and build**

Run:

```powershell
npm run lint
npm run build
```

Expected: both commands exit `0`.

- [ ] **Step 7: Commit Electron platform split**

Run:

```powershell
git add -- electron
git commit -m "Split Electron platform modules"
```

Expected: commit succeeds with only Electron platform changes.

## Task 7: Tighten Architecture Lint Rules

**Files:**
- Modify: `eslint.config.js`
- Modify: `eslint.config.test.mjs`

- [ ] **Step 1: Add stricter rules for established directories**

Update `eslint.config.js` so:

```text
src/app cannot import src/components directly except through workspaces during the transition.
src/workspaces can import features, capabilities, app/session, core, services, and ui.
src/features cannot import src/components legacy shell files.
src/services cannot import React.
src/skins can import ui contracts but app/features cannot import concrete skins.
electron/platform modules cannot import renderer src files.
```

- [ ] **Step 2: Add tests for tightened rules**

Extend `eslint.config.test.mjs` with cases for:

```text
services importing React fails
features importing legacy components fails
electron/platform importing src/App fails
workspaces importing features succeeds
```

- [ ] **Step 3: Run lint tests**

Run:

```powershell
npm test -- eslint.config.test.mjs
```

Expected: command exits `0`.

- [ ] **Step 4: Run full lint**

Run:

```powershell
npm run lint
```

Expected: command exits `0`.

- [ ] **Step 5: Commit tightened lint rules**

Run:

```powershell
git add -- eslint.config.js eslint.config.test.mjs
git commit -m "Tighten architecture lint boundaries"
```

Expected: commit succeeds with only lint rule changes.

## Task 8: Final Full Verification

**Files:**
- No planned file changes.

- [ ] **Step 1: Run lint**

Run:

```powershell
npm run lint
```

Expected: command exits `0`.

- [ ] **Step 2: Run all tests**

Run:

```powershell
npm test
```

Expected: command exits `0`.

- [ ] **Step 3: Run production build**

Run:

```powershell
npm run build
```

Expected: command exits `0`.

- [ ] **Step 4: Run Electron smoke test**

Build first if needed:

```powershell
npm run build
```

Then start Electron with remote debugging and verify `window.ziqiApp` exists in the renderer. Use the existing project smoke-test approach from prior Electron work if available in shell history.

Expected:

```text
window.ziqiApp exists
window.ziqiApp.getVersion is a function
window.ziqiApp.openProject is a function
window.ziqiApp.saveProject is a function
```

If the environment cannot launch Electron, record the limitation in the final task summary instead of claiming the smoke test passed.

- [ ] **Step 5: Inspect final git status**

Run:

```powershell
git status --short
```

Expected: no output.

## Completion Criteria

The full refactor is complete when:

- `src/App.tsx` is a composition root.
- Current project state and global commands live under `src/app`.
- Core models and pure rules live under `src/core`.
- Audio and playback side-effect adapters live under `src/services`.
- The transcription workbench lives under `src/workspaces/transcription`.
- User-facing workbench slices live under `src/features`.
- Shared reusable interaction behavior lives under `src/capabilities` when it has multiple consumers.
- UI primitives and skin adapters remain isolated behind `src/ui` and `src/skins`.
- Electron platform logic is split under `electron/platform`.
- `npm run lint`, `npm test`, and `npm run build` pass.
- Electron smoke test is either passed or explicitly documented as blocked by the environment.

## Self-Review

- Spec coverage: This plan covers every target layer from the approved architecture: app, core, services, capabilities, features, workspaces, ui, skins, and Electron platform. It also includes final lint tightening after the directories exist.
- Scope decomposition: The plan is intentionally a master plan. Each task can be executed and committed independently; if a task becomes too large during execution, split that task into its own detailed child plan before editing code.
- Completeness scan: No unfinished markers, vague filler steps, or missing verification commands remain.
