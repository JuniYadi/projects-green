import { z } from "zod"

const portSchema = z
  .number({ message: "Port must be a number." })
  .int("Port must be an integer.")
  .min(1, "Port must be between 1 and 65535.")
  .max(65535, "Port must be between 1 and 65535.")

export const DEFAULT_OPENVPN_PORT = 1194
export const DEFAULT_WIREGUARD_PORT = 51820
export const DEFAULT_PROXY_PORT = 3128

const baseServerShape = {
  name: z
    .string()
    .trim()
    .min(2, "Server name must be at least 2 characters.")
    .max(60, "Server name must be at most 60 characters."),
  regionId: z.string().trim().min(1, "Region is required."),
  hostname: z
    .string()
    .trim()
    .min(3, "Hostname is required.")
    .max(253, "Hostname must be at most 253 characters."),
  sshKeyId: z.string().trim().min(1, "SSH key is required."),
  sshUser: z
    .string()
    .trim()
    .min(1, "SSH user is required.")
    .max(32, "SSH user must be at most 32 characters.")
    .default("root"),
  openVpnPort: portSchema.optional(),
  wireGuardPort: portSchema.optional(),
  proxyPort: portSchema.optional(),
  isActive: z.boolean().optional().default(true),
}

/**
 * Enforce cross-field server constraints:
 * - at least one protocol port provided
 * - no duplicate port across enabled protocols
 * - WireGuard and Proxy cannot both be enabled on the same server
 */
function refineServer<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .superRefine((raw, ctx) => {
      const value = raw as Record<string, unknown>
      const openVpn = value.openVpnPort as number | undefined
      const wireGuard = value.wireGuardPort as number | undefined
      const proxy = value.proxyPort as number | undefined

      const enabled = [openVpn, wireGuard, proxy].filter(
        (p): p is number => typeof p === "number"
      )

      if (enabled.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one protocol port is required.",
          path: ["openVpnPort"],
        })
        return
      }

      const seen = new Set<number>()
      for (const port of enabled) {
        if (seen.has(port)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Protocol ports must be unique on the same server.",
            path: ["openVpnPort"],
          })
          break
        }
        seen.add(port)
      }

      if (typeof wireGuard === "number" && typeof proxy === "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "WireGuard and Proxy cannot be enabled on the same server.",
          path: ["wireGuardPort"],
        })
      }
    })
}

export const createVpnServerSchema = refineServer(z.object(baseServerShape))

export const updateVpnServerSchema = refineServer(
  z.object({
    ...baseServerShape,
    sshUser: baseServerShape.sshUser,
    isActive: baseServerShape.isActive,
  })
)

export type CreateVpnServerInput = z.infer<typeof createVpnServerSchema>
export type UpdateVpnServerInput = z.infer<typeof updateVpnServerSchema>
