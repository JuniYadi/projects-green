import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockPrisma = {
  applicationStack: {
    findUnique: mock(),
    update: mock(),
    updateMany: mock(),
  },
  appTemplate: {
    findFirst: mock(),
  },
  appManagedStock: {
    count: mock(),
  },
  applicationDeployment: {
    create: mock(),
    update: mock(),
  },
  $transaction: mock(async (fn: (tx: typeof mockPrisma) => unknown) => {
    return fn(mockPrisma)
  }),
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const mockClaimManagedStock = mock(async () => ({
  id: "stock-mysql-123",
  serviceType: "MYSQL",
  status: "ALLOCATED",
}))

const mockReleaseManagedStock = mock(async () => {})

mock.module("./app-managed-stock.service", () => ({
  claimManagedStock: mockClaimManagedStock,
  releaseManagedStock: mockReleaseManagedStock,
}))

const mockSyncStackConfiguration = mock(async () => ({
  ok: true,
  commitSha: "sha-reinstall-abc",
  message: "Configuration synced successfully",
}))

mock.module("./sync-stack.service", () => ({
  syncStackConfiguration: mockSyncStackConfiguration,
}))

const mockWriteSecrets = mock(async () => ({
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
  computeReinstallPreflight,
  executeReinstall,
  executeRollback,
  AppReinstallError,
} = await import("./app-reinstall.service")

describe("app-reinstall.service", () => {
  beforeEach(() => {
    mockPrisma.applicationStack.findUnique.mockReset()
    mockPrisma.applicationStack.update.mockReset()
    mockPrisma.applicationStack.updateMany.mockReset()
    mockPrisma.applicationStack.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.appTemplate.findFirst.mockReset()
    mockPrisma.appManagedStock.count.mockReset()
    mockPrisma.applicationDeployment.create.mockReset()
    mockPrisma.applicationDeployment.update.mockReset()
    mockClaimManagedStock.mockClear()
    mockReleaseManagedStock.mockClear()
    mockSyncStackConfiguration.mockClear()
    mockWriteSecrets.mockClear()
  })
  describe("computeReinstallPreflight", () => {
    it("throws 404 when stack is not found", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce(null)

      expect(
        computeReinstallPreflight({
          organizationId: "org-1",
          slug: "non-existent",
          targetTemplateId: "tmpl-wp",
        })
      ).rejects.toThrow(AppReinstallError)
    })

    it("throws 404 when target template belongs to another organization", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        slug: "my-app",
        status: "RUNNING",
        metadataJson: {},
      })
      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-private",
        slug: "private-tmpl",
        visibility: "PRIVATE",
        isOfficial: false,
        organizationId: "other-org",
        blueprintJson: { version: "1.0.0", runtime: { image: "test" } },
      })

      expect(
        computeReinstallPreflight({
          organizationId: "org-1",
          slug: "my-app",
          targetTemplateId: "tmpl-private",
        })
      ).rejects.toThrow("Target template not found")
    })

    it("computes diff and identifies required database dependencies and storage policy", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        slug: "hermes-app",
        status: "RUNNING",
        port: 8080,
        metadataJson: {
          deploymentType: "statefulset",
          imageRepository: "nousresearch/hermes-agent:v1",
        },
        template: {
          id: "tmpl-hermes",
          slug: "hermes",
          name: "Hermes Agent",
          version: "1.0.0",
          blueprintJson: {
            version: "1.0.0",
            runtime: {
              image: "nousresearch/hermes-agent:v1",
              deploymentType: "statefulset",
              defaultPort: 8080,
            },
            storage: { mountPath: "/opt/data" },
          },
        },
        envVarsJson: [{ key: "CUSTOM_VAR", value: "123" }],
      })

      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-wp",
        slug: "wordpress",
        name: "WordPress",
        version: "6.5-apache",
        visibility: "PUBLIC",
        isOfficial: true,
        blueprintJson: {
          version: "1.0.0",
          runtime: {
            image: "wordpress:6.5-apache",
            deploymentType: "deployment",
            defaultPort: 80,
          },
          storage: { mountPath: "/var/www/html" },
          dependencies: [
            {
              serviceType: "MYSQL",
              alias: "mysql-db",
              envPrefix: "WORDPRESS_DB",
            },
          ],
          envSchema: [
            {
              key: "WORDPRESS_DB_NAME",
              label: "DB Name",
              required: true,
              isSecret: false,
              dataType: "string",
            },
          ],
        },
      })

      mockPrisma.appManagedStock.count.mockResolvedValueOnce(3)

      const result = await computeReinstallPreflight({
        organizationId: "org-1",
        slug: "hermes-app",
        targetTemplateId: "tmpl-wp",
      })

      expect(result.canProceed).toBe(true)
      expect(result.diff.workloadKind.changed).toBe(true)
      expect(result.diff.workloadKind.current).toBe("statefulset")
      expect(result.diff.workloadKind.target).toBe("deployment")
      expect(result.diff.port.current).toBe(8080)
      expect(result.diff.port.target).toBe(80)
      expect(result.diff.storage.policy).toBe(
        "PRESERVE_OLD_DETACH_AND_FRESH_VOLUME"
      )
      expect(result.dependencies.requiredServiceType).toBe("MYSQL")
      expect(result.dependencies.managedStockAvailable).toBe(true)
      expect(result.dependencies.availableStockCount).toBe(3)
      expect(result.dependencies.allowedModes).toEqual(["MANAGED", "BYOD"])
      expect(result.envDiff.requiredEnvs.length).toBe(1)
      expect(result.envDiff.requiredEnvs[0].key).toBe("WORDPRESS_DB_NAME")
    })

    it("flags canProceed as false when stack deployment is in progress", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        slug: "deploying-app",
        status: "DEPLOYING",
        metadataJson: {},
      })
      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-wp",
        slug: "wordpress",
        visibility: "PUBLIC",
        isOfficial: true,
        blueprintJson: {
          version: "1.0.0",
          runtime: { image: "wordpress:latest", defaultPort: 80 },
        },
      })

      const result = await computeReinstallPreflight({
        organizationId: "org-1",
        slug: "deploying-app",
        targetTemplateId: "tmpl-wp",
      })

      expect(result.canProceed).toBe(false)
      expect(result.blockReason).toContain(
        "Cannot reinstall while a deployment is in progress"
      )
    })
  })

  describe("executeReinstall", () => {
    it("rejects reinstall if deployment is currently active", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        slug: "my-app",
        status: "DEPLOYING",
      })

      expect(
        executeReinstall({
          organizationId: "org-1",
          slug: "my-app",
          input: { targetTemplateId: "tmpl-2" },
        })
      ).rejects.toThrow("A deployment is already in progress")
    })

    it("claims managed stock when target requires DB and dependencyMode is MANAGED", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        name: "My Hermes App",
        slug: "my-hermes-app",
        organizationId: "org-1",
        status: "RUNNING",
        metadataJson: {
          imageRepository: "nousresearch/hermes-agent:v1",
        },
        envVarsJson: [],
      })

      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-wp",
        slug: "wordpress",
        name: "WordPress",
        visibility: "PUBLIC",
        isOfficial: true,
        blueprintJson: {
          version: "1.0.0",
          runtime: {
            image: "wordpress:6.5-apache",
            defaultPort: 80,
            deploymentType: "deployment",
          },
          dependencies: [
            {
              serviceType: "MYSQL",
              alias: "mysql-db",
              envPrefix: "WORDPRESS_DB",
            },
          ],
          envSchema: [],
        },
      })

      mockPrisma.applicationDeployment.create.mockResolvedValueOnce({
        id: "dep-reinstall-1",
      })
      mockPrisma.applicationStack.update.mockResolvedValueOnce({})

      const result = await executeReinstall({
        organizationId: "org-1",
        slug: "my-hermes-app",
        input: {
          targetTemplateId: "tmpl-wp",
          dependencyMode: "MANAGED",
        },
        authorUserId: "user-1",
      })

      expect(result.ok).toBe(true)
      expect(result.deploymentId).toBe("dep-reinstall-1")
      expect(result.commitSha).toBe("sha-reinstall-abc")
      expect(result.snapshotId).toContain("snap_")
      expect(mockClaimManagedStock).toHaveBeenCalledTimes(1)
      expect(mockSyncStackConfiguration).toHaveBeenCalledTimes(1)
    })

    it("aborts and throws 409 when concurrent deployment is detected in transaction (TOCTOU)", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        name: "My App",
        slug: "my-app",
        organizationId: "org-1",
        status: "RUNNING",
        metadataJson: {},
        envVarsJson: [],
      })

      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-wp",
        slug: "wordpress",
        name: "WordPress",
        visibility: "PUBLIC",
        isOfficial: true,
        blueprintJson: {
          version: "1.0.0",
          runtime: { image: "wordpress:6.5", defaultPort: 80 },
          dependencies: [{ serviceType: "MYSQL", envPrefix: "DB" }],
        },
      })

      // Concurrent deployment wins race -> 0 rows updated
      mockPrisma.applicationStack.updateMany.mockResolvedValueOnce({ count: 0 })

      await expect(
        executeReinstall({
          organizationId: "org-1",
          slug: "my-app",
          input: {
            targetTemplateId: "tmpl-wp",
            dependencyMode: "MANAGED",
          },
        })
      ).rejects.toThrow("A deployment is already in progress")

      // Verify managed stock was cleaned up and released
      expect(mockReleaseManagedStock).toHaveBeenCalledWith("stack-1")
    })

    it("writes BYOD database credentials to Vault when dependencyMode is BYOD", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        name: "My App",
        slug: "my-app",
        organizationId: "org-1",
        status: "RUNNING",
        metadataJson: {},
        envVarsJson: [],
      })

      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-wp",
        slug: "wordpress",
        name: "WordPress",
        visibility: "PUBLIC",
        isOfficial: true,
        blueprintJson: {
          version: "1.0.0",
          runtime: { image: "wordpress:6.5", defaultPort: 80 },
          dependencies: [{ serviceType: "MYSQL", envPrefix: "WP_DB" }],
        },
      })

      mockPrisma.applicationDeployment.create.mockResolvedValueOnce({
        id: "dep-byod-1",
      })

      const result = await executeReinstall({
        organizationId: "org-1",
        slug: "my-app",
        input: {
          targetTemplateId: "tmpl-wp",
          dependencyMode: "BYOD",
          byodCredentials: {
            host: "db.external.com",
            port: 3306,
            database: "custom_db",
            user: "ext_user",
            password: "ext_password",
          },
        },
      })

      expect(result.ok).toBe(true)
      expect(mockClaimManagedStock).not.toHaveBeenCalled()
      expect(mockWriteSecrets).toHaveBeenCalledWith({
        organizationId: "org-1",
        stackId: "stack-1",
        environment: "prod",
        secrets: {
          WP_DB_HOST: "db.external.com",
          WP_DB_PORT: "3306",
          WP_DB_DATABASE: "custom_db",
          WP_DB_USER: "ext_user",
          WP_DB_PASSWORD: "ext_password",
        },
      })
    })

    it("records failure on deployment and throws 500 when GitOps sync fails", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        name: "My App",
        slug: "my-app",
        organizationId: "org-1",
        status: "RUNNING",
        metadataJson: {},
        envVarsJson: [],
      })

      mockPrisma.appTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-wp",
        slug: "wordpress",
        name: "WordPress",
        visibility: "PUBLIC",
        isOfficial: true,
        blueprintJson: {
          version: "1.0.0",
          runtime: { image: "wordpress:6.5", defaultPort: 80 },
        },
      })

      mockPrisma.applicationDeployment.create.mockResolvedValueOnce({
        id: "dep-gitops-fail-1",
      })
      mockSyncStackConfiguration.mockRejectedValueOnce(
        new Error("GitOps repository connection failed")
      )

      await expect(
        executeReinstall({
          organizationId: "org-1",
          slug: "my-app",
          input: {
            targetTemplateId: "tmpl-wp",
          },
        })
      ).rejects.toThrow("GitOps repository connection failed")

      expect(mockPrisma.applicationDeployment.update).toHaveBeenCalledWith({
        where: { id: "dep-gitops-fail-1" },
        data: {
          status: "FAILED",
          failureReason: "GitOps repository connection failed",
          completedAt: expect.any(Date),
        },
      })
    })
  })

  describe("executeRollback", () => {
    it("throws error if no rollback snapshot exists in stack metadata", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        slug: "my-app",
        status: "FAILED",
        metadataJson: {},
      })

      expect(
        executeRollback({
          organizationId: "org-1",
          slug: "my-app",
        })
      ).rejects.toThrow("No rollback snapshot found")
    })

    it("successfully restores snapshot configuration and triggers rollback deployment", async () => {
      const snapshot = {
        id: "snap_123",
        templateId: "tmpl-hermes",
        defaultPort: 8080,
        envVars: [{ key: "HERMES_KEY", value: "val" }],
        metadata: {
          imageRepository: "nousresearch/hermes-agent:v1",
        },
      }

      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        slug: "my-app",
        organizationId: "org-1",
        status: "FAILED",
        metadataJson: {
          rollbackSnapshot: snapshot,
        },
        deployments: [{ id: "dep-failed-1" }],
      })

      mockPrisma.applicationDeployment.create.mockResolvedValueOnce({
        id: "dep-rollback-1",
      })
      mockPrisma.applicationStack.update.mockResolvedValueOnce({})

      const result = await executeRollback({
        organizationId: "org-1",
        slug: "my-app",
        authorUserId: "user-1",
      })

      expect(result.ok).toBe(true)
      expect(result.deploymentId).toBe("dep-rollback-1")
      expect(result.restoredTemplateId).toBe("tmpl-hermes")
      expect(mockSyncStackConfiguration).toHaveBeenCalledTimes(1)
    })

    it("rejects rollback if specified snapshotId does not match active snapshot", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        slug: "my-app",
        organizationId: "org-1",
        status: "FAILED",
        metadataJson: {
          rollbackSnapshot: { id: "snap_actual_123" },
        },
      })

      await expect(
        executeRollback({
          organizationId: "org-1",
          slug: "my-app",
          snapshotId: "snap_mismatched_999",
        })
      ).rejects.toThrow("does not match active rollback snapshot")
    })

    it("aborts rollback and throws 409 when concurrent deployment is detected during rollback", async () => {
      mockPrisma.applicationStack.findUnique.mockResolvedValueOnce({
        id: "stack-1",
        slug: "my-app",
        organizationId: "org-1",
        status: "FAILED",
        metadataJson: {
          rollbackSnapshot: {
            id: "snap_123",
            templateId: "tmpl-1",
            metadata: {},
            envVars: [],
          },
        },
      })

      mockPrisma.applicationStack.updateMany.mockResolvedValueOnce({ count: 0 })

      await expect(
        executeRollback({
          organizationId: "org-1",
          slug: "my-app",
        })
      ).rejects.toThrow(
        "Cannot rollback while a deployment is already in progress."
      )
    })
  })
})
