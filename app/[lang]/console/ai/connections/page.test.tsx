import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { renderToString } from "react-dom/server"

const mockSampleConnection = {
  id: "conn_test_1",
  organizationId: "org_test",
  name: "Payment Gateway API",
  description: "Stripe and external payout service",
  baseUrl: "https://api.payment.example.com/v1",
  authType: "BEARER",
  isActive: true,
  headers: {
    Authorization: "Bearer ****9876",
    "X-Client-Id": "client-prod",
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mockGet = mock(() =>
  Promise.resolve({
    data: {
      ok: true,
      data: [mockSampleConnection],
    },
  })
)

const mockPost = mock(() =>
  Promise.resolve({
    data: {
      ok: true,
      data: { id: "conn_test_new" },
    },
  })
)

const mockPatch = mock(() =>
  Promise.resolve({
    data: {
      ok: true,
      data: { id: "conn_test_1" },
    },
  })
)

const mockDelete = mock(() =>
  Promise.resolve({
    data: { ok: true },
  })
)

const mockTestPost = mock(() =>
  Promise.resolve({
    data: {
      ok: true,
      data: {
        success: true,
        status: 200,
        statusText: "OK",
      },
    },
  })
)

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      console: {
        ai: {
          connections: Object.assign(
            {
              get: mockGet,
              post: mockPost,
            },
            {
              conn_test_1: {
                patch: mockPatch,
                delete: mockDelete,
                test: {
                  post: mockTestPost,
                },
              },
            }
          ),
        },
      },
    },
  },
}))

import AiConnectionsPage, { metadata } from "./page"
import AiConnectionsPageClient, {
  validateBaseUrl,
} from "./page-client"

describe("AiConnectionsPage", () => {
  beforeEach(() => {
    cleanup()
    mockGet.mockClear()
    mockPost.mockClear()
    mockPatch.mockClear()
    mockDelete.mockClear()
    mockTestPost.mockClear()
  })

  it("exports correct metadata title", () => {
    expect(metadata.title).toBe("API Connections")
  })

  it("renders page header and Add Connection button via SSR", () => {
    const html = renderToString(<AiConnectionsPage />)
    expect(html).toContain("API Connections")
    expect(html).toContain("Add Connection")
    expect(html).toContain("Filter connections by name, URL, or auth...")
  })

  it("renders connection details when initialConnections is provided", () => {
    const html = renderToString(
      <AiConnectionsPageClient initialConnections={[mockSampleConnection]} />
    )
    expect(html).toContain("Payment Gateway API")
    expect(html).toContain("https://api.payment.example.com/v1")
    expect(html).toContain("BEARER")
    expect(html).toContain("Authorization")
    expect(html).toContain("Bearer ****9876")
    expect(html).toContain("X-Client-Id")
    expect(html).toContain("client-prod")
  })

  it("validates base URL formats properly", () => {
    expect(validateBaseUrl("")).toBe("Base URL is required")
    expect(validateBaseUrl("   ")).toBe("Base URL is required")
    expect(validateBaseUrl("not-a-url")).toBe(
      "Invalid URL format (e.g. https://api.example.com)"
    )
    expect(validateBaseUrl("ftp://api.example.com")).toBe(
      "URL must use http:// or https://"
    )
    expect(validateBaseUrl("https://api.example.com/v1")).toBeNull()
    expect(validateBaseUrl("http://internal.service.local:8080")).toBeNull()
  })

  it("renders empty state when initialConnections is empty", () => {
    const html = renderToString(
      <AiConnectionsPageClient initialConnections={[]} />
    )
    expect(html).toContain("No API Connections")
    expect(html).toContain("Configure external API endpoints")
  })

  it("loads connections on mount and renders list in DOM", async () => {
    const { findByText } = render(<AiConnectionsPageClient />)
    expect(await findByText("Payment Gateway API")).toBeTruthy()
    expect(await findByText("https://api.payment.example.com/v1")).toBeTruthy()
  })

  it("triggers live connection test and displays status", async () => {
    const { findByText, getByTitle } = render(
      <AiConnectionsPageClient initialConnections={[mockSampleConnection]} />
    )

    const testBtn = getByTitle("Test Connection Ping")
    fireEvent.click(testBtn)

    await waitFor(() => {
      expect(mockTestPost).toHaveBeenCalledTimes(1)
    })
    expect(await findByText(/200/)).toBeTruthy()
  })

  it("displays failure badge and error summary on test error", async () => {
    mockTestPost.mockResolvedValueOnce({
      data: {
        ok: false,
        data: {
          success: false,
          status: 502,
          error: "Upstream gateway timed out",
        },
      },
    } as never)

    const { findByText, getByTitle } = render(
      <AiConnectionsPageClient initialConnections={[mockSampleConnection]} />
    )

    const testBtn = getByTitle("Test Connection Ping")
    fireEvent.click(testBtn)

    await waitFor(() => {
      expect(mockTestPost).toHaveBeenCalledTimes(1)
    })
    expect(await findByText(/Failed/)).toBeTruthy()
    expect(await findByText("Upstream gateway timed out")).toBeTruthy()
  })

  it("opens create dialog, manages headers, and toggles mask", async () => {
    const {
      findByText,
      getAllByText,
      getByPlaceholderText,
      getByLabelText,
    } = render(<AiConnectionsPageClient initialConnections={[]} />)

    const addBtns = getAllByText("Add Connection")
    fireEvent.click(addBtns[0]!)

    expect(await findByText("Create API Connection")).toBeTruthy()

    // Add a header row
    const addHeaderBtn = await findByText("Add Header")
    fireEvent.click(addHeaderBtn)

    const headerKeyInput = getByPlaceholderText("Header-Name")
    const headerValInput = getByPlaceholderText("Header-Value")

    fireEvent.change(headerKeyInput, { target: { value: "X-Secret-Token" } })
    fireEvent.change(headerValInput, { target: { value: "my-top-secret" } })

    // Secret input starts as type="password"
    expect(headerValInput.getAttribute("type")).toBe("password")

    // Click reveal secret toggle
    const revealBtn = getByLabelText("Reveal secret")
    fireEvent.click(revealBtn)
    expect(headerValInput.getAttribute("type")).toBe("text")

    // Click mask secret toggle
    const maskBtn = getByLabelText("Mask secret")
    fireEvent.click(maskBtn)
    expect(headerValInput.getAttribute("type")).toBe("password")
  })

  it("submits create connection and calls eden.post", async () => {
    const {
      findByText,
      getAllByText,
      getByLabelText,
    } = render(<AiConnectionsPageClient initialConnections={[]} />)

    const addBtns = getAllByText("Add Connection")
    fireEvent.click(addBtns[0]!)

    const nameInput = getByLabelText(/Connection Name/i)
    const urlInput = getByLabelText(/Base URL/i)

    fireEvent.change(nameInput, { target: { value: "Inventory System" } })
    fireEvent.change(urlInput, {
      target: { value: "https://wms.company.com/api" },
    })

    const submitBtn = await findByText("Create Connection")
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith({
        name: "Inventory System",
        baseUrl: "https://wms.company.com/api",
        authType: "NONE",
        description: undefined,
        headers: undefined,
      })
    })
  })

  it("opens delete confirmation dialog and deletes item", async () => {
    const { findByText, getByTitle } = render(
      <AiConnectionsPageClient initialConnections={[mockSampleConnection]} />
    )

    const deleteBtn = getByTitle("Delete Connection")
    fireEvent.click(deleteBtn)

    expect(await findByText("Delete API Connection")).toBeTruthy()

    const confirmBtn = await findByText("Delete Connection")
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledTimes(1)
    })
  })
})
