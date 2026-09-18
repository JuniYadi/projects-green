import { describe, expect, it } from "bun:test"
import {
  formatTunablesForAiPrompt,
  getRuntimeTunableKnowledge,
  normalizeFrameworkId,
  resolvePlatformContract,
} from "./platform-runtime-contract"

describe("platform-runtime-contract", () => {
  it("normalizes framework identifiers correctly", () => {
    expect(normalizeFrameworkId("Laravel 13.x")).toBe("laravel")
    expect(normalizeFrameworkId("Next.js 15")).toBe("nextjs")
    expect(normalizeFrameworkId("Bun Standalone")).toBe("bun")
    expect(normalizeFrameworkId("Node.js 20")).toBe("node")
    expect(normalizeFrameworkId("Express")).toBe("node")
    expect(normalizeFrameworkId(null)).toBe("default")
    expect(normalizeFrameworkId("")).toBe("default")
  })

  it("resolves Laravel contract with port 8080, UID 10001, /healthz, and tunables", () => {
    const contract = resolvePlatformContract("laravel")
    expect(contract.containerPort).toBe(8080)
    expect(contract.runAsNonRoot).toBe(true)
    expect(contract.runAsUser).toBe(10001)
    expect(contract.runAsGroup).toBe(10001)
    expect(contract.capabilitiesDrop).toEqual(["ALL"])
    expect(contract.livenessProbe.path).toBe("/healthz")
    expect(contract.livenessProbe.port).toBe(8080)

    const uploadTunable = contract.tunables.find(
      (t) => t.key === "PHP_UPLOAD_MAX_FILESIZE"
    )
    expect(uploadTunable).toBeDefined()
    expect(uploadTunable?.default).toBe("64M")
    expect(uploadTunable?.troubleshooting).toContain("HTTP 413")

    const roleTunable = contract.tunables.find((t) => t.key === "CONTAINER_ROLE")
    expect(roleTunable).toBeDefined()
    expect(roleTunable?.options).toContain("worker")
    expect(roleTunable?.options).toContain("horizon")
  })

  it("resolves Next.js contract with port 8080, UID 10001, / probe", () => {
    const contract = resolvePlatformContract("Next.js 15")
    expect(contract.containerPort).toBe(8080)
    expect(contract.runAsUser).toBe(10001)
    expect(contract.livenessProbe.path).toBe("/")
  })

  it("falls back to default contract with port 8080 and UID 10001 for unknown frameworks", () => {
    const contract = resolvePlatformContract("custom-docker-app")
    expect(contract.containerPort).toBe(8080)
    expect(contract.runAsUser).toBe(10001)
    expect(contract.runAsGroup).toBe(10001)
  })

  it("formats tunables for AI prompt with actionable instructions", () => {
    const tunables = getRuntimeTunableKnowledge("Laravel 13.x")
    expect(tunables.length).toBeGreaterThan(0)
    expect(tunables.some((t) => t.key === "PHP_UPLOAD_MAX_FILESIZE")).toBe(true)

    const promptText = formatTunablesForAiPrompt("Laravel 13.x")
    expect(promptText).toContain("PHP_UPLOAD_MAX_FILESIZE")
    expect(promptText).toContain("CONTAINER_ROLE")
    expect(promptText).toContain("8080")
    expect(promptText).toContain("HTTP 413")
  })
})
