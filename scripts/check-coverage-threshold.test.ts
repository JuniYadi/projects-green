import { describe, expect, it } from "bun:test"

import {
  collectCoverageSummary,
  streamAndCollect,
  stripAnsi,
} from "./check-coverage-threshold"

describe("stripAnsi", () => {
  it("removes ANSI color sequences", () => {
    expect(stripAnsi("\u001b[31mFAIL\u001b[0m")).toBe("FAIL")
  })
})

describe("collectCoverageSummary", () => {
  it("averages per-file coverage while skipping excluded paths", () => {
    const summary = collectCoverageSummary(`
modules/foo.ts | 100 | 80
modules/bar.ts | 90 | 70
modules/deploy/hidden.ts | 0 | 0
app/whatsapp/skip.ts | 0 | 0
All files | 95 | 75
`)

    expect(summary).toEqual({
      functionCoverage: 95,
      lineCoverage: 75,
      fileCount: 2,
    })
  })
})

describe("streamAndCollect", () => {
  it("mirrors chunks while collecting the full output", async () => {
    const chunks: string[] = []
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("hello "))
        controller.enqueue(new TextEncoder().encode("world"))
        controller.close()
      },
    })

    const output = await streamAndCollect(stream, (chunk) => {
      chunks.push(chunk)
    })

    expect(output).toBe("hello world")
    expect(chunks).toEqual(["hello ", "world"])
  })
})
