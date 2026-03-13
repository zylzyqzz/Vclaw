import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyWorkspaceBrainPack,
  readWorkspaceBrainManifest,
  resolveWorkspaceBrainManifestPath,
  resolveWorkspaceBrainMemoryConfig,
  resolveWorkspaceBrainMemorySearchConfig,
  writeWorkspaceBrainManifest,
} from "./workspace-brain.js";

const tmpDirs: string[] = [];

async function createWorkspaceDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vclaw-brain-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("workspace brain manifest", () => {
  it("sanitizes secrets and normalizes skill names when packing", () => {
    const manifest = applyWorkspaceBrainPack({
      agentId: "main",
      memoryConfig: {
        backend: "qmd",
        qmd: {
          searchMode: "vsearch",
        },
      },
      memorySearch: {
        provider: "openai",
        model: "text-embedding-3-small",
        remote: {
          baseUrl: "https://api.example/v1",
          apiKey: "secret-key",
          headers: { Authorization: "Bearer secret" },
        },
      },
      skillNames: ["beta", "alpha", "beta"],
      generatedAt: "2026-03-13T10:00:00.000Z",
    });

    expect(manifest.memory?.config?.backend).toBe("qmd");
    expect(manifest.agents?.main?.memory?.search?.remote).toEqual({
      baseUrl: "https://api.example/v1",
    });
    expect(manifest.skills).toEqual({
      mode: "workspace",
      count: 2,
      names: ["alpha", "beta"],
      syncedAt: "2026-03-13T10:00:00.000Z",
    });
  });

  it("writes and reads portable workspace manifest data", async () => {
    const workspaceDir = await createWorkspaceDir();
    const manifest = applyWorkspaceBrainPack({
      agentId: "main",
      memoryConfig: {
        backend: "qmd",
        citations: "on",
      },
      memorySearch: {
        provider: "gemini",
        model: "gemini-embedding-001",
        extraPaths: ["docs"],
      },
      skillNames: ["planner", "reviewer"],
      generatedAt: "2026-03-13T11:00:00.000Z",
    });

    const manifestPath = await writeWorkspaceBrainManifest({ workspaceDir, manifest });
    expect(manifestPath).toBe(resolveWorkspaceBrainManifestPath(workspaceDir));

    const loaded = await readWorkspaceBrainManifest(workspaceDir);
    expect(loaded?.generatedAt).toBe("2026-03-13T11:00:00.000Z");
    expect(resolveWorkspaceBrainMemoryConfig(workspaceDir)).toEqual({
      backend: "qmd",
      citations: "on",
    });
    expect(resolveWorkspaceBrainMemorySearchConfig(workspaceDir, "main")).toEqual({
      provider: "gemini",
      model: "gemini-embedding-001",
      extraPaths: ["docs"],
    });
    expect(loaded?.skills?.names).toEqual(["planner", "reviewer"]);
  });
});
