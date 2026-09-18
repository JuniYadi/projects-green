import { Prisma, type PrismaClient } from "@prisma/client"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import {
  normalizeFrameworkId,
  resolvePlatformContract,
} from "@/modules/framework-detection/platform-runtime-contract"
import {
  toAppRuntimeManifestRecordDTO,
  toRuntimeManifestDTO,
  type AppRuntimeManifestRecordDTO,
  type RuntimeManifestDTO,
  type RuntimeTunableDTO,
} from "./runtime-manifest.dto"

export const RuntimeTunableSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: z.enum(["bytes_string", "string", "number", "select", "boolean"]),
  default: z.union([z.string(), z.number(), z.boolean()]),
  category: z.string().optional(),
  description: z.string().default(""),
  troubleshooting: z.string().default(""),
  relatedKeys: z.array(z.string()).optional(),
  options: z.array(z.string()).optional(),
  presets: z.array(z.string()).optional(),
})

export const RuntimeManifestSchema = z.object({
  $schema: z.string().optional(),
  runtime: z.string().trim().min(1),
  framework: z.string().trim().min(1),
  version: z.string().trim().min(1),
  baseImage: z.string().trim().min(1),
  ports: z.object({
    default: z.number().int().positive().default(8080),
    protocol: z.string().optional().default("HTTP"),
  }),
  security: z.object({
    runAsUser: z.number().int().default(10001),
    runAsGroup: z.number().int().default(10001),
    readOnlyRoot: z.boolean().optional().default(false),
  }),
  probes: z.object({
    liveness: z.object({
      path: z.string().min(1),
      port: z.number().int().positive().default(8080),
    }),
    readiness: z.object({
      path: z.string().min(1),
      port: z.number().int().positive().default(8080),
    }),
  }),
  tunables: z.array(RuntimeTunableSchema).default([]),
})

export type RuntimeManifestInput = z.infer<typeof RuntimeManifestSchema>

export function createFallbackManifest(
  frameworkId?: string | null
): RuntimeManifestDTO {
  const contract = resolvePlatformContract(frameworkId)
  const normalized = normalizeFrameworkId(frameworkId)

  return {
    runtime: normalized,
    framework:
      normalized.charAt(0).toUpperCase() + normalized.slice(1),
    version: "latest",
    baseImage: `ghcr.io/pfnapp/base/frameworks/${normalized}:latest`,
    ports: {
      default: contract.containerPort,
      protocol: "HTTP",
    },
    security: {
      runAsUser: contract.runAsUser,
      runAsGroup: contract.runAsGroup,
      readOnlyRoot: false,
    },
    probes: {
      liveness: contract.livenessProbe,
      readiness: contract.readinessProbe,
    },
    tunables: contract.tunables.map((t) => ({
      key: t.key,
      label: t.label,
      type: t.type,
      default: t.default,
      description: t.description,
      troubleshooting: t.troubleshooting,
      relatedKeys: t.relatedKeys,
      options: t.options,
    })),
  }
}

export class RuntimeManifestService {
  private readonly customDb?: PrismaClient

  constructor(customDb?: PrismaClient) {
    this.customDb = customDb
  }

  private get db(): PrismaClient {
    return this.customDb ?? prisma
  }

  async upsertManifest(
    rawManifest: unknown
  ): Promise<AppRuntimeManifestRecordDTO> {
    const validated = RuntimeManifestSchema.parse(rawManifest)
    const frameworkId = normalizeFrameworkId(validated.runtime)

    const record = await this.db.appRuntimeManifest.upsert({
      where: { frameworkId },
      update: {
        version: validated.version,
        manifestJson: validated as unknown as Prisma.InputJsonValue,
      },
      create: {
        frameworkId,
        version: validated.version,
        manifestJson: validated as unknown as Prisma.InputJsonValue,
      },
    })

    return toAppRuntimeManifestRecordDTO(record)
  }

  async syncManifests(
    payload: unknown
  ): Promise<AppRuntimeManifestRecordDTO[]> {
    const manifests = Array.isArray(payload) ? payload : [payload]
    const results: AppRuntimeManifestRecordDTO[] = []

    for (const raw of manifests) {
      const synced = await this.upsertManifest(raw)
      results.push(synced)
    }

    return results
  }

  async getRuntimeManifest(
    frameworkId?: string | null
  ): Promise<RuntimeManifestDTO> {
    const normalized = normalizeFrameworkId(frameworkId)

    try {
      const found = await this.db.appRuntimeManifest.findUnique({
        where: { frameworkId: normalized },
      })

      if (found?.manifestJson) {
        return toRuntimeManifestDTO(found.manifestJson)
      }
    } catch {
      // Fall through to local contract fallback
    }

    return createFallbackManifest(normalized)
  }

  async getRuntimeTunables(
    frameworkId?: string | null
  ): Promise<RuntimeTunableDTO[]> {
    const manifest = await this.getRuntimeManifest(frameworkId)
    return manifest.tunables
  }

  async listManifests(): Promise<AppRuntimeManifestRecordDTO[]> {
    try {
      const records = await this.db.appRuntimeManifest.findMany({
        orderBy: { frameworkId: "asc" },
      })
      return records.map(toAppRuntimeManifestRecordDTO)
    } catch {
      return []
    }
  }

  async formatTunablesForPrompt(
    frameworkId?: string | null
  ): Promise<string> {
    const manifest = await this.getRuntimeManifest(frameworkId)
    const lines: string[] = [
      `Platform Runtime Operational Contract for '${manifest.framework}' (${manifest.runtime}):`,
      `- Container Port: ${manifest.ports.default} (Strictly unprivileged UID ${manifest.security.runAsUser})`,
      `- Base Image: ${manifest.baseImage}`,
      `- Liveness & Readiness Probes: ${manifest.probes.liveness.path} on port ${manifest.probes.liveness.port}`,
      `- Configurable Runtime Environment Variables:`,
    ]

    for (const t of manifest.tunables) {
      const opts = t.options ? ` [Options: ${t.options.join(", ")}]` : ""
      lines.push(
        `  • ${t.key} (default: ${t.default})${opts}: ${t.description} -> ${t.troubleshooting}`
      )
    }

    return lines.join("\n")
  }
}

export const defaultRuntimeManifestService = new RuntimeManifestService()

export const upsertRuntimeManifest = (raw: unknown, db?: PrismaClient) =>
  new RuntimeManifestService(db).upsertManifest(raw)

export const syncRuntimeManifests = (raw: unknown, db?: PrismaClient) =>
  new RuntimeManifestService(db).syncManifests(raw)

export const getRuntimeManifest = (id?: string | null, db?: PrismaClient) =>
  new RuntimeManifestService(db).getRuntimeManifest(id)

export const getRuntimeTunables = (id?: string | null, db?: PrismaClient) =>
  new RuntimeManifestService(db).getRuntimeTunables(id)

export const listRuntimeManifests = (db?: PrismaClient) =>
  new RuntimeManifestService(db).listManifests()
