# Hermes Gateway Adapter Compatibility Shim

`@taskcore/adapter-hermes-gateway` is a deprecated compatibility shim.

Use `@taskcore/hermes-taskcore-adapter` for new installs and import gateway
entrypoints from `@taskcore/hermes-taskcore-adapter/gateway`. The adapter
type remains `hermes_gateway`; only package ownership changed.

`hermes_gateway` is for an already-running Hermes API server. It does not start
the local Hermes CLI. If Taskcore should launch local `hermes chat` as a child
process, use `hermes_local` from `@taskcore/hermes-taskcore-adapter`
instead.

The shim preserves the legacy exports for one release:

- `.`
- `./server`
- `./ui`
- `./cli`
- `./ui-parser`

These exports forward to the unified Hermes package. Existing
`@taskcore/adapter-hermes-gateway` plugin installs should continue to load
during the compatibility window, but should migrate to
`@taskcore/hermes-taskcore-adapter` before the shim is removed.
