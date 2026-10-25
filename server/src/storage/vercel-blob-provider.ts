import { BlobNotFoundError, del, get, head, put } from "@vercel/blob";
import { addAbortSignal, Readable } from "node:stream";
import type { StorageVercelBlobAccess } from "@taskcore/shared";
import type {
  StorageProvider,
  GetObjectResult,
  HeadObjectResult,
} from "./types.js";
import { notFound, unprocessable } from "../errors.js";

export interface VercelBlobProviderConfig {
  access: StorageVercelBlobAccess;
  prefix?: string;
  token?: string;
  storeId?: string;
}

const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024;

type BlobCommandOptions = NonNullable<Parameters<typeof head>[1]>;

function normalizePrefix(prefix: string | undefined): string {
  if (!prefix) return "";
  return prefix.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

function buildKey(prefix: string, objectKey: string): string {
  if (!prefix) return objectKey;
  return `${prefix}/${objectKey}`;
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof BlobNotFoundError ||
    (error as { name?: string } | null)?.name === "BlobNotFoundError"
  );
}

function toReadableStream(stream: ReadableStream<Uint8Array>): Readable {
  return Readable.fromWeb(
    stream as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
  );
}

export function createVercelBlobStorageProvider(
  config: VercelBlobProviderConfig,
): StorageProvider {
  const token = config.token?.trim() || undefined;
  const storeId = config.storeId?.trim() || undefined;
  const prefix = normalizePrefix(config.prefix);
  const access = config.access;

  if (!token && !(storeId && process.env.VERCEL_OIDC_TOKEN)) {
    throw unprocessable(
      "Vercel Blob storage requires BLOB_READ_WRITE_TOKEN or a store id with VERCEL_OIDC_TOKEN",
    );
  }

  const commandOptions: BlobCommandOptions = {
    ...(token ? { token } : {}),
    ...(storeId ? { storeId } : {}),
    ...(storeId && !token ? { oidcToken: process.env.VERCEL_OIDC_TOKEN } : {}),
  };

  return {
    id: "vercel_blob",

    async putObject(input) {
      await put(buildKey(prefix, input.objectKey), input.body, {
        ...commandOptions,
        access,
        contentType: input.contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
        multipart: input.contentLength > MULTIPART_THRESHOLD_BYTES,
      });
    },

    async getObject(input): Promise<GetObjectResult> {
      const result = await get(buildKey(prefix, input.objectKey), {
        ...commandOptions,
        access,
        abortSignal: input.signal,
        headers: input.range
          ? { Range: `bytes=${input.range.start}-${input.range.end}` }
          : undefined,
      });
      if (!result || result.statusCode !== 200)
        throw notFound("Object not found");

      const stream = toReadableStream(result.stream);
      if (input.signal) addAbortSignal(input.signal, stream);
      return {
        stream,
        contentType: result.blob.contentType ?? undefined,
        contentLength: result.blob.size,
        etag: result.blob.etag,
        lastModified: result.blob.uploadedAt,
      };
    },

    async headObject(input): Promise<HeadObjectResult> {
      try {
        const result = await head(buildKey(prefix, input.objectKey), {
          ...commandOptions,
          abortSignal: input.signal,
        });
        return {
          exists: true,
          contentType: result.contentType,
          contentLength: result.size,
          etag: result.etag,
          lastModified: result.uploadedAt,
        };
      } catch (error) {
        if (isNotFoundError(error)) return { exists: false };
        throw error;
      }
    },

    async deleteObject(input): Promise<void> {
      try {
        await del(buildKey(prefix, input.objectKey), commandOptions);
      } catch (error) {
        if (!isNotFoundError(error)) throw error;
      }
    },
  };
}
