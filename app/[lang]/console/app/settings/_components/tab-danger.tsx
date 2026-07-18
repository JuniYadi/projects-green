"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"

type TabDangerProps = {
  stack: StackSummaryDTO
}

export function TabDanger({ stack }: TabDangerProps) {
  const [confirmText, setConfirmText] = useState("")
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (confirmText !== stack.name) return
    setIsDeleting(true)
    // ponytail: delete app API not yet implemented; shows confirmation only
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsDeleting(false)
    setOpen(false)
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base text-destructive">
          Danger Zone
        </CardTitle>
        <CardDescription>
          Irreversible actions. Please proceed with caution.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <h4 className="text-sm font-semibold text-destructive">
            Delete Application
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Permanently delete{" "}
            <span className="font-semibold text-foreground">
              {stack.name}
            </span>{" "}
            and all associated data including deployments, domains, environment
            variables, and logs. This action cannot be undone.
          </p>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" className="mt-4">
                Delete Application
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete {stack.name}</DialogTitle>
                <DialogDescription>
                  This will permanently delete the application and all its data.
                  Type the application name to confirm.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Type{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                    {stack.name}
                  </code>{" "}
                  to confirm:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={stack.name}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={confirmText !== stack.name || isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting
                    ? "Deleting..."
                    : `Delete ${stack.name}`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
