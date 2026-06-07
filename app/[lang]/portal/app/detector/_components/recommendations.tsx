"use client"

import { useState } from "react"

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
  const [recommendations, setRecommendations] = useState<
    RuleRecommendation[]
  >([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch("/api/admin/detector/recommend", {
        method: "POST",
      })
      const data = await res.json()
      if (data.ok) {
        setRecommendations(data.data)
        setHasGenerated(true)
        if (data.data.length === 0) {
          toast.info(
            "No new recommendations found. The system needs more inspection data."
          )
        }
      } else {
        toast.error(data.message || "Failed to generate recommendations")
      }
    } catch {
      toast.error("Failed to generate recommendations")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApprove = async (rec: RuleRecommendation) => {
    setApprovingId(rec.id)
    try {
      const res = await fetch("/api/admin/detector/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rec.suggestedName,
          description: rec.suggestedDescription,
          patternJson: rec.suggestedPatternJson,
          implicationsJson: rec.suggestedImplicationsJson,
          confidenceWeight: rec.suggestedConfidenceWeight,
          priority: rec.suggestedPriority,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`Rule "${rec.suggestedName}" created successfully`)
        setRecommendations((prev) => prev.filter((r) => r.id !== rec.id))
      } else {
        toast.error(data.message || "Failed to create rule")
      }
    } catch {
      toast.error("Failed to create rule from recommendation")
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          AI analyzes recent inspection logs to suggest new detection rules.
        </p>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          size="sm"
        >
          <LightningIcon className="mr-2 h-4 w-4" />
          {isGenerating
            ? "Analyzing..."
            : hasGenerated
              ? "Re-analyze"
              : "Analyze Logs"}
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
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm text-muted-foreground">
              No new rule recommendations at this time. The AI needs more
              diverse inspection data to make suggestions.
            </p>
          </CardContent>
        </Card>
      )}

      {recommendations.map((rec) => (
        <Card key={rec.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">
                  {rec.suggestedName}
                </CardTitle>
                <CardDescription>
                  {rec.suggestedDescription}
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => handleApprove(rec)}
                disabled={approvingId === rec.id}
              >
                <CheckIcon className="mr-2 h-4 w-4" />
                {approvingId === rec.id ? "Approving..." : "Approve"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">AI Reasoning</p>
                <p className="text-sm text-muted-foreground">
                  {rec.reasoning}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  Confidence:{" "}
                  {(rec.suggestedConfidenceWeight * 100).toFixed(0)}%
                </Badge>
                <Badge variant="outline">
                  Priority: {rec.suggestedPriority}
                </Badge>
                <Badge variant="outline">
                  Based on {rec.basedOnLogIds.length} log
                  {rec.basedOnLogIds.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Suggested Pattern</p>
                <pre className="mt-1 rounded-md bg-muted p-2 text-xs overflow-x-auto">
                  {JSON.stringify(rec.suggestedPatternJson, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-sm font-medium">Suggested Implications</p>
                <pre className="mt-1 rounded-md bg-muted p-2 text-xs overflow-x-auto">
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
