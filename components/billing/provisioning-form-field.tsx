import React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type ProvisioningFieldDef = {
  id?: string
  name: string
  label: string
  type:
    | "text"
    | "number"
    | "email"
    | "tel"
    | "url"
    | "select"
    | "radio"
    | "checkbox"
  placeholder?: string
  helperText?: string
  required?: boolean
  options?: string[]
  validationPattern?: string
}

export function matchesPattern(value: string, pattern?: string): boolean {
  if (!pattern || !value) return true
  try {
    return new RegExp(pattern).test(value)
  } catch {
    return true
  }
}

export function parseCheckboxValues(
  val: string | string[] | undefined
): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  try {
    if (val.startsWith("[") && val.endsWith("]")) {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed.map(String)
    }
  } catch {
    // Fallback to comma-separated if not JSON
  }
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export function serializeCheckboxValues(values: string[]): string {
  return JSON.stringify(values)
}

export type ProvisioningFormFieldProps = {
  field: ProvisioningFieldDef
  value: string
  onChange: (value: string) => void
  testIdPrefix?: string
  idPrefix?: string
  validationErrorMessage?: string
}

export function ProvisioningFormField({
  field,
  value,
  onChange,
  testIdPrefix = "order",
  idPrefix = "order-field",
  validationErrorMessage = "Invalid input format according to required pattern.",
}: ProvisioningFormFieldProps) {
  const fieldKey = field.id || field.name
  const elementId = `${idPrefix}-${fieldKey}`
  const testId = `${testIdPrefix}-input-${field.name}`
  const isInvalidPattern = Boolean(
    value &&
    field.validationPattern &&
    !matchesPattern(value, field.validationPattern)
  )

  return (
    <div className="space-y-1.5">
      <Label htmlFor={elementId} className="text-xs">
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>

      {field.type === "select" ? (
        <div className="space-y-1">
          <Select value={value || ""} onValueChange={onChange}>
            <SelectTrigger
              id={elementId}
              data-testid={testId}
              className="h-8 w-full text-xs"
            >
              <SelectValue
                placeholder={field.placeholder || "Pilih salah satu opsi"}
              />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt} className="text-xs">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.helperText && (
            <p className="text-[11px] leading-normal text-muted-foreground">
              {field.helperText}
            </p>
          )}
        </div>
      ) : field.type === "radio" ? (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-4 pt-1" data-testid={testId}>
            {(field.options ?? []).map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 text-xs"
              >
                <input
                  type="radio"
                  name={elementId}
                  value={opt}
                  checked={(value || "") === opt}
                  onChange={() => onChange(opt)}
                  className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          {field.helperText && (
            <p className="text-[11px] leading-normal text-muted-foreground">
              {field.helperText}
            </p>
          )}
        </div>
      ) : field.type === "checkbox" ? (
        <div className="space-y-1">
          <div className="space-y-2 pt-1" data-testid={testId}>
            {!field.options || field.options.length <= 1 ? (
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  name={elementId}
                  checked={Boolean(value && value !== "false")}
                  onChange={(e) => {
                    const checked = e.target.checked
                    if (checked) {
                      onChange(field.options?.[0] || "true")
                    } else {
                      onChange("")
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span>{field.options?.[0] || field.label}</span>
              </label>
            ) : (
              <div className="flex flex-wrap gap-3">
                {field.options.map((opt) => {
                  const currentSelected = parseCheckboxValues(value)
                  const isChecked = currentSelected.includes(opt)
                  return (
                    <label
                      key={opt}
                      className="flex cursor-pointer items-center gap-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        name={elementId}
                        value={opt}
                        checked={isChecked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...currentSelected, opt]
                            : currentSelected.filter((s) => s !== opt)
                          onChange(serializeCheckboxValues(next))
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span>{opt}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          {field.helperText && (
            <p className="text-[11px] leading-normal text-muted-foreground">
              {field.helperText}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <Input
            id={elementId}
            name={field.name}
            data-testid={testId}
            type={field.type === "tel" ? "tel" : field.type}
            placeholder={field.placeholder || undefined}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-xs"
          />
          {field.helperText && (
            <p className="text-[11px] leading-normal text-muted-foreground">
              {field.helperText}
            </p>
          )}
          {isInvalidPattern && (
            <p className="text-[11px] text-destructive">
              {validationErrorMessage}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
