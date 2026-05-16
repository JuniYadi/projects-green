import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { EnvVar } from "@/modules/deploy/deploy.types"

type EnvVarsEditorProps = {
  envVars: EnvVar[]
  hasDuplicateKeys: boolean
  onAdd: () => void
  onUpdate: (id: string, field: "key" | "value", value: string) => void
  onRemove: (id: string) => void
}

export function EnvVarsEditor({
  envVars,
  hasDuplicateKeys,
  onAdd,
  onUpdate,
  onRemove,
}: EnvVarsEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Add secrets or configuration your app needs to run.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          Add variable
        </Button>
      </div>

      {envVars.length === 0 ? (
        <p className="border border-dashed border-border p-3 text-xs text-muted-foreground">
          No environment variables yet.
        </p>
      ) : null}

      {envVars.map((envVar) => {
        return (
          <div
            key={envVar.id}
            className="grid gap-2 border border-border p-3 sm:grid-cols-[1fr_1fr_auto]"
          >
            <Input
              aria-label={`Environment key ${envVar.id}`}
              placeholder="KEY"
              value={envVar.key}
              onChange={(event) => {
                onUpdate(envVar.id, "key", event.target.value)
              }}
            />
            <Input
              aria-label={`Environment value ${envVar.id}`}
              placeholder="VALUE"
              value={envVar.value}
              onChange={(event) => {
                onUpdate(envVar.id, "value", event.target.value)
              }}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => onRemove(envVar.id)}
            >
              Remove
            </Button>
          </div>
        )
      })}

      {hasDuplicateKeys ? (
        <p className="text-xs text-destructive">
          Environment variable keys must be unique.
        </p>
      ) : null}
    </div>
  )
}
