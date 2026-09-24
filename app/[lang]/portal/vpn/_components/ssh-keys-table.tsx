"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PlusIcon, TrashIcon } from "@phosphor-icons/react"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import {
  listVpnSshKeys,
  createVpnSshKey,
  deleteVpnSshKey,
  type VpnSshKeyItem,
} from "./vpn-admin-client"

export function SshKeysTable() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

  const [keys, setKeys] = useState<VpnSshKeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [privateKey, setPrivateKey] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listVpnSshKeys()
      setKeys(res.data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const openCreate = () => {
    setName("")
    setPrivateKey("")
    setFormError(null)
    setDialogOpen(true)
  }

  const submit = async () => {
    setSaving(true)
    setFormError(null)
    try {
      await createVpnSshKey({ name, privateKey })
      setDialogOpen(false)
      await load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (key: VpnSshKeyItem) => {
    const confirmMessage =
      messages.pPortalVpnSshKeysTable.confirmDeleteKey.replace(
        "{name}",
        key.name
      )
    if (!window.confirm(confirmMessage)) return
    try {
      await deleteVpnSshKey(key.id)
      await load()
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate} size="sm">
          <PlusIcon className="mr-2 h-4 w-4" />
          {messages.pPortalVpnSshKeysTable.addSshKey}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.pPortalVpnSshKeysTable.name}</TableHead>
              <TableHead>
                {messages.pPortalVpnSshKeysTable.fingerprint}
              </TableHead>
              <TableHead>{messages.pPortalVpnSshKeysTable.usedBy}</TableHead>
              <TableHead className="text-right">
                {messages.pPortalVpnSshKeysTable.actions}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : keys.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-sm text-muted-foreground"
                >
                  {messages.pPortalVpnSshKeysTable.noSshKeysYet}
                </TableCell>
              </TableRow>
            ) : (
              keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {key.fingerprint}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {key.usedByServerNames.length > 0
                      ? key.usedByServerNames.join(", ")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(key)}
                      disabled={key.usedByServerNames.length > 0}
                      aria-label={messages.pPortalVpnSshKeysTable.deleteKeyAria.replace(
                        "{name}",
                        key.name
                      )}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {messages.pPortalVpnSshKeysTable.addSshKey}
            </DialogTitle>
            <DialogDescription>
              {messages.pPortalVpnSshKeysTable.dialogDescriptionPrefix}
              <code className="text-xs">
                {messages.pPortalVpnSshKeysTable.generationCommand}
              </code>
              {messages.pPortalVpnSshKeysTable.dialogDescriptionSuffix}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">
                {messages.pPortalVpnSshKeysTable.name}
              </Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={messages.pPortalVpnSshKeysTable.namePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-material">
                {messages.pPortalVpnSshKeysTable.privateKeyLabel}
              </Label>
              <Textarea
                id="key-material"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder={
                  messages.pPortalVpnSshKeysTable.privateKeyPlaceholder
                }
                rows={6}
                className="font-mono text-xs"
              />
            </div>
            {formError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {messages.pPortalVpnSshKeysTable.cancel}
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving
                ? messages.pPortalVpnSshKeysTable.saving
                : messages.pPortalVpnSshKeysTable.addKey}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
