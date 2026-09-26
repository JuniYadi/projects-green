import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockPrisma = {
  appTemplate: {
    findFirst: mock(),
    findUnique: mock(),
  },
  applicationStack: {
    findMany: mock(),
    findUnique: mock(),
    update: mock(),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))
const mockGetCachedOrganizations = mock(async (orgIds: string[]) => {
  const map = new Map<string, { id: string; name: string }>()
  for (const id of orgIds) {
    map.set(id, { id, name: `Acme Org for ${id}` })
  }
  return map
})

mock.module("@/lib/workos-directory", () => ({
  getCachedOrganizations: mockGetCachedOrganizations,
}))

const mockSyncStackConfiguration = mock(async () => ({
  ok: true,
  commitSha: "sha-123456",
  message: "Configuration synced successfully",
}))

mock.module("./sync-stack.service", () => ({
  syncStackConfiguration: mockSyncStackConfiguration,
}))

const mockWriteSecrets = mock(async () => ({
  environment: "prod",
  vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
  version: 1,
  updatedAt: "2026-08-28T00:00:00.000Z",
  references: [],
}))

mock.module("@/modules/secrets/vault-secrets.service", () => ({
  VaultSecretsService: class {
    writeSecrets = mockWriteSecrets
  },
  buildVaultSecretPath: mock(
    (input: { organizationId: string; stackId: string; environment: string }) =>
      `tenants/${input.organizationId}/stacks/${input.stackId}/${input.environment}/app-env`
  ),
}))
const {
  listTemplateInstallations,
  syncStackFromParentTemplate,
  syncMultipleStacksFromParentTemplate,
} = await import("./template-sync.service")

describe("template-sync.service", () => {
  beforeEach(() => {
    mockPrisma.appTemplate.findFirst.mockReset()
    mockPrisma.applicationStack.findMany.mockReset()
    mockPrisma.applicationStack.findUnique.mockReset()
    mockPrisma.applicationStack.update.mockReset()
    mockSyncStackConfiguration.mockClear()
    mockWriteSecrets.mockClear()
  })

  describe("listTemplateInstallations", () => {
    it("throws if template does not exist", async () => {
      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce(null)
      expect(listTemplateInstallations("non-existent")).rejects.toThrow(
        "Template not found: non-existent"
      )
    })

    it("identifies stacks with missing or mismatched imageRepository as outdated", async () => {
      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-9router",
        slug: "9router",
        name: "9router Gateway",
        blueprintJson: {
          version: "1.0.0",
          runtime: {
            image: "ghcr.io/pfnapp/9router:0.5.86",
            defaultPort: 20128,
            deploymentType: "statefulset",
            readOnlyRootFilesystem: false,
          },
        },
      })

      mockPrisma.applicationStack.findMany.mockResolvedValueOnce([
        {
          id: "stack-missing-image",
          name: "9router-missing-img",
          slug: "9router-missing-img",
          organizationId: "org-1",
          status: "READY",
          metadataJson: {
            deploymentType: "statefulset",
            readOnlyRootFilesystem: false,
          },
          lastDeployedAt: null,
          lastDeployStatus: null,
          createdAt: new Date("2026-09-01"),
          updatedAt: new Date("2026-09-01"),
          deployments: [],
        },
        {
          id: "stack-mismatched-readonly",
          name: "9router-readonly-diff",
          slug: "9router-readonly-diff",
          organizationId: "org-1",
          status: "READY",
          metadataJson: {
            deploymentType: "statefulset",
            imageRepository: "ghcr.io/pfnapp/9router:0.5.86",
            readOnlyRootFilesystem: true,
          },
          lastDeployedAt: null,
          lastDeployStatus: null,
          createdAt: new Date("2026-09-01"),
          updatedAt: new Date("2026-09-01"),
          deployments: [],
        },
        {
          id: "stack-fully-aligned",
          name: "9router-perfect",
          slug: "9router-perfect",
          organizationId: "org-1",
          status: "READY",
          metadataJson: {
            deploymentType: "statefulset",
            imageRepository: "ghcr.io/pfnapp/9router:0.5.86",
            readOnlyRootFilesystem: false,
          },
          lastDeployedAt: null,
          lastDeployStatus: null,
          createdAt: new Date("2026-09-01"),
          updatedAt: new Date("2026-09-01"),
          deployments: [],
        },
      ])

      const result = await listTemplateInstallations("tmpl-9router")
      expect(result.totalInstallations).toBe(3)
      expect(result.alignedInstallations).toBe(1)
      expect(result.outdatedInstallations).toBe(2)
      expect(result.installations[0].isAligned).toBe(false)
      expect(result.installations[1].isAligned).toBe(false)
      expect(result.installations[2].isAligned).toBe(true)
    })

    it("lists installations and identifies aligned vs outdated controller workloads", async () => {
      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        slug: "9router",
        name: "9router Gateway",
        blueprintJson: {
          version: "1.0.0",
          runtime: {
            image: "registry.pfnapp.com/ninerouter:latest",
            defaultPort: 8080,
            deploymentType: "statefulset",
          },
        },
      })

      mockPrisma.applicationStack.findMany.mockResolvedValueOnce([
        {
          id: "stack-1",
          name: "9router-daring-pulsar",
          slug: "9router-daring-pulsar",
          organizationId: "org-1",
          status: "DEPLOYING",
          metadataJson: {
            deploymentType: "deployment",
          },
          lastDeployedAt: new Date("2026-09-01"),
          lastDeployStatus: "READY",
          createdAt: new Date("2026-09-01"),
          updatedAt: new Date("2026-09-01"),
          deployments: [
            {
              id: "dep-1",
              status: "READY",
              attempt: 1,
              commitSha: "abc1234",
              failureReason: null,
              startedAt: new Date("2026-09-01"),
            },
          ],
        },
        {
          id: "stack-2",
          name: "9router-aligned-app",
          slug: "9router-aligned-app",
          organizationId: "org-2",
          status: "READY",
          metadataJson: {
            deploymentType: "statefulset",
            imageRepository: "registry.pfnapp.com/ninerouter:latest",
          },
          lastDeployedAt: new Date("2026-09-02"),
          lastDeployStatus: "READY",
          createdAt: new Date("2026-09-02"),
          updatedAt: new Date("2026-09-02"),
          deployments: [],
        },
      ])

      const result = await listTemplateInstallations("tmpl-9router")

      expect(result.totalInstallations).toBe(2)
      expect(result.alignedInstallations).toBe(1)
      expect(result.outdatedInstallations).toBe(1)
      expect(result.installations[0].isAligned).toBe(false)
      expect(result.installations[0].currentDeploymentType).toBe("deployment")
      expect(result.installations[0].targetDeploymentType).toBe("statefulset")
      expect(result.installations[1].isAligned).toBe(true)
      expect(result.installations[1].currentDeploymentType).toBe("statefulset")
    })
  })

  describe("syncStackFromParentTemplate", () => {
    it("updates architecture to template blueprint while preserving user envs and scaling", async () => {
      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-9router",
        slug: "9router",
        blueprintJson: {
          version: "1.0.0",
          runtime: {
            image: "registry.pfnapp.com/ninerouter:latest",
            command: ["hermes", "gateway", "run"],
            defaultPort: 8080,
            deploymentType: "statefulset",
            additionalPorts: [{ port: 9119, name: "dashboard" }],
            healthCheckPath: "/healthz",
          },
          envSchema: [
            {
              key: "ROUTER_MASTER_KEY",
              defaultValue: "default-master-key",
              isSecret: true,
            },
            {
              key: "NEW_OPTIONAL_FLAG",
              defaultValue: "enabled",
              isSecret: false,
            },
          ],
        },
      })

      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        slug: "9router-daring-pulsar",
        organizationId: "org-1",
        cpu: 1000,
        memory: 2048,
        customDomain: "router.company.com",
        subdomain: "custom-sub",
        metadataJson: {
          deploymentType: "deployment",
          customBuildOpt: true,
        },
        envVarsJson: [
          { key: "ROUTER_MASTER_KEY", value: "user-custom-secret-key" },
        ],
      })

      mockPrisma.applicationStack.update.mockResolvedValueOnce({
        id: "stack-1",
      })

      const result = await syncStackFromParentTemplate({
        templateId: "tmpl-9router",
        stackId: "stack-1",
      })

      expect(result.ok).toBe(true)
      expect(result.slug).toBe("9router-daring-pulsar")

      // Verify update payload
      const updateCall = mockPrisma.applicationStack.update.mock.calls[0][0]
      expect(updateCall.where.id).toBe("stack-1")
      expect(updateCall.data.templateId).toBe("tmpl-9router")

      // Architecture updated
      expect(updateCall.data.metadataJson.deploymentType).toBe("statefulset")
      expect(updateCall.data.metadataJson.additionalPorts).toEqual([
        { port: 9119, name: "dashboard" },
      ])
      expect(updateCall.data.metadataJson.healthCheckPath).toBe("/healthz")
      expect(updateCall.data.metadataJson.command).toEqual([
        "hermes",
        "gateway",
        "run",
      ])
      expect(updateCall.data.metadataJson.customBuildOpt).toBe(true)
      expect(updateCall.data.metadataJson.templateVersion).toBe("1.0.0")

      // Template defaults persisted in envVarsJson as secret_ref
      expect(updateCall.data.envVarsJson).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "NEW_OPTIONAL_FLAG",
            type: "secret_ref",
            vaultKey: "NEW_OPTIONAL_FLAG",
          }),
        ])
      )

      // New template default sent to Vault
      expect(mockWriteSecrets).toHaveBeenCalledWith({
        organizationId: "org-1",
        stackId: "stack-1",
        environment: "prod",
        secrets: {
          NEW_OPTIONAL_FLAG: "enabled",
          ROUTER_MASTER_KEY: "user-custom-secret-key",
        },
      })
      // syncStackConfiguration triggered
      expect(mockSyncStackConfiguration).toHaveBeenCalledWith({
        slug: "9router-daring-pulsar",
        organizationId: "org-1",
      })
    })

    it("clears health check and probe metadata when template runtime has no health check or probes", async () => {
      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-9router",
        slug: "9router",
        blueprintJson: {
          version: "1.0.0",
          runtime: {
            image: "registry.pfnapp.com/ninerouter:latest",
            defaultPort: 8080,
            deploymentType: "deployment",
          },
        },
      })

      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        slug: "9router-daring-pulsar",
        organizationId: "org-1",
        metadataJson: {
          deploymentType: "deployment",
          healthCheckPath: "/old-healthz",
          livenessProbe: { path: "/old-healthz" },
          readinessProbe: { path: "/old-ready" },
          startupProbe: { path: "/old-startup" },
        },
        envVarsJson: [],
      })

      mockPrisma.applicationStack.update.mockResolvedValueOnce({
        id: "stack-1",
      })

      const result = await syncStackFromParentTemplate({
        templateId: "tmpl-9router",
        stackId: "stack-1",
      })

      expect(result.ok).toBe(true)
      const updateCall = mockPrisma.applicationStack.update.mock.calls[0][0]
      expect(updateCall.data.metadataJson.healthCheckPath).toBeNull()
      expect(updateCall.data.metadataJson.livenessProbe).toBeUndefined()
      expect(updateCall.data.metadataJson.readinessProbe).toBeUndefined()
      expect(updateCall.data.metadataJson.startupProbe).toBeUndefined()
    })

    it("updates imageRepository and securityContext when template runtime updates them", async () => {
      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-9router",
        slug: "9router",
        blueprintJson: {
          version: "1.1.0",
          runtime: {
            image: "ghcr.io/pfnapp/9router:0.5.86",
            defaultPort: 20128,
            deploymentType: "statefulset",
            runAsNonRoot: false,
            runAsUser: null,
            runAsGroup: null,
            readOnlyRootFilesystem: true,
          },
        },
      })

      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        slug: "app-9router-zenith-falcon-zo77",
        organizationId: "org-1",
        metadataJson: {
          imageRepository: "docker.io/decolua/9router:0.5.75",
          runAsNonRoot: true,
          runAsUser: 10001,
          runAsGroup: 10001,
          readOnlyRootFilesystem: false,
          deploymentType: "statefulset",
        },
        envVarsJson: [],
      })

      mockPrisma.applicationStack.update.mockResolvedValueOnce({
        id: "stack-1",
      })

      const result = await syncStackFromParentTemplate({
        templateId: "tmpl-9router",
        stackId: "stack-1",
      })

      expect(result.ok).toBe(true)
      const updateCall = mockPrisma.applicationStack.update.mock.calls[0][0]
      expect(updateCall.data.metadataJson.imageRepository).toBe(
        "ghcr.io/pfnapp/9router:0.5.86"
      )
      expect(updateCall.data.metadataJson.runAsNonRoot).toBe(false)
      expect(updateCall.data.metadataJson.runAsUser).toBeUndefined()
      expect(updateCall.data.metadataJson.runAsGroup).toBeUndefined()
      expect(updateCall.data.metadataJson.readOnlyRootFilesystem).toBe(true)
    })

    it("resets numeric runAsUser and runAsGroup when template blueprint specifies them", async () => {
      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-custom",
        slug: "custom",
        blueprintJson: {
          version: "1.0.0",
          runtime: {
            image: "custom/app:1.0",
            runAsNonRoot: true,
            runAsUser: 2000,
            runAsGroup: 2000,
            readOnlyRootFilesystem: null,
          },
        },
      })

      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-2",
        slug: "custom-app",
        organizationId: "org-1",
        metadataJson: {
          imageRepository: "custom/app:0.9",
          readOnlyRootFilesystem: true,
        },
        envVarsJson: [],
      })

      mockPrisma.applicationStack.update.mockResolvedValueOnce({
        id: "stack-2",
      })

      const result = await syncStackFromParentTemplate({
        templateId: "tmpl-custom",
        stackId: "stack-2",
      })

      expect(result.ok).toBe(true)
      const updateCall = mockPrisma.applicationStack.update.mock.calls[0][0]
      expect(updateCall.data.metadataJson.runAsUser).toBe(2000)
      expect(updateCall.data.metadataJson.runAsGroup).toBe(2000)
      expect(
        updateCall.data.metadataJson.readOnlyRootFilesystem
      ).toBeUndefined()
    })

    it("writes newly introduced template secret env vars to Vault via VaultSecretsService", async () => {
      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-hermes",
        slug: "hermes",
        blueprintJson: {
          version: "1.0.0",
          envSchema: [
            {
              key: "HERMES_DASHBOARD",
              defaultValue: "true",
              isSecret: true,
            },
            {
              key: "PORT",
              defaultValue: "8080",
              isSecret: true,
            },
            {
              key: "APP_ENV",
              defaultValue: "production",
              isSecret: false,
            },
          ],
        },
      })

      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        slug: "hermes-agent",
        organizationId: "org-1",
        envVarsJson: [],
      })

      mockPrisma.applicationStack.update.mockResolvedValueOnce({
        id: "stack-1",
      })

      const result = await syncStackFromParentTemplate({
        templateId: "tmpl-hermes",
        stackId: "stack-1",
      })

      expect(result.ok).toBe(true)
      expect(mockWriteSecrets).toHaveBeenCalledWith({
        organizationId: "org-1",
        stackId: "stack-1",
        environment: "prod",
        secrets: {
          HERMES_DASHBOARD: "true",
          PORT: "8080",
          APP_ENV: "production",
        },
      })
    })

    it("fails cleanly without modifying stack in database when Vault write fails", async () => {
      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-hermes",
        slug: "hermes",
        blueprintJson: {
          version: "1.0.0",
          envSchema: [
            {
              key: "HERMES_DASHBOARD",
              defaultValue: "true",
              isSecret: true,
            },
          ],
        },
      })

      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        slug: "hermes-agent",
        organizationId: "org-1",
        envVarsJson: [{ key: "USER_VAR", value: "user-val" }],
      })

      mockWriteSecrets.mockRejectedValueOnce(new Error("Vault unreachable"))

      await expect(
        syncStackFromParentTemplate({
          templateId: "tmpl-hermes",
          stackId: "stack-1",
        })
      ).rejects.toThrow("Vault unreachable")

      expect(mockPrisma.applicationStack.update).not.toHaveBeenCalled()
    })

    it("throws when template is not found", async () => {
      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce(null)
      expect(
        syncStackFromParentTemplate({
          templateId: "missing-template",
          stackId: "stack-1",
        })
      ).rejects.toThrow("Template not found: missing-template")
    })

    it("throws when stack is not found", async () => {
      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-1",
        slug: "tmpl-1",
      })
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce(null)
      expect(
        syncStackFromParentTemplate({
          templateId: "tmpl-1",
          stackId: "missing-stack",
        })
      ).rejects.toThrow("Application stack not found: missing-stack")
    })
  })

  describe("syncMultipleStacksFromParentTemplate", () => {
    it("processes each stack and returns a summary of successes and failures", async () => {
      mockPrisma.appTemplate.findFirst.mockResolvedValue({
        id: "tmpl-9router",
        slug: "9router",
        blueprintJson: {
          version: "1.0.0",
          runtime: {
            image: "registry.pfnapp.com/ninerouter:latest",
            defaultPort: 8080,
            deploymentType: "statefulset",
          },
        },
      })

      mockPrisma.applicationStack.findUnique
        .mockResolvedValueOnce({
          id: "stack-1",
          slug: "app-1",
          organizationId: "org-1",
          metadataJson: { deploymentType: "deployment" },
          envVarsJson: [],
        })
        .mockResolvedValueOnce(null) // Second stack fails (not found)

      mockPrisma.applicationStack.update.mockResolvedValueOnce({
        id: "stack-1",
      })

      const summary = await syncMultipleStacksFromParentTemplate({
        templateId: "tmpl-9router",
        stackIds: ["stack-1", "stack-nonexistent"],
      })

      expect(summary.total).toBe(2)
      expect(summary.succeeded).toBe(1)
      expect(summary.failed).toBe(1)
      expect(summary.results[0].ok).toBe(true)
      expect(summary.results[0].slug).toBe("app-1")
      expect(summary.results[1].ok).toBe(false)
      expect(summary.results[1].error).toContain("stack-nonexistent")
    })
  })
})
