"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { FiX } from "react-icons/fi"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { eden } from "@/lib/eden"
import { getMessages } from "@/lib/i18n/messages"
import { isLocale, localizePathname } from "@/lib/i18n/pathname"
import { type AppLocale } from "@/lib/i18n/config"
import type { AppMessages } from "@/lib/i18n/messages/types"

type SetupStatusMessages = AppMessages["console"]["billing"]["setupStatus"]

type PrerequisiteKey = "gateways" | "bank-accounts" | "currencies"

type Prerequisite = {
  key: PrerequisiteKey
  label: string
  isMissing: () => Promise<boolean>
  fixHref: string
}

type BillingSetupStatusOptions = {
  locale: AppLocale
  prerequisites?: Prerequisite[]
  ttlMs?: number
}

type BillingSetupStatusState = {
  missing: Prerequisite[]
  loading: boolean
  error: Error | null
}

const BILLING_SETUP_STATUS_INVALIDATE_EVENT = "billing-setup-status:invalidate"

export const invalidateBillingSetupStatus = (): void => {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(BILLING_SETUP_STATUS_INVALIDATE_EVENT))
}

const DISMISSED_KEY = "billing-setup-status-dismissed"
const DEFAULT_TTL_MS = 60_000

const readCache = (
  locale: AppLocale,
  ttlMs: number
): { at: number; missing: string[] } | null => {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(
      `billing-setup-status:${locale}:${ttlMs}`
    )
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; missing: string[] }
    if (Date.now() - parsed.at > ttlMs) return null
    return parsed
  } catch {
    return null
  }
}

const writeCache = (locale: AppLocale, ttlMs: number, missing: string[]) => {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(
      `billing-setup-status:${locale}:${ttlMs}`,
      JSON.stringify({ at: Date.now(), missing })
    )
  } catch {
    // ignore quota or private mode failures
  }
}

const checkEmpty = async (
  fetcher: () => Promise<{ status: number; data?: unknown[] }>,
  hasValidItem: (item: unknown) => boolean = () => true
): Promise<boolean> => {
  try {
    const res = await fetcher()
    if (res.status !== 200) return true
    return !Array.isArray(res.data) || !res.data.some(hasValidItem)
  } catch {
    return true
  }
}

const isActiveGateway = (item: unknown): boolean => {
  return Boolean(
    item &&
    typeof item === "object" &&
    item !== null &&
    "isActive" in item &&
    (item as { isActive: boolean }).isActive
  )
}

const buildDefaultPrerequisites = (): Prerequisite[] => [
  {
    key: "gateways",
    label: "gateways",
    fixHref: "/portal/billing/payments?tab=gateways",
    isMissing: () =>
      checkEmpty(async () => {
        const r = await eden.api.portal.payments.gateways.get()
        return {
          status: r.status,
          data: r.data as unknown[] | undefined,
        }
      }, isActiveGateway),
  },
  {
    key: "bank-accounts",
    label: "bank-accounts",
    fixHref: "/portal/billing/payments?tab=bank-accounts",
    isMissing: () =>
      checkEmpty(async () => {
        const r = await eden.api.portal.payments["bank-accounts"].get()
        return {
          status: r.status,
          data: r.data as unknown[] | undefined,
        }
      }),
  },
  {
    key: "currencies",
    label: "currencies",
    fixHref: "/portal/billing/payments?tab=currencies",
    isMissing: () =>
      checkEmpty(async () => {
        const r = await eden.api.portal.payments.currencies.get()
        return {
          status: r.status,
          data: r.data as unknown[] | undefined,
        }
      }),
  },
]

export const useBillingSetupStatus = (
  options: BillingSetupStatusOptions
): BillingSetupStatusState => {
  const [state, setState] = useState<BillingSetupStatusState>(() => {
    const cached = readCache(options.locale, options.ttlMs ?? DEFAULT_TTL_MS)
    if (!cached) return { missing: [], loading: true, error: null }
    const defaultPrereqs = buildDefaultPrerequisites()
    return {
      missing: defaultPrereqs.filter((p) => cached.missing.includes(p.key)),
      loading: false,
      error: null,
    }
  })
  const [refreshVersion, setRefreshVersion] = useState(0)

  const prerequisites = useMemo(
    () => options.prerequisites ?? buildDefaultPrerequisites(),
    [options.prerequisites]
  )
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS

  useEffect(() => {
    let cancelled = false
    Promise.all(
      prerequisites.map(async (prereq) => ({
        key: prereq.key,
        missing: await prereq.isMissing(),
      }))
    )
      .then((results) => {
        if (cancelled) return
        const missing = prerequisites.filter((_, idx) => results[idx]?.missing)
        writeCache(
          options.locale,
          ttlMs,
          missing.map((m) => m.key)
        )
        setState({ missing, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          missing: [],
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        })
      })

    return () => {
      cancelled = true
    }
  }, [prerequisites, options.locale, ttlMs, refreshVersion])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handler = () => setRefreshVersion((v) => v + 1)
    window.addEventListener(BILLING_SETUP_STATUS_INVALIDATE_EVENT, handler)
    return () =>
      window.removeEventListener(BILLING_SETUP_STATUS_INVALIDATE_EVENT, handler)
  }, [])

  return state
}

type BillingSetupBannerProps = BillingSetupStatusOptions & {
  className?: string
  messages?: SetupStatusMessages
}

export function BillingSetupBanner({
  locale,
  prerequisites,
  ttlMs,
  className,
  messages,
}: BillingSetupBannerProps) {
  const t = messages ?? getMessages(locale).console.billing.setupStatus
  const { missing, loading } = useBillingSetupStatus({
    locale,
    prerequisites,
    ttlMs,
  })

  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false
    try {
      return window.sessionStorage.getItem(DISMISSED_KEY) === "true"
    } catch {
      return false
    }
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "true")
    } catch {
      // ignore storage errors
    }
  }

  if (!mounted || loading || missing.length === 0 || dismissed) {
    return null
  }

  return (
    <Alert
      variant="default"
      data-testid="billing-setup-banner"
      className={className}
      role="status"
    >
      <AlertTitle>{t.heading}</AlertTitle>
      <AlertDescription>
        <ul className="space-y-1">
          {missing.map((prereq) => {
            const localizedHref = localizePathname({
              pathname: prereq.fixHref,
              locale,
            })
            const label =
              prereq.label === "gateways"
                ? t.paymentGateway
                : prereq.label === "bank-accounts"
                  ? t.bankAccount
                  : prereq.label === "currencies"
                    ? t.currency
                    : prereq.label
            return (
              <li
                key={prereq.key}
                className="flex items-center justify-between gap-2"
              >
                <span>{label}</span>
                <Link
                  href={localizedHref}
                  className="font-medium underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {t.setup}
                </Link>
              </li>
            )
          })}
        </ul>
      </AlertDescription>
      <AlertAction>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleDismiss}
          aria-label={t.dismissWarning}
        >
          <FiX className="size-4" />
        </Button>
      </AlertAction>
    </Alert>
  )
}

type BillingSetupBannerClientProps = {
  locale: string
  className?: string
  messages?: SetupStatusMessages
}

export function BillingSetupBannerClient({
  locale,
  className,
  messages,
}: BillingSetupBannerClientProps) {
  const narrowed: AppLocale = isLocale(locale) ? locale : "en"
  return (
    <BillingSetupBanner
      locale={narrowed}
      className={className}
      messages={messages ?? getMessages(narrowed).console.billing.setupStatus}
    />
  )
}
