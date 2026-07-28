/**
 * Server-side absolute base URL for app-generated email/PDF links.
 * Prefers APP_URL (server-only), falls back to NEXT_PUBLIC_APP_URL,
 * then the local dev default. Never use NEXT_PUBLIC_APP_URL directly
 * in email templates — production sets APP_URL instead.
 */
export function getEmailBaseUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3300"
  ).replace(/\/+$/, "")
}
