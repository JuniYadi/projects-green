import { expect, test } from "@playwright/test"

test.describe("@e2e/whatsapp/user/workflow-canvas", () => {
  test("loads the canvas, simulates a customer response, and opens the inspector", async ({
    page,
  }) => {
    await page.goto("/en/console/whatsapp/workflows/wf_new/canvas")

    await expect(page).toHaveURL(
      /\/en\/console\/whatsapp\/workflows\/wf_new\/canvas$/
    )
    await expect(
      page.getByRole("button", { name: "Simulate test" })
    ).toBeVisible()

    await expect(page.getByRole("application")).toBeVisible()
    await expect(
      page.locator('[role="group"][aria-roledescription="edge"]')
    ).toHaveCount(2)
    await expect(
      page.getByRole("heading", {
        name: "1. Tanya Kebutuhan Bisnis",
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", {
        name: "2. Tarik Data Live (HTTP API)",
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", {
        name: "3. AI Sales Decision & Reply",
        exact: true,
      })
    ).toBeVisible()
    await page.getByRole("button", { name: "Simulate test" }).click()
    const simulator = page.getByRole("dialog", {
      name: "WhatsApp Bot Simulator",
    })
    await expect(simulator).toBeVisible()
    await expect(simulator.getByText(/Halo!/)).toBeVisible()
    await expect(
      simulator.getByText(/Boleh tahu produk, paket, atau kendala/)
    ).toBeVisible()

    const messageInput = simulator.getByPlaceholder(
      "Type a simulated customer message..."
    )
    await messageInput.fill("Budi")
    await simulator.getByRole("button", { name: "Send message" }).click()

    await expect(simulator.getByText("Budi", { exact: true })).toBeVisible()
    await expect(
      simulator.getByText(/Variable captured: customer_need/)
    ).toBeVisible()
    await expect(simulator.getByText(/\[AI Response\]/)).toBeVisible()
    await expect(
      simulator.getByText("Workflow reached end of conversation.")
    ).toBeVisible()

    await simulator.getByRole("button", { name: "Close" }).click()
    await expect(simulator).toBeHidden()

    const customerNeedNode = page
      .locator('[role="group"][aria-roledescription="node"]')
      .filter({
        has: page.getByRole("heading", {
          name: "1. Tanya Kebutuhan Bisnis",
          exact: true,
        }),
      })
    await customerNeedNode.click()

    const inspector = page.getByRole("dialog", { name: "Step settings" })
    await expect(inspector).toBeVisible()
    await expect(
      inspector.getByText("Configure this workflow step")
    ).toBeVisible()
    await expect(
      inspector.getByRole("textbox", { name: "Give this step a name" })
    ).toHaveValue(/\S+/)
    await expect(
      inspector.getByRole("textbox", { name: "What should the bot ask?" })
    ).toHaveValue(/\S+/)
    await expect(
      inspector.getByRole("textbox", { name: "variable_name" })
    ).toHaveValue(/\S+/)
    await expect(
      inspector.getByRole("button", { name: "Done editing" })
    ).toBeVisible()
  })
})
