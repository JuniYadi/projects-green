import { beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"

import { SupportTicketDetailScreen } from "@/app/[lang]/console/support-tickets/support-ticket-detail-screen"

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })

const flushMicrotick = () =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0)
  })

const createAttachment = (id: string, mimeType: string, fileName: string) => ({
  id,
  fileName,
  mimeType,
  sizeBytes: 1024,
  uploadedAt: "2026-05-21T00:00:00.000Z",
})

const createThread = (ticketId: string, ticketNumber: string, overrides: {
  attachmentMetadata?: ReturnType<typeof createAttachment>[]
  replies?: Array<{
    id: string
    authorWorkosUserId: string
    body: string
    bodyHtml?: string
    isInternalNote: boolean
    secureForm?: string | null
    attachmentMetadata?: ReturnType<typeof createAttachment>[]
  }>
  users?: Record<string, { name: string; avatarUrl: string | null; isStaff: boolean }>
} = {}) => ({
  ok: true,
  thread: {
    ticket: {
      id: ticketId,
      ticketNumber,
      organizationId: "org_1",
      requesterWorkosUserId: "user_1",
      assignedAgentWorkosUserId: null,
      department: "technical",
      priority: "medium",
      service: "deploy",
      status: "open",
      subject: "Deployment issue",
      description: "Pipeline failed",
      descriptionHtml: null,
      secureForm: null,
      attachmentMetadata: overrides.attachmentMetadata ?? [],
      createdAt: "2026-05-21T00:00:00.000Z",
      updatedAt: "2026-05-21T00:00:00.000Z",
      resolvedAt: null,
      closedAt: null,
    },
    replies: overrides.replies ?? [],
    users: overrides.users,
  },
})

const createDeferred = (): {
  promise: Promise<Response>
  resolve: (value: Response) => void
} => {
  let resolvePromise!: (value: Response) => void
  const promise = new Promise<Response>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve: resolvePromise,
  }
}

const fetchMock = mock<
  (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
>(async (input, init) => {
  const url = String(input)
  const method = init?.method ?? "GET"

  if (method === "GET" && url === "/api/support-tickets/ticket_1") {
    return jsonResponse(createThread("ticket_1", "TCK-1001"))
  }

  if (method === "GET" && url === "/api/support-tickets/ticket_new") {
    return jsonResponse(createThread("ticket_new", "TCK-2002"))
  }

  if (method === "POST" && url === "/api/support-tickets/ticket_1/replies") {
    return jsonResponse({
      ok: true,
      reply: {
        id: "reply_1",
      },
    })
  }

  if (method === "POST" && url === "/api/support-tickets/ticket_1/close") {
    return jsonResponse({
      ok: true,
      ticket: {
        ...createThread("ticket_1", "TCK-1001").thread.ticket,
        status: "closed",
        closedAt: "2026-05-21T03:00:00.000Z",
      },
    })
  }

  return jsonResponse({ ok: false, message: "Unhandled request" }, 500)
})

describe("SupportTicketDetailScreen", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"

      if (method === "GET" && url === "/api/support-tickets/ticket_1") {
        return jsonResponse(createThread("ticket_1", "TCK-1001"))
      }

      if (method === "GET" && url === "/api/support-tickets/ticket_new") {
        return jsonResponse(createThread("ticket_new", "TCK-2002"))
      }

      if (method === "POST" && url === "/api/support-tickets/ticket_1/replies") {
        return jsonResponse({
          ok: true,
          reply: { id: "reply_1" },
        })
      }

      if (method === "POST" && url === "/api/support-tickets/ticket_1/close") {
        return jsonResponse({
          ok: true,
          ticket: {
            ...createThread("ticket_1", "TCK-1001").thread.ticket,
            status: "closed",
            closedAt: "2026-05-21T03:00:00.000Z",
          },
        })
      }

      return jsonResponse({ ok: false, message: "Unhandled request" }, 500)
    })
    ;(globalThis as { fetch?: typeof fetch }).fetch = fetchMock as unknown as typeof fetch
  })

  it("renders support ticket detail and thread state", async () => {
    const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)

    expect(view.getByText("Loading ticket...")).toBeInTheDocument()
    await waitFor(() =>
      expect(view.getByRole("heading", { name: "TCK-1001" })).toBeInTheDocument()
    )
    expect(view.getByText("No replies yet.")).toBeInTheDocument()
  })

  it("shows error alert when loading the thread fails", async () => {
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ ok: false, message: "Thread unavailable" }, 500)
    )
    const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)

    await waitFor(() =>
      expect(view.getByText("Support ticket thread is unavailable.")).toBeInTheDocument()
    )
  })

  it("validates reply body before submit", async () => {
    const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
    await waitFor(() =>
      expect(view.getByRole("heading", { name: "TCK-1001" })).toBeInTheDocument()
    )

    fireEvent.click(view.getByRole("button", { name: "Send Reply" }))

    await waitFor(() => {
      expect(view.getByRole("alert")).toHaveTextContent("Reply message is required.")
    })
  })

  it("closes ticket when confirmed", async () => {
    const confirmSpy = mock(() => true)
    ;(window as unknown as { confirm: typeof confirm }).confirm = confirmSpy as unknown as typeof confirm

    const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
    await waitFor(() =>
      expect(view.getByRole("heading", { name: "TCK-1001" })).toBeInTheDocument()
    )

    fireEvent.click(view.getByRole("button", { name: "Close Ticket" }))

    await waitFor(() => {
      const hasClosePost = fetchMock.mock.calls.some(([url, init]) => {
        return (
          String(url) === "/api/support-tickets/ticket_1/close" &&
          init?.method === "POST"
        )
      })
      expect(hasClosePost).toBeTrue()
    })
    expect(confirmSpy).toHaveBeenCalledTimes(1)
  })

  it("ignores stale thread responses when ticket id changes quickly", async () => {
    const oldRequest = createDeferred()
    const nextRequest = createDeferred()

    fetchMock
      .mockImplementationOnce(async () => oldRequest.promise)
      .mockImplementationOnce(async () => nextRequest.promise)

    const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
    await flushMicrotick()
    view.rerender(<SupportTicketDetailScreen ticketId="ticket_new" />)
    await flushMicrotick()

    nextRequest.resolve(jsonResponse(createThread("ticket_new", "TCK-2002")))

    await waitFor(() =>
      expect(view.getByRole("heading", { name: "TCK-2002" })).toBeInTheDocument()
    )

    oldRequest.resolve(jsonResponse(createThread("ticket_1", "TCK-1001")))

    await waitFor(() =>
      expect(view.queryByRole("heading", { name: "TCK-1001" })).toBeNull()
    )
  })

  describe("Attachment Preview", () => {
    it("renders attachments section when ticket has attachments", async () => {
      const threadWithAttachments = createThread("ticket_1", "TCK-1001", {
        attachmentMetadata: [
          createAttachment("att_1", "image/png", "screenshot.png"),
          createAttachment("att_2", "text/csv", "data.csv"),
        ],
      })

      fetchMock.mockImplementationOnce(async () => jsonResponse(threadWithAttachments))

      const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
      await waitFor(() =>
        expect(view.getByText("Attachments")).toBeInTheDocument()
      )

      expect(view.getByText("screenshot.png")).toBeInTheDocument()
      expect(view.getByText("data.csv")).toBeInTheDocument()
    })

    it("renders attachment buttons that can be clicked", async () => {
      const threadWithAttachments = createThread("ticket_1", "TCK-1001", {
        attachmentMetadata: [
          createAttachment("att_1", "image/png", "my-image.png"),
        ],
      })

      fetchMock.mockImplementationOnce(async () => jsonResponse(threadWithAttachments))

      const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
      await waitFor(() =>
        expect(view.getByText("my-image.png")).toBeInTheDocument()
      )

      const attachmentButtons = view.container.querySelectorAll("button")
      const attachmentButton = Array.from(attachmentButtons).find(
        (btn) => btn.textContent?.includes("my-image.png")
      )
      expect(attachmentButton).toBeDefined()
    })
  })

  describe("Author Avatars and Badges", () => {
    it("displays author info when thread has users", async () => {
      const threadWithStaff = createThread("ticket_1", "TCK-1001", {
        replies: [
          {
            id: "reply_1",
            authorWorkosUserId: "user_staff",
            body: "Staff response here",
            isInternalNote: false,
            attachmentMetadata: [],
          },
        ],
        users: {
          user_staff: { name: "Staff Member", avatarUrl: null, isStaff: true },
        },
      })

      fetchMock.mockImplementationOnce(async () => jsonResponse(threadWithStaff))

      const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
      await waitFor(() =>
        expect(view.getByText("Staff Member")).toBeInTheDocument()
      )

      expect(view.getByText("Support Team")).toBeInTheDocument()
    })

    it("displays customer badge for non-staff users", async () => {
      const threadWithCustomer = createThread("ticket_1", "TCK-1001", {
        replies: [
          {
            id: "reply_1",
            authorWorkosUserId: "user_customer",
            body: "Customer question",
            isInternalNote: false,
            attachmentMetadata: [],
          },
        ],
        users: {
          user_customer: { name: "John Doe", avatarUrl: null, isStaff: false },
        },
      })

      fetchMock.mockImplementationOnce(async () => jsonResponse(threadWithCustomer))

      const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
      await waitFor(() =>
        expect(view.getByText("John Doe")).toBeInTheDocument()
      )

      expect(view.getByText("Customer")).toBeInTheDocument()
    })

    it("displays both staff and customer badges when both present", async () => {
      const threadWithBoth = createThread("ticket_1", "TCK-1001", {
        replies: [
          {
            id: "reply_1",
            authorWorkosUserId: "user_staff",
            body: "Staff reply",
            isInternalNote: false,
            attachmentMetadata: [],
          },
          {
            id: "reply_2",
            authorWorkosUserId: "user_customer",
            body: "Customer reply",
            isInternalNote: false,
            attachmentMetadata: [],
          },
        ],
        users: {
          user_staff: { name: "Agent Smith", avatarUrl: null, isStaff: true },
          user_customer: { name: "Jane Doe", avatarUrl: null, isStaff: false },
        },
      })

      fetchMock.mockImplementationOnce(async () => jsonResponse(threadWithBoth))

      const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
      await waitFor(() =>
        expect(view.getByText("Agent Smith")).toBeInTheDocument()
      )

      expect(view.getByText("Support Team")).toBeInTheDocument()
      expect(view.getByText("Customer")).toBeInTheDocument()
    })
  })
})