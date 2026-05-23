import { beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

import { SupportTicketsConsole } from "@/app/[lang]/console/support-tickets/support-tickets-console"

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })

const listSuccessPayload = {
  ok: true,
  tickets: [],
}

const fetchMock = mock<
  (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
>(async (input, init) => {
  const url = String(input)
  const method = init?.method ?? "GET"

  if (url === "/api/support-tickets" && method === "GET") {
    return jsonResponse(listSuccessPayload)
  }

  if (url === "/api/support-tickets/attachments/presign" && method === "POST") {
    return jsonResponse({
      ok: true,
      attachment: {
        attachmentId: "att_1",
        expiresAt: "2026-05-22T00:00:00.000Z",
        storageBucket: "bucket-a",
        storageKey: "support/att_1",
        uploadUrl: "https://upload.example/signed-url",
      },
    })
  }

  if (url === "https://upload.example/signed-url" && method === "PUT") {
    return new Response(null, { status: 200 })
  }

  if (url === "/api/support-tickets/attachments/register" && method === "POST") {
    return jsonResponse({
      ok: true,
      attachment: {
        id: "att_1",
        fileName: "error.log",
        mimeType: "text/plain",
        sizeBytes: 11,
        storageKey: "support/att_1",
        checksumSha256: null,
        uploadedAt: "2026-05-22T00:00:00.000Z",
      },
    })
  }

  if (url === "/api/support-tickets" && method === "POST") {
    return jsonResponse({
      ok: true,
      ticket: {
        id: "ticket_2",
        ticketNumber: "TCK-2002",
        organizationId: "org_1",
        requesterWorkosUserId: "user_1",
        assignedAgentWorkosUserId: null,
        department: "technical",
        priority: "medium",
        service: "deploy",
        status: "open",
        subject: "New issue",
        description: null,
        secureForm: null,
        attachmentMetadata: [],
        createdAt: "2026-05-22T00:00:00.000Z",
        updatedAt: "2026-05-22T00:00:00.000Z",
        resolvedAt: null,
        closedAt: null,
      },
    })
  }

  return jsonResponse({ ok: false, message: "Unhandled request" }, 500)
})

describe("SupportTicketsConsole", () => {
  beforeEach(() => {
    fetchMock.mockClear()
    ;(globalThis as { fetch?: typeof fetch }).fetch = fetchMock as unknown as typeof fetch
  })

  it("loads ticket queue and renders empty state", async () => {
    const view = render(<SupportTicketsConsole lang="en" />)

    expect(view.getByText("Ticket Queue")).toBeInTheDocument()
    expect(view.getByText("Loading tickets...")).toBeInTheDocument()

    await waitFor(() =>
      expect(
        view.getByText("No support tickets match your filters.")
      ).toBeInTheDocument()
    )
  })

  it("shows load error from API", async () => {
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ ok: false, message: "Unable to load queue" }, 500)
    )
    const view = render(<SupportTicketsConsole lang="en" />)

    await waitFor(() =>
      expect(view.getByRole("alert")).toHaveTextContent("Unable to load queue")
    )
  })

  it("requires subject before creating a ticket", async () => {
    const view = render(<SupportTicketsConsole lang="en" />)
    await waitFor(() =>
      expect(
        view.getByText("No support tickets match your filters.")
      ).toBeInTheDocument()
    )

    fireEvent.click(view.getByRole("button", { name: "Open Ticket" }))
    await waitFor(() =>
      expect(view.getByRole("button", { name: "Submit Ticket" })).toBeInTheDocument()
    )
    fireEvent.click(view.getByRole("button", { name: "Submit Ticket" }))

    await waitFor(() =>
      expect(view.getByText("Subject is required.")).toBeInTheDocument()
    )
  })

})
