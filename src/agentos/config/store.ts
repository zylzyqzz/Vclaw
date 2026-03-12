import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OrchestratorConfig, PresetDefinition } from "../types.js";

export const PREFERRED_CONFIG_FILE = ".vclaw-agentos.json";

export function resolvePreferredConfigPath(cwd = process.cwd()): string {
  return path.join(cwd, PREFERRED_CONFIG_FILE);
}

export function resolveCompatibleConfigPath(cwd = process.cwd()): string | null {
  const candidate = resolvePreferredConfigPath(cwd);
  return existsSync(candidate) ? candidate : null;
}

export function compatibleConfigExists(cwd = process.cwd()): boolean {
  return resolveCompatibleConfigPath(cwd) !== null;
}

export async function readCompatibleConfigFile(
  cwd = process.cwd(),
): Promise<Partial<OrchestratorConfig> | null> {
  const file = resolveCompatibleConfigPath(cwd);
  if (!file) {
    return null;
  }
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as Partial<OrchestratorConfig>;
}

export async function writePreferredConfigFile(
  config: Partial<OrchestratorConfig>,
  cwd = process.cwd(),
): Promise<void> {
  const file = resolvePreferredConfigPath(cwd);
  await writeFile(file, JSON.stringify(config, null, 2), "utf8");
}

export async function readPresetBundleFile(filePath: string): Promise<PresetDefinition> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as PresetDefinition;
}

export async function writePresetBundleFile(filePath: string, preset: PresetDefinition): Promise<void> {
  await writeFile(filePath, JSON.stringify(preset, null, 2), "utf8");
}
