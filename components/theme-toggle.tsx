"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Sun, Moon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"

function useIsMounted() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const mounted = useIsMounted()

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="size-9 rounded-xl border-border/60 bg-card/60"
        aria-label="Toggle theme"
        disabled
      >
        <span className="size-4" />
      </Button>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="size-9 rounded-xl border-border/60 bg-card/60 shadow-sm backdrop-blur-sm transition-all hover:bg-muted"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun
          size={17}
          weight="bold"
          className="text-amber-400 transition-transform duration-200 hover:rotate-45"
        />
      ) : (
        <Moon
          size={17}
          weight="bold"
          className="text-foreground transition-transform duration-200 hover:-rotate-12"
        />
      )}
    </Button>
  )
}
