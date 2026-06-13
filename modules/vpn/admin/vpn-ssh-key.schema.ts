import { z } from "zod"

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
    .refine((value) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value), {
      message: "Private key must be a PEM/OpenSSH private key.",
    }),
})

export type CreateVpnSshKeyInput = z.infer<typeof createVpnSshKeySchema>
