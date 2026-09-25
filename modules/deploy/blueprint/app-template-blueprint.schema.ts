import { z } from "zod"

export const appTemplateBlueprintProbeSchema = z.object({
  path: z.string().trim().min(1, "Probe path is required"),
  port: z.number().int().min(1).max(65535).optional(),
  initialDelaySeconds: z.number().int().nonnegative().optional(),
  periodSeconds: z.number().int().positive().optional(),
  timeoutSeconds: z.number().int().positive().optional(),
  failureThreshold: z.number().int().positive().optional(),
})

export const appTemplateBlueprintMountSchema = z.object({
  type: z.enum(["pvc", "configmap", "secret", "emptyDir"]).default("pvc"),
  name: z.string().trim().min(1, "Mount name is required"),
  mountPath: z.string().trim().min(1, "Mount path is required"),
  subPath: z.string().trim().optional(),
  readOnly: z.boolean().default(false),
  sizeGb: z.number().min(1).optional(),
  sourceName: z.string().trim().optional(),
  defaultMode: z.number().int().optional(),
})

export const appTemplateBlueprintScalingSchema = z.object({
  allowAutoscale: z.boolean().default(true),
  maxReplicas: z.number().int().min(1).default(1),
  advisoryNote: z.string().trim().optional(),
})

export const appTemplateBlueprintRuntimeSchema = z.object({
  image: z.string().trim().min(1, "Runtime image is required"),
  command: z.array(z.string()).optional(),
  args: z.array(z.string()).optional(),
  defaultPort: z
    .number()
    .int()
    .min(1, "Port must be at least 1")
    .max(65535, "Port must be at most 65535"),
  healthCheckPath: z.string().trim().optional(),
  livenessProbe: appTemplateBlueprintProbeSchema.optional(),
  readinessProbe: appTemplateBlueprintProbeSchema.optional(),
  startupProbe: appTemplateBlueprintProbeSchema.optional(),
  runAsNonRoot: z.boolean().default(true),
  runAsUser: z.number().int().nonnegative().nullable().optional(),
  runAsGroup: z.number().int().nonnegative().nullable().optional(),
  readOnlyRootFilesystem: z.boolean().optional(),
  allowPrivilegeEscalation: z.boolean().optional(),
  deploymentType: z.enum(["deployment", "statefulset"]).default("deployment"),
  additionalPorts: z
    .array(
      z.object({
        port: z.number().int().min(1).max(65535),
        name: z.string().trim().min(1),
      })
    )
    .default([]),
  fsGroup: z.number().int().positive().nullable().optional(),
})

export const appTemplateBlueprintResourcesSchema = z.object({
  defaultCpu: z.number().min(100, "Default CPU must be at least 100m"),
  defaultMemory: z.number().min(128, "Default memory must be at least 128Mi"),
  minCpu: z.number().min(100).optional(),
  minMemory: z.number().min(128).optional(),
})

export const appTemplateBlueprintStorageSchema = z.object({
  enabled: z.boolean(),
  mountPath: z.string().trim().optional(),
  sizeGbDefault: z.number().min(1).optional(),
  fsGroup: z.number().int().positive().optional(),
  mounts: z.array(appTemplateBlueprintMountSchema).default([]),
})

export const appTemplateBlueprintDependencySchema = z.object({
  serviceType: z.enum(["POSTGRESQL", "MYSQL", "REDIS"]),
  alias: z.string().trim().min(1, "Dependency alias is required"),
  envPrefix: z.string().trim().min(1, "Environment prefix is required"),
})

export const appTemplateBlueprintEnvVarSchema = z.object({
  key: z.string().trim().min(1, "Environment key is required"),
  label: z.string().trim().min(1, "Environment label is required"),
  description: z.string().trim().optional(),
  defaultValue: z.string().optional(),
  required: z.boolean(),
  isSecret: z.boolean(),
  dataType: z.enum(["string", "number", "boolean", "select"]),
  options: z.array(z.string()).optional(),
  generateRandomHex: z.number().int().min(1).optional(),
  isFixed: z.boolean().default(false).optional(),
  isHidden: z.boolean().default(false).optional(),
})

export const appTemplateAccessSchema = z.object({
  mode: z.enum([
    "password-only",
    "username-password",
    "first-run-setup",
    "external-auth",
    "no-login",
  ]),
  title: z.string().trim().min(1),
  loginPath: z
    .string()
    .regex(/^\/(?!\/)/)
    .optional(),
  fields: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        label: z.string().trim().min(1),
        source: z.literal("env"),
        key: z.string().trim().min(1),
        secret: z.literal(true),
      })
    )
    .default([]),
  steps: z
    .array(
      z.object({
        text: z.string().trim().min(1),
        action: z
          .discriminatedUnion("type", [
            z.object({ type: z.literal("reveal-field"), fieldId: z.string() }),
            z.object({ type: z.literal("open-app") }),
          ])
          .optional(),
      })
    )
    .min(1),
})

export type AppTemplateAccess = z.infer<typeof appTemplateAccessSchema>

export const appTemplateBlueprintSchema = z
  .object({
    version: z.literal("1.0.0"),
    runtime: appTemplateBlueprintRuntimeSchema,
    resources: appTemplateBlueprintResourcesSchema,
    storage: appTemplateBlueprintStorageSchema.optional(),
    dependencies: z.array(appTemplateBlueprintDependencySchema).default([]),
    envSchema: z.array(appTemplateBlueprintEnvVarSchema).default([]),
    access: appTemplateAccessSchema.optional(),
    scaling: appTemplateBlueprintScalingSchema.optional(),
  })
  .superRefine((blueprint, ctx) => {
    const access = blueprint.access
    if (!access) return
    const ids = new Set<string>()
    for (const [index, field] of access.fields.entries()) {
      if (ids.has(field.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["access", "fields", index, "id"],
          message: "Field ID must be unique",
        })
      }
      ids.add(field.id)
      if (
        !blueprint.envSchema.some(
          (env) => env.key === field.key && env.isSecret
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["access", "fields", index, "key"],
          message: "Field must reference a secret env key",
        })
      }
    }
    for (const [index, step] of access.steps.entries()) {
      if (
        step.action?.type === "reveal-field" &&
        !ids.has(step.action.fieldId)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["access", "steps", index, "action", "fieldId"],
          message: "Step references an unknown field",
        })
      }
    }
  })

export type AppTemplateBlueprint = z.input<typeof appTemplateBlueprintSchema>
export type AppTemplateBlueprintParsed = z.infer<
  typeof appTemplateBlueprintSchema
>
export type AppTemplateBlueprintRuntime = z.input<
  typeof appTemplateBlueprintRuntimeSchema
>
export type AppTemplateBlueprintResources = z.infer<
  typeof appTemplateBlueprintResourcesSchema
>
export type AppTemplateBlueprintStorage = z.infer<
  typeof appTemplateBlueprintStorageSchema
>
export type AppTemplateBlueprintDependency = z.infer<
  typeof appTemplateBlueprintDependencySchema
>
export type AppTemplateBlueprintEnvVar = z.infer<
  typeof appTemplateBlueprintEnvVarSchema
>
export type AppTemplateBlueprintProbe = z.infer<
  typeof appTemplateBlueprintProbeSchema
>
export type AppTemplateBlueprintMount = z.infer<
  typeof appTemplateBlueprintMountSchema
>
export type AppTemplateBlueprintScaling = z.infer<
  typeof appTemplateBlueprintScalingSchema
>

export const appTemplatePackageSchema = z.object({
  exportVersion: z.literal("1.0.0").default("1.0.0"),
  metadata: z.object({
    name: z.string().trim().min(1, "Template name is required"),
    slug: z.string().trim().min(1, "Template slug is required"),
    tagline: z.string().trim().optional(),
    description: z.string().trim().optional(),
    category: z
      .enum([
        "AI",
        "AUTOMATION",
        "CMS",
        "DATABASE",
        "DEVELOPER_TOOLS",
        "ANALYTICS",
        "UTILITIES",
      ])
      .default("UTILITIES"),
    iconUrl: z.string().trim().optional(),
    websiteUrl: z.string().trim().optional(),
    documentationUrl: z.string().trim().optional(),
  }),
  blueprint: appTemplateBlueprintSchema,
})

export type AppTemplatePackage = z.input<typeof appTemplatePackageSchema>
export type AppTemplatePackageParsed = z.infer<typeof appTemplatePackageSchema>
