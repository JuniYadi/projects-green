import { expect, test } from "@playwright/test"

test("keeps pasted SSH private key inside the shared dialog @e2e/smoke/portal/vpn-ssh-keys", async ({
  page,
}) => {
  await page.setViewportSize({ width: 692, height: 523 })
  await page.route("**/api/admin/vpn/ssh-keys", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    })
  })

  await page.goto("/en/portal/vpn/ssh-keys")
  await page.getByRole("button", { name: "Add SSH Key" }).click()
  await page
    .locator("#key-material")
    .fill(
      `-----BEGIN OPENSSH PRIVATE KEY-----\n${"A".repeat(2048)}\n-----END OPENSSH PRIVATE KEY-----`
    )

  const dialogBox = await page
    .locator('[data-slot="dialog-content"]')
    .boundingBox()
  const keyBox = await page.locator("#key-material").boundingBox()

  expect(dialogBox).not.toBeNull()
  expect(keyBox).not.toBeNull()
  if (!dialogBox || !keyBox) {
    throw new Error("Expected dialog and key material bounding boxes")
  }

  expect(keyBox.x).toBeGreaterThanOrEqual(dialogBox.x)
  expect(keyBox.x + keyBox.width).toBeLessThanOrEqual(
    dialogBox.x + dialogBox.width
  )
})
