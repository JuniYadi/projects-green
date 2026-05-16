import { Elysia } from "elysia"
import { z } from "zod"

import type { UsersService } from "@/modules/users/users.service"

const userCreateSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be at most 80 characters"),
  email: z.email("Please enter a valid email address"),
})

const createDefaultUsersService = (): UsersService => ({
  async createUser(input) {
    const { usersService } = await import("@/modules/users/users.service")
    return usersService.createUser(input)
  },
  async getUserById(id) {
    const { usersService } = await import("@/modules/users/users.service")
    return usersService.getUserById(id)
  },
})

const isUserEmailAlreadyExistsError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false
  }

  return "name" in error && error.name === "UserEmailAlreadyExistsError"
}

export const createUsersRoutes = (
  service: UsersService = createDefaultUsersService()
) =>
  new Elysia()
    .post(
      "/user",
      async ({ body, set }) => {
        try {
          const user = await service.createUser({
            name: body.name,
            email: body.email,
          })

          set.status = 201

          return {
            ok: true as const,
            user,
          }
        } catch (error) {
          if (isUserEmailAlreadyExistsError(error)) {
            set.status = 409
            return {
              ok: false as const,
              error: "EMAIL_ALREADY_EXISTS" as const,
              message: "This email address is already in use.",
            }
          }

          throw error
        }
      },
      {
        body: userCreateSchema,
      }
    )
    .get(
      "/user/:id",
      async ({ params, set }) => {
        const user = await service.getUserById(params.id)

        if (!user) {
          set.status = 404
          return {
            ok: false as const,
            error: "USER_NOT_FOUND" as const,
            message: "User does not exist.",
          }
        }

        return {
          ok: true as const,
          user,
        }
      },
      {
        params: z.object({
          id: z.string().min(1),
        }),
      }
    )

export const usersRoutes = createUsersRoutes()
