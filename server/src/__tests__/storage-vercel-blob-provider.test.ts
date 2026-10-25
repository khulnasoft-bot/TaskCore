import { afterEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";

const blobMock = vi.hoisted(() => {
  class BlobNotFoundError extends Error {
    constructor() {
      super("Blob not found");
      this.name = "BlobNotFoundError";
    }
  }

  return {
    BlobNotFoundError,
    put: vi.fn(),
    get: vi.fn(),
    head: vi.fn(),
    del: vi.fn(),
  };
});

vi.mock("@vercel/blob", () => blobMock);

import { createVercelBlobStorageProvider } from "../storage/vercel-blob-provider.js";

async function readStreamToBuffer(
  stream: NodeJS.ReadableStream,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function blobResult(contentType = "text/plain", content = "hello", size = Buffer.byteLength(content)) {
  return {
    statusCode: 200 as const,
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Buffer.from(content));
        controller.close();
      },
    }),
    headers: new Headers(),
    blob: {
      url: "https://blob.example/company-1/file.txt",
      downloadUrl: "https://blob.example/company-1/file.txt?download=1",
      pathname: "company-1/file.txt",
      contentDisposition: "inline",
      cacheControl: "public, max-age=60",
      uploadedAt: new Date("2026-10-25T00:00:00.000Z"),
      etag: "etag-1",
      contentType,
      size,
    },
  };
}

describe("Vercel Blob storage provider", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requires a token or OIDC store credentials", () => {
    expect(() =>
      createVercelBlobStorageProvider({ access: "private" }),
    ).toThrow("BLOB_READ_WRITE_TOKEN");
  });

  it("uploads private blobs under the configured prefix", async () => {
    const provider = createVercelBlobStorageProvider({
      access: "private",
      prefix: "/taskcore/",
      token: "blob-token",
    });

    await provider.putObject({
      objectKey: "company-1/file.txt",
      body: Buffer.from("hello"),
      contentType: "text/plain",
      contentLength: 5,
    });

    expect(blobMock.put).toHaveBeenCalledWith(
      "taskcore/company-1/file.txt",
      expect.any(Buffer),
      expect.objectContaining({
        access: "private",
        token: "blob-token",
        contentType: "text/plain",
        addRandomSuffix: false,
        allowOverwrite: true,
        multipart: false,
      }),
    );
  });

  it("streams downloads and reports the range response length", async () => {
    blobMock.get.mockResolvedValue(blobResult("text/plain", "ell", 3));
    const provider = createVercelBlobStorageProvider({
      access: "private",
      token: "blob-token",
    });

    const result = await provider.getObject({
      objectKey: "company-1/file.txt",
      range: { start: 1, end: 3 },
    });

    expect(await readStreamToBuffer(result.stream)).toEqual(Buffer.from("ell"));
    expect(result.contentLength).toBe(3);
    expect(result.contentType).toBe("text/plain");
    expect(blobMock.get).toHaveBeenCalledWith(
      "company-1/file.txt",
      expect.objectContaining({
        access: "private",
        headers: { Range: "bytes=1-3" },
      }),
    );
  });

  it("returns not found when the blob is missing", async () => {
    blobMock.get.mockResolvedValue(null);
    const provider = createVercelBlobStorageProvider({
      access: "private",
      token: "blob-token",
    });

    await expect(
      provider.getObject({ objectKey: "company-1/missing.txt" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("returns exists false when head reports a missing blob", async () => {
    blobMock.head.mockRejectedValue(new blobMock.BlobNotFoundError());
    const provider = createVercelBlobStorageProvider({
      access: "private",
      token: "blob-token",
    });

    await expect(
      provider.headObject({ objectKey: "company-1/missing.txt" }),
    ).resolves.toEqual({ exists: false });
  });

  it("is idempotent when deleting a missing blob", async () => {
    blobMock.del.mockRejectedValue(new blobMock.BlobNotFoundError());
    const provider = createVercelBlobStorageProvider({
      access: "private",
      token: "blob-token",
    });

    await expect(
      provider.deleteObject({ objectKey: "company-1/missing.txt" }),
    ).resolves.toBeUndefined();
  });
});
