import { afterEach, describe, expect, it, mock } from "bun:test"
import { act, cleanup, render } from "@testing-library/react"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en", slug: "hermes-vibrant-comet" }),
  useRouter: () => ({ push: () => {}, replace: () => {} }),
}))

const mockStack = {
  id: "stack-1",
  name: "Hermes Comet",
  slug: "hermes-vibrant-comet",
  status: "running",
  framework: "Node.js",
  branchName: "main",
  subdomain: "hermes-vibrant-comet",
  customDomain: null,
  resourcePlanId: "small",
  billingMode: "PAYG",
  billingState: "ACTIVE",
  lastDeployedAt: new Date().toISOString(),
  latestDeploymentId: "dep-1",
  currentStepLabel: "Live",
  currentStepIndex: 4,
  currentStepStartedAt: new Date().toISOString(),
}

const appsProxy = new Proxy(
  {},
  {
    get(_target, _prop: string) {
      return {
        get: mock(async () => ({
          data: {
            ok: true,
            data: {
              stack: mockStack,
              latestDeployment: null,
            },
          },
        })),
      }
    },
  }
)

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      deploy: {
        apps: appsProxy,
      },
    },
  },
}))

mock.module("@/modules/deploy/ui/operate/tab-terminal", () => ({
  TabTerminal: ({ stackId }: { stackId: string }) => (
    <div data-testid="tab-terminal" data-stack-id={stackId}>
      Mocked Terminal
    </div>
  ),
}))

const { default: PlatformTerminalStandalonePage } =
  await import("./page-client")

describe("PlatformTerminalStandalonePage (/console/app/platform/[slug]/terminal)", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders standalone terminal with app header and terminal view", async () => {
    let view: ReturnType<typeof render> | null = null
    await act(async () => {
      view = render(<PlatformTerminalStandalonePage />)
    })

    expect(view).not.toBeNull()
    expect(view!.getByText("Hermes Comet")).toBeDefined()
    expect(view!.getByText("(hermes-vibrant-comet)")).toBeDefined()
    expect(view!.getByTestId("tab-terminal")).toBeDefined()
  })
})
