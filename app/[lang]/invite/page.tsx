import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { BrandLogo } from "@/components/brand-logo"

import { Button } from "@/components/ui/button"
import {
  INVITE_COOKIE_MAX_AGE,
  INVITE_COOKIE_NAME,
} from "@/modules/auth/invite-cookie"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"
import type { AppLocale } from "@/lib/i18n/config"
import {
  acceptTenantInvitation,
  findTenantInvitationByToken,
  getTenantOrganizationById,
} from "@/modules/tenants/services/tenant-workos.service"
import { APP_NAME } from "@/lib/app-config"

export const metadata: Metadata = { title: "Invitation" }

type InvitePageProps = {
  params: Promise<{ lang: string }>
  searchParams?: Promise<{
    invitation_token?: string
    invitationToken?: string
  }>
}

type ResolvedInvitation = {
  id: string
  token: string
  email: string
  organizationName: string | null
  state: string
  expired: boolean
}

const resolveInvitation = async (
  token: string
): Promise<ResolvedInvitation | null> => {
  const invitation = await findTenantInvitationByToken(token).catch(() => null)

  if (!invitation) {
    return null
  }

  const organization = invitation.organizationId
    ? await getTenantOrganizationById(invitation.organizationId).catch(
        () => null
      )
    : null

  const expired = new Date(invitation.expiresAt).getTime() < Date.now()

  return {
    id: invitation.id,
    token,
    email: invitation.email,
    organizationName: organization?.name ?? null,
    state: invitation.state,
    expired,
  }
}

const persistInviteToken = async (token: string) => {
  const cookieStore = await cookies()
  cookieStore.set(INVITE_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: INVITE_COOKIE_MAX_AGE,
  })
}

export default async function InvitePage({
  params,
  searchParams,
}: InvitePageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale).pAuthPages.invite
  const search = await searchParams
  const token = (search?.invitation_token ?? search?.invitationToken)?.trim()

  if (!token) {
    redirect(localizePathname({ pathname: "/login", locale }))
  }

  const invitation = await resolveInvitation(token)
  const consolePath = localizePathname({ pathname: "/console", locale })
  const nextParam = encodeURIComponent(consolePath)

  // Already-authenticated invitee (e.g. a user who already belongs to another
  // organization). Accept the invitation server-side, then send them to the
  // console where the org switcher surfaces the newly joined organization.
  if (invitation && invitation.state === "pending" && !invitation.expired) {
    const auth = await withAuth()
    if (auth.user) {
      await acceptTenantInvitation(invitation.id).catch(() => null)
      redirect(consolePath)
    }
  }

  const continueWithEmail = async () => {
    "use server"
    await persistInviteToken(token)
    redirect(
      `${localizePathname({ pathname: "/login", locale })}?next=${nextParam}`
    )
  }

  const continueWithProvider = async (formData: FormData) => {
    "use server"
    const provider = String(formData.get("provider") ?? "")
    await persistInviteToken(token)
    redirect(
      `${localizePathname({ pathname: "/login/start", locale })}?next=${nextParam}&provider=${provider}`
    )
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <a
          href={localizePathname({ pathname: "/", locale })}
          className="flex items-center justify-center gap-2.5 self-center font-medium"
        >
          <BrandLogo size="md" />
        </a>

        {!invitation ? (
          <InviteUnavailable locale={locale} />
        ) : invitation.state !== "pending" || invitation.expired ? (
          <InviteInactive invitation={invitation} locale={locale} />
        ) : (
          <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-2 text-center">
              <h1 className="text-xl font-semibold">
                {invitation.organizationName
                  ? messages.invitedToJoin.replace(
                      "{org}",
                      invitation.organizationName
                    )
                  : messages.youveBeenInvited}
              </h1>
              <p className="text-sm text-muted-foreground">
                {messages.acceptInvitationFor}{" "}
                <span className="font-medium text-foreground">
                  {invitation.email}
                </span>{" "}
                {messages.bySigningIn}
              </p>
            </div>

            <form action={continueWithEmail} className="flex flex-col gap-3">
              <Button type="submit" className="w-full">
                {messages.continueWithEmailCode}
              </Button>
            </form>

            <div className="relative text-center text-xs text-muted-foreground">
              <span className="bg-card px-2">{messages.orContinueWith}</span>
            </div>

            <div className="flex flex-col gap-2">
              {(["google", "github", "apple"] as const).map((provider) => (
                <form key={provider} action={continueWithProvider}>
                  <input type="hidden" name="provider" value={provider} />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full capitalize"
                  >
                    {messages.continueWith} {provider}
                  </Button>
                </form>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InviteUnavailable({ locale }: { locale: AppLocale }) {
  const messages = getMessages(locale).pAuthPages.invite
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
      <h1 className="text-xl font-semibold">{messages.invitationNotFound}</h1>
      <p className="text-sm text-muted-foreground">
        {messages.invitationNotFoundDesc}
      </p>
      <Button asChild variant="outline" className="w-full">
        <a href={localizePathname({ pathname: "/login", locale })}>
          {messages.goToSignIn}
        </a>
      </Button>
    </div>
  )
}

function InviteInactive({
  invitation,
  locale,
}: {
  invitation: ResolvedInvitation
  locale: AppLocale
}) {
  const messages = getMessages(locale).pAuthPages.invite
  const reason = invitation.expired
    ? messages.expired
    : invitation.state === "accepted"
      ? messages.accepted
      : invitation.state === "revoked"
        ? messages.revoked
        : messages.inactive

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
      <h1 className="text-xl font-semibold">
        {messages.invitationUnavailable}
      </h1>
      <p className="text-sm text-muted-foreground">{reason}</p>
      <Button asChild variant="outline" className="w-full">
        <a href={localizePathname({ pathname: "/login", locale })}>
          {messages.goToSignIn}
        </a>
      </Button>
    </div>
  )
}
