import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { requireConsoleOrgAuth } from "./console-ai-providers.route"
import {
  enqueueDocumentIngestion,
  removePeriodicCrawlerSync,
  schedulePeriodicCrawlerSync,
} from "@/modules/ai/ai-ingestion.worker"
import { assertAllowedUrl } from "@/modules/ai/crawler/web-crawler.service"

export function createConsoleAiKnowledgeRoutes() {
  return new Elysia({ prefix: "/console/ai/knowledge" })
    .get("/", async ({ set }) => {
      const auth = await requireConsoleOrgAuth()
      if ("error" in auth) {
        set.status = auth.status
        return { ok: false, error: auth.error }
      }

      const docs = await prisma.aiKnowledgeDocument.findMany({
        where: { organizationId: auth.orgId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          purpose: true,
          category: true,
          sourceType: true,
          sourceUrl: true,
          crawlMode: true,
          syncSchedule: true,
          lastSyncedAt: true,
          contentHash: true,
          status: true,
          pageCount: true,
          chunkIndex: true,
          errorMessage: true,
          agentProfileId: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        ok: true,
        data: docs,
      }
    })
    .post(
      "/upload",
      async ({ body, set }) => {
        const auth = await requireConsoleOrgAuth()
        if ("error" in auth) {
          set.status = auth.status
          return { ok: false, error: auth.error }
        }

        const {
          title,
          purpose = "Tenant Document",
          category = "General",
          sourceType = "PDF",
          sourceUrl,
          crawlMode = "SINGLE_PAGE",
          syncSchedule = "MANUAL",
          contentMarkdown,
          agentProfileId,
        } = body

        if (!title?.trim()) {
          set.status = 400
          return {
            ok: false,
            error: "VALIDATION_ERROR",
            message: "title is required",
          }
        }

        const doc = await prisma.aiKnowledgeDocument.create({
          data: {
            organizationId: auth.orgId,
            agentProfileId: agentProfileId || null,
            title: title.trim(),
            purpose: purpose.trim(),
            category: category.trim(),
            sourceType,
            sourceUrl: sourceUrl?.trim() || null,
            crawlMode,
            syncSchedule,
            status: "QUEUED",
            contentMarkdown: contentMarkdown?.trim() || null,
            searchText: title.trim(),
            embedding: [],
          },
        })

        try {
          await enqueueDocumentIngestion({
            documentId: doc.id,
            organizationId: auth.orgId,
            agentProfileId: agentProfileId || null,
            filename: `${title.trim()}.${sourceType.toLowerCase()}`,
            rawContent: contentMarkdown?.trim(),
            sourceType: sourceType as
              | "PDF"
              | "DOCX"
              | "URL_FIRECRAWL"
              | "MANUAL",
            sourceUrl: sourceUrl?.trim() || null,
            crawlMode: crawlMode as "SINGLE_PAGE" | "SUBPATH_RECURSIVE",
            syncSchedule: syncSchedule as "MANUAL" | "WEEKLY" | "MONTHLY",
          })
        } catch (queueErr) {
          const errorMessage =
            queueErr instanceof Error ? queueErr.message : String(queueErr)
          console.error(
            "[ai-knowledge] enqueueDocumentIngestion failed:",
            errorMessage
          )
          await prisma.aiKnowledgeDocument.update({
            where: { id: doc.id },
            data: {
              status: "FAILED",
              errorMessage,
            },
          })
          set.status = 500
          return {
            ok: false,
            error: "QUEUE_FAILED",
            message: "Failed to queue document for processing",
          }
        }

        set.status = 202
        return {
          ok: true,
          message: "Document upload accepted and queued for processing",
          data: {
            id: doc.id,
            title: doc.title,
            status: "QUEUED",
          },
        }
      },
      {
        body: t.Object({
          title: t.String(),
          purpose: t.Optional(t.String()),
          category: t.Optional(t.String()),
          sourceType: t.Optional(
            t.Union([
              t.Literal("PDF"),
              t.Literal("DOCX"),
              t.Literal("URL_FIRECRAWL"),
              t.Literal("MANUAL"),
            ])
          ),
          sourceUrl: t.Optional(t.String()),
          crawlMode: t.Optional(
            t.Union([
              t.Literal("SINGLE_PAGE"),
              t.Literal("SUBPATH_RECURSIVE"),
            ])
          ),
          syncSchedule: t.Optional(
            t.Union([
              t.Literal("MANUAL"),
              t.Literal("WEEKLY"),
              t.Literal("MONTHLY"),
            ])
          ),
          contentMarkdown: t.Optional(t.String()),
          agentProfileId: t.Optional(t.String()),
        }),
      }
    )
    .post(
      "/url",
      async ({ body, set }) => {
        const auth = await requireConsoleOrgAuth()
        if ("error" in auth) {
          set.status = auth.status
          return { ok: false, error: auth.error }
        }

        const {
          url,
          title,
          purpose = "Tenant Web Knowledge",
          category = "Website",
          crawlMode = "SINGLE_PAGE",
          syncSchedule = "MANUAL",
          agentProfileId,
        } = body

        if (!url?.trim()) {
          set.status = 400
          return {
            ok: false,
            error: "VALIDATION_ERROR",
            message: "url is required",
          }
        }

        try {
          assertAllowedUrl(url.trim())
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Invalid or forbidden URL"
          set.status = 400
          return {
            ok: false,
            error: "INVALID_URL",
            message,
          }
        }

        const effectiveTitle =
          title?.trim() ||
          (() => {
            try {
              const p = new URL(url.trim())
              return `${p.hostname}${p.pathname === "/" ? "" : p.pathname}`
            } catch {
              return "Web Page"
            }
          })()

        const doc = await prisma.aiKnowledgeDocument.create({
          data: {
            organizationId: auth.orgId,
            agentProfileId: agentProfileId || null,
            title: effectiveTitle,
            purpose: purpose.trim(),
            category: category.trim(),
            sourceType: "URL_FIRECRAWL",
            sourceUrl: url.trim(),
            crawlMode,
            syncSchedule,
            status: "QUEUED",
            searchText: effectiveTitle,
            embedding: [],
          },
        })

        try {
          await enqueueDocumentIngestion({
            documentId: doc.id,
            organizationId: auth.orgId,
            agentProfileId: agentProfileId || null,
            filename: `${effectiveTitle}.url`,
            sourceType: "URL_FIRECRAWL",
            sourceUrl: url.trim(),
            crawlMode: crawlMode as "SINGLE_PAGE" | "SUBPATH_RECURSIVE",
            syncSchedule: syncSchedule as "MANUAL" | "WEEKLY" | "MONTHLY",
          })

          if (syncSchedule !== "MANUAL") {
            await schedulePeriodicCrawlerSync({
              documentId: doc.id,
              organizationId: auth.orgId,
              syncSchedule: syncSchedule as "WEEKLY" | "MONTHLY",
            })
          }
        } catch (queueErr) {
          const errorMessage =
            queueErr instanceof Error ? queueErr.message : String(queueErr)
          console.error(
            "[ai-knowledge] enqueueDocumentIngestion failed:",
            errorMessage
          )
          await prisma.aiKnowledgeDocument.update({
            where: { id: doc.id },
            data: {
              status: "FAILED",
              errorMessage,
            },
          })
          set.status = 500
          return {
            ok: false,
            error: "QUEUE_FAILED",
            message: "Failed to queue URL crawler for processing",
          }
        }

        set.status = 202
        return {
          ok: true,
          message: "URL crawling accepted and queued for processing",
          data: {
            id: doc.id,
            title: doc.title,
            sourceUrl: doc.sourceUrl,
            crawlMode: doc.crawlMode,
            syncSchedule: doc.syncSchedule,
            status: "QUEUED",
          },
        }
      },
      {
        body: t.Object({
          url: t.String(),
          title: t.Optional(t.String()),
          purpose: t.Optional(t.String()),
          category: t.Optional(t.String()),
          crawlMode: t.Optional(
            t.Union([
              t.Literal("SINGLE_PAGE"),
              t.Literal("SUBPATH_RECURSIVE"),
            ])
          ),
          syncSchedule: t.Optional(
            t.Union([
              t.Literal("MANUAL"),
              t.Literal("WEEKLY"),
              t.Literal("MONTHLY"),
            ])
          ),
          agentProfileId: t.Optional(t.String()),
        }),
      }
    )
    .delete("/:id", async ({ params, set }) => {
      const auth = await requireConsoleOrgAuth()
      if ("error" in auth) {
        set.status = auth.status
        return { ok: false, error: auth.error }
      }

      const existing = await prisma.aiKnowledgeDocument.findFirst({
        where: { id: params.id, organizationId: auth.orgId },
      })

      if (!existing) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Document not found" }
      }

      if (existing.syncSchedule && existing.syncSchedule !== "MANUAL") {
        await removePeriodicCrawlerSync(existing.id).catch(() => {})
      }

      await prisma.aiKnowledgeDocument.delete({
        where: { id: existing.id },
      })

      return {
        ok: true,
        message: "Document deleted successfully",
      }
    })
}
