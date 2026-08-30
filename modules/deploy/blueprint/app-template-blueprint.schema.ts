import { z } from "zod"

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
  runAsNonRoot: z.boolean().default(true),
  deploymentType: z.enum(["deployment", "statefulset"]).default("deployment"),
  additionalPorts: z
    .array(
      z.object({
        port: z.number().int().min(1).max(65535),
        name: z.string().trim().min(1),
      })
    )
    .default([]),
})

export const appTemplateBlueprintResourcesSchema = z.object({
  defaultCpu: z.number().min(100, "Default CPU must be at least 100m"),
  defaultMemory: z.number().min(128, "Default memory must be at least 128Mi"),
  minCpu: z.number().min(100).optional(),
  minMemory: z.number().min(128).optional(),
})

export const appTemplateBlueprintStorageSchema = z.object({
  enabled: z.boolean(),
  mountPath: z.string().trim().min(1, "Mount path is required"),
  sizeGbDefault: z.number().min(1, "Default storage size must be at least 1GB"),
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

export const appTemplateBlueprintSchema = z.object({
  version: z.literal("1.0.0"),
  runtime: appTemplateBlueprintRuntimeSchema,
  resources: appTemplateBlueprintResourcesSchema,
  storage: appTemplateBlueprintStorageSchema.optional(),
  dependencies: z.array(appTemplateBlueprintDependencySchema).default([]),
  envSchema: z.array(appTemplateBlueprintEnvVarSchema).default([]),
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
