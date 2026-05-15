import { Prisma } from "@prisma/client"
import { Elysia, t } from "elysia"
import { openapi } from '@elysia/openapi'

import { prisma } from "@/lib/prisma"

export const app = new Elysia({ prefix: "/api" }).use(openapi())
  .get("/health", () => ({
    ok: true as const,
    timestamp: new Date().toISOString(),
  }))
  .post(
    "/echo",
    ({ body }) => ({
      ok: true as const,
      data: body,
      echoedAt: new Date().toISOString(),
    }),
    {
      body: t.Object({
        message: t.String(),
      }),
    },
  )
  .post(
    "/user",
    async ({ body, set }) => {
      try {
        const user = await prisma.user.create({
          data: {
            name: body.name,
            email: body.email,
          },
        })

        set.status = 201

        return {
          ok: true as const,
          user,
        }
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          set.status = 409
          return {
            ok: false as const,
            error: "EMAIL_ALREADY_EXISTS",
          }
        }

        throw error
      }
    },
    {
      body: t.Object({
        name: t.String(),
        email: t.String(),
      }),
    },
  )
  .get(
    "/user/:id",
    async ({ params, set }) => {
      const user = await prisma.user.findUnique({
        where: {
          id: params.id,
        },
      })

      if (!user) {
        set.status = 404
        return {
          ok: false as const,
          error: "USER_NOT_FOUND",
        }
      }

      return {
        ok: true as const,
        user,
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )

export type App = typeof app
