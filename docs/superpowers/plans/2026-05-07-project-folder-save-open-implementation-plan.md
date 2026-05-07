# Project Folder Save Open Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first project-folder save/open loop using a `.ziqi` JSON project file plus an `audio/` source-audio copy, with project open rebuilding waveform data from audio bytes.

**Architecture:** Electron main owns all local filesystem operations and exposes save/open through preload. Renderer keeps current project state plus optional project location, and reuses the existing audio blob and waveform decoding path when opening a saved project. No waveform, audio buffer, object URL, or derived audio data is persisted.

**Tech Stack:** Electron, React 19, TypeScript, Vite, Vitest, Testing Library, Node `fs/promises`, Node `path`.

---

## File Structure

- Create `electron/projectFiles.ts`
  - Owns `.ziqi` payload creation/parsing, safe project folder naming, relative audio path creation, project save, and project open.
  - Lives under `electron/` because `tsconfig.electron.json` currently has `rootDir: "electron"` and should keep emitting `dist-electron/main.js`.
  - Defines narrow structural project types locally instead of importing `src/domain/project/types.ts`.

- Create `electron/projectFiles.test.ts`
  - Unit tests for `.ziqi` payload creation/parsing and path behavior.
  - Uses temporary folders for save/open file IO.

- Modify `electron/main.ts`
  - Registers `project:save` and `project:open` IPC handlers.
  - Delegates all project file logic to `electron/projectFiles.ts`.
  - Keeps the existing `audio:select-file` handler intact.

- Modify `electron/preload.cts`
  - Exposes `saveProject` and `openProject`.

- Modify `src/types/global.d.ts`
  - Adds renderer-visible types for `ProjectLocation`, save/open request/result shapes, and the new `window.ziqiApp` methods.

- Modify `src/components/WorkbenchShell.tsx`
  - Adds `Save Project` command.
  - Wires `Open Project` to a handler.
  - Disables save when no project exists or save is in progress.
  - Shows simple `Saving...` / `Opening...` labels.

- Modify `src/components/WorkbenchShell.test.tsx`
  - Covers save button disabled/enabled behavior.
  - Covers command callbacks for save/open.

- Modify `src/App.tsx`
  - Tracks `projectLocation`.
  - Clears `projectLocation` after importing a new unsaved audio project.
  - Implements `handleSaveProject`.
  - Implements `handleOpenProject`.
  - Reuses existing audio setup logic for imported and opened project audio.

- Modify `src/App.test.tsx`
  - Covers saving an unsaved project.
  - Covers saving an already saved project.
  - Covers opening a project and rebuilding waveform from returned audio bytes.
  - Covers cancel paths and stable error paths.

---

## Task 1: Add Electron Project File Tests

**Files:**
- Create: `electron/projectFiles.test.ts`
- Later create: `electron/projectFiles.ts`

- [ ] **Step 1: Write failing tests for project payloads and paths**

Create `electron/projectFiles.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createZiqiProjectPayload,
  openProjectFromFile,
  parseZiqiProjectPayload,
  saveExistingProject,
  saveNewProject
} from "./projectFiles";

const project = {
  id: "project-2026-05-07T12:00:00.000Z",
  name: "Demo Track",
  sourceAudio: {
    id: "source-2026-05-07T12:00:00.000Z",
    name: "demo track.wav",
    durationMs: 12_000,
    sampleRate: 48_000,
    channelCount: 2,
    filePath: "D:\\Music Library\\demo track.wav"
  },
  assets: [],
  analysisRuns: [],
  annotations: [],
  workspace: {
    preset: "spectrum-analysis",
    activeDock: "analysis",
    gridEnabled: true,
    bpm: 120,
    beatOffsetMs: 0,
    playbackRate: 1
  }
};

let tempDir: string;

describe("projectFiles", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ziqi-project-files-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("creates a .ziqi payload with a stable format and schema version", () => {
    const payload = createZiqiProjectPayload(project);

    expect(payload).toEqual({
      format: "ziqi.project",
      schemaVersion: 1,
      project
    });
  });

  it("parses a valid .ziqi payload", () => {
    const payload = createZiqiProjectPayload(project);

    expect(parseZiqiProjectPayload(JSON.stringify(payload))).toEqual(payload);
  });

  it("rejects invalid .ziqi payloads with a stable error", () => {
    expect(() => parseZiqiProjectPayload("{")).toThrow("Failed to open project.");
    expect(() =>
      parseZiqiProjectPayload(
        JSON.stringify({
          format: "other",
          schemaVersion: 1,
          project
        })
      )
    ).toThrow("Failed to open project.");
    expect(() =>
      parseZiqiProjectPayload(
        JSON.stringify({
          format: "ziqi.project",
          schemaVersion: 2,
          project
        })
      )
    ).toThrow("Failed to open project.");
  });

  it("saves a new project folder with a .ziqi file and audio copy", async () => {
    const sourceAudioPath = path.join(tempDir, "demo track.wav");
    await fs.writeFile(sourceAudioPath, Buffer.from([1, 2, 3, 4]));

    const result = await saveNewProject({
      parentDirectoryPath: tempDir,
      project: {
        ...project,
        sourceAudio: {
          ...project.sourceAudio,
          filePath: sourceAudioPath
        }
      }
    });

    expect(path.basename(result.projectRootPath)).toBe("Demo Track.ziqiproject");
    expect(path.basename(result.projectFilePath)).toBe("Demo Track.ziqi");
    expect(result.project.sourceAudio.filePath).toBe("audio/demo track.wav");
    await expect(fs.readFile(path.join(result.projectRootPath, "audio", "demo track.wav"))).resolves.toEqual(
      Buffer.from([1, 2, 3, 4])
    );

    const projectFile = JSON.parse(await fs.readFile(result.projectFilePath, "utf8"));
    expect(projectFile.project.sourceAudio.filePath).toBe("audio/demo track.wav");
  });

  it("does not overwrite an existing project folder when saving a new project", async () => {
    await fs.mkdir(path.join(tempDir, "Demo Track.ziqiproject"));

    await expect(
      saveNewProject({
        parentDirectoryPath: tempDir,
        project
      })
    ).rejects.toThrow("Failed to save project.");
  });

  it("rewrites an existing .ziqi file without copying audio again", async () => {
    const sourceAudioPath = path.join(tempDir, "demo track.wav");
    await fs.writeFile(sourceAudioPath, Buffer.from([1, 2, 3, 4]));
    const saved = await saveNewProject({
      parentDirectoryPath: tempDir,
      project: {
        ...project,
        sourceAudio: {
          ...project.sourceAudio,
          filePath: sourceAudioPath
        }
      }
    });

    const nextProject = {
      ...saved.project,
      workspace: {
        ...saved.project.workspace,
        bpm: 96
      }
    };

    const result = await saveExistingProject({
      project: nextProject,
      projectFilePath: saved.projectFilePath,
      projectRootPath: saved.projectRootPath
    });

    expect(result.project.workspace.bpm).toBe(96);
    const projectFile = JSON.parse(await fs.readFile(saved.projectFilePath, "utf8"));
    expect(projectFile.project.workspace.bpm).toBe(96);
    await expect(fs.readFile(path.join(saved.projectRootPath, "audio", "demo track.wav"))).resolves.toEqual(
      Buffer.from([1, 2, 3, 4])
    );
  });

  it("opens a project from a .ziqi file and reads project audio bytes", async () => {
    const sourceAudioPath = path.join(tempDir, "demo track.wav");
    await fs.writeFile(sourceAudioPath, Buffer.from([8, 7, 6, 5]));
    const saved = await saveNewProject({
      parentDirectoryPath: tempDir,
      project: {
        ...project,
        sourceAudio: {
          ...project.sourceAudio,
          filePath: sourceAudioPath
        }
      }
    });

    const opened = await openProjectFromFile(saved.projectFilePath);

    expect(opened.project).toEqual(saved.project);
    expect(opened.projectFilePath).toBe(saved.projectFilePath);
    expect(opened.projectRootPath).toBe(saved.projectRootPath);
    expect(Buffer.from(opened.audioData)).toEqual(Buffer.from([8, 7, 6, 5]));
  });

  it("throws a stable error when project audio is missing", async () => {
    const projectRootPath = path.join(tempDir, "Missing Audio.ziqiproject");
    await fs.mkdir(projectRootPath);
    const projectFilePath = path.join(projectRootPath, "Missing Audio.ziqi");
    await fs.writeFile(
      projectFilePath,
      JSON.stringify(
        createZiqiProjectPayload({
          ...project,
          name: "Missing Audio",
          sourceAudio: {
            ...project.sourceAudio,
            filePath: "audio/missing.wav"
          }
        })
      )
    );

    await expect(openProjectFromFile(projectFilePath)).rejects.toThrow(
      "Failed to load project audio."
    );
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```powershell
npm test -- electron/projectFiles.test.ts
```

Expected: FAIL because `electron/projectFiles.ts` does not exist.

---

## Task 2: Implement Electron Project File Helpers

**Files:**
- Create: `electron/projectFiles.ts`
- Test: `electron/projectFiles.test.ts`

- [ ] **Step 1: Add the project file helper implementation**

Create `electron/projectFiles.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";

const PROJECT_FORMAT = "ziqi.project";
const PROJECT_SCHEMA_VERSION = 1;
const PROJECT_FOLDER_EXTENSION = ".ziqiproject";
const PROJECT_FILE_EXTENSION = ".ziqi";
const AUDIO_DIRECTORY_NAME = "audio";

export interface SerializableProject {
  id: string;
  name: string;
  sourceAudio: {
    id: string;
    name: string;
    durationMs: number;
    sampleRate: number;
    channelCount: number;
    filePath: string;
  };
  assets: unknown[];
  analysisRuns: unknown[];
  annotations: unknown[];
  workspace: Record<string, unknown>;
}

export interface ZiqiProjectPayload {
  format: typeof PROJECT_FORMAT;
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  project: SerializableProject;
}

export interface ProjectLocation {
  projectFilePath: string;
  projectRootPath: string;
}

export interface SaveNewProjectOptions {
  parentDirectoryPath: string;
  project: SerializableProject;
}

export interface SaveExistingProjectOptions {
  project: SerializableProject;
  projectFilePath: string;
  projectRootPath: string;
}

export interface SaveProjectResult extends ProjectLocation {
  project: SerializableProject;
}

export interface OpenProjectResult extends SaveProjectResult {
  audioData: ArrayBuffer;
}

export function createZiqiProjectPayload(project: SerializableProject): ZiqiProjectPayload {
  return {
    format: PROJECT_FORMAT,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    project
  };
}

export function parseZiqiProjectPayload(contents: string): ZiqiProjectPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error("Failed to open project.");
  }

  if (!isZiqiProjectPayload(parsed)) {
    throw new Error("Failed to open project.");
  }

  return parsed;
}

export async function saveNewProject({
  parentDirectoryPath,
  project
}: SaveNewProjectOptions): Promise<SaveProjectResult> {
  const projectBaseName = sanitizeFileName(project.name || "Untitled Project");
  const projectRootPath = path.join(
    parentDirectoryPath,
    `${projectBaseName}${PROJECT_FOLDER_EXTENSION}`
  );
  const projectFilePath = path.join(projectRootPath, `${projectBaseName}${PROJECT_FILE_EXTENSION}`);
  const audioDirectoryPath = path.join(projectRootPath, AUDIO_DIRECTORY_NAME);
  const audioFileName = sanitizeFileName(project.sourceAudio.name || path.basename(project.sourceAudio.filePath));
  const relativeAudioPath = toProjectRelativePath(AUDIO_DIRECTORY_NAME, audioFileName);
  const copiedAudioPath = path.join(audioDirectoryPath, audioFileName);

  try {
    await fs.mkdir(projectRootPath);
    await fs.mkdir(audioDirectoryPath);
    await fs.copyFile(project.sourceAudio.filePath, copiedAudioPath);
    const savedProject = withSourceAudioPath(project, relativeAudioPath);
    await writeProjectFile(projectFilePath, savedProject);

    return {
      project: savedProject,
      projectFilePath,
      projectRootPath
    };
  } catch {
    throw new Error("Failed to save project.");
  }
}

export async function saveExistingProject({
  project,
  projectFilePath,
  projectRootPath
}: SaveExistingProjectOptions): Promise<SaveProjectResult> {
  if (path.isAbsolute(project.sourceAudio.filePath)) {
    throw new Error("Failed to save project.");
  }

  const audioPath = path.normalize(path.join(projectRootPath, project.sourceAudio.filePath));
  if (!audioPath.startsWith(path.normalize(projectRootPath))) {
    throw new Error("Failed to save project.");
  }

  try {
    await writeProjectFile(projectFilePath, project);
    return {
      project,
      projectFilePath,
      projectRootPath
    };
  } catch {
    throw new Error("Failed to save project.");
  }
}

export async function openProjectFromFile(projectFilePath: string): Promise<OpenProjectResult> {
  const projectRootPath = path.dirname(projectFilePath);
  let payload: ZiqiProjectPayload;

  try {
    payload = parseZiqiProjectPayload(await fs.readFile(projectFilePath, "utf8"));
  } catch {
    throw new Error("Failed to open project.");
  }

  const audioPath = path.normalize(path.join(projectRootPath, payload.project.sourceAudio.filePath));
  if (!audioPath.startsWith(path.normalize(projectRootPath))) {
    throw new Error("Failed to load project audio.");
  }

  try {
    const audioFile = await fs.readFile(audioPath);
    return {
      project: payload.project,
      projectFilePath,
      projectRootPath,
      audioData: audioFile.buffer.slice(audioFile.byteOffset, audioFile.byteOffset + audioFile.byteLength)
    };
  } catch {
    throw new Error("Failed to load project audio.");
  }
}

async function writeProjectFile(projectFilePath: string, project: SerializableProject) {
  const payload = createZiqiProjectPayload(project);
  await fs.writeFile(projectFilePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function withSourceAudioPath(project: SerializableProject, filePath: string): SerializableProject {
  return {
    ...project,
    sourceAudio: {
      ...project.sourceAudio,
      filePath
    }
  };
}

function toProjectRelativePath(...segments: string[]) {
  return segments.join("/");
}

function sanitizeFileName(value: string) {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
  return cleaned || "Untitled Project";
}

function isZiqiProjectPayload(value: unknown): value is ZiqiProjectPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.format === PROJECT_FORMAT &&
    value.schemaVersion === PROJECT_SCHEMA_VERSION &&
    isProject(value.project)
  );
}

function isProject(value: unknown): value is SerializableProject {
  if (!isRecord(value) || !isRecord(value.sourceAudio) || !isRecord(value.workspace)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.sourceAudio.id === "string" &&
    typeof value.sourceAudio.name === "string" &&
    typeof value.sourceAudio.durationMs === "number" &&
    typeof value.sourceAudio.sampleRate === "number" &&
    typeof value.sourceAudio.channelCount === "number" &&
    typeof value.sourceAudio.filePath === "string" &&
    Array.isArray(value.assets) &&
    Array.isArray(value.analysisRuns) &&
    Array.isArray(value.annotations)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
```

- [ ] **Step 2: Run project file tests**

Run:

```powershell
npm test -- electron/projectFiles.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit Task 1 and Task 2**

Run:

```powershell
git add -- electron/projectFiles.ts electron/projectFiles.test.ts
git commit -m "Add project file persistence helpers"
```

---

## Task 3: Wire Electron IPC and Preload Types

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.cts`
- Modify: `src/types/global.d.ts`

- [ ] **Step 1: Add project IPC handlers in Electron main**

Modify `electron/main.ts`.

Add this import near the other imports:

```ts
import { openProjectFromFile, saveExistingProject, saveNewProject } from "./projectFiles.js";
```

Add these IPC handlers after the existing `audio:select-file` handler:

```ts
  ipcMain.handle("project:save", async (_event, request) => {
    if (!request?.project) {
      throw new Error("Failed to save project.");
    }

    if (request.projectFilePath && request.projectRootPath) {
      return saveExistingProject({
        project: request.project,
        projectFilePath: request.projectFilePath,
        projectRootPath: request.projectRootPath
      });
    }

    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Choose Project Parent Folder"
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return saveNewProject({
      parentDirectoryPath: result.filePaths[0],
      project: request.project
    });
  });

  ipcMain.handle("project:open", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "ZiQi Project",
          extensions: ["ziqi"]
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return openProjectFromFile(result.filePaths[0]);
  });
```

- [ ] **Step 2: Expose save/open through preload**

Modify `electron/preload.cts` so the `api` object includes:

```ts
  saveProject: (request: unknown) => ipcRenderer.invoke("project:save", request),
  openProject: () => ipcRenderer.invoke("project:open")
```

The final `api` object should look like this:

```ts
const api = {
  getVersion: () => ipcRenderer.invoke("app:get-version") as Promise<string>,
  selectAudioFile: () =>
    ipcRenderer.invoke("audio:select-file") as Promise<{
      audioData: ArrayBuffer;
      filePath: string;
    } | null>,
  saveProject: (request: unknown) => ipcRenderer.invoke("project:save", request),
  openProject: () => ipcRenderer.invoke("project:open")
};
```

- [ ] **Step 3: Add renderer global types**

Modify `src/types/global.d.ts`:

```ts
import type { ProjectSummary } from "../domain/project/types";

export interface ProjectLocation {
  projectFilePath: string;
  projectRootPath: string;
}

export interface SaveProjectRequest extends Partial<ProjectLocation> {
  project: ProjectSummary;
}

export interface SaveProjectResult extends ProjectLocation {
  project: ProjectSummary;
}

export interface OpenProjectResult extends SaveProjectResult {
  audioData: ArrayBuffer;
}

declare global {
  interface Window {
    ziqiApp: {
      getVersion(): Promise<string>;
      selectAudioFile(): Promise<{ audioData: ArrayBuffer; filePath: string } | null>;
      saveProject(request: SaveProjectRequest): Promise<SaveProjectResult | null>;
      openProject(): Promise<OpenProjectResult | null>;
    };
  }
}
```

- [ ] **Step 4: Run build to verify Electron and renderer types**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```powershell
git add -- electron/main.ts electron/preload.cts src/types/global.d.ts
git commit -m "Expose project save open IPC"
```

---

## Task 4: Extend Workbench Commands

**Files:**
- Modify: `src/components/WorkbenchShell.tsx`
- Modify: `src/components/WorkbenchShell.test.tsx`

- [ ] **Step 1: Write failing Workbench command tests**

Add these tests to `src/components/WorkbenchShell.test.tsx` inside the existing `describe` block:

```tsx
  it("disables project saving when no project is loaded", () => {
    render(<WorkbenchShell project={null} />);

    expect(screen.getByRole("button", { name: "Save Project" })).toBeDisabled();
  });

  it("runs save and open project commands from the command strip", async () => {
    const user = userEvent.setup();
    const project = createMockProjectSummary();
    const onSaveProject = vi.fn().mockResolvedValue(undefined);
    const onOpenProject = vi.fn().mockResolvedValue(undefined);

    render(
      <WorkbenchShell
        project={project}
        onSaveProject={onSaveProject}
        onOpenProject={onOpenProject}
      />
    );

    await user.click(screen.getByRole("button", { name: "Save Project" }));
    await user.click(screen.getByRole("button", { name: "Open Project" }));

    expect(onSaveProject).toHaveBeenCalledOnce();
    expect(onOpenProject).toHaveBeenCalledOnce();
  });

  it("shows save and open progress labels", () => {
    const project = createMockProjectSummary();

    render(
      <WorkbenchShell
        project={project}
        isOpeningProject={true}
        isSavingProject={true}
      />
    );

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Opening..." })).toBeDisabled();
  });
```

- [ ] **Step 2: Run failing Workbench tests**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: FAIL because `WorkbenchShell` does not expose save/open command props yet.

- [ ] **Step 3: Add Workbench command props and buttons**

Modify `src/components/WorkbenchShell.tsx`.

Extend `WorkbenchShellProps`:

```ts
  isOpeningProject?: boolean;
  isSavingProject?: boolean;
  onOpenProject?: () => Promise<void> | void;
  onSaveProject?: () => Promise<void> | void;
```

Extend the function parameters:

```ts
  isOpeningProject = false,
  isSavingProject = false,
  onOpenProject,
  onSaveProject,
```

Add labels near `importButtonLabel`:

```ts
  const openButtonLabel = isOpeningProject ? "Opening..." : "Open Project";
  const saveButtonLabel = isSavingProject ? "Saving..." : "Save Project";
```

Replace the first command-strip button:

```tsx
        <button disabled={isOpeningProject} onClick={onOpenProject}>
          {openButtonLabel}
        </button>
        <button disabled={!project || isSavingProject} onClick={onSaveProject}>
          {saveButtonLabel}
        </button>
```

The command strip should then begin:

```tsx
      <section className="command-strip">
        <button disabled={isOpeningProject} onClick={onOpenProject}>
          {openButtonLabel}
        </button>
        <button disabled={!project || isSavingProject} onClick={onSaveProject}>
          {saveButtonLabel}
        </button>
        <button disabled={isImporting} onClick={onImportAudio}>
          {importButtonLabel}
        </button>
```

- [ ] **Step 4: Run Workbench tests**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```powershell
git add -- src/components/WorkbenchShell.tsx src/components/WorkbenchShell.test.tsx
git commit -m "Add project save open workbench commands"
```

---

## Task 5: Wire App Save/Open Workflow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing App tests for save/open**

Add these tests to `src/App.test.tsx` inside the existing `describe` block:

```tsx
  it("saves an imported project and updates it to the project audio path", async () => {
    const audioData = new ArrayBuffer(8);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    window.ziqiApp.saveProject = vi.fn().mockImplementation(async ({ project }) => ({
      project: {
        ...project,
        sourceAudio: {
          ...project.sourceAudio,
          filePath: "audio/demo track.wav"
        }
      },
      projectFilePath: "D:\\Projects\\Demo Track.ziqiproject\\Demo Track.ziqi",
      projectRootPath: "D:\\Projects\\Demo Track.ziqiproject"
    }));
    window.ziqiApp.openProject = vi.fn();
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    await user.click(screen.getByRole("button", { name: "Save Project" }));

    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledWith({
        project: expect.objectContaining({
          name: "demo track",
          sourceAudio: expect.objectContaining({
            filePath: "D:\\Music Library\\demo track.wav"
          })
        })
      });
    });
  });

  it("saves an already saved project using the existing location", async () => {
    const audioData = new ArrayBuffer(8);
    window.ziqiApp.openProject = vi.fn().mockResolvedValue({
      audioData,
      projectFilePath: "D:\\Projects\\Demo Track.ziqiproject\\Demo Track.ziqi",
      projectRootPath: "D:\\Projects\\Demo Track.ziqiproject",
      project: {
        id: "project-opened",
        name: "Demo Track",
        sourceAudio: {
          id: "source-opened",
          name: "demo track.wav",
          durationMs: 12_000,
          sampleRate: 48_000,
          channelCount: 2,
          filePath: "audio/demo track.wav"
        },
        assets: [],
        analysisRuns: [],
        annotations: [],
        workspace: {
          preset: "spectrum-analysis",
          activeDock: "analysis",
          gridEnabled: true,
          bpm: 120,
          beatOffsetMs: 0,
          playbackRate: 1
        }
      }
    });
    window.ziqiApp.saveProject = vi.fn().mockImplementation(async (request) => ({
      project: request.project,
      projectFilePath: request.projectFilePath,
      projectRootPath: request.projectRootPath
    }));
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getByRole("button", { name: "Open Project" }));
    await waitFor(() => {
      expect(screen.getByText("Demo Track")).toBeTruthy();
    });

    await user.click(screen.getByRole("button", { name: "Save Project" }));

    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledWith({
        project: expect.objectContaining({
          id: "project-opened",
          sourceAudio: expect.objectContaining({
            filePath: "audio/demo track.wav"
          })
        }),
        projectFilePath: "D:\\Projects\\Demo Track.ziqiproject\\Demo Track.ziqi",
        projectRootPath: "D:\\Projects\\Demo Track.ziqiproject"
      });
    });
  });

  it("opens a saved project and rebuilds waveform data from project audio bytes", async () => {
    const audioData = new ArrayBuffer(16);
    window.ziqiApp.openProject = vi.fn().mockResolvedValue({
      audioData,
      projectFilePath: "D:\\Projects\\Demo Track.ziqiproject\\Demo Track.ziqi",
      projectRootPath: "D:\\Projects\\Demo Track.ziqiproject",
      project: {
        id: "project-opened",
        name: "Demo Track",
        sourceAudio: {
          id: "source-opened",
          name: "demo track.wav",
          durationMs: 12_000,
          sampleRate: 48_000,
          channelCount: 2,
          filePath: "audio/demo track.wav"
        },
        assets: [],
        analysisRuns: [],
        annotations: [],
        workspace: {
          preset: "spectrum-analysis",
          activeDock: "analysis",
          gridEnabled: true,
          bpm: 120,
          beatOffsetMs: 0,
          playbackRate: 1
        }
      }
    });
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getByRole("button", { name: "Open Project" }));

    await waitFor(() => {
      expect(screen.getByText("Demo Track")).toBeTruthy();
    });
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenCalledWith(audioData);
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
  });

  it("does nothing when project open is canceled", async () => {
    window.ziqiApp.openProject = vi.fn().mockResolvedValue(null);
    const waveformService = {
      buildOverviewFromAudioData: vi.fn()
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getByRole("button", { name: "Open Project" }));

    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(waveformService.buildOverviewFromAudioData).not.toHaveBeenCalled();
  });

  it("keeps the current project and shows a stable error when project open fails", async () => {
    const importedAudioData = new ArrayBuffer(8);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData: importedAudioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    window.ziqiApp.openProject = vi.fn().mockRejectedValue(new Error("Failed to open project."));
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    await user.click(screen.getByRole("button", { name: "Open Project" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to open project.")).toBeTruthy();
    });
    expect(screen.getByText("demo track")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
  });
```

Also update the default `window.ziqiApp` mock in `beforeEach` so it includes:

```ts
        saveProject: vi.fn().mockResolvedValue(null),
        openProject: vi.fn().mockResolvedValue(null)
```

- [ ] **Step 2: Run failing App tests**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: FAIL because `App` does not implement save/open yet.

- [ ] **Step 3: Add project location state and a shared audio activation helper**

Modify `src/App.tsx`.

Add this local type near `AppProps`:

```ts
interface ProjectLocation {
  projectFilePath: string;
  projectRootPath: string;
}
```

Add state next to the existing project state:

```ts
  const [projectLocation, setProjectLocation] = useState<ProjectLocation | null>(null);
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
```

Add this helper inside `App` before `handleImportAudio`:

```ts
  async function activateProjectAudio({
    audioData,
    filePath,
    nextProject
  }: {
    audioData: ArrayBuffer;
    filePath: string;
    nextProject: ProjectSummary;
  }) {
    const nextPlaybackUrl = URL.createObjectURL(new Blob([audioData]));

    try {
      const nextWaveformOverview =
        await activeWaveformService.buildOverviewFromAudioData(audioData);
      await audioFacade.source.load(filePath, nextPlaybackUrl);
      await audioFacade.playback.seek(0);

      setProject(nextProject);
      setWaveformOverview(nextWaveformOverview);

      if (activePlaybackUrl.current) {
        URL.revokeObjectURL(activePlaybackUrl.current);
      }
      activePlaybackUrl.current = nextPlaybackUrl;
    } catch (error) {
      URL.revokeObjectURL(nextPlaybackUrl);
      throw error;
    }
  }
```

- [ ] **Step 4: Rework import to track unsaved project state**

Replace `handleImportAudio` with:

```ts
  async function handleImportAudio() {
    setIsImporting(true);
    setImportError(null);

    try {
      const selectedFile = await window.ziqiApp.selectAudioFile();
      if (!selectedFile) {
        return;
      }

      const nextPlaybackUrl = URL.createObjectURL(new Blob([selectedFile.audioData]));
      try {
        const metadata = await audioFacade.source.load(selectedFile.filePath, nextPlaybackUrl);
        const nextProject = createProjectFromAudio({
          filePath: selectedFile.filePath,
          metadata
        });
        const nextWaveformOverview =
          await activeWaveformService.buildOverviewFromAudioData(selectedFile.audioData);
        await audioFacade.playback.seek(0);
        setProject(nextProject);
        setWaveformOverview(nextWaveformOverview);
        setProjectLocation(null);
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
  }
```

This preserves the existing object URL ownership behavior and clears `projectLocation` for newly imported unsaved projects. The `activateProjectAudio` helper is used by project opening in the next step; import keeps inline metadata loading because it must create a new `ProjectSummary` from loaded metadata.

- [ ] **Step 5: Add save and open handlers**

Add these functions inside `App`:

```ts
  async function handleSaveProject() {
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
  }

  async function handleOpenProject() {
    setIsOpeningProject(true);
    setImportError(null);

    try {
      const openedProject = await window.ziqiApp.openProject();
      if (!openedProject) {
        return;
      }

      await activateProjectAudio({
        audioData: openedProject.audioData,
        filePath: openedProject.project.sourceAudio.filePath,
        nextProject: openedProject.project
      });
      setProjectLocation({
        projectFilePath: openedProject.projectFilePath,
        projectRootPath: openedProject.projectRootPath
      });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to open project.");
    } finally {
      setIsOpeningProject(false);
    }
  }
```

- [ ] **Step 6: Pass save/open props to WorkbenchShell**

Update the `WorkbenchShell` call:

```tsx
    <WorkbenchShell
      audioFacade={audioFacade}
      importError={importError}
      isImporting={isImporting}
      isOpeningProject={isOpeningProject}
      isSavingProject={isSavingProject}
      onImportAudio={handleImportAudio}
      onOpenProject={handleOpenProject}
      onSaveProject={handleSaveProject}
      project={project}
      waveformOverview={waveformOverview}
    />
```

- [ ] **Step 7: Run App tests**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Run Workbench and App tests together**

Run:

```powershell
npm test -- src/App.test.tsx src/components/WorkbenchShell.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 5**

Run:

```powershell
git add -- src/App.tsx src/App.test.tsx
git commit -m "Wire project save open workflow"
```

---

## Task 6: Verification and Electron Smoke Test

**Files:**
- Verify only unless a failure requires the smallest fix in files touched by this plan.

- [ ] **Step 1: Run all tests**

Run:

```powershell
npm test
```

Expected: PASS with all test files green.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 3: Launch Electron production build with remote debugging**

Run:

```powershell
$electron = 'D:\WORKSPACE\ZiQi\node_modules\.bin\electron.cmd'
$args = @('--remote-debugging-port=9222', 'dist-electron\main.js')
$proc = Start-Process -FilePath $electron -ArgumentList $args -WorkingDirectory 'D:\WORKSPACE\ZiQi' -PassThru
Start-Sleep -Seconds 5
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:9222/json' -TimeoutSec 5 | Select-Object -ExpandProperty Content
```

Expected: output includes a page target with title `ZiQi Workbench`.

- [ ] **Step 4: Probe preload APIs**

Run:

```powershell
$json = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:9222/json' -TimeoutSec 5 | Select-Object -ExpandProperty Content
$target = ($json | ConvertFrom-Json | Where-Object { $_.type -eq 'page' } | Select-Object -First 1)
$ws = [System.Net.WebSockets.ClientWebSocket]::new()
$ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
$payload = '{"id":1,"method":"Runtime.evaluate","params":{"expression":"({ hasZiqiApp: !!window.ziqiApp, saveProject: typeof window.ziqiApp?.saveProject, openProject: typeof window.ziqiApp?.openProject })","returnByValue":true}}'
$bytes = [Text.Encoding]::UTF8.GetBytes($payload)
$ws.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
$buffer = New-Object byte[] 8192
$segment = [ArraySegment[byte]]::new($buffer)
$result = $ws.ReceiveAsync($segment, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
[Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
```

Expected: JSON result includes:

```json
{
  "hasZiqiApp": true,
  "saveProject": "function",
  "openProject": "function"
}
```

- [ ] **Step 5: Close Electron**

Run:

```powershell
$json = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:9222/json' -TimeoutSec 5 | Select-Object -ExpandProperty Content
$target = ($json | ConvertFrom-Json | Where-Object { $_.type -eq 'page' } | Select-Object -First 1)
$ws = [System.Net.WebSockets.ClientWebSocket]::new()
$ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
$payload = '{"id":1,"method":"Browser.close"}'
$bytes = [Text.Encoding]::UTF8.GetBytes($payload)
$ws.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
```

Expected: Electron closes.

- [ ] **Step 6: Manual verification**

Run the built app, then verify manually:

```powershell
npm start
```

Expected manual result:

- Import an audio file.
- Click `Save Project`.
- Choose a parent folder.
- Confirm `<Project Name>.ziqiproject/<Project Name>.ziqi` exists.
- Confirm `<Project Name>.ziqiproject/audio/<source audio name>` exists.
- Click `Open Project`.
- Select the `.ziqi` file.
- Confirm project loads, waveform is visible, playback works, and opening the project does not require the original source audio path.

- [ ] **Step 7: Commit verification fixes if needed**

If Step 1 through Step 6 require fixes, make the smallest scoped change, then run:

```powershell
git add -- electron src
git commit -m "Stabilize project save open verification"
```

If verification required no code changes, do not create an empty commit.

---

## Self-Review

### Spec Coverage

- File-folder project with `.ziqi` JSON and `audio/` copy: Task 1 and Task 2 implement and test `saveNewProject`.
- No waveform persistence: Task 1 tests only `.ziqi` and audio copy; Task 5 tests opening rebuilds waveform from `audioData`.
- Open project through `.ziqi`: Task 2 implements `openProjectFromFile`; Task 3 exposes `project:open`; Task 5 wires renderer.
- Save unsaved and already saved projects: Task 2 tests both helper paths; Task 5 tests both App paths.
- Renderer keeps project location: Task 5 adds `projectLocation`.
- Electron owns filesystem: Task 2 and Task 3 keep file IO in `electron/`; renderer only calls preload.
- UI command behavior: Task 4 adds and tests `Save Project` and `Open Project`.
- Stable errors and cancel behavior: Task 1 and Task 5 cover invalid `.ziqi`, missing audio, save/open cancel, and open failure.
- Verification: Task 6 covers full tests, build, preload smoke test, and manual app verification.

### Placeholder Scan

The plan contains no deferred implementation placeholders. Every task includes exact file paths, test code, implementation code or concrete snippets, commands, and expected outcomes.

### Type Consistency

- Renderer IPC types are declared in `src/types/global.d.ts` as `SaveProjectRequest`, `SaveProjectResult`, and `OpenProjectResult`.
- Electron helper result names match renderer expectations: `project`, `projectFilePath`, `projectRootPath`, and `audioData`.
- `projectLocation` in `App.tsx` uses the same `projectFilePath` and `projectRootPath` names.
- `.ziqi` payload uses `format: "ziqi.project"` and `schemaVersion: 1` consistently across tests and implementation.
