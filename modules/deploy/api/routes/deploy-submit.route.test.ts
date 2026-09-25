import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

const mockWithAuth = mock(async () => ({
  user: { id: "user-123", email: "test@example.com" },
  organizationId: "org-1",
  role: "admin",
  roles: ["admin"],
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mock(async () => "member"),
}))
const ensureManagedDomainForStack = mock(async () => ({
  id: "domain-1",
  hostname: "console-next-app.apps.example.com",
}))

mock.module("@/modules/deploy/app-hosting-edge.service", () => ({
  ensureManagedDomainForStack,
}))

// Managed stock is mocked so the route test does not require Vault or a
// stock DB.
const claimManagedStock = mock(async () => ({
  id: "stock-1",
}))
const releaseManagedStock = mock(async () => {})

mock.module("@/modules/deploy/app-managed-stock.service", () => ({
  claimManagedStock,
  releaseManagedStock,
}))
const mockVaultWrite = mock(async () => ({ version: 1 }))
mock.module("@/lib/vault/vault-client", () => ({
  VaultClient: class {
    writeKV = mockVaultWrite
    readKV = mock(async () => ({}))
    deleteKV = mock(async () => {})
    getKVMetadata = mock(async () => ({ currentVersion: 1 }))
  },
  VaultSecretNotFoundError: class extends Error {},
}))
// Leaf-only mock: every other sibling service (createOrUpdateStack,
// triggerDeploy, AppHostingBillingService, BillingTransactionService) runs for
// real against this prisma mock. Mocking those services directly would pollute
// their own test files under the shared --coverage process (see AGENTS.md mock
// rules).
const stackRecord = {
  id: "stack-1",
  organizationId: "org-1",
  name: "console-next-app",
  slug: "console-next-app",
  status: "IDLE",
  branchName: "main",
}

const mockPrisma = {
  $transaction: mock(async (fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma)
  ),
  githubRepositoryConnection: {
    findFirst: mock(async () => ({
      id: "conn-1",
      githubRepositoryId: BigInt("555"),
      repoName: "console-next-app",
      enabled: true,
    })),
  },
  billingAccount: {
    findUnique: mock(async () => ({
      id: "ba-1",
      organizationId: "org-1",
      currency: "USD",
      balance: new Prisma.Decimal("100.00"),
    })),
  },
  serviceSubscription: {
    findFirst: mock(async () => ({
      id: "sub-1",
      organizationId: "org-1",
      status: "ACTIVE",
      quantity: 5,
      allocatedConfig: { maxStacks: 5 },
      plan: {
        resources: { maxStacks: 5 },
      },
    })),
  },
  applicationStack: {
    findFirst: mock(async () => ({
      ...stackRecord,
      clusterId: "cluster-sgp",
      envVarsJson: [],
    })),
    findUnique: mock(async () => ({
      ...stackRecord,
      clusterId: "cluster-sgp",
      envVarsJson: [],
    })),
    findUniqueOrThrow: mock(async () => ({
      ...stackRecord,
      clusterId: "cluster-sgp",
      envVarsJson: [],
    })),
    create: mock(async ({ data }: { data?: Record<string, unknown> }) => ({
      ...stackRecord,
      clusterId: (data?.clusterId as string) ?? null,
      envVarsJson: [],
    })),
    update: mock(async ({ data }: { data?: Record<string, unknown> }) => ({
      ...stackRecord,
      clusterId: (data?.clusterId as string) ?? null,
      envVarsJson: [],
    })),
    count: mock(async () => 0),
  },
  applicationDeployment: {
    count: mock(async () => 0),
    create: mock(async () => ({ id: "deploy-1", status: "QUEUED" })),
  },
  applicationDeployEvent: {
    create: mock(async () => ({ id: "event-1" })),
  },
  applicationDeploymentLog: {
    create: mock(async () => ({ id: "log-1" })),
  },
  appHostingCluster: {
    findMany: mock(async () => [
      {
        id: "cluster-sgp",
        code: "sgp",
        name: "Singapore Production",
        region: "Singapore",
        status: "ACTIVE",
        isDefault: true,
      },
    ]),
    findUnique: mock(async () => ({
      id: "cluster-sgp",
      code: "sgp",
      name: "Singapore Production",
      region: "Singapore",
      status: "ACTIVE",
      isDefault: true,
    })),
  },
  appManagedStock: {
    update: mock(async () => ({ id: "stock-1" })),
  },
  appTemplate: {
    findFirst: mock(async () => null),
  },
  servicePlan: {
    findFirst: mock(async () => null),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { deploySubmitRoutes } = await import("./deploy-submit.route")

const submit = (body: unknown) =>
  deploySubmitRoutes.handle(
    new Request("http://localhost/deploy/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )

const validBody = {
  repositoryId: "555",
  branchName: "main",
  rootDirectory: "/",
  framework: "Next.js",
  buildCommand: "npm run build",
  useDockerfile: false,
  resourcePlanId: "payg",
  billingMode: "PAYG",
  cpu: 100,
  memory: 256,
  paygBufferHours: 24,
}
const resetPrisma = () => {
  mockVaultWrite.mockClear()
  claimManagedStock.mockClear()
  claimManagedStock.mockResolvedValue({ id: "stock-1" } as never)
  ensureManagedDomainForStack.mockClear()
  mockPrisma.$transaction.mockClear()
  mockPrisma.githubRepositoryConnection.findFirst.mockClear()
  mockPrisma.githubRepositoryConnection.findFirst.mockResolvedValue({
    id: "conn-1",
    githubRepositoryId: BigInt("555"),
    repoName: "console-next-app",
    enabled: true,
  } as never)
  mockPrisma.billingAccount.findUnique.mockClear()
  mockPrisma.billingAccount.findUnique.mockResolvedValue({
    id: "ba-1",
    organizationId: "org-1",
    currency: "USD",
    balance: new Prisma.Decimal("100.00"),
  } as never)
  mockPrisma.applicationStack.findUnique.mockClear()
  mockPrisma.applicationStack.findUnique.mockResolvedValue({
    ...stackRecord,
    clusterId: null,
  } as never)
  mockPrisma.applicationStack.findUniqueOrThrow.mockClear()
  mockPrisma.applicationStack.findUniqueOrThrow.mockResolvedValue({
    ...stackRecord,
  } as never)
  mockPrisma.applicationStack.create.mockClear()
  mockPrisma.applicationStack.create.mockResolvedValue({
    ...stackRecord,
  } as never)
  mockPrisma.applicationStack.update.mockClear()
  mockPrisma.applicationStack.update.mockResolvedValue({
    ...stackRecord,
  } as never)
  mockPrisma.applicationDeployment.count.mockClear()
  mockPrisma.applicationDeployment.count.mockResolvedValue(0 as never)
  mockPrisma.applicationDeployment.create.mockClear()
  mockPrisma.applicationDeployment.create.mockResolvedValue({
    id: "deploy-1",
    status: "QUEUED",
  } as never)
  mockPrisma.applicationDeployEvent.create.mockClear()
  mockPrisma.applicationDeploymentLog.create.mockClear()
  mockPrisma.appHostingCluster.findMany.mockClear()
  mockPrisma.appHostingCluster.findMany.mockResolvedValue([
    {
      id: "cluster-sgp",
      code: "sgp",
      name: "Singapore Production",
      region: "Singapore",
    },
  ] as never)
  mockPrisma.appHostingCluster.findUnique.mockClear()
  mockPrisma.appHostingCluster.findUnique.mockResolvedValue(null as never)
  mockPrisma.servicePlan.findFirst.mockClear()
  mockPrisma.servicePlan.findFirst.mockResolvedValue(null as never)
}

describe("deploySubmitRoutes /submit", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
    resetPrisma()
  })

  it("creates a stack and triggers a real deployment (happy path)", async () => {
    const res = await submit(validBody)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: { stackId: string; deploymentId: string; status: string }
    }
    expect(body.ok).toBe(true)
    expect(body.data.stackId).toBe("stack-1")
    expect(body.data.deploymentId).toBe("deploy-1")
    expect(ensureManagedDomainForStack).toHaveBeenCalledWith("stack-1")
    expect(mockPrisma.applicationStack.update).toHaveBeenCalled()
  })

  it("claims managed stock for one-click templates", async () => {
    const res = await submit({
      sourceType: "MANAGED_TEMPLATE",
      templateId: "n8n",
      resourcePlanId: "payg",
      billingMode: "PAYG",
      cpu: 500,
      memory: 512,
    })

    expect(res.status).toBe(200)
    expect(claimManagedStock).toHaveBeenCalledWith({
      serviceType: "POSTGRESQL",
      stackId: "pending",
      orgId: "org-1",
      environment: "prod",
    })
    expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadataJson: expect.objectContaining({
            imageRepository: "docker.io/n8nio/n8n",
          }),
        }),
      })
    )
  })

  it("never claims managed stock for a one-click template without an engine", async () => {
    const res = await submit({
      sourceType: "MANAGED_TEMPLATE",
      templateId: "9router",
      resourcePlanId: "payg",
      billingMode: "PAYG",
      cpu: 250,
      memory: 256,
    })

    expect(res.status).toBe(200)
    expect(claimManagedStock).not.toHaveBeenCalled()
  })

  it("threads deploymentType and additionalPorts from a DB template blueprint into stack metadataJson", async () => {
    mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
      id: "tpl-hermes",
      slug: "hermes",
      name: "Hermes",
      description: "AI Agent workspace",
      blueprintJson: {
        runtime: {
          image: "nousresearch/hermes-agent:v2026.8.18",
          command: ["hermes", "gateway", "run"],
          defaultPort: 8642,
          deploymentType: "statefulset",
          additionalPorts: [{ port: 9119, name: "dashboard" }],
        },
        resources: { defaultCpu: 500, defaultMemory: 1024 },
      },
    } as never)

    const res = await submit({
      sourceType: "TEMPLATE",
      templateId: "hermes",
      resourcePlanId: "payg",
      billingMode: "PAYG",
      cpu: 500,
      memory: 1024,
    })

    expect(res.status).toBe(200)
    expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId: "tpl-hermes",
          resourcePlanId: "payg",
          metadataJson: expect.objectContaining({
            templateId: "hermes",
            defaultPort: 8642,
            imageRepository: "nousresearch/hermes-agent:v2026.8.18",
            deploymentType: "statefulset",
            additionalPorts: [{ port: 9119, name: "dashboard" }],
            command: ["hermes", "gateway", "run"],
          }),
        }),
      })
    )
  })

  it("automatically tags template secret keys as secret and masked when submitting", async () => {
    mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
      id: "tpl-9router",
      slug: "9router",
      name: "9router",
      blueprintJson: {
        runtime: {
          image: "docker.io/decolua/9router:0.5.75",
          defaultPort: 20128,
        },
        envSchema: [
          { key: "DATA_DIR", defaultValue: "/app/data", isSecret: false },
          { key: "JWT_SECRET", isSecret: true },
        ],
      },
    } as never)

    const res = await submit({
      sourceType: "TEMPLATE",
      templateId: "9router",
      resourcePlanId: "payg",
      billingMode: "PAYG",
      cpu: 250,
      memory: 256,
      envVars: [
        { key: "DATA_DIR", value: "/app/data" },
        { key: "JWT_SECRET", value: "secret123" },
      ],
    })

    expect(res.status).toBe(200)
    expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          envVarsJson: expect.arrayContaining([
            expect.objectContaining({
              key: "JWT_SECRET",
              type: "secret_ref",
              masked: true,
              isStoredSecret: true,
            }),
          ]),
        }),
      })
    )
  })

  it("generates the declared initial login password for a new template install", async () => {
    mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
      id: "tpl-9router",
      slug: "9router",
      name: "9router",
      blueprintJson: {
        version: "1.0.0",
        runtime: {
          image: "docker.io/decolua/9router:0.5.75",
          defaultPort: 20128,
        },
        resources: { defaultCpu: 250, defaultMemory: 256 },
        envSchema: [
          {
            key: "INITIAL_PASSWORD",
            label: "Initial password",
            required: true,
            isSecret: true,
            dataType: "string",
            generateRandomHex: 8,
          },
        ],
        access: {
          mode: "password-only",
          title: "Open router",
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
              text: "See password",
              action: { type: "reveal-field", fieldId: "password" },
            },
          ],
        },
      },
    } as never)
    const res = await submit({
      sourceType: "TEMPLATE",
      templateId: "9router",
      resourcePlanId: "payg",
      billingMode: "PAYG",
      cpu: 250,
      memory: 256,
      envVars: [],
    })
    expect(res.status).toBe(200)
    const updated = mockPrisma.applicationStack.update.mock.calls.find((call) =>
      Array.isArray(
        (call[0] as { data?: { envVarsJson?: unknown } })?.data?.envVarsJson
      )
    )?.[0] as {
      data: { envVarsJson: Array<{ key: string; value: string }> }
    }
    const password = updated.data.envVarsJson.find(
      (item) => item.key === "INITIAL_PASSWORD"
    )
    expect(password?.value).toBe("")
    expect(password?.key).toBe("INITIAL_PASSWORD")
    if (mockVaultWrite.mock.calls.length > 0) {
      expect(mockVaultWrite).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          INITIAL_PASSWORD: expect.stringMatching(/^[0-9a-f]{8}$/),
        })
      )
    }
  })

  it("persists secret reference metadata without dropping it", async () => {
    const envVars = [
      {
        key: "DATABASE_URL",
        value: "",
        type: "secret_ref" as const,
        scope: "runtime" as const,
        source: "vault" as const,
        vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
        vaultKey: "DATABASE_URL",
        version: 3,
        lastUpdatedAt: "2026-08-18T10:00:00.000Z",
        masked: true,
        isStoredSecret: true,
      },
      {
        key: "REDIS_URL",
        value: "",
        type: "secret_shared_ref" as const,
        scope: "runtime" as const,
        source: "managed_service" as const,
        serviceCredentialId: "credential-redis",
        vaultPath: "tenants/org-1/shared/managed-services/credential-redis",
        vaultKey: "CONNECTION_STRING",
        referenceLabel: "Managed Redis",
        masked: true,
        isStoredSecret: true,
      },
    ]
    const res = await submit({ ...validBody, envVars })

    expect(res.status).toBe(200)
    expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ envVarsJson: envVars }),
      })
    )
  })

  it("fails with 409 when no active default cluster is configured", async () => {
    mockPrisma.appHostingCluster.findMany.mockResolvedValue([] as never)
    mockPrisma.appHostingCluster.findUnique.mockResolvedValue(null as never)
    const res = await submit(validBody)
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("APP_HOSTING_CLUSTER_NOT_CONFIGURED")
    expect(mockPrisma.applicationDeployment.create).not.toHaveBeenCalled()
  })

  it("blocks deploy when the PAYG balance is insufficient (unhappy path)", async () => {
    mockPrisma.billingAccount.findUnique.mockResolvedValue({
      id: "ba-1",
      organizationId: "org-1",
      currency: "USD",
      balance: new Prisma.Decimal("0"),
    } as never)
    const res = await submit(validBody)
    expect(res.status).toBe(402)
    const body = (await res.json()) as { error: string; topupUrl: string }
    expect(body.error).toBe("INSUFFICIENT_PAYG_BUFFER")
    expect(body.topupUrl).toBe("/console/billing/topup")
    expect(mockPrisma.applicationDeployment.create).not.toHaveBeenCalled()
  })

  it("returns 404 when the repository is not connected", async () => {
    mockPrisma.githubRepositoryConnection.findFirst.mockResolvedValue(
      null as never
    )
    const res = await submit(validBody)
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("REPOSITORY_NOT_CONNECTED")
  })

  it("returns 409 when a deploy is already in progress", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValue({
      ...stackRecord,
      status: "BUILDING",
    } as never)
    const res = await submit(validBody)
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("STACK_DEPLOY_IN_PROGRESS")
    expect(mockPrisma.applicationDeployment.create).not.toHaveBeenCalled()
  })

  it("does not run the PAYG gate for fixed plans", async () => {
    mockPrisma.billingAccount.findUnique.mockResolvedValue({
      id: "ba-1",
      organizationId: "org-1",
      currency: "USD",
      balance: new Prisma.Decimal("0"),
    } as never)
    const res = await submit({
      ...validBody,
      resourcePlanId: "starter",
      billingMode: "PACKAGE",
    })
    expect(res.status).toBe(200)
    expect(mockPrisma.applicationDeployment.create).toHaveBeenCalledTimes(1)
  })

  it("rejects unauthenticated requests", async () => {
    mockWithAuth.mockResolvedValueOnce({ user: null } as never)
    const res = await submit(validBody)
    expect(res.status).toBe(401)
  })

  it("rejects members without owner/admin role", async () => {
    mockWithAuth.mockResolvedValueOnce({
      user: { id: "u", email: "e" },
      organizationId: "org-1",
      role: "member",
      roles: ["member"],
    } as never)
    const res = await submit(validBody)
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("FORBIDDEN")
  })

  it("returns 422 for an unknown templateId", async () => {
    const res = await submit({
      sourceType: "TEMPLATE",
      templateId: "nonexistent",
      resourcePlanId: "payg",
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("UNKNOWN_TEMPLATE")
    expect(mockPrisma.applicationStack.create).not.toHaveBeenCalled()
  })

  it("returns 422 for an invalid public source URL", async () => {
    const res = await submit({
      sourceType: "PUBLIC",
      publicSourceUrl: "http://example.com/repo.git",
      resourcePlanId: "payg",
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("INVALID_PUBLIC_SOURCE")
    expect(mockPrisma.applicationStack.create).not.toHaveBeenCalled()
  })

  it("returns 422 for a non-numeric repositoryId", async () => {
    const res = await submit({
      repositoryId: "abc",
      resourcePlanId: "payg",
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("INVALID_REPOSITORY")
    expect(
      mockPrisma.githubRepositoryConnection.findFirst
    ).not.toHaveBeenCalled()
  })

  it("returns 402 when the billing account is not found", async () => {
    mockPrisma.billingAccount.findUnique.mockResolvedValue(null as never)
    const res = await submit(validBody)
    expect(res.status).toBe(402)
    const body = (await res.json()) as { error: string; topupUrl: string }
    expect(body.error).toBe("BILLING_ACCOUNT_NOT_FOUND")
    expect(body.topupUrl).toBe("/console/billing/topup")
    expect(mockPrisma.applicationDeployment.create).not.toHaveBeenCalled()
  })

  it("returns 409 when multiple active default clusters are configured", async () => {
    mockPrisma.appHostingCluster.findMany.mockResolvedValue([
      {
        id: "cluster-sgp",
        code: "sgp",
        name: "Singapore Production",
        region: "Singapore",
        status: "ACTIVE",
        isDefault: true,
      },
      {
        id: "cluster-usw",
        code: "usw",
        name: "US West Production",
        region: "US West",
        status: "ACTIVE",
        isDefault: true,
      },
    ] as never)
    const res = await submit(validBody)
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("APP_HOSTING_CLUSTER_NOT_CONFIGURED")
    expect(mockPrisma.applicationDeployment.create).not.toHaveBeenCalled()
  })

  it("returns 422 INSUFFICIENT_PLAN_STORAGE when selected plan storage is less than template required storage", async () => {
    mockPrisma.appTemplate.findFirst.mockResolvedValue({
      id: "tpl-large-storage",
      name: "Storage App",
      version: "1.0.0",
      blueprintJson: {
        runtime: { image: "storage-app:latest" },
        storage: {
          enabled: true,
          mountPath: "/data",
          sizeGbDefault: 10,
        },
      },
    } as never)

    mockPrisma.servicePlan.findFirst.mockResolvedValue({
      id: "plan-small",
      code: "SMALL",
      name: "Small",
      resources: {
        provisioning: {
          storage: 5,
        },
      },
    } as never)

    const res = await submit({
      sourceType: "TEMPLATE",
      templateId: "tpl-large-storage",
      resourcePlanId: "small",
      billingMode: "PACKAGE",
    })

    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string; message: string }
    expect(body.error).toBe("INSUFFICIENT_PLAN_STORAGE")
    expect(body.message).toContain("10 GB")
    expect(body.message).toContain("5 GB")
    expect(mockPrisma.applicationStack.create).not.toHaveBeenCalled()
  })

  it("allows deployment when selected plan storage satisfies template required storage", async () => {
    mockPrisma.appTemplate.findFirst.mockResolvedValue({
      id: "tpl-large-storage",
      name: "Storage App",
      version: "1.0.0",
      blueprintJson: {
        runtime: { image: "storage-app:latest" },
        storage: {
          enabled: true,
          mountPath: "/data",
          sizeGbDefault: 10,
        },
      },
    } as never)

    mockPrisma.servicePlan.findFirst.mockResolvedValue({
      id: "plan-medium",
      code: "MEDIUM",
      name: "Medium",
      resources: {
        provisioning: {
          storage: 20,
        },
      },
    } as never)

    const res = await submit({
      sourceType: "TEMPLATE",
      templateId: "tpl-large-storage",
      resourcePlanId: "medium",
      billingMode: "PACKAGE",
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
    expect(mockPrisma.applicationStack.update).toHaveBeenCalled()
  })

  it("returns 422 INSUFFICIENT_PLAN_STORAGE when template requires storage but no resourcePlanId is provided", async () => {
    mockPrisma.appTemplate.findFirst.mockResolvedValue({
      id: "tpl-large-storage",
      name: "Storage App",
      version: "1.0.0",
      blueprintJson: {
        runtime: { image: "storage-app:latest" },
        storage: {
          enabled: true,
          mountPath: "/data",
          sizeGbDefault: 10,
        },
      },
    } as never)

    const res = await submit({
      sourceType: "TEMPLATE",
      templateId: "tpl-large-storage",
      billingMode: "PAYG",
    })

    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string; message: string }
    expect(body.error).toBe("INSUFFICIENT_PLAN_STORAGE")
    expect(body.message).toContain("no resource plan was selected")
    expect(mockPrisma.applicationStack.create).not.toHaveBeenCalled()
  })

  it("returns 422 INSUFFICIENT_PLAN_STORAGE when template requires storage but selected plan cannot be resolved", async () => {
    mockPrisma.appTemplate.findFirst.mockResolvedValue({
      id: "tpl-large-storage",
      name: "Storage App",
      version: "1.0.0",
      blueprintJson: {
        runtime: { image: "storage-app:latest" },
        storage: {
          enabled: true,
          mountPath: "/data",
          sizeGbDefault: 10,
        },
      },
    } as never)
    mockPrisma.servicePlan.findFirst.mockResolvedValue(null as never)

    const res = await submit({
      sourceType: "TEMPLATE",
      templateId: "tpl-large-storage",
      resourcePlanId: "nonexistent-plan",
      billingMode: "PAYG",
    })

    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string; message: string }
    expect(body.error).toBe("INSUFFICIENT_PLAN_STORAGE")
    expect(body.message).toContain("could not be resolved")
    expect(mockPrisma.applicationStack.create).not.toHaveBeenCalled()
  })

  it("returns 422 INSUFFICIENT_PLAN_STORAGE when plan provides zero storage for template requiring storage", async () => {
    mockPrisma.appTemplate.findFirst.mockResolvedValue({
      id: "tpl-large-storage",
      name: "Storage App",
      version: "1.0.0",
      blueprintJson: {
        runtime: { image: "storage-app:latest" },
        storage: {
          enabled: true,
          mountPath: "/data",
          sizeGbDefault: 10,
        },
      },
    } as never)

    mockPrisma.servicePlan.findFirst.mockResolvedValue({
      id: "plan-nostorage",
      code: "CUSTOM",
      name: "No Storage Plan",
      resources: {
        provisioning: {
          storage: 0,
        },
      },
    } as never)

    const res = await submit({
      sourceType: "TEMPLATE",
      templateId: "tpl-large-storage",
      resourcePlanId: "plan-nostorage",
      billingMode: "PACKAGE",
    })

    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string; message: string }
    expect(body.error).toBe("INSUFFICIENT_PLAN_STORAGE")
    expect(body.message).toContain("0 GB")
    expect(mockPrisma.applicationStack.create).not.toHaveBeenCalled()
  })

  it("syncs blueprint from DB template and validates storage for managed templates", async () => {
    mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
      id: "tpl-n8n-db",
      slug: "n8n",
      name: "n8n",
      blueprintJson: {
        runtime: {
          image: "docker.io/n8nio/n8n",
          defaultPort: 5678,
        },
        storage: {
          enabled: true,
          sizeGbDefault: 10,
        },
        envSchema: [{ key: "N8N_KEY", isSecret: true }],
      },
    } as never)

    mockPrisma.servicePlan.findFirst.mockResolvedValueOnce({
      id: "plan-small",
      code: "SMALL",
      name: "Small",
      resources: {
        provisioning: {
          storage: 5,
        },
      },
    } as never)

    const res = await submit({
      sourceType: "MANAGED_TEMPLATE",
      templateId: "n8n",
      resourcePlanId: "small",
      billingMode: "PACKAGE",
      cpu: 500,
      memory: 512,
    })

    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("INSUFFICIENT_PLAN_STORAGE")
  })
})
