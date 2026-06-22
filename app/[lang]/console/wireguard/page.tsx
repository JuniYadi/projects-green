"use client"

import { useCallback, useEffect, useState } from "react"
import { eden } from "@/lib/eden"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  PlusIcon,
  TrashIcon,
  DownloadSimpleIcon,
  ImageIcon,
  WifiHighIcon,
  WifiSlashIcon,
} from "@phosphor-icons/react"

type WgPeer = {
  username: string
  ip: string
  status: "online" | "offline"
  handshake: string | null
  rx: number
  tx: number
  endpoint: string | null
}

type CreateResult = {
  username: string
  ip: string
  config: string
  qrBase64: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Never"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function WireGuardPage() {
  const [peers, setPeers] = useState<WgPeer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newUsername, setNewUsername] = useState("")
  const [creating, setCreating] = useState(false)
  const [createResult, setCreateResult] = useState<CreateResult | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showQr, setShowQr] = useState<string | null>(null)

  const fetchPeers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await eden.api.console.wireguard.peers.get()
      if (res?.data?.peers) setPeers(res.data.peers)
      else setError("Failed to fetch peers")
    } catch {
      setError("Failed to connect to server")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPeers()
  }, [fetchPeers])

  const handleCreate = async () => {
    if (!newUsername.trim()) return
    setCreating(true)
    try {
      const res = await eden.api.console.wireguard.peers.post({ username: newUsername.trim() })
      if (res.status === 201) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = res
        setCreateResult(data.data)
        setNewUsername("")
        await fetchPeers()
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = res
        alert((data?.error?.message as string) ?? "Failed to create peer")
      }
    } catch {
      alert("Failed to create peer")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (username: string) => {
    if (!confirm(`Remove peer "${username}"?`)) return
    try {
      // eslint-disable-next-line no-restricted-globals
      const res = await fetch(`/api/console/wireguard/peers/${encodeURIComponent(username)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error("Failed")
      await fetchPeers()
    } catch {
      alert("Failed to remove peer")
    }
  }

  const handleDownload = async (username: string) => {
    try {
      // ponytail: direct fetch for blob response; eden doesn't support blobs
      // eslint-disable-next-line no-restricted-globals
      const res = await fetch(`/api/console/wireguard/peers/${username}/config`)
      if (!res.ok) throw new Error("Failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${username}.conf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert("Failed to download config")
    }
  }

  const handleShowQr = async (username: string) => {
    try {
      // eslint-disable-next-line no-restricted-globals
      const res = await fetch(`/api/console/wireguard/peers/${username}/qr`)
      if (!res.ok) throw new Error("Failed")
      const blob = await res.blob()
      setShowQr(URL.createObjectURL(blob))
    } catch {
      alert("Failed to generate QR")
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">WireGuard Peers</h1>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" /> Add Peer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{createResult ? "Peer Created" : "New WireGuard Peer"}</DialogTitle>
            </DialogHeader>
            {createResult ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Peer <strong>{createResult.username}</strong> created.</p>
                <div className="max-h-60 overflow-auto rounded border bg-muted p-3">
                  <pre className="text-xs">{createResult.config}</pre>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const blob = new Blob([createResult.config], { type: "text/plain" })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement("a")
                      a.href = url
                      a.download = `${createResult.username}.conf`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                  >
                    <DownloadSimpleIcon className="mr-2 h-4 w-4" /> Download .conf
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowQr(createResult.qrBase64)}
                  >
                    <ImageIcon className="mr-2 h-4 w-4" /> Show QR
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowCreateDialog(false)
                      setCreateResult(null)
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <Input
                  placeholder="Username (e.g. cust-123)"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <Button onClick={handleCreate} disabled={creating || !newUsername.trim()}>
                  {creating ? "Creating..." : "Create"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Card>
          <CardContent className="py-4 text-center text-red-500">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Peers ({peers.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Handshake</TableHead>
                <TableHead>Transfer</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : peers.length === 0
                  ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No peers found</TableCell></TableRow>
                  : peers.map((peer) => (
                      <TableRow key={peer.username}>
                        <TableCell className="font-medium">{peer.username}</TableCell>
                        <TableCell className="font-mono text-xs">{peer.ip}</TableCell>
                        <TableCell>
                          <Badge variant={peer.status === "online" ? "default" : "secondary"}>
                            {peer.status === "online" ? (
                              <><WifiHighIcon className="mr-1 h-3 w-3" /> Online</>
                            ) : (
                              <><WifiSlashIcon className="mr-1 h-3 w-3" /> Offline</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{relativeTime(peer.handshake)}</TableCell>
                        <TableCell className="text-xs">
                          ↓ {formatBytes(peer.rx)} / ↑ {formatBytes(peer.tx)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleDownload(peer.username)} title="Download config">
                              <DownloadSimpleIcon className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleShowQr(peer.username)} title="Show QR">
                              <ImageIcon className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(peer.username)} title="Remove peer" className="text-red-500">
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!showQr} onOpenChange={(o) => { if (!o) setShowQr(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>WireGuard QR Code</DialogTitle>
          </DialogHeader>
          {showQr && (
            <div className="flex justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={showQr} alt="WireGuard QR Code" className="max-w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}
