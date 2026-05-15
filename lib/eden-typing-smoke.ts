import { eden } from "@/lib/eden"

export async function verifyEdenTypingSmoke() {
  await eden.api.health.get()
  await eden.api.echo.post({ message: "hello" })
  await eden.api.user["42"].get()
}
