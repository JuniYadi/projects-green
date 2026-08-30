import { Elysia, t } from "elysia"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { whatsappAuthPlugin } from "@/lib/whatsapp/auth"
import { WorkflowDefinitionSchema } from "./workflow.schema"

export const whatsappWorkflowRoutes = new Elysia({ prefix: "/workflows" })
  .use(whatsappAuthPlugin)
  .get("/", async ({ whatsappAuth }) => {
    if (!whatsappAuth?.organizationId) {
      return { ok: false, error: "Organization required", data: [] }
    }

    const devices = await prisma.whatsappDevice.findMany({
      where: { organizationId: whatsappAuth.organizationId },
      select: {
        id: true,
        phoneNumber: true,
        features: true,
      },
    })

    const workflows: Array<Record<string, unknown>> = []
    for (const dev of devices) {
      const features = dev.features as Record<string, unknown> | null
      if (features?.botWorkflow) {
        const parsed = WorkflowDefinitionSchema.safeParse(features.botWorkflow)
        if (parsed.success) {
          workflows.push({
            ...parsed.data,
            device: {
              id: dev.id,
              name: `WhatsApp (${dev.phoneNumber})`,
              phoneNumber: dev.phoneNumber,
            },
          })
        }
      }
    }

    return {
      ok: true,
      data: workflows,
    }
  })
  .get(
    "/:id",
    async ({ whatsappAuth, params }) => {
      if (!whatsappAuth?.organizationId) {
        return { ok: false, error: "Organization required" }
      }

      const devices = await prisma.whatsappDevice.findMany({
        where: { organizationId: whatsappAuth.organizationId },
        select: {
          id: true,
          phoneNumber: true,
          features: true,
        },
      })

      for (const dev of devices) {
        const features = dev.features as Record<string, unknown> | null
        if (features?.botWorkflow) {
          const parsed = WorkflowDefinitionSchema.safeParse(
            features.botWorkflow
          )
          if (parsed.success && parsed.data.id === params.id) {
            return {
              ok: true,
              data: {
                ...parsed.data,
                deviceId: dev.id,
                device: {
                  id: dev.id,
                  name: `WhatsApp (${dev.phoneNumber})`,
                  phoneNumber: dev.phoneNumber,
                },
              },
            }
          }
        }
      }

      return { ok: false, error: "Workflow not found" }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )
  .post(
    "/save",
    async ({ whatsappAuth, body }) => {
      if (!whatsappAuth?.organizationId) {
        return { ok: false, error: "Organization required" }
      }

      const { deviceId, workflow } = body
      const parsed = WorkflowDefinitionSchema.safeParse(workflow)
      if (!parsed.success) {
        return {
          ok: false,
          error: `Invalid workflow schema: ${parsed.error.message}`,
        }
      }

      const device = await prisma.whatsappDevice.findFirst({
        where: {
          id: deviceId,
          organizationId: whatsappAuth.organizationId,
        },
        select: { id: true, features: true },
      })

      if (!device) {
        return { ok: false, error: "WhatsApp Device not found" }
      }

      const currentFeatures =
        (device.features as Record<string, unknown> | null) || {}
      const updatedFeatures = {
        ...currentFeatures,
        botWorkflow: parsed.data,
      } as unknown as Prisma.InputJsonValue

      await prisma.whatsappDevice.update({
        where: { id: device.id },
        data: {
          features: updatedFeatures,
        },
      })

      return {
        ok: true,
        data: parsed.data,
      }
    },
    {
      body: t.Object({
        deviceId: t.String(),
        workflow: t.Any(),
      }),
    }
  )
  .post(
    "/delete",
    async ({ whatsappAuth, body }) => {
      if (!whatsappAuth?.organizationId) {
        return { ok: false, error: "Organization required" }
      }

      const { deviceId } = body
      const device = await prisma.whatsappDevice.findFirst({
        where: {
          id: deviceId,
          organizationId: whatsappAuth.organizationId,
        },
        select: { id: true, features: true },
      })

      if (!device) {
        return { ok: false, error: "WhatsApp Device not found" }
      }

      const currentFeatures =
        (device.features as Record<string, unknown> | null) || {}
      const { botWorkflow: _removed, ...remainingFeatures } = currentFeatures

      await prisma.whatsappDevice.update({
        where: { id: device.id },
        data: {
          features: remainingFeatures as unknown as Prisma.InputJsonValue,
        },
      })

      return {
        ok: true,
      }
    },
    {
      body: t.Object({
        deviceId: t.String(),
      }),
    }
  )
