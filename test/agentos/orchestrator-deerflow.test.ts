import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultOrchestratorConfig } from "../../src/agentos/config/loader.js";
import type { DeerFlowBridgeRunner } from "../../src/agentos/integration/deerflow-bridge.js";
import type { DeerFlowBridgeResponse } from "../../src/agentos/types.js";
import { MemoryManager } from "../../src/agentos/memory/memory-manager.js";
import { Orchestrator } from "../../src/agentos/orchestrator/orchestrator.js";
import { AgentRegistry } from "../../src/agentos/registry/agent-registry.js";
import { bootstrapRegistry } from "../../src/agentos/runtime/bootstrap.js";
import { SessionStore } from "../../src/agentos/session/session-store.js";
import { SqliteAgentOsStorage } from "../../src/agentos/storage/sqlite-storage.js";

function successResponse(mode = "ultra"): DeerFlowBridgeResponse {
  return {
    ok: true,
    status: "completed",
    transport: "embedded-python",
    mode,
    threadId: "vclaw-session-task",
    summary: "DeerFlow produced a deep research synthesis.",
    conclusion: "DeerFlow produced a deep research synthesis.",
    plan: ["collect evidence", "compare sources", "deliver synthesis"],
    risks: ["source freshness"],
    acceptance: ["includes research synthesis"],
    sources: ["https://example.com/source"],
    artifacts: ["/tmp/report.md"],
    rawText: "Conclusion\nDeerFlow produced a deep research synthesis.",
    durationMs: 42,
  };
}

describe("orchestrator DeerFlow integration", () => {
  async function setup(bridge?: DeerFlowBridgeRunner) {
    const root = await mkdtemp(join(tmpdir(), "agentos-deerflow-"));
    const storage = new SqliteAgentOsStorage(join(root, "agentos.db"));
    await storage.init();
    const cfg = defaultOrchestratorConfig(root);
    const registry = new AgentRegistry(storage);
    await bootstrapRegistry(registry, cfg);
    const memory = new MemoryManager(storage);
    const orchestrator = new Orchestrator(
      cfg,
      registry,
      new SessionStore(storage),
      memory,
      bridge,
    );
    return { root, storage, cfg, memory, orchestrator };
  }

  it("augments research tasks with DeerFlow results and memory capture", async () => {
    const env = await setup({
      run: async () => successResponse(),
    });

    try {
      env.cfg.deerflow.enabled = true;
      const result = await env.orchestrator.run({
        sessionId: "research-session",
        goal: "research the competitive landscape",
        taskType: "research",
        preset: "",
      });

      expect(result.routeSummary).toContain("deerflow");
      expect(result.selectedRoles).toContain("deerflow-research");
      expect(result.deerflow?.status).toBe("completed");
      expect(result.plan).toContain("collect evidence");
      expect(result.acceptance).toContain(
        "DeerFlow ultra response normalized into Vclaw task contract",
      );

      const records = await env.memory.inspect("research-session", 10);
      expect(records.some((record) => record.scope === "long-term:deerflow")).toBe(true);
      expect(records.some((record) => record.scope === "entity:research")).toBe(true);
    } finally {
      await env.storage.close();
      await rm(env.root, { recursive: true, force: true });
    }
  });

  it("can complete with DeerFlow alone when local role routing has no coverage", async () => {
    const env = await setup({
      run: async () => successResponse("pro"),
    });

    try {
      const result = await env.orchestrator.run({
        sessionId: "rescue-session",
        goal: "research a niche market and produce findings",
        preset: "",
        requiredCapabilities: ["finance"],
        deerflow: {
          force: true,
          mode: "pro",
        },
      });

      expect(result.selectedRoles).toEqual(["deerflow-research"]);
      expect(result.deerflow?.mode).toBe("pro");
      expect(result.conclusion).toContain("deep research synthesis");
    } finally {
      await env.storage.close();
      await rm(env.root, { recursive: true, force: true });
    }
  });

  it("falls back to the normal route when DeerFlow is unavailable", async () => {
    const env = await setup({
      run: async () => ({
        ...successResponse(),
        ok: false,
        status: "unavailable",
        summary: "DeerFlow bridge unavailable.",
        conclusion: "DeerFlow bridge unavailable.",
        error: "backend missing",
      }),
    });

    try {
      env.cfg.deerflow.enabled = true;
      const result = await env.orchestrator.run({
        sessionId: "fallback-session",
        goal: "research deployment options",
        taskType: "research",
        preset: "",
      });

      expect(result.selectedRoles).toContain("planner");
      expect(result.selectedRoles).not.toContain("deerflow-research");
      expect(result.risks.some((risk) => risk.includes("DeerFlow unavailable"))).toBe(true);
    } finally {
      await env.storage.close();
      await rm(env.root, { recursive: true, force: true });
    }
  });
});
