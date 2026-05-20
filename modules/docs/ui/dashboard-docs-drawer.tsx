"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type {
  UiDocErrorResponse,
  UiDocSuccessResponse,
} from "@/modules/docs/docs.types"

const CONSOLE_PATH = "/console"

type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: UiDocSuccessResponse }
  | { status: "error"; message: string }

const getErrorMessage = (payload: UiDocErrorResponse | null) => {
  if (payload?.message) {
    return payload.message
  }

  return "Unable to load documentation right now."
}

export function DashboardDocsDrawer() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [state, setState] = useState<RequestState>({ status: "idle" })

  const isOpen = searchParams.get("doc") === "1"

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let isActive = true
    const controller = new AbortController()

    const loadDoc = async () => {
      setState({ status: "loading" })

      try {
        const response = await fetch(
          `/api/docs?path=${encodeURIComponent(CONSOLE_PATH)}`,
          {
            signal: controller.signal,
          }
        )

        const payload = (await response.json().catch(() => null)) as
          | UiDocSuccessResponse
          | UiDocErrorResponse
          | null

        if (!isActive) {
          return
        }

        if (!response.ok || !payload || payload.ok !== true) {
          setState({
            status: "error",
            message: getErrorMessage(payload as UiDocErrorResponse | null),
          })
          return
        }

        setState({ status: "success", data: payload })
      } catch (error) {
        if (!isActive || controller.signal.aborted) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unable to load documentation right now."

        setState({
          status: "error",
          message,
        })
      }
    }

    void loadDoc()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [isOpen])

  const openDrawer = () => {
    const next = new URLSearchParams(searchParams.toString())
    next.set("doc", "1")

    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const closeDrawer = () => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete("doc")

    const query = next.toString()
    const destination = query ? `${pathname}?${query}` : pathname

    router.replace(destination, { scroll: false })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDrawer}>
        Documentation
      </Button>

      <Sheet
        open={isOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            openDrawer()
            return
          }

          closeDrawer()
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Page Documentation</SheetTitle>
            <SheetDescription>
              Purpose and usage guide for {CONSOLE_PATH}
            </SheetDescription>
          </SheetHeader>

          <div className="flex h-full flex-col gap-4 overflow-y-auto px-4 pb-4">
            {state.status === "idle" || state.status === "loading" ? (
              <p className="text-sm text-muted-foreground">
                Loading documentation...
              </p>
            ) : null}

            {state.status === "error" ? (
              <p className="text-sm text-destructive">{state.message}</p>
            ) : null}

            {state.status === "success" ? (
              <>
                <section className="space-y-1">
                  <h3 className="text-sm font-semibold">{state.data.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {state.data.purpose}
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    How To Use
                  </h4>
                  <ol className="list-decimal space-y-1 pl-5 text-sm">
                    {state.data.howTo.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </section>

                {state.data.notes?.length ? (
                  <section className="space-y-2">
                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Notes
                    </h4>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {state.data.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  Updated: {state.data.updatedAt}
                </p>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
