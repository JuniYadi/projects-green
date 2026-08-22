import { describe, expect, test, mock } from "bun:test"

// Mock Next.js navigation hooks
mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: () => ({ push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}))

describe("Portal AI Governance Pages Rendering Smoke Test", () => {
  test("Imports Portal AI Overview Page without crash", async () => {
    const { default: PortalAiGovernancePage } = await import("./page")
    expect(typeof PortalAiGovernancePage).toBe("function")
  })

  test("Imports Portal AI Sessions Page without crash", async () => {
    const { default: PortalAiSessionsPage } = await import("./sessions/page")
    expect(typeof PortalAiSessionsPage).toBe("function")
  })

  test("Imports Portal AI Forensic Transcript Page without crash", async () => {
    const { default: ForensicTranscriptPage } =
      await import("./sessions/[sessionId]/page")
    expect(typeof ForensicTranscriptPage).toBe("function")
  })

  test("Imports Portal AI Bans Page without crash", async () => {
    const { default: PortalAiBansPage } = await import("./bans/page")
    expect(typeof PortalAiBansPage).toBe("function")
  })
})
