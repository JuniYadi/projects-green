import { describe, expect, mock, test } from "bun:test"

const mockCleanStale = mock(async () => 2)
mock.module("./vpn-mobile-session.service", () => ({
  vpnMobileSessionService: {
    cleanStale: mockCleanStale,
  },
}))

const { startStaleSessionCleanup, stopStaleSessionCleanup } =
  await import("./stale-cleanup")

describe("staleSessionCleanup", () => {
  test("starts and runs cleanup without errors", async () => {
    startStaleSessionCleanup()
    expect(mockCleanStale).toHaveBeenCalled()
    stopStaleSessionCleanup()
  })
})
