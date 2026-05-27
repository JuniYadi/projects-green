import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { PAYG_BASE_LIMITS } from "@/modules/deploy/deploy.constants"

type PayAsYouGoSelectorProps = {
  cpu: number
  memory: number
  onCpuChange: (value: number) => void
  onMemoryChange: (value: number) => void
}

export function PayAsYouGoSelector({
  cpu,
  memory,
  onCpuChange,
  onMemoryChange,
}: PayAsYouGoSelectorProps) {
  return (
    <div className="space-y-6 rounded-md border bg-muted/30 p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">CPU (m)</Label>
          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
            {cpu}m
          </span>
        </div>
        <Slider
          value={[cpu]}
          min={PAYG_BASE_LIMITS.cpu.min}
          max={PAYG_BASE_LIMITS.cpu.max}
          step={PAYG_BASE_LIMITS.cpu.step}
          onValueChange={([value]) => onCpuChange(value!)}
        />
        <p className="text-[10px] text-muted-foreground">
          Minimum 100m, maximum 2000m (2 cores).
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Memory (Mi)</Label>
          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
            {memory}Mi
          </span>
        </div>
        <Slider
          value={[memory]}
          min={PAYG_BASE_LIMITS.memory.min}
          max={PAYG_BASE_LIMITS.memory.max}
          step={PAYG_BASE_LIMITS.memory.step}
          onValueChange={([value]) => onMemoryChange(value!)}
        />
        <p className="text-[10px] text-muted-foreground">
          Minimum 256Mi, maximum 4096Mi (4Gi).
        </p>
      </div>
    </div>
  )
}
