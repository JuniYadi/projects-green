import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { AgentListItem } from "./agent-list-item"

const noop = mock(() => {})
const copy = {
  noDescription: "No description",
  noChannel: "No channel",
  activeOn: "Active on {target}",
  updated: "Updated",
  statuses: {
    ACTIVE: "Active",
    ARCHIVED: "Archived",
    DRAFT: "Draft",
    NEEDS_ATTENTION: "Needs attention",
    PAUSED: "Paused",
    READY_TO_CONNECT: "Ready to connect",
  },
  actions: {
    open: "Open Agent",
    continueSetup: "Continue Setup",
    connect: "Connect WhatsApp",
    repair: "Fix Agent",
    reactivate: "Reactivate",
    edit: "Edit Settings",
    canvas: "Open in Canvas",
    simulator: "Simulator",
    embed: "Embed Website",
    tools: "Actions & Tools",
    pause: "Pause",
    archive: "Archive",
    restore: "Restore",
    delete: "Delete",
    more: "More actions",
  },
}

describe("AgentListItem", () => {
  afterEach(cleanup)

  it("renders a truthful status with one primary action", () => {
    const { getByText, getByTestId } = render(
      <AgentListItem
        agent={{
          id: "agent_1",
          name: "Support",
          description: "Helps customers",
          status: "DRAFT",
          operationalStatus: "READY_TO_CONNECT",
          activeChannelsCount: 0,
          knowledgeCount: 0,
          actionCount: 0,
          channelBindings: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }}
        lang="en"
        copy={copy}
        onPrimaryAction={noop}
        onEdit={noop}
        onAdvancedAction={noop}
        onStatusChange={noop}
        onDelete={noop}
      />
    )

    expect(getByText("No channel")).toBeDefined()
    expect(getByText("Connect WhatsApp")).toBeDefined()

    const card = getByTestId("agent-card-agent_1")
    expect(card.querySelectorAll("button").length).toBe(3)
    // Exactly one whole-card link (the stretched overlay); the dropdown's
    // own canvas link is only mounted once the menu is open.
    expect(card.querySelectorAll("a").length).toBe(1)
  })

  it("is a plain container with a stretched link to the agent canvas, not a nested-interactive button", () => {
    const { getByTestId } = render(
      <AgentListItem
        agent={{
          id: "agent_1",
          name: "Support",
          description: "Helps customers",
          status: "DRAFT",
          operationalStatus: "READY_TO_CONNECT",
          activeChannelsCount: 0,
          knowledgeCount: 0,
          actionCount: 0,
          channelBindings: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }}
        lang="en"
        copy={copy}
        onPrimaryAction={noop}
        onEdit={noop}
        onAdvancedAction={noop}
        onStatusChange={noop}
        onDelete={noop}
      />
    )

    const card = getByTestId("agent-card-agent_1")

    // Card itself is no longer an interactive role/tag.
    expect(card.tagName).toBe("DIV")
    expect(card.getAttribute("role")).toBeNull()
    expect(card.getAttribute("tabindex")).toBeNull()

    // The whole-card link targets the agent's canvas page.
    const canvasHref =
      "/en/console/ai/agents/agent_1/canvas?agentProfileId=agent_1&agentProfileName=Support"
    const link = card.querySelector(`a[href="${canvasHref}"]`)
    expect(link).not.toBeNull()

    // The link must not wrap the icon/CTA buttons (no nested interactive
    // elements), and none of the buttons wrap the link either.
    expect(link?.querySelector("button")).toBeNull()
    for (const button of Array.from(card.querySelectorAll("button"))) {
      expect(button.closest("a")).toBeNull()
    }
  })

  it("calls onDelete from the visible delete icon button without opening the agent", () => {
    const onDelete = mock(() => {})
    const onPrimaryAction = mock(() => {})
    const { getByLabelText } = render(
      <AgentListItem
        agent={{
          id: "agent_1",
          name: "Support",
          description: "Helps customers",
          status: "DRAFT",
          operationalStatus: "READY_TO_CONNECT",
          activeChannelsCount: 0,
          knowledgeCount: 0,
          actionCount: 0,
          channelBindings: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }}
        lang="en"
        copy={copy}
        onPrimaryAction={onPrimaryAction}
        onEdit={noop}
        onAdvancedAction={noop}
        onStatusChange={noop}
        onDelete={onDelete}
      />
    )

    fireEvent.click(getByLabelText(copy.actions.delete))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onPrimaryAction).not.toHaveBeenCalled()
  })

  it("calls onPrimaryAction from the CTA button; card navigation no longer depends on it", () => {
    const onDelete = mock(() => {})
    const onPrimaryAction = mock(() => {})
    const { getByText } = render(
      <AgentListItem
        agent={{
          id: "agent_1",
          name: "Support",
          description: "Helps customers",
          status: "DRAFT",
          operationalStatus: "READY_TO_CONNECT",
          activeChannelsCount: 0,
          knowledgeCount: 0,
          actionCount: 0,
          channelBindings: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }}
        lang="en"
        copy={copy}
        onPrimaryAction={onPrimaryAction}
        onEdit={noop}
        onAdvancedAction={noop}
        onStatusChange={noop}
        onDelete={onDelete}
      />
    )

    fireEvent.click(getByText(copy.actions.connect))

    expect(onPrimaryAction).toHaveBeenCalledTimes(1)
  })
})
