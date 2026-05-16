import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client/index"

const DATABASE_URL = process.env.DATABASE_URL?.trim()

if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL environment variable")
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: DATABASE_URL,
    }),
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
