import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const args = process.argv.slice(2)

const getArgValue = (name) => {
  const match = args.find((item) => item.startsWith(`${name}=`))
  if (!match) {
    return null
  }

  const [, value] = match.split("=")
  return value?.trim() || null
}

const workosUserId = getArgValue("--workos-user-id")
const emailRaw = getArgValue("--email")
const email = emailRaw ? emailRaw.toLowerCase() : null

if (!workosUserId) {
  console.error(
    "Missing required argument: --workos-user-id=<workos_user_id>"
  )
  process.exit(1)
}

try {
  const role = await prisma.platformUserRole.upsert({
    where: {
      workosUserId,
    },
    create: {
      workosUserId,
      email,
      role: "SUPER_ADMIN",
    },
    update: {
      email,
      role: "SUPER_ADMIN",
    },
  })

  console.log("Granted SUPER_ADMIN role:", {
    id: role.id,
    workosUserId: role.workosUserId,
    email: role.email,
    role: role.role,
  })
} catch (error) {
  console.error("Failed to grant SUPER_ADMIN role.")
  if (error instanceof Error) {
    console.error(error.message)
  }
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
