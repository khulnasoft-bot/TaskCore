---
title: Storage
summary: Local disk, S3-compatible, and Vercel Blob storage
---

Taskcore stores uploaded files (issue attachments, images) using a configurable storage provider.

## Local Disk (Default)

Files are stored at:

```
~/.taskcore/instances/default/data/storage
```

No configuration required. Suitable for local development and single-machine deployments.

## S3-Compatible Storage

For production or multi-node deployments, use S3-compatible object storage (AWS S3, MinIO, Cloudflare R2, etc.).

Configure via CLI:

```sh
pnpm taskcore configure --section storage
```

## Vercel Blob

For deployments whose backend runs on Vercel, connect a Blob store from the
Vercel Marketplace or project storage tab. Taskcore uses private blobs by
default so downloads continue to flow through its authenticated API.

Set one of:

- `BLOB_READ_WRITE_TOKEN` (local development and non-Vercel hosts), or
- `BLOB_STORE_ID` plus Vercel's injected `VERCEL_OIDC_TOKEN`.

Optional overrides:

| Variable                                | Default   | Purpose                          |
| --------------------------------------- | --------- | -------------------------------- |
| `TASKCORE_STORAGE_VERCEL_BLOB_ACCESS`   | `private` | `private` or `public` access     |
| `TASKCORE_STORAGE_VERCEL_BLOB_PREFIX`   | empty     | Pathname prefix inside the store |
| `TASKCORE_STORAGE_VERCEL_BLOB_TOKEN`    | unset     | Explicit token override          |
| `TASKCORE_STORAGE_VERCEL_BLOB_STORE_ID` | unset     | Explicit store id for OIDC       |

Set `TASKCORE_STORAGE_PROVIDER=vercel_blob` to select the provider.

## Configuration

| Provider      | Best For                                      |
| ------------- | --------------------------------------------- |
| `local_disk`  | Local development, single-machine deployments |
| `s3`          | Production, multi-node, cloud deployments     |
| `vercel_blob` | Backends hosted on Vercel                     |

Storage configuration is stored in the instance config file:

```
~/.taskcore/instances/default/config.json
```
