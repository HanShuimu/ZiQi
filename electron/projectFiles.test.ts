import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createZiqiProjectPayload,
  isSerializableProject,
  openProjectFromFile,
  parseZiqiProjectPayload,
  saveExistingProject,
  saveNewProject
} from "./projectFiles.js";

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

  it("identifies serializable project shapes", () => {
    expect(isSerializableProject(project)).toBe(true);
    expect(
      isSerializableProject({
        ...project,
        name: undefined
      })
    ).toBe(false);
    expect(
      isSerializableProject({
        ...project,
        assets: undefined
      })
    ).toBe(false);
    expect(
      isSerializableProject({
        ...project,
        workspace: undefined
      })
    ).toBe(false);
    expect(
      isSerializableProject({
        ...project,
        workspace: []
      })
    ).toBe(false);
    expect(
      isSerializableProject({
        ...project,
        sourceAudio: {
          ...project.sourceAudio,
          durationMs: Number.NaN
        }
      })
    ).toBe(false);
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

  it("rejects .ziqi payloads with invalid project shapes", () => {
    const payload = createZiqiProjectPayload(project);

    expect(() =>
      parseZiqiProjectPayload(
        JSON.stringify({
          ...payload,
          project: {
            ...project,
            workspace: []
          }
        })
      )
    ).toThrow("Failed to open project.");
    expect(() =>
      parseZiqiProjectPayload(
        JSON.stringify({
          ...payload,
          project: {
            ...project,
            sourceAudio: {
              ...project.sourceAudio,
              durationMs: Number.NaN
            }
          }
        })
      )
    ).toThrow("Failed to open project.");
    expect(() =>
      parseZiqiProjectPayload(
        JSON.stringify({
          ...payload,
          project: {
            ...project,
            sourceAudio: {
              ...project.sourceAudio,
              sampleRate: Number.POSITIVE_INFINITY
            }
          }
        })
      )
    ).toThrow("Failed to open project.");
    expect(() =>
      parseZiqiProjectPayload(
        JSON.stringify({
          ...payload,
          project: {
            ...project,
            sourceAudio: {
              ...project.sourceAudio,
              channelCount: Number.NEGATIVE_INFINITY
            }
          }
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
    await expect(
      fs.readFile(path.join(result.projectRootPath, "audio", "demo track.wav"))
    ).resolves.toEqual(Buffer.from([1, 2, 3, 4]));

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

  it("cleans up a newly created project folder when source audio is missing", async () => {
    const projectRootPath = path.join(tempDir, "Demo Track.ziqiproject");

    await expect(
      saveNewProject({
        parentDirectoryPath: tempDir,
        project
      })
    ).rejects.toThrow("Failed to save project.");
    await expect(fs.stat(projectRootPath)).rejects.toThrow();
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
    await expect(
      fs.readFile(path.join(saved.projectRootPath, "audio", "demo track.wav"))
    ).resolves.toEqual(Buffer.from([1, 2, 3, 4]));
  });

  it("rejects existing project saves outside the project root or with a wrong extension", async () => {
    const projectRootPath = path.join(tempDir, "Demo Track.ziqiproject");
    await fs.mkdir(projectRootPath);
    const safeProject = {
      ...project,
      sourceAudio: {
        ...project.sourceAudio,
        filePath: "audio/demo track.wav"
      }
    };

    await expect(
      saveExistingProject({
        project: safeProject,
        projectFilePath: path.join(tempDir, "Demo Track.ziqi"),
        projectRootPath
      })
    ).rejects.toThrow("Failed to save project.");
    await expect(
      saveExistingProject({
        project: safeProject,
        projectFilePath: path.join(projectRootPath, "Nested", "Demo Track.ziqi"),
        projectRootPath
      })
    ).rejects.toThrow("Failed to save project.");
    await expect(
      saveExistingProject({
        project: safeProject,
        projectFilePath: path.join(projectRootPath, "Demo Track.json"),
        projectRootPath
      })
    ).rejects.toThrow("Failed to save project.");
  });

  it("rejects existing project saves with unsafe project audio paths", async () => {
    const projectRootPath = path.join(tempDir, "Demo Track.ziqiproject");
    await fs.mkdir(projectRootPath);
    const projectFilePath = path.join(projectRootPath, "Demo Track.ziqi");
    const unsafeAudioPaths = [
      "/abs.wav",
      "C:\\abs.wav",
      "..\\escape.wav",
      "audio\\..\\..\\escape.wav",
      "C:drive-relative.wav",
      "audio/bad:name.wav"
    ];

    for (const filePath of unsafeAudioPaths) {
      await expect(
        saveExistingProject({
          project: {
            ...project,
            sourceAudio: {
              ...project.sourceAudio,
              filePath
            }
          },
          projectFilePath,
          projectRootPath
        })
      ).rejects.toThrow("Failed to save project.");
    }
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

  it("throws a stable error when project audio paths are unsafe", async () => {
    const projectRootPath = path.join(tempDir, "Unsafe Audio.ziqiproject");
    await fs.mkdir(projectRootPath);
    const unsafeAudioPaths = ["../escape.wav", "C:drive-relative.wav", "audio/bad:name.wav"];

    for (const [index, filePath] of unsafeAudioPaths.entries()) {
      const projectFilePath = path.join(projectRootPath, `Unsafe Audio ${index}.ziqi`);
      await fs.writeFile(
        projectFilePath,
        JSON.stringify(
          createZiqiProjectPayload({
            ...project,
            name: "Unsafe Audio",
            sourceAudio: {
              ...project.sourceAudio,
              filePath
            }
          })
        )
      );

      await expect(openProjectFromFile(projectFilePath)).rejects.toThrow(
        "Failed to load project audio."
      );
    }
  });
});
