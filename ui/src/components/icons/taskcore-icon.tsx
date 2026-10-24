import { createLucideIcon } from "lucide-react";

/**
 * The Taskcore mark, as a `lucide-react` icon.
 *
 * The UI historically imported a `Taskcore` icon from `lucide-react`, but no
 * such export exists in any released version. This component renders the
 * canonical Taskcore mark with `createLucideIcon`, so it stays a drop-in
 * replacement: same props, same `LucideIcon` type, same rendered output as
 * the icon this file replaces.
 */
export const TaskcoreIcon = createLucideIcon("taskcore", [
  [
    "path",
    {
      d: "M16 6 l-8.414 8.586 a2.000 2.000 0 0 0 2.828 2.828 l8.414 -8.586 a4.000 4.000 0 1 0 -5.657 -5.657 l-8.379 8.551 a6.000 6.000 0 1 0 8.485 8.485 l8.379 -8.551",
      key: "taskcore-mark",
    },
  ],
]);
