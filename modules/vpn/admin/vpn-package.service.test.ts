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
  id: "vpn-parent",
  isActive: true,
}))

const prismaMock = {
  vpnPackage: {
    findMany: pkgFindMany,
    findUnique: pkgFindUnique,
    create: pkgCreate,
    update: pkgUpdate,
  },
  vpnServer: { findMany: serverFindMany },
  servicePackage: { findUnique: servicePackageFindUnique },
} as any

const transaction = mock<AnyFn>(async (callback: (tx: any) => unknown) =>
  callback(prismaMock)
)
prismaMock.$transaction = transaction

const service = new VpnPackageService(prismaMock)

beforeEach(() => {
  pkgFindMany.mockClear()
  pkgFindUnique.mockClear()
  pkgCreate.mockClear()
  pkgUpdate.mockClear()
  serverFindMany.mockClear()
  servicePackageFindUnique.mockClear()
  transaction.mockClear()
  pkgFindUnique.mockResolvedValue({
    id: "pkg-1",
    isActive: true,
    servicePlan: {
      id: "plan-1",
      isActive: true,
      package: { code: "VPN", isActive: true },
    },
  })
  pkgCreate.mockResolvedValue({ id: "pkg-1" })
  pkgUpdate.mockResolvedValue({ id: "pkg-1" })
  servicePackageFindUnique.mockResolvedValue({
    id: "vpn-parent",
    isActive: true,
  })
  transaction.mockImplementation(async (callback: (tx: any) => unknown) =>
    callback(prismaMock)
  )
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
      price: 100000,
      currency: "IDR",
      isActive: true,
      serverIds: ["srv-1", "srv-2"],
    })
    expect(pkgCreate).toHaveBeenCalledTimes(1)
    const data = pkgCreate.mock.calls[0][0].data
    expect(data.servicePlan.create).toMatchObject({
      code: expect.stringMatching(/^VPN_[0-9a-f-]{36}$/),
      name: "Global Bundle",
      resources: {},
      isActive: true,
      package: { connect: { code: "VPN" } },
    })
    expect(data.servers.create).toEqual([
      { serverId: "srv-1" },
      { serverId: "srv-2" },
    ])
    expect(data.price.toString()).toBe("100000")
    expect(data.currency).toBe("IDR")
    expect(transaction).toHaveBeenCalledTimes(1)
  })

  it("rejects unknown server ids", async () => {
    await expect(
      service.create({
        name: "Bad",
        price: 1000,
        currency: "IDR",
        serverIds: ["srv-1", "srv-missing"],
      })
    ).rejects.toBeInstanceOf(VpnPackageValidationError)
    expect(pkgCreate).not.toHaveBeenCalled()
  })

  it("rejects creation when the global VPN catalog parent is unavailable", async () => {
    servicePackageFindUnique.mockResolvedValueOnce(null)

    await expect(
      service.create({ name: "Unavailable", serverIds: ["srv-1"] })
    ).rejects.toBeInstanceOf(VpnPackageValidationError)
    expect(pkgCreate).not.toHaveBeenCalled()
  })
})

describe("VpnPackageService.update", () => {
  it("replaces servers when serverIds provided", async () => {
    await service.update("pkg-1", { serverIds: ["srv-2"] })
    const data = pkgUpdate.mock.calls[0][0].data
    expect(data.servers.deleteMany).toEqual({})
    expect(data.servers.create).toEqual([{ serverId: "srv-2" }])
  })

  it("updates package activation without changing its linked plan", async () => {
    await service.update("pkg-1", { isActive: false })

    expect(pkgUpdate.mock.calls[0][0].data).toEqual({ isActive: false })
    expect(pkgUpdate.mock.calls[0][0].where).toEqual({ id: "pkg-1" })
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
