import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Vclaw bootstrap contract", () => {
  it("defines the Windows one-command bootstrap path and DeerFlow sidecar setup", async () => {
    const scriptPath = path.resolve("scripts/vclaw-bootstrap.ps1");
    const raw = await readFile(scriptPath, "utf8");

    expect(raw).toContain('https://github.com/zylzyqzz/Vclaw.git');
    expect(raw).toContain('https://github.com/bytedance/deer-flow.git');
    expect(raw).toContain('E:\\Vclaw');
    expect(raw).toContain('E:\\Vclaw-Go-unfinished');
    expect(raw).toContain('[string]$PnpmVersion = "10.23.0"');
    expect(raw).toContain('uv python install 3.12');
    expect(raw).toContain('configure-deerflow.mjs');
    expect(raw).toContain('runtime.json');
    expect(raw).toContain('vclaw.cmd');
    expect(raw).toContain('openclaw.cmd');
    expect(raw).toContain('agentos.cmd');
    expect(raw).toContain('pnpm install');
    expect(raw).toContain('pnpm vclaw -- help');
    expect(raw).toContain('pnpm vclaw:agentos -- demo --json');
  });
});
