"use client"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { ResourcePlanId, ResourceSelection } from "./ai-deploy.types"

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (selection: ResourceSelection) => Promise<void>
  currentPlanId?: ResourcePlanId
  recommendedPlanId?: ResourcePlanId
  isSaving?: boolean
}
const plans = {
  starter: { name: "Starter", price: "$0.02/hr", detail: "250m CPU / 512MB" },
  pro: { name: "Pro", price: "$0.08/hr", detail: "500m CPU / 1024MB" },
  payg: { name: "PAYG", price: "~$0.04/hr", detail: "1000m CPU / 2048MB" },
}
export function ResourceSizeDialog({
  open,
  onClose,
  onSelect,
  currentPlanId,
  recommendedPlanId = "pro",
  isSaving,
}: Props) {
  const order = [
    recommendedPlanId,
    ...(["payg", "starter"] as ResourcePlanId[]).filter(
      (p) => p !== recommendedPlanId
    ),
  ]
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose resources</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {order.map((id, i) => (
            <section key={id}>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
                {i === 0
                  ? "Recommended"
                  : id === "payg"
                    ? "Larger than recommended"
                    : "Other options"}
              </h3>
              <div
                className={`rounded-xl border p-4 ${id === currentPlanId ? "border-primary bg-primary/10" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {plans[id].name}
                      {id === recommendedPlanId && <Badge>Recommended</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {plans[id].detail} · {plans[id].price}
                    </p>
                  </div>
                  <Button
                    disabled={isSaving}
                    onClick={() =>
                      onSelect({
                        resourcePlanId: id,
                        cpu: id === "payg" ? 1000 : 500,
                        memory: id === "payg" ? 2048 : 1024,
                      })
                    }
                  >
                    Use this
                  </Button>
                </div>
              </div>
            </section>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
