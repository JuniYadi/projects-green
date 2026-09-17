"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { eden } from "@/lib/eden"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { LightningIcon, CheckIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

type RuleRecommendation = {
  id: string
  suggestedName: string
  suggestedDescription: string
  suggestedPatternJson: unknown
  suggestedImplicationsJson: unknown
  suggestedConfidenceWeight: number
  suggestedPriority: number
  reasoning: string
  basedOnLogIds: string[]
}

export function Recommendations() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalDetectorRecommendations

  const [recommendations, setRecommendations] = useState<RuleRecommendation[]>(
    []
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const { data } = await eden.api.admin.detector.recommend.post()
      if (!data?.ok) {
        toast.error(data?.message || t.errorGenerate)
        return
      }
      setRecommendations(data.data)
      setHasGenerated(true)
      if (data.data.length === 0) {
        toast.info(t.noNewRecommendations)
      }
    } catch {
      toast.error(t.errorGenerate)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApprove = async (rec: RuleRecommendation) => {
    setApprovingId(rec.id)
    try {
      const { data: res } = await eden.api.admin.detector.rules.post({
        name: rec.suggestedName,
        description: rec.suggestedDescription,
        patternJson: rec.suggestedPatternJson as Record<string, unknown>,
        implicationsJson: rec.suggestedImplicationsJson as Record<
          string,
          unknown
        >,
        confidenceWeight: rec.suggestedConfidenceWeight,
        priority: rec.suggestedPriority,
      })
      if (res?.ok) {
        toast.success(t.ruleCreatedSuccess.replace("{name}", rec.suggestedName))
        setRecommendations((prev) => prev.filter((r) => r.id !== rec.id))
      } else {
        toast.error(res?.message || t.errorCreateRule)
      }
    } catch {
      toast.error(t.errorCreateRuleFromRec)
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t.description}</p>
        <Button onClick={handleGenerate} disabled={isGenerating} size="sm">
          <LightningIcon className="mr-2 h-4 w-4" />
          {isGenerating
            ? t.analyzingButton
            : hasGenerated
              ? t.reanalyzeButton
              : t.analyzeLogsButton}
        </Button>
      </div>

      {isGenerating && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {!isGenerating && hasGenerated && recommendations.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CheckIcon className="mb-4 h-12 w-12 text-emerald-500" />
            <p className="text-lg font-medium">{t.allCaughtUpTitle}</p>
            <p className="text-sm text-muted-foreground">
              {t.allCaughtUpDescription}
            </p>
          </CardContent>
        </Card>
      )}

      {recommendations.map((rec) => (
        <Card key={rec.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{rec.suggestedName}</CardTitle>
                <CardDescription>{rec.suggestedDescription}</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => handleApprove(rec)}
                disabled={approvingId === rec.id}
              >
                <CheckIcon className="mr-2 h-4 w-4" />
                {approvingId === rec.id ? t.approvingButton : t.approveButton}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">{t.aiReasoningLabel}</p>
                <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {t.confidenceLabel}:{" "}
                  {(rec.suggestedConfidenceWeight * 100).toFixed(0)}%
                </Badge>
                <Badge variant="outline">
                  {t.priorityLabel}: {rec.suggestedPriority}
                </Badge>
                <Badge variant="outline">
                  {t.basedOnLogsLabel.replace(
                    "{count}",
                    String(rec.basedOnLogIds.length)
                  )}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium">{t.suggestedPatternLabel}</p>
                <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2 text-xs">
                  {JSON.stringify(rec.suggestedPatternJson, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-sm font-medium">
                  {t.suggestedImplicationsLabel}
                </p>
                <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2 text-xs">
                  {JSON.stringify(rec.suggestedImplicationsJson, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
