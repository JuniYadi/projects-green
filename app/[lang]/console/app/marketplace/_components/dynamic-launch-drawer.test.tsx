import { cleanup, fireEvent, render } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterEach, describe, expect, it, mock } from "bun:test"
import type { AppTemplateBlueprint } from "@/modules/deploy/blueprint/app-template-blueprint.schema"

mock.module("@/lib/billing-client", () => ({
  getCatalogProduct: mock(async () => ({
    ok: true,
    product: {
      code: "APP_HOSTING",
      name: "App Hosting",
      plans: [
        {
          id: "plan_starter",
          code: "STARTER",
          name: "Starter",
          offers: [
            {
              id: "off_1",
              billingPeriod: "MONTHLY",
              periodPrice: "15000",
              currency: "IDR",
            },
          ],
        },
      ],
    },
  })),
  getAccount: mock(async () => ({
    ok: true,
    currency: "IDR",
    balanceIdr: "5000",
    formattedBalance: "Rp 5.000",
    isAboveWarn: true,
    isPositive: true,
  })),
  getInvoice: mock(async () => ({ ok: true })),
  formatBillingMoney: (amt: number | string, curr: string) => `${curr} ${amt}`,
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      payments: {
        topup: {
          methods: {
            get: mock(async () => ({
              data: { ok: true, config: { presets: [50000] } },
            })),
          },
          post: mock(async () => ({ data: { ok: true } })),
        },
      },
    },
  },
}))

import {
  DynamicLaunchDrawer,
  type MarketplaceTemplateItem,
} from "./dynamic-launch-drawer"

const mockBlueprint: AppTemplateBlueprint = {
  version: "1.0.0",
  runtime: {
    image: "docker.io/n8nio/n8n:latest",
    defaultPort: 5678,
    healthCheckPath: "/healthz",
    runAsNonRoot: true,
  },
  resources: {
    defaultCpu: 500,
    defaultMemory: 512,
    minCpu: 250,
    minMemory: 256,
  },
  storage: {
    enabled: true,
    mountPath: "/home/node/.n8n",
    sizeGbDefault: 5,
  },
  dependencies: [
    {
      serviceType: "POSTGRESQL",
      alias: "db",
      envPrefix: "DB",
    },
  ],
  envSchema: [
    {
      key: "N8N_ENCRYPTION_KEY",
      label: "Encryption Key",
      description: "Key used to encrypt credentials in n8n database",
      required: true,
      isSecret: true,
      dataType: "string",
      generateRandomHex: 32,
    },
    {
      key: "N8N_PORT",
      label: "Port",
      defaultValue: "5678",
      required: true,
      isSecret: false,
      dataType: "number",
    },
    {
      key: "LOG_LEVEL",
      label: "Log Level",
      defaultValue: "info",
      required: false,
      isSecret: false,
      dataType: "select",
      options: ["debug", "info", "warn", "error"],
    },
  ],
}

const mockTemplate: MarketplaceTemplateItem = {
  id: "tpl_n8n_123",
  slug: "n8n",
  name: "n8n Workflow Automation",
  tagline: "Fair-code workflow automation tool",
  description: "Self-hosted workflow automation platform",
  category: "AUTOMATION",
  iconUrl: "https://assets.pfnapp.com/templates/n8n.svg",
  isOfficial: true,
  isFeatured: true,
  installCount: 1420,
  priceMonthly: 0,
  currency: "USD",
  blueprint: mockBlueprint,
}

describe("DynamicLaunchDrawer", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders drawer when open with template details", () => {
    const handleOpenChange = mock(() => {})
    const handleDeploy = mock(async () => {})

    const view = render(
      <DynamicLaunchDrawer
        open={true}
        onOpenChange={handleOpenChange}
        template={mockTemplate}
        onDeploy={handleDeploy}
      />
    )

    expect(view.getByText("Deploy n8n Workflow Automation")).toBeDefined()
    expect(view.getByText("Fair-code workflow automation tool")).toBeDefined()
    expect(view.getByText("Official")).toBeDefined()
    expect(view.getByText("Hosting Package & Sizing")).toBeDefined()
    expect(view.getByText("POSTGRESQL")).toBeDefined()
  })

  it("auto-suggests app name and subdomain preview with pfnapp.com", () => {
    const view = render(
      <DynamicLaunchDrawer
        open={true}
        onOpenChange={() => {}}
        template={mockTemplate}
        onDeploy={() => {}}
      />
    )
    const appNameInput = document.querySelector(
      "#app-name-input"
    ) as HTMLInputElement
    expect(appNameInput).toBeDefined()
    expect(appNameInput.value).toMatch(/^n8n-[a-z]+-[a-z]+$/)
    expect(
      view.getByText(/https:\/\/n8n-[a-z]+-[a-z]+\.pfnapp\.com/)
    ).toBeDefined()
  })

  it("auto-populates env vars including hex-generated secret key and default values", () => {
    render(
      <DynamicLaunchDrawer
        open={true}
        onOpenChange={() => {}}
        template={mockTemplate}
        onDeploy={() => {}}
      />
    )

    const secretInput = document.querySelector(
      "#env-field-N8N_ENCRYPTION_KEY"
    ) as HTMLInputElement
    expect(secretInput).toBeDefined()
    expect(secretInput.type).toBe("password")
    // Generated 32 hex chars
    expect(secretInput.value).toHaveLength(32)

    const portInput = document.querySelector(
      "#env-field-N8N_PORT"
    ) as HTMLInputElement
    expect(portInput).toBeDefined()
    expect(portInput.value).toBe("5678")
  })

  it("toggles secret visibility with eye button", async () => {
    const view = render(
      <DynamicLaunchDrawer
        open={true}
        onOpenChange={() => {}}
        template={mockTemplate}
        onDeploy={() => {}}
      />
    )

    const secretInput = document.querySelector(
      "#env-field-N8N_ENCRYPTION_KEY"
    ) as HTMLInputElement
    expect(secretInput.type).toBe("password")

    const toggleBtn = view.getByLabelText("Show Encryption Key")
    fireEvent.click(toggleBtn)

    expect(secretInput.type).toBe("text")

    const hideBtn = view.getByLabelText("Hide Encryption Key")
    fireEvent.click(hideBtn)

    expect(secretInput.type).toBe("password")
  })

  it("displays monthly package subscription badge", () => {
    const view = render(
      <DynamicLaunchDrawer
        open={true}
        onOpenChange={() => {}}
        template={mockTemplate}
        onDeploy={() => {}}
        userBalance={50.0}
      />
    )

    expect(view.getByText("Monthly Subscription")).toBeDefined()
  })

  it("triggers onDeploy callback with customized app configuration", async () => {
    const handleDeploy = mock(async () => {})
    const user = userEvent.setup()

    const view = render(
      <DynamicLaunchDrawer
        open={true}
        onOpenChange={() => {}}
        template={mockTemplate}
        onDeploy={handleDeploy}
      />
    )

    const appNameInput = document.querySelector(
      "#app-name-input"
    ) as HTMLInputElement
    await user.clear(appNameInput)
    await user.type(appNameInput, "my-custom-n8n")

    const deployButton = view.getByText("Confirm & Deploy Instantly")
    fireEvent.click(deployButton)

    expect(handleDeploy).toHaveBeenCalledTimes(1)
    const payload = (handleDeploy.mock.calls as unknown[][])[0]![0] as {
      templateId: string
      templateSlug: string
      appName: string
      subdomain: string
      billingMode: string
      envVars: Record<string, string>
    }
    expect(payload.templateId).toBe("tpl_n8n_123")
    expect(payload.templateSlug).toBe("n8n")
    expect(payload.subdomain).toBe("my-custom-n8n.pfnapp.com")
    expect(payload.billingMode).toBe("PACKAGE")
    expect(payload.envVars.N8N_PORT).toBe("5678")
    expect(payload.envVars.N8N_ENCRYPTION_KEY).toHaveLength(32)
  })

  it("shows insufficient balance warning banner and allows triggering quick top-up", async () => {
    const view = render(
      <DynamicLaunchDrawer
        open={true}
        onOpenChange={() => {}}
        template={mockTemplate}
        onDeploy={() => {}}
        userBalance={5000}
        currency="IDR"
      />
    )

    expect(
      await view.findByText("Insufficient balance for this plan")
    ).toBeDefined()
    expect(view.getByText(/First month requires/i)).toBeDefined()

    const topupBtn = view.getByRole("button", {
      name: /Quick Top-Up/i,
    })
    expect(topupBtn).toBeDefined()
    fireEvent.click(topupBtn)

    expect(await view.findByText("Express Top Up")).toBeDefined()
  })
})
