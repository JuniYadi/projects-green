import { SshKeysTable } from "../_components/ssh-keys-table"

export default async function VpnSshKeysPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">SSH Keys</h1>
        <p className="text-sm text-muted-foreground">
          Store SSH keys once and reuse them across servers. Keys are stored
          encrypted and never displayed again.
        </p>
      </header>
      <SshKeysTable />
    </main>
  )
}
