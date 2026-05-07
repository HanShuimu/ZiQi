import { app, BrowserWindow, dialog, ipcMain, protocol } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "ziqi",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rendererDevUrl = process.env.ZIQI_RENDERER_DEV_URL;
const rendererDistDir = path.join(__dirname, "../dist");

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#f3efe8",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (rendererDevUrl) {
    void window.loadURL(rendererDevUrl);
    window.webContents.openDevTools({ mode: "detach" });
    return window;
  }

  void window.loadURL("ziqi://app/index.html");
  return window;
}

app.whenReady().then(() => {
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

  ipcMain.handle("app:get-version", () => app.getVersion());
  ipcMain.handle("audio:select-file", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "Audio Files",
          extensions: ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus"]
        },
        {
          name: "All Files",
          extensions: ["*"]
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];

    try {
      const file = await fs.readFile(filePath);
      return {
        audioData: file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        filePath
      };
    } catch {
      throw new Error("Failed to load audio file.");
    }
  });
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

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
