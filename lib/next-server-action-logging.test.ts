import { afterEach, describe, expect, mock, test } from "bun:test"

import {
  installNextServerActionDiagnostics,
  NEXT_SERVER_ACTION_MISMATCH_MESSAGE,
} from "@/lib/next-server-action-logging"
import { writeJsonLogLine } from "@/lib/server-logging"

type CapturedRecord = Record<string, unknown>

type CapturedStream = {
  chunks: string[]
  write: (chunk: string) => boolean
}

const createStream = (): CapturedStream => ({
  chunks: [],
  write(chunk) {
    this.chunks.push(chunk)
    return true
  },
})

const parseRecords = (stream: CapturedStream): CapturedRecord[] =>
  stream.chunks.map((chunk) => JSON.parse(chunk) as CapturedRecord)

const matchingError = (actionId = "opaque-action-id-secret") =>
  new Error(
    `Failed to find Server Action "${actionId}". This request might be from an older or newer deployment.\nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action`
  )

describe("Next.js Server Action diagnostics", () => {
  const restores: Array<() => void> = []

  afterEach(() => {
    while (restores.length > 0) {
      restores.pop()?.()
    }
  })

  test("writes one safe stderr JSON record and suppresses the generic warning", () => {
    const stream = createStream()
    const genericWarnings: unknown[][] = []
    const target = {
      warn: mock((...args: unknown[]) => {
        genericWarnings.push(args)
      }),
    }

    restores.push(
      installNextServerActionDiagnostics({
        consoleObject: target,
        writer: (record) => writeJsonLogLine(record, stream),
      })
    )

    const error = matchingError()
    error.stack = `${error.message}\n    at secret-stack-frame`
    target.warn(error)

    expect(stream.chunks).toHaveLength(1)
    expect(stream.chunks[0]?.endsWith("\n")).toBe(true)
    const records = parseRecords(stream)
    expect(records).toHaveLength(1)
    expect(genericWarnings).toHaveLength(0)
    expect(records[0]).toMatchObject({
      event: "next.server_action.mismatch",
      level: "error",
      service: "web",
      errorCode: "SERVER_ACTION_DEPLOYMENT_MISMATCH",
      message: NEXT_SERVER_ACTION_MISMATCH_MESSAGE,
    })
    expect(Object.keys(records[0]).sort()).toEqual(
      ["errorCode", "event", "level", "message", "service", "timestamp"].sort()
    )

    const serialized = stream.chunks.join("")
    expect(serialized).not.toContain("opaque-action-id-secret")
    expect(serialized).not.toContain(error.message)
    expect(serialized).not.toContain("secret-stack-frame")
    expect(serialized).not.toContain("nextjs.org/docs/messages")
    const timestamp = String(records[0].timestamp)
    expect(new Date(timestamp).toISOString()).toBe(timestamp)
  })

  test("preserves non-matching framework warnings and the caller response", () => {
    const stream = createStream()
    const warnings: unknown[][] = []
    const target = {
      warn: (...args: unknown[]) => {
        warnings.push(args)
      },
    }
    const error = new Error("A different framework diagnostic")

    restores.push(
      installNextServerActionDiagnostics({
        consoleObject: target,
        writer: (record) => writeJsonLogLine(record, stream),
      })
    )

    const response = (() => {
      target.warn(error)
      return new Response("Server action not found.", { status: 404 })
    })()

    expect(response.status).toBe(404)
    expect(warnings).toEqual([[error]])
    expect(stream.chunks).toHaveLength(0)
  })

  test("is idempotent so a shared console wrapper cannot double-emit", () => {
    const stream = createStream()
    const target = {
      warn: (..._args: unknown[]) => undefined,
    }
    const writer = (record: Parameters<typeof writeJsonLogLine>[0]) =>
      writeJsonLogLine(record, stream)

    const firstRestore = installNextServerActionDiagnostics({
      consoleObject: target,
      writer,
    })
    const secondRestore = installNextServerActionDiagnostics({
      consoleObject: target,
      writer,
    })
    target.warn(matchingError())

    expect(parseRecords(stream)).toHaveLength(1)

    secondRestore()
    target.warn(matchingError("after-restore-action-id"))
    expect(parseRecords(stream)).toHaveLength(1)

    firstRestore()
  })
})
