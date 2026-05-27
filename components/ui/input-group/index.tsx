"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

function InputGroup({
  label,
  id,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
}) {
  const generatedId = React.useId()

  return (
    <div className={cn("flex flex-col gap-1", className)} data-slot="input-group">
      <Label htmlFor={id ?? generatedId}>{label}</Label>
      <Input id={id ?? generatedId} {...props} />
    </div>
  )
}

export { InputGroup }
