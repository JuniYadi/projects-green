"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  FileText,
  DownloadSimple,
  ImageBroken,
  Sparkle,
  FilePdf,
  FileZip,
  FileCode,
} from "@phosphor-icons/react"
import { Skeleton } from "@/components/ui/skeleton"
import { eden } from "@/lib/eden"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type CDNAssetType =
  | "auto"
  | "image"
  | "sticker"
  | "document"
  | "audio"
  | "video"

export interface CDNAssetProps extends React.HTMLAttributes<HTMLDivElement> {
  url?: string | null
  type?: CDNAssetType
  filename?: string | null
  alt?: string
  imageClassName?: string
  skeletonClassName?: string
  fallbackIcon?: "sticker" | "image" | "document"
}

/**
 * Check whether a URL requires presigning GET (private CDN or S3)
 */
export function isPrivateCdnUrl(url?: string | null): boolean {
  if (!url) return false
  return (
    url.includes("cdn.pfnapp.id") ||
    url.startsWith("__stored:") ||
    url.includes(".s3.") ||
    url.includes("/storage/")
  )
}

/**
 * Detect asset type from URL extension or filename
 */
export function detectAssetType(
  url?: string | null,
  filename?: string | null
): CDNAssetType {
  const target = (filename || url || "").toLowerCase()
  if (
    target.endsWith(".webp") ||
    target.includes("_media.webp") ||
    target.includes("sticker")
  ) {
    return "sticker"
  }
  if (/\.(jpg|jpeg|png|gif|svg|avif)($|\?)/.test(target)) {
    return "image"
  }
  if (/\.(mp3|ogg|opus|wav|m4a)($|\?)/.test(target)) {
    return "audio"
  }
  if (/\.(mp4|webm|mov|mkv)($|\?)/.test(target)) {
    return "video"
  }
  if (/\.(pdf|doc|docx|xls|xlsx|csv|zip|rar|txt)($|\?)/.test(target)) {
    return "document"
  }
  return "image"
}

/**
 * Fetch presigned GET view URL from the server
 */
export async function fetchPresignedUrl(rawUrl: string): Promise<string> {
  if (rawUrl.startsWith("__stored:")) {
    const mediaId = rawUrl.replace("__stored:", "")
    return `/api/whatsapp/media/${mediaId}/download`
  }

  try {
    const parsed = new URL(rawUrl)
    const storageKey = parsed.pathname.replace(/^\/+/, "")
    const { data, error } = await eden.api.storage.s3["view-url"].get({
      $query: { storageKey },
    })
    if (error || !data || !("viewUrl" in data))
      throw new Error("Presign failed")
    return data.viewUrl || rawUrl
  } catch {
    return rawUrl
  }
}

function getDocumentIcon(name: string) {
  const lower = name.toLowerCase()
  if (lower.endsWith(".pdf")) {
    return <FilePdf className="size-6 text-rose-500" />
  }
  if (lower.endsWith(".zip") || lower.endsWith(".rar")) {
    return <FileZip className="size-6 text-amber-500" />
  }
  if (
    lower.endsWith(".json") ||
    lower.endsWith(".js") ||
    lower.endsWith(".ts")
  ) {
    return <FileCode className="size-6 text-blue-500" />
  }
  return <FileText className="size-6 text-muted-foreground" />
}

export function CDNAsset({
  url,
  type = "auto",
  filename,
  alt = "Media asset",
  className,
  imageClassName,
  skeletonClassName,
  fallbackIcon,
  ...props
}: CDNAssetProps) {
  const needsPresign = isPrivateCdnUrl(url)
  const resolvedType = type === "auto" ? detectAssetType(url, filename) : type

  const {
    data: resolvedUrl,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["cdn-asset-presign", url],
    queryFn: () => fetchPresignedUrl(url!),
    enabled: Boolean(url && needsPresign),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
  })

  // 1. Without URL
  if (!url) {
    return (
      <div
        className={cn(
          "flex size-24 items-center justify-center rounded-lg border border-border/40 bg-muted/20 text-muted-foreground",
          className
        )}
        {...props}
      >
        {resolvedType === "sticker" || fallbackIcon === "sticker" ? (
          <Sparkle className="size-6 opacity-40" />
        ) : resolvedType === "document" || fallbackIcon === "document" ? (
          <FileText className="size-6 opacity-40" />
        ) : (
          <ImageBroken className="size-6 opacity-40" />
        )}
      </div>
    )
  }

  // 2. Loading State (Skeleton)
  if (needsPresign && isLoading) {
    if (resolvedType === "document") {
      return (
        <div
          className={cn(
            "flex w-64 items-center gap-3 rounded-lg border border-border/60 bg-card p-3",
            className
          )}
        >
          <Skeleton className="size-9 shrink-0 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      )
    }

    return (
      <Skeleton
        className={cn(
          resolvedType === "sticker" ? "size-32" : "h-48 w-full max-w-xs",
          "animate-pulse rounded-lg",
          skeletonClassName || className
        )}
      />
    )
  }

  // 3. Error State
  if (needsPresign && isError) {
    return (
      <div
        className={cn(
          "flex size-28 flex-col items-center justify-center gap-1 rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-center text-xs text-destructive",
          className
        )}
        {...props}
      >
        <ImageBroken className="size-5 shrink-0" />
        <span className="text-[10px] leading-tight">Gagal memuat media</span>
      </div>
    )
  }

  const finalSrc = needsPresign ? resolvedUrl : url
  const displayFilename =
    filename || url.split("/").pop()?.split("?")[0] || "Document"

  // 4. Render Document (Card with Download Button)
  if (resolvedType === "document") {
    return (
      <div
        className={cn(
          "flex max-w-sm items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/60 p-2.5 backdrop-blur-sm transition-colors hover:bg-card",
          className
        )}
        {...props}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/40 bg-muted/40">
            {getDocumentIcon(displayFilename)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">
              {displayFilename}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase">
              {displayFilename.split(".").pop() || "FILE"}
            </p>
          </div>
        </div>

        <Button
          size="xs"
          variant="outline"
          asChild
          className="shrink-0 gap-1 rounded-md"
        >
          <a
            href={finalSrc || url}
            target="_blank"
            rel="noopener noreferrer"
            download={displayFilename}
          >
            <DownloadSimple className="size-3.5" />
            <span>Unduh</span>
          </a>
        </Button>
      </div>
    )
  }

  // 5. Render Sticker & Image (Direct Preview)
  return (
    <div className={cn("overflow-hidden", className)} {...props}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={finalSrc || url}
        alt={alt}
        loading="lazy"
        className={cn(
          resolvedType === "sticker"
            ? "size-32 object-contain"
            : "max-h-60 max-w-full rounded-md object-contain",
          imageClassName
        )}
      />
    </div>
  )
}
