import type { RendererLogEntry } from "../../types/global";

export type RendererLogDetails = NonNullable<RendererLogEntry["details"]>;

export interface RendererLogger {
  trace(event: string, message: string, details?: RendererLogDetails): void;
}

interface RendererLoggerOptions {
  app?: Pick<Window["ziqiApp"], "log">;
  consoleSink?: Pick<Console, "trace" | "warn">;
  now?: () => Date;
}

export function createRendererLogger({
  app = typeof window === "undefined" ? undefined : window.ziqiApp,
  consoleSink = console,
  now = () => new Date()
}: RendererLoggerOptions = {}): RendererLogger {
  return {
    trace(event, message, details) {
      const entry: RendererLogEntry = {
        area: "renderer",
        level: "trace",
        event,
        message,
        ...(details === undefined ? {} : { details: compactDetails(details) })
      };

      consoleSink.trace(formatConsoleLine(entry, now()));

      try {
        app?.log(entry);
      } catch (error) {
        consoleSink.warn(`ZiQi renderer log forwarding failed: ${getErrorMessage(error)}`);
      }
    }
  };
}

export const rendererLogger = createRendererLogger();

function formatConsoleLine(entry: RendererLogEntry, date: Date): string {
  const detailsPart = formatDetailsPart(entry.details);

  return `${date.toISOString()} [renderer] TRACE ${sanitizeToken(entry.event)}${detailsPart} ${JSON.stringify(entry.message)}`;
}

function formatDetailsPart(details: RendererLogDetails | undefined): string {
  if (!details) {
    return "";
  }

  const serializedDetails = Object.entries(details).flatMap(([key, value]) =>
    value === undefined ? [] : [`${sanitizeToken(key)}=${formatDetailValue(value)}`]
  );

  return serializedDetails.length > 0 ? ` ${serializedDetails.join(" ")}` : "";
}

function formatDetailValue(value: Exclude<RendererLogDetails[string], undefined>): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return String(value);
}

function compactDetails(details: RendererLogDetails): RendererLogDetails {
  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined)
  ) as RendererLogDetails;
}

function sanitizeToken(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
