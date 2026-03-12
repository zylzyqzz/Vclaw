import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Vclaw Unix bootstrap contract", () => {
  it("defines the macOS/Linux one-command bootstrap path and DeerFlow sidecar setup", async () => {
    const scriptPath = path.resolve("scripts/vclaw-bootstrap.sh");
    const raw = await readFile(scriptPath, "utf8");

    expect(raw).toContain('https://github.com/zylzyqzz/Vclaw.git');
    expect(raw).toContain('https://github.com/bytedance/deer-flow.git');
    expect(raw).toContain('${HOME}/Vclaw');
    expect(raw).toContain('${HOME}/Vclaw-go-unfinished');
    expect(raw).toContain('DEFAULT_PNPM_VERSION="10.23.0"');
    expect(raw).toContain('uv python install 3.12');
    expect(raw).toContain('configure-deerflow.mjs');
    expect(raw).toContain('runtime.json');
    expect(raw).toContain('${WRAPPER_DIR}/vclaw');
    expect(raw).toContain('${WRAPPER_DIR}/agentos');
    expect(raw).toContain('pnpm install');
    expect(raw).toContain('pnpm vclaw -- help');
    expect(raw).toContain('pnpm vclaw:agentos -- demo --json');
  });
});
