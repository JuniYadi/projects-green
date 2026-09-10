/**
 * Template Delete Dialog — Confirmation dialog with loading state
 */

"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Warning } from "@phosphor-icons/react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type TemplateDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateName: string
  isApproved?: boolean
  deleting: boolean
  onConfirm: () => void
}

export function TemplateDeleteDialog({
  open,
  onOpenChange,
  templateName,
  isApproved = false,
  deleting,
  onConfirm,
}: TemplateDeleteDialogProps) {
  const [acknowledged, setAcknowledged] = React.useState(false)
  const params = useParams<{ lang?: string }>()
  const isIndonesian = params?.lang === "id"

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setAcknowledged(false)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <WhatsAppText id="s259" />
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <span>
              <WhatsAppText id="s260" />{" "}
              <strong className="text-foreground">{templateName}</strong>
              <WhatsAppText id="s261" />
            </span>
            <span className="block text-xs text-muted-foreground">
              {isIndonesian
                ? "Tindakan ini juga akan menghapus template dari Meta WhatsApp Business Account secara permanen."
                : "This action will also permanently delete the template from your Meta WhatsApp Business Account."}
            </span>
          </DialogDescription>
        </DialogHeader>

        {isApproved && (
          <div className="space-y-3 py-1">
            <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <Warning className="size-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                {isIndonesian
                  ? "Kebijakan Meta: Pembekuan Nama 30 Hari"
                  : "Meta Policy: 30-Day Name Freeze"}
              </AlertTitle>
              <AlertDescription className="text-xs text-amber-800/90 dark:text-amber-300/90">
                {isIndonesian
                  ? "Sesuai regulasi Meta, template yang disetujui (APPROVED) yang dihapus tidak dapat dibuat kembali dengan nama yang sama selama 30 hari ke depan."
                  : "Under Meta policy, approved templates that are deleted cannot be recreated or reused with the same name for 30 days."}
              </AlertDescription>
            </Alert>

            <div className="flex items-start gap-2 pt-0.5">
              <Checkbox
                id="cooldown-ack"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(Boolean(checked))}
                disabled={deleting}
              />
              <label
                htmlFor="cooldown-ack"
                className="cursor-pointer text-xs leading-normal text-muted-foreground select-none"
              >
                {isIndonesian
                  ? "Saya memahami bahwa nama template ini tidak dapat digunakan kembali selama 30 hari."
                  : "I understand that this template name cannot be recreated for 30 days."}
              </label>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            <WhatsAppText id="s15" />
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting || (isApproved && !acknowledged)}
          >
            {deleting
              ? isIndonesian
                ? "Menghapus..."
                : "Deleting..."
              : isIndonesian
                ? "Hapus Template"
                : "Delete Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
