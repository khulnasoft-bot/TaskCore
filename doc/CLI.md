# CLI Reference

Taskcore CLI now supports both:

- instance setup/diagnostics (`onboard`, `doctor`, `configure`, `env`, `allowed-hostname`)
- control-plane client operations (issues, approvals, agents, activity, dashboard)

## Base Usage

Use repo script in development:

```sh
pnpm taskcore --help
```

First-time local bootstrap + run:

```sh
pnpm taskcore run
```

Choose local instance:

```sh
pnpm taskcore run --instance dev
```

## Deployment Modes

Mode taxonomy and design intent are documented in `doc/DEPLOYMENT-MODES.md`.

Current CLI behavior:

- `taskcore onboard` and `taskcore configure --section server` set deployment mode in config
- server onboarding/configure ask for reachability intent and write `server.bind`
- `taskcore run --bind <loopback|lan|tailnet>` passes a quickstart bind preset into first-run onboarding when config is missing
- runtime can override mode with `TASKCORE_DEPLOYMENT_MODE`
- `taskcore run` and `taskcore doctor` still do not expose a direct low-level `--mode` flag

Canonical behavior is documented in `doc/DEPLOYMENT-MODES.md`.

Allow an authenticated/private hostname (for example custom Tailscale DNS):

```sh
pnpm taskcore allowed-hostname dotta-macbook-pro
```

All client commands support:

- `--data-dir <path>`
- `--api-base <url>`
- `--api-key <token>`
- `--context <path>`
- `--profile <name>`
- `--json`

Company-scoped commands also support `--company-id <id>`.

Use `--data-dir` on any CLI command to isolate all default local state (config/context/db/logs/storage/secrets) away from `~/.taskcore`:

```sh
pnpm taskcore run --data-dir ./tmp/taskcore-dev
pnpm taskcore issue list --data-dir ./tmp/taskcore-dev
```

## Context Profiles

Store local defaults in `~/.taskcore/context.json`:

```sh
pnpm taskcore context set --api-base http://localhost:3100 --company-id <company-id>
pnpm taskcore context show
pnpm taskcore context list
pnpm taskcore context use default
```

To avoid storing secrets in context, set `apiKeyEnvVarName` and keep the key in env:

```sh
pnpm taskcore context set --api-key-env-var-name TASKCORE_API_KEY
export TASKCORE_API_KEY=...
```

## Company Commands

```sh
pnpm taskcore company list
pnpm taskcore company get <company-id>
pnpm taskcore company delete <company-id-or-prefix> --yes --confirm <same-id-or-prefix>
```

Examples:

```sh
pnpm taskcore company delete PAP --yes --confirm PAP
pnpm taskcore company delete 5cbe79ee-acb3-4597-896e-7662742593cd --yes --confirm 5cbe79ee-acb3-4597-896e-7662742593cd
```

Notes:

- Deletion is server-gated by `TASKCORE_ENABLE_COMPANY_DELETION`.
- With agent authentication, company deletion is company-scoped. Use the current company ID/prefix (for example via `--company-id` or `TASKCORE_COMPANY_ID`), not another company.

## Issue Commands

```sh
pnpm taskcore issue list --company-id <company-id> [--status todo,in_progress] [--assignee-agent-id <agent-id>] [--match text]
pnpm taskcore issue get <issue-id-or-identifier>
pnpm taskcore issue create --company-id <company-id> --title "..." [--description "..."] [--status todo] [--priority high]
pnpm taskcore issue update <issue-id> [--status in_progress] [--comment "..."]
pnpm taskcore issue comment <issue-id> --body "..." [--reopen]
pnpm taskcore issue checkout <issue-id> --agent-id <agent-id> [--expected-statuses todo,backlog,blocked]
pnpm taskcore issue release <issue-id>
```

## Agent Commands

```sh
pnpm taskcore agent list --company-id <company-id>
pnpm taskcore agent get <agent-id>
pnpm taskcore agent local-cli <agent-id-or-shortname> --company-id <company-id>
```

`agent local-cli` is the quickest way to run local Claude/Codex manually as a Taskcore agent:

- creates a new long-lived agent API key
- installs missing Taskcore skills into `~/.codex/skills` and `~/.claude/skills`
- prints `export ...` lines for `TASKCORE_API_URL`, `TASKCORE_COMPANY_ID`, `TASKCORE_AGENT_ID`, and `TASKCORE_API_KEY`

Example for shortname-based local setup:

```sh
pnpm taskcore agent local-cli codexcoder --company-id <company-id>
pnpm taskcore agent local-cli claudecoder --company-id <company-id>
```

## Approval Commands

```sh
pnpm taskcore approval list --company-id <company-id> [--status pending]
pnpm taskcore approval get <approval-id>
pnpm taskcore approval create --company-id <company-id> --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]
pnpm taskcore approval approve <approval-id> [--decision-note "..."]
pnpm taskcore approval reject <approval-id> [--decision-note "..."]
pnpm taskcore approval request-revision <approval-id> [--decision-note "..."]
pnpm taskcore approval resubmit <approval-id> [--payload '{"...":"..."}']
pnpm taskcore approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm taskcore activity list --company-id <company-id> [--agent-id <agent-id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard Commands

```sh
pnpm taskcore dashboard get --company-id <company-id>
```

## Heartbeat Command

`heartbeat run` now also supports context/api-key options and uses the shared client stack:

```sh
pnpm taskcore heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100] [--api-key <token>]
```

## Local Storage Defaults

Default local instance root is `~/.taskcore/instances/default`:

- config: `~/.taskcore/instances/default/config.json`
- embedded db: `~/.taskcore/instances/default/db`
- logs: `~/.taskcore/instances/default/logs`
- storage: `~/.taskcore/instances/default/data/storage`
- secrets key: `~/.taskcore/instances/default/secrets/master.key`

Override base home or instance with env vars:

```sh
TASKCORE_HOME=/custom/home TASKCORE_INSTANCE_ID=dev pnpm taskcore run
```

## Storage Configuration

Configure storage provider and settings:

```sh
pnpm taskcore configure --section storage
```

Supported providers:

- `local_disk` (default; local single-user installs)
- `s3` (S3-compatible object storage)
