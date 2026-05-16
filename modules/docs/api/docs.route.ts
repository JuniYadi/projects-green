import { Elysia } from "elysia"
import { z } from "zod"

import {
  getDocByPath,
  normalizeDocPath,
  upsertDocByPath,
} from "@/modules/docs/docs.service"

const docsQuerySchema = z.object({
  path: z.string().min(1),
})

const docsBodySchema = z.object({
  path: z.string().min(1),
  title: z.string().min(1),
  purpose: z.string().min(1),
  howTo: z.array(z.string().min(1)).min(1),
  notes: z.array(z.string().min(1)).optional(),
  updatedAt: z.string().min(1).optional(),
})

export const docsRoutes = new Elysia()
  .get("/docs", ({ query, set }) => {
    const parsed = docsQuerySchema.safeParse(query)

    if (!parsed.success) {
      set.status = 400
      return {
        ok: false as const,
        error: "INVALID_PATH" as const,
        message: "Query parameter `path` is required.",
      }
    }

    const doc = getDocByPath(parsed.data.path)

    if (!doc) {
      set.status = 404
      return {
        ok: false as const,
        error: "DOC_NOT_FOUND" as const,
        message: `No documentation found for path "${parsed.data.path}".`,
      }
    }

    return {
      ok: true as const,
      ...doc,
    }
  })
  .post("/docs", ({ body, set }) => {
    const parsed = docsBodySchema.safeParse(body)

    if (!parsed.success) {
      set.status = 400
      return {
        ok: false as const,
        error: "INVALID_PAYLOAD" as const,
        message: "Invalid documentation payload.",
      }
    }

    const normalizedPath = normalizeDocPath(parsed.data.path)

    if (!normalizedPath) {
      set.status = 400
      return {
        ok: false as const,
        error: "INVALID_PATH" as const,
        message: "Path must not be empty.",
      }
    }

    const normalizedHowTo = parsed.data.howTo
      .map((item) => item.trim())
      .filter((item) => item.length > 0)

    if (!normalizedHowTo.length) {
      set.status = 400
      return {
        ok: false as const,
        error: "INVALID_PAYLOAD" as const,
        message: "How-to steps must contain at least one non-empty item.",
      }
    }

    const savedDoc = upsertDocByPath({
      path: normalizedPath,
      title: parsed.data.title.trim(),
      purpose: parsed.data.purpose.trim(),
      howTo: normalizedHowTo,
      notes: parsed.data.notes
        ?.map((item) => item.trim())
        .filter((item) => item.length > 0),
      updatedAt: parsed.data.updatedAt ?? new Date().toISOString().slice(0, 10),
    })

    set.status = 201

    return {
      ok: true as const,
      ...savedDoc,
    }
  })
