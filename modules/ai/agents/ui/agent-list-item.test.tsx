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
    expect(
      getByTestId("agent-card-agent_1").querySelectorAll("button").length
    ).toBe(3)
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
})
