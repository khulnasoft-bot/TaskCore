# Vercel Deployment Analysis and Plan

Status: Proposal; `vercel_blob` storage provider implemented
Date: 2026-10-25

## 1. Verdict

The `ui` package can be deployed to Vercel as a static Vite site. The
`server` package is not a drop-in Vercel deployment, even when Vercel stores and
Marketplace integrations provide Postgres, object storage, and Redis.

Vercel stores remove the data-layer blockers. They do not remove the execution
model blockers: always-on scheduling, local workspaces, subprocess agent
adapters, startup recovery, and long-lived realtime sessions.

Recommended path:

1. Deploy the UI on Vercel.
2. Use Vercel Marketplace stores for data: Neon Postgres, Vercel Blob (through
   the new `vercel_blob` storage provider), or AWS S3 through the Marketplace.
3. Keep the Taskcore control plane on a persistent host (Docker image on
   ECS/Fargate, Fly.io, Railway, Render, or a VM). Attach the same stores.
4. Treat "run the whole app on Vercel Functions" as a separate engineering
   project. Option D below scopes that work.

If one origin and full realtime fidelity matter more than Vercel hosting,
deploy the Docker image and its built-in UI on one persistent host. That is the
lowest-risk production path. Vercel can still host docs, Storybook, or a
marketing page.

## 2. Scope and Evidence

Analyzed layers:

- Root workspace: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`
- UI: `ui/package.json`, `ui/vite.config.ts`, `ui/src/api/client.ts`
- Realtime: `ui/src/context/LiveUpdatesProvider.tsx`,
  `ui/src/lib/websocket-url.ts`, `server/src/realtime/*`
- Server runtime: `server/package.json`, `server/src/index.ts`,
  `server/src/app.ts`, `server/src/config.ts`
- Server data/runtime dependencies: embedded PostgreSQL, local storage,
  workspace services, heartbeat scheduler, native runner, secrets provider
- Storage abstraction: `packages/shared/src/constants.ts`,
  `server/src/storage/*`
- Deployment docs: `docs/deploy/overview.md`, `docs/deploy/aws-ecs.md`,
  `doc/DOCKER.md`, `doc/DEPLOYMENT-MODES.md`
- Vercel platform: Marketplace storage, Vercel Blob private storage, Global
  Config, WebSockets, Cron, Functions limits, external rewrites
- Repo state: `.vercel/project.json` is linked to a Vercel project;
  `vercel.json` now exists and deploys the UI only. There is no
  `.vercelignore` in the current tree.

Verification performed:

```sh
pnpm --filter @taskcore/ui build
```

Result: success in about 6 seconds, output in `ui/dist` (19 MB total;
largest entry chunk about 6.8 MB minified / 1.9 MB gzip). The UI build does not
need the server, Rust toolchain, or database.

## 3. Findings

### 3.1 UI is Vercel-compatible

- React 19 + Vite 8, output is a normal static bundle.
- The build only needs the workspace packages that `@taskcore/ui` imports;
  those packages export TypeScript source and are compiled by Vite.
- `ui/vite.config.ts` reads the build commit from `TASKCORE_BUILD_COMMIT` or
  `git rev-parse HEAD`. Set the env var on Vercel because the build checkout
  may not expose `.git`.
- No server-side rendering, no Vercel Functions, no platform-specific runtime.

### 3.2 The control plane is not a drop-in Vercel deployment

The server is a long-lived Express process with state and background work:

- **Background scheduler**: `HEARTBEAT_SCHEDULER_ENABLED` drives heartbeats
  every 30 seconds by default. Vercel Functions are request-scoped and freeze
  between invocations. Vercel Cron has a one-minute minimum interval on paid
  plans (once per day on Hobby) and per-run duration limits, which does not
  replace the in-process scheduler without a redesign.
- **Agent execution**: local adapters spawn CLI processes; workspaces live on
  disk; the native runner is built with Cargo. Vercel Functions have an
  ephemeral filesystem and bounded execution time, and the root build does not
  include a Rust toolchain by default.
- **Realtime**: live events, run transcripts, and terminal sessions use
  WebSocket upgrades. Vercel Functions support WebSockets in public beta
  (2026-06-22) on Fluid compute, but connections are pinned to one instance,
  close at the maximum duration, and need external pub/sub to fan out across
  instances.
- **Boot behavior**: startup performs migrations, storage initialization,
  secret/key setup, and recovery reconciliation. This is designed for one
  always-on instance, not a request-triggered function.
- **Filesystem**: local disk storage and the secrets master key file are
  defaults. Vercel Blob/S3 removes the asset-storage default, and
  `TASKCORE_SECRETS_MASTER_KEY` removes the key-file default. Workspaces,
  worktrees, and local runtime state still expect persistent disk.

Wrapping the Express app in one Vercel Function can make HTTP routes respond,
but it does not preserve the control-plane invariants in `AGENTS.md`
(heartbeat scheduling, atomic execution recovery, local workspace ownership).

### 3.3 UI assumes same-origin `/api`

`ui/src/api/client.ts` hardcodes `const BASE = "/api"` and sends
`credentials: "include"`. The live-events client builds a same-origin
WebSocket URL at `/api/companies/:id/events/ws`.

Consequences:

- A UI-only Vercel deploy has no backend and will fail at the session/health
  request.
- A split deploy must proxy `/api` from the Vercel domain to the server. The
  simplest option is a Vercel rewrite to an external origin.
- If the WebSocket upgrade fails, `LiveUpdatesProvider` falls back to polling
  every 15 seconds. Other realtime surfaces (run transcripts, terminal) may
  degrade more visibly and must be checked.
- Cookies work only if the backend does not set a cookie `Domain` for a
  different host. Better Auth in this repo uses host-scoped cookies through the
  reverse proxy in the normal case, but auth flows still need a live test.
- External rewrites can impose request-body limits below what the UI supports
  for large attachments. Add an upload test before calling the split deploy
  production-ready.

### 3.4 Build configuration pitfalls

- Do **not** use the root `pnpm build` as the Vercel build command. It runs
  `pnpm -r build`, which builds the Rust runner (`cargo build --release`) and
  packages the server. That is unnecessary for the UI, likely exceeds the
  45-minute Vercel build limit, and can fail without a Rust toolchain.
- Use `pnpm --filter @taskcore/ui build` with `outputDirectory: "ui/dist"`.
- Node must satisfy `>=24.11.0` (`package.json` engines, `.nvmrc` 24). Set
  `NODE_VERSION=24` on the Vercel project unless the project's Node setting is
  already 24.
- Keep the pnpm workspace complete during install. A `.vercelignore` that
  removes `packages/`, `server/`, or `cli/` can break the frozen-lockfile
  install because they are workspace importers. Optimize with pnpm filters
  only after testing a clean build.

### 3.5 Current Vercel state

`.vercel/project.json` is present and points at a linked Vercel project. Prior
attempts in unreachable history added a static `vercel.json` and
`.vercelignore`; the current tree has neither. Any plan should create the
configuration deliberately rather than reintroducing the old catch-all
`.vercelignore`.

### 3.6 Vercel stores and integrations fit

Current Vercel storage model (2026):

- Vercel runs Blob and Global Config directly.
- Vercel Postgres and Vercel KV no longer exist. Postgres and Redis come from
  Marketplace integrations (Neon, Supabase, AWS Aurora/Prisma for Postgres;
  Redis/Upstash for KV).
- Amazon S3 is available in the Marketplace and can be attached to a project.
- Vercel Blob is S3-backed but exposes its own API, not the S3 API.

Fit against Taskcore:

| Vercel store/integration             | Taskcore use                                                        | Works today?                           | Required work                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Neon Postgres (Marketplace)          | `DATABASE_URL` for runtime; `DATABASE_MIGRATION_URL` for migrations | Yes                                    | Provision integration; map pooled URL to runtime and unpooled URL to migrations; run migrations as a deploy step                     |
| Supabase/Aurora/Prisma Postgres      | Same as above                                                       | Yes, if standard Postgres and TLS work | Verify driver compatibility and pooled/direct URLs                                                                                   |
| Vercel Blob                          | Attachments, avatars, uploaded artifacts                            | Yes                                    | Provider implemented: shared constant, config, registry, provider, tests, docs                                                       |
| AWS S3 (Marketplace)                 | Attachments and artifacts through the existing S3 provider          | Probably                               | Verify the Marketplace OIDC credential shape works with the AWS SDK default chain; otherwise wire credentials explicitly or use Blob |
| Upstash Redis / Redis                | None today                                                          | Not used                               | Only needed if realtime fan-out, distributed scheduler locks, or shared rate limiting are added                                      |
| Global Config (formerly Edge Config) | None today                                                          | Not used                               | Only for small runtime flags; never secrets or per-company data                                                                      |
| Vercel Functions + Cron              | Scheduler/agent execution replacement                               | No, not without redesign               | Move ticks to Cron/Queues/Workflows and move agent execution to remote runners or a worker                                           |
| Vercel WebSockets (beta)             | Live events, transcripts, terminal                                  | Partial                                | Test upgrade through the chosen deployment; add reconnect and pub/sub; verify duration limits                                        |
| Vercel environment variables         | Secrets and config                                                  | Yes                                    | Use `TASKCORE_SECRETS_MASTER_KEY` so no key file is needed; keep `BETTER_AUTH_SECRET` in Vercel                                      |

Storage provider implementation for Vercel Blob (completed):

- `vercel_blob` is in `STORAGE_PROVIDERS` in
  `packages/shared/src/constants.ts`.
- Config fields are wired in `server/src/config.ts`:
  `TASKCORE_STORAGE_PROVIDER=vercel_blob`, optional
  `TASKCORE_STORAGE_VERCEL_BLOB_PREFIX`, access, token, and store id.
- `server/src/storage/vercel-blob-provider.ts` is registered in
  `server/src/storage/provider-registry.ts`.
- The provider uses `put`, `get`, `head`, and `del`, preserves range reads,
  supports private and public access, and maps missing objects to `notFound`.
- Auth supports `BLOB_READ_WRITE_TOKEN` outside Vercel and
  `BLOB_STORE_ID` + `VERCEL_OIDC_TOKEN` on Vercel.
- Company prefix validation stays in `server/src/storage/service.ts`.
- Tests cover upload options, prefixing, range reads, missing objects, idempotent
  deletes, and required credentials.

Vercel Blob is still not a drop-in replacement for the S3 provider, but it is
now selectable without changing the storage abstraction.

## 4. Deployment Options

| Option                        | UI                | API / control plane                                | Data                              | Realtime                                       | Recommendation                    |
| ----------------------------- | ----------------- | -------------------------------------------------- | --------------------------------- | ---------------------------------------------- | --------------------------------- |
| A. Split + Vercel stores      | Vercel static     | Persistent container                               | Neon Postgres + Blob/S3           | Polling fallback; proxy WebSocket if supported | Recommended near-term Vercel path |
| B. Single-origin container    | Built into server | Same container                                     | Marketplace stores or self-hosted | Native WebSockets                              | Recommended default               |
| C. Hybrid Vercel app + worker | Vercel static     | Vercel Function for HTTP; external worker for runs | Neon Postgres + Blob              | Vercel WS beta + external pub/sub              | Only after an API/worker split    |
| D. Full Vercel port           | Vercel            | Vercel Functions + Cron/Queues/Workflows           | Neon Postgres + Blob              | Beta WebSockets + Redis pub/sub                | Separate engineering project      |

### Option A: Vercel UI, persistent server, Vercel stores

Topology:

```
Browser
  |  https://app.example.com
  v
Vercel static UI  --/api rewrite-->  https://api.example.com (Taskcore server)
  |                                        |
  +-- static assets, service worker        +-- Neon Postgres (Marketplace)
                                           +-- Vercel Blob or AWS S3
                                           +-- Upstash Redis (optional)
                                           +-- remote sandboxes / runners
```

Work items:

1. Provision storage from the Vercel project:
   - Neon Postgres integration, or another Marketplace Postgres.
   - Vercel Blob store (private) or AWS S3 Marketplace integration.
   - Optional Redis integration only if you are adding pub/sub or shared locks.
2. Copy the store credentials to the persistent server's secret manager.
   Marketplace variables are injected into the Vercel project; the external
   server needs its own copies. Use `BLOB_READ_WRITE_TOKEN` for Blob outside
   Vercel.
3. Deploy the server to a persistent host using the existing Docker image.
   Configure `DATABASE_URL`, `DATABASE_MIGRATION_URL`,
   `BETTER_AUTH_SECRET`, `TASKCORE_SECRETS_MASTER_KEY`,
   `TASKCORE_DEPLOYMENT_MODE=authenticated`,
   `TASKCORE_DEPLOYMENT_EXPOSURE=public`, `TASKCORE_PUBLIC_URL`, TLS, and the
   selected storage provider. See `docs/deploy/aws-ecs.md`.
4. Add the Vercel Blob provider (section 3.6) or point
   `TASKCORE_STORAGE_PROVIDER=s3` at the S3 integration and verify credentials.
5. Create the Vercel project from the repo root (not `ui/`) so the root
   workspace and lockfile are available.
6. Set the build command to the UI filter, output to `ui/dist`, and set
   `NODE_VERSION=24`.
7. Add the `/api` rewrite to the server origin in `vercel.json`. Put the API
   rewrite before the SPA fallback.
8. Configure the server's public URL/trusted origin for the Vercel hostname so
   invite links, Better Auth redirects, and board mutation origin checks use
   the Vercel origin. Keep the API origin reachable from Vercel and from
   agents.
9. Verify the checklist in section 7, including cookie flags, WebSocket
   fallback, attachments, and deep links.

Known limitations:

- Realtime falls back to 15-second polling if `/api/.../events/ws` cannot
  upgrade through the rewrite.
- Any feature that requires a direct WebSocket (run transcripts, terminal) may
  not work through the rewrite.
- Large uploads can exceed Vercel proxy limits.
- The server must remain publicly reachable at the rewrite target, or the
  Vercel deployment must sit behind an authenticated network proxy.
- Vercel is on the critical path for the board even though it does not run the
  control plane.

### Option B: Single-origin container (recommended default)

Deploy the Docker image with a persistent Postgres and storage. The server
serves `ui/dist` itself, so `/api`, cookies, WebSockets, and attachments are
same-origin with no proxy.

You can still use Vercel Marketplace stores from the container:

- Neon Postgres with `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`
  (migrations).
- Vercel Blob with `BLOB_READ_WRITE_TOKEN` and the new provider.
- AWS S3 through the existing provider.

This is the narrowest risk path and matches the existing production docs. Use
Vercel only for static surfaces such as the Mintlify docs, Storybook, or a
marketing page.

### Option C: Hybrid Vercel app plus worker

This is the closest realistic "mostly on Vercel" architecture without a full
server port:

- Vercel serves the UI from `ui/dist`.
- A Vercel Function wraps the Express HTTP app for request/response routes.
- Neon Postgres and Vercel Blob hold durable state.
- A small always-on worker, running the existing Taskcore server image, owns
  heartbeat scheduling, local workspaces, and agent execution.
- The function and worker share the same database. The worker exposes internal
  execution endpoints; the function forwards run-start requests.

This requires an API/worker split that does not exist today. The current server
assumes one process owns startup recovery, the scheduler, and execution locks.
Do not attempt it without isolating those responsibilities first.

### Option D: Full Vercel port with stores and integrations

Not recommended for the current architecture, but this is the concrete scope if
Vercel must host everything:

1. **Build split**
   - UI: `pnpm --filter @taskcore/ui build` → `ui/dist`.
   - API: emit `server/dist` without the Rust runner build; expose it through
     an `api/index.ts` Vercel Function.
   - Do not use root `pnpm build`.
2. **Data**
   - Neon Postgres via Marketplace; `DATABASE_URL` for runtime,
     `DATABASE_URL_UNPOOLED` for migrations.
   - Vercel Blob provider for attachments and artifacts, or S3 Marketplace.
   - `TASKCORE_SECRETS_MASTER_KEY` in Vercel env; no local key file.
3. **Scheduler**
   - Replace the in-process 30-second loop with a protected Cron route on a
     paid plan (one-minute minimum) or Queues/Workflows.
   - Add distributed locking so overlapping invocations cannot double-claim a
     run.
   - Keep startup recovery idempotent and bounded.
4. **Agent execution**
   - Use remote runtimes only: Daytona, E2B, Modal, Cloudflare, Kubernetes, or
     a dedicated runner service.
   - Disable or reject `*_local` adapters and host-local native runner starts.
   - Move workspace/worktree ownership out of the function filesystem.
5. **Realtime**
   - Use Vercel Function WebSockets (beta) or SSE.
   - Add Redis pub/sub (Upstash Marketplace) for cross-instance fan-out.
   - Handle reconnect after the function maximum duration.
   - Keep the UI's polling fallback for degraded mode.
6. **Operations**
   - Decide function region, memory, maximum duration, and concurrency.
   - Add migrations to a deploy step, not every cold start.
   - Verify Marketplace billing, egress, and storage limits.
   - Add observability for cold starts, connection pool saturation, and
     WebSocket churn.

This is a product architecture change, not a deployment configuration change.

## 5. Vercel Store Configuration

### Postgres

Use the Neon Marketplace integration or another managed Postgres:

```sh
# Runtime (pooled)
DATABASE_URL="$DATABASE_URL"
# Migrations (direct/unpooled)
DATABASE_MIGRATION_URL="$DATABASE_URL_UNPOOLED"
```

Notes:

- Run `pnpm db:migrate` once per deploy or from CI against the unpooled URL.
- Do not run migrations on every function cold start.
- Keep `DATABASE_URL` on the persistent server too if using Option A/B.
- Verify the connection limit and pooler mode before enabling many concurrent
  agent runs.

### Vercel Blob

Create a private Blob store and connect it to the Vercel project.

On Vercel:

- OIDC is the default; no static token is required.
- The SDK uses `VERCEL_OIDC_TOKEN` + `BLOB_STORE_ID`.

Outside Vercel (Option A/B control plane):

- Use `BLOB_READ_WRITE_TOKEN` from the connected store.
- Store it in the server's secret manager, not in the repo.

Required code work:

- `packages/shared/src/constants.ts`: add `vercel_blob` to
  `STORAGE_PROVIDERS`.
- `server/src/config.ts`: read `TASKCORE_STORAGE_VERCEL_BLOB_PREFIX`.
- `server/src/storage/vercel-blob-provider.ts`: implement `putObject`,
  `getObject`, `headObject`, `deleteObject`.
- `server/src/storage/provider-registry.ts`: select the provider.
- Tests: private upload, download, range read, missing object, delete, and
  company-prefix enforcement.
- Docs: `docs/deploy/storage.md` and the deployment env reference.

Map errors carefully:

- Missing blob → Taskcore `notFound`.
- Size/content mismatch → `unprocessable`.
- Auth failure → startup or request error that does not leak the token.

### AWS S3 through the Marketplace

If you prefer the existing S3 provider:

```sh
TASKCORE_STORAGE_PROVIDER=s3
TASKCORE_STORAGE_S3_BUCKET=...
TASKCORE_STORAGE_S3_REGION=...
TASKCORE_STORAGE_S3_PREFIX=taskcore
```

Verify that the Marketplace integration's OIDC credentials resolve through the
AWS SDK default credential chain used by `server/src/storage/s3-provider.ts`.
If they do not, either add explicit credential wiring or use Blob. Do not put
long-lived AWS keys in `NEXT_PUBLIC`/`VITE_` variables.

### Redis / Global Config

Taskcore does not read Redis or Global Config today.

- Add Upstash Redis only when implementing realtime fan-out, distributed
  scheduler locks, or shared rate limiting.
- Use Global Config only for small, non-secret runtime flags.
- Do not use either for company-scoped data, workspace state, or secrets.

## 6. Draft Vercel Configuration (Option A)

`vercel.json` is present at the repo root. Before deploying, replace
`api.example.com` with the real server origin. This config is deliberately
UI-only; it does not deploy the server.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "TASKCORE_BUILD_COMMIT=$VERCEL_GIT_COMMIT_SHA pnpm --filter @taskcore/ui build",
  "outputDirectory": "ui/dist",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/sw.js",
      "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
    },
    {
      "source": "/",
      "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.example.com/api/:path*"
    },
    {
      "source": "/:path*",
      "destination": "/index.html"
    }
  ]
}
```

Notes:

- `framework: "vite"` is advisory. The explicit build and output settings are
  what matter.
- Keeping `installCommand` at the workspace root preserves workspace links.
  If install time becomes a problem, try a filtered install in a preview
  deployment first; do not remove workspace packages.
- The catch-all SPA rewrite is safe for Vite output because Vercel serves
  existing static files before applying rewrites. The `/api` rewrite is ordered
  first so API requests never hit the SPA fallback.
- Do not add server-only variables such as `DATABASE_URL`,
  `BLOB_READ_WRITE_TOKEN`, or `TASKCORE_SECRETS_MASTER_KEY` to the UI build
  environment. The UI has no server-side env contract beyond optional `VITE_*`
  values.
- If `$VERCEL_GIT_COMMIT_SHA` is unavailable in the build shell, drop the
  prefix and rely on the git fallback, or add a small UI change to read
  `VERCEL_GIT_COMMIT_SHA` directly.

Server-side values for Option A:

```sh
TASKCORE_DEPLOYMENT_MODE=authenticated
TASKCORE_DEPLOYMENT_EXPOSURE=public
TASKCORE_PUBLIC_URL=https://app.example.com
TASKCORE_BIND=loopback
DATABASE_URL=postgres://...            # pooled
DATABASE_MIGRATION_URL=postgres://...  # direct, migrations only
BETTER_AUTH_SECRET=...
TASKCORE_SECRETS_MASTER_KEY=...        # 32-byte base64/hex/raw
TASKCORE_STORAGE_PROVIDER=vercel_blob  # or s3
BLOB_READ_WRITE_TOKEN=...              # only outside Vercel
```

The server should listen behind its own TLS reverse proxy; the Vercel rewrite
target must be HTTPS. Confirm that the server accepts the Vercel host/origin in
its allowed hostnames and trusted origins before enabling public mode.

For Option D, add a Vercel Function entry point and function settings, for
example:

```json
{
  "functions": {
    "api/index.ts": {
      "maxDuration": 300,
      "memory": 2048
    }
  },
  "crons": [
    {
      "path": "/api/internal/scheduler/tick",
      "schedule": "* * * * *"
    }
  ]
}
```

Only add Cron or a long `maxDuration` after the scheduler and run ownership are
actually redesigned. A cron route that calls the current in-process scheduler
without locking can double-run work.

## 7. Verification Checklist

Build and deploy:

- [ ] `pnpm --filter @taskcore/ui build` succeeds from a clean install.
- [ ] Vercel install uses the root lockfile and Node 24.
- [ ] Output directory resolves to `ui/dist`; no server/Rust build runs.
- [ ] Deep links (`/companies/...`, `/issues/...`) return the SPA shell.
- [ ] Hashed assets return immutable cache headers; `index.html` and `sw.js`
      return `no-cache`.
- [ ] No source maps or secrets are present in `ui/dist`.

Stores:

- [ ] `DATABASE_URL` connects from the runtime; `DATABASE_MIGRATION_URL`
      applies migrations from CI/deploy.
- [ ] Migration history matches the expected Drizzle state.
- [ ] Private Blob upload returns a durable pathname.
- [ ] Blob download, range read, missing-object, and delete behavior match the
      existing storage contract.
- [ ] Company-prefix checks reject cross-company object keys.
- [ ] `TASKCORE_SECRETS_MASTER_KEY` decrypts existing secrets after a restart
      or a new Function instance.
- [ ] If S3 is selected, the Marketplace credentials resolve at runtime.
- [ ] Redis/Global Config are either unused or covered by their own tests.

Runtime, Option A:

- [ ] `/api/health` returns a healthy response through the Vercel rewrite.
- [ ] Sign-in, sign-out, session refresh, and invite links work on the Vercel
      origin. Check `Set-Cookie` flags and that no cookie is scoped to the API
      host.
- [ ] Board mutations succeed (origin/Host checks).
- [ ] Live events connect or visibly fall back to polling; no duplicate
      toasts or stale task state.
- [ ] Run transcript and terminal surfaces are tested explicitly.
- [ ] Attachment upload and download work at the maximum supported size.
- [ ] Service worker updates after a redeploy.
- [ ] Agent and remote-runner callbacks still reach the server origin.

Runtime, Option B:

- [ ] Server serves the UI at `/` with `SERVE_UI=true`.
- [ ] `/api` and WebSocket upgrades work on one origin.
- [ ] Postgres, Blob/S3, and restart recovery survive a redeploy.

Runtime, Option D:

- [ ] A cold Function can serve `/api/health` without running unnecessary
      recovery work.
- [ ] Scheduler ticks are locked and idempotent under overlap.
- [ ] Remote-only agent execution starts, resumes, and recovers after a
      Function restart.
- [ ] Realtime reconnects after the Function maximum duration.
- [ ] Marketplace billing and egress are within budget.

## 8. Risks

| Risk                                          | Impact                                                     | Mitigation                                                                            |
| --------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Split origin breaks auth or cookies           | Login loops, failed mutations                              | Use host-scoped cookies and test all auth flows; prefer Option B if failures appear   |
| WebSocket rewrite unsupported or unstable     | Realtime falls back to polling; terminal/transcripts break | Verify each surface; use Option B for full fidelity                                   |
| Vercel proxy body limit                       | Attachments fail                                           | Test max upload; keep uploads on server origin or raise limits                        |
| Blob provider mismatch                        | Uploads or range reads fail                                | Implement the provider contract and tests before switching                            |
| Blob private auth outside Vercel              | 401s on the control plane                                  | Use `BLOB_READ_WRITE_TOKEN` in the server secret manager                              |
| S3 Marketplace OIDC not resolvable by AWS SDK | Storage startup failure                                    | Verify the credential shape; wire explicitly or use Blob                              |
| Neon pooled URL used for migrations           | Migration failures, advisory-lock issues                   | Use `DATABASE_URL_UNPOOLED` for migrations                                            |
| Marketplace service unavailable               | Uploads, DB, or cache outage                               | Prefer a multi-AZ provider; keep backups and a fallback storage path                  |
| Root build runs Rust/server                   | Build timeout or failure                                   | Always use the filtered UI build command                                              |
| Node version mismatch                         | Install/build failure                                      | Set `NODE_VERSION=24` and keep `engines` aligned                                      |
| Public server reachable without protection    | Security exposure                                          | Terminate TLS, require auth, restrict ingress, and keep secrets out of the UI project |
| Large entry chunk (about 6.8 MB minified)     | Slow first load on mobile                                  | Track bundle size; code splitting is a separate UI task                               |
| Vercel on critical path                       | Board outage when Vercel is degraded                       | Keep Option B available as the production fallback                                    |

## 9. Decisions Needed

1. Is Vercel required for the whole product, or only for the board UI / static
   previews?
2. Which persistent host will run the control plane (ECS/Fargate, Fly.io,
   Railway, Render, or a VM)?
3. Which store combination is approved:
   - Neon vs Supabase vs Aurora/Prisma for Postgres?
   - Vercel Blob vs AWS S3 for objects?
   - Upstash Redis only if realtime/scheduler work requires it?
4. Which hostname owns `/api`: a same-origin custom domain or a Vercel rewrite?
5. Is degraded realtime acceptable, or is single-origin WebSocket fidelity a
   hard requirement?
6. Is adding `vercel_blob` as a first-class storage provider in scope now?

If the answer to (1) is "the whole product", scope Option D as an architecture
project rather than a Vercel configuration change.
