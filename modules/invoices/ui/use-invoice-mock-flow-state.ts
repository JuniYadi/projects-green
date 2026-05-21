"use client"

import { useMemo } from "react"

import { resolveInvoiceFlowState } from "@/modules/invoices/invoices.helpers"
import {
  INVOICE_FLOW_STATE_REGISTRY,
  INVOICE_INTEGRATION_TODOS,
} from "@/modules/invoices/invoices.mock"
import type {
  InvoiceFlowDataMap,
  InvoiceFlowId,
  InvoiceScreenScenario,
  InvoiceScreenState,
} from "@/modules/invoices/invoices.types"

export const useInvoiceMockFlowState = <TFlow extends InvoiceFlowId>(
  flow: TFlow,
  scenario: InvoiceScreenScenario
): {
  state: InvoiceScreenState<TFlow, InvoiceFlowDataMap[TFlow]>
  integrationTodos: string[]
} => {
  const state = useMemo(() => {
    return resolveInvoiceFlowState(INVOICE_FLOW_STATE_REGISTRY, flow, scenario)
  }, [flow, scenario])

  return {
    state,
    integrationTodos: INVOICE_INTEGRATION_TODOS[flow],
  }
}
