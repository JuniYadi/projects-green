import { GithubEventsTable } from "./_components/github-events-table"

export default function GithubEventsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">GitHub Events</h1>
        <p className="text-sm text-muted-foreground">
          Monitor GitHub webhook deliveries, repository context, commit details,
          processing state, and raw payloads for App Hosting.
        </p>
      </header>
      <GithubEventsTable />
    </main>
  )
}
