import { describe, expect, it } from "vitest";
import { resolveVclawBin, runVclawTask } from "../../src/agentos/integration/vclaw-bridge.js";

describe("vclaw bridge", () => {
  it("prefers explicit binary path", () => {
    const resolved = resolveVclawBin("C:\\custom\\vclaw.exe");
    expect(resolved).toBe("C:\\custom\\vclaw.exe");
  });

  it("returns structured non-zero result when subprocess cannot start", () => {
    const result = runVclawTask({
      task: "hello",
      vclawBin: "__missing_vclaw_binary__",
      timeoutMs: 2000,
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.command[0]).toBe("__missing_vclaw_binary__");
    expect(typeof result.stderr).toBe("string");
    expect(result.stderr.length).toBeGreaterThan(0);
  });
});

