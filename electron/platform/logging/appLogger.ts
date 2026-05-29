import fs from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { LogDetails, LogEntry, LogSink } from "./logTypes.js";

export interface AppLogger {
  readonly logFilePath: string;
  trace(event: string, message: string, details?: LogDetails): void;
  appendRendererEntry(entry: LogEntry): void;
}

export interface CreateAppLoggerOptions {
  programRootPath: string;
  now?: () => Date;
  consoleSink?: LogSink;
}

export async function createAppLogger({
  programRootPath,
  now = () => new Date(),
  consoleSink = console
}: CreateAppLoggerOptions): Promise<AppLogger> {
  const logsDir = path.join(programRootPath, "logs");
  const logFilePath = path.join(logsDir, formatLogFileName(now()));
  let fileOutputEnabled = true;

  try {
    await mkdir(logsDir, { recursive: true });
    await appendFile(logFilePath, "", "utf8");
  } catch (error) {
    fileOutputEnabled = false;
    consoleSink.warn(`Application log file unavailable: ${getErrorMessage(error)}`);
  }

  const writeLine = (entry: LogEntry) => {
    const line = formatLogLine({
      ...entry,
      timestamp: entry.timestamp ?? formatTimestamp(now())
    });

    consoleSink.trace(line);

    if (!fileOutputEnabled) {
      return;
    }

    try {
      fs.appendFileSync(logFilePath, `${line}\n`, "utf8");
    } catch (error) {
      fileOutputEnabled = false;
      consoleSink.warn(`Application log file unavailable: ${getErrorMessage(error)}`);
    }
  };

  return {
    logFilePath,
    trace(event, message, details) {
      writeLine({
        area: "main",
        level: "trace",
        event,
        message,
        details
      });
    },
    appendRendererEntry(entry) {
      writeLine({
        ...entry,
        area: "renderer",
        level: "trace"
      });
    }
  };
}

export function formatLogFileName(date: Date): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());
  const seconds = padDatePart(date.getSeconds());

  return `Ziqi-${year}${month}${day}-${hours}${minutes}${seconds}.log`;
}

export function formatLogLine(entry: LogEntry): string {
  const timestamp = entry.timestamp ?? formatTimestamp(new Date());
  const level = entry.level ?? "trace";
  const detailsPart = formatDetailsPart(entry.details);

  return `${timestamp} [${entry.area}] ${level.toUpperCase()} ${entry.event}${detailsPart} ${JSON.stringify(entry.message)}`;
}

function formatDetailsPart(details: LogDetails | undefined): string {
  if (!details) {
    return "";
  }

  const serializedDetails = Object.entries(details)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${formatDetailValue(value)}`);

  return serializedDetails.length > 0 ? ` ${serializedDetails.join(" ")}` : "";
}

function formatDetailValue(value: Exclude<LogDetails[string], undefined>): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());
  const seconds = padDatePart(date.getSeconds());
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  const offsetHours = padDatePart(Math.floor(absoluteOffsetMinutes / 60));
  const offsetRemainingMinutes = padDatePart(absoluteOffsetMinutes % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${offsetSign}${offsetHours}:${offsetRemainingMinutes}`;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
