import { z } from "zod"

const PRIVATE_KEY_HEADER_RE =
  /^-----BEGIN\s+(OPENSSH|RSA|EC|DSA|)\s*PRIVATE KEY-----$/m

export const createVpnSshKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Key name must be at least 2 characters.")
    .max(80, "Key name must be at most 80 characters."),
  privateKey: z
    .string()
    .trim()
    .min(1, "Private key is required.")
    .refine((value) => PRIVATE_KEY_HEADER_RE.test(value.trim()), {
      message:
        "Unsupported SSH private key format. " +
        "Supported: OpenSSH private key, PKCS#8 PEM, RSA PEM, EC PEM, and DSA PEM.",
    }),
})

export type CreateVpnSshKeyInput = z.infer<typeof createVpnSshKeySchema>
