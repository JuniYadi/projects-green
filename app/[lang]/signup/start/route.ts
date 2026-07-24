import { NextRequest, NextResponse } from "next/server"

export const GET = async (request: NextRequest) => {
  const targetUrl = new URL(request.url)
  targetUrl.pathname = targetUrl.pathname.replace(
    /\/signup\/start$/,
    "/login/start"
  )
  targetUrl.searchParams.set("intent", "signup")

  return NextResponse.redirect(targetUrl)
}
