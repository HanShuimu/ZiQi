import fs from "node:fs/promises";
import path from "node:path";

export const PROJECT_FORMAT = "ziqi.project";
export const PROJECT_SCHEMA_VERSION = 1;

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

export interface SaveNewProjectOptions {
  parentDirectoryPath: string;
  project: SerializableProject;
}

export interface SaveExistingProjectOptions {
  project: SerializableProject;
  projectFilePath: string;
  projectRootPath: string;
}

export interface SaveProjectResult {
  project: SerializableProject;
  projectFilePath: string;
  projectRootPath: string;
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

export function isSerializableProject(value: unknown): value is SerializableProject {
  if (!isRecord(value) || !isRecord(value.sourceAudio) || !isRecord(value.workspace)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.sourceAudio.id === "string" &&
    typeof value.sourceAudio.name === "string" &&
    Number.isFinite(value.sourceAudio.durationMs) &&
    Number.isFinite(value.sourceAudio.sampleRate) &&
    Number.isFinite(value.sourceAudio.channelCount) &&
    typeof value.sourceAudio.filePath === "string" &&
    Array.isArray(value.assets) &&
    Array.isArray(value.analysisRuns) &&
    Array.isArray(value.annotations)
  );
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
  const audioFileName = sanitizeFileName(
    project.sourceAudio.name || path.basename(project.sourceAudio.filePath)
  );
  const relativeAudioPath = toProjectRelativePath(AUDIO_DIRECTORY_NAME, audioFileName);
  const copiedAudioPath = path.join(audioDirectoryPath, audioFileName);
  let createdProjectRoot = false;

  try {
    await fs.mkdir(projectRootPath);
    createdProjectRoot = true;
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
    if (createdProjectRoot) {
      await fs.rm(projectRootPath, { recursive: true, force: true });
    }
    throw new Error("Failed to save project.");
  }
}

export async function saveExistingProject({
  project,
  projectFilePath,
  projectRootPath
}: SaveExistingProjectOptions): Promise<SaveProjectResult> {
  if (
    !isProjectFilePathInRoot(projectFilePath, projectRootPath) ||
    !isProjectRelativePath(project.sourceAudio.filePath)
  ) {
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

  if (!isProjectRelativePath(payload.project.sourceAudio.filePath)) {
    throw new Error("Failed to load project audio.");
  }

  const audioPath = path.join(projectRootPath, ...payload.project.sourceAudio.filePath.split("/"));

  try {
    const audioFile = await fs.readFile(audioPath);

    return {
      project: payload.project,
      projectFilePath,
      projectRootPath,
      audioData: toArrayBuffer(audioFile)
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

function isProjectFilePathInRoot(projectFilePath: string, projectRootPath: string) {
  if (path.extname(projectFilePath) !== PROJECT_FILE_EXTENSION) {
    return false;
  }

  const normalizedProjectFileDirectory = path.normalize(path.resolve(path.dirname(projectFilePath)));
  const normalizedProjectRootPath = path.normalize(path.resolve(projectRootPath));
  return normalizedProjectFileDirectory === normalizedProjectRootPath;
}

function isProjectRelativePath(value: string) {
  if (
    value.includes("\\") ||
    value.includes("\0") ||
    path.isAbsolute(value) ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    /^[A-Za-z]:/.test(value)
  ) {
    return false;
  }

  const segments = value.split("/");
  return segments.every(
    (segment) => segment !== "" && segment !== "." && segment !== ".." && !segment.includes(":")
  );
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

function isZiqiProjectPayload(value: unknown): value is ZiqiProjectPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.format === PROJECT_FORMAT &&
    value.schemaVersion === PROJECT_SCHEMA_VERSION &&
    isSerializableProject(value.project)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
