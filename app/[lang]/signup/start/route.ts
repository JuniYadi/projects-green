import { NextRequest, NextResponse } from "next/server"

import { getRequestUrl } from "@/lib/request-url"

export const GET = async (request: NextRequest) => {
  const targetUrl = getRequestUrl(
    request.nextUrl.pathname + request.nextUrl.search,
    request
  )
  targetUrl.pathname = targetUrl.pathname.replace(
    /\/signup\/start$/,
    "/login/start"
  )
  targetUrl.searchParams.set("intent", "signup")

  return NextResponse.redirect(targetUrl)
}
