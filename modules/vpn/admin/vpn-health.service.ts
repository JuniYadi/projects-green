import type { Prisma, PrismaClient, VpnServerHealth } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"

import {
  scanVpnServerConnection,
  type ScanResult,
  type VpnServerScanner,
} from "./vpn-connection-scanner"

const HEALTH_CHECK_INTERVAL_MS = 15 * 60 * 1000
const BATCH_SIZE = 50

const serverInclude = {
  region: { select: { id: true, name: true, slug: true, countryCode: true } },
  sshKey: { select: { id: true, name: true, fingerprint: true } },
} satisfies Prisma.VpnServerInclude

type VpnServerForHealth = Prisma.VpnServerGetPayload<{
  include: typeof serverInclude
}>

type PrismaLike = Pick<PrismaClient, "vpnServer">

export type VpnHealthCheckResult = {
  checked: number
  updated: number
  errors: number
}

export function deriveVpnServerHealth(scan: ScanResult): VpnServerHealth {
  const ssh = scan.results.find((result) => result.check === "ssh")
  if (!ssh || ssh.status === "fail" || ssh.status === "error") {
    return "DOWN"
  }

  const hasProblem = scan.results.some(
    (result) => result.status === "fail" || result.status === "error"
  )

  return hasProblem ? "WARNING" : "HEALTHY"
}

export class VpnHealthService {
  constructor(
    private readonly prisma: PrismaLike = defaultPrisma,
    private readonly scanner: VpnServerScanner = scanVpnServerConnection
  ) {}

  async checkServer(server: VpnServerForHealth): Promise<ScanResult> {
    const scan = await this.scanner(server)
    const health = deriveVpnServerHealth(scan)

    await this.prisma.vpnServer.update({
      where: { id: server.id },
      data: { health },
    })

    return scan
  }

  async checkServerById(id: string): Promise<ScanResult> {
    const server = await this.prisma.vpnServer.findUnique({
      where: { id },
      include: serverInclude,
    })
    if (!server) throw new Error("Server not found.")
    return this.checkServer(server)
  }

  async checkAllActive(): Promise<VpnHealthCheckResult> {
    const result: VpnHealthCheckResult = { checked: 0, updated: 0, errors: 0 }
    let cursor: string | undefined

    while (true) {
      const servers = await this.prisma.vpnServer.findMany({
        where: { isActive: true },
        include: serverInclude,
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })

      if (servers.length === 0) break

      for (const server of servers) {
        result.checked++
        try {
          await this.checkServer(server)
          result.updated++
        } catch (error) {
          result.errors++
          console.error(`[vpn-health] server=${server.id} failed:`, error)
          await this.prisma.vpnServer
            .update({ where: { id: server.id }, data: { health: "DOWN" } })
            .catch(() => {})
        }
      }

      cursor = servers[servers.length - 1].id
    }

    return result
  }

  start(): ReturnType<typeof setInterval> {
    const run = async () => {
      try {
        const result = await this.checkAllActive()
        console.info(
          `[vpn-health] checked=${result.checked} updated=${result.updated} errors=${result.errors}`
        )
      } catch (error) {
        console.error("[vpn-health] cycle failed:", error)
      }
    }

    void run()
    return setInterval(run, HEALTH_CHECK_INTERVAL_MS)
  }
}

export const vpnHealthService = new VpnHealthService()
