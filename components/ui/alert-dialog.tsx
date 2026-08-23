"use client"

import * as React from "react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const AlertDialog = Dialog
const AlertDialogTrigger = DialogTrigger
const AlertDialogContent = DialogContent
const AlertDialogDescription = DialogDescription
const AlertDialogFooter = DialogFooter
const AlertDialogHeader = DialogHeader
const AlertDialogTitle = DialogTitle

function AlertDialogAction({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="alert-dialog-action"
      variant={variant}
      size={size}
      className={cn(className)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <DialogClose asChild>
      <Button
        data-slot="alert-dialog-cancel"
        variant={variant}
        size={size}
        className={cn(className)}
        {...props}
      />
    </DialogClose>
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
}
