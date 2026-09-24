"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { SecurityArtifactsTab } from "./security-artifacts-tab"
import type {
  ContainerImageDTO,
  SecurityScanSummaryDTO,
  SecurityScanFindingDTO,
} from "@/modules/deploy/security-artifacts.dto"

export function SecurityArtifactsTabSection({
  slug,
  planTier,
}: {
  slug: string
  planTier?: string | null
}) {
  const [images, setImages] = useState<ContainerImageDTO[]>([])
  const [activeScan, setActiveScan] = useState<SecurityScanSummaryDTO | null>(
    null
  )
  const [findings, setFindings] = useState<SecurityScanFindingDTO[]>([])
  const [totalFindings, setTotalFindings] = useState(0)
  const [registryRepository, setRegistryRepository] = useState<
    string | undefined
  >()
  const [loading, setLoading] = useState(true)
  const [isRollingBack, setIsRollingBack] = useState(false)
  const [reloadTrigger, setReloadTrigger] = useState(0)
  const params = useParams<{ lang?: string }>()
  const t = getMessages(
    resolveLocaleOrDefault(params?.lang)
  ).pDeploySecurityArtifactsTabSection

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [imagesRes, overviewRes] = await Promise.all([
          fetch(`/api/deploy/stacks/${slug}/images`),
          fetch(`/api/deploy/stacks/${slug}/security-overview`),
        ])

        let loadedImages: ContainerImageDTO[] = []
        let loadedScan: SecurityScanSummaryDTO | null = null

        if (imagesRes.ok) {
          const imagesData = await imagesRes.json()
          if (imagesData.ok && Array.isArray(imagesData.data)) {
            loadedImages = imagesData.data
            if (active) setImages(loadedImages)
          }
        }

        if (overviewRes.ok) {
          const overviewData = await overviewRes.json()
          if (overviewData.ok && overviewData.data) {
            if (overviewData.data.latestScan) {
              loadedScan = overviewData.data.latestScan
              if (active) setActiveScan(loadedScan)
            }
            if (overviewData.data.registryRepository && active) {
              setRegistryRepository(overviewData.data.registryRepository)
            }
          }
        }

        // If active scan exists, fetch findings
        const targetScanId =
          loadedScan?.id ||
          loadedImages.find((i) => i.securityScan)?.securityScan?.id

        if (targetScanId) {
          const findingsRes = await fetch(
            `/api/deploy/stacks/${slug}/scans/${targetScanId}/findings?limit=100`
          )
          if (findingsRes.ok) {
            const findingsData = await findingsRes.json()
            if (findingsData.ok && Array.isArray(findingsData.data?.findings)) {
              if (active) {
                setFindings(findingsData.data.findings)
                setTotalFindings(
                  findingsData.data.total || findingsData.data.findings.length
                )
              }
            }
          }
        }
      } catch (err) {
        console.error(
          "[SecurityArtifactsTabSection] Failed to load security artifacts:",
          err
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [slug, reloadTrigger])

  const handleRollback = async (imageId: string) => {
    try {
      setIsRollingBack(true)
      const res = await fetch(
        `/api/deploy/stacks/${slug}/images/${imageId}/rollback`,
        {
          method: "POST",
        }
      )
      const data = await res.json()
      if (res.ok && data.ok) {
        setReloadTrigger((n) => n + 1)
      } else {
        alert(data.error || "Rollback failed")
      }
    } catch (err) {
      console.error("[SecurityArtifactsTabSection] Rollback error:", err)
      alert("Failed to execute rollback.")
    } finally {
      setIsRollingBack(false)
    }
  }

  const handleDownloadReport = async () => {
    if (!activeScan) return
    try {
      const res = await fetch(
        `/api/deploy/stacks/${slug}/scans/${activeScan.id}/download`
      )
      const data = await res.json()
      if (res.ok && data.ok && data.data?.downloadUrl) {
        window.open(data.data.downloadUrl, "_blank")
      } else {
        alert("Report download URL could not be generated.")
      }
    } catch (err) {
      console.error("[SecurityArtifactsTabSection] Download error:", err)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-xs text-muted-foreground">
        {t.loadingLabel}
      </div>
    )
  }

  return (
    <SecurityArtifactsTab
      stackSlug={slug}
      images={images}
      activeScan={activeScan}
      findings={findings}
      totalFindings={totalFindings}
      registryRepository={registryRepository}
      onRollback={handleRollback}
      onDownloadReport={activeScan ? handleDownloadReport : undefined}
      isRollingBack={isRollingBack}
      planTier={planTier}
    />
  )
}
