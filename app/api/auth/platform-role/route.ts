import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"
import { getPlatformRoleForUser } from "@/lib/platform-role"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = async () => {
  const auth = await withAuth()

  if (!auth.user) {
    return NextResponse.json({ role: "none" })
  }

  const role = await getPlatformRoleForUser({
    id: auth.user.id,
    email: auth.user.email,
  })

  return NextResponse.json({ role })
}
