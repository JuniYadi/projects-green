import { z } from "zod"

const boundedText = (max: number) => z.string().trim().min(1).max(max)

export const createMetaAppSchema = z
  .object({
    name: boundedText(120),
    metaAppId: boundedText(128),
    appSecret: boundedText(512),
    verifyToken: boundedText(512),
    active: z.boolean().default(true),
  })
  .strict()

export const updateMetaAppSchema = z
  .object({
    name: boundedText(120).optional(),
    metaAppId: boundedText(128).optional(),
    appSecret: boundedText(512).optional(),
    verifyToken: boundedText(512).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one Meta app field is required",
  })

export type CreateMetaAppInput = z.input<typeof createMetaAppSchema>
export type UpdateMetaAppInput = z.input<typeof updateMetaAppSchema>
