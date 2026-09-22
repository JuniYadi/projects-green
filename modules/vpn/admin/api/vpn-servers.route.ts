import { Elysia } from "elysia"

import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"

import {
  createVpnServerSchema,
  updateVpnServerSchema,
} from "../vpn-server.schema"
import { toVpnServerDTO, type WireGuardSessionDTO } from "../vpn-server.dto"
import {
  VpnServerConflictError,
  VpnServerNotFoundError,
  VpnServerReferenceError,
  vpnServerService,
  type VpnServerService,
} from "../vpn-server.service"
import { prisma } from "@/lib/prisma"
import { OpenVpnSshAdapter } from "@/modules/vpn/openvpn/openvpn-ssh-adapter"
import {
  VpnServerSshExecutor,
  type SshTarget,
} from "@/modules/vpn/provisioning/vpn-server-ssh-executor"

import { vpnHealthService } from "../vpn-health.service"
import type { VpnServerScanner } from "../vpn-connection-scanner"
import { VpnServerSyncJob } from "@/lib/queue/vpn-server-sync"
import { logAuditEvent } from "@/lib/audit.service"

type Deps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  service?: VpnServerService
  scanConnection?: VpnServerScanner
  /** Injectable clock for rate-limit testing. */
  now?: () => number
}

/** Min interval between connection tests for the same server. */
export const TEST_RATE_LIMIT_MS = 30_000

export const createAdminVpnServersRoutes = (deps: Deps = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const service = deps.service ?? vpnServerService
  const now = deps.now ?? Date.now
  const lastTestAt = new Map<string, number>()

  return new Elysia()
    .get("/admin/vpn/wireguard-sessions", async ({ set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      const servers = await prisma.vpnServer.findMany({
        where: { isActive: true },
        include: { sshKey: { select: { privateKey: true } } },
        orderBy: { name: "asc" },
      })
      const executor = new VpnServerSshExecutor()
      const openVpn = new OpenVpnSshAdapter()
      const serverSessions = await Promise.all(
        servers.map(async (server) => {
          const target = toSshTarget(server)
          const sessions: WireGuardSessionDTO[] = []

          if (server.hasWireGuard) {
            const result = await execWireGuardList(executor, target)
            if (result.exitCode === 0) {
              sessions.push(
                ...parseWireGuardList(result.stdout)
                  .filter((item) => item.status === "Online")
                  .map((item) => ({
                    ...item,
                    protocol: "WIREGUARD" as const,
                    serverId: server.id,
                    serverName: server.name,
                  }))
              )
            }
          }

          if (server.hasOpenVpn) {
            try {
              const users = await openVpn.listClients(target)
              sessions.push(
                ...users
                  .filter((user) => user.connected)
                  .map((user) => ({
                    protocol: "OPENVPN" as const,
                    serverId: server.id,
                    serverName: server.name,
                    username: user.clientName,
                    ip: user.virtualAddress ?? user.ipAllocation ?? "-",
                    endpoint: user.realAddress ?? null,
                    status: "Online" as const,
                    handshake: user.connectedSince ?? "-",
                    rx: formatSessionBytes(user.bytesReceived),
                    tx: formatSessionBytes(user.bytesSent),
                  }))
              )
            } catch {
              // A failing protocol must not hide sessions from other servers.
            }
          }

          return sessions
        })
      )

      return { ok: true, data: serverSessions.flat() }
    })
    .get("/admin/vpn/servers", async ({ query, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      const regionId =
        typeof query.regionId === "string" && query.regionId.length > 0
          ? query.regionId
          : undefined
      const search =
        typeof query.search === "string" && query.search.length > 0
          ? query.search
          : undefined
      const servers = await service.list({ regionId, search })
      return { ok: true, data: servers.map(toVpnServerDTO) }
    })
    .post(
      "/admin/vpn/servers",
      async ({ body, set, request, path }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          const server = await service.create(body)
          set.status = 201
          return { ok: true, data: toVpnServerDTO(server) }
        } catch (error) {
          return toServerError(set, error, {
            method: request.method,
            path,
          })
        }
      },
      { body: createVpnServerSchema }
    )
    .put(
      "/admin/vpn/servers/:id",
      async ({ params, body, set, request, path }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          const server = await service.update(params.id, body)
          return { ok: true, data: toVpnServerDTO(server) }
        } catch (error) {
          return toServerError(set, error, {
            method: request.method,
            path,
          })
        }
      },
      { body: updateVpnServerSchema }
    )
    .delete(
      "/admin/vpn/servers/:id",
      async ({ params, set, request, path }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          await service.remove(params.id)
          return { ok: true }
        } catch (error) {
          return toServerError(set, error, {
            method: request.method,
            path,
          })
        }
      }
    )
    .get("/admin/vpn/servers/:id", async ({ params, set, request, path }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      try {
        const server = await service.getById(params.id)
        return { ok: true, data: toVpnServerDTO(server) }
      } catch (error) {
        return toServerError(set, error, {
          method: request.method,
          path,
        })
      }
    })
    .get("/admin/vpn/servers/:id/metrics", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      const server = await prisma.vpnServer.findUnique({
        where: { id: params.id },
        include: { sshKey: { select: { privateKey: true } } },
      })
      if (!server) return toServerError(set, new VpnServerNotFoundError())

      const target = toSshTarget(server)
      const executor = new VpnServerSshExecutor()
      const [
        uptime,
        daily,
        monthly,
        topCpu,
        topMemory,
        cpuSummary,
        memorySummary,
      ] = await Promise.all([
        execText(executor, target, ["uptime", "-p"]),
        execJson(executor, target, ["vnstat", "-d", "--json"]),
        execJson(executor, target, ["vnstat", "-m", "--json"]),
        execText(executor, target, [
          "bash",
          "-lc",
          "'ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head -n 6'",
        ]),
        execText(executor, target, [
          "bash",
          "-lc",
          "'ps -eo pid,comm,%cpu,%mem --sort=-%mem | head -n 6'",
        ]),
        execText(executor, target, [
          "bash",
          "-lc",
          "'nproc; head -n 1 /proc/stat'",
        ]),
        execText(executor, target, ["free", "-b"]),
      ])

      const monthlyTraffic = parseVnstatTraffic(monthly, "month")

      return {
        ok: true,
        data: {
          ports: {
            openVpn: server.hasOpenVpn ? server.openVpnPort : null,
            wireGuard: server.hasWireGuard ? server.wireGuardPort : null,
            proxy: server.hasProxy ? server.proxyPort : null,
          },
          uptime,
          resources: {
            cpu: parseCpuSummary(cpuSummary),
            memory: parseMemorySummary(memorySummary),
            currentMonthBandwidth: monthlyTraffic.at(-1)?.total ?? 0,
          },
          traffic: {
            daily: parseVnstatTraffic(daily, "day"),
            monthly: monthlyTraffic,
          },
          processes: {
            cpu: parseProcessList(topCpu),
            memory: parseProcessList(topMemory),
          },
          collectedAt: new Date().toISOString(),
        },
      }
    })
    .get("/admin/vpn/servers/:id/openvpn-users", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      const server = await prisma.vpnServer.findUnique({
        where: { id: params.id },
        include: { sshKey: { select: { privateKey: true } } },
      })
      if (!server) return toServerError(set, new VpnServerNotFoundError())
      if (!server.hasOpenVpn) {
        return { ok: true, data: [] }
      }

      const target = toSshTarget(server)
      const users = await new OpenVpnSshAdapter().listClients(target)
      return { ok: true, data: users }
    })
    .get(
      "/admin/vpn/servers/:id/wireguard-sessions",
      async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const server = await prisma.vpnServer.findUnique({
          where: { id: params.id },
          include: { sshKey: { select: { privateKey: true } } },
        })
        if (!server) return toServerError(set, new VpnServerNotFoundError())
        if (!server.hasWireGuard) return { ok: true, data: [] }

        const result = await execWireGuardList(
          new VpnServerSshExecutor(),
          toSshTarget(server)
        )
        if (result.exitCode !== 0) {
          set.status = 503
          return {
            ok: false,
            error: "SSH_COMMAND_FAILED",
            message: result.stderr,
          }
        }

        return {
          ok: true,
          data: parseWireGuardList(result.stdout)
            .filter((session) => session.status === "Online")
            .map((session) => ({
              ...session,
              protocol: "WIREGUARD" as const,
              serverId: server.id,
              serverName: server.name,
            })),
        }
      }
    )
    .post("/admin/vpn/servers/:id/sync-protocols", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      const server = await prisma.vpnServer.findUnique({
        where: { id: params.id },
      })
      if (!server) return toServerError(set, new VpnServerNotFoundError())

      await logAuditEvent({
        serverId: params.id,
        action: "SYNC_PROTOCOLS_REQUESTED",
        status: "PENDING",
        message: `Sync protocols requested for server "${server.name}"`,
        details: { serverName: server.name },
      })

      const jobId = `vpn-sync-${params.id}`
      const queued = await VpnServerSyncJob.dispatch(params.id, jobId)

      return { ok: true, queued, correlationId: jobId }
    })
    .post(
      "/admin/vpn/servers/:id/test",
      async ({ params, set, request, path }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const current = now()
        const previous = lastTestAt.get(params.id)
        if (previous !== undefined && current - previous < TEST_RATE_LIMIT_MS) {
          const retryAfterSec = Math.ceil(
            (TEST_RATE_LIMIT_MS - (current - previous)) / 1000
          )
          set.status = 429
          return {
            ok: false,
            error: "RATE_LIMITED",
            message: `Please wait ${retryAfterSec}s before testing this server again.`,
          }
        }

        try {
          const server = await service.getById(params.id)
          lastTestAt.set(params.id, current)
          const result = deps.scanConnection
            ? await deps.scanConnection(server)
            : await vpnHealthService.checkServerById(params.id)
          return { ok: true, data: result }
        } catch (error) {
          return toServerError(set, error, {
            method: request.method,
            path,
          })
        }
      }
    )
}

type ServerWithPrivateKey = {
  hostname: string
  ipAddress: string | null
  sshUser: string
  sshKey: { privateKey: string }
}

type RouteSet = { status?: number | string }

function formatSessionBytes(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return "0 B"
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function parseWireGuardList(stdout: string) {
  const sessions: Omit<
    WireGuardSessionDTO,
    "serverId" | "serverName" | "protocol"
  >[] = []
  let tableStarted = false
  let colIndex = {
    username: 0,
    ip: 1,
    endpoint: -1,
    status: 2,
    handshake: 3,
    rx: 4,
    tx: 5,
  }

  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim()
    if (!line) continue
    if (/^USERNAME\s*\|/i.test(line)) {
      tableStarted = true
      const headers = line.split("|").map((h) => h.trim().toUpperCase())
      const uIdx = headers.findIndex((h) => h.includes("USERNAME"))
      const ipIdx = headers.findIndex((h) => h.includes("IP"))
      const epIdx = headers.findIndex((h) => h.includes("ENDPOINT"))
      const stIdx = headers.findIndex((h) => h.includes("STATUS"))
      const hsIdx = headers.findIndex((h) => h.includes("HANDSHAKE"))
      const rxIdx = headers.findIndex((h) => h === "RX" || h.includes("RX"))
      const txIdx = headers.findIndex((h) => h === "TX" || h.includes("TX"))

      colIndex = {
        username: uIdx >= 0 ? uIdx : 0,
        ip: ipIdx >= 0 ? ipIdx : 1,
        endpoint: epIdx,
        status: stIdx >= 0 ? stIdx : epIdx >= 0 ? 3 : 2,
        handshake: hsIdx >= 0 ? hsIdx : epIdx >= 0 ? 4 : 3,
        rx: rxIdx >= 0 ? rxIdx : epIdx >= 0 ? 5 : 4,
        tx: txIdx >= 0 ? txIdx : epIdx >= 0 ? 6 : 5,
      }
      continue
    }
    if (/^-+$/.test(line)) continue
    if (/^(?:Active|Total):/i.test(line)) break
    if (!tableStarted) continue

    const columns = line.split("|").map((value) => value.trim())
    const minCols = colIndex.endpoint >= 0 ? 7 : 6
    if (
      columns.length < minCols ||
      !columns[colIndex.username] ||
      !columns[colIndex.ip]
    ) {
      continue
    }

    const rawStatus = columns[colIndex.status]?.toLowerCase()
    const status =
      rawStatus === "online"
        ? "Online"
        : rawStatus === "stale"
          ? "Stale"
          : "Offline"

    const rawEndpoint =
      colIndex.endpoint >= 0 ? columns[colIndex.endpoint] : null
    const endpoint = rawEndpoint && rawEndpoint !== "-" ? rawEndpoint : null

    sessions.push({
      username: columns[colIndex.username],
      ip: columns[colIndex.ip],
      endpoint,
      status,
      handshake: columns[colIndex.handshake] ?? "-",
      rx: columns[colIndex.rx] ?? "0B",
      tx: columns[colIndex.tx] ?? "0B",
    })
  }

  return sessions
}

async function execWireGuardList(
  executor: VpnServerSshExecutor,
  target: SshTarget
) {
  const preferred = await executor.exec(target, ["bash", "/root/we-list.sh"])
  if (preferred.exitCode === 0) return preferred

  return executor.exec(target, ["bash", "/root/wg-list.sh"])
}

function toSshTarget(server: ServerWithPrivateKey): SshTarget {
  return {
    host: server.hostname,
    ipAddress: server.ipAddress ?? undefined,
    user: server.sshUser,
    encryptedPrivateKey: server.sshKey.privateKey,
  }
}

async function execText(
  executor: VpnServerSshExecutor,
  target: SshTarget,
  args: string[]
): Promise<string | null> {
  const result = await executor.exec(target, args)
  if (result.exitCode !== 0) return null
  return result.stdout.trim()
}

async function execJson(
  executor: VpnServerSshExecutor,
  target: SshTarget,
  args: string[]
): Promise<unknown | null> {
  const text = await execText(executor, target, args)
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

type VnstatDate = { year?: number; month?: number; day?: number }
type VnstatEntry = {
  date?: VnstatDate
  rx?: number
  tx?: number
  total?: number
}

function parseVnstatTraffic(payload: unknown, bucket: "day" | "month") {
  const interfaces =
    payload && typeof payload === "object" && "interfaces" in payload
      ? (payload.interfaces as Array<{
          traffic?: Record<string, VnstatEntry[]>
        }>)
      : []
  const byLabel = new Map<
    string,
    { label: string; rx: number; tx: number; total: number }
  >()

  for (const iface of interfaces) {
    for (const entry of iface.traffic?.[bucket] ?? []) {
      const label = formatVnstatDate(entry.date, bucket)
      const current = byLabel.get(label) ?? { label, rx: 0, tx: 0, total: 0 }
      current.rx += entry.rx ?? 0
      current.tx += entry.tx ?? 0
      current.total += entry.total ?? (entry.rx ?? 0) + (entry.tx ?? 0)
      byLabel.set(label, current)
    }
  }

  return Array.from(byLabel.values()).slice(-12)
}

function formatVnstatDate(
  date: VnstatDate | undefined,
  bucket: "day" | "month"
) {
  if (!date?.year || !date.month) return "unknown"
  if (bucket === "month")
    return `${date.year}-${String(date.month).padStart(2, "0")}`
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day ?? 1).padStart(2, "0")}`
}

function parseCpuSummary(output: string | null) {
  if (!output) return { usedPercent: null, totalCores: null }
  const [coresLine, statLine] = output.split("\n")
  const totalCores = Number(coresLine)
  const values = statLine?.trim().split(/\s+/).slice(1).map(Number) ?? []
  const total = values.reduce(
    (sum, value) => sum + (Number.isFinite(value) ? value : 0),
    0
  )
  const idle = (values[3] ?? 0) + (values[4] ?? 0)
  const usedPercent =
    total > 0
      ? Math.max(0, Math.min(100, ((total - idle) / total) * 100))
      : null

  return {
    usedPercent,
    totalCores: Number.isFinite(totalCores) ? totalCores : null,
  }
}

function parseMemorySummary(output: string | null) {
  const line = output
    ?.split("\n")
    .find((value) => value.trim().startsWith("Mem:"))
  const parts = line?.trim().split(/\s+/).map(Number) ?? []
  const total = parts[1]
  const used = parts[2]

  return {
    used: Number.isFinite(used) ? used : null,
    total: Number.isFinite(total) ? total : null,
  }
}

function parseProcessList(output: string | null) {
  if (!output) return []
  return output
    .split("\n")
    .slice(1, 6)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 4)
    .map(([pid, command, cpu, memory]) => ({
      pid: Number(pid),
      command,
      cpu: Number(cpu),
      memory: Number(memory),
    }))
}

function toServerError(
  set: RouteSet,
  error: unknown,
  context?: { method: string; path: string }
): AdminApiError {
  if (error instanceof VpnServerNotFoundError) {
    set.status = 404
    return { ok: false, error: "NOT_FOUND", message: error.message }
  }
  if (error instanceof VpnServerReferenceError) {
    set.status = 422
    return { ok: false, error: "INVALID_REFERENCE", message: error.message }
  }
  if (error instanceof VpnServerConflictError) {
    set.status = 409
    return { ok: false, error: "CONFLICT", message: error.message }
  }

  const location = context ? ` on ${context.method} ${context.path}` : ""
  console.error(
    `[admin:vpn:servers] unexpected error${location}:`,
    error instanceof Error ? (error.stack ?? error.message) : String(error)
  )

  const isDev = process.env.NODE_ENV !== "production"
  set.status = 500
  return {
    ok: false,
    error: "INTERNAL_ERROR",
    message: isDev
      ? `Internal error${location}: ${error instanceof Error ? error.message : String(error)}`
      : "Something went wrong while processing the server.",
  }
}
