"use client"

import React from "react"

import { useMessages } from "@/components/use-messages"
import type { AppMessages } from "@/lib/i18n/messages/types"

type ErrorBoundaryProps = {
  children: React.ReactNode
  fallback?: React.ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  error: Error | null
}

type ErrorBoundaryMessages = AppMessages["sharedComponents"]["errorBoundary"]

export class ErrorBoundaryImpl extends React.Component<
  ErrorBoundaryProps & { messages: ErrorBoundaryMessages },
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps & { messages: ErrorBoundaryMessages }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="mb-2 text-sm text-destructive" role="alert">
            {this.props.messages.message}
          </p>
          <button
            type="button"
            className="text-sm text-primary underline hover:no-underline"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            {this.props.messages.retry}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  const messages = useMessages().sharedComponents.errorBoundary

  return <ErrorBoundaryImpl {...props} messages={messages} />
}
