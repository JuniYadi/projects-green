import "@/test/register"
import { getMessages } from "@/lib/i18n/messages"
import { describe, expect, it, mock, afterEach, beforeEach } from "bun:test"
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react"

mock.module("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

const mockPush = mock(() => {})
const mockSearchParams = new URLSearchParams()

mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: "en" })),
  useRouter: mock(() => ({ push: mockPush })),
  useSearchParams: mock(() => mockSearchParams),
}))

mock.module("@/lib/i18n/pathname", () => ({
  localizePathname: (opts: { pathname: string; locale: string }) =>
    `/en${opts.pathname}`,
  resolveLocaleOrDefault: (lang: string) => lang || "en",
}))

const mockGetDeployments = mock(async () => ({
  data: {
    ok: true,
    data: [
      {
        id: "dep_abc",
        stackId: "stack_1",
        stackSlug: "store-api",
        stackName: "Store API",
        organizationId: "org_test",
        status: "RUNNING",
        triggerType: "GIT_PUSH",
        commitSha: "1234567",
        commitMessage: "test: initial deploy",
        commitAuthor: "Alice",
        branchName: "main",
        startedAt: "2026-09-01T10:00:00.000Z",
        completedAt: "2026-09-01T10:01:00.000Z",
        durationMs: 60000,
        failureReason: "ignored for running deployment",
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-01T10:01:00.000Z",
        eventsCount: 3,
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    },
  },
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      admin: {
        deployments: {
          get: mockGetDeployments,
        },
      },
    },
  },
}))

const { default: AdminDeploymentsPage, formatDeploymentDuration } =
  await import("./page-client")

beforeEach(() => {
  mockGetDeployments.mockClear()
  mockPush.mockClear()
})

afterEach(() => {
  cleanup()
  mock.restore()
})
describe("AdminDeploymentsPage", () => {
  it("renders page header and table headers", async () => {
    const { getByText, getAllByText } = render(<AdminDeploymentsPage />)
    expect(
      getByText(
        "Cross-organization deployment rollouts, status monitoring, and build inspection."
      )
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(getByText("Store API")).toBeInTheDocument()
      expect(getByText("dep_abc")).toBeInTheDocument()
      expect(getAllByText("Running").length).toBeGreaterThanOrEqual(1)
    })
  })

  it("filters by organization ID when apply filters clicked", async () => {
    const { getByLabelText, getByText } = render(<AdminDeploymentsPage />)
    const orgInput = getByLabelText("Organization ID")
    fireEvent.change(orgInput, { target: { value: "org_custom" } })

    const applyBtn = getByText("Apply Filters")
    fireEvent.click(applyBtn)

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("organizationId=org_custom")
    )
  })

  it("calls API without undefined or null keys when query params are default", async () => {
    render(<AdminDeploymentsPage />)
    await waitFor(() => {
      expect(mockGetDeployments).toHaveBeenCalledWith({
        $query: {},
      })
    })
  })
  it("includes DEPLOYING in URL-backed status filters", () => {
    const { getByRole } = render(<AdminDeploymentsPage />)
    fireEvent.click(getByRole("button", { name: "Deploying" }))
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("status=DEPLOYING")
    )
  })

  it("formats active, terminal, zero, and long deployment durations", () => {
    const messages = getMessages("en").console.app.adminDeployments
    expect(
      formatDeploymentDuration(
        { status: "RUNNING", durationMs: null },
        messages
      )
    ).toBe("In progress")
    expect(
      formatDeploymentDuration({ status: "FAILED", durationMs: null }, messages)
    ).toBe("Not available")
    expect(
      formatDeploymentDuration({ status: "FAILED", durationMs: 0 }, messages)
    ).toBe("0s")
    expect(
      formatDeploymentDuration(
        { status: "FAILED", durationMs: (6 * 24 + 7) * 60 * 60 * 1000 },
        messages
      )
    ).toBe("6d 7h")
  })

  it("refreshes deployments through the client reload effect", async () => {
    const view = render(<AdminDeploymentsPage />)
    await waitFor(() => expect(mockGetDeployments).toHaveBeenCalledTimes(1))
    const refresh = view.getByTestId("refresh-btn") as HTMLButtonElement
    await waitFor(() => expect(refresh.disabled).toBe(false))
    fireEvent.click(refresh)
    await waitFor(() => expect(mockGetDeployments).toHaveBeenCalledTimes(2))
  })

  it("shows failed reason and opens full details from shortened deployment ID", async () => {
    const fullId = "dep_1234567890abcdef"
    mockGetDeployments.mockResolvedValueOnce({
      data: {
        ok: true,
        data: [
          {
            id: fullId,
            stackId: "stack_1",
            stackSlug: "store-api",
            stackName: "Store API",
            organizationId: "org_test",
            status: "FAILED",
            triggerType: "GIT_PUSH",
            commitSha: "deadbeef",
            commitMessage: "failed build",
            commitAuthor: "Ops",
            branchName: "main",
            startedAt: "2026-09-01T10:00:00.000Z",
            completedAt: "2026-09-01T10:01:00.000Z",
            durationMs: 0,
            failureReason:
              "Build image failed because the registry was unavailable",
            createdAt: "2026-09-01T10:00:00.000Z",
            updatedAt: "2026-09-01T10:01:00.000Z",
            eventsCount: 0,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    })
    const view = render(<AdminDeploymentsPage />)
    await waitFor(() => expect(view.getByText("dep_1234567890…")).toBeTruthy())
    expect(view.getByText(/Build image failed because/)).toBeTruthy()
    fireEvent.click(
      view.getByRole("button", { name: `Deployment ID: ${fullId}` })
    )
    expect(view.getByText(fullId)).toBeTruthy()
  })
})
