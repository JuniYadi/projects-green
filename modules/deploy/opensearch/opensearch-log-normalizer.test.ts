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

  it("normalizes Pino numeric level 30 or lower as INFO", () => {
    const hit = {
      _id: "doc-4b",
      _source: {
        level: 30,
        msg: "standard request completed",
      },
    }

    const result = normalizeOpenSearchLogDoc(hit)
    expect(result.level).toBe("INFO")
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

  it("resolves string levels correctly", () => {
    expect(
      normalizeOpenSearchLogDoc({
        _source: { level: "fatal", message: "disk full" },
      }).level
    ).toBe("ERROR")

    expect(
      normalizeOpenSearchLogDoc({
        _source: { level: "crit", message: "system alert" },
      }).level
    ).toBe("ERROR")

    expect(
      normalizeOpenSearchLogDoc({
        _source: { level: "emerg", message: "kernel panic" },
      }).level
    ).toBe("ERROR")

    expect(
      normalizeOpenSearchLogDoc({
        _source: { level: "warning", message: "low memory" },
      }).level
    ).toBe("WARN")

    expect(
      normalizeOpenSearchLogDoc({
        _source: { level: "debug", message: "debugging hook" },
      }).level
    ).toBe("INFO")
  })

  it("infers level from message text patterns", () => {
    expect(
      normalizeOpenSearchLogDoc({
        _source: { message: "CRITICAL: power failure detected" },
      }).level
    ).toBe("ERROR")

    expect(
      normalizeOpenSearchLogDoc({
        _source: { message: "job FAILED after 3 attempts" },
      }).level
    ).toBe("ERROR")

    expect(
      normalizeOpenSearchLogDoc({
        _source: { message: "unhandled EXCEPTION in thread" },
      }).level
    ).toBe("ERROR")

    expect(
      normalizeOpenSearchLogDoc({
        _source: { message: "[WARN] Redis latency spike" },
      }).level
    ).toBe("WARN")
  })

  it("resolves timestamps from alternative fields and handles invalid dates", () => {
    const fromEpoch = normalizeOpenSearchLogDoc({
      _source: { time: 1757379481000, message: "epoch test" },
    })
    expect(fromEpoch.timestamp).toBe("00:58:01")
    expect(fromEpoch.isoTimestamp).toBeDefined()

    const fromField = normalizeOpenSearchLogDoc({
      _source: { timestamp: "2026-09-08T12:30:45.000Z", message: "field test" },
    })
    expect(fromField.timestamp).toBe("12:30:45")

    const fromInvalid = normalizeOpenSearchLogDoc({
      _source: { timestamp: "invalid-date-string", message: "invalid date" },
    })
    expect(fromInvalid.timestamp).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(fromInvalid.isoTimestamp).toBeDefined()
  })

  it("resolves source across k8s labels, pod_name, context, source, and hostname", () => {
    const fromLabel = normalizeOpenSearchLogDoc({
      _source: {
        kubernetes: {
          labels: {
            "app.kubernetes.io/instance": "k8s-instance-svc",
          },
        },
      },
    })
    expect(fromLabel.source).toBe("k8s-instance-svc")

    const fromPod = normalizeOpenSearchLogDoc({
      _source: {
        kubernetes: {
          pod_name: "nginx-ingress-pod-1",
        },
      },
    })
    expect(fromPod.source).toBe("nginx-ingress-pod-1")

    const fromContext = normalizeOpenSearchLogDoc({
      _source: { context: "auth-module" },
    })
    expect(fromContext.source).toBe("auth-module")

    const fromSource = normalizeOpenSearchLogDoc({
      _source: { source: "sidecar-proxy" },
    })
    expect(fromSource.source).toBe("sidecar-proxy")

    const fromHostname = normalizeOpenSearchLogDoc({
      _source: { hostname: "worker-node-4" },
    })
    expect(fromHostname.source).toBe("worker-node-4")
  })

  it("resolves message from log field, numbers, and un-stringifiable objects", () => {
    const fromLog = normalizeOpenSearchLogDoc({
      _source: { log: "message from log field" },
    })
    expect(fromLog.message).toBe("message from log field")

    const fromNumber = normalizeOpenSearchLogDoc({
      _source: { message: 404 },
    })
    expect(fromNumber.message).toBe("404")

    const circularObj: Record<string, unknown> = { key: "circular" }
    circularObj.self = circularObj
    const fromCircular = normalizeOpenSearchLogDoc({
      _source: { message: circularObj },
    })
    expect(fromCircular.message).toContain("[object Object]")
  })

  it("formats Fastify/Pino request completed with method, url, status, and latency", () => {
    const hit = {
      _id: "doc-fastify",
      _source: {
        msg: "request completed",
        req: { method: "GET", url: "/wallet/balance" },
        res: { statusCode: 200 },
        responseTime: 85,
      },
    }
    const result = normalizeOpenSearchLogDoc(hit)
    expect(result.message).toBe("GET /wallet/balance 200 in 85ms")
    expect(result.level).toBe("INFO")
  })

  it("infers ERROR level from HTTP status 500 in res.statusCode", () => {
    const hit = {
      _id: "doc-500",
      _source: {
        msg: "server error occurred",
        res: { statusCode: 500 },
      },
    }
    const result = normalizeOpenSearchLogDoc(hit)
    expect(result.level).toBe("ERROR")
  })

  it("infers WARN level from HTTP status 404 in res.statusCode", () => {
    const hit = {
      _id: "doc-404",
      _source: {
        msg: "route not found",
        res: { statusCode: 404 },
      },
    }
    const result = normalizeOpenSearchLogDoc(hit)
    expect(result.level).toBe("WARN")
  })

  it("handles object message by stringifying it", () => {
    const hit = {
      _id: "doc-obj",
      _source: {
        message: { error: "Crash", code: 1 },
      },
    }
    const result = normalizeOpenSearchLogDoc(hit)
    expect(result.message).toBe('{"error":"Crash","code":1}')
  })

  it("falls back to req method and url when message is absent", () => {
    const hit = {
      _id: "doc-req-only",
      _source: {
        req: { method: "POST", url: "/submit" },
      },
    }
    const result = normalizeOpenSearchLogDoc(hit)
    expect(result.message).toBe("POST /submit")
  })
})
