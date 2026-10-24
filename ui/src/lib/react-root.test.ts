import { describe, expect, it, vi } from "vitest";
import type { Root } from "react-dom/client";
import {
  getOrCreateTaskcoreReactRoot,
  type TaskcoreReactRootHost,
} from "./react-root";

describe("getOrCreateTaskcoreReactRoot", () => {
  it("reuses the existing root when the entry module runs again", () => {
    const host: TaskcoreReactRootHost = {};
    const container = {} as Parameters<typeof getOrCreateTaskcoreReactRoot>[1];
    const root = { render: vi.fn(), unmount: vi.fn() } as unknown as Root;
    const createRoot = vi.fn(() => root);

    expect(getOrCreateTaskcoreReactRoot(host, container, createRoot)).toBe(root);
    expect(getOrCreateTaskcoreReactRoot(host, container, createRoot)).toBe(root);
    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(createRoot).toHaveBeenCalledWith(container);
  });
});
