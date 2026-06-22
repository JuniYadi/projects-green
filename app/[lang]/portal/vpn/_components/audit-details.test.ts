import { describe, expect, it } from "bun:test"

import {
  actionTone,
  extractAuditDetails,
} from "./audit-details"

describe("extractAuditDetails", () => {
  it("returns empty rows when details is null and no columns are populated", () => {
    const { rows, other } = extractAuditDetails({ details: null })
    expect(rows).toEqual([])
    expect(other).toEqual([])
  })

  it("uses top-level columns when details is missing", () => {
    const { rows } = extractAuditDetails({
      details: null,
      step: "ssh_connecting",
      status: "OK",
      serverAccountId: "srv_1",
    })
    const labels = rows.map((r) => r.label)
    expect(labels).toContain("Step")
    expect(labels).toContain("Status")
    expect(labels).toContain("Server account")
    const stepRow = rows.find((r) => r.label === "Step")
    expect(stepRow?.value).toBe("ssh_connecting")
    const statusRow = rows.find((r) => r.label === "Status")
    expect(statusRow?.tone).toBe("success")
  })

  it("prefers details payload over top-level columns when both exist", () => {
    const { rows } = extractAuditDetails({
      details: { step: "creating_client", status: "FAILED" },
      step: "ssh_connecting",
      status: "OK",
    })
    const stepRow = rows.find((r) => r.label === "Step")
    expect(stepRow?.value).toBe("creating_client")
    const statusRow = rows.find((r) => r.label === "Status")
    expect(statusRow?.value).toBe("FAILED")
    expect(statusRow?.tone).toBe("danger")
  })

  it("renders known keys in canonical order", () => {
    const { rows } = extractAuditDetails({
      details: {
        serverName: "vpn-sgp-01",
        protocol: "OPENVPN",
        host: "1.2.3.4",
        port: 1194,
        durationMs: 1234,
      },
    })
    const labels = rows.map((r) => r.label)
    expect(labels).toEqual([
      "Server",
      "Protocol",
      "Host",
      "Port",
      "Duration",
    ])
    const duration = rows.find((r) => r.label === "Duration")
    expect(duration?.value).toBe("1.2s")
  })

  it("formats milliseconds and minute-scale durations", () => {
    const short = extractAuditDetails({ details: { durationMs: 250 } })
    expect(short.rows[0].value).toBe("250ms")

    const long = extractAuditDetails({ details: { durationMs: 65_000 } })
    expect(long.rows[0].value).toBe("1m 5s")
  })

  it("buckets unknown keys under other, sorted alphabetically by label", () => {
    const { other } = extractAuditDetails({
      details: {
        zetaField: "z",
        alphaField: "a",
        middleField: "m",
      },
    })
    expect(other.map((r) => r.label)).toEqual([
      "Alpha Field",
      "Middle Field",
      "Zeta Field",
    ])
  })

  it("humanizes camelCase and snake_case unknown keys", () => {
    const { other } = extractAuditDetails({
      details: {
        fooBarBaz: "x",
        some_key: "y",
        "mixed-snake_case": "z",
      },
    })
    const labels = other.map((r) => r.label)
    expect(labels).toContain("Foo Bar Baz")
    expect(labels).toContain("Some Key")
    expect(labels).toContain("Mixed Snake Case")
  })

  it("skips empty/null/undefined values", () => {
    const { rows, other } = extractAuditDetails({
      details: {
        serverName: "",
        protocol: null,
        host: undefined,
        realValue: "kept",
      },
    })
    expect(rows).toHaveLength(0)
    expect(other).toHaveLength(1)
    expect(other[0].value).toBe("kept")
  })

  it("classifies failure-ish values as danger regardless of key", () => {
    const { rows } = extractAuditDetails({
      details: {
        error: "timeout",
        failureReason: "REVOKED",
        reason: "failed",
      },
    })
    for (const row of rows) {
      expect(row.tone).toBe("danger")
    }
  })

  it("stringifies nested object values into a single-line JSON cell", () => {
    const { rows, other } = extractAuditDetails({
      details: {
        serverName: "ok",
        extraPayload: { nested: { deep: [1, 2, 3] } },
      },
    })
    const extra = other.find((r) => r.label === "Extra Payload")
    expect(extra?.value).toBe(JSON.stringify({ nested: { deep: [1, 2, 3] } }))
    expect(rows.map((r) => r.label)).toEqual(["Server"])
  })

  it("does not crash when details is a non-object primitive", () => {
    // The runtime may pass through an arbitrary JSON scalar; we must not throw.
    const result = extractAuditDetails({
      details: "not-an-object" as unknown as Record<string, unknown>,
    })
    expect(result.rows).toEqual([])
    expect(result.other).toEqual([])
  })
})

describe("actionTone", () => {
  it("maps success-like actions to success", () => {
    expect(actionTone("PROVISIONING_SUCCESS")).toBe("success")
    expect(actionTone("registered")).toBe("success")
    expect(actionTone("CONFIG_DOWNLOADED")).toBe("success")
  })

  it("maps failure and revocation to danger", () => {
    expect(actionTone("PROVISIONING_FAILED")).toBe("danger")
    expect(actionTone("REVOKED")).toBe("danger")
  })

  it("maps retry and in-progress actions to warning", () => {
    expect(actionTone("PROVISIONING_RETRIED")).toBe("warning")
    expect(actionTone("PROVISIONING_STARTED")).toBe("warning")
    expect(actionTone("PROVISIONING_STEP")).toBe("warning")
  })

  it("falls back to neutral for unknown actions", () => {
    expect(actionTone("SOMETHING_NEW")).toBe("neutral")
  })
})
