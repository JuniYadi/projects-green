import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"
import type {
  SupportTicket,
  SupportTicketListResult,
} from "@/modules/support-tickets/support-ticket.types"

let currentSearchParams = new URLSearchParams()
const mockRouterReplace = mock()
const mockListAdminTickets =
  mock<
    (params: {
      includeClosed?: boolean
      organizationId?: string
      page?: number
      pageSize?: number
    }) => Promise<SupportTicketListResult>
  >()

mock.module("next/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
  usePathname: () => "/en/portal/support-tickets",
  useSearchParams: () => currentSearchParams,
}))

mock.module("@/modules/support-tickets/api/support-tickets.client", () => ({
  createSupportTicketsClient: () => ({
    listAdminTickets: mockListAdminTickets,
  }),
}))

mock.module("@/components/data-table", () => ({
  DataTable: (props: {
    columns: Array<{
      accessorKey?: string
      cell?: (context: unknown) => ReactNode
    }>
    data: SupportTicket[]
    defaultColumnVisibility: Record<string, boolean>
  }) => {
    return (
      <div data-testid="data-table">
        {props.data.map((row, rowIndex) => (
          <div key={row.id} data-testid="data-row">
            {props.columns.map((column) => {
              if (!column.cell) return null
              return (
                <div
                  key={`${row.id}-${column.accessorKey ?? rowIndex}`}
                  data-testid={`cell-${column.accessorKey ?? "unknown"}`}
                >
                  {column.cell({ row: { original: row } })}
                </div>
              )
            })}
          </div>
        ))}
        <div data-testid="default-visibility">
          {JSON.stringify(props.defaultColumnVisibility)}
        </div>
      </div>
    )
  },
}))

const { SupportTicketsPortal } = await import("./support-tickets-portal")

const ticket = (
  id: string,
  subject: string,
  organizationId: string,
  overrides: Partial<SupportTicket> = {}
): SupportTicket => ({
  id,
  ticketNumber: `TCK-${id}`,
  organizationId,
  requesterWorkosUserId: "user_1",
  assignedAgentWorkosUserId: null,
  department: "technical",
  priority: "medium",
  service: "deploy",
  status: "open",
  subject,
  description: "d",
  secureForm: null,
  attachmentMetadata: [],
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  resolvedAt: null,
  closedAt: null,
  ...overrides,
})

const result = (
  tickets: SupportTicket[],
  total = tickets.length,
  page = 1,
  pageSize = 20
): SupportTicketListResult => ({ tickets, total, page, pageSize })

describe("SupportTicketsPortal", () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams()
    mockRouterReplace.mockReset()
    mockListAdminTickets.mockReset()
  })

  afterEach(() => {
    currentSearchParams = new URLSearchParams()
  })

  it("uses active-only defaults, visible organization, and enriched cells", async () => {
    mockListAdminTickets.mockResolvedValueOnce(
      result(
        [
          ticket("1", "A very long support subject", "org_a", {
            organizationName: "Acme Corp",
          }),
        ],
        41
      )
    )

    const view = render(<SupportTicketsPortal lang="en" />)

    await waitFor(() =>
      expect(mockListAdminTickets).toHaveBeenCalledWith({
        includeClosed: false,
        organizationId: undefined,
        page: 1,
        pageSize: 20,
      })
    )

    const visibility = JSON.parse(
      view.getByTestId("default-visibility").textContent ?? "{}"
    ) as Record<string, boolean>
    expect(visibility.department).toBe(true)
    expect(visibility.status).toBe(true)
    expect(visibility.organizationId).toBe(true)
    expect(view.getByTestId("cell-organizationId")).toHaveTextContent(
      "Acme Corp"
    )
    expect(
      view
        .getByTestId("cell-organizationId")
        .firstElementChild?.getAttribute("title")
    ).toBe("org_a")
    expect(view.getByTestId("cell-subject")).toHaveTextContent(
      "A very long support subject"
    )
    expect(
      view.getByTestId("cell-subject").firstElementChild?.getAttribute("title")
    ).toBe("A very long support subject")
  })

  it("initializes page state from the main-page URL", async () => {
    currentSearchParams = new URLSearchParams(
      "page=2&pageSize=50&includeClosed=1"
    )
    mockListAdminTickets.mockResolvedValue(result([], 80, 2, 50))

    render(<SupportTicketsPortal lang="en" />)

    await waitFor(() =>
      expect(mockListAdminTickets).toHaveBeenCalledWith({
        includeClosed: true,
        organizationId: undefined,
        page: 2,
        pageSize: 50,
      })
    )
  })

  it("keeps embedded organization state internal and hides organization", async () => {
    mockListAdminTickets.mockResolvedValueOnce(
      result([ticket("1", "Scoped", "org_2")], 1)
    )

    const view = render(
      <SupportTicketsPortal lang="en" organizationId="org_2" />
    )

    await waitFor(() =>
      expect(mockListAdminTickets).toHaveBeenCalledWith({
        includeClosed: false,
        organizationId: "org_2",
        page: 1,
        pageSize: 20,
      })
    )
    expect(mockRouterReplace).not.toHaveBeenCalled()
    const visibility = JSON.parse(
      view.getByTestId("default-visibility").textContent ?? "{}"
    ) as Record<string, boolean>
    expect(visibility.organizationId).toBe(false)
  })

  it("toggles Show closed and resets to page one", async () => {
    mockListAdminTickets
      .mockResolvedValueOnce(result([], 40))
      .mockResolvedValueOnce(result([], 40, 1, 20))

    const view = render(<SupportTicketsPortal lang="en" />)
    await waitFor(() => expect(mockListAdminTickets).toHaveBeenCalledTimes(1))

    fireEvent.click(view.getByLabelText("Show closed"))

    await waitFor(() =>
      expect(mockListAdminTickets).toHaveBeenCalledWith({
        includeClosed: true,
        organizationId: undefined,
        page: 1,
        pageSize: 20,
      })
    )
    expect(mockRouterReplace).toHaveBeenCalledWith(
      "/en/portal/support-tickets?includeClosed=1",
      { scroll: false }
    )
  })

  it("renders pagination controls and disables the correct buttons", async () => {
    mockListAdminTickets.mockResolvedValueOnce(result([], 41, 1, 20))

    const view = render(<SupportTicketsPortal lang="en" />)
    await waitFor(() => expect(view.getByText("Page 1 of 3")).toBeTruthy())

    expect(view.getByRole("button", { name: "Previous" })).toBeDisabled()
    expect(view.getByRole("button", { name: "Next" })).not.toBeDisabled()
  })
  it("navigates to next page and syncs URL", async () => {
    mockListAdminTickets.mockResolvedValue(result([], 41, 1, 20))
    const view = render(<SupportTicketsPortal lang="en" />)
    await waitFor(() => expect(view.getByText("Page 1 of 3")).toBeTruthy())

    mockListAdminTickets.mockResolvedValueOnce(result([], 41, 2, 20))
    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith(
        expect.stringContaining("page=2"),
        { scroll: false }
      )
    )
  })
  it("navigates to previous page and syncs URL", async () => {
    currentSearchParams = new URLSearchParams("page=2")
    mockListAdminTickets.mockResolvedValue(result([], 41, 2, 20))
    const view = render(<SupportTicketsPortal lang="en" />)
    await waitFor(() => expect(view.getByText("Page 2 of 3")).toBeTruthy())

    mockListAdminTickets.mockResolvedValueOnce(result([], 41, 1, 20))
    fireEvent.click(view.getByRole("button", { name: "Previous" }))

    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith(
        "/en/portal/support-tickets",
        { scroll: false }
      )
    )
  })

  it("changes page size and resets to page one", async () => {
    mockListAdminTickets
      .mockResolvedValueOnce(result([], 60, 1, 20))
      .mockResolvedValueOnce(result([], 60, 1, 50))

    const view = render(<SupportTicketsPortal lang="en" />)
    await waitFor(() => expect(mockListAdminTickets).toHaveBeenCalledTimes(1))

    fireEvent.click(view.getByRole("combobox"))
    await waitFor(() =>
      expect(view.getByRole("option", { name: "50 / page" })).toBeTruthy()
    )
    fireEvent.click(view.getByRole("option", { name: "50 / page" }))

    await waitFor(() =>
      expect(mockListAdminTickets).toHaveBeenCalledWith({
        includeClosed: false,
        organizationId: undefined,
        page: 1,
        pageSize: 50,
      })
    )
  })
  it("shows fallback error for non-Error exceptions", async () => {
    mockListAdminTickets.mockRejectedValueOnce("string error")
    const view = render(<SupportTicketsPortal lang="en" />)
    await waitFor(() => expect(view.getByRole("alert")).toBeTruthy())
    expect(view.getByRole("alert").textContent).toContain(
      "Unable to load support tickets."
    )
  })

  it("renders per-row skeletons while loading", () => {
    mockListAdminTickets.mockReturnValue(new Promise(() => {}))

    const view = render(<SupportTicketsPortal lang="en" />)

    expect(
      view.getAllByTestId("ticket-table-skeleton-row").length
    ).toBeGreaterThan(1)
  })

  it("ignores stale responses when organizationId changes", async () => {
    const first = Promise.withResolvers<SupportTicketListResult>()
    const second = Promise.withResolvers<SupportTicketListResult>()
    mockListAdminTickets.mockReturnValueOnce(first.promise)
    mockListAdminTickets.mockReturnValueOnce(second.promise)

    const view = render(
      <SupportTicketsPortal lang="en" organizationId="org_a" />
    )
    await waitFor(() =>
      expect(mockListAdminTickets).toHaveBeenCalledWith({
        includeClosed: false,
        organizationId: "org_a",
        page: 1,
        pageSize: 20,
      })
    )

    view.rerender(<SupportTicketsPortal lang="en" organizationId="org_b" />)
    await waitFor(() =>
      expect(mockListAdminTickets).toHaveBeenCalledWith({
        includeClosed: false,
        organizationId: "org_b",
        page: 1,
        pageSize: 20,
      })
    )

    second.resolve(result([ticket("2", "Org B subject", "org_b")]))
    first.resolve(result([ticket("1", "Org A subject", "org_a")]))

    await waitFor(() =>
      expect(view.container.textContent).toContain("Org B subject")
    )
    expect(view.container.textContent).not.toContain("Org A subject")
  })

  it("renders the failed-to-load alert when the request rejects", async () => {
    mockListAdminTickets.mockRejectedValueOnce(new Error("Upstream down"))

    const view = render(<SupportTicketsPortal lang="en" />)

    await waitFor(() => expect(view.getByRole("alert")).toBeTruthy())
    expect(view.getByRole("alert").textContent).toContain("Upstream down")
  })
})
