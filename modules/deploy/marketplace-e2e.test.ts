import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import {
  OFFICIAL_APP_TEMPLATES,
  seedOfficialAppTemplates,
} from "@/modules/deploy/app-template.seed"
import { validateBlueprint } from "@/modules/deploy/blueprint/app-template-blueprint.service"
import { buildHelmValues } from "@/modules/deploy/helm-values.builder"
import type { AppTemplateBlueprint } from "@/modules/deploy/blueprint/app-template-blueprint.schema"

// ── In-Memory State & Mocks ──────────────────────────────────────────────────

interface MockAppTemplate {
  id: string
  organizationId: string | null
  slug: string
  name: string
  tagline: string
  description: string
  readmeMarkdown?: string | null
  iconUrl?: string | null
  category: string
  visibility: "PRIVATE" | "PENDING_REVIEW" | "PUBLIC" | "REJECTED" | "UNLISTED"
  version: string
  blueprintJson: AppTemplateBlueprint
  isOfficial: boolean
  isFeatured: boolean
  installCount: number
  priceMonthly?: Prisma.Decimal | null
  currency: string
  reviewedBy?: string | null
  reviewNotes?: string | null
  verifiedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

interface MockStock {
  id: string
  clusterId: string
  serviceType: "MYSQL" | "POSTGRESQL" | "REDIS"
  label: string | null
  endpointHost: string
  endpointPort: number
  databaseName: string
  username: string
  tlsEnabled: boolean
  vaultPath: string
  vaultVersion: number
  status: "AVAILABLE" | "ALLOCATED" | "DIRTY" | "DRAINING"
  allocatedStackId: string | null
  allocatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

let mockTemplates: MockAppTemplate[] = []
let mockStocks: MockStock[] = []
let mockStacks: Array<{ id: string; orgId: string; envVarsJson: unknown }> = []
let mockVaultKvStore: Record<string, Record<string, string>> = {}

let currentAuth: {
  user: { id: string; email: string } | null
  organizationId: string | null
  role?: string | null
  roles?: string[] | null
} = {
  user: { id: "user_tenant_1", email: "tenant@example.com" },
  organizationId: "org_tenant_1",
  role: "admin",
  roles: ["admin"],
}

let currentPlatformRole: string | null = null

const mockWithAuth = mock(async () => currentAuth)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mock(async () => currentPlatformRole),
}))

const mockVaultWriteKV = mock(
  async (path: string, data: Record<string, string>) => {
    mockVaultKvStore[path] = { ...(mockVaultKvStore[path] || {}), ...data }
    return { version: 1 }
  }
)

const mockVaultReadKV = mock(async (path: string) => {
  const data = mockVaultKvStore[path]
  if (!data) throw new Error(`Vault secret not found at ${path}`)
  return data
})

const mockVaultDeleteKV = mock(async (path: string) => {
  delete mockVaultKvStore[path]
})

mock.module("@/lib/vault/vault-client", () => ({
  VaultClient: class {
    writeKV = mockVaultWriteKV
    readKV = mockVaultReadKV
    deleteKV = mockVaultDeleteKV
  },
}))

const mockWriteSecrets = mock(
  async ({
    organizationId,
    stackId,
    environment,
    secrets,
  }: {
    organizationId: string
    stackId: string
    environment: string
    secrets: Record<string, string>
  }) => {
    const vaultPath = `tenants/${organizationId}/stacks/${stackId}/${environment}/app-env`
    mockVaultKvStore[vaultPath] = {
      ...(mockVaultKvStore[vaultPath] || {}),
      ...secrets,
    }
    return {
      environment,
      vaultPath,
      version: 1,
      updatedAt: new Date().toISOString(),
      references: [],
    }
  }
)

mock.module("@/modules/secrets/vault-secrets.service", () => ({
  VaultSecretsService: class {
    writeSecrets = mockWriteSecrets
  },
}))

const mockPrisma = {
  appTemplate: {
    upsert: mock(
      async ({
        where,
        create,
        update,
      }: {
        where: { slug?: string; id?: string }
        create: Omit<MockAppTemplate, "id" | "createdAt" | "updatedAt">
        update: Partial<MockAppTemplate>
      }) => {
        const index = mockTemplates.findIndex((t) =>
          where.slug ? t.slug === where.slug : t.id === where.id
        )
        if (index >= 0) {
          mockTemplates[index] = {
            ...mockTemplates[index],
            ...update,
            updatedAt: new Date(),
          } as MockAppTemplate
          return mockTemplates[index]
        }
        const created: MockAppTemplate = {
          id: `tpl_${mockTemplates.length + 1}`,
          organizationId: create.organizationId ?? null,
          slug: create.slug,
          name: create.name,
          tagline: create.tagline,
          description: create.description,
          readmeMarkdown: create.readmeMarkdown ?? null,
          iconUrl: create.iconUrl ?? null,
          category: create.category,
          visibility: create.visibility,
          version: create.version,
          blueprintJson: create.blueprintJson as AppTemplateBlueprint,
          isOfficial: create.isOfficial ?? false,
          isFeatured: create.isFeatured ?? false,
          installCount: create.installCount ?? 0,
          priceMonthly: create.priceMonthly ?? null,
          currency: create.currency ?? "USD",
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        mockTemplates.push(created)
        return created
      }
    ),
    findMany: mock(
      async ({
        where,
      }: {
        where?: {
          OR?: Array<{ visibility?: string; isOfficial?: boolean }>
          organizationId?: string
          visibility?: string
          category?: string
          isFeatured?: boolean
          AND?: Array<{
            OR?: Array<{
              name?: { contains: string; mode?: string }
              tagline?: { contains: string; mode?: string }
              description?: { contains: string; mode?: string }
              slug?: { contains: string; mode?: string }
            }>
          }>
        }
      }) => {
        let filtered = [...mockTemplates]

        if (where?.OR && Array.isArray(where.OR)) {
          filtered = filtered.filter((t) =>
            where.OR?.some((cond) => {
              if (cond.visibility && t.visibility === cond.visibility)
                return true
              if (
                cond.isOfficial !== undefined &&
                t.isOfficial === cond.isOfficial
              )
                return true
              return false
            })
          )
        }

        if (where?.visibility) {
          filtered = filtered.filter((t) => t.visibility === where.visibility)
        }

        if (where?.organizationId) {
          filtered = filtered.filter(
            (t) => t.organizationId === where.organizationId
          )
        }

        if (where?.category) {
          filtered = filtered.filter((t) => t.category === where.category)
        }

        return filtered
      }
    ),
    findUnique: mock(
      async ({ where }: { where: { slug?: string; id?: string } }) => {
        return (
          mockTemplates.find((t) =>
            where.slug ? t.slug === where.slug : t.id === where.id
          ) || null
        )
      }
    ),
    create: mock(
      async ({
        data,
      }: {
        data: Omit<MockAppTemplate, "id" | "createdAt" | "updatedAt">
      }) => {
        const created: MockAppTemplate = {
          id: `tpl_${mockTemplates.length + 1}`,
          ...data,
          readmeMarkdown: data.readmeMarkdown ?? null,
          iconUrl: data.iconUrl ?? null,
          isOfficial: data.isOfficial ?? false,
          isFeatured: data.isFeatured ?? false,
          installCount: data.installCount ?? 0,
          priceMonthly: data.priceMonthly ?? null,
          currency: data.currency ?? "USD",
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        mockTemplates.push(created)
        return created
      }
    ),
    update: mock(
      async ({
        where,
        data,
      }: {
        where: { id: string }
        data: Partial<MockAppTemplate>
      }) => {
        const index = mockTemplates.findIndex((t) => t.id === where.id)
        if (index < 0) throw new Error("Template not found")
        mockTemplates[index] = {
          ...mockTemplates[index],
          ...data,
          updatedAt: new Date(),
        }
        return mockTemplates[index]
      }
    ),
  },
  appManagedStock: {
    findMany: mock(async () => [...mockStocks]),
    findUnique: mock(
      async ({
        where,
      }: {
        where: { id?: string; allocatedStackId?: string }
      }) => {
        return (
          mockStocks.find((s) =>
            where.id
              ? s.id === where.id
              : s.allocatedStackId === where.allocatedStackId
          ) || null
        )
      }
    ),
    update: mock(
      async ({
        where,
        data,
      }: {
        where: { id: string }
        data: Partial<MockStock>
      }) => {
        const index = mockStocks.findIndex((s) => s.id === where.id)
        if (index < 0) throw new Error("Stock not found")
        mockStocks[index] = {
          ...mockStocks[index],
          ...data,
          updatedAt: new Date(),
        }
        return mockStocks[index]
      }
    ),
  },
  applicationStack: {
    findUnique: mock(async ({ where }: { where: { id: string } }) => {
      const stack = mockStacks.find((s) => s.id === where.id)
      return stack || null
    }),
  },
  billingAccount: {
    findUnique: mock(async () => ({
      id: "ba_1",
      organizationId: "org_tenant_1",
      balance: new Prisma.Decimal("500.00"),
      currency: "USD",
      status: "ACTIVE",
    })),
  },
  $transaction: mock(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      $queryRaw: mock(async (query: { values?: unknown[] }) => {
        const serviceType =
          Array.isArray(query?.values) && query.values.length > 0
            ? query.values[0]
            : "POSTGRESQL"
        const available = mockStocks.find(
          (s) =>
            (serviceType ? s.serviceType === serviceType : true) &&
            s.status === "AVAILABLE"
        )
        return available ? [available] : []
      }),
      appManagedStock: {
        update: mock(
          async ({
            where,
            data,
          }: {
            where: { id: string }
            data: Partial<MockStock>
          }) => {
            const index = mockStocks.findIndex((s) => s.id === where.id)
            if (index < 0) throw new Error("Stock not found in tx")
            mockStocks[index] = {
              ...mockStocks[index],
              ...data,
              updatedAt: new Date(),
            }
            return mockStocks[index]
          }
        ),
      },
    })
  ),
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

// ── Dynamic Imports ──────────────────────────────────────────────────────────

const { appTemplateRoutes } =
  await import("@/modules/deploy/api/routes/templates.route")
const { adminTemplateRoutes } =
  await import("@/modules/deploy/api/routes/admin-templates.route")
const { claimManagedStock, releaseManagedStock } =
  await import("@/modules/deploy/app-managed-stock.service")
const { assertDeployExecutionGates } =
  await import("@/modules/deploy/deploy-execution-gates")

// ── E2E Lifecycle Test Suite ─────────────────────────────────────────────────

describe("Marketplace & Auto-Provisioning End-to-End Lifecycle", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    mockTemplates = []
    mockStocks = []
    mockStacks = []
    mockVaultKvStore = {}

    currentAuth = {
      user: { id: "user_tenant_1", email: "tenant@example.com" },
      organizationId: "org_tenant_1",
      role: "admin",
      roles: ["admin"],
    }
    currentPlatformRole = null
  })

  it("completes full 8-step lifecycle from seed to teardown", async () => {
    // ══════════════════════════════════════════════════════════════════════════
    // Step 1: Database template seed verification (5 official templates)
    // ══════════════════════════════════════════════════════════════════════════
    expect(OFFICIAL_APP_TEMPLATES.length).toBe(5)
    const seedResult = await seedOfficialAppTemplates({
      prisma: mockPrisma as never,
    })

    expect(seedResult.count).toBe(5)
    expect(seedResult.slugs).toEqual([
      "n8n",
      "hermes",
      "9router",
      "umami",
      "wordpress",
    ])
    expect(mockTemplates.length).toBe(5)

    for (const tpl of mockTemplates) {
      expect(tpl.isOfficial).toBe(true)
      expect(tpl.visibility).toBe("PUBLIC")
      const validated = validateBlueprint(tpl.blueprintJson)
      expect(validated.valid).toBe(true)
      expect(validated.data).toBeDefined()
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Step 2: Tenant browses /api/templates and inspects blueprint
    // ══════════════════════════════════════════════════════════════════════════
    const listResponse = await appTemplateRoutes.handle(
      new Request("http://localhost/templates")
    )
    expect(listResponse.status).toBe(200)
    const publicTemplates = (await listResponse.json()) as MockAppTemplate[]
    expect(publicTemplates.length).toBe(5)

    const n8nDetailResponse = await appTemplateRoutes.handle(
      new Request("http://localhost/templates/n8n")
    )
    expect(n8nDetailResponse.status).toBe(200)
    const n8nTemplate = (await n8nDetailResponse.json()) as MockAppTemplate
    expect(n8nTemplate.slug).toBe("n8n")
    expect(n8nTemplate.blueprintJson.runtime.image).toBe(
      "docker.io/n8nio/n8n:latest"
    )
    expect(n8nTemplate.blueprintJson.dependencies).toEqual([
      { serviceType: "POSTGRESQL", alias: "db", envPrefix: "DB" },
    ])

    // ══════════════════════════════════════════════════════════════════════════
    // Step 3: Tenant executes 1-Click Launch with PAYG buffer check & atomic database stock claim
    // ══════════════════════════════════════════════════════════════════════════
    const mockBillingService = {
      assertCanStartPayg: mock(async () => ({
        hourlyCost: new Prisma.Decimal("0.05"),
        upfrontCost: new Prisma.Decimal("1.20"),
        currency: "USD",
        requiredBalance: new Prisma.Decimal("1.20"),
        bufferHours: 24,
      })),
      assertCanDeploySubscription: mock(async () => {}),
    }

    await assertDeployExecutionGates(
      {
        organizationId: "org_tenant_1",
        stackId: "stack_n8n_prod",
        billingMode: "PAYG",
        resourcePlanId: "standard-1",
        hourlyCost: 0.05,
        paygBufferHours: 24,
      },
      {
        billing: mockBillingService as never,
        resolveCluster: async () => ({
          cluster: { id: "cluster_primary" } as never,
          integration: {} as never,
        }),
      }
    )
    expect(mockBillingService.assertCanStartPayg).toHaveBeenCalledTimes(1)

    // Seed available PostgreSQL stock in cluster pool
    const stockId = "stock_pg_01"
    const adminStockVaultPath = `admin/managed-stock/${stockId}`
    mockVaultKvStore[adminStockVaultPath] = {
      password: "SuperSecretDbPassword123!",
      connectionUrl:
        "postgresql://n8n_user:SuperSecretDbPassword123!@pg-cluster.internal:5432/n8n_prod",
    }
    mockStocks.push({
      id: stockId,
      clusterId: "cluster_primary",
      serviceType: "POSTGRESQL",
      label: "Shared PG Pool #1",
      endpointHost: "pg-cluster.internal",
      endpointPort: 5432,
      databaseName: "n8n_prod",
      username: "n8n_user",
      tlsEnabled: false,
      vaultPath: adminStockVaultPath,
      vaultVersion: 1,
      status: "AVAILABLE",
      allocatedStackId: null,
      allocatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const claimed = await claimManagedStock({
      serviceType: "POSTGRESQL",
      stackId: "stack_n8n_prod",
      orgId: "org_tenant_1",
      environment: "prod",
    })

    expect(claimed.id).toBe(stockId)
    expect(claimed.status).toBe("ALLOCATED")
    expect(claimed.allocatedStackId).toBe("stack_n8n_prod")

    // ══════════════════════════════════════════════════════════════════════════
    // Step 4: Vault credentials copy from admin/managed-stock/* to canonical tenant path
    // ══════════════════════════════════════════════════════════════════════════
    const canonicalTenantVaultPath =
      "tenants/org_tenant_1/stacks/stack_n8n_prod/prod/app-env"

    expect(mockVaultKvStore[canonicalTenantVaultPath]).toBeDefined()
    expect(mockVaultKvStore[canonicalTenantVaultPath]).toEqual({
      DB_TYPE: "postgresdb",
      DB_POSTGRESDB_HOST: "pg-cluster.internal",
      DB_POSTGRESDB_PORT: "5432",
      DB_POSTGRESDB_DATABASE: "n8n_prod",
      DB_POSTGRESDB_USER: "n8n_user",
      DB_POSTGRESDB_PASSWORD: "SuperSecretDbPassword123!",
    })

    // Register stack in mock db with secret_ref env variable
    mockStacks.push({
      id: "stack_n8n_prod",
      orgId: "org_tenant_1",
      envVarsJson: [
        {
          key: "DB_POSTGRESDB_PASSWORD",
          type: "secret_ref",
          vaultPath: canonicalTenantVaultPath,
        },
      ],
    })

    // ══════════════════════════════════════════════════════════════════════════
    // Step 5: K8s Helm values and ExternalSecret manifest generation
    // ══════════════════════════════════════════════════════════════════════════
    const helmValues = buildHelmValues({
      slug: "n8n-app",
      imageRepository: "docker.io/n8nio/n8n",
      imageTag: "latest",
      replicas: 1,
      cpu: 500,
      memory: 512,
      domain: "n8n.tenant.apps.internal",
      externalSecretVaultPath: canonicalTenantVaultPath,
      env: [
        {
          key: "N8N_ENCRYPTION_KEY",
          value: "secret-enc-key-abc",
          type: "plain",
        },
        {
          key: "DB_POSTGRESDB_PASSWORD",
          value: "",
          type: "secret_ref",
        },
      ],
      edge: {
        domain: "n8n.tenant.apps.internal",
        certificateSource: "MANAGED",
      },
    })

    expect(helmValues.app).toEqual({ name: "n8n-app" })
    expect(helmValues.image).toEqual({
      repository: "docker.io/n8nio/n8n",
      tag: "latest",
    })
    expect(helmValues.externalSecret).toEqual({
      enabled: true,
      vaultPath: canonicalTenantVaultPath,
      targetSecretName: "app-n8n-app-k8s-secrets",
    })
    expect(helmValues.simpleIngress).toBeDefined()

    // ══════════════════════════════════════════════════════════════════════════
    // Step 6: Tenant authors custom template (POST /api/templates) & submits review
    // ══════════════════════════════════════════════════════════════════════════
    const customBlueprint: AppTemplateBlueprint = {
      version: "1.0.0",
      runtime: {
        image: "registry.company.com/custom-crm:v1.2",
        defaultPort: 8080,
        healthCheckPath: "/health",
        runAsNonRoot: true,
      },
      resources: {
        defaultCpu: 300,
        defaultMemory: 256,
        minCpu: 100,
        minMemory: 128,
      },
      dependencies: [
        {
          serviceType: "MYSQL",
          alias: "crm_db",
          envPrefix: "CRM_DB",
        },
      ],
      envSchema: [
        {
          key: "APP_KEY",
          label: "Application Key",
          required: true,
          isSecret: true,
          dataType: "string",
          generateRandomHex: 32,
        },
      ],
    }

    const createTemplateResponse = await appTemplateRoutes.handle(
      new Request("http://localhost/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Enterprise CRM",
          tagline: "High-performance enterprise CRM tailored for B2B workflows",
          description:
            "Custom enterprise CRM with automated lead routing and MySQL backend.",
          category: "DEVELOPER_TOOLS",
          blueprintJson: customBlueprint,
        }),
      })
    )

    expect(createTemplateResponse.status).toBe(201)
    const createdTemplate =
      (await createTemplateResponse.json()) as MockAppTemplate
    expect(createdTemplate.name).toBe("Enterprise CRM")
    expect(createdTemplate.visibility).toBe("PRIVATE")
    expect(createdTemplate.organizationId).toBe("org_tenant_1")

    // Tenant submits template for Super Admin review
    const submitReviewResponse = await appTemplateRoutes.handle(
      new Request(
        `http://localhost/templates/${createdTemplate.id}/submit-review`,
        {
          method: "POST",
        }
      )
    )

    expect(submitReviewResponse.status).toBe(200)
    const pendingTemplate =
      (await submitReviewResponse.json()) as MockAppTemplate
    expect(pendingTemplate.visibility).toBe("PENDING_REVIEW")

    // ══════════════════════════════════════════════════════════════════════════
    // Step 7: Super Admin inspects blueprint and approves template to PUBLIC status
    // ══════════════════════════════════════════════════════════════════════════
    currentAuth = {
      user: { id: "user_super_admin", email: "admin@platform.green" },
      organizationId: "org_platform",
      role: "super_admin",
      roles: ["super_admin"],
    }
    currentPlatformRole = "super_admin"

    // Super Admin lists pending templates via admin endpoint
    const adminListResponse = await adminTemplateRoutes.handle(
      new Request("http://localhost/admin/templates?visibility=PENDING_REVIEW")
    )
    expect(adminListResponse.status).toBe(200)
    const pendingList = (await adminListResponse.json()) as MockAppTemplate[]
    const foundPending = pendingList.find((t) => t.id === createdTemplate.id)
    expect(foundPending).toBeDefined()
    expect(foundPending?.blueprintJson.runtime.image).toBe(
      "registry.company.com/custom-crm:v1.2"
    )

    // Super Admin approves the template
    const approveResponse = await adminTemplateRoutes.handle(
      new Request(
        `http://localhost/admin/templates/${createdTemplate.id}/approve`,
        {
          method: "POST",
        }
      )
    )
    expect(approveResponse.status).toBe(200)
    const approvedTemplate = (await approveResponse.json()) as MockAppTemplate
    expect(approvedTemplate.visibility).toBe("PUBLIC")
    expect(approvedTemplate.reviewedBy).toBe("user_super_admin")
    expect(approvedTemplate.verifiedAt).toBeDefined()

    // Public templates now includes the newly approved template
    const updatedPublicTemplatesResponse = await appTemplateRoutes.handle(
      new Request("http://localhost/templates")
    )
    const updatedPublic =
      (await updatedPublicTemplatesResponse.json()) as MockAppTemplate[]
    expect(updatedPublic.length).toBe(6)
    expect(updatedPublic.some((t) => t.id === createdTemplate.id)).toBe(true)

    // ══════════════════════════════════════════════════════════════════════════
    // Step 8: Stack teardown releases stock to DIRTY and cleans tenant Vault secrets
    // ══════════════════════════════════════════════════════════════════════════
    expect(mockVaultKvStore[canonicalTenantVaultPath]).toBeDefined()
    expect(mockStocks[0].status).toBe("ALLOCATED")

    await releaseManagedStock("stack_n8n_prod")

    const releasedStock = mockStocks.find((s) => s.id === stockId)
    expect(releasedStock?.status).toBe("DIRTY")
    expect(releasedStock?.allocatedStackId).toBeNull()
    expect(releasedStock?.allocatedAt).toBeNull()

    // Tenant Vault secrets wiped on teardown
    expect(mockVaultKvStore[canonicalTenantVaultPath]).toBeUndefined()
  })
})
