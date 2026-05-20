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
