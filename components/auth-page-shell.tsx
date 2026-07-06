import type { ReactNode } from "react"
import Link from "next/link"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type AuthPageShellProps = {
  children: ReactNode
  badge: string
  panelTitle: string
  panelDescription: string
  className?: string
}

const supportCards = [
  {
    title: "Secure auth",
    description: "WorkOS-backed access for every account.",
  },
  {
    title: "Billing ready",
    description: "Balance, invoices, and payments in one console.",
  },
  {
    title: "Support panel",
    description: "Tickets and services stay visible after sign-in.",
  },
]

export function AuthPageShell({
  children,
  badge,
  panelTitle,
  panelDescription,
  className,
}: AuthPageShellProps) {
  return (
    <main className="relative flex min-h-svh items-center overflow-hidden bg-[#060b18] px-6 py-10 text-white md:px-10">
      <div className="absolute inset-0 bg-[#060b18]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.15),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(6,182,212,0.08),transparent)]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute top-1/4 left-1/4 h-96 w-96 animate-pulse rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute right-1/4 bottom-1/4 h-80 w-80 animate-pulse rounded-full bg-cyan-500/10 blur-3xl [animation-delay:1s]" />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:block">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">
              {badge}
            </span>
          </div>
          <h1 className="text-4xl leading-tight font-bold tracking-tight text-white xl:text-5xl">
            Access your <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">PFNApp</span> workspace
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/55">
            {panelDescription}
          </p>
          <div className="mt-10 grid gap-3 xl:grid-cols-3">
            {supportCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
              >
                <div className="mb-3 h-2 w-10 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" />
                <h2 className="text-sm font-semibold text-white">
                  {card.title}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-white/45">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="w-full lg:justify-self-end">
          <Card className={cn("w-full border-white/10 bg-card/95 py-0 text-card-foreground shadow-2xl shadow-black/30 backdrop-blur", className)}>
            <CardContent className="p-6 md:p-8">
              <Link
                href="/"
                className="mb-8 flex items-center justify-center gap-2.5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 text-sm font-bold text-white shadow-lg shadow-emerald-500/30">
                  P
                </span>
                <span className="text-lg font-bold tracking-tight text-foreground">
                  PFN<span className="text-emerald-500">App</span>
                </span>
              </Link>
              <div className="mb-6 text-center">
                <p className="text-xs font-semibold tracking-widest text-emerald-600 uppercase">
                  {badge}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {panelTitle}
                </h2>
              </div>
              {children}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
