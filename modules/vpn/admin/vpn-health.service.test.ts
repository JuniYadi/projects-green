import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import type {
  ScanCheckResult,
  ScanResult,
  VpnServerScanner,
} from "./vpn-connection-scanner"
import type { VpnHealthService as VpnHealthServiceType } from "./vpn-health.service"

const findUnique = mock()
const findMany = mock()
const update = mock()
const scanner = mock<VpnServerScanner>()

const emitServerFailed = mock()
const emitCycleCompleted = mock()
const emitCycleFailed = mock()

const prismaMock = {
  vpnServer: { findUnique, findMany, update },
} as unknown as ConstructorParameters<typeof VpnHealthServiceType>[0]

mock.module("@/lib/prisma", () => ({ prisma: prismaMock }))
mock.module("@/lib/worker-health-logging", () => ({
  emitVpnHealthServerFailed: emitServerFailed,
  emitVpnHealthCycleCompleted: emitCycleCompleted,
  emitVpnHealthCycleFailed: emitCycleFailed,
}))

// Import after module mocks so the default infrastructure is never initialized.
const { VpnHealthService, deriveVpnServerHealth } =
  await import("./vpn-health.service")

type Server = Parameters<VpnHealthServiceType["checkServer"]>[0]
type HealthStatus = ScanCheckResult["status"] | "ok"

type CheckInput = {
  check: ScanCheckResult["check"]
  status: HealthStatus
}

const makeScan = (...checks: CheckInput[]): ScanResult => ({
  status: "completed",
  startedAt: "2026-01-01T00:00:00.000Z",
  completedAt: "2026-01-01T00:00:01.000Z",
  results: checks.map(({ check, status }) => ({
    check,
    label: check,
    status: status as unknown as ScanCheckResult["status"],
    protocol: check,
    host: null,
    port: null,
    transport: null,
    latencyMs: null,
    message: "",
    timestamp: "2026-01-01T00:00:00.000Z",
  })),
  summary: {
    total: checks.length,
    passed: checks.filter(({ status }) => status === "pass" || status === "ok")
      .length,
    failed: checks.filter(({ status }) => status === "fail").length,
    errors: checks.filter(({ status }) => status === "error").length,
    skipped: checks.filter(({ status }) => status === "skip").length,
  },
})

const makeServer = (id: string): Server =>
  ({
    id,
    hostname: `${id}.example.com`,
    ipAddress: null,
    isActive: true,
  }) as unknown as Server

const healthyScan = makeScan(
  { check: "ssh", status: "pass" },
  { check: "openvpn", status: "pass" }
)

beforeEach(() => {
  findUnique.mockReset()
  findMany.mockReset()
  update.mockReset()
  scanner.mockReset()
  emitServerFailed.mockClear()
  emitCycleCompleted.mockClear()
  emitCycleFailed.mockClear()

  findUnique.mockResolvedValue(null)
  findMany.mockResolvedValue([])
  update.mockResolvedValue({})
  scanner.mockResolvedValue(healthyScan)
})

describe("deriveVpnServerHealth", () => {
  it("returns DOWN when the SSH check is missing", () => {
    expect(
      deriveVpnServerHealth(makeScan({ check: "openvpn", status: "pass" }))
    ).toBe("DOWN")
  })

  it("returns DOWN when the SSH check fails or errors", () => {
    for (const status of ["fail", "error"] as const) {
      expect(deriveVpnServerHealth(makeScan({ check: "ssh", status }))).toBe(
        "DOWN"
      )
    }
  })

  it("returns WARNING when SSH passes but another check fails or errors", () => {
    for (const status of ["fail", "error"] as const) {
      expect(
        deriveVpnServerHealth(
          makeScan(
            { check: "ssh", status: "pass" },
            { check: "openvpn", status }
          )
        )
      ).toBe("WARNING")
    }
  })

  it("returns HEALTHY when every check passes or is ok", () => {
    for (const status of ["pass", "ok"] as const) {
      expect(
        deriveVpnServerHealth(
          makeScan({ check: "ssh", status }, { check: "openvpn", status })
        )
      ).toBe("HEALTHY")
    }
  })
})

describe("VpnHealthService.checkServer", () => {
  it("scans the server, updates its derived health, and returns the scan", async () => {
    const server = makeServer("server-1")
    const scan = makeScan(
      { check: "ssh", status: "pass" },
      { check: "openvpn", status: "error" }
    )
    scanner.mockResolvedValue(scan)

    const result = await new VpnHealthService(prismaMock, scanner).checkServer(
      server
    )

    expect(scanner).toHaveBeenCalledWith(server)
    expect(update).toHaveBeenCalledWith({
      where: { id: server.id },
      data: { health: "WARNING" },
    })
    expect(result).toBe(scan)
  })
})

describe("VpnHealthService.checkServerById", () => {
  it("loads a server with its health-check relations and scans it", async () => {
    const server = makeServer("server-1")
    findUnique.mockResolvedValue(server)
    const scan = makeScan({ check: "ssh", status: "pass" })
    scanner.mockResolvedValue(scan)

    const result = await new VpnHealthService(
      prismaMock,
      scanner
    ).checkServerById(server.id)

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: server.id },
      include: {
        region: {
          select: { id: true, name: true, slug: true, countryCode: true },
        },
        sshKey: { select: { id: true, name: true, fingerprint: true } },
      },
    })
    expect(scanner).toHaveBeenCalledWith(server)
    expect(result).toBe(scan)
  })

  it("throws when no server exists for the requested id", async () => {
    const service = new VpnHealthService(prismaMock, scanner)

    await expect(service.checkServerById("missing")).rejects.toThrow(
      "Server not found."
    )
    expect(scanner).not.toHaveBeenCalled()
  })
})

describe("VpnHealthService.checkAllActive", () => {
  it("checks active servers in batches using cursor pagination", async () => {
    const firstBatch = Array.from({ length: 50 }, (_, index) =>
      makeServer(`server-${String(index).padStart(2, "0")}`)
    )
    const secondBatch = [makeServer("server-50")]
    findMany
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce(secondBatch)
      .mockResolvedValueOnce([])

    const result = await new VpnHealthService(
      prismaMock,
      scanner
    ).checkAllActive()

    expect(result).toEqual({ checked: 51, updated: 51, errors: 0 })
    expect(findMany).toHaveBeenCalledTimes(3)

    const firstArgs = findMany.mock.calls[0]?.[0]
    expect(firstArgs).toEqual(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: { id: "asc" },
        take: 50,
      })
    )
    expect(firstArgs).not.toHaveProperty("cursor")

    expect(findMany.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: { id: "asc" },
        take: 50,
        skip: 1,
        cursor: { id: firstBatch[firstBatch.length - 1]?.id },
      })
    )
    expect(update).toHaveBeenCalledTimes(51)
  })

  it("records failures, emits an event, and marks failed servers DOWN", async () => {
    const failed = new Error("scanner unavailable")
    const okServer = makeServer("server-ok")
    const failedServer = makeServer("server-failed")
    findMany
      .mockResolvedValueOnce([okServer, failedServer])
      .mockResolvedValueOnce([])
    scanner.mockImplementation(async (server) => {
      if (server.id === failedServer.id) throw failed
      return healthyScan
    })

    const result = await new VpnHealthService(
      prismaMock,
      scanner
    ).checkAllActive()

    expect(result).toEqual({ checked: 2, updated: 1, errors: 1 })
    expect(emitServerFailed).toHaveBeenCalledWith(failed)
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: failedServer.id },
      data: { health: "DOWN" },
    })
  })
})

describe("VpnHealthService.start", () => {
  it("returns an interval handle and emits completion for the initial cycle", async () => {
    const result = { checked: 2, updated: 2, errors: 0 }
    const service = new VpnHealthService(prismaMock, scanner)
    const checkAllActive = spyOn(service, "checkAllActive").mockResolvedValue(
      result
    )
    const interval = service.start()
    await Promise.resolve()
    clearInterval(interval)

    expect(interval).toBeDefined()
    expect(checkAllActive).toHaveBeenCalledTimes(1)
    expect(emitCycleCompleted).toHaveBeenCalledWith(result)
    expect(emitCycleFailed).not.toHaveBeenCalled()
  })

  it("emits cycle failure when the initial health check throws", async () => {
    const failure = new Error("database unavailable")
    const service = new VpnHealthService(prismaMock, scanner)
    const checkAllActive = spyOn(service, "checkAllActive").mockRejectedValue(
      failure
    )
    const interval = service.start()
    await Promise.resolve()
    clearInterval(interval)

    expect(checkAllActive).toHaveBeenCalledTimes(1)
    expect(emitCycleFailed).toHaveBeenCalledWith(failure)
    expect(emitCycleCompleted).not.toHaveBeenCalled()
  })
})
