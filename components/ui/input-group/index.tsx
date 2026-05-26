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
  return (
    <div className={cn("flex flex-col gap-1", className)} data-slot="input-group">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  )
}

export { InputGroup }
