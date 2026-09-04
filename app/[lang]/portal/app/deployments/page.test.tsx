import "@/test/register"
import { describe, expect, it, mock, afterEach } from "bun:test"
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
        failureReason: null,
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

const { default: AdminDeploymentsPage } = await import("./page")

afterEach(() => {
  cleanup()
  mock.restore()
})

describe("AdminDeploymentsPage", () => {
  it("renders page header and table headers", async () => {
    const { getByText, getAllByText } = render(<AdminDeploymentsPage />)
    expect(
      getByText(
        "Cross-organization deploy rollouts, status monitoring, and build inspection."
      )
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(getByText("Store API")).toBeInTheDocument()
      expect(getByText("dep_abc")).toBeInTheDocument()
      expect(getAllByText("RUNNING").length).toBeGreaterThanOrEqual(1)
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
})
