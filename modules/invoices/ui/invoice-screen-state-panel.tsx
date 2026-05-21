import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { INVOICE_FLOW_LABELS } from "@/modules/invoices/invoices.helpers"
import type {
  InvoiceFlowDataMap,
  InvoiceFlowId,
  InvoiceScreenState,
} from "@/modules/invoices/invoices.types"

type InvoiceScreenStatePanelProps<TFlow extends InvoiceFlowId> = {
  flow: TFlow
  state: InvoiceScreenState<TFlow, InvoiceFlowDataMap[TFlow]>
  renderSuccess: (data: InvoiceFlowDataMap[TFlow]) => ReactNode
  integrationTodos?: string[]
}

export function InvoiceScreenStatePanel<TFlow extends InvoiceFlowId>({
  flow,
  state,
  renderSuccess,
  integrationTodos = [],
}: InvoiceScreenStatePanelProps<TFlow>) {
  return (
    <Card size="sm">
      <CardHeader className="pb-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {INVOICE_FLOW_LABELS[flow]}
        </p>
        <CardTitle className="text-sm">{state.title}</CardTitle>
        <p className="text-xs text-muted-foreground">{state.description}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {state.scenario === "loading" ? (
          <div className="grid gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : null}

        {state.scenario === "failure" ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs">
            <p className="font-semibold text-destructive">
              [{state.code}] {state.message}
            </p>
            {state.retryable ? (
              <p className="mt-1 text-muted-foreground">
                This state is retryable once the integration is wired.
              </p>
            ) : null}
          </div>
        ) : null}

        {state.scenario === "empty" ? (
          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            {state.message}
          </p>
        ) : null}

        {state.scenario === "success" ? renderSuccess(state.data) : null}

        {integrationTodos.length > 0 ? (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">
              Integration placeholders
            </p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {integrationTodos.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
