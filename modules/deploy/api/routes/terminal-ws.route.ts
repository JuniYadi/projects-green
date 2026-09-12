import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import type { WorkOSScope } from "@/lib/auth/types"
import { formatTenantNamespace } from "@/modules/deploy/prometheus-telemetry.service"
import {
  buildKubeExecUrl,
  decodeKubeFrame,
  encodeKubeFrame,
  encodeResizeFrame,
  KUBE_EXEC_CHANNELS,
  listStackExecTargets,
  pickExecTarget,
  resolveStackExecCredentials,
} from "@/modules/deploy/pod-exec.service"

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false

  const allowedOrigins = new Set<string>()

  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, "")
  if (appUrl) allowedOrigins.add(appUrl)

  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(
    /\/+$/,
    ""
  )
  if (publicAppUrl) allowedOrigins.add(publicAppUrl)

  // Default production domain
  allowedOrigins.add("https://pfnapp.my.id")
  allowedOrigins.add("https://pfnapp.id")

  // Development origins
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.add("http://localhost:3000")
    allowedOrigins.add("http://localhost:3300")
    allowedOrigins.add("http://localhost:3301")
    allowedOrigins.add("http://127.0.0.1:3000")
    allowedOrigins.add("http://127.0.0.1:3300")
    allowedOrigins.add("http://127.0.0.1:3301")
  }

  const normalized = origin.trim().replace(/\/+$/, "")
  return allowedOrigins.has(normalized)
}

// ponytail: any member of the stack's org may open a shell (super_admin
// anywhere). Ceiling: no role gate, so a read-only member gets a shell too.
// Upgrade path: also require auth.orgRole to be "owner" or "admin" here.
export function canOpenTerminal(
  auth: WorkOSScope,
  stack: { organizationId: string }
): boolean {
  if (auth.platformRole === "super_admin") return true
  return stack.organizationId === auth.organizationId
}

export type WsClientContext = {
  terminalState?: { clientClosed: boolean }
  kubeWs?: WebSocket
}

export function handleWsMessage(ws: WsClientContext, message: unknown): void {
  const kubeWs = ws.kubeWs
  if (!kubeWs || kubeWs.readyState !== WebSocket.OPEN) return

  try {
    const payload =
      typeof message === "string"
        ? (JSON.parse(message) as Record<string, unknown>)
        : (message as Record<string, unknown>)
    if (payload.type === "stdin" && typeof payload.data === "string") {
      const frame = encodeKubeFrame(KUBE_EXEC_CHANNELS.STDIN, payload.data)
      kubeWs.send(frame)
    } else if (payload.type === "resize") {
      const cols = Number(payload.cols) || 80
      const rows = Number(payload.rows) || 24
      const frame = encodeResizeFrame(cols, rows)
      kubeWs.send(frame)
    }
  } catch {
    if (typeof message === "string") {
      kubeWs.send(encodeKubeFrame(KUBE_EXEC_CHANNELS.STDIN, message))
    }
  }
}

export function handleWsClose(ws: WsClientContext): void {
  if (ws.terminalState) {
    ws.terminalState.clientClosed = true
  }
  const kubeWs = ws.kubeWs
  if (kubeWs && kubeWs.readyState === WebSocket.OPEN) {
    kubeWs.close(1000, "Client closed terminal")
  }
}

export type TerminalWsClient = {
  data: {
    params: { stackId: string }
    query: { pod?: string; container?: string }
    headers?: Record<string, string>
    request?: Request
  }
  send: (msg: string) => void
  close: (code?: number, reason?: string) => void
  terminalState?: { clientClosed: boolean }
  kubeWs?: WebSocket
}

export async function executeTerminalSession(
  ws: TerminalWsClient,
  state: { clientClosed: boolean }
): Promise<void> {
  try {
    const { stackId } = ws.data.params
    const { pod, container } = ws.data.query

    // 1. Strict Origin Validation
    const origin =
      ws.data.headers?.origin || ws.data.request?.headers?.get("origin") || null
    if (!isAllowedOrigin(origin)) {
      if (!state.clientClosed) {
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Forbidden: Invalid origin",
          })
        )
        ws.close(1008, "Invalid origin")
      }
      return
    }

    // 2. Validate session via WorkOS SDK
    const request = ws.data.request
    const auth = request ? await resolveAuthContext(request) : null
    if (!auth || auth.type !== "workos") {
      if (!state.clientClosed) {
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Unauthorized: Valid WorkOS session required",
          })
        )
        ws.close(1008, "Unauthorized")
      }
      return
    }

    // 3. Tenancy check via Prisma
    const stack = await prisma.applicationStack.findUnique({
      where: { id: stackId },
      select: { id: true, organizationId: true, slug: true },
    })

    if (!stack) {
      if (!state.clientClosed) {
        ws.send(JSON.stringify({ type: "error", error: "Stack not found" }))
        ws.close(1008, "Stack not found")
      }
      return
    }

    if (!canOpenTerminal(auth, stack)) {
      if (!state.clientClosed) {
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Forbidden: Stack does not belong to your organization",
          })
        )
        ws.close(1008, "Forbidden")
      }
      return
    }

    if (state.clientClosed) return

    // Tenant namespaces are derived from the organization id (org_X -> app-x),
    // the same rule telemetry and pod status use. Deriving from the slug
    // targeted a namespace that never exists.
    const namespace = formatTenantNamespace(stack.organizationId)
    const creds = await resolveStackExecCredentials(stackId)

    // The pod list comes from the app's label selector, never from the
    // client: `pod`/`container` are only accepted if they are in this list.
    const targets = await listStackExecTargets({
      namespace,
      slug: stack.slug,
      creds,
    })
    if (state.clientClosed) return

    if (targets.length === 0) {
      ws.send(
        JSON.stringify({
          type: "error",
          code: "NO_RUNNING_POD",
          error: "No running pod for this app",
        })
      )
      ws.close(1008, "No running pod")
      return
    }

    const selected = pickExecTarget(targets, pod, container)
    if ("error" in selected) {
      ws.send(JSON.stringify({ type: "error", error: selected.error }))
      ws.close(1008, "Invalid terminal target")
      return
    }

    ws.send(JSON.stringify({ type: "targets", targets, selected }))

    const execUrl = buildKubeExecUrl(
      creds.url,
      namespace,
      selected.pod,
      selected.container,
      ["/bin/sh"]
    )

    const kubeWs = new (
      WebSocket as unknown as new (
        url: string,
        protocols: string[],
        options?: Record<string, unknown>
      ) => WebSocket
    )(execUrl, ["v4.channel.k8s.io"], {
      headers: {
        Authorization: `Bearer ${creds.token}`,
      },
      tls: creds.caCert ? { ca: [creds.caCert] } : undefined,
    })

    kubeWs.binaryType = "arraybuffer"

    if (state.clientClosed) {
      kubeWs.close(1000, "Client already disconnected")
      return
    }

    kubeWs.onopen = () => {
      if (state.clientClosed) {
        kubeWs.close(1000, "Client already disconnected")
        return
      }
      ws.send(JSON.stringify({ type: "status", status: "connected" }))
    }

    kubeWs.onmessage = (event) => {
      if (state.clientClosed) return
      if (event.data instanceof ArrayBuffer) {
        const { channel, data } = decodeKubeFrame(event.data)
        if (
          channel === KUBE_EXEC_CHANNELS.STDOUT ||
          channel === KUBE_EXEC_CHANNELS.STDERR
        ) {
          ws.send(JSON.stringify({ type: "stdout", data }))
        } else if (channel === KUBE_EXEC_CHANNELS.ERROR) {
          ws.send(JSON.stringify({ type: "error", data }))
        }
      }
    }

    kubeWs.onclose = (event) => {
      if (!state.clientClosed) {
        ws.send(
          JSON.stringify({
            type: "status",
            status: "disconnected",
            code: event.code,
          })
        )
        ws.close(1000, "Kubernetes process exited")
      }
    }

    const handleWsError = () => {
      if (!state.clientClosed) {
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Kubernetes exec connection failed",
          })
        )
        ws.close(1011, "Exec error")
      }
    }

    kubeWs.onerror = handleWsError
    if ("on" in kubeWs && typeof kubeWs.on === "function") {
      kubeWs.on("error", handleWsError)
    }

    ws.kubeWs = kubeWs
  } catch (error) {
    if (!state.clientClosed) {
      const message =
        error instanceof Error ? error.message : "Failed to initialize terminal"
      ws.send(JSON.stringify({ type: "error", error: message }))
      ws.close(1011, message)
    }
  }
}

export const terminalWsRoute = new Elysia({ prefix: "/ws/deploy" }).ws(
  "/stacks/:stackId/terminal",
  {
    params: t.Object({
      stackId: t.String(),
    }),
    query: t.Object({
      pod: t.Optional(t.String()),
      container: t.Optional(t.String()),
    }),
    open(ws) {
      const state = { clientClosed: false }
      ;(ws as unknown as Record<string, unknown>).terminalState = state
      void executeTerminalSession(ws as unknown as TerminalWsClient, state)
    },
    message(ws, message) {
      handleWsMessage(ws as unknown as WsClientContext, message)
    },
    close(ws) {
      handleWsClose(ws as unknown as WsClientContext)
    },
  }
)
