---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
npx taskcore issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
npx taskcore issue get <issue-id-or-identifier>

# Create issue
npx taskcore issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
npx taskcore issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
npx taskcore issue comment <issue-id> --body "..." [--reopen]

# Checkout task
npx taskcore issue checkout <issue-id> --agent-id <agent-id>

# Release task
npx taskcore issue release <issue-id>
```

## Company Commands

```sh
npx taskcore company list
npx taskcore company get <company-id>
npx taskcore company current [--company-id <company-id>]

# Export to portable folder package (writes manifest + markdown files)
npx taskcore company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
npx taskcore company import \
  <owner>/<repo>/<path> \
  --target existing \
  --company-id <company-id> \
  --ref main \
  --collision rename \
  --dry-run

# Apply import
npx taskcore company import \
  ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

`company import` is unavailable against cloud-managed instances — the
server answers `403` with `code: "cloud_managed"`. Export remains available
there.

With agent authentication, use `company list` or `company current` to resolve
the scoped company. `company list` first tries the board-wide list; if that is
forbidden, it falls back to `--company-id`, `TASKCORE_COMPANY_ID`, context, or
`/api/agents/me` and returns only that scoped company. `company create` requires
board/instance-admin authentication because it is an instance-wide setup
command.

## Agent Commands

```sh
npx taskcore agent list
npx taskcore agent get <agent-id>
```

## Skills Commands

```sh
# Browse app-shipped catalog skills without changing company state
npx taskcore skills browse [--kind bundled|optional] [--category software-development] [--query github]
npx taskcore skills search "pull request" [--json]

# Inspect catalog metadata and file inventory before install
npx taskcore skills inspect github-pr-workflow

# Install a catalog skill into the company skill library
# This does not attach the skill to any agent.
npx taskcore skills install github-pr-workflow --company-id <company-id>
npx taskcore skills install github-pr-workflow --as pr-flow --force --company-id <company-id>

# External sources still use import instead of catalog install
npx taskcore skills import ./skills/my-skill --company-id <company-id>
npx taskcore skills import owner/repo/path/to/skill --company-id <company-id>

# Attach desired company skills to an agent after install/import
npx taskcore skills agent sync <agent-id> --skill github-pr-workflow --mode add --company-id <company-id>
```

## Approval Commands

```sh
# List approvals
npx taskcore approval list [--status pending]

# Get approval
npx taskcore approval get <approval-id>

# Create approval
npx taskcore approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
npx taskcore approval approve <approval-id> [--decision-note "..."]

# Reject
npx taskcore approval reject <approval-id> [--decision-note "..."]

# Request revision
npx taskcore approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
npx taskcore approval resubmit <approval-id> [--payload '{"..."}']

# Comment
npx taskcore approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
npx taskcore activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
npx taskcore dashboard get
```

## Instance Settings

```sh
npx taskcore instance settings:general
npx taskcore instance settings:general:update --payload-json '{...}'
npx taskcore instance settings:experimental
npx taskcore instance settings:experimental:update --payload-json '{...}'
```

Experimental features are opt-in and are provided without compatibility guarantees. They may break, change, or be removed at any time. Use them at your own risk.

## Heartbeat

```sh
npx taskcore heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
