import { beforeEach, describe, expect, it, mock } from "bun:test"

const findDeployment = mock(async () => null as unknown)
const findLatest = mock(async () => ({ id: "dep-1" }))
const createLog = mock(async () => ({ id: "email-1" }))
const deleteLog = mock(async () => ({ count: 1 }))
const sendEmail = mock(async () => null)
const readKV = mock(async () => ({ INITIAL_PASSWORD: "private-value" }))
const getUser = mock(async () => ({ email: "owner@example.test" }))
const listMemberships = mock(async () => ({
  autoPagination: async () => [
    { userId: "user-1", role: { slug: "user_owner" } },
  ],
}))
const resolveIntegration = mock(async () => ({
  endpoint: "https://prometheus.example.test",
  username: "metrics",
  password: "private",
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    applicationDeployment: {
      findUnique: findDeployment,
      findFirst: findLatest,
    },
    emailLog: { create: createLog, deleteMany: deleteLog },
  },
}))
mock.module("@/lib/queue/email", () => ({ sendEmail }))
mock.module("@/lib/vault/vault-client", () => ({
  VaultClient: class {
    readKV = readKV
    writeKV = mock(async () => ({ version: 1 }))
    deleteKV = mock(async () => {})
    getKVMetadata = mock(async () => ({ currentVersion: 1 }))
  },
  VaultSecretNotFoundError: class extends Error {},
}))
mock.module("@workos-inc/node", () => ({
  createWorkOS: () => ({
    userManagement: { listOrganizationMemberships: listMemberships, getUser },
  }),
}))
const RealClusterIntegrationService =
  await import("@/modules/deploy/cluster-integration.service")
mock.module("@/modules/deploy/cluster-integration.service", () => ({
  ...RealClusterIntegrationService,
  resolveDefaultAppHostingClusterId:
    RealClusterIntegrationService.resolveDefaultAppHostingClusterId,
  resolveClusterIntegration:
    RealClusterIntegrationService.resolveClusterIntegration,
  resolveAppHostingClusterForStack:
    RealClusterIntegrationService.resolveAppHostingClusterForStack,
  resolveClusterIntegrationByClusterCode: resolveIntegration,
}))

const { hasReadyPrometheusPod, notifyReadyTemplateDeployment } =
  await import("./app-ready-notification.service")

const deployed = {
  id: "dep-1",
  status: "RUNNING",
  ingressVerified: true,
  stack: {
    id: "stack-1",
    organizationId: "org-1",
    slug: "router-app",
    subdomain: "router.example.test",
    customDomain: null,
    status: "RUNNING",
    cluster: { code: "sgp" },
    envVarsJson: [{ key: "INITIAL_PASSWORD", type: "secret_ref" }],
    template: {
      name: "Router",
      blueprintJson: {
        version: "1.0.0",
        runtime: { image: "router:1", defaultPort: 20128 },
        resources: { defaultCpu: 250, defaultMemory: 256 },
        envSchema: [
          {
            key: "INITIAL_PASSWORD",
            label: "Initial password",
            required: true,
            isSecret: true,
            dataType: "string",
          },
        ],
        access: {
          mode: "password-only",
          title: "Use Router",
          loginPath: "/login",
          fields: [
            {
              id: "password",
              label: "Initial password",
              source: "env",
              key: "INITIAL_PASSWORD",
              secret: true,
            },
          ],
          steps: [
            {
              text: "Reveal initial password",
              action: {
                type: "reveal-field",
                fieldId: "password",
              },
            },
            { text: "Open dashboard", action: { type: "open-app" } },
          ],
        },
      },
    },
  },
}

const samples = (ready = true, stale = false) =>
  mock(async (input: unknown) => {
    const url = new URL(String(input))
    const query = url.searchParams.get("query") ?? ""
    const value = query.includes("kube_pod_status_ready") && !ready ? "0" : "1"
    return new Response(
      JSON.stringify({
        status: "success",
        data: {
          result: [
            {
              metric: { pod: "router-app-deploy-0" },
              value: [Date.now() / 1000 - (stale ? 500 : 5), value],
            },
          ],
        },
      }),
      { status: 200 }
    )
  }) as unknown as typeof fetch

describe("ready template notification", () => {
  beforeEach(() => {
    findDeployment.mockClear()
    findDeployment.mockResolvedValue(deployed)
    findLatest.mockClear()
    findLatest.mockResolvedValue({ id: "dep-1" })
    createLog.mockClear()
    createLog.mockResolvedValue({ id: "email-1" })
    deleteLog.mockClear()
    sendEmail.mockClear()
    readKV.mockClear()
    readKV.mockResolvedValue({ INITIAL_PASSWORD: "private-value" })
    getUser.mockClear()
    listMemberships.mockClear()
    resolveIntegration.mockClear()
    resolveIntegration.mockResolvedValue({
      endpoint: "https://prometheus.example.test",
      username: "metrics",
      password: "private",
    })
  })

  it("rejects missing, stale, and unready Prometheus pod samples", async () => {
    expect(
      await hasReadyPrometheusPod(
        { organizationId: "org-1", slug: "router-app", clusterCode: "sgp" },
        samples()
      )
    ).toBe(true)
    expect(
      await hasReadyPrometheusPod(
        { organizationId: "org-1", slug: "router-app", clusterCode: "sgp" },
        samples(false)
      )
    ).toBe(false)
    expect(
      await hasReadyPrometheusPod(
        { organizationId: "org-1", slug: "router-app", clusterCode: "sgp" },
        samples(true, true)
      )
    ).toBe(false)
  })

  it("does not send when ingress is not verified or Vault secret is empty", async () => {
    findDeployment.mockResolvedValueOnce({
      ...deployed,
      ingressVerified: false,
    })
    await notifyReadyTemplateDeployment("dep-1")
    expect(sendEmail).not.toHaveBeenCalled()
    readKV.mockResolvedValueOnce({ INITIAL_PASSWORD: "" })
    const previousFetch = globalThis.fetch
    globalThis.fetch = samples()
    try {
      await notifyReadyTemplateDeployment("dep-1")
    } finally {
      globalThis.fetch = previousFetch
    }
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("does not send for a superseded deployment", async () => {
    findLatest.mockResolvedValueOnce({ id: "dep-2" })
    await notifyReadyTemplateDeployment("dep-1")
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("emails the owner a guide link without leaking a password", async () => {
    const previousFetch = globalThis.fetch
    globalThis.fetch = samples()
    try {
      await notifyReadyTemplateDeployment("dep-1")
    } finally {
      globalThis.fetch = previousFetch
    }
    expect(createLog).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const payload = (
      createLog as unknown as {
        mock: {
          calls: Array<[{ data: { bodyHtml: string; eventKey: string } }]>
        }
      }
    ).mock.calls[0]?.[0]
    expect(payload.data.bodyHtml).toContain("Reveal initial password")
    expect(payload.data.bodyHtml).toContain(
      "/id/console/app/platform/router-app?tab=overview"
    )
    expect(payload.data.bodyHtml).toContain("/id/docs")
    expect(payload.data.bodyHtml).toContain("/id/console/support-tickets/new")
    expect(payload.data.bodyHtml).not.toContain("private-value")
    expect(payload.data.eventKey).toBe("app-ready:stack-1")
  })
})
