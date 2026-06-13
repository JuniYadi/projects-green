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

const prismaMock = {
  vpnPackage: {
    findMany: pkgFindMany,
    findUnique: pkgFindUnique,
    create: pkgCreate,
    update: pkgUpdate,
  },
  vpnServer: { findMany: serverFindMany },
} as any

const service = new VpnPackageService(prismaMock)

beforeEach(() => {
  pkgFindMany.mockClear()
  pkgFindUnique.mockClear()
  pkgCreate.mockClear()
  pkgUpdate.mockClear()
  serverFindMany.mockClear()
  pkgFindUnique.mockResolvedValue({ id: "pkg-1", isActive: true })
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
      price: 100000,
      currency: "IDR",
      isActive: true,
      serverIds: ["srv-1", "srv-2"],
    })
    expect(pkgCreate).toHaveBeenCalledTimes(1)
    const data = pkgCreate.mock.calls[0][0].data
    expect(data.servers.create).toEqual([
      { serverId: "srv-1" },
      { serverId: "srv-2" },
    ])
    expect(data.price.toString()).toBe("100000")
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
})

describe("VpnPackageService.update", () => {
  it("replaces servers when serverIds provided", async () => {
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
