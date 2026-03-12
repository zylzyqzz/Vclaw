import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PREFERRED_AGENTOS_DATA_DIR,
  defaultOrchestratorConfig,
  resolveDeerFlowBackendPath,
  resolveAgentOsDataDir,
} from "../../src/agentos/config/loader.js";
import {
  resolveCompatibleConfigPath,
  resolvePreferredConfigPath,
} from "../../src/agentos/config/store.js";

describe("AgentOS config loader branding compatibility", () => {
  it("uses .vclaw for fresh workspaces", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-config-fresh-"));
    try {
      expect(resolveAgentOsDataDir(root)).toBe(join(root, PREFERRED_AGENTOS_DATA_DIR));
      const config = defaultOrchestratorConfig(root);
      expect(config.storagePath).toBe(join(root, PREFERRED_AGENTOS_DATA_DIR, "agentos.db"));
      expect(config.projectName).toBe("Vclaw");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses .vclaw-agentos.json as the only compatibility config file", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-config-files-"));
    try {
      const preferred = resolvePreferredConfigPath(root);
      await writeFile(preferred, JSON.stringify({ defaultPreset: "preferred-demo" }), "utf8");
      expect(resolveCompatibleConfigPath(root)).toBe(preferred);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps DeerFlow disabled by default but resolves explicit backend paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-config-deerflow-"));
    const backend = join(root, "vendor", "deer-flow", "backend");
    try {
      await mkdir(join(backend, "src"), { recursive: true });
      await writeFile(join(backend, "src", "client.py"), "# test bridge", "utf8");
      expect(resolveDeerFlowBackendPath(root)).toBe(backend);

      const config = defaultOrchestratorConfig(root);
      expect(config.deerflow.enabled).toBe(false);
      expect(config.deerflow.embedded.backendPath).toBe(backend);
      expect(config.deerflow.route.taskTypes).toContain("research");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("auto-enables DeerFlow from persisted runtime metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-config-deerflow-runtime-"));
    const runtimeDir = join(root, ".vclaw", "deerflow");
    const backend = join(runtimeDir, "backend");
    const configPath = join(runtimeDir, "config.yaml");
    try {
      await mkdir(join(backend, "src"), { recursive: true });
      await writeFile(join(backend, "src", "client.py"), "# test bridge", "utf8");
      await writeFile(configPath, "models: []\nsandbox:\n  use: src.sandbox.local:LocalSandboxProvider\n", "utf8");
      await writeFile(
        join(runtimeDir, "runtime.json"),
        JSON.stringify(
          {
            enabled: true,
            backendPath: backend,
            configPath,
            pythonBin: "/tmp/python3.12",
            mode: "pro",
          },
          null,
          2,
        ),
        "utf8",
      );

      const config = defaultOrchestratorConfig(root);
      expect(config.deerflow.enabled).toBe(true);
      expect(config.deerflow.mode).toBe("pro");
      expect(config.deerflow.embedded.backendPath).toBe(backend);
      expect(config.deerflow.embedded.configPath).toBe(configPath);
      expect(config.deerflow.embedded.pythonBin).toBe("/tmp/python3.12");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
