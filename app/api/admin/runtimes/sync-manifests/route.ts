import { NextResponse } from "next/server"

import {
  isAuthorizedForManifestSync,
} from "@/modules/deploy/api/routes/runtime-manifest-sync.route"
import { syncRuntimeManifests } from "@/modules/deploy/runtime-manifest.service"

export async function POST(request: Request) {
  let rawBody = ""
  try {
    rawBody = await request.clone().text()
  } catch {
    rawBody = ""
  }

  const setObj: { status?: number } = {}
  const authorized = await isAuthorizedForManifestSync(
    request.headers,
    rawBody,
    setObj
  )

  if (!authorized) {
    return NextResponse.json(
      {
        ok: false,
        error: "UNAUTHORIZED",
        message: "Missing super admin access or valid sync credentials.",
      },
      { status: setObj.status ?? 401 }
    )
  }

  try {
    const body = rawBody ? JSON.parse(rawBody) : {}
    const synced = await syncRuntimeManifests(body)
    return NextResponse.json({
      ok: true,
      data: synced,
      count: synced.length,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_MANIFEST",
        message:
          error instanceof Error
            ? error.message
            : "Invalid runtime manifest schema",
      },
      { status: 400 }
    )
  }
}
