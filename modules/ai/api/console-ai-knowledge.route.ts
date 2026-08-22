import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { requireConsoleOrgAuth } from "./console-ai-providers.route"
import { enqueueDocumentIngestion } from "@/modules/ai/ai-ingestion.worker"

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

        // Create initial document record with QUEUED status
        const doc = await prisma.aiKnowledgeDocument.create({
          data: {
            organizationId: auth.orgId,
            agentProfileId: agentProfileId || null,
            title: title.trim(),
            purpose: purpose.trim(),
            category: category.trim(),
            sourceType: sourceType,
            status: "QUEUED",
            contentMarkdown: contentMarkdown?.trim() || null,
            searchText: title.trim(),
            embedding: [],
          },
        })

        // Enqueue background processing job
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
          contentMarkdown: t.Optional(t.String()),
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

      await prisma.aiKnowledgeDocument.delete({
        where: { id: existing.id },
      })

      return {
        ok: true,
        message: "Document deleted successfully",
      }
    })
}
