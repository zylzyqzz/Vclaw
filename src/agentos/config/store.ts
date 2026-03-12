import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OrchestratorConfig, PresetDefinition } from "../types.js";

export const PREFERRED_CONFIG_FILE = ".vclaw-agentos.json";
export const LEGACY_CONFIG_FILE = ".weiclaw-agentos.json";
export const COMPAT_CONFIG_FILES = [PREFERRED_CONFIG_FILE, LEGACY_CONFIG_FILE] as const;

export function resolvePreferredConfigPath(cwd = process.cwd()): string {
  return path.join(cwd, PREFERRED_CONFIG_FILE);
}

export function resolveCompatibleConfigPath(cwd = process.cwd()): string | null {
  for (const file of COMPAT_CONFIG_FILES) {
    const candidate = path.join(cwd, file);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function compatibleConfigExists(cwd = process.cwd()): boolean {
  return resolveCompatibleConfigPath(cwd) !== null;
}

/**
 * @deprecated Legacy compatibility path only.
 * Runtime source-of-truth is AgentOsStorage (SQLite/file fallback).
 */
export function resolveLegacyConfigPath(cwd = process.cwd()): string {
  return path.join(cwd, LEGACY_CONFIG_FILE);
}

/**
 * @deprecated Legacy compatibility check only.
 * Kept for one-way migration from `.weiclaw-agentos.json`.
 */
export function legacyConfigExists(cwd = process.cwd()): boolean {
  return existsSync(resolveLegacyConfigPath(cwd));
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

/**
 * @deprecated Legacy compatibility read only.
 * Do not use as runtime source of truth.
 */
export async function readLegacyConfigFile(cwd = process.cwd()): Promise<Partial<OrchestratorConfig> | null> {
  const file = resolveLegacyConfigPath(cwd);
  if (!existsSync(file)) {return null;}
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as Partial<OrchestratorConfig>;
}

/**
 * @deprecated Legacy compatibility write only for controlled migration tooling.
 * Runtime writes must go through AgentOsRepository -> AgentOsStorage.
 */
export async function writeLegacyConfigFile(config: Partial<OrchestratorConfig>, cwd = process.cwd()): Promise<void> {
  const file = resolveLegacyConfigPath(cwd);
  await writeFile(file, JSON.stringify(config, null, 2), "utf8");
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
