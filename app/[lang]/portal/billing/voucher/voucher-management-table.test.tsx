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
  return React.createElement("span", {
    "data-testid": "phosphor-icon",
    ...props,
  })
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
  (): Promise<{ data: unknown; error?: unknown }> =>
    Promise.resolve({ data: { ok: true } })
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
const { cleanup, fireEvent, render, waitFor, within } =
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

function mockCreateResponse(data: unknown) {
  mockCreatePost.mockImplementation(async () => ({ data }))
}

async function openReadyCreateDialog(
  view: Awaited<ReturnType<typeof renderTable>>
) {
  const user = userEvent.setup()

  await user.click(view.getByRole("button", { name: /create voucher/i }))

  const dialog = await view.findByRole("dialog")
  const dialogQueries = within(dialog)

  await user.type(dialogQueries.getByLabelText(/amount/i), "10000")
  await user.type(
    dialogQueries.getByLabelText(/expires at/i),
    "2099-12-31T23:59"
  )

  const submit = dialogQueries.getByRole("button", {
    name: "Create",
  }) as HTMLButtonElement
  await waitFor(() => {
    expect(submit.disabled).toBe(false)
  })

  return { user, dialog, dialogQueries, submit }
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
    mockCreateResponse({ ok: true })
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

  it.serial(
    "renders fieldErrors under the matching create form inputs",
    async () => {
      const view = await renderTable()

      mockCreateResponse({
        ok: false,
        message: "Validation failed",
        fieldErrors: {
          prefix: ["Prefix must contain only uppercase letters A-Z"],
          amount: ["amount must be positive"],
        },
      })

      const { user, dialogQueries, submit } = await openReadyCreateDialog(view)

      await user.click(submit)

      await waitFor(() => {
        expect(mockCreatePost).toHaveBeenCalledTimes(1)
      })
      await waitFor(() => {
        expect(
          dialogQueries.getByText(
            "Prefix must contain only uppercase letters A-Z"
          )
        ).toBeTruthy()
        expect(dialogQueries.getByText("amount must be positive")).toBeTruthy()
      })

      expect(dialogQueries.queryByText("Validation failed")).toBeNull()
      expect(dialogQueries.queryByText("Failed to create voucher")).toBeNull()
    }
  )

  it.serial(
    "shows top-level createError when no fieldErrors are returned",
    async () => {
      const view = await renderTable()

      mockCreateResponse({
        ok: false,
        message: "Only administrators can create vouchers.",
      })

      const { user, dialogQueries, submit } = await openReadyCreateDialog(view)

      await user.click(submit)

      await waitFor(() => {
        expect(mockCreatePost).toHaveBeenCalledTimes(1)
      })
      await waitFor(() => {
        expect(
          dialogQueries.getByText("Only administrators can create vouchers.")
        ).toBeTruthy()
      })
    }
  )

  it.serial("clears field error when user edits the field", async () => {
    const view = await renderTable()

    mockCreateResponse({
      ok: false,
      fieldErrors: { prefix: ["Invalid prefix format"] },
    })

    const { user, dialogQueries, submit } = await openReadyCreateDialog(view)

    await user.click(submit)

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(dialogQueries.getByText("Invalid prefix format")).toBeTruthy()
    })

    fireEvent.input(dialogQueries.getByLabelText(/prefix/i), {
      target: { value: "WELCOME" },
    })

    await waitFor(() => {
      expect(dialogQueries.queryByText("Invalid prefix format")).toBeNull()
    })
  })
})
