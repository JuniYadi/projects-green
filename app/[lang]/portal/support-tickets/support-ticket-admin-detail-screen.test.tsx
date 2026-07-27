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
})
