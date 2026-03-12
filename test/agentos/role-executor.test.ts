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

describe("role executor runtime", () => {
  async function setup() {
    const root = await mkdtemp(join(tmpdir(), "agentos-role-executor-"));
    const storage = new SqliteAgentOsStorage(join(root, "agentos.db"));
    await storage.init();
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
    return { root, storage, sessions, orchestrator };
  }

  it("falls back to local execution when vclaw executor is requested but unavailable", async () => {
    const env = await setup();
    try {
      const result = await env.orchestrator.run({
        sessionId: "fallback-executor-session",
        goal: "stabilize release execution",
        preset: "default-demo",
        roleExecution: {
          mode: "vclaw",
          vclawBin: "definitely-missing-vclaw-bin",
          timeoutMs: 1000,
        },
      });

      expect(result.executionMode).toBe("hybrid-role-executor");
      expect(result.roleExecutions.some((entry) => entry.executor === "vclaw-fallback")).toBe(true);
      expect(
        result.risks.some((risk) => risk.includes("fell back to local execution")),
      ).toBe(true);
    } finally {
      await env.storage.close();
      await rm(env.root, { recursive: true, force: true });
    }
  });

  it("records session timeline metadata after completion", async () => {
    const env = await setup();
    try {
      const result = await env.orchestrator.run({
        sessionId: "timeline-session",
        goal: "prepare role execution trace",
      });

      const session = await env.storage.getSession("timeline-session");
      expect(session?.meta.lastTaskId).toBe(result.requestId);
      expect(session?.meta.lastExecutionMode).toBe(result.executionMode);
      expect(Array.isArray(session?.meta.timeline)).toBe(true);
      expect(Array.isArray(session?.meta.turns)).toBe(true);
      expect((session?.meta.timeline as Array<{ taskId: string }>)[0]?.taskId).toBe(result.requestId);
      expect((session?.meta.turns as Array<{ taskId: string }>)[0]?.taskId).toBe(result.requestId);
    } finally {
      await env.storage.close();
      await rm(env.root, { recursive: true, force: true });
    }
  });
});
