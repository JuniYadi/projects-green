"use client"

import { useCallback, useEffect, useState } from "react"

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

import { vpnApi, type VpnSshKeyItem } from "./vpn-admin-client"

export function SshKeysTable() {
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
      const res = await vpnApi<{ ok: true; data: VpnSshKeyItem[] }>(
        "/admin/vpn/ssh-keys"
      )
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
      await vpnApi("/admin/vpn/ssh-keys", {
        method: "POST",
        body: JSON.stringify({ name, privateKey }),
      })
      setDialogOpen(false)
      await load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (key: VpnSshKeyItem) => {
    if (!window.confirm(`Delete SSH key "${key.name}"?`)) return
    try {
      await vpnApi(`/admin/vpn/ssh-keys/${key.id}`, { method: "DELETE" })
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
          Add SSH Key
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
              <TableHead>Name</TableHead>
              <TableHead>Fingerprint</TableHead>
              <TableHead>Used By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
                  No SSH keys yet.
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
                      aria-label={`Delete ${key.name}`}
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
            <DialogTitle>Add SSH Key</DialogTitle>
            <DialogDescription>
              Stored encrypted. Label clearly so you can find it when adding
              servers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production VPN Key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-material">Private key</Label>
              <Textarea
                id="key-material"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
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
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Saving..." : "Add Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
