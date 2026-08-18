import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
  test,
} from "bun:test"
import type { Mock } from "bun:test"

import { type JsonLogRecord, writeJsonLogLine } from "@/lib/server-logging"

type JsonObject = Record<string, unknown>

type CapturedLogWriter = Mock<(chunk: string) => unknown>

type CapturedLogStream = {
  write: CapturedLogWriter
}

const parseCapturedRecord = (stream: CapturedLogStream): JsonObject => {
  const [line] = stream.write.mock.calls[0] as [string]
  expect(line.endsWith("\n")).toBe(true)
  return JSON.parse(line) as JsonObject
}

describe.serial("server JSON logging", () => {
  let stderrWrite: { mockRestore: () => void } | undefined

  beforeEach(() => {
    stderrWrite = spyOn(process.stderr, "write").mockImplementation(() => true)
  })

  afterEach(() => {
    stderrWrite?.mockRestore()
    stderrWrite = undefined
  })

  test("writes a JSON record and newline to a custom stream", () => {
    const stream: CapturedLogStream = { write: mock(() => true) }
    const record: JsonLogRecord = {
      event: "server.started",
      level: "info",
      service: "web",
    }

    writeJsonLogLine(record, stream)

    expect(stream.write).toHaveBeenCalledTimes(1)
    expect(stream.write).toHaveBeenCalledWith(`${JSON.stringify(record)}\n`)
    expect(stderrWrite).not.toHaveBeenCalled()
  })

  it("writes to process.stderr when no stream is provided", () => {
    const record: JsonLogRecord = {
      event: "server.started",
      level: "info",
      service: "web",
    }

    writeJsonLogLine(record)

    expect(stderrWrite).toHaveBeenCalledTimes(1)
    expect(stderrWrite).toHaveBeenCalledWith(`${JSON.stringify(record)}\n`)
  })

  it("writes a fallback record when JSON serialization fails", () => {
    const stream: CapturedLogStream = { write: mock(() => true) }
    const record = {
      event: "server.started",
      level: "info",
      service: "workers",
      value: BigInt(42),
    } as unknown as JsonLogRecord

    writeJsonLogLine(record, stream)

    const fallback = parseCapturedRecord(stream)
    expect(fallback.event).toBe("server.logging.serialization_failed")
    expect(fallback.level).toBe("error")
    expect(fallback.service).toBe("workers")
    expect(fallback.timestamp).toEqual(expect.any(String))
    const timestamp = fallback.timestamp as string
    expect(new Date(timestamp).toISOString()).toBe(timestamp)
  })

  it("writes a fallback record when reading the malformed record throws", () => {
    const stream: CapturedLogStream = { write: mock(() => true) }
    const malformed = {
      get service(): never {
        throw new Error("malformed record")
      },
    } as unknown as JsonLogRecord

    writeJsonLogLine(malformed, stream)

    const fallback = parseCapturedRecord(stream)
    expect(fallback.event).toBe("server.logging.serialization_failed")
    expect(fallback.level).toBe("error")
    expect(fallback.timestamp).toEqual(expect.any(String))
    expect(fallback).not.toHaveProperty("service")
    const timestamp = fallback.timestamp as string
    expect(new Date(timestamp).toISOString()).toBe(timestamp)
  })
})
