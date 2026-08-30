import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import RedirectToAuditLogsTab from "./page"

const mockReplace = mock(() => {})

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(() => {}),
    replace: mockReplace,
  }),
  useParams: () => ({ lang: "en" }),
  useSearchParams: () => new URLSearchParams(),
}))

describe("RedirectToAuditLogsTab", () => {
  it("redirects to the unified logs page with audit tab query", () => {
    render(<RedirectToAuditLogsTab />)
    expect(mockReplace).toHaveBeenCalledWith(
      "/en/console/whatsapp/logs?tab=audit"
    )
  })
})
