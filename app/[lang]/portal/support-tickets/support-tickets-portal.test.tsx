import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const mockListAdminTickets = mock<
  (params?: { organizationId?: string }) => Promise<unknown[]>
>(async () => [])

const dataTableCalls: Array<{
  columns: unknown
  data: unknown
  searchableColumns: unknown
  defaultColumnVisibility: unknown
}> = []

mock.module("@/modules/support-tickets/api/support-tickets.client", () => ({
  createSupportTicketsClient: () => ({
    listAdminTickets: mockListAdminTickets,
  }),
}))

mock.module("@/components/data-table", () => ({
  DataTable: (props: {
    columns: unknown
    data: unknown
    searchableColumns: unknown
    defaultColumnVisibility: unknown
  }) => {
    dataTableCalls.push(props)
    return (
      <div data-testid="data-table">
        {Array.isArray(props.data)
          ? (props.data as Array<{ subject: string }>).map((row, i) => (
              <div key={i} data-testid="data-row">
                {row.subject}
              </div>
            ))
          : null}
        <div data-testid="searchable-columns">
          {JSON.stringify(props.searchableColumns)}
        </div>
        <div data-testid="default-visibility">
          {JSON.stringify(props.defaultColumnVisibility)}
        </div>
        <div data-testid="column-ids">
          {JSON.stringify(
            (props.columns as Array<{ accessorKey?: string }>).map(
              (c) => c.accessorKey
            )
          )}
        </div>
      </div>
    )
  },
}))

const { SupportTicketsPortal } = await import("./support-tickets-portal")

const ticket = (id: string, subject: string, organizationId: string) => ({
  id,
  ticketNumber: `TCK-${id}`,
  organizationId,
  requesterWorkosUserId: "user_1",
  assignedAgentWorkosUserId: null,
  department: "technical" as const,
  priority: "medium" as const,
  service: "deploy" as const,
  status: "open" as const,
  subject,
  description: "d",
  secureForm: null,
  attachmentMetadata: [],
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  resolvedAt: null,
  closedAt: null,
})

describe("SupportTicketsPortal", () => {
  beforeEach(() => {
    mockListAdminTickets.mockReset()
    dataTableCalls.length = 0
  })

  it("calls listAdminTickets with no params when no organizationId is provided", async () => {
    mockListAdminTickets.mockResolvedValueOnce([
      ticket("1", "Unscoped", "org_a"),
    ])

    const view = render(<SupportTicketsPortal lang="en" />)

    await waitFor(() =>
      expect(mockListAdminTickets).toHaveBeenCalledWith(undefined)
    )
    await waitFor(() => {
      const ids = view.container.querySelector(
        '[data-testid="column-ids"]'
      )?.textContent
      expect(ids).toContain("organizationId")
    })
  })

  it("scopes the call and hides organization column when organizationId is provided", async () => {
    mockListAdminTickets.mockResolvedValueOnce([ticket("1", "Scoped", "org_2")])

    const view = render(
      <SupportTicketsPortal lang="en" organizationId="org_2" />
    )

    await waitFor(() =>
      expect(mockListAdminTickets).toHaveBeenCalledWith({
        organizationId: "org_2",
      })
    )
    await waitFor(() => {
      const ids = view.container.querySelector(
        '[data-testid="column-ids"]'
      )?.textContent
      expect(ids).not.toContain("organizationId")
    })
  })

  it("ignores stale responses when organizationId changes", async () => {
    const first = Promise.withResolvers<unknown[]>()
    const second = Promise.withResolvers<unknown[]>()
    mockListAdminTickets.mockReturnValueOnce(first.promise)
    mockListAdminTickets.mockReturnValueOnce(second.promise)

    const view = render(
      <SupportTicketsPortal lang="en" organizationId="org_a" />
    )

    await waitFor(() =>
      expect(mockListAdminTickets).toHaveBeenCalledWith({
        organizationId: "org_a",
      })
    )

    view.rerender(<SupportTicketsPortal lang="en" organizationId="org_b" />)
    await waitFor(() =>
      expect(mockListAdminTickets).toHaveBeenCalledWith({
        organizationId: "org_b",
      })
    )

    second.resolve([ticket("2", "Org B subject", "org_b")])
    first.resolve([ticket("1", "Org A subject", "org_a")])

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
