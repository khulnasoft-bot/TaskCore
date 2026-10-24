import { createRoot, type Root } from "react-dom/client";

export interface TaskcoreReactRootHost {
  __taskcoreReactRoot?: Root;
}

type CreateRoot = (container: Parameters<typeof createRoot>[0]) => Root;

/**
 * Keep one React root per browser window even if Vite evaluates the entry
 * module more than once during a development reload.
 */
export function getOrCreateTaskcoreReactRoot(
  host: object,
  container: Parameters<typeof createRoot>[0],
  create: CreateRoot = createRoot,
): Root {
  const rootHost = host as TaskcoreReactRootHost;
  if (rootHost.__taskcoreReactRoot) return rootHost.__taskcoreReactRoot;

  const root = create(container);
  rootHost.__taskcoreReactRoot = root;
  return root;
}
