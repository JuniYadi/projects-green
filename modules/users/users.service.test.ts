import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockCreate = mock(() => Promise.resolve({}))
const mockFindUnique = mock(() => Promise.resolve(null))

mock.module("@/lib/prisma", () => ({
  prisma: {
    user: {
      create: mockCreate,
      findUnique: mockFindUnique,
    },
  },
}))

import { UserEmailAlreadyExistsError, usersService } from "./users.service"

describe("users.service", () => {
  beforeEach(() => {
    mockCreate.mockClear()
    mockFindUnique.mockClear()
  })

  describe("createUser", () => {
    it("creates a new user successfully", async () => {
      mockCreate.mockResolvedValueOnce({
        id: "user-1",
        name: "John Doe",
        email: "john@example.com",
      })

      const user = await usersService.createUser({
        name: "John Doe",
        email: "john@example.com",
      })

      expect(user).toEqual({
        id: "user-1",
        name: "John Doe",
        email: "john@example.com",
      })
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          name: "John Doe",
          email: "john@example.com",
        },
      })
    })

    it("throws UserEmailAlreadyExistsError when unique constraint is violated (P2002)", async () => {
      mockCreate.mockRejectedValueOnce({
        code: "P2002",
        message: "Unique constraint failed on the fields: (`email`)",
      })

      await expect(
        usersService.createUser({
          name: "John Duplicate",
          email: "john@example.com",
        })
      ).rejects.toThrow(UserEmailAlreadyExistsError)
    })

    it("rethrows generic database errors", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Connection terminated"))

      await expect(
        usersService.createUser({
          name: "John Error",
          email: "john@example.com",
        })
      ).rejects.toThrow("Connection terminated")
    })
  })

  describe("getUserById", () => {
    it("finds user by id", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "user-1",
        name: "John Doe",
        email: "john@example.com",
      })

      const user = await usersService.getUserById("user-1")

      expect(user).toEqual({
        id: "user-1",
        name: "John Doe",
        email: "john@example.com",
      })
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
      })
    })

    it("returns null when user not found", async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const user = await usersService.getUserById("user-unknown")

      expect(user).toBeNull()
    })
  })
})
