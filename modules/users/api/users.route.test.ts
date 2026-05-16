import { describe, expect, it } from "bun:test"
import { Elysia } from "elysia"

import { createUsersRoutes } from "@/modules/users/api/users.route"

describe("usersRoutes", () => {
  it("creates user and returns 201", async () => {
    const app = new Elysia().use(
      createUsersRoutes({
        async createUser(input) {
          return {
            id: "user_123",
            name: input.name,
            email: input.email,
          }
        },
        async getUserById() {
          return null
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.com",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      user: { id: string; email: string }
    }

    expect(response.status).toBe(201)
    expect(body.ok).toBe(true)
    expect(body.user.id).toBe("user_123")
    expect(body.user.email).toBe("ada@example.com")
  })

  it("returns 409 when email already exists", async () => {
    const app = new Elysia().use(
      createUsersRoutes({
        async createUser() {
          throw {
            name: "UserEmailAlreadyExistsError",
          }
        },
        async getUserById() {
          return null
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.com",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      message: string
    }

    expect(response.status).toBe(409)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("EMAIL_ALREADY_EXISTS")
    expect(body.message).toBe("This email address is already in use.")
  })

  it("returns user for GET /user/:id", async () => {
    const app = new Elysia().use(
      createUsersRoutes({
        async createUser() {
          throw new Error("not used")
        },
        async getUserById(id) {
          return {
            id,
            name: "Ada Lovelace",
            email: "ada@example.com",
          }
        },
      })
    )

    const response = await app.handle(new Request("http://localhost/user/u1"))
    const body = (await response.json()) as {
      ok: boolean
      user: { id: string }
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.user.id).toBe("u1")
  })

  it("returns 404 when user does not exist", async () => {
    const app = new Elysia().use(
      createUsersRoutes({
        async createUser() {
          throw new Error("not used")
        },
        async getUserById() {
          return null
        },
      })
    )

    const response = await app.handle(new Request("http://localhost/user/u1"))
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(404)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("USER_NOT_FOUND")
  })
})
