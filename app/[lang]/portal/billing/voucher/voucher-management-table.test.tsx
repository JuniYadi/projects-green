import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import * as React from "react"

// ── Mock next/navigation ────────────────────────────────────────────────
const routerPushMock = mock(() => {})

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
}))

// ── Mock phosphor icons used by the table tree ──────────────────────────
function IconStub(props: Record<string, unknown>) {
  return React.createElement("span", props)
}

mock.module("@phosphor-icons/react", () => ({
  ArrowLeftIcon: IconStub,
  ArrowRightIcon: IconStub,
  ArrowsDownUpIcon: IconStub,
  CaretDownIcon: IconStub,
  CaretUpIcon: IconStub,
  CopySimpleIcon: IconStub,
  PlusIcon: IconStub,
}))

// ── Mock eden client ────────────────────────────────────────────────────
const sampleVouchers = [
  {
    id: "v1",
    code: "WELCOME-ABC123",
    prefix: "WELCOME",
    status: "ACTIVE",
    maxClaims: 1,
    claimedCount: 0,
    expiresAt: "2099-01-01T00:00:00.000Z",
    amount: "10000",
    currency: "IDR",
    targetWorkosUserId: null,
    targetOrganizationId: null,
    createdByWorkosUserId: "user_1",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "v2",
    code: "PROMO-XYZ789",
    prefix: "PROMO",
    status: "ACTIVE",
    maxClaims: 5,
    claimedCount: 1,
    expiresAt: "2099-06-01T00:00:00.000Z",
    amount: "25000",
    currency: "IDR",
    targetWorkosUserId: null,
    targetOrganizationId: null,
    createdByWorkosUserId: "user_1",
    createdAt: "2026-01-02T00:00:00.000Z",
  },
]

const mockListGet = mock(
  (): Promise<{ data: unknown; error?: unknown }> =>
    Promise.resolve({
      data: {
        ok: true,
        data: sampleVouchers,
        total: sampleVouchers.length,
      },
    })
)

const mockCreatePost = mock(
  (): Promise<unknown> => Promise.resolve({ data: { ok: true } })
)

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      vouchers: {
        portal: {
          get: mockListGet,
          post: mockCreatePost,
        },
      },
    },
  },
}))

// Imports after mocks so the component sees the stubbed modules.
// Static imports cannot run after mock.module in bun's loader.
const { cleanup, fireEvent, render, waitFor } =
  await import("@testing-library/react")
const { default: userEvent } = await import("@testing-library/user-event")
const { VoucherManagementTable } = await import("./voucher-management-table")

async function renderTable() {
  const view = render(<VoucherManagementTable />)
  await waitFor(() => {
    expect(mockListGet).toHaveBeenCalled()
  })
  await waitFor(() => {
    expect(view.queryByText("WELCOME-ABC123")).not.toBeNull()
  })
  return view
}

describe("VoucherManagementTable", () => {
  beforeEach(() => {
    mockListGet.mockClear()
    mockCreatePost.mockClear()
    routerPushMock.mockClear()
    mockListGet.mockResolvedValue({
      data: {
        ok: true,
        data: sampleVouchers,
        total: sampleVouchers.length,
      },
    })
    mockCreatePost.mockResolvedValue({ data: { ok: true } })
  })

  afterEach(() => {
    cleanup()
  })

  it.serial(
    "renders a single DataTable search input and no duplicate prefix search",
    async () => {
      const view = await renderTable()

      const searchInputs = view.getAllByPlaceholderText("Search vouchers...")
      expect(searchInputs).toHaveLength(1)
      expect(
        view.queryByPlaceholderText("Search vouchers by prefix...")
      ).toBeNull()
    }
  )

  it.serial(
    "filters the voucher list via the DataTable search input",
    async () => {
      const user = userEvent.setup()
      const view = await renderTable()

      expect(view.getByText("WELCOME-ABC123")).toBeTruthy()
      expect(view.getByText("PROMO-XYZ789")).toBeTruthy()

      const search = view.getByPlaceholderText("Search vouchers...")
      await user.type(search, "PROMO")

      await waitFor(() => {
        expect(view.queryByText("WELCOME-ABC123")).toBeNull()
        expect(view.getByText("PROMO-XYZ789")).toBeTruthy()
      })
    }
  )

  it.serial("does not send prefix as a list query param", async () => {
    await renderTable()

    expect(mockListGet).toHaveBeenCalled()
    const rawCall = mockListGet.mock.calls[0] as unknown
    const callArg =
      Array.isArray(rawCall) && rawCall[0] && typeof rawCall[0] === "object"
        ? (rawCall[0] as { $query?: Record<string, string> })
        : undefined
    expect(callArg?.$query).toBeDefined()
    expect(callArg?.$query?.prefix).toBeUndefined()
    expect(callArg?.$query?.limit).toBe("20")
    expect(callArg?.$query?.offset).toBe("0")
  })

  it.serial("renders fieldErrors under matching form inputs", async () => {
    const user = userEvent.setup()
    mockCreatePost.mockResolvedValue({
      data: {
        ok: false,
        message: "Validation failed",
        fieldErrors: {
          prefix: ["Prefix must be uppercase letters only"],
          amount: ["amount must be positive"],
        },
      },
    })

    const view = await renderTable()

    await user.click(view.getByRole("button", { name: /create voucher/i }))

    fireEvent.change(view.getByLabelText(/amount/i), {
      target: { value: "10000" },
    })
    fireEvent.change(view.getByLabelText(/expires at/i), {
      target: { value: "2099-12-31T23:59" },
    })

    await user.click(view.getByRole("button", { name: /^create$/i }))

    await waitFor(() => {
      expect(
        view.getByText("Prefix must be uppercase letters only")
      ).toBeTruthy()
      expect(view.getByText("amount must be positive")).toBeTruthy()
    })

    // Top-level banner stays hidden when fieldErrors are present
    expect(view.queryByText("Validation failed")).toBeNull()
    expect(view.queryByText("Failed to create voucher")).toBeNull()
  })

  it.serial(
    "shows top-level createError when no fieldErrors returned",
    async () => {
      const user = userEvent.setup()
      mockCreatePost.mockResolvedValue({
        data: {
          ok: false,
          message: "Only administrators can create vouchers",
        },
      })

      const view = await renderTable()

      await user.click(view.getByRole("button", { name: /create voucher/i }))

      fireEvent.change(view.getByLabelText(/amount/i), {
        target: { value: "10000" },
      })
      fireEvent.change(view.getByLabelText(/expires at/i), {
        target: { value: "2099-12-31T23:59" },
      })

      await user.click(view.getByRole("button", { name: /^create$/i }))

      await waitFor(() => {
        expect(
          view.getByText("Only administrators can create vouchers")
        ).toBeTruthy()
      })
    }
  )

  it.serial("clears field error when user edits the field", async () => {
    const user = userEvent.setup()
    mockCreatePost.mockResolvedValue({
      data: {
        ok: false,
        fieldErrors: { prefix: ["Invalid prefix format"] },
      },
    })

    const view = await renderTable()

    await user.click(view.getByRole("button", { name: /create voucher/i }))

    fireEvent.change(view.getByLabelText(/amount/i), {
      target: { value: "10000" },
    })
    fireEvent.change(view.getByLabelText(/expires at/i), {
      target: { value: "2099-12-31T23:59" },
    })
    await user.click(view.getByRole("button", { name: /^create$/i }))

    await waitFor(() => {
      expect(view.getByText("Invalid prefix format")).toBeTruthy()
    })

    await user.type(view.getByLabelText(/prefix/i), "WELCOME")

    await waitFor(() => {
      expect(view.queryByText("Invalid prefix format")).toBeNull()
    })
  })
})
