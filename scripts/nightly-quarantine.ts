export const NIGHTLY_QUARANTINE = [
  {
    suite: "component",
    owner: "@JuniYadi",
    reason: "Happy DOM component tests are migrating to isolated contracts",
    reviewAfter: "2026-10-30",
  },
  {
    suite: "functional-smoke-and-legacy-public",
    owner: "@JuniYadi",
    reason: "Legacy browser coverage remains nightly during fixture migration",
    reviewAfter: "2026-10-30",
  },
] as const
