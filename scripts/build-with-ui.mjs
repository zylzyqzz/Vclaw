import { spawn } from "node:child_process";

const child = spawn("pnpm", ["build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    WEICLAW_BUILD_UI: "1",
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
