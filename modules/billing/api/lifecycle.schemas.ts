import { z } from "zod"

// ─── Cancel ───────────────────────────────────────────────────────────────────

export const cancelSubscriptionSchema = z.object({
  reason: z.string().max(500).optional(),
})

export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>

// ─── Reinstate ────────────────────────────────────────────────────────────────

export const reinstateSubscriptionSchema = z.object({
  reason: z.string().max(500).optional(),
})

export type ReinstateSubscriptionInput = z.infer<
  typeof reinstateSubscriptionSchema
>

// ─── Change Plan Preview ───────────────────────────────────────────────────────

export const changePlanPreviewSchema = z.object({
  pricingId: z.string().min(1),
})

export type ChangePlanPreviewInput = z.infer<typeof changePlanPreviewSchema>

// ─── Change Plan Commit ───────────────────────────────────────────────────────

export const changePlanSchema = z.object({
  pricingId: z.string().min(1),
})

export type ChangePlanInput = z.infer<typeof changePlanSchema>
