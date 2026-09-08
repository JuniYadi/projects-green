import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import {
  buildKubeExecUrl,
  decodeKubeFrame,
  encodeKubeFrame,
  encodeResizeFrame,
  KUBE_EXEC_CHANNELS,
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

export const terminalWsRoute = new Elysia({ prefix: "/ws/deploy" }).ws(
  "/stacks/:stackId/terminal",
  {
    params: t.Object({
      stackId: t.String(),
    }),
    query: t.Object({
      pod: t.String(),
      container: t.Optional(t.String()),
    }),
    open(ws) {
      const { stackId } = ws.data.params
      const { pod, container } = ws.data.query

      const state = { clientClosed: false }
      ;(ws as unknown as Record<string, unknown>).terminalState = state

      void (async () => {
        try {
          // 1. Strict Origin Validation (Block Cross-Site WebSocket Hijacking / CSWSH)
          const origin =
            ws.data.headers?.origin || ws.data.request?.headers?.get("origin")
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
              ws.send(
                JSON.stringify({ type: "error", error: "Stack not found" })
              )
              ws.close(1008, "Stack not found")
            }
            return
          }

          // Platform super admin can inspect any stack, regular users only their own org
          const isSuperAdmin = auth.platformRole === "super_admin"
          if (!isSuperAdmin && stack.organizationId !== auth.organizationId) {
            if (!state.clientClosed) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  error:
                    "Forbidden: Stack does not belong to your organization",
                })
              )
              ws.close(1008, "Forbidden")
            }
            return
          }

          if (state.clientClosed) return

          const namespace = `app-${stack.slug}`
          const creds = await resolveStackExecCredentials(stackId)
          const execUrl = buildKubeExecUrl(
            creds.url,
            namespace,
            pod,
            container,
            ["/bin/sh"]
          )

          // Connect to Kubernetes APIServer exec subprotocol
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

          // Guard: if client already disconnected while waiting for async setup, close immediately
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

          kubeWs.onerror = () => {
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

          // Attach kubeWs to ws context
          ;(ws as unknown as Record<string, unknown>).kubeWs = kubeWs
        } catch (error) {
          if (!state.clientClosed) {
            const message =
              error instanceof Error
                ? error.message
                : "Failed to initialize terminal"
            ws.send(JSON.stringify({ type: "error", error: message }))
            ws.close(1011, message)
          }
        }
      })()
    },
    message(ws, message) {
      const kubeWs = (ws as unknown as Record<string, WebSocket | undefined>)
        .kubeWs
      if (!kubeWs || kubeWs.readyState !== WebSocket.OPEN) return

      try {
        const payload =
          typeof message === "string"
            ? JSON.parse(message)
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
    },
    close(ws) {
      const state = (
        ws as unknown as Record<string, { clientClosed: boolean } | undefined>
      ).terminalState
      if (state) {
        state.clientClosed = true
      }
      const kubeWs = (ws as unknown as Record<string, WebSocket | undefined>)
        .kubeWs
      if (kubeWs && kubeWs.readyState === WebSocket.OPEN) {
        kubeWs.close(1000, "Client closed terminal")
      }
    },
  }
)
