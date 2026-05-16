import { prisma } from "@/lib/prisma"

export class UserEmailAlreadyExistsError extends Error {
  constructor() {
    super("This email address is already in use.")
    this.name = "UserEmailAlreadyExistsError"
  }
}

const isPrismaUniqueError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false
  }

  return "code" in error && error.code === "P2002"
}

export type UsersService = {
  createUser(input: { name: string; email: string }): Promise<{
    id: string
    name: string
    email: string
  }>
  getUserById(id: string): Promise<{
    id: string
    name: string
    email: string
  } | null>
}

export const usersService: UsersService = {
  async createUser(input) {
    try {
      return await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
        },
      })
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        throw new UserEmailAlreadyExistsError()
      }

      throw error
    }
  },
  async getUserById(id) {
    return prisma.user.findUnique({
      where: {
        id,
      },
    })
  },
}
