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

const createThread = (
  ticketId: string,
  ticketNumber: string,
  overrides: {
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
    users?: Record<
      string,
      { name: string; avatarUrl: string | null; isStaff: boolean }
    >
  } = {}
) => ({
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

const createClosedThread = (
  ticketId: string,
  ticketNumber: string,
  overrides: {
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
    users?: Record<
      string,
      { name: string; avatarUrl: string | null; isStaff: boolean }
    >
  } = {}
) => ({
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
      status: "closed",
      subject: "Deployment issue",
      description: "Pipeline failed",
      descriptionHtml: null,
      secureForm: null,
      attachmentMetadata: overrides.attachmentMetadata ?? [],
      createdAt: "2026-05-21T00:00:00.000Z",
      updatedAt: "2026-05-21T00:00:00.000Z",
      resolvedAt: "2026-05-22T00:00:00.000Z",
      closedAt: "2026-05-22T00:00:00.000Z",
    },
    replies: overrides.replies ?? [],
    users: overrides.users,
  },
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

      if (
        method === "POST" &&
        url === "/api/support-tickets/ticket_1/replies"
      ) {
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
    ;(globalThis as { fetch?: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch
  })

  it("renders support ticket detail and thread state", async () => {
    const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)

    // Component shows skeleton while loading
    expect(
      view.container.querySelector('[data-slot="skeleton"]')
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )
    expect(view.getByText("No replies yet.")).toBeInTheDocument()
  })

  it("shows error alert when loading the thread fails", async () => {
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ ok: false, message: "Thread unavailable" }, 500)
    )
    const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)

    await waitFor(() =>
      expect(
        view.getByText("Support ticket thread is unavailable.")
      ).toBeInTheDocument()
    )
  })

  it("validates reply body before submit", async () => {
    const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )

    fireEvent.click(view.getByRole("button", { name: "Send Reply" }))

    await waitFor(() => {
      expect(view.getByRole("alert")).toHaveTextContent(
        "Reply message is required."
      )
    })
  })

  it("closes ticket when confirmed", async () => {
    const confirmSpy = mock(() => true)
    ;(window as unknown as { confirm: typeof confirm }).confirm =
      confirmSpy as unknown as typeof confirm

    const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
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
      expect(
        view.getByRole("heading", { name: "TCK-2002" })
      ).toBeInTheDocument()
    )

    oldRequest.resolve(jsonResponse(createThread("ticket_1", "TCK-1001")))

    await waitFor(() =>
      expect(view.queryByRole("heading", { name: "TCK-1001" })).toBeNull()
    )
  })

  describe("Closed Ticket", () => {
    it("renders closed notice and warning when ticket status is closed", async () => {
      const closedThread = createClosedThread(
        "ticket_closed",
        "TCK-3003"
      )

      fetchMock.mockImplementationOnce(async () =>
        jsonResponse(closedThread)
      )

      const view = render(
        <SupportTicketDetailScreen ticketId="ticket_closed" />
      )

      await waitFor(() =>
        expect(
          view.getByRole("heading", { name: "TCK-3003" })
        ).toBeInTheDocument()
      )

      // Closed warning banner is shown
      expect(
        view.getByText("Secure Details Permanently Wiped")
      ).toBeInTheDocument()

      // Closed notice card replaces reply section
      expect(
        view.getByText(
          "This ticket is closed. If you have a new issue, please open a new ticket."
        )
      ).toBeInTheDocument()

      // Reply section is not rendered
      expect(view.queryByText("Reply")).toBeNull()
      expect(
        view.queryByRole("button", { name: "Send Reply" })
      ).toBeNull()

      // Close button shows "Closed" and is disabled
      const closeButton = view.getByRole("button", { name: "Closed" })
      expect(closeButton).toBeDisabled()
    })

    it("shows closed UI after closing a ticket via close button", async () => {
      const confirmSpy = mock(() => true)
      ;(
        window as unknown as { confirm: typeof confirm }
      ).confirm = confirmSpy as unknown as typeof confirm

      const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
      await waitFor(() =>
        expect(
          view.getByRole("heading", { name: "TCK-1001" })
        ).toBeInTheDocument()
      )

      // Reply section is shown before closing
      expect(view.getByText("Reply")).toBeInTheDocument()

      fireEvent.click(view.getByRole("button", { name: "Close Ticket" }))

      await waitFor(() => {
        // After close resolves, closed notice appears
        expect(
          view.getByText(
            "This ticket is closed. If you have a new issue, please open a new ticket."
          )
        ).toBeInTheDocument()

        // Reply section is gone
        expect(view.queryByText("Reply")).toBeNull()

        // Button shows "Closed" and is disabled
        const closedButton = view.getByRole("button", { name: "Closed" })
        expect(closedButton).toBeDisabled()
      })
    })
  })

  describe("Attachment Preview", () => {
    it("renders attachments section when ticket has attachments", async () => {
      const threadWithAttachments = createThread("ticket_1", "TCK-1001", {
        attachmentMetadata: [
          createAttachment("att_1", "image/png", "screenshot.png"),
          createAttachment("att_2", "text/csv", "data.csv"),
        ],
      })

      fetchMock.mockImplementationOnce(async () =>
        jsonResponse(threadWithAttachments)
      )

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

      fetchMock.mockImplementationOnce(async () =>
        jsonResponse(threadWithAttachments)
      )

      const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
      await waitFor(() =>
        expect(view.getByText("my-image.png")).toBeInTheDocument()
      )

      const attachmentButtons = view.container.querySelectorAll("button")
      const attachmentButton = Array.from(attachmentButtons).find((btn) =>
        btn.textContent?.includes("my-image.png")
      )
      expect(attachmentButton).toBeDefined()
    })

    it("opens modal and shows loading state when clicking attachment", async () => {
      const threadWithAttachments = createThread("ticket_1", "TCK-1001", {
        attachmentMetadata: [
          createAttachment("att_1", "image/png", "preview-me.png"),
        ],
      })

      fetchMock.mockImplementationOnce(async () =>
        jsonResponse(threadWithAttachments)
      )
      // Return blob for attachment download
      fetchMock.mockImplementationOnce(
        async () =>
          new Response(new Blob(["fake image"], { type: "image/png" }), {
            status: 200,
          })
      )

      const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
      await waitFor(() =>
        expect(view.getByText("preview-me.png")).toBeInTheDocument()
      )

      // Find and click the attachment button
      const attachmentButtons = view.container.querySelectorAll("button")
      const attachmentButton = Array.from(attachmentButtons).find((btn) =>
        btn.textContent?.includes("preview-me.png")
      )
      if (attachmentButton) {
        fireEvent.click(attachmentButton)
      }

      await waitFor(() => {
        expect(view.getByText("Loading preview...")).toBeInTheDocument()
      })
    })

    it("displays image preview after loading", async () => {
      const threadWithAttachments = createThread("ticket_1", "TCK-1001", {
        attachmentMetadata: [
          createAttachment("att_1", "image/png", "my-photo.png"),
        ],
      })

      fetchMock.mockImplementationOnce(async () =>
        jsonResponse(threadWithAttachments)
      )
      fetchMock.mockImplementationOnce(
        async () =>
          new Response(new Blob(["fake image data"], { type: "image/png" }), {
            status: 200,
          })
      )

      const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
      await waitFor(() =>
        expect(view.getByText("Attachments")).toBeInTheDocument()
      )

      const attachmentButtons = view.container.querySelectorAll("button")
      const attachmentButton = Array.from(attachmentButtons).find((btn) =>
        btn.textContent?.includes("my-photo.png")
      )
      if (attachmentButton) {
        fireEvent.click(attachmentButton)
      }

      await waitFor(() => {
        expect(view.getByText("Loading preview...")).toBeInTheDocument()
      })

      await waitFor(
        () => {
          const img = view.container.querySelector("img")
          expect(img).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })

    it("displays CSV text content in preview", async () => {
      const threadWithAttachments = createThread("ticket_1", "TCK-1001", {
        attachmentMetadata: [
          createAttachment("att_csv", "text/csv", "report.csv"),
        ],
      })

      fetchMock.mockImplementationOnce(async () =>
        jsonResponse(threadWithAttachments)
      )
      fetchMock.mockImplementationOnce(
        async () =>
          new Response(
            new Blob(["name,value\nfoo,bar"], { type: "text/csv" }),
            { status: 200 }
          )
      )

      const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
      await waitFor(() =>
        expect(view.getByText("Attachments")).toBeInTheDocument()
      )

      const attachmentButtons = view.container.querySelectorAll("button")
      const attachmentButton = Array.from(attachmentButtons).find((btn) =>
        btn.textContent?.includes("report.csv")
      )
      if (attachmentButton) {
        fireEvent.click(attachmentButton)
      }

      await waitFor(
        () => {
          expect(view.getByText(/name,value/)).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })

    it("shows PDF preview with iframe", async () => {
      const threadWithAttachments = createThread("ticket_1", "TCK-1001", {
        attachmentMetadata: [
          createAttachment("att_pdf", "application/pdf", "document.pdf"),
        ],
      })

      fetchMock.mockImplementationOnce(async () =>
        jsonResponse(threadWithAttachments)
      )
      fetchMock.mockImplementationOnce(
        async () =>
          new Response(new Blob(["%PDF-1.4"], { type: "application/pdf" }), {
            status: 200,
          })
      )

      const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
      await waitFor(() =>
        expect(view.getByText("Attachments")).toBeInTheDocument()
      )

      const attachmentButtons = view.container.querySelectorAll("button")
      const attachmentButton = Array.from(attachmentButtons).find((btn) =>
        btn.textContent?.includes("document.pdf")
      )
      if (attachmentButton) {
        fireEvent.click(attachmentButton)
      }

      await waitFor(
        () => {
          const iframe = view.container.querySelector("iframe")
          expect(iframe).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })

    it("shows unsupported preview state for unknown file types", async () => {
      const threadWithAttachments = createThread("ticket_1", "TCK-1001", {
        attachmentMetadata: [
          createAttachment("att_zip", "application/zip", "archive.zip"),
        ],
      })

      fetchMock.mockImplementationOnce(async () =>
        jsonResponse(threadWithAttachments)
      )
      fetchMock.mockImplementationOnce(
        async () =>
          new Response(new Blob(["PK fake zip"], { type: "application/zip" }), {
            status: 200,
          })
      )

      const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
      await waitFor(() =>
        expect(view.getByText("Attachments")).toBeInTheDocument()
      )

      const attachmentButtons = view.container.querySelectorAll("button")
      const attachmentButton = Array.from(attachmentButtons).find((btn) =>
        btn.textContent?.includes("archive.zip")
      )
      if (attachmentButton) {
        fireEvent.click(attachmentButton)
      }

      await waitFor(
        () => {
          expect(view.getByText("Preview Unavailable")).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })

    it("handles attachment download error by showing preview unavailable", async () => {
      const threadWithAttachments = createThread("ticket_1", "TCK-1001", {
        attachmentMetadata: [
          createAttachment("att_err", "image/png", "error-img.png"),
        ],
      })

      let callCount = 0
      fetchMock.mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return jsonResponse(threadWithAttachments)
        }
        // Return 500 error for attachment download - this throws "Failed to load preview"
        // which gets caught and sets previewContent.type to "unsupported"
        return new Response(null, { status: 500 })
      })

      const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
      await waitFor(() =>
        expect(view.getByText("Attachments")).toBeInTheDocument()
      )

      const attachmentButtons = view.container.querySelectorAll("button")
      const attachmentButton = Array.from(attachmentButtons).find((btn) =>
        btn.textContent?.includes("error-img.png")
      )
      if (attachmentButton) {
        fireEvent.click(attachmentButton)
      }

      // When fetch fails with non-ok status, the error is caught and sets type to "unsupported"
      // which shows "Preview Unavailable" message
      await waitFor(
        () => {
          expect(view.getByText("Preview Unavailable")).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })

    it("closes modal when close button is clicked", async () => {
      const threadWithAttachments = createThread("ticket_1", "TCK-1001", {
        attachmentMetadata: [
          createAttachment("att_close", "image/png", "close-me.png"),
        ],
      })

      fetchMock.mockImplementationOnce(async () =>
        jsonResponse(threadWithAttachments)
      )
      fetchMock.mockImplementationOnce(
        async () =>
          new Response(new Blob(["image"], { type: "image/png" }), {
            status: 200,
          })
      )

      const view = render(<SupportTicketDetailScreen ticketId="ticket_1" />)
      await waitFor(() =>
        expect(view.getByText("Attachments")).toBeInTheDocument()
      )

      const attachmentButtons = view.container.querySelectorAll("button")
      const attachmentButton = Array.from(attachmentButtons).find((btn) =>
        btn.textContent?.includes("close-me.png")
      )
      if (attachmentButton) {
        fireEvent.click(attachmentButton)
      }

      await waitFor(() => {
        expect(view.getByText("Loading preview...")).toBeInTheDocument()
      })

      // Click close button (the ✕ button)
      const closeButtons = view.container.querySelectorAll("button")
      const closeButton = Array.from(closeButtons).find(
        (btn) => btn.textContent === "✕"
      )
      if (closeButton) {
        fireEvent.click(closeButton)
      }

      await waitFor(() => {
        expect(view.queryByText("Loading preview...")).toBeNull()
      })
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

      fetchMock.mockImplementationOnce(async () =>
        jsonResponse(threadWithStaff)
      )

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

      fetchMock.mockImplementationOnce(async () =>
        jsonResponse(threadWithCustomer)
      )

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
