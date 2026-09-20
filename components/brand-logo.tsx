import React from "react"
import { cn } from "@/lib/utils"

interface BrandLogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
  showText?: boolean
  textColor?: string
}

export function BrandLogoIcon({
  className,
  size = "md",
}: {
  className?: string
  size?: "sm" | "md" | "lg"
}) {
  const sizeClasses = {
    sm: "size-7 rounded-lg",
    md: "size-8 rounded-lg",
    lg: "size-10 rounded-xl",
  }

  const iconSizes = {
    sm: 18,
    md: 20,
    lg: 24,
  }

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/20",
        sizeClasses[size],
        className
      )}
      aria-hidden="true"
    >
      <svg
        width={iconSizes[size]}
        height={iconSizes[size]}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-white drop-shadow-sm"
      >
        {/* Modern abstract geometric P-F-N network nodes */}
        <path
          d="M4 5C4 4.44772 4.44772 4 5 4H14C16.7614 4 19 6.23858 19 9C19 11.7614 16.7614 14 14 14H8V19C8 19.5523 7.55228 20 7 20H5C4.44772 20 4 19.5523 4 19V5Z"
          fill="currentColor"
          fillOpacity="0.2"
        />
        <path
          d="M5 4H13.5C16.2614 4 18.5 6.23858 18.5 9C18.5 11.7614 16.2614 14 13.5 14H8V20H5V4Z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 9H13.5C14.0523 9 14.5 8.55228 14.5 8C14.5 7.44772 14.0523 7 13.5 7H8V9Z"
          fill="currentColor"
        />
        <circle cx="17.5" cy="17.5" r="2.5" fill="currentColor" />
        <path
          d="M13.5 14L15.5 16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export function BrandLogo({
  className,
  size = "md",
  showText = true,
  textColor,
}: BrandLogoProps) {
  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  }

  return (
    <div
      className={cn("inline-flex items-center gap-2.5 select-none", className)}
    >
      <BrandLogoIcon size={size} />
      {showText && (
        <span
          className={cn(
            "font-semibold tracking-tight",
            textSizes[size],
            textColor ?? "text-foreground"
          )}
        >
          PFN<span className="text-emerald-500">App</span>
        </span>
      )}
    </div>
  )
}
