import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

describe("Breadcrumb", () => {
  it("renders nav with aria-label and data-slot", () => {
    const view = render(<Breadcrumb />)
    const nav = view.container.querySelector('[data-slot="breadcrumb"]')
    expect(nav?.tagName).toBe("NAV")
    expect(nav).toHaveAttribute("aria-label", "breadcrumb")
    expect(nav).toHaveAttribute("data-slot", "breadcrumb")
  })

  it("renders children", () => {
    const view = render(
      <Breadcrumb>
        <span>Content</span>
      </Breadcrumb>
    )
    expect(view.getByText("Content")).toBeInTheDocument()
  })

  it("applies custom className", () => {
    const view = render(<Breadcrumb className="custom-class" />)
    const nav = view.container.querySelector('[data-slot="breadcrumb"]')
    expect(nav).toHaveClass("custom-class")
  })
})

describe("BreadcrumbList", () => {
  it("renders ol with data-slot", () => {
    const view = render(<BreadcrumbList />)
    const ol = view.container.querySelector('[data-slot="breadcrumb-list"]')
    expect(ol?.tagName).toBe("OL")
  })

  it("renders children", () => {
    const view = render(
      <BreadcrumbList>
        <li>Item</li>
      </BreadcrumbList>
    )
    expect(view.getByText("Item")).toBeInTheDocument()
  })

  it("applies custom className", () => {
    const view = render(<BreadcrumbList className="custom-list" />)
    const ol = view.container.querySelector('[data-slot="breadcrumb-list"]')
    expect(ol).toHaveClass("custom-list")
  })
})

describe("BreadcrumbItem", () => {
  it("renders li with data-slot", () => {
    const view = render(<BreadcrumbItem />)
    const li = view.container.querySelector('[data-slot="breadcrumb-item"]')
    expect(li?.tagName).toBe("LI")
  })

  it("renders children", () => {
    const view = render(
      <BreadcrumbItem>
        <span>Step</span>
      </BreadcrumbItem>
    )
    expect(view.getByText("Step")).toBeInTheDocument()
  })

  it("applies custom className", () => {
    const view = render(<BreadcrumbItem className="custom-item" />)
    const li = view.container.querySelector('[data-slot="breadcrumb-item"]')
    expect(li).toHaveClass("custom-item")
  })
})

describe("BreadcrumbLink", () => {
  it("renders anchor by default", () => {
    const view = render(<BreadcrumbLink href="/home">Home</BreadcrumbLink>)
    const link = view.getByText("Home")
    expect(link.tagName).toBe("A")
    expect(link).toHaveAttribute("href", "/home")
  })

  it("renders with data-slot attribute", () => {
    const view = render(<BreadcrumbLink href="/">Home</BreadcrumbLink>)
    const link = view.getByText("Home")
    expect(link).toHaveAttribute("data-slot", "breadcrumb-link")
  })

  it("applies custom className", () => {
    const view = render(
      <BreadcrumbLink href="/" className="custom-class">
        Test
      </BreadcrumbLink>
    )
    expect(view.getByText("Test")).toHaveClass("custom-class")
  })

  it("renders as child when asChild is true", () => {
    const view = render(
      <BreadcrumbLink asChild>
        <button>Clickable</button>
      </BreadcrumbLink>
    )
    const btn = view.getByText("Clickable")
    expect(btn.tagName).toBe("BUTTON")
  })
})

describe("BreadcrumbPage", () => {
  it("renders span with aria-current and aria-disabled", () => {
    const view = render(<BreadcrumbPage>Current Page</BreadcrumbPage>)
    const el = view.getByText("Current Page")
    expect(el.tagName).toBe("SPAN")
    expect(el).toHaveAttribute("aria-current", "page")
    expect(el).toHaveAttribute("aria-disabled", "true")
    expect(el).toHaveAttribute("role", "link")
  })

  it("renders with data-slot attribute", () => {
    const view = render(<BreadcrumbPage>Page</BreadcrumbPage>)
    const el = view.getByText("Page")
    expect(el).toHaveAttribute("data-slot", "breadcrumb-page")
  })

  it("applies custom className", () => {
    const view = render(
      <BreadcrumbPage className="custom-page">Current</BreadcrumbPage>
    )
    expect(view.getByText("Current")).toHaveClass("custom-page")
  })
})

describe("BreadcrumbSeparator", () => {
  it("renders as li with role presentation and aria-hidden", () => {
    const view = render(<BreadcrumbSeparator />)
    const li = view.container.querySelector(
      '[data-slot="breadcrumb-separator"]'
    )
    expect(li).toBeTruthy()
    expect(li?.tagName).toBe("LI")
    expect(li).toHaveAttribute("role", "presentation")
    expect(li).toHaveAttribute("aria-hidden", "true")
  })

  it("renders default CaretRightIcon when no children provided", () => {
    const view = render(<BreadcrumbSeparator />)
    const li = view.container.querySelector(
      '[data-slot="breadcrumb-separator"]'
    )
    // Should contain an SVG icon by default
    expect(li?.querySelector("svg")).toBeTruthy()
  })

  it("renders custom children instead of icon", () => {
    const view = render(<BreadcrumbSeparator>/</BreadcrumbSeparator>)
    expect(view.getByText("/")).toBeInTheDocument()
  })

  it("renders custom element child", () => {
    const view = render(
      <BreadcrumbSeparator>
        <span data-testid="custom-sep">|</span>
      </BreadcrumbSeparator>
    )
    expect(view.getByTestId("custom-sep")).toBeInTheDocument()
  })

  it("applies custom className", () => {
    const view = render(<BreadcrumbSeparator className="custom-sep" />)
    const li = view.container.querySelector(
      '[data-slot="breadcrumb-separator"]'
    )
    expect(li).toHaveClass("custom-sep")
  })
})

describe("BreadcrumbEllipsis", () => {
  it("renders span with sr-only More text", () => {
    const view = render(<BreadcrumbEllipsis />)
    const srOnly = view.container.querySelector(".sr-only")
    expect(srOnly).toBeTruthy()
    expect(srOnly?.textContent).toBe("More")
  })

  it("renders with data-slot and aria-hidden", () => {
    const view = render(<BreadcrumbEllipsis />)
    const el = view.container.querySelector('[data-slot="breadcrumb-ellipsis"]')
    expect(el).toBeTruthy()
    expect(el).toHaveAttribute("aria-hidden", "true")
    expect(el).toHaveAttribute("role", "presentation")
  })

  it("renders an SVG icon", () => {
    const view = render(<BreadcrumbEllipsis />)
    const el = view.container.querySelector('[data-slot="breadcrumb-ellipsis"]')
    expect(el?.querySelector("svg")).toBeTruthy()
  })

  it("applies custom className", () => {
    const view = render(<BreadcrumbEllipsis className="custom-ellipsis" />)
    const el = view.container.querySelector('[data-slot="breadcrumb-ellipsis"]')
    expect(el).toHaveClass("custom-ellipsis")
  })
})

describe("Integration", () => {
  it("renders a complete breadcrumb trail", () => {
    const view = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )

    expect(view.getByText("Home")).toBeInTheDocument()
    expect(view.getByText("Dashboard")).toBeInTheDocument()
    expect(view.getByText("Settings")).toBeInTheDocument()
    expect(
      view.container.querySelector('[data-slot="breadcrumb"]')
    ).toBeInTheDocument()
  })

  it("renders breadcrumb with ellipsis in trail", () => {
    const view = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/deep">Deep</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Target</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )

    expect(view.getByText("Home")).toBeInTheDocument()
    expect(view.getByText("Deep")).toBeInTheDocument()
    expect(view.getByText("Target")).toBeInTheDocument()
    // Ellipsis sr-only text should be present
    expect(view.getByText("More")).toBeInTheDocument()
  })

  it("passes additional HTML attributes through to root elements", () => {
    const view = render(<Breadcrumb data-testid="bc-nav" />)
    expect(
      view.container.querySelector('[data-testid="bc-nav"]')
    ).toBeInTheDocument()
  })
})
