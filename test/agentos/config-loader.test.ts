import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEGACY_AGENTOS_DATA_DIR,
  PREFERRED_AGENTOS_DATA_DIR,
  defaultOrchestratorConfig,
  resolveAgentOsDataDir,
} from "../../src/agentos/config/loader.js";
import {
  resolveCompatibleConfigPath,
  resolveLegacyConfigPath,
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

  it("reuses .weiclaw-agentos when a legacy workspace already exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-config-legacy-dir-"));
    try {
      await mkdir(join(root, LEGACY_AGENTOS_DATA_DIR), { recursive: true });
      expect(resolveAgentOsDataDir(root)).toBe(join(root, LEGACY_AGENTOS_DATA_DIR));
      const config = defaultOrchestratorConfig(root);
      expect(config.storagePath).toBe(join(root, LEGACY_AGENTOS_DATA_DIR, "agentos.db"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prefers .vclaw-agentos.json but still finds the legacy config file", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-config-files-"));
    try {
      const preferred = resolvePreferredConfigPath(root);
      const legacy = resolveLegacyConfigPath(root);

      await writeFile(legacy, JSON.stringify({ defaultPreset: "legacy-demo" }), "utf8");
      expect(resolveCompatibleConfigPath(root)).toBe(legacy);

      await writeFile(preferred, JSON.stringify({ defaultPreset: "preferred-demo" }), "utf8");
      expect(resolveCompatibleConfigPath(root)).toBe(preferred);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
