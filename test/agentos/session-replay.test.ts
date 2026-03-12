import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultOrchestratorConfig } from "../../src/agentos/config/loader.js";
import { MemoryManager } from "../../src/agentos/memory/memory-manager.js";
import { Orchestrator } from "../../src/agentos/orchestrator/orchestrator.js";
import { AgentRegistry } from "../../src/agentos/registry/agent-registry.js";
import { bootstrapRegistry } from "../../src/agentos/runtime/bootstrap.js";
import { SessionStore } from "../../src/agentos/session/session-store.js";
import { SqliteAgentOsStorage } from "../../src/agentos/storage/sqlite-storage.js";

describe("session replay and memory recall", () => {
  it("replays prior turns and recalls memory on subsequent runs", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-session-replay-"));
    const storage = new SqliteAgentOsStorage(join(root, "agentos.db"));
    await storage.init();

    try {
      const cfg = defaultOrchestratorConfig(root);
      const registry = new AgentRegistry(storage);
      await bootstrapRegistry(registry, cfg);
      const sessions = new SessionStore(storage);
      const orchestrator = new Orchestrator(
        cfg,
        registry,
        sessions,
        new MemoryManager(storage),
      );

      await orchestrator.run({
        sessionId: "repeat-session",
        goal: "plan release hardening for the local runtime",
      });

      const second = await orchestrator.run({
        sessionId: "repeat-session",
        goal: "continue release hardening and validate regressions",
      });

      expect(second.sessionReplay.turns.length).toBeGreaterThan(0);
      expect(second.memoryContext.hits.length).toBeGreaterThan(0);
      expect(second.selectionReasons.some((reason) => reason.startsWith("memory "))).toBe(true);

      const replay = await sessions.inspect("repeat-session", 5);
      expect(replay.turns.length).toBe(2);
      expect(replay.turns[1]?.goal).toContain("continue release hardening");
      expect(replay.turns[1]?.roleTrace.length).toBeGreaterThan(0);
    } finally {
      await storage.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
