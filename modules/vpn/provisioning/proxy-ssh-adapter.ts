import crypto from "node:crypto"

import { VpnServerSshExecutor, type SshTarget } from "./vpn-server-ssh-executor"

const USERNAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_-]{2,63}$/

function sanitizeUsername(username: string): string {
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error("Invalid proxy username")
  }
  return username
}

/** Generate a URL-safe random password. */
function generatePassword(): string {
  return crypto.randomBytes(18).toString("base64url")
}

export type ProxyProvisionResult = {
  /** Plaintext password — returned once so the caller can hash + store it. */
  password: string
}

/**
 * Proxy provisioning over SSH.
 *
 * Generates a `user:pass` credential and registers it on the server via the
 * remote helper script (`PROXY_ADD_USER_SCRIPT <username> <password>`). The
 * plaintext password is returned exactly once; the caller is responsible for
 * hashing it before persistence (Story 14: "generate user:pass → hash →
 * store").
 */
export class ProxySshAdapter {
  private readonly executor: VpnServerSshExecutor
  private readonly addUserScript: string
  private readonly generatePassword: () => string

  constructor(
    options: {
      executor?: VpnServerSshExecutor
      addUserScript?: string
      generatePassword?: () => string
    } = {}
  ) {
    this.executor = options.executor ?? new VpnServerSshExecutor()
    this.addUserScript =
      options.addUserScript ??
      process.env.PROXY_ADD_USER_SCRIPT ??
      "/usr/local/bin/add-proxy-user"
    this.generatePassword = options.generatePassword ?? generatePassword
  }

  async createUser(
    target: SshTarget,
    username: string
  ): Promise<ProxyProvisionResult> {
    const safeName = sanitizeUsername(username)
    const password = this.generatePassword()
    await this.executor.execChecked(
      target,
      [this.addUserScript, safeName, password],
      "create proxy user"
    )
    return { password }
  }

  async revokeUser(target: SshTarget, username: string): Promise<void> {
    const safeName = sanitizeUsername(username)
    await this.executor.execChecked(
      target,
      [this.addUserScript, "--revoke", safeName],
      "revoke proxy user"
    )
  }
}
