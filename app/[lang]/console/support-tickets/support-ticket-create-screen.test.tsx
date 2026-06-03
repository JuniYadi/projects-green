import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { SupportTicketCreateScreen } from "./support-ticket-create-screen"

const mockRouterPush = mock(() => {})
const mockRouterRefresh = mock(() => {})
const originalFetch = globalThis.fetch
const originalCreateObjectURL = globalThis.URL?.createObjectURL
const originalRevokeObjectURL = globalThis.URL?.revokeObjectURL

mock.module("next/navigation", () => {
  return {
    useRouter: () => ({
      push: mockRouterPush,
      refresh: mockRouterRefresh,
      replace: () => {},
      prefetch: async () => undefined,
    }),
  }
})

const jsonResponse = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

const renderScreen = (lang = "en") => render(<SupportTicketCreateScreen lang={lang} />)

const fillSubjectAndSubmit = (
  view: ReturnType<typeof renderScreen>,
  value = "My test issue"
) => {
  const subjectInput = view.getByPlaceholderText("Describe your issue") as HTMLInputElement
  const submitButton = view.getByRole("button", { name: "Submit Ticket" })
  subjectInput.value = value
  fireEvent.click(submitButton)
}

const attachFiles = (
  view: ReturnType<typeof renderScreen>,
  files: File[]
) => {
  const fileInput = view.getByLabelText("Attachments (optional)")
  fireEvent.change(fileInput, { target: { files } })
}

const expectRedirected = () => {
  expect(mockRouterPush).toHaveBeenCalledWith("/en/console/support-tickets")
  expect(mockRouterRefresh).toHaveBeenCalled()
}

describe("SupportTicketCreateScreen", () => {
  beforeEach(() => {
    mockRouterPush.mockClear()
    mockRouterRefresh.mockClear()

    globalThis.URL.createObjectURL = mock((file: File) => `blob:${file.name}`)
    globalThis.URL.revokeObjectURL = mock(() => {})

    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"

      if (url === "/api/support-tickets" && method === "POST") {
        return jsonResponse({
          ok: true,
          ticket: {
            id: "ticket_new",
            ticketNumber: "TCK-1002",
            subject: "Testing subject",
            department: "technical",
            priority: "medium",
            status: "open",
            createdAt: "2026-05-22T00:00:00.000Z",
          },
        })
      }

      if (url === "/api/support-tickets/preview" && method === "POST") {
        const bodyText = init?.body ? String(init.body) : "{}"
        const bodyObj = JSON.parse(bodyText)
        return jsonResponse({
          ok: true,
          html: `<p>parsed: ${bodyObj.markdown}</p>`,
        })
      }

      if (url === "/api/support-tickets/attachments/presign" && method === "POST") {
        return jsonResponse({
          ok: true,
          attachment: {
            attachmentId: "att_123",
            expiresAt: "2026-06-22T00:00:00.000Z",
            storageBucket: "my-bucket",
            storageKey: "my-key",
            uploadUrl: "https://mock-s3.example.com/upload",
          },
        })
      }

      if (url === "https://mock-s3.example.com/upload" && method === "PUT") {
        return new Response(null, { status: 200 })
      }

      if (url === "/api/support-tickets/attachments/register" && method === "POST") {
        return jsonResponse({
          ok: true,
          attachment: {
            id: "att_123",
            fileName: "screenshot.png",
            mimeType: "image/png",
            sizeBytes: 1024,
            storageBucket: "my-bucket",
            storageKey: "my-key",
          },
        })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.URL.createObjectURL = originalCreateObjectURL
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL
  })

  it("renders the creation form fields", async () => {
    const view = render(<SupportTicketCreateScreen lang="en" />)

    expect(view.getByLabelText("Subject")).toBeTruthy()
    expect(view.getByLabelText("Department")).toBeTruthy()
    expect(view.getByLabelText("Service (optional)")).toBeTruthy()
    expect(view.getByLabelText("Priority")).toBeTruthy()
    expect(view.getByLabelText("Message (optional)")).toBeTruthy()
    expect(view.getByLabelText("Secure Details (optional)")).toBeTruthy()
    expect(view.getByLabelText("Attachments (optional)")).toBeTruthy()
    expect(view.getByRole("button", { name: "Submit Ticket" })).toBeTruthy()
    expect(view.getByRole("button", { name: "Cancel" })).toBeTruthy()
  })

  it("requires subject and displays error", async () => {
    const view = renderScreen()
    const submitButton = view.getByRole("button", { name: "Submit Ticket" })

    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(view.getByRole("alert")).toHaveTextContent("Subject is required.")
    })
  })

  it("submits the ticket and redirects", async () => {
    const view = renderScreen()
    fillSubjectAndSubmit(view)

    await waitFor(() => {
      expectRedirected()
    })
  })

  it("submits the ticket with attachments successfully", async () => {
    const view = renderScreen()
    const submitButton = view.getByRole("button", { name: "Submit Ticket" })
    const subjectInput = view.getByPlaceholderText("Describe your issue") as HTMLInputElement

    subjectInput.value = "Issue with attachments"

    const docFile = new File(["file content"], "receipt.pdf", { type: "application/pdf" })
    attachFiles(view, [docFile])

    fireEvent.click(submitButton)

    await waitFor(() => {
      expectRedirected()
    })
  })

  it("renders markdown preview when toggle tab is clicked", async () => {
    const view = renderScreen()
    const textareas = view.container.querySelectorAll("textarea")
    const descriptionTextarea = textareas[0]
    expect(descriptionTextarea).toBeTruthy()

    descriptionTextarea.value = "Hello **world**"

    const previewButtons = view.getAllByRole("button", { name: "Preview" })
    fireEvent.click(previewButtons[0])

    await waitFor(() => {
      expect(view.getByText("parsed: Hello **world**")).toBeTruthy()
    })
  })

  it("switches tabs and preserves input values", async () => {
    const view = renderScreen()

    const textareas = view.container.querySelectorAll("textarea")
    const descriptionTextarea = textareas[0]
    const secureTextarea = textareas[1]

    descriptionTextarea.value = "General info content"
    secureTextarea.value = "Super secret tokens"

    const messageTabContent = view.getByTestId("message-tab-content")
    const secureTabContent = view.getByTestId("secure-tab-content")

    expect(messageTabContent.className).not.toContain("hidden")
    expect(secureTabContent.className).toContain("hidden")

    const secureTabButton = view.getByRole("button", { name: /secure details/i })
    fireEvent.click(secureTabButton)

    expect(messageTabContent.className).toContain("hidden")
    expect(secureTabContent.className).not.toContain("hidden")

    expect(descriptionTextarea.value).toBe("General info content")
    expect(secureTextarea.value).toBe("Super secret tokens")
  })

  it("renders image previews and document icons for attachments", async () => {
    const view = renderScreen()

    const imgFile = new File(["dummy image"], "screenshot.png", { type: "image/png" })
    const docFile = new File(["dummy doc"], "report.pdf", { type: "application/pdf" })

    attachFiles(view, [imgFile, docFile])

    expect(view.getByText("screenshot.png")).toBeTruthy()
    expect(view.getByText("report.pdf")).toBeTruthy()

    const imgPreview = view.getByAltText("screenshot.png") as HTMLImageElement
    expect(imgPreview).toBeTruthy()
    expect(imgPreview.src).toBe("blob:screenshot.png")

    expect(view.queryByAltText("report.pdf")).toBeNull()

    const removeButtons = view.getAllByRole("button", { name: "✕" })
    expect(removeButtons.length).toBe(2)

    fireEvent.click(removeButtons[0])

    expect(view.queryByText("screenshot.png")).toBeNull()
    expect(view.getByText("report.pdf")).toBeTruthy()
  })

  it("adds newly selected attachments without replacing existing ones", async () => {
    const view = renderScreen()

    const imgFile = new File(["dummy image"], "screenshot.png", {
      type: "image/png",
    })
    const docFile = new File(["dummy doc"], "report.pdf", {
      type: "application/pdf",
    })

    attachFiles(view, [imgFile])
    attachFiles(view, [docFile])

    expect(view.getByText("screenshot.png")).toBeTruthy()
    expect(view.getByText("report.pdf")).toBeTruthy()
    expect(view.getAllByRole("button", { name: "✕" }).length).toBe(2)
  })
})
