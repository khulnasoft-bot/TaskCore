import pc from "picocolors";

const TASKCORE_ART = [
  "  ████████╗ █████╗ ███████╗██╗  ██╗ ██████╗ ██████╗ ██████╗ ███████╗",
  "  ╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝██╔════╝██╔═══██╗██╔══██╗██╔════╝",
  "     ██║   ███████║███████╗█████╔╝ ██║     ██║   ██║██████╔╝█████╗  ",
  "     ██║   ██╔══██║╚════██║██╔═██╗ ██║     ██║   ██║██╔══██╗██╔══╝  ",
  "     ██║   ██║  ██║███████║██║  ██╗╚██████╗╚██████╔╝██║  ██║███████╗",
  "     ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝",
] as const;

const TAGLINE = "Open-source orchestration for zero-human companies";

export function printTaskcoreCliBanner(): void {
  const lines = [
    "",
    ...TASKCORE_ART.map((line) => pc.cyan(line)),
    pc.blue("  ───────────────────────────────────────────────────────"),
    pc.bold(pc.white(`  ${TAGLINE}`)),
    "",
  ];

  console.log(lines.join("\n"));
}
