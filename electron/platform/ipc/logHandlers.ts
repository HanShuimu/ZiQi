import { ipcMain } from "electron";
import type { AppLogger } from "../logging/appLogger.js";
import type { LogDetails, LogEntry } from "../logging/logTypes.js";

export function registerLogHandlers(logger: AppLogger): void {
  ipcMain.on("log:renderer", (_event, entry) => {
    if (isRendererLogEntry(entry)) {
      logger.appendRendererEntry(createRendererLogEntry(entry));
      return;
    }

    logger.trace("log.renderer.invalid", "Ignored invalid renderer log entry");
  });
}

function isRendererLogEntry(entry: unknown): entry is LogEntry {
  if (!isPlainObject(entry)) {
    return false;
  }

  return (
    entry.area === "renderer" &&
    typeof entry.event === "string" &&
    typeof entry.message === "string" &&
    (entry.details === undefined || isLogDetails(entry.details))
  );
}

function createRendererLogEntry(entry: LogEntry): LogEntry {
  return {
    area: "renderer",
    level: "trace",
    event: entry.event,
    message: entry.message,
    ...(entry.details === undefined ? {} : { details: entry.details })
  };
}

function isLogDetails(details: unknown): details is LogDetails {
  return isPlainObject(details);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
