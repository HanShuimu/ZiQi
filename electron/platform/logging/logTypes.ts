export type LogArea = "main" | "preload" | "renderer";
export type LogLevel = "trace";
export type LogDetailValue = string | number | boolean | null | undefined;
export type LogDetails = Record<string, LogDetailValue>;

export interface LogEntry {
  timestamp?: string;
  area: LogArea;
  level?: LogLevel;
  event: string;
  message: string;
  details?: LogDetails;
}

export interface LogSink {
  trace(message: string): void;
  warn(message: string): void;
}
