import type { UiDocEntry } from "@/modules/docs/docs.types"

export const uiDocsRegistry: Record<string, UiDocEntry> = {
  "/console": {
    path: "/console",
    title: "Console Overview",
    purpose:
      "Monitor product health and navigate core workflows from one place.",
    howTo: [
      "Use the left navigation to move between platform sections.",
      "Review summary cards for quick status checks before deeper analysis.",
      "Open this documentation panel when you need feature guidance.",
    ],
    notes: [
      "This is the first documentation rollout and currently covers console only.",
      "Additional page documentation can be added incrementally to the registry.",
    ],
    updatedAt: "2026-05-16",
  },
}
