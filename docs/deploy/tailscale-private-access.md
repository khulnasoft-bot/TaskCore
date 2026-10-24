---
title: Tailscale Private Access
summary: Run Taskcore with Tailscale-friendly bind presets and connect from other devices
---

Use this when you want to access Taskcore over Tailscale (or a private LAN/VPN) instead of only `localhost`.

## 1. Start Taskcore in private authenticated mode

```sh
pnpm dev --bind tailnet
```

Recommended behavior:

- `TASKCORE_DEPLOYMENT_MODE=authenticated`
- `TASKCORE_DEPLOYMENT_EXPOSURE=private`
- `TASKCORE_BIND=tailnet`

If you want the old broad private-network behavior instead, use:

```sh
pnpm dev --bind lan
```

Legacy aliases still map to `authenticated/private + bind=lan`:

pnpm dev --authenticated-private
pnpm dev --tailscale-auth

````

## 2. Find your reachable Tailscale address

From the machine running Taskcore:

```sh
tailscale ip -4
````

You can also use your Tailscale MagicDNS hostname (for example `my-macbook.tailnet.ts.net`).

## 3. Open Taskcore from another device

Use the Tailscale IP or MagicDNS host with the Taskcore port:

```txt
http://<tailscale-host-or-ip>:3100
```

Example:

```txt
http://my-macbook.tailnet.ts.net:3100
```

## 4. Allow custom private hostnames when needed

If you access Taskcore with a custom private hostname, add it to the allowlist:

```sh
npx taskcore allowed-hostname my-macbook.tailnet.ts.net
```

## 5. Verify the server is reachable

From a remote Tailscale-connected device:

```sh
curl http://<tailscale-host-or-ip>:3100/api/health
```

Expected result:

```json
{ "status": "ok" }
```

## Troubleshooting

- Login or redirect errors on a private hostname: add it with `taskcore allowed-hostname`.
- App only works on `localhost`: make sure you started with `--bind lan` or `--bind tailnet` instead of plain `pnpm dev`.
- Can connect locally but not remotely: verify both devices are on the same Tailscale network and port `3100` is reachable.
