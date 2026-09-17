import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockWithAuth = mock(async () => ({
  user: {
    id: "user-123",
    email: "test@example.com",
  },
  organizationId: "org-1",
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

const mockComputeReinstallPreflight = mock(async () => ({
  canProceed: true,
  currentTemplate: { id: "t-1", name: "Hermes" },
  targetTemplate: { id: "t-2", name: "WordPress" },
  diff: {},
  dependencies: {},
  envDiff: {},
}))

const mockExecuteReinstall = mock(async () => ({
  ok: true,
  stackId: "stack-1",
  slug: "my-app",
  deploymentId: "dep-1",
  commitSha: "sha-123",
  snapshotId: "snap-123",
  message: "Template reinstalled successfully",
}))

const mockExecuteRollback = mock(async () => ({
  ok: true,
  stackId: "stack-1",
  slug: "my-app",
  deploymentId: "dep-2",
  commitSha: "sha-456",
  restoredTemplateId: "t-1",
  message: "Rollback successful",
}))

mock.module("../../app-reinstall.service", () => ({
  computeReinstallPreflight: mockComputeReinstallPreflight,
  executeReinstall: mockExecuteReinstall,
  executeRollback: mockExecuteRollback,
  AppReinstallError: class AppReinstallError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly statusCode: number = 400
    ) {
      super(message)
    }
  },
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    applicationStack: { findUnique: mock() },
    appTemplate: { findFirst: mock() },
  },
}))

const { appStacksRoutes } = await import("./app-stacks.route")

describe("app-stacks reinstall & rollback routes", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
    mockComputeReinstallPreflight.mockClear()
    mockExecuteReinstall.mockClear()
    mockExecuteRollback.mockClear()
    mockWithAuth.mockResolvedValue({
      user: {
        id: "user-123",
        email: "test@example.com",
      },
      organizationId: "org-1",
    })
  })

  describe("GET /deploy/apps/:slug/reinstall/preflight", () => {
    it("returns 401 when unauthorized", async () => {
      mockWithAuth.mockResolvedValueOnce({
        user: null,
        organizationId: null,
      } as never)

      const response = await appStacksRoutes.handle(
        new Request(
          "http://localhost/deploy/apps/my-app/reinstall/preflight?targetTemplateId=tmpl-wp"
        )
      )

      expect(response.status).toBe(401)
    })

    it("returns preflight analysis data on success", async () => {
      const response = await appStacksRoutes.handle(
        new Request(
          "http://localhost/deploy/apps/my-app/reinstall/preflight?targetTemplateId=tmpl-wp"
        )
      )

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.ok).toBe(true)
      expect(json.data.canProceed).toBe(true)
      expect(mockComputeReinstallPreflight).toHaveBeenCalledWith({
        organizationId: "org-1",
        slug: "my-app",
        targetTemplateId: "tmpl-wp",
      })
    })
  })

  describe("POST /deploy/apps/:slug/reinstall", () => {
    it("triggers reinstall and returns deployment info", async () => {
      const response = await appStacksRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/reinstall", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetTemplateId: "tmpl-wp",
            dependencyMode: "MANAGED",
          }),
        })
      )

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.ok).toBe(true)
      expect(json.data.deploymentId).toBe("dep-1")
      expect(mockExecuteReinstall).toHaveBeenCalledWith({
        organizationId: "org-1",
        slug: "my-app",
        input: {
          targetTemplateId: "tmpl-wp",
          dependencyMode: "MANAGED",
        },
        authorUserId: "user-123",
      })
    })
  })

  describe("POST /deploy/apps/:slug/rollback", () => {
    it("triggers rollback and returns restored deployment info", async () => {
      const response = await appStacksRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/rollback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.ok).toBe(true)
      expect(json.data.restoredTemplateId).toBe("t-1")
      expect(mockExecuteRollback).toHaveBeenCalledWith({
        organizationId: "org-1",
        slug: "my-app",
        authorUserId: "user-123",
      })
    })
  })
})
