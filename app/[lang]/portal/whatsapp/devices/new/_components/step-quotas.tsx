import { useParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { WizardData } from "./device-create-wizard"

type Props = {
  data: WizardData
  updateData: (patch: Partial<WizardData>) => void
  errors: Record<string, string>
}
export function StepQuotas({ data, updateData, errors }: Props) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pWhatsappDevicesNewStepQuotas

  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">{t.heading}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="quota-base">{t.quotaBaseLabel}</Label>
          <Input
            id="quota-base"
            type="number"
            min={0}
            value={data.quotaBase}
            onChange={(e) => updateData({ quotaBase: e.target.value })}
            placeholder="1000"
            aria-invalid={!!errors.quotaBase}
          />
          {errors.quotaBase && (
            <p className="text-xs text-destructive">{errors.quotaBase}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="quota-out">{t.quotaBaseOutLabel}</Label>
          <Input
            id="quota-out"
            type="number"
            min={0}
            value={data.quotaBaseOut}
            onChange={(e) => updateData({ quotaBaseOut: e.target.value })}
            placeholder="0"
            aria-invalid={!!errors.quotaBaseOut}
          />
          {errors.quotaBaseOut && (
            <p className="text-xs text-destructive">{errors.quotaBaseOut}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="daily-limit">{t.dailyLimitLabel}</Label>
          <Input
            id="daily-limit"
            type="number"
            min={0}
            value={data.dailyLimitMessage}
            onChange={(e) => updateData({ dailyLimitMessage: e.target.value })}
            placeholder="0"
            aria-invalid={!!errors.dailyLimitMessage}
          />
          {errors.dailyLimitMessage && (
            <p className="text-xs text-destructive">
              {errors.dailyLimitMessage}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="balance">{t.balanceLabel}</Label>
          <Input
            id="balance"
            type="number"
            min={0}
            value={data.balance}
            onChange={(e) => updateData({ balance: e.target.value })}
            placeholder="0"
            aria-invalid={!!errors.balance}
          />
          {errors.balance && (
            <p className="text-xs text-destructive">{errors.balance}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rates">{t.rateTierLabel}</Label>
          <Select
            value={data.rates || "BASE"}
            onValueChange={(value) => updateData({ rates: value })}
          >
            <SelectTrigger id="rates">
              <SelectValue placeholder={t.selectRateTierPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BASE">{t.rateTierBase}</SelectItem>
              <SelectItem value="TIER_1">{t.rateTier1}</SelectItem>
              <SelectItem value="TIER_2">{t.rateTier2}</SelectItem>
              <SelectItem value="TIER_3">{t.rateTier3}</SelectItem>
            </SelectContent>
          </Select>
          {errors.rates && (
            <p className="text-xs text-destructive">{errors.rates}</p>
          )}
        </div>
        <Input
          id="expired-at"
          type="date"
          value={data.expiredAt}
          onChange={(e) => updateData({ expiredAt: e.target.value })}
          aria-invalid={!!errors.expiredAt}
        />
        {errors.expiredAt && (
          <p className="text-xs text-destructive">{errors.expiredAt}</p>
        )}
      </div>
    </div>
  )
}
