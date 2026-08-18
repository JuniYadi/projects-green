export type JsonLogValue = boolean | number | string | null

export type JsonLogRecord = Readonly<Record<string, JsonLogValue>>

export type JsonLogWriter = (record: JsonLogRecord) => void

export type JsonLogStream = {
  write: (chunk: string) => unknown
}

const serializeRecord = (record: JsonLogRecord): string => {
  try {
    return JSON.stringify(record) ?? "{}"
  } catch {
    const fallback: Record<string, JsonLogValue> = {
      event: "server.logging.serialization_failed",
      level: "error",
      timestamp: new Date().toISOString(),
    }

    try {
      if (record.service === "web" || record.service === "workers") {
        fallback.service = record.service
      }
    } catch {
      // Keep the fallback independent of malformed record accessors.
    }

    return JSON.stringify(fallback)
  }
}

export const writeJsonLogLine = (
  record: JsonLogRecord,
  stream: JsonLogStream = process.stderr
): void => {
  stream.write(`${serializeRecord(record)}\n`)
}
