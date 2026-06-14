import { describe, it, expect, beforeEach, mock } from "bun:test"

import {
  VpnRegionConflictError,
  VpnRegionInUseError,
  VpnRegionNotFoundError,
  VpnRegionService,
} from "./vpn-region.service"
import { slugifyRegionName } from "./vpn-region.schema"

type AnyFn = (...args: any[]) => any

const makeRegion = (over: Record<string, unknown> = {}) => ({
  id: "reg-1",
  name: "Indonesia",
  slug: "indonesia",
  countryCode: "id",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  _count: { servers: 0 },
  ...over,
})

const findMany = mock<AnyFn>(async () => [])
const findUnique = mock<AnyFn>(async () => null)
const create = mock<AnyFn>(async () => makeRegion())
const update = mock<AnyFn>(async () => makeRegion())
const del = mock<AnyFn>(async () => makeRegion())

const prismaMock = {
  vpnRegion: { findMany, findUnique, create, update, delete: del },
} as any

const service = new VpnRegionService(prismaMock)

beforeEach(() => {
  findMany.mockClear()
  findUnique.mockClear()
  create.mockClear()
  update.mockClear()
  del.mockClear()
  findUnique.mockResolvedValue(null)
  create.mockResolvedValue(makeRegion())
  update.mockResolvedValue(makeRegion())
  del.mockResolvedValue(makeRegion())
})

describe("slugifyRegionName", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyRegionName("United States")).toBe("united-states")
    expect(slugifyRegionName("  São Paulo!! ")).toBe("s-o-paulo")
    expect(slugifyRegionName("ID")).toBe("id")
  })
})

describe("VpnRegionService.create", () => {
  it("creates a region with generated slug", async () => {
    create.mockResolvedValue(makeRegion({ name: "Singapore", slug: "singapore" }))
    const region = await service.create({
      name: "Singapore",
      countryCode: "sg",
      isActive: true,
    })
    expect(region.slug).toBe("singapore")
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].data.slug).toBe("singapore")
  })

  it("rejects duplicate slug", async () => {
    findUnique.mockResolvedValue(makeRegion())
    await expect(
      service.create({ name: "Indonesia", countryCode: "id", isActive: true })
    ).rejects.toBeInstanceOf(VpnRegionConflictError)
    expect(create).not.toHaveBeenCalled()
  })
})

describe("VpnRegionService.update", () => {
  it("updates name and regenerates slug", async () => {
    findUnique.mockImplementation(async ({ where }: any) => {
      if (where.id) return makeRegion()
      return null
    })
    update.mockResolvedValue(makeRegion({ name: "Indo", slug: "indo" }))
    const region = await service.update("reg-1", { name: "Indo" })
    expect(region.slug).toBe("indo")
    expect(update.mock.calls[0][0].data.slug).toBe("indo")
  })

  it("throws when region missing", async () => {
    findUnique.mockResolvedValue(null)
    await expect(
      service.update("missing", { name: "X" })
    ).rejects.toBeInstanceOf(VpnRegionNotFoundError)
  })

  it("rejects slug clash with another region", async () => {
    findUnique.mockImplementation(async ({ where }: any) => {
      if (where.id) return makeRegion({ id: "reg-1" })
      if (where.slug) return makeRegion({ id: "reg-2", slug: "singapore" })
      return null
    })
    await expect(
      service.update("reg-1", { name: "Singapore" })
    ).rejects.toBeInstanceOf(VpnRegionConflictError)
  })
})

describe("VpnRegionService.remove", () => {
  it("deletes a region without servers", async () => {
    findUnique.mockResolvedValue(makeRegion({ _count: { servers: 0 } }))
    await service.remove("reg-1")
    expect(del).toHaveBeenCalledTimes(1)
  })

  it("refuses to delete a region with servers", async () => {
    findUnique.mockResolvedValue(makeRegion({ _count: { servers: 2 } }))
    await expect(service.remove("reg-1")).rejects.toBeInstanceOf(
      VpnRegionInUseError
    )
    expect(del).not.toHaveBeenCalled()
  })
})
