import { describe, it, expect, beforeEach, mock } from "bun:test"

import {
  VpnPackageNotFoundError,
  VpnPackageValidationError,
  VpnPackageService,
} from "./vpn-package.service"

type AnyFn = (...args: any[]) => any

const pkgFindMany = mock<AnyFn>(async () => [])
const pkgFindUnique = mock<AnyFn>(async () => null)
const pkgCreate = mock<AnyFn>(async () => ({}))
const pkgUpdate = mock<AnyFn>(async () => ({}))
const serverFindMany = mock<AnyFn>(async () => [])
const servicePackageFindUnique = mock<AnyFn>(async () => ({
  id: "service-package-vpn",
  code: "VPN",
}))
const transaction = mock<AnyFn>(async (callback: AnyFn) => callback(prismaMock))

const prismaMock = {
  vpnPackage: {
    findMany: pkgFindMany,
    findUnique: pkgFindUnique,
    create: pkgCreate,
    update: pkgUpdate,
  },
  vpnServer: { findMany: serverFindMany },
  servicePackage: { findUnique: servicePackageFindUnique },
  $transaction: transaction,
} as any

const service = new VpnPackageService(prismaMock)

beforeEach(() => {
  pkgFindMany.mockClear()
  pkgFindUnique.mockClear()
  pkgCreate.mockClear()
  pkgUpdate.mockClear()
  serverFindMany.mockClear()
  servicePackageFindUnique.mockClear()
  transaction.mockClear()
  pkgFindUnique.mockResolvedValue({ id: "pkg-1", isActive: true })
  servicePackageFindUnique.mockResolvedValue({
    id: "service-package-vpn",
    code: "VPN",
  })
  pkgCreate.mockResolvedValue({ id: "pkg-1" })
  pkgUpdate.mockResolvedValue({ id: "pkg-1" })
  serverFindMany.mockImplementation(async (args: any) => {
    const ids = (args?.where?.id?.in as string[]) ?? []
    const known = new Set(["srv-1", "srv-2"])
    return ids.filter((id) => known.has(id)).map((id) => ({ id }))
  })
})

describe("VpnPackageService.create", () => {
  it("creates a package with nested server rows", async () => {
    await service.create({
      name: "Global Bundle",
      isActive: true,
      serverIds: ["srv-1", "srv-2"],
    })
    expect(pkgCreate).toHaveBeenCalledTimes(1)
    const data = pkgCreate.mock.calls[0][0].data
    expect(data).not.toHaveProperty("price")
    expect(data).not.toHaveProperty("currency")
    expect(data.servicePlan.create).toMatchObject({
      code: expect.stringMatching(/^VPN_[0-9a-f-]{36}$/),
      name: "Global Bundle",
      resources: {},
      isActive: true,
      package: { connect: { id: "service-package-vpn" } },
    })
    expect(data.servers.create).toEqual([
      { serverId: "srv-1" },
      { serverId: "srv-2" },
    ])
  })

  it("rejects unknown server ids", async () => {
    await expect(
      service.create({
        name: "Bad",
        serverIds: ["srv-1", "srv-missing"],
      })
    ).rejects.toBeInstanceOf(VpnPackageValidationError)
    expect(pkgCreate).not.toHaveBeenCalled()
  })
})

describe("VpnPackageService.update", () => {
  it("replaces servers when serverIds provided", async () => {
    pkgFindUnique.mockResolvedValue({
      id: "pkg-1",
      isActive: true,
      servicePlan: { package: { code: "VPN" } },
    })
    await service.update("pkg-1", { serverIds: ["srv-2"] })
    const data = pkgUpdate.mock.calls[0][0].data
    expect(data.servers.deleteMany).toEqual({})
    expect(data.servers.create).toEqual([{ serverId: "srv-2" }])
  })

  it("throws when package missing", async () => {
    pkgFindUnique.mockResolvedValue(null)
    await expect(
      service.update("missing", { name: "X" })
    ).rejects.toBeInstanceOf(VpnPackageNotFoundError)
  })
})

describe("VpnPackageService.deactivate", () => {
  it("soft-deletes by setting isActive false", async () => {
    pkgFindUnique.mockResolvedValue({
      id: "pkg-1",
      isActive: true,
      servicePlan: { package: { code: "VPN" } },
    })
    await service.deactivate("pkg-1")
    expect(pkgUpdate.mock.calls[0][0].data).toEqual({ isActive: false })
  })

  it("throws when package missing", async () => {
    pkgFindUnique.mockResolvedValue(null)
    await expect(service.deactivate("missing")).rejects.toBeInstanceOf(
      VpnPackageNotFoundError
    )
  })
})
