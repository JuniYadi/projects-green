"use client"

import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

export type DeployMorphScreen = "chat" | "launch" | "summary" | "rollout"

export type DeployMorphContainerProps = {
  screen: DeployMorphScreen
  children?: ReactNode
  className?: string
}

export function DeployMorphContainer({
  screen,
  children,
  className,
}: DeployMorphContainerProps) {
  return (
    <div
      data-testid="deploy-morph-container"
      data-screen={screen}
      className={cn(
        "relative mx-auto w-full transition-all duration-300 ease-in-out",
        screen === "chat" && "deploy-screen-chat max-w-4xl",
        (screen === "launch" || screen === "summary") &&
          "deploy-screen-launch max-w-4xl",
        screen === "rollout" && "deploy-screen-rollout max-w-5xl",
        className
      )}
    >
      <div className="w-full transition-opacity duration-300">{children}</div>
    </div>
  )
}
