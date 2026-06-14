import { describe, it, expect, beforeEach, mock } from "bun:test"

import {
  VpnServerConflictError,
  VpnServerNotFoundError,
  VpnServerReferenceError,
  VpnServerService,
} from "./vpn-server.service"
import {
  createVpnServerSchema,
  updateVpnServerSchema,
} from "./vpn-server.schema"

type AnyFn = (...args: any[]) => any

const baseInput = {
  name: "ID-01",
  regionId: "reg-1",
  hostname: "vpn-id-01.example.net",
  sshPort: 22,
  sshKeyId: "key-1",
  sshUser: "root",
  isActive: true,
}

const makeServer = (over: Record<string, unknown> = {}) => ({
  id: "srv-1",
  name: "ID-01",
  regionId: "reg-1",
  hostname: "vpn-id-01.example.net",
  ipAddress: null,
  sshPort: 22,
  sshKeyId: "key-1",
  sshUser: "root",
  hasOpenVpn: true,
  openVpnPort: 1194,
  hasWireGuard: false,
  wireGuardPort: null,
  hasProxy: false,
  proxyPort: null,
  health: "UNKNOWN",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  region: { id: "reg-1", name: "Indonesia", slug: "indonesia", countryCode: "id" },
  sshKey: { id: "key-1", name: "Prod Key", fingerprint: "SHA256:abc" },
  ...over,
})

const serverFindMany = mock<AnyFn>(async () => [])
const serverFindUnique = mock<AnyFn>(async () => null)
const serverCreate = mock<AnyFn>(async () => makeServer())
const serverUpdate = mock<AnyFn>(async () => makeServer())
const serverDelete = mock<AnyFn>(async () => makeServer())
const regionFindUnique = mock<AnyFn>(async () => ({ id: "reg-1" }))
const sshKeyFindUnique = mock<AnyFn>(async () => ({ id: "key-1" }))

const prismaMock = {
  vpnServer: {
    findMany: serverFindMany,
    findUnique: serverFindUnique,
    create: serverCreate,
    update: serverUpdate,
    delete: serverDelete,
  },
  vpnRegion: { findUnique: regionFindUnique },
  vpnSshKey: { findUnique: sshKeyFindUnique },
} as any

const service = new VpnServerService(prismaMock)

beforeEach(() => {
  for (const m of [
    serverFindMany,
    serverFindUnique,
    serverCreate,
    serverUpdate,
    serverDelete,
    regionFindUnique,
    sshKeyFindUnique,
  ]) {
    m.mockClear()
  }
  serverFindUnique.mockResolvedValue(null)
  serverCreate.mockResolvedValue(makeServer())
  serverUpdate.mockResolvedValue(makeServer())
  serverDelete.mockResolvedValue(makeServer())
  regionFindUnique.mockResolvedValue({ id: "reg-1" })
  sshKeyFindUnique.mockResolvedValue({ id: "key-1" })
})

describe("createVpnServerSchema", () => {
  it("requires at least one protocol port", () => {
    const result = createVpnServerSchema.safeParse(baseInput)
    expect(result.success).toBe(false)
  })

  it("accepts a server with one protocol", () => {
    const result = createVpnServerSchema.safeParse({
      ...baseInput,
      openVpnPort: 1194,
    })
    expect(result.success).toBe(true)
  })

  it("rejects duplicate ports across protocols", () => {
    const result = createVpnServerSchema.safeParse({
      ...baseInput,
      openVpnPort: 1194,
      proxyPort: 1194,
    })
    expect(result.success).toBe(false)
  })

  it("allows WireGuard + Proxy on the same server", () => {
    const result = createVpnServerSchema.safeParse({
      ...baseInput,
      wireGuardPort: 51820,
      proxyPort: 3128,
    })
    expect(result.success).toBe(true)
  })

  it("allows all three protocols on the same server", () => {
    const result = createVpnServerSchema.safeParse({
      ...baseInput,
      openVpnPort: 1194,
      wireGuardPort: 51820,
      proxyPort: 3128,
    })
    expect(result.success).toBe(true)
  })

  it("rejects out-of-range ports", () => {
    const result = createVpnServerSchema.safeParse({
      ...baseInput,
      openVpnPort: 70000,
    })
    expect(result.success).toBe(false)
  })

  it("update schema enforces the same protocol rule", () => {
    const result = updateVpnServerSchema.safeParse(baseInput)
    expect(result.success).toBe(false)
  })

  it("defaults sshPort to 22 when omitted", () => {
    const result = createVpnServerSchema.safeParse({
      ...baseInput,
      sshPort: undefined,
      openVpnPort: 1194,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.sshPort).toBe(22)
  })

  it("rejects out-of-range sshPort", () => {
    const result = createVpnServerSchema.safeParse({
      ...baseInput,
      sshPort: 70000,
      openVpnPort: 1194,
    })
    expect(result.success).toBe(false)
  })

  it("accepts a valid IPv4 ipAddress", () => {
    const result = createVpnServerSchema.safeParse({
      ...baseInput,
      ipAddress: "203.0.113.10",
      openVpnPort: 1194,
    })
    expect(result.success).toBe(true)
  })

  it("accepts a valid IPv6 ipAddress", () => {
    const result = createVpnServerSchema.safeParse({
      ...baseInput,
      ipAddress: "2001:db8::1",
      openVpnPort: 1194,
    })
    expect(result.success).toBe(true)
  })

  it("treats empty ipAddress as undefined", () => {
    const result = createVpnServerSchema.safeParse({
      ...baseInput,
      ipAddress: "",
      openVpnPort: 1194,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.ipAddress).toBeUndefined()
  })

  it("rejects a malformed ipAddress", () => {
    const result = createVpnServerSchema.safeParse({
      ...baseInput,
      ipAddress: "999.1.1.1",
      openVpnPort: 1194,
    })
    expect(result.success).toBe(false)
  })
})

describe("VpnServerService.list", () => {
  it("applies no where clause without filters", async () => {
    await service.list()
    expect(serverFindMany.mock.calls[0][0].where).toBeUndefined()
  })

  it("filters by regionId", async () => {
    await service.list({ regionId: "reg-1" })
    expect(serverFindMany.mock.calls[0][0].where).toEqual({ regionId: "reg-1" })
  })

  it("filters by search across hostname and ipAddress", async () => {
    await service.list({ search: "203.0" })
    expect(serverFindMany.mock.calls[0][0].where).toEqual({
      OR: [
        { hostname: { contains: "203.0", mode: "insensitive" } },
        { ipAddress: { contains: "203.0", mode: "insensitive" } },
      ],
    })
  })

  it("composes regionId and search (AND logic)", async () => {
    await service.list({ regionId: "reg-1", search: "203" })
    expect(serverFindMany.mock.calls[0][0].where).toEqual({
      regionId: "reg-1",
      OR: [
        { hostname: { contains: "203", mode: "insensitive" } },
        { ipAddress: { contains: "203", mode: "insensitive" } },
      ],
    })
  })
})

describe("VpnServerService.create", () => {
  it("sets protocol flags from provided ports", async () => {
    await service.create({ ...baseInput, openVpnPort: 1194, proxyPort: 3128 })
    const data = serverCreate.mock.calls[0][0].data
    expect(data.hasOpenVpn).toBe(true)
    expect(data.openVpnPort).toBe(1194)
    expect(data.hasProxy).toBe(true)
    expect(data.proxyPort).toBe(3128)
    expect(data.hasWireGuard).toBe(false)
    expect(data.wireGuardPort).toBeNull()
  })

  it("rejects unknown region", async () => {
    regionFindUnique.mockResolvedValue(null)
    await expect(
      service.create({ ...baseInput, openVpnPort: 1194 })
    ).rejects.toBeInstanceOf(VpnServerReferenceError)
  })

  it("rejects unknown ssh key", async () => {
    sshKeyFindUnique.mockResolvedValue(null)
    await expect(
      service.create({ ...baseInput, openVpnPort: 1194 })
    ).rejects.toBeInstanceOf(VpnServerReferenceError)
  })

  it("rejects duplicate server name", async () => {
    serverFindUnique.mockResolvedValue(makeServer({ id: "other" }))
    await expect(
      service.create({ ...baseInput, openVpnPort: 1194 })
    ).rejects.toBeInstanceOf(VpnServerConflictError)
  })
})

describe("VpnServerService.update / remove", () => {
  it("throws when server missing on update", async () => {
    serverFindUnique.mockResolvedValue(null)
    await expect(
      service.update("missing", { ...baseInput, openVpnPort: 1194 })
    ).rejects.toBeInstanceOf(VpnServerNotFoundError)
  })

  it("deletes an existing server", async () => {
    serverFindUnique.mockResolvedValue(makeServer())
    await service.remove("srv-1")
    expect(serverDelete).toHaveBeenCalledTimes(1)
  })
})
