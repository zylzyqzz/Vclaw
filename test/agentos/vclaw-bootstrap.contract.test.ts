import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Vclaw bootstrap contract", () => {
  it("defines the Windows one-command bootstrap path and target layout", async () => {
    const scriptPath = path.resolve("scripts/vclaw-bootstrap.ps1");
    const raw = await readFile(scriptPath, "utf8");

    expect(raw).toContain('https://github.com/zylzyqzz/Vclaw.git');
    expect(raw).toContain('E:\\Vclaw');
    expect(raw).toContain('E:\\Vclaw(Go语言未完成）');
    expect(raw).toContain('[string]$PnpmVersion = "10.23.0"');
    expect(raw).toContain('vclaw.cmd');
    expect(raw).toContain('agentos.cmd');
    expect(raw).toContain('pnpm install');
    expect(raw).toContain('pnpm vclaw -- help');
    expect(raw).toContain('pnpm vclaw:agentos -- demo --json');
  });
});
