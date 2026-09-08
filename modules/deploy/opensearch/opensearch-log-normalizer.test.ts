import { describe, expect, it } from "bun:test"
import { normalizeOpenSearchLogDoc } from "./opensearch-log-normalizer"

describe("opensearch-log-normalizer", () => {
  it("normalizes standard Laravel stdout log with keyword level", () => {
    const hit = {
      _id: "doc-1",
      _source: {
        "@timestamp": "2026-09-08T22:18:01.747Z",
        stream: "stdout",
        message: "   INFO  No scheduled commands are ready to run.  ",
        kubernetes: {
          namespace_name: "app-metacard-prod",
          container_name: "deploy",
          pod_name: "metacard-prod-schedule-1234",
        },
      },
    }

    const result = normalizeOpenSearchLogDoc(hit)
    expect(result.id).toBe("doc-1")
    expect(result.level).toBe("INFO")
    expect(result.source).toBe("deploy")
    expect(result.message).toBe("INFO  No scheduled commands are ready to run.")
    expect(result.timestamp).toBe("22:18:01")
  })

  it("normalizes NestJS log with ANSI color sequences and strip them", () => {
    const hit = {
      _id: "doc-2",
      _source: {
        "@timestamp": "2026-09-08T22:20:00.022Z",
        stream: "stdout",
        message:
          "\u001b[95m[Nest] 1  - \u001b[39m09/09/2026, 5:20:00 AM \u001b[95m  DEBUG\u001b[39m \u001b[38;5;3m[PaymentProcessor] \u001b[39m\u001b[95mRunning payment check...\u001b[39m",
        kubernetes: {
          namespace_name: "app-jarinx",
          container_name: "deploy",
        },
      },
    }

    const result = normalizeOpenSearchLogDoc(hit)
    expect(result.message).toBe(
      "[Nest] 1  - 09/09/2026, 5:20:00 AM   DEBUG [PaymentProcessor] Running payment check..."
    )
    expect(result.level).toBe("INFO")
  })

  it("normalizes Pino numeric level 40 as WARN and extracts msg field", () => {
    const hit = {
      _id: "doc-3",
      _source: {
        "@timestamp": "2026-09-08T22:19:40.447Z",
        level: 40,
        context: "FarmActionService",
        msg: "recovery: order chain-scan failed",
        kubernetes: {
          namespace_name: "app-metagocoin-api",
          container_name: "deploy",
        },
      },
    }

    const result = normalizeOpenSearchLogDoc(hit)
    expect(result.level).toBe("WARN")
    expect(result.message).toBe("recovery: order chain-scan failed")
    expect(result.source).toBe("deploy")
  })

  it("normalizes Pino numeric level 50 as ERROR", () => {
    const hit = {
      _id: "doc-4",
      _source: {
        "@timestamp": "2026-09-08T22:19:40.447Z",
        level: 50,
        msg: "unhandled exception in worker",
      },
    }

    const result = normalizeOpenSearchLogDoc(hit)
    expect(result.level).toBe("ERROR")
    expect(result.message).toBe("unhandled exception in worker")
  })

  it("normalizes stderr stream as ERROR if no explicit level", () => {
    const hit = {
      _id: "doc-5",
      _source: {
        "@timestamp": "2026-09-08T22:19:40.447Z",
        stream: "stderr",
        message: "something went wrong in stderr",
      },
    }

    const result = normalizeOpenSearchLogDoc(hit)
    expect(result.level).toBe("ERROR")
  })

  it("stringifies object message safely", () => {
    const hit = {
      _id: "doc-6",
      _source: {
        "@timestamp": "2026-09-08T22:19:40.447Z",
        message: { error: "upstream timeout", code: 504 },
      },
    }

    const result = normalizeOpenSearchLogDoc(hit)
    expect(result.message).toContain('"error":"upstream timeout"')
    expect(result.level).toBe("ERROR")
  })

  it("handles empty source and falls back gracefully", () => {
    const hit = {
      _id: "doc-7",
      _source: {},
    }

    const result = normalizeOpenSearchLogDoc(hit)
    expect(result.source).toBe("app")
    expect(result.level).toBe("INFO")
    expect(result.message).toBe("")
    expect(result.timestamp).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })
})
