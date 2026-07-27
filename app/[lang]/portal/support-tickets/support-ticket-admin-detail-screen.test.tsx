import { beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"

import { SupportTicketAdminDetailScreen } from "@/app/[lang]/portal/support-tickets/support-ticket-admin-detail-screen"

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  })

const createThread = (
  ticketId: string,
  ticketNumber: string,
  overrides: {
    attachmentMetadata?: Array<{
      id: string
      fileName: string
      mimeType: string
      sizeBytes: number
      uploadedAt: string
    }>
    replies?: Array<{
      id: string
      authorWorkosUserId: string
      body: string
      bodyHtml?: string
      isInternalNote: boolean
      secureForm?: string | null
      attachmentMetadata?: Array<{
        id: string
        fileName: string
        mimeType: string
        sizeBytes: number
        uploadedAt: string
      }>
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

const fetchMock = mock<
  (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
>(async (input, init) => {
  const url = String(input)
  const method = init?.method ?? "GET"

  if (method === "GET" && url === "/api/support-tickets/ticket_1") {
    return jsonResponse(createThread("ticket_1", "TCK-1001"))
  }

  if (method === "POST" && url === "/api/support-tickets/ticket_1/replies") {
    return jsonResponse({ ok: true, reply: { id: "reply_1" } })
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

  return jsonResponse({ ok: false, message: "Unhandled" }, 500)
})

describe("SupportTicketAdminDetailScreen", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"

      if (method === "GET" && url === "/api/support-tickets/ticket_1") {
        return jsonResponse(createThread("ticket_1", "TCK-1001"))
      }

      if (
        method === "POST" &&
        url === "/api/support-tickets/ticket_1/replies"
      ) {
        return jsonResponse({ ok: true, reply: { id: "reply_1" } })
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

  it("renders admin thread with ticketId and lang props", async () => {
    const view = render(
      <SupportTicketAdminDetailScreen ticketId="ticket_1" lang="en" />
    )

    expect(
      view.container.querySelector('[data-slot="skeleton"]')
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )
  })

  it("allows secure-only reply with empty body and posts SECURE_ONLY_REPLY_BODY placeholder", async () => {
    const view = render(
      <SupportTicketAdminDetailScreen ticketId="ticket_1" lang="en" />
    )
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )

    fireEvent.click(view.getByRole("button", { name: /show secure details/i }))

    const secureTextarea = view.getByPlaceholderText(
      "Sensitive credentials, configurations, or secrets only"
    ) as HTMLTextAreaElement
    secureTextarea.value = "secret-token"
    fireEvent.input(secureTextarea)

    fireEvent.click(view.getByRole("button", { name: "Send Reply" }))

    await waitFor(() => {
      const replyCall = fetchMock.mock.calls.find(([url, init]) => {
        return (
          String(url) === "/api/support-tickets/ticket_1/replies" &&
          init?.method === "POST"
        )
      })
      expect(replyCall).toBeDefined()
      const body = JSON.parse(replyCall![1]!.body as string)
      expect(body.body).toBe("details on secure message")
      expect(body.secureForm).toBe("secret-token")
    })
  })

  it("shows credential warning for password=secret in visible message", async () => {
    const view = render(
      <SupportTicketAdminDetailScreen ticketId="ticket_1" lang="en" />
    )
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )

    const textarea = view.getByPlaceholderText(
      "Write your reply"
    ) as HTMLTextAreaElement
    textarea.value = "password=secret"
    fireEvent.input(textarea)

    await waitFor(() => {
      expect(view.getByTestId("credential-warning")).toBeInTheDocument()
    })
    expect(view.getByTestId("credential-warning")).toHaveTextContent(
      "Possible credential detected"
    )
  })

  it("isInternalNote checkbox toggles state and posts isInternalNote: true", async () => {
    const view = render(
      <SupportTicketAdminDetailScreen ticketId="ticket_1" lang="en" />
    )
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )

    const checkbox = view.getByRole("checkbox", { name: /internal note/i })
    expect(checkbox).not.toBeChecked()

    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()

    const textarea = view.getByPlaceholderText(
      "Write your reply"
    ) as HTMLTextAreaElement
    textarea.value = "Internal note text"
    fireEvent.input(textarea)

    fireEvent.click(view.getByRole("button", { name: "Send Reply" }))

    await waitFor(() => {
      const replyCall = fetchMock.mock.calls.find(([url, init]) => {
        return (
          String(url) === "/api/support-tickets/ticket_1/replies" &&
          init?.method === "POST"
        )
      })
      expect(replyCall).toBeDefined()
      const body = JSON.parse(replyCall![1]!.body as string)
      expect(body.isInternalNote).toBe(true)
      expect(body.body).toBe("Internal note text")
    })
  })

  it("no General Message or Secure details tabs in the composer", async () => {
    const view = render(
      <SupportTicketAdminDetailScreen ticketId="ticket_1" lang="en" />
    )
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )

    expect(view.queryByRole("button", { name: "General Message" })).toBeNull()
    expect(view.queryByRole("button", { name: "Secure details" })).toBeNull()
  })

  it("after close, no Show secure details buttons remain if thread returned secureForm null", async () => {
    const threadWithSecure = {
      ok: true,
      thread: {
        ticket: {
          id: "ticket_1",
          ticketNumber: "TCK-1001",
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
          secureForm: "top-secret",
          attachmentMetadata: [],
          createdAt: "2026-05-21T00:00:00.000Z",
          updatedAt: "2026-05-21T00:00:00.000Z",
          resolvedAt: null,
          closedAt: null,
        },
        replies: [
          {
            id: "reply_1",
            authorWorkosUserId: "user_1",
            body: "Please check",
            isInternalNote: false,
            secureForm: "reply-secret",
            attachmentMetadata: [],
          },
        ],
        users: undefined,
      },
    }

    let fetchCount = 0
    fetchMock.mockImplementation(async (input, init) => {
      fetchCount++
      const url = String(input)
      const method = init?.method ?? "GET"

      if (method === "POST" && url === "/api/support-tickets/ticket_1/close") {
        return jsonResponse({
          ok: true,
          ticket: {
            ...threadWithSecure.thread.ticket,
            status: "closed",
            secureForm: null,
            closedAt: "2026-05-21T03:00:00.000Z",
          },
        })
      }

      if (method === "GET" && url === "/api/support-tickets/ticket_1") {
        if (fetchCount <= 1) {
          return jsonResponse(threadWithSecure)
        }
        return jsonResponse({
          ok: true,
          thread: {
            ticket: {
              ...threadWithSecure.thread.ticket,
              status: "closed",
              secureForm: null,
              closedAt: "2026-05-21T03:00:00.000Z",
            },
            replies: [
              {
                id: "reply_1",
                authorWorkosUserId: "user_1",
                body: "Please check",
                isInternalNote: false,
                secureForm: null,
                attachmentMetadata: [],
              },
            ],
            users: threadWithSecure.thread.users,
          },
        })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    })

    const confirmSpy = mock(() => true)
    ;(window as unknown as { confirm: typeof confirm }).confirm =
      confirmSpy as unknown as typeof confirm

    const view = render(
      <SupportTicketAdminDetailScreen ticketId="ticket_1" lang="en" />
    )
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )

    expect(
      view.getAllByRole("button", { name: /show secure details/i }).length
    ).toBeGreaterThanOrEqual(1)

    fireEvent.click(view.getByRole("button", { name: "Close Ticket" }))

    await waitFor(() => {
      expect(
        view.queryAllByRole("button", { name: /show secure details/i }).length
      ).toBe(0)
    })
  })
  it("saveMetadata submits PUT /api/support-tickets/admin/ticket_1 with department/priority/service/status/PIC", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (method === "GET" && url === "/api/support-tickets/ticket_1") {
        return jsonResponse(
          createThread("ticket_1", "TCK-1001", {
            users: {
              user_1: { name: "Alice", avatarUrl: null, isStaff: false },
              user_staff: { name: "Bob", avatarUrl: null, isStaff: true },
            },
          })
        )
      }
      if (method === "PUT" && url === "/api/support-tickets/admin/ticket_1") {
        const body = JSON.parse(init!.body as string)
        return jsonResponse({
          ok: true,
          ticket: {
            ...createThread("ticket_1", "TCK-1001").thread.ticket,
            department: body.department ?? "technical",
            priority: body.priority ?? "medium",
            service: body.service ?? "deploy",
            status: body.status ?? "open",
            assignedAgentWorkosUserId: body.assignedAgentWorkosUserId ?? null,
          },
        })
      }
      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    })

    const view = render(
      <SupportTicketAdminDetailScreen ticketId="ticket_1" lang="en" />
    )
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )

    // Click "Save Categorization" - default values from thread get submitted
    fireEvent.click(view.getByRole("button", { name: /save categorization/i }))

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) => {
        return (
          String(url) === "/api/support-tickets/admin/ticket_1" &&
          init?.method === "PUT"
        )
      })
      expect(putCall).toBeDefined()
      const body = JSON.parse(putCall![1]!.body as string)
      expect(body).toMatchObject({
        department: "technical",
        priority: "medium",
        service: "deploy",
        status: "open",
      })
    })
  })

  it("saveMetadata error renders error message and leaves button enabled", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (method === "GET" && url === "/api/support-tickets/ticket_1") {
        return jsonResponse(createThread("ticket_1", "TCK-1001"))
      }
      if (method === "PUT" && url === "/api/support-tickets/admin/ticket_1") {
        return jsonResponse({ ok: false, message: "Forbidden update" }, 403)
      }
      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    })

    const view = render(
      <SupportTicketAdminDetailScreen ticketId="ticket_1" lang="en" />
    )
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )

    fireEvent.click(view.getByRole("button", { name: /save categorization/i }))

    await waitFor(() => {
      expect(view.getByRole("alert")).toHaveTextContent("Forbidden update")
    })
  })

  it("handleStatusChange triggers PUT with status only when admin quick-status select changes", async () => {
    let putBody: Record<string, unknown> | null = null
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (method === "GET" && url === "/api/support-tickets/ticket_1") {
        return jsonResponse(createThread("ticket_1", "TCK-1001"))
      }
      if (method === "PUT" && url === "/api/support-tickets/admin/ticket_1") {
        putBody = JSON.parse(init!.body as string) as Record<string, unknown>
        return jsonResponse({
          ok: true,
          ticket: {
            ...createThread("ticket_1", "TCK-1001").thread.ticket,
            status: (putBody.status as string | undefined) ?? "open",
          },
        })
      }
      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    })

    const view = render(
      <SupportTicketAdminDetailScreen ticketId="ticket_1" lang="en" />
    )
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )

    // The header has its own status Select (160px wide) driven by ticket.status.
    // SUPPORT_TICKET_STATUS_TRANSITIONS["open"] typically includes "in_progress", "closed".
    // Find all SelectTriggers and the one labeled by the ticket header has w-[160px].
    const trigger = view.container.querySelector(
      '[class*="w-[160px]"]'
    ) as HTMLElement | null
    expect(trigger).not.toBeNull()
    fireEvent.click(trigger!)

    await waitFor(() => {
      const option = view.queryByText(/In Progress|In progress/i)
      expect(option).not.toBeNull()
    })

    const inProgress = view.getByText(/In Progress|In progress/i)
    fireEvent.click(inProgress)

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) => {
        return (
          String(url) === "/api/support-tickets/admin/ticket_1" &&
          init?.method === "PUT"
        )
      })
      expect(putCall).toBeDefined()
    })
    expect(putBody).toMatchObject({ status: "in_progress" })
  })

  it("deleteTicket confirms, calls DELETE, and navigates to portal list path", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (method === "GET" && url === "/api/support-tickets/ticket_1") {
        return jsonResponse(createThread("ticket_1", "TCK-1001"))
      }
      if (
        method === "DELETE" &&
        url === "/api/support-tickets/admin/ticket_1"
      ) {
        return jsonResponse({ ok: true })
      }
      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    })

    const confirmSpy = mock(() => true)
    ;(window as unknown as { confirm: typeof confirm }).confirm =
      confirmSpy as unknown as typeof confirm

    const nextRouter = await import("next/navigation")
    const routerMock = (
      nextRouter as unknown as {
        useRouter: () => {
          push: ReturnType<typeof mock>
          refresh: ReturnType<typeof mock>
        }
      }
    ).useRouter()
    routerMock.push.mockClear()
    routerMock.refresh.mockClear()

    const view = render(
      <SupportTicketAdminDetailScreen ticketId="ticket_1" lang="en" />
    )
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )

    fireEvent.click(
      view.getByRole("button", { name: /delete support ticket/i })
    )

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled()
      const deleteCall = fetchMock.mock.calls.find(([url, init]) => {
        return (
          String(url) === "/api/support-tickets/admin/ticket_1" &&
          init?.method === "DELETE"
        )
      })
      expect(deleteCall).toBeDefined()
    })

    await waitFor(() => {
      expect(routerMock.push).toHaveBeenCalledWith("/en/portal/support-tickets")
      expect(routerMock.refresh).toHaveBeenCalled()
    })
  })

  it("deleteTicket cancel does not call DELETE", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (method === "GET" && url === "/api/support-tickets/ticket_1") {
        return jsonResponse(createThread("ticket_1", "TCK-1001"))
      }
      return jsonResponse({ ok: false, message: "Should not reach" }, 500)
    })

    const confirmSpy = mock(() => false)
    ;(window as unknown as { confirm: typeof confirm }).confirm =
      confirmSpy as unknown as typeof confirm

    const view = render(
      <SupportTicketAdminDetailScreen ticketId="ticket_1" lang="en" />
    )
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )

    fireEvent.click(
      view.getByRole("button", { name: /delete support ticket/i })
    )

    expect(confirmSpy).toHaveBeenCalled()
    // No DELETE call should have been made
    const deleteCalls = fetchMock.mock.calls.filter(
      ([url, init]) =>
        String(url) === "/api/support-tickets/admin/ticket_1" &&
        init?.method === "DELETE"
    )
    expect(deleteCalls.length).toBe(0)
  })

  it("attachment preview opens PDF iframe when mime is application/pdf", async () => {
    const pdfThread = createThread("ticket_1", "TCK-1001", {
      attachmentMetadata: [
        {
          id: "att_pdf",
          fileName: "doc.pdf",
          mimeType: "application/pdf",
          sizeBytes: 4096,
          uploadedAt: "2026-05-21T00:00:00.000Z",
        },
      ],
    })

    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url === "/api/support-tickets/ticket_1") {
        return jsonResponse(pdfThread)
      }
      if (url === "/api/support-tickets/attachments/att_pdf") {
        return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        })
      }
      return jsonResponse({ ok: false }, 500)
    })

    const view = render(
      <SupportTicketAdminDetailScreen ticketId="ticket_1" lang="en" />
    )
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )

    fireEvent.click(view.getByRole("button", { name: /doc\.pdf/i }))

    await waitFor(() => {
      const iframe = view.container.querySelector("iframe")
      expect(iframe).not.toBeNull()
    })
    expect(
      (view.container.querySelector("iframe") as HTMLIFrameElement).title
    ).toBe("doc.pdf")
  })

  it("attachment preview shows unsupported fallback on fetch error", async () => {
    const attThread = createThread("ticket_1", "TCK-1001", {
      attachmentMetadata: [
        {
          id: "att_bad",
          fileName: "broken.bin",
          mimeType: "application/octet-stream",
          sizeBytes: 2048,
          uploadedAt: "2026-05-21T00:00:00.000Z",
        },
      ],
    })

    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url === "/api/support-tickets/ticket_1") {
        return jsonResponse(attThread)
      }
      if (url === "/api/support-tickets/attachments/att_bad") {
        return jsonResponse({ ok: false }, 500)
      }
      return jsonResponse({ ok: false }, 500)
    })

    const view = render(
      <SupportTicketAdminDetailScreen ticketId="ticket_1" lang="en" />
    )
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )

    fireEvent.click(view.getByRole("button", { name: /broken\.bin/i }))

    await waitFor(() => {
      expect(view.getByText(/preview unavailable/i)).toBeInTheDocument()
    })
  })

  it("closeTicket calls POST /close and refetches thread to wipe secureForm", async () => {
    const threadWithSecure = {
      ok: true,
      thread: {
        ticket: {
          id: "ticket_1",
          ticketNumber: "TCK-1001",
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
          secureForm: "old-secret",
          attachmentMetadata: [],
          createdAt: "2026-05-21T00:00:00.000Z",
          updatedAt: "2026-05-21T00:00:00.000Z",
          resolvedAt: null,
          closedAt: null,
        },
        replies: [],
        users: undefined,
      },
    }

    let getCount = 0
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (method === "GET" && url === "/api/support-tickets/ticket_1") {
        getCount++
        if (getCount === 1) return jsonResponse(threadWithSecure)
        // second fetch after close: secureForm wiped
        return jsonResponse({
          ok: true,
          thread: {
            ticket: {
              ...threadWithSecure.thread.ticket,
              status: "closed",
              secureForm: null,
              closedAt: "2026-05-21T03:00:00.000Z",
            },
            replies: [],
            users: undefined,
          },
        })
      }
      if (method === "POST" && url === "/api/support-tickets/ticket_1/close") {
        return jsonResponse({
          ok: true,
          ticket: {
            ...threadWithSecure.thread.ticket,
            status: "closed",
            closedAt: "2026-05-21T03:00:00.000Z",
          },
        })
      }
      return jsonResponse({ ok: false }, 500)
    })

    const confirmSpy = mock(() => true)
    ;(window as unknown as { confirm: typeof confirm }).confirm =
      confirmSpy as unknown as typeof confirm

    const view = render(
      <SupportTicketAdminDetailScreen ticketId="ticket_1" lang="en" />
    )
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )

    expect(getCount).toBe(1)
    fireEvent.click(view.getByRole("button", { name: "Close Ticket" }))

    await waitFor(() => {
      const closeCall = fetchMock.mock.calls.find(([url, init]) => {
        return (
          String(url) === "/api/support-tickets/ticket_1/close" &&
          init?.method === "POST"
        )
      })
      expect(closeCall).toBeDefined()
      expect(getCount).toBeGreaterThanOrEqual(2)
    })
  })

  it("closePreview resets the preview modal when the backdrop is clicked", async () => {
    const imgThread = createThread("ticket_1", "TCK-1001", {
      attachmentMetadata: [
        {
          id: "att_close",
          fileName: "x.png",
          mimeType: "image/png",
          sizeBytes: 256,
          uploadedAt: "2026-05-21T00:00:00.000Z",
        },
      ],
    })

    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url === "/api/support-tickets/ticket_1") {
        return jsonResponse(imgThread)
      }
      if (url === "/api/support-tickets/attachments/att_close") {
        return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      }
      return jsonResponse({ ok: false }, 500)
    })

    const view = render(
      <SupportTicketAdminDetailScreen ticketId="ticket_1" lang="en" />
    )
    await waitFor(() =>
      expect(
        view.getByRole("heading", { name: "TCK-1001" })
      ).toBeInTheDocument()
    )

    fireEvent.click(view.getByRole("button", { name: /x\.png/i }))
    await waitFor(() => {
      expect(view.container.querySelector("div.fixed.inset-0")).not.toBeNull()
    })

    // The backdrop overlay's onClick triggers closePreview
    const backdrop = view.container.querySelector(
      "div.fixed.inset-0"
    ) as HTMLElement
    fireEvent.click(backdrop)

    await waitFor(() => {
      expect(view.container.querySelector("div.fixed.inset-0")).toBeNull()
    })
  })
})
