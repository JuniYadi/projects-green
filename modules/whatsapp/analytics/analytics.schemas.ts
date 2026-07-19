import { z } from "zod"

export const syncQuerySchema = z.object({
  deviceId: z.string().min(1, "deviceId is required"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
  granularity: z.enum(["DAY", "WEEK", "MONTH"]).default("DAY"),
})

export const reportQuerySchema = z.object({
  deviceId: z.string().min(1, "deviceId is required"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
})

export const costReconciliationQuerySchema = z.object({
  deviceId: z.string().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
})

export type SyncInput = z.infer<typeof syncQuerySchema>
export type ReportInput = z.infer<typeof reportQuerySchema>
export type CostReconciliationInput = z.infer<
  typeof costReconciliationQuerySchema
>
