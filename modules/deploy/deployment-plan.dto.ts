import { z } from "zod"

export const deploymentPlanSchema = z
  .object({
    version: z.number().int().positive(),
    source: z
      .object({
        kind: z.enum(["git", "template"]),
        url: z.string().url().nullable(),
        host: z.string().min(1).nullable(),
        ref: z.string().min(1).nullable(),
        templateId: z.string().min(1).nullable(),
      })
      .strict(),
    access: z
      .object({
        state: z.enum([
          "unknown",
          "public",
          "credential",
          "connection_required",
          "verified",
          "denied",
        ]),
        displayLabel: z.string().min(1).nullable(),
      })
      .strict(),
    detection: z
      .object({
        runtime: z.string().min(1).nullable(),
        framework: z.string().min(1).nullable(),
        version: z.string().min(1).nullable(),
        commands: z.array(z.string().min(1)),
        port: z.number().int().min(1).max(65535).nullable(),
        confidence: z.number().min(0).max(1).nullable(),
        evidence: z.array(
          z
            .object({
              kind: z.string().min(1),
              summary: z.string().min(1),
              reference: z.string().min(1).nullable(),
            })
            .strict()
        ),
      })
      .strict(),
    configuration: z
      .object({
        appName: z.string().min(1).nullable(),
        branchOrRef: z.string().min(1).nullable(),
        environment: z.enum(["production", "staging", "development"]),
        envRequirements: z.array(
          z
            .object({
              key: z.string().min(1),
              required: z.boolean(),
              kind: z.enum(["plain", "secret", "generated"]),
              status: z.enum([
                "missing",
                "provided",
                "generated",
                "not_applicable",
              ]),
              description: z.string().min(1),
            })
            .strict()
        ),
      })
      .strict(),
    dependencies: z.array(
      z
        .object({
          key: z.string().min(1),
          kind: z.enum(["database", "storage", "cache", "service", "network"]),
          mode: z.enum(["managed", "external", "existing", "none"]),
          required: z.boolean(),
          status: z.enum(["missing", "ready", "not_applicable"]),
          requiredInputs: z.array(z.string().min(1)),
          readinessChecks: z.array(z.string().min(1)),
        })
        .strict()
    ),
    resources: z
      .object({
        package: z.string().min(1).nullable(),
        server: z.string().min(1).nullable(),
        region: z.string().min(1).nullable(),
        cpu: z.number().positive().nullable(),
        memory: z.number().positive().nullable(),
        storage: z.number().positive().nullable(),
      })
      .strict(),
    domain: z
      .object({
        mode: z.enum(["auto", "custom", "none"]),
        hostname: z.string().min(1).nullable(),
        tls: z.boolean(),
      })
      .strict(),
    billing: z
      .object({
        quoteReference: z.string().min(1).nullable(),
        currency: z.string().length(3).nullable(),
        estimate: z.number().nonnegative().nullable(),
        interval: z.enum(["hour", "month", "year"]).nullable(),
      })
      .strict(),
    execution: z
      .object({
        ready: z.boolean(),
        steps: z.array(
          z
            .object({
              key: z.string().min(1),
              label: z.string().min(1),
              status: z.enum(["pending", "ready", "blocked"]),
              evidenceReference: z.string().min(1).nullable(),
            })
            .strict()
        ),
      })
      .strict(),
    unresolved: z.array(
      z
        .object({
          key: z.string().min(1),
          required: z.boolean(),
          description: z.string().min(1),
        })
        .strict()
    ),
    provenance: z
      .object({
        analyzer: z.string().min(1),
        sourceReference: z.string().min(1).nullable(),
        analyzedAt: z.string().datetime(),
      })
      .strict(),
  })
  .strict()

export type DeploymentPlanDTO = z.infer<typeof deploymentPlanSchema>

export function toDeploymentPlanDTO(plan: unknown): DeploymentPlanDTO | null {
  const parsed = deploymentPlanSchema.safeParse(plan)
  return parsed.success ? parsed.data : null
}
