import { describe, expect, it } from "bun:test"
import * as Icons from "@/components/ui/phosphor-icons"

describe("phosphor-icons", () => {
  it("exports expected core and newly added icons", () => {
    expect(Icons.ReceiptIcon).toBeDefined()
    expect(Icons.LifebuoyIcon).toBeDefined()
    expect(Icons.SquaresFourIcon).toBeDefined()
    expect(Icons.MegaphoneSimpleIcon).toBeDefined()
    expect(Icons.ArrowRightIcon).toBeDefined()
    expect(Icons.CheckCircleIcon).toBeDefined()
    expect(Icons.WarningCircleIcon).toBeDefined()
    expect(Icons.ClockIcon).toBeDefined()
    expect(Icons.PlusIcon).toBeDefined()
    expect(Icons.BookOpenIcon).toBeDefined()
    expect(Icons.ShieldCheckIcon).toBeDefined()
  })
})
