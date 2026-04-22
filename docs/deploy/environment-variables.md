---
title: Environment Variables
summary: Full environment variable reference
---

All environment variables that Taskcore uses for server configuration.

## Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `TASKCORE_BIND` | `loopback` | Reachability preset: `loopback`, `lan`, `tailnet`, or `custom` |
| `TASKCORE_BIND_HOST` | (unset) | Required when `TASKCORE_BIND=custom` |
| `HOST` | `127.0.0.1` | Legacy host override; prefer `TASKCORE_BIND` for new setups |
| `DATABASE_URL` | (embedded) | PostgreSQL connection string |
| `TASKCORE_HOME` | `~/.taskcore` | Base directory for all Taskcore data |
| `TASKCORE_INSTANCE_ID` | `default` | Instance identifier (for multiple local instances) |
| `TASKCORE_DEPLOYMENT_MODE` | `local_trusted` | Runtime mode override |
| `TASKCORE_DEPLOYMENT_EXPOSURE` | `private` | Exposure policy when deployment mode is `authenticated` |
| `TASKCORE_API_URL` | (auto-derived) | Taskcore API base URL. When set externally (e.g., via Kubernetes ConfigMap, load balancer, or reverse proxy), the server preserves the value instead of deriving it from the listen host and port. Useful for deployments where the public-facing URL differs from the local bind address. |

## Secrets

| Variable | Default | Description |
|----------|---------|-------------|
| `TASKCORE_SECRETS_MASTER_KEY` | (from file) | 32-byte encryption key (base64/hex/raw) |
| `TASKCORE_SECRETS_MASTER_KEY_FILE` | `~/.taskcore/.../secrets/master.key` | Path to key file |
| `TASKCORE_SECRETS_STRICT_MODE` | `false` | Require secret refs for sensitive env vars |

## Agent Runtime (Injected into agent processes)

These are set automatically by the server when invoking agents:

| Variable | Description |
|----------|-------------|
| `TASKCORE_AGENT_ID` | Agent's unique ID |
| `TASKCORE_COMPANY_ID` | Company ID |
| `TASKCORE_API_URL` | Taskcore API base URL (inherits the server-level value; see Server Configuration above) |
| `TASKCORE_API_KEY` | Short-lived JWT for API auth |
| `TASKCORE_RUN_ID` | Current heartbeat run ID |
| `TASKCORE_TASK_ID` | Issue that triggered this wake |
| `TASKCORE_WAKE_REASON` | Wake trigger reason |
| `TASKCORE_WAKE_COMMENT_ID` | Comment that triggered this wake |
| `TASKCORE_APPROVAL_ID` | Resolved approval ID |
| `TASKCORE_APPROVAL_STATUS` | Approval decision |
| `TASKCORE_LINKED_ISSUE_IDS` | Comma-separated linked issue IDs |

## LLM Provider Keys (for adapters)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude Local adapter) |
| `OPENAI_API_KEY` | OpenAI API key (for Codex Local adapter) |
