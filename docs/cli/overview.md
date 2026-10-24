---
title: CLI Overview
summary: CLI installation and setup
---

The Taskcore CLI handles instance setup, diagnostics, and control-plane operations.

## Usage

```sh
pnpm taskcore --help
```

## Global Options

All commands support:

| Flag                | Description                                            |
| ------------------- | ------------------------------------------------------ |
| `--data-dir <path>` | Local Taskcore data root (isolates from `~/.taskcore`) |
| `--api-base <url>`  | API base URL                                           |
| `--api-key <token>` | API authentication token                               |
| `--context <path>`  | Context file path                                      |
| `--profile <name>`  | Context profile name                                   |
| `--json`            | Output as JSON                                         |

Company-scoped commands also accept `--company-id <id>`.

For clean local instances, pass `--data-dir` on the command you run:

```sh
npx taskcore run --data-dir ./tmp/taskcore-dev
```

## Context Profiles

Store defaults to avoid repeating flags:

```sh
# Set defaults
npx taskcore context set --api-base http://localhost:3100 --company-id <id>

# View current context
pnpm taskcore context show

# List profiles
pnpm taskcore context list

# Switch profile
npx taskcore context use default
```

To avoid storing secrets in context, use an env var:

```sh
npx taskcore context set --api-key-env-var-name TASKCORE_API_KEY
export TASKCORE_API_KEY=...
```

Secret operations are available under `taskcore secrets`:

```sh
npx taskcore secrets declarations --company-id <company-id> --kind secret
npx taskcore secrets create --company-id <company-id> --name anthropic-api-key --value-env ANTHROPIC_API_KEY
npx taskcore secrets link --company-id <company-id> --name prod-stripe-key --provider aws_secrets_manager --external-ref <provider-ref>
npx taskcore secrets doctor --company-id <company-id>
npx taskcore secrets migrate-inline-env --company-id <company-id> --apply
```

Context is stored at `~/.taskcore/context.json`.

## Command Categories

The CLI has two categories:

1. **[Setup commands](/cli/setup-commands)** — instance bootstrap, diagnostics, configuration
2. **[Control-plane commands](/cli/control-plane-commands)** — issues, agents, approvals, activity
