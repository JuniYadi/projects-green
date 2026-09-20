import type { AppRuntimeManifest } from "@prisma/client"

export type RuntimeTunableDTO = {
  key: string
  label: string
  type: "bytes_string" | "string" | "number" | "select" | "boolean"
  default: string | number | boolean
  category?: string
  description: string
  troubleshooting: string
  relatedKeys?: string[]
  options?: string[]
  presets?: string[]
}

export type RuntimeMatrixEntryDTO = {
  php?: string[]
  node?: string[]
  default?: string
  [key: string]: unknown
}

export type RuntimeManifestDTO = {
  $schema?: string
  runtime: string
  framework: string
  version: string
  supportedFrameworkVersions?: string[]
  runtimeMatrix?: Record<string, RuntimeMatrixEntryDTO>
  baseImage: string
  ports: {
    default: number
    protocol?: string
  }
  security: {
    runAsUser: number
    runAsGroup: number
    readOnlyRoot?: boolean
  }
  probes: {
    liveness: {
      path: string
      port: number
    }
    readiness: {
      path: string
      port: number
    }
  }
  tunables: RuntimeTunableDTO[]
}

export type AppRuntimeManifestRecordDTO = {
  id: string
  frameworkId: string
  version: string
  manifest: RuntimeManifestDTO
  createdAt: string
  updatedAt: string
}

export function toRuntimeManifestDTO(raw: unknown): RuntimeManifestDTO {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >

  const ports = (
    obj.ports && typeof obj.ports === "object" ? obj.ports : {}
  ) as Record<string, unknown>

  const security = (
    obj.security && typeof obj.security === "object" ? obj.security : {}
  ) as Record<string, unknown>

  const probes = (
    obj.probes && typeof obj.probes === "object" ? obj.probes : {}
  ) as Record<string, unknown>

  const liveness = (
    probes.liveness && typeof probes.liveness === "object"
      ? probes.liveness
      : {}
  ) as Record<string, unknown>

  const readiness = (
    probes.readiness && typeof probes.readiness === "object"
      ? probes.readiness
      : {}
  ) as Record<string, unknown>

  const rawTunables = Array.isArray(obj.tunables) ? obj.tunables : []
  const tunables: RuntimeTunableDTO[] = rawTunables.map((item) => {
    const t = (item && typeof item === "object" ? item : {}) as Record<
      string,
      unknown
    >
    return {
      key: String(t.key ?? ""),
      label: String(t.label ?? t.key ?? ""),
      type: (["bytes_string", "string", "number", "select", "boolean"].includes(
        String(t.type)
      )
        ? t.type
        : "string") as RuntimeTunableDTO["type"],
      default:
        t.default !== undefined ? (t.default as string | number | boolean) : "",
      category: t.category ? String(t.category) : undefined,
      description: String(t.description ?? ""),
      troubleshooting: String(t.troubleshooting ?? ""),
      relatedKeys: Array.isArray(t.relatedKeys)
        ? t.relatedKeys.map(String)
        : undefined,
      options: Array.isArray(t.options) ? t.options.map(String) : undefined,
      presets: Array.isArray(t.presets) ? t.presets.map(String) : undefined,
    }
  })

  return {
    $schema: typeof obj.$schema === "string" ? obj.$schema : undefined,
    runtime: String(obj.runtime ?? "unknown"),
    framework: String(obj.framework ?? obj.runtime ?? "Unknown"),
    version: String(obj.version ?? "latest"),
    supportedFrameworkVersions: Array.isArray(obj.supportedFrameworkVersions)
      ? obj.supportedFrameworkVersions.map(String)
      : undefined,
    runtimeMatrix:
      obj.runtimeMatrix && typeof obj.runtimeMatrix === "object"
        ? (obj.runtimeMatrix as Record<string, RuntimeMatrixEntryDTO>)
        : undefined,
    baseImage: String(obj.baseImage ?? ""),
    ports: {
      default: typeof ports.default === "number" ? ports.default : 8080,
      protocol: typeof ports.protocol === "string" ? ports.protocol : "HTTP",
    },
    security: {
      runAsUser:
        typeof security.runAsUser === "number" ? security.runAsUser : 10001,
      runAsGroup:
        typeof security.runAsGroup === "number" ? security.runAsGroup : 10001,
      readOnlyRoot: Boolean(security.readOnlyRoot),
    },
    probes: {
      liveness: {
        path: typeof liveness.path === "string" ? liveness.path : "/",
        port: typeof liveness.port === "number" ? liveness.port : 8080,
      },
      readiness: {
        path: typeof readiness.path === "string" ? readiness.path : "/",
        port: typeof readiness.port === "number" ? readiness.port : 8080,
      },
    },
    tunables,
  }
}

export function toAppRuntimeManifestRecordDTO(
  model: AppRuntimeManifest
): AppRuntimeManifestRecordDTO {
  return {
    id: model.id,
    frameworkId: model.frameworkId,
    version: model.version,
    manifest: toRuntimeManifestDTO(model.manifestJson),
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
  }
}
