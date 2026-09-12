import { describe, expect, it, mock } from "bun:test"
import RedirectToWebhookLogsTab from "./page"

const mockRedirect = mock((_url: string) => {})

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}))

describe("RedirectToWebhookLogsTab", () => {
  it("redirects to the unified logs page", async () => {
    await RedirectToWebhookLogsTab({ params: Promise.resolve({ lang: "en" }) })
    expect(mockRedirect).toHaveBeenCalledWith("/en/console/whatsapp/logs")
  })
})
