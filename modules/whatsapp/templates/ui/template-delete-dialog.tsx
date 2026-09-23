/**
 * Template Delete Dialog — Confirmation dialog with loading state and type-to-confirm safety
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
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type TemplateDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateName?: string
  templateNames?: string[]
  isApproved?: boolean
  deleting: boolean
  onConfirm: () => void
}

export function TemplateDeleteDialog({
  open,
  onOpenChange,
  templateName,
  templateNames,
  isApproved = false,
  deleting,
  onConfirm,
}: TemplateDeleteDialogProps) {
  const [acknowledged, setAcknowledged] = React.useState(false)
  const [confirmInput, setConfirmInput] = React.useState("")
  const params = useParams<{ lang?: string }>()
  const isIndonesian = params?.lang === "id"

  const names =
    templateNames && templateNames.length > 0
      ? templateNames
      : templateName
        ? [templateName]
        : ["this template"]
  const isBulk = names.length > 1
  const isConfirmed = confirmInput === "DELETE"

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setAcknowledged(false)
      setConfirmInput("")
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isBulk ? (
              isIndonesian ? (
                `Hapus ${names.length} Template WhatsApp`
              ) : (
                `Delete ${names.length} WhatsApp Templates`
              )
            ) : (
              <WhatsAppText id="s259" />
            )}
          </DialogTitle>
          <DialogDescription className="space-y-1">
            {isBulk ? (
              <span>
                {isIndonesian
                  ? `Apakah Anda yakin ingin menghapus ${names.length} template yang dipilih? Tindakan ini tidak dapat dibatalkan.`
                  : `Are you sure you want to delete the ${names.length} selected templates? This action cannot be undone.`}
              </span>
            ) : (
              <span>
                <WhatsAppText id="s260" />{" "}
                <strong className="text-foreground">{names[0]}</strong>
                <WhatsAppText id="s261" />
              </span>
            )}
            <span className="block text-xs text-muted-foreground">
              {isIndonesian
                ? "Tindakan ini juga akan menghapus template dari Meta WhatsApp Business Account secara permanen."
                : "This action will also permanently delete the template from your Meta WhatsApp Business Account."}
            </span>
          </DialogDescription>
        </DialogHeader>

        {isBulk && (
          <div className="max-h-32 overflow-y-auto rounded-md border bg-muted/40 p-2.5">
            <p className="mb-1 text-[11px] font-semibold text-muted-foreground">
              {isIndonesian ? "Template terpilih:" : "Selected templates:"}
            </p>
            <ul className="list-inside list-disc space-y-0.5 text-xs text-foreground">
              {names.map((name, idx) => (
                <li key={idx} className="truncate font-medium">
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}

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

        <div className="space-y-2 pt-1">
          <label
            htmlFor="delete-confirm-input"
            className="text-xs text-muted-foreground"
          >
            <WhatsAppText id="s423" />{" "}
            <span className="font-mono font-bold text-destructive">DELETE</span>{" "}
            <WhatsAppText id="s424" />
          </label>
          <Input
            id="delete-confirm-input"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="DELETE"
            disabled={deleting}
            className="font-mono"
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>

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
            disabled={deleting || !isConfirmed || (isApproved && !acknowledged)}
          >
            {deleting
              ? isIndonesian
                ? "Menghapus..."
                : "Deleting..."
              : isBulk
                ? isIndonesian
                  ? `Hapus ${names.length} Template`
                  : `Delete ${names.length} Templates`
                : isIndonesian
                  ? "Hapus Template"
                  : "Delete Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
