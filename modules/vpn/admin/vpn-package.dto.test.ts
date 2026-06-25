import { expect, describe, it } from "bun:test"

const { toVpnPackageDTO, serverProtocolLabels } = await import(
  "./vpn-package.dto"
)

// Prisma-model shape (hasOpenVpn etc) — used by toVpnServerDTO internally
function makeRawServer(overrides: Record<string, unknown> = {}) {
  return {
    id: "srv-1",
    name: "Singapore-01",
    hostname: "sg-01.vpn.example.com",
    ipAddress: "10.0.0.1",
    sshPort: 22,
    sshUser: "vpnadmin",
    isActive: true,
    health: "HEALTHY" as const,
    hasOpenVpn: true,
    openVpnPort: 1194,
    hasWireGuard: false,
    wireGuardPort: null,
    hasProxy: false,
    proxyPort: null,
    region: {
      id: "reg-sg",
      name: "Singapore",
      slug: "sg",
      countryCode: "SG",
    },
    sshKey: {
      id: "key-1",
      name: "prod-ssh-key",
      fingerprint: "SHA256:abc123",
    },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  }
}

// DTO shape — used directly by serverProtocolLabels
function makeServerDTO(overrides: Record<string, unknown> = {}) {
  return {
    id: "srv-1",
    name: "Singapore-01",
    hostname: "sg-01.vpn.example.com",
    ipAddress: "10.0.0.1",
    sshPort: 22,
    sshUser: "vpnadmin",
    isActive: true,
    health: "HEALTHY" as const,
    region: { id: "reg-sg", name: "Singapore", slug: "sg", countryCode: "SG" },
    sshKey: { id: "key-1", name: "prod-ssh-key", fingerprint: "SHA256:abc123" },
    protocols: {
      openVpn: { enabled: true, port: 1194 },
      wireGuard: { enabled: false, port: null },
      proxy: { enabled: false, port: null },
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  }
}

function makePackage(overrides: Record<string, unknown> = {}) {
  return {
    id: "pkg-1",
    name: "Business VPN",
    description: "For teams",
    currency: "USD",
    isActive: true,
    price: { toString: () => "29.99" },
    servers: [
      {
        id: "ps-1",
        server: makeRawServer(),
      },
    ],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  }
}

// ── serverProtocolLabels ────────────────────────────────────────────

describe("serverProtocolLabels", () => {
  it("returns OpenVPN label when only OpenVPN enabled", () => {
    const labels = serverProtocolLabels(makeServerDTO() as any)
    expect(labels).toEqual(["OpenVPN"])
  })

  it("returns multiple labels when multiple protocols enabled", () => {
    const labels = serverProtocolLabels(
      makeServerDTO({
        protocols: {
          openVpn: { enabled: true, port: 1194 },
          wireGuard: { enabled: true, port: 51820 },
          proxy: { enabled: true, port: 3128 },
        },
      }) as any
    )
    expect(labels).toEqual(["OpenVPN", "WireGuard", "Proxy"])
  })

  it("returns empty array when no protocols enabled", () => {
    const labels = serverProtocolLabels(
      makeServerDTO({
        protocols: {
          openVpn: { enabled: false, port: null },
          wireGuard: { enabled: false, port: null },
          proxy: { enabled: false, port: null },
        },
      }) as any
    )
    expect(labels).toEqual([])
  })
})

// ── toVpnPackageDTO ──────────────────────────────────────────────────

describe("toVpnPackageDTO", () => {
  it("maps package with servers to DTO", () => {
    const dto = toVpnPackageDTO(makePackage() as any)

    expect(dto.id).toBe("pkg-1")
    expect(dto.name).toBe("Business VPN")
    expect(dto.description).toBe("For teams")
    expect(dto.currency).toBe("USD")
    expect(dto.isActive).toBe(true)
    expect(dto.price).toBe("29.99")
    expect(dto.serverCount).toBe(1)
  })

  it("includes server details with protocol labels", () => {
    const dto = toVpnPackageDTO(makePackage() as any)

    expect(dto.servers).toHaveLength(1)
    const server = dto.servers[0]
    expect(server.id).toBe("ps-1")
    expect(server.server.name).toBe("Singapore-01")
    expect(server.protocols).toContain("OpenVPN")
  })

  it("serializes dates as ISO strings", () => {
    const dto = toVpnPackageDTO(makePackage() as any)

    expect(dto.createdAt).toBe("2026-01-01T00:00:00.000Z")
    expect(dto.updatedAt).toBe("2026-06-01T00:00:00.000Z")
  })

  it("handles multiple servers", () => {
    const pkg = makePackage({
      servers: [
        { id: "ps-1", server: makeRawServer({ id: "srv-1" }) },
        { id: "ps-2", server: makeRawServer({ id: "srv-2", hasWireGuard: true }) },
      ],
    })

    const dto = toVpnPackageDTO(pkg as any)

    expect(dto.serverCount).toBe(2)
    expect(dto.servers[1].protocols).toContain("WireGuard")
  })
})
