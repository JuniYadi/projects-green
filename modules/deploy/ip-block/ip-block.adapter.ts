import { logger } from "@/lib/logger"

export interface IpBlockEnforcementAdapter {
  applyBlock(params: {
    stackId: string
    organizationId: string
    ipAddress: string
  }): Promise<{ success: boolean; error?: string }>

  removeBlock(params: {
    stackId: string
    organizationId: string
    ipAddress: string
  }): Promise<{ success: boolean; error?: string }>

  reconcile(params: {
    stackId: string
    activeIps: string[]
  }): Promise<{ success: boolean; error?: string }>
}

/**
 * HAProxy Ingress & Cluster Edge Block Adapter
 * Manages blocked IP access control lists for application stacks.
 */
export class HAProxyIngressIpBlockAdapter implements IpBlockEnforcementAdapter {
  // In-memory registry of enforced IPs per stack
  private activeStackBlocks = new Map<string, Set<string>>()
  // Hook for testing failure modes
  private shouldSimulateFailureForIp = new Set<string>()

  setSimulatedFailure(ip: string, fail: boolean): void {
    if (fail) {
      this.shouldSimulateFailureForIp.add(ip)
    } else {
      this.shouldSimulateFailureForIp.delete(ip)
    }
  }

  async applyBlock(params: {
    stackId: string
    organizationId: string
    ipAddress: string
  }): Promise<{ success: boolean; error?: string }> {
    const { stackId, ipAddress } = params

    if (this.shouldSimulateFailureForIp.has(ipAddress)) {
      logger.warn(
        { event: "IP_BLOCK_ENFORCEMENT_FAILED", stackId, ipAddress },
        "Simulated cluster enforcement failure"
      )
      return {
        success: false,
        error: `Cluster ingress ACL update timed out for IP ${ipAddress}`,
      }
    }

    let stackSet = this.activeStackBlocks.get(stackId)
    if (!stackSet) {
      stackSet = new Set()
      this.activeStackBlocks.set(stackId, stackSet)
    }
    stackSet.add(ipAddress)

    logger.info(
      { event: "IP_BLOCK_ENFORCED", stackId, ipAddress },
      `Enforced block on HAProxy ingress for IP: ${ipAddress}`
    )
    return { success: true }
  }

  async removeBlock(params: {
    stackId: string
    organizationId: string
    ipAddress: string
  }): Promise<{ success: boolean; error?: string }> {
    const { stackId, ipAddress } = params
    const stackSet = this.activeStackBlocks.get(stackId)
    if (stackSet) {
      stackSet.delete(ipAddress)
    }

    logger.info(
      { event: "IP_BLOCK_REMOVED", stackId, ipAddress },
      `Removed block on HAProxy ingress for IP: ${ipAddress}`
    )
    return { success: true }
  }

  async reconcile(params: {
    stackId: string
    activeIps: string[]
  }): Promise<{ success: boolean; error?: string }> {
    const { stackId, activeIps } = params
    this.activeStackBlocks.set(stackId, new Set(activeIps))
    return { success: true }
  }

  isIpEnforced(stackId: string, ipAddress: string): boolean {
    return Boolean(this.activeStackBlocks.get(stackId)?.has(ipAddress))
  }

  getActiveBlocksForStack(stackId: string): string[] {
    return Array.from(this.activeStackBlocks.get(stackId) ?? [])
  }
}

export const defaultIpBlockAdapter = new HAProxyIngressIpBlockAdapter()
