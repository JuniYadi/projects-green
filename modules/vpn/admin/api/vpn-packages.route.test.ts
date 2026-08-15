import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { createAdminVpnPackagesRoutes } from "./vpn-packages.route"
import { VpnPackageValidationError } from "../vpn-package.service"
import type {
  AdminActorContext,
  AdminApiError,
  RouteSet,
} from "@/modules/admin/api/admin.guards"

const guard = mock<
  (set: RouteSet) => Promise<AdminActorContext | AdminApiError>
>(async () => ({
  ok: true,
  userId: "admin-1",
  platformRole: "super_admin",
}))

const server = {
  id: "server-1",
  name: "Jakarta",
  hostname: "vpn.example.com",
  ipAddress: "10.0.0.1",
  sshPort: 22,
  sshUser: "vpnadmin",
  isActive: true,
  health: "HEALTHY",
  latitude: null,
  longitude: null,
  hasOpenVpn: true,
  openVpnPort: 1194,
  hasWireGuard: false,
  wireGuardPort: null,
  hasProxy: false,
  proxyPort: null,
  region: {
    id: "region-1",
    name: "Indonesia",
    slug: "indonesia",
    countryCode: "ID",
  },
  sshKey: { id: "key-1", name: "key", fingerprint: "SHA256:key" },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

const packageRecord = {
  id: "package-1",
  name: "Business VPN",
  description: "For teams",
  servicePlanId: "plan-1",
  price: null,
  currency: null,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  servicePlan: {
    id: "plan-1",
    code: "VPN_PACKAGE_ONE",
    name: "Business VPN",
    isActive: true,
    package: { code: "VPN" },
    pricings: [],
  },
  servers: [
    {
      id: "package-server-1",
      server,
    },
  ],
}

const service = {
  list: mock(async () => [packageRecord]),
  create: mock(async () => packageRecord),
  update: mock(async () => packageRecord),
  deactivate: mock(async () => packageRecord),
}

function app() {
  return new Elysia().use(
    createAdminVpnPackagesRoutes({
      requireSuperAdmin: guard,
      service: service as never,
    })
  )
}

describe("admin VPN package routes", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    guard.mockResolvedValue({
      ok: true,
      userId: "admin-1",
      platformRole: "super_admin",
    })
    service.create.mockResolvedValue(packageRecord)
  })

  it("creates a package through the service and returns its catalog plan", async () => {
    const response = await app().handle(
      new Request("http://localhost/admin/vpn/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Business VPN", serverIds: ["server-1"] }),
      })
    )

    expect(response.status).toBe(201)
    expect(service.create).toHaveBeenCalledWith({
      name: "Business VPN",
      serverIds: ["server-1"],
      isActive: true,
    })
    expect((await response.json()).data.catalogPlan).toMatchObject({
      id: "plan-1",
      packageCode: "VPN",
    })
  })

  it("returns a validation error when the global VPN product is missing", async () => {
    service.create.mockRejectedValueOnce(
      new VpnPackageValidationError(
        "The global VPN catalog product is not configured."
      )
    )

    const response = await app().handle(
      new Request("http://localhost/admin/vpn/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Business VPN", serverIds: ["server-1"] }),
      })
    )

    expect(response.status).toBe(422)
  })
})
