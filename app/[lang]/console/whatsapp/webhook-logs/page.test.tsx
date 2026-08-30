import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import RedirectToWebhookLogsTab from "./page"

const mockReplace = mock(() => {})

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(() => {}),
    replace: mockReplace,
  }),
  useParams: () => ({ lang: "en" }),
  useSearchParams: () => new URLSearchParams(),
}))

describe("RedirectToWebhookLogsTab", () => {
  it("redirects to the unified logs page", () => {
    render(<RedirectToWebhookLogsTab />)
    expect(mockReplace).toHaveBeenCalledWith("/en/console/whatsapp/logs")
  })
})
