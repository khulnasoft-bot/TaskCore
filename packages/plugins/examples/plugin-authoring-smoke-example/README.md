# Plugin Authoring Smoke Example

A Taskcore plugin

## Development

```bash
pnpm install
pnpm dev            # watch builds
pnpm dev:ui         # local dev server with hot-reload events
pnpm test
```

## Install Into Taskcore

```bash
pnpm taskcore plugin install ./
```

## Build Options

- `pnpm build` uses esbuild presets from `@taskcore/plugin-sdk/bundlers`.
- `pnpm build:rollup` uses rollup presets from the same SDK.
