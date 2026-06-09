/**
 * Application-wide configuration constants.
 * Environment variables prefixed with NEXT_PUBLIC_ are inlined at build time
 * and available on both server and client.
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Acme Inc."
