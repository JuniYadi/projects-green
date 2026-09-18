import { tool } from "ai"
import { z } from "zod"

import {
  defaultRuntimeManifestService,
  type RuntimeManifestService,
} from "@/modules/deploy/runtime-manifest.service"

export const GET_RUNTIME_TUNABLES_SCHEMA = z.object({
  framework: z
    .string()
    .describe(
      "The runtime or framework identifier (e.g. 'laravel', 'nextjs', 'bun', 'node')."
    ),
})

export type GetRuntimeTunablesInput = z.infer<
  typeof GET_RUNTIME_TUNABLES_SCHEMA
>

export function createRuntimeKnowledgeTools(deps?: {
  manifestService?: RuntimeManifestService
}) {
  const service = deps?.manifestService ?? defaultRuntimeManifestService

  return {
    get_runtime_tunables: tool({
      description:
        "Retrieve operational tunables, environment variables, default values, presets, and troubleshooting instructions for a container runtime framework (e.g. Laravel, Next.js, Bun).",
      inputSchema: GET_RUNTIME_TUNABLES_SCHEMA,
      execute: async ({ framework }) => {
        const manifest = await service.getRuntimeManifest(framework)
        return {
          framework: manifest.framework,
          runtime: manifest.runtime,
          version: manifest.version,
          baseImage: manifest.baseImage,
          ports: manifest.ports,
          security: manifest.security,
          tunables: manifest.tunables,
          summary: `Runtime '${manifest.framework}' (${manifest.runtime}) supports ${manifest.tunables.length} configurable parameters: ${manifest.tunables.map((t) => t.key).join(", ")}.`,
        }
      },
    }),
  }
}
