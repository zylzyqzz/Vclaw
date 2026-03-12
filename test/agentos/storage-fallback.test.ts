import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultOrchestratorConfig } from "../../src/agentos/config/loader.js";
import { createAgentOsStorage } from "../../src/agentos/storage/factory.js";

describe("AgentOS storage factory", () => {
  it("falls back to file storage when sqlite is explicitly disabled", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-fallback-"));
    try {
      process.env.VCLAW_AGENTOS_DISABLE_SQLITE = "1";
      const config = {
        ...defaultOrchestratorConfig(root),
        fallbackPath: join(root, "fallback.json"),
      };

      const storage = await createAgentOsStorage(config);
      await storage.upsertSession({
        sessionId: "s1",
        status: "idle",
        updatedAt: new Date().toISOString(),
        meta: {},
      });

      const raw = await readFile(config.fallbackPath, "utf8");
      expect(raw).toContain('"sessions"');
      await storage.close();
    } finally {
      delete process.env.VCLAW_AGENTOS_DISABLE_SQLITE;
      await rm(root, { recursive: true, force: true });
    }
  });
});
