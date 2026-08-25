/**
 * Template Delete Dialog — Confirmation dialog with loading state
 */

"use client"
import { WhatsAppText } from "@/modules/whatsapp/ui/whatsapp-text"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type TemplateDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateName: string
  deleting: boolean
  onConfirm: () => void
}

export function TemplateDeleteDialog({
  open,
  onOpenChange,
  templateName,
  deleting,
  onConfirm,
}: TemplateDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <WhatsAppText id="s259" />
          </DialogTitle>
          <DialogDescription>
            <WhatsAppText id="s260" />
            <strong>{templateName}</strong>
            <WhatsAppText id="s261" />
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            <WhatsAppText id="s15" />
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
