---
title: Setup Commands
summary: Onboard, run, doctor, and configure
---

Instance setup and diagnostics commands.

## `taskcore run`

One-command bootstrap and start:

```sh
pnpm taskcore run
```

Does:

1. Auto-onboards if config is missing
2. Runs `taskcore doctor` with repair enabled
3. Starts the server when checks pass

Choose a specific instance:

```sh
npx taskcore run --instance dev
```

## `taskcore onboard`

Interactive first-time setup:

```sh
pnpm taskcore onboard
```

If Taskcore is already configured, rerunning `onboard` keeps the existing config in place. Use `taskcore configure` to change settings on an existing install.

First prompt:

1. `Quickstart` (recommended): local defaults (embedded database, no LLM provider, local disk storage, default secrets)
2. `Advanced setup`: full interactive configuration

Start immediately after onboarding:

```sh
pnpm taskcore onboard --run
```

Quickstart defaults + immediate start:

```sh
pnpm taskcore onboard --yes
```

When onboarding starts Taskcore from an interactive terminal, it opens the
onboarding page in your browser once. Non-interactive terminals stay silent.
Suppress browser opening explicitly for headless or automated runs with either
environment variable:

```sh
TASKCORE_NO_BROWSER=1 pnpm taskcore onboard --yes
TASKCORE_OPEN_ON_LISTEN=false pnpm taskcore onboard --yes
```

On an existing install, `--yes` now preserves the current config and just starts Taskcore with that setup.

## `taskcore doctor`

Health checks with optional auto-repair:

```sh
pnpm taskcore doctor
pnpm taskcore doctor --repair
```

Validates:

- Server configuration
- Database connectivity
- Secrets adapter configuration, including AWS Secrets Manager non-secret env
  config when selected
- Storage configuration
- Missing key files

## `taskcore configure`

Update configuration sections:

```sh
pnpm taskcore configure --section server
pnpm taskcore configure --section secrets
pnpm taskcore configure --section storage
```

`--section secrets` updates the deployment-level provider used as the fallback
for secrets that do not target a specific company vault. Per-company provider
vaults (named instances, default vault selection, multiple vaults per provider,
coming-soon GCP/Vault) live in the board UI under
`Company Settings → Secrets → Provider vaults` and the
`/api/companies/{companyId}/secret-provider-configs` API.

## `taskcore env`

Show resolved environment configuration:

```sh
pnpm taskcore env
```

This now includes bind-oriented deployment settings such as `TASKCORE_BIND` and `TASKCORE_BIND_HOST` when configured.

## `taskcore allowed-hostname`

Allow a private hostname for authenticated/private mode:

```sh
npx taskcore allowed-hostname my-tailscale-host
```

## Local Storage Paths

| Data        | Default Path                                       |
| ----------- | -------------------------------------------------- |
| Config      | `~/.taskcore/instances/default/config.json`        |
| Database    | `~/.taskcore/instances/default/db`                 |
| Logs        | `~/.taskcore/instances/default/logs`               |
| Storage     | `~/.taskcore/instances/default/data/storage`       |
| Secrets key | `~/.taskcore/instances/default/secrets/master.key` |

Override with:

```sh
TASKCORE_HOME=/custom/home TASKCORE_INSTANCE_ID=dev pnpm taskcore run
```

Or pass `--data-dir` directly on any command:

```sh
npx taskcore run --data-dir ./tmp/taskcore-dev
npx taskcore doctor --data-dir ./tmp/taskcore-dev
```
