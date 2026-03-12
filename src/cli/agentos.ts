#!/usr/bin/env node
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { ensureAgentWorkspace } from "../agents/workspace.js";
import { resolveAgentOsDataDir } from "../agentos/config/loader.js";
import { readPresetBundleFile, writePresetBundleFile } from "../agentos/config/store.js";
import { inspectPreset, listPresets } from "../agentos/registry/preset-utils.js";
import { readRoleBundleJson, writeRoleBundleJson } from "../agentos/registry/role-io.js";
import { validatePreset, validateRoleBundle } from "../agentos/registry/role-validation.js";
import { createAgentOsRuntime } from "../agentos/runtime/create-runtime.js";
import { runVclawTask } from "../agentos/integration/vclaw-bridge.js";
import { VCLAW_DATE_VERSION } from "../agentos/version.js";
import type {
  AgentCapability,
  AgentMemoryScope,
  AgentPolicy,
  CliEnvelope,
  DeerFlowRequestOptions,
  LintResult,
  PresetDefinition,
  RoleExecutionOptions,
  RoleBundle,
  RoleTemplate,
  RuntimeAgent,
  SessionReplay,
} from "../agentos/types.js";

const rawArgv = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === "--"));
const jsonMode = rawArgv.includes("--json");
const argv = rawArgv.filter((arg) => arg !== "--json");
const AGENTOS_CLI_VERSION = VCLAW_DATE_VERSION;

const nativeEmitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: unknown, ...rest: unknown[]) => {
  const message =
    warning instanceof Error
      ? warning.message
      : typeof warning === "string"
        ? warning
        : String(warning);
  if (message.includes("SQLite is an experimental feature")) {
    return undefined as void;
  }
  return nativeEmitWarning(warning as string, ...(rest as []));
}) as typeof process.emitWarning;

class CliError extends Error {
  constructor(
    public readonly code: string,
    public readonly exitCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

function normalizeError(err: unknown): CliError {
  if (err instanceof CliError) {
    return err;
  }
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes("not found")) {
    return new CliError("NOT_FOUND", 3, message);
  }
  if (
    lower.includes("already exists") ||
    lower.includes("conflict") ||
    lower.includes("referenced by")
  ) {
    return new CliError("CONFLICT", 3, message);
  }
  if (lower.includes("validation failed") || lower.includes("invalid preset")) {
    return new CliError("VALIDATION_FAILED", 2, message);
  }
  return new CliError("UNEXPECTED_ERROR", 1, message);
}

interface EnvelopeInput<T> {
  command: string;
  result?: T;
  routeSummary?: string;
  selectedRoles?: string[];
  selectionReasons?: string[];
  lintFindings?: LintResult["findings"];
  metadata?: Record<string, unknown>;
}

interface MemorySummary {
  total: number;
  byLayer: Record<string, number>;
  latestAt?: string;
}

interface WorkspaceGuideRow {
  file: string;
  purpose: string;
}

function getArg(name: string): string | undefined {
  const index = argv.findIndex((arg) => arg === `--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

function getCsv(name: string): string[] {
  const raw = getArg(name);
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseBool(name: string, fallback: boolean): boolean {
  const raw = getArg(name);
  if (!raw) {
    return fallback;
  }
  return raw === "true";
}

function parseIntSafe(name: string, fallback: number): number {
  const n = Number(getArg(name) ?? String(fallback));
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function buildMemorySummary(rows: Array<{ layer: string; createdAt: string }>): MemorySummary {
  const byLayer: Record<string, number> = {};
  for (const row of rows) {
    byLayer[row.layer] = (byLayer[row.layer] ?? 0) + 1;
  }
  return {
    total: rows.length,
    byLayer,
    latestAt: rows[0]?.createdAt,
  };
}

function defaultWorkspaceDir(cwd = process.cwd()): string {
  return path.join(resolveAgentOsDataDir(cwd), "workspace");
}

function buildWorkspaceGuide(workspaceDir: string): WorkspaceGuideRow[] {
  return [
    {
      file: path.join(workspaceDir, "AGENTS.md"),
      purpose: "Global operating rules, task boundaries, and non-negotiable constraints.",
    },
    {
      file: path.join(workspaceDir, "SOUL.md"),
      purpose: "Persona, tone, and collaboration style shared across the agent surface.",
    },
    {
      file: path.join(workspaceDir, "IDENTITY.md"),
      purpose: "Public-facing agent name, style, and presentation details.",
    },
    {
      file: path.join(workspaceDir, "USER.md"),
      purpose: "Operator preferences, default assumptions, and user-specific context.",
    },
    {
      file: path.join(workspaceDir, "TOOLS.md"),
      purpose: "Local tool notes, machine facts, and environment-specific guidance.",
    },
    {
      file: path.join(workspaceDir, "BOOTSTRAP.md"),
      purpose: "First-run ritual for a brand-new workspace; removed after onboarding completes.",
    },
  ];
}

function sessionReplaySummary(replay: SessionReplay): string[] {
  const lines = [
    `session: ${replay.sessionId}`,
    `status: ${replay.status}`,
    `updatedAt: ${replay.updatedAt}`,
    `turns: ${replay.turns.length}`,
    `lastConclusion: ${replay.lastConclusion ?? "n/a"}`,
  ];
  if (replay.lastSelectedRoles.length > 0) {
    lines.push(`lastSelectedRoles: ${replay.lastSelectedRoles.join(", ")}`);
  }
  return lines;
}

function emitSuccess<T>(payload: EnvelopeInput<T>, human?: () => void): void {
  if (jsonMode) {
    const body: CliEnvelope<T> & {
      routeSummary?: string;
      selectedRoles?: string[];
      selectionReasons?: string[];
    } = {
      ok: true,
      command: payload.command,
      version: AGENTOS_CLI_VERSION,
      routeSummary: payload.routeSummary,
      selectedRoles: payload.selectedRoles,
      selectionReasons: payload.selectionReasons,
      result: payload.result,
      lintFindings: payload.lintFindings,
      metadata: {
        generatedAt: nowIso(),
        ...payload.metadata,
      },
    };
    console.log(JSON.stringify(body, null, 2));
    return;
  }
  if (human) {
    human();
  } else if (typeof payload.result === "string") {
    console.log(payload.result);
  } else {
    console.log(JSON.stringify(payload.result, null, 2));
  }
}

function roleContextsFromRuntime(runtime: Awaited<ReturnType<typeof createAgentOsRuntime>>) {
  return runtime.registry.listRuntimeAgents().then(async (agents) => {
    const out: Array<{
      id: string;
      enabled: boolean;
      capabilities: string[];
      outputContract: string;
      policy: AgentPolicy;
    }> = [];
    for (const agent of agents) {
      const inspected = await runtime.registry.inspectRuntimeAgent(agent.id);
      if (!inspected) {
        continue;
      }
      out.push({
        id: inspected.runtime.id,
        enabled: inspected.runtime.enabled && inspected.template.enabled,
        capabilities: inspected.effectiveCapabilities,
        outputContract: inspected.template.outputContract,
        policy: inspected.effectivePolicy,
      });
    }
    return out;
  });
}

function parseLintOrThrow(result: LintResult, context: string): void {
  if (!result.valid) {
    throw new CliError("VALIDATION_FAILED", 2, `${context} validation failed`, {
      findings: result.findings,
    });
  }
}

function buildPolicy(defaultEnabled = true): AgentPolicy {
  return {
    enabled: parseBool("policy-enabled", defaultEnabled),
    maxTurns: parseIntSafe("max-turns", 6),
    allowedTools: getCsv("allowed-tools"),
    deniedTools: getCsv("denied-tools"),
    constraints: getCsv("constraints"),
  };
}

function buildMemoryScope(): AgentMemoryScope {
  const layers = getCsv("memory-layers") as Array<"short-term" | "long-term" | "project-entity">;
  return {
    layers: layers.length > 0 ? layers : ["short-term", "long-term", "project-entity"],
    scopes:
      getCsv("memory-scopes").length > 0 ? getCsv("memory-scopes") : ["session:*", "entity:*"],
    crossSessionRead: parseBool("cross-session-read", false),
  };
}

function buildDeerFlowOptionsFromArgs(): DeerFlowRequestOptions | undefined {
  const explicitEnabled = getArg("deerflow");
  const mode = getArg("deerflow-mode") as DeerFlowRequestOptions["mode"] | undefined;
  const pythonBin = getArg("deerflow-python");
  const backendPath = getArg("deerflow-backend");
  const configPath = getArg("deerflow-config");
  const modelName = getArg("deerflow-model");

  if (
    !explicitEnabled &&
    !mode &&
    !pythonBin &&
    !backendPath &&
    !configPath &&
    !modelName &&
    !argv.includes("--deerflow-force")
  ) {
    return undefined;
  }

  return {
    enabled: explicitEnabled ? explicitEnabled === "true" : undefined,
    force: argv.includes("--deerflow-force"),
    mode,
    pythonBin,
    backendPath,
    configPath,
    modelName,
  };
}

function buildRoleExecutionOptionsFromArgs(): RoleExecutionOptions | undefined {
  const mode = getArg("executor") as RoleExecutionOptions["mode"] | undefined;
  const allowWrite = getArg("allow-write");
  const vclawBin = getArg("vclaw-bin");
  const vclawConfig = getArg("vclaw-config");
  const timeoutMs = getArg("timeout-ms");

  if (!mode && !allowWrite && !vclawBin && !vclawConfig && !timeoutMs) {
    return undefined;
  }

  return {
    mode,
    allowWrite: allowWrite ? allowWrite === "true" : undefined,
    vclawBin,
    vclawConfig,
    timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
  };
}

function buildRoleTemplate(roleId: string): RoleTemplate {
  const ts = nowIso();
  const capabilities = getCsv("capabilities") as AgentCapability[];
  return {
    id: `${roleId}-template`,
    name: getArg("name") ?? roleId,
    description: getArg("description") ?? `Runtime role template ${roleId}`,
    goals: getCsv("goals").length > 0 ? getCsv("goals") : ["deliver actionable output"],
    systemInstruction:
      getArg("system-instruction") ??
      "Analyze the task and provide a concise, structured output aligned with role goals.",
    inputContract: getArg("input-contract") ?? "task goal + constraints + context",
    outputContract: getArg("output-contract") ?? "conclusion + plan + risks + acceptance",
    capabilities: capabilities.length > 0 ? capabilities : ["planning"],
    policy: buildPolicy(true),
    memoryScope: buildMemoryScope(),
    enabled: parseBool("template-enabled", true),
    version: getArg("version") ?? VCLAW_DATE_VERSION,
    tags: getCsv("tags"),
    createdAt: ts,
    updatedAt: ts,
  };
}

function buildRuntimeAgent(roleId: string, template: RoleTemplate): RuntimeAgent {
  const ts = nowIso();
  const capabilities = getCsv("capabilities") as AgentCapability[];
  return {
    id: roleId,
    templateId: template.id,
    name: getArg("runtime-name") ?? template.name,
    description: getArg("runtime-description") ?? template.description,
    capabilities: capabilities.length > 0 ? capabilities : template.capabilities,
    policy: buildPolicy(true),
    memoryScope: buildMemoryScope(),
    enabled: parseBool("enabled", true),
    version: getArg("runtime-version") ?? template.version,
    tags: getCsv("runtime-tags").length > 0 ? getCsv("runtime-tags") : template.tags,
    createdAt: ts,
    updatedAt: ts,
  };
}

function buildPresetFromArgs(presetId: string, previous?: PresetDefinition): PresetDefinition {
  const ts = nowIso();
  const roles = getCsv("roles");
  const order = getCsv("order");
  const next: PresetDefinition = {
    id: presetId,
    name: getArg("name") ?? previous?.name ?? presetId,
    description: getArg("description") ?? previous?.description ?? `Preset ${presetId}`,
    roles: roles.length > 0 ? roles : (previous?.roles ?? []),
    order: order.length > 0 ? order : (previous?.order ?? (roles.length > 0 ? roles : [])),
    defaultPolicy: {
      enabled: parseBool("policy-enabled", previous?.defaultPolicy.enabled ?? true),
      maxTurns: parseIntSafe("max-turns", previous?.defaultPolicy.maxTurns ?? 6),
      allowedTools:
        getCsv("allowed-tools").length > 0
          ? getCsv("allowed-tools")
          : (previous?.defaultPolicy.allowedTools ?? []),
      deniedTools:
        getCsv("denied-tools").length > 0
          ? getCsv("denied-tools")
          : (previous?.defaultPolicy.deniedTools ?? []),
      constraints:
        getCsv("constraints").length > 0
          ? getCsv("constraints")
          : (previous?.defaultPolicy.constraints ?? []),
    },
    taskTypes:
      getCsv("task-types").length > 0 ? getCsv("task-types") : (previous?.taskTypes ?? ["general"]),
    tags: getCsv("tags").length > 0 ? getCsv("tags") : (previous?.tags ?? []),
    enabled: parseBool("enabled", previous?.enabled ?? true),
    version: getArg("version") ?? previous?.version ?? VCLAW_DATE_VERSION,
    createdAt: previous?.createdAt ?? ts,
    updatedAt: ts,
  };
  return next;
}

async function runCommand() {
  const goal = getArg("goal");
  if (!goal) {
    throw new CliError("BAD_REQUEST", 1, 'Missing goal. Use: run --goal "..."');
  }
  const sessionId = getArg("session") ?? "local-main";
  const runtime = await createAgentOsRuntime();
  try {
    const result = await runtime.orchestrator.run({
      sessionId,
      goal,
      taskType: getArg("task-type"),
      constraints: getCsv("constraints"),
      roles: getCsv("roles").length > 0 ? getCsv("roles") : undefined,
      preset: getArg("preset"),
      requiredCapabilities: getCsv("required-capabilities") as AgentCapability[],
      preferredRoles: getCsv("preferred-roles"),
      excludedRoles: getCsv("excluded-roles"),
      deerflow: buildDeerFlowOptionsFromArgs(),
      roleExecution: buildRoleExecutionOptionsFromArgs(),
    });
    emitSuccess(
      {
        command: "run",
        routeSummary: result.routeSummary,
        selectedRoles: result.selectedRoles,
        selectionReasons: result.selectionReasons,
        result,
        metadata: {
          consistencyIssues: runtime.consistencyIssues,
        },
      },
      () => {
        console.log(`routeSummary: ${result.routeSummary}`);
        console.log(`selectedRoles: ${result.selectedRoles.join(", ")}`);
        console.log(`executionMode: ${result.executionMode}`);
        console.log(`memoryHits: ${result.memoryContext.hits.length}`);
        console.log(`selectionReasons: ${result.selectionReasons.join(" | ")}`);
        console.log(`conclusion: ${result.conclusion}`);
        console.log(`plan[0]: ${result.plan[0] ?? "n/a"}`);
        console.log("tip: add --json for machine-readable integration output");
      },
    );
  } finally {
    await runtime.storage.close();
  }
}

async function chatCommand() {
  const runtime = await createAgentOsRuntime();
  const sessionId = getArg("session") ?? "local-main";
  const roleList = getCsv("roles");
  const preset = getArg("preset");
  const rl = readline.createInterface({ input, output });
  console.log("Vclaw AgentOS chat mode. Type 'exit' to quit.");
  try {
    const replay = await runtime.sessionStore.inspect(sessionId, 4);
    if (replay.turns.length > 0) {
      console.log(`resume: ${replay.turns.length} prior turn(s) found for session ${sessionId}`);
      console.log(`lastConclusion: ${replay.lastConclusion ?? "n/a"}`);
      console.log(`lastSelectedRoles: ${replay.lastSelectedRoles.join(", ") || "n/a"}`);
    }
    while (true) {
      const line = (await rl.question("> ")).trim();
      if (line === "exit") {
        break;
      }
      if (!line) {
        continue;
      }
      const result = await runtime.orchestrator.run({
        sessionId,
        goal: line,
        roles: roleList.length > 0 ? roleList : undefined,
        preset,
        deerflow: buildDeerFlowOptionsFromArgs(),
        roleExecution: buildRoleExecutionOptionsFromArgs(),
      });
      console.log(`routeSummary: ${result.routeSummary}`);
      console.log(`selectedRoles: ${result.selectedRoles.join(",")}`);
      console.log(`executionMode: ${result.executionMode}`);
      console.log(`memoryHits: ${result.memoryContext.hits.length}`);
      console.log(`selectionReasons: ${result.selectionReasons.join(" | ")}`);
      console.log(`conclusion: ${result.conclusion}`);
    }
  } finally {
    rl.close();
    await runtime.storage.close();
  }
}

async function inspectSessionCommand() {
  const runtime = await createAgentOsRuntime();
  const sessionId = getArg("session") ?? "local-main";
  const limit = parseIntSafe("limit", 6);
  try {
    const replay = await runtime.sessionStore.inspect(sessionId, limit);
    emitSuccess(
      {
        command: "inspect-session",
        result: replay,
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => {
        for (const line of sessionReplaySummary(replay)) {
          console.log(line);
        }
        console.table(
          replay.turns.map((turn) => ({
            taskId: turn.taskId,
            status: turn.status,
            roles: turn.selectedRoles.join(","),
            updatedAt: turn.updatedAt,
            goal: turn.goal.slice(0, 60),
            conclusion: (turn.conclusion ?? "").slice(0, 80),
          })),
        );
      },
    );
  } finally {
    await runtime.storage.close();
  }
}

async function setupWorkspaceCommand() {
  const requested = getArg("workspace") ?? defaultWorkspaceDir();
  const workspaceDir = path.resolve(requested);
  const workspace = await ensureAgentWorkspace({
    dir: workspaceDir,
    ensureBootstrapFiles: true,
  });
  const guide = buildWorkspaceGuide(workspace.dir);
  emitSuccess(
    {
      command: "setup-workspace",
      result: {
        workspaceDir: workspace.dir,
        files: guide,
        next: [
          "Edit AGENTS.md for operating rules and hard boundaries.",
          "Edit SOUL.md and IDENTITY.md for persona and voice.",
          "Edit USER.md and TOOLS.md for operator context and machine-specific notes.",
          "Run pnpm vclaw:agentos -- inspect-session --session local-main --json after your first task.",
        ],
      },
      metadata: {
        generatedAt: nowIso(),
      },
    },
    () => {
      console.log(`workspace: ${workspace.dir}`);
      console.table(guide);
      console.log("next:");
      console.log("- Edit AGENTS.md for operating rules and hard boundaries.");
      console.log("- Edit SOUL.md and IDENTITY.md for persona and voice.");
      console.log("- Edit USER.md and TOOLS.md for operator context and machine-specific notes.");
      console.log("- Run pnpm vclaw:agentos -- demo --json to validate the workspace.");
    },
  );
}

async function inspectMemoryCommand() {
  const runtime = await createAgentOsRuntime();
  const sessionId = getArg("session") ?? "local-main";
  const layer = getArg("layer") as "short-term" | "long-term" | "project-entity" | undefined;
  try {
    const rows = layer
      ? await runtime.memory.inspectByLayer(sessionId, layer, 50)
      : await runtime.memory.inspect(sessionId, 50);
    const summary = buildMemorySummary(rows);
    emitSuccess(
      {
        command: "inspect-memory",
        result: { records: rows, summary },
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => {
        console.log(`session: ${sessionId}`);
        console.log(`total: ${summary.total}`);
        console.log(`latestAt: ${summary.latestAt ?? "n/a"}`);
        console.table(
          Object.entries(summary.byLayer).map(([layerName, count]) => ({
            layer: layerName,
            count,
          })),
        );
        console.table(
          rows.map((row) => ({
            id: row.id,
            layer: row.layer,
            scope: row.scope,
            createdAt: row.createdAt,
            content: row.content.slice(0, 80),
          })),
        );
      },
    );
  } finally {
    await runtime.storage.close();
  }
}

async function demoCommand() {
  const runtime = await createAgentOsRuntime();
  const sessionId = getArg("session") ?? "demo-main";
  const preset = getArg("preset") ?? runtime.config.defaultPreset;
  const goal =
    getArg("goal") ??
    "Design a minimal v2.1.0 release checklist and identify top 3 risks for this repository.";
  try {
    const result = await runtime.orchestrator.run({
      sessionId,
      goal,
      preset,
      taskType: "review",
      deerflow: buildDeerFlowOptionsFromArgs(),
      roleExecution: buildRoleExecutionOptionsFromArgs(),
    });
    emitSuccess(
      {
        command: "demo",
        routeSummary: result.routeSummary,
        selectedRoles: result.selectedRoles,
        selectionReasons: result.selectionReasons,
        result,
        metadata: {
          preset,
          consistencyIssues: runtime.consistencyIssues,
        },
      },
      () => {
        console.log(`goal: ${goal}`);
        console.log(`routeSummary: ${result.routeSummary}`);
        console.log(`selectedRoles: ${result.selectedRoles.join(", ")}`);
        console.log(`executionMode: ${result.executionMode}`);
        console.log(`selectionReasons: ${result.selectionReasons.join(" | ")}`);
        console.log(`conclusion: ${result.conclusion}`);
        console.log(`plan[0]: ${result.plan[0] ?? "n/a"}`);
        console.log("next: pnpm vclaw:agentos -- inspect-memory --session demo-main");
      },
    );
  } finally {
    await runtime.storage.close();
  }
}

async function listRolesCommand() {
  const runtime = await createAgentOsRuntime();
  try {
    const agents = await runtime.registry.listRuntimeAgents();
    const rows = [] as Array<Record<string, string | boolean | number>>;
    for (const agent of agents) {
      const resolved = await runtime.registry.inspectRuntimeAgent(agent.id);
      rows.push({
        id: agent.id,
        name: agent.name,
        templateId: agent.templateId,
        enabled: agent.enabled,
        version: agent.version,
        capabilities: (resolved?.effectiveCapabilities ?? []).join(","),
        maxTurns: resolved?.effectivePolicy.maxTurns ?? 0,
      });
    }
    emitSuccess(
      {
        command: "list-roles",
        result: rows,
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.table(rows),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function inspectRoleCommand() {
  const roleId = getArg("id") ?? argv[1];
  if (!roleId) {
    throw new CliError("BAD_REQUEST", 1, "Missing role id. Use: inspect-role --id <roleId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    const role = await runtime.registry.inspectRuntimeAgent(roleId);
    if (!role) {
      throw new CliError("NOT_FOUND", 3, `RuntimeAgent not found: ${roleId}`);
    }
    emitSuccess(
      {
        command: "inspect-role",
        result: role,
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.log(JSON.stringify(role, null, 2)),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function createRoleCommand() {
  const roleId = getArg("id") ?? argv[1];
  if (!roleId) {
    throw new CliError("BAD_REQUEST", 1, "Missing role id. Use: create-role --id <roleId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    const template = buildRoleTemplate(roleId);
    const runtimeAgent = buildRuntimeAgent(roleId, template);
    const bundle: RoleBundle = { template, runtime: runtimeAgent };
    parseLintOrThrow(validateRoleBundle(bundle), "role");
    await runtime.registry.importRoleBundle(bundle, false);
    emitSuccess(
      {
        command: "create-role",
        result: { id: roleId },
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.log(`Role created: ${roleId}`),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function updateRoleCommand() {
  const roleId = getArg("id") ?? argv[1];
  if (!roleId) {
    throw new CliError("BAD_REQUEST", 1, "Missing role id. Use: update-role --id <roleId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    const inspected = await runtime.registry.inspectRuntimeAgent(roleId);
    if (!inspected) {
      throw new CliError("NOT_FOUND", 3, `RuntimeAgent not found: ${roleId}`);
    }

    const templatePatch: Partial<RoleTemplate> = {};
    const runtimePatch: Partial<RuntimeAgent> = {};

    if (getArg("name")) {
      templatePatch.name = getArg("name");
    }
    if (getArg("description")) {
      templatePatch.description = getArg("description");
    }
    if (getArg("system-instruction")) {
      templatePatch.systemInstruction = getArg("system-instruction");
    }
    if (getArg("input-contract")) {
      templatePatch.inputContract = getArg("input-contract");
    }
    if (getArg("output-contract")) {
      templatePatch.outputContract = getArg("output-contract");
    }
    if (getArg("version")) {
      templatePatch.version = getArg("version");
    }
    if (getCsv("goals").length > 0) {
      templatePatch.goals = getCsv("goals");
    }
    if (getCsv("tags").length > 0) {
      templatePatch.tags = getCsv("tags");
    }
    if (getCsv("capabilities").length > 0) {
      templatePatch.capabilities = getCsv("capabilities") as AgentCapability[];
    }

    if (getArg("runtime-name")) {
      runtimePatch.name = getArg("runtime-name");
    }
    if (getArg("runtime-description")) {
      runtimePatch.description = getArg("runtime-description");
    }
    if (getArg("runtime-version")) {
      runtimePatch.version = getArg("runtime-version");
    }
    if (getArg("enabled")) {
      runtimePatch.enabled = parseBool("enabled", inspected.runtime.enabled);
    }
    if (getCsv("runtime-tags").length > 0) {
      runtimePatch.tags = getCsv("runtime-tags");
    }
    if (getCsv("capabilities").length > 0) {
      runtimePatch.capabilities = getCsv("capabilities") as AgentCapability[];
    }

    if (Object.keys(templatePatch).length > 0) {
      await runtime.registry.updateTemplate(inspected.template.id, templatePatch);
    }
    if (Object.keys(runtimePatch).length > 0) {
      await runtime.registry.updateRuntimeAgent(roleId, runtimePatch);
    }

    parseLintOrThrow(validateRoleBundle(await runtime.registry.exportRoleBundle(roleId)), "role");
    emitSuccess(
      {
        command: "update-role",
        result: { id: roleId },
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.log(`Role updated: ${roleId}`),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function deleteRoleCommand() {
  const roleId = getArg("id") ?? argv[1];
  if (!roleId) {
    throw new CliError("BAD_REQUEST", 1, "Missing role id. Use: delete-role --id <roleId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    const bundle = await runtime.registry.exportRoleBundle(roleId);
    await runtime.registry.deleteRuntimeAgent(roleId, runtime.config.presets);
    await runtime.registry.deleteTemplate(bundle.template.id);
    emitSuccess(
      {
        command: "delete-role",
        result: { id: roleId },
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.log(`Role deleted: ${roleId}`),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function disableRoleCommand() {
  const roleId = getArg("id") ?? argv[1];
  if (!roleId) {
    throw new CliError("BAD_REQUEST", 1, "Missing role id. Use: disable-role --id <roleId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    await runtime.registry.disableRuntimeAgent(roleId);
    emitSuccess(
      {
        command: "disable-role",
        result: { id: roleId, enabled: false },
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.log(`Role disabled: ${roleId}`),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function enableRoleCommand() {
  const roleId = getArg("id") ?? argv[1];
  if (!roleId) {
    throw new CliError("BAD_REQUEST", 1, "Missing role id. Use: enable-role --id <roleId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    await runtime.registry.enableRuntimeAgent(roleId);
    emitSuccess(
      {
        command: "enable-role",
        result: { id: roleId, enabled: true },
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.log(`Role enabled: ${roleId}`),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function exportRoleCommand() {
  const roleId = getArg("id") ?? argv[1];
  const file = getArg("file");
  if (!roleId || !file) {
    throw new CliError("BAD_REQUEST", 1, "Usage: export-role --id <roleId> --file <path.json>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    const bundle = await runtime.registry.exportRoleBundle(roleId);
    await writeRoleBundleJson(file, bundle);
    emitSuccess(
      {
        command: "export-role",
        result: { id: roleId, file },
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.log(`Role exported: ${roleId} -> ${file}`),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function importRoleCommand() {
  const file = getArg("file");
  if (!file) {
    throw new CliError(
      "BAD_REQUEST",
      1,
      "Usage: import-role --file <path.json> [--overwrite true|false]",
    );
  }
  const overwrite = parseBool("overwrite", false);
  const bundle = await readRoleBundleJson(file);
  parseLintOrThrow(validateRoleBundle(bundle), "role");
  const runtime = await createAgentOsRuntime();
  try {
    await runtime.registry.importRoleBundle(bundle, overwrite);
    emitSuccess(
      {
        command: "import-role",
        result: { id: bundle.runtime.id },
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.log(`Role imported: ${bundle.runtime.id}`),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function validateRoleCommand() {
  const roleId = getArg("id");
  const file = getArg("file");
  let bundle: RoleBundle;
  if (file) {
    bundle = await readRoleBundleJson(file);
  } else if (roleId) {
    const runtime = await createAgentOsRuntime();
    try {
      bundle = await runtime.registry.exportRoleBundle(roleId);
    } finally {
      await runtime.storage.close();
    }
  } else {
    throw new CliError("BAD_REQUEST", 1, "Usage: validate-role --id <roleId> | --file <path.json>");
  }

  const validation = validateRoleBundle(bundle);
  emitSuccess(
    {
      command: "validate-role",
      result: validation,
      lintFindings: validation.findings,
    },
    () => console.log(JSON.stringify(validation, null, 2)),
  );
  if (!validation.valid) {
    throw new CliError("VALIDATION_FAILED", 2, "role validation failed", validation);
  }
}

async function listPresetsCommand() {
  const runtime = await createAgentOsRuntime();
  try {
    const presets = listPresets(runtime.config.presets);
    emitSuccess(
      {
        command: "list-presets",
        result: presets,
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => {
        console.table(
          presets.map((preset) => ({
            id: preset.id,
            name: preset.name,
            enabled: preset.enabled,
            version: preset.version,
            roles: preset.order.join(","),
            taskTypes: preset.taskTypes.join(","),
          })),
        );
      },
    );
  } finally {
    await runtime.storage.close();
  }
}

async function inspectPresetCommand() {
  const id = getArg("id") ?? argv[1];
  if (!id) {
    throw new CliError("BAD_REQUEST", 1, "Missing preset id. Use: inspect-preset --id <presetId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    const preset = inspectPreset(runtime.config.presets, id);
    if (!preset) {
      throw new CliError("NOT_FOUND", 3, `Preset not found: ${id}`);
    }
    emitSuccess(
      {
        command: "inspect-preset",
        result: preset,
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.log(JSON.stringify(preset, null, 2)),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function createPresetCommand() {
  const id = getArg("id") ?? argv[1];
  if (!id) {
    throw new CliError("BAD_REQUEST", 1, "Missing preset id. Use: create-preset --id <presetId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    if (runtime.config.presets[id]) {
      throw new CliError("CONFLICT", 3, `Preset already exists: ${id}`);
    }
    const preset = buildPresetFromArgs(id);
    const lint = validatePreset(preset, await roleContextsFromRuntime(runtime));
    parseLintOrThrow(lint, "preset");
    await runtime.repository.upsertPreset(preset);
    emitSuccess(
      {
        command: "create-preset",
        result: { id },
        lintFindings: lint.findings,
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.log(`Preset created: ${id}`),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function updatePresetCommand() {
  const id = getArg("id") ?? argv[1];
  if (!id) {
    throw new CliError("BAD_REQUEST", 1, "Missing preset id. Use: update-preset --id <presetId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    const previous = runtime.config.presets[id];
    if (!previous) {
      throw new CliError("NOT_FOUND", 3, `Preset not found: ${id}`);
    }
    const preset = buildPresetFromArgs(id, previous);
    const lint = validatePreset(preset, await roleContextsFromRuntime(runtime));
    parseLintOrThrow(lint, "preset");
    await runtime.repository.upsertPreset(preset);
    emitSuccess(
      {
        command: "update-preset",
        result: { id },
        lintFindings: lint.findings,
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.log(`Preset updated: ${id}`),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function deletePresetCommand() {
  const id = getArg("id") ?? argv[1];
  if (!id) {
    throw new CliError("BAD_REQUEST", 1, "Missing preset id. Use: delete-preset --id <presetId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    await runtime.repository.deletePreset(id, runtime.config.defaultPreset);
    emitSuccess(
      {
        command: "delete-preset",
        result: { id },
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.log(`Preset deleted: ${id}`),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function exportPresetCommand() {
  const id = getArg("id") ?? argv[1];
  const file = getArg("file");
  if (!id || !file) {
    throw new CliError("BAD_REQUEST", 1, "Usage: export-preset --id <presetId> --file <path.json>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    const preset = runtime.config.presets[id];
    if (!preset) {
      throw new CliError("NOT_FOUND", 3, `Preset not found: ${id}`);
    }
    await writePresetBundleFile(file, preset);
    emitSuccess(
      {
        command: "export-preset",
        result: { id, file },
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.log(`Preset exported: ${id} -> ${file}`),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function importPresetCommand() {
  const file = getArg("file");
  if (!file) {
    throw new CliError(
      "BAD_REQUEST",
      1,
      "Usage: import-preset --file <path.json> [--overwrite true|false]",
    );
  }
  const overwrite = parseBool("overwrite", false);
  const preset = await readPresetBundleFile(file);
  const runtime = await createAgentOsRuntime();
  try {
    if (!overwrite && runtime.config.presets[preset.id]) {
      throw new CliError("CONFLICT", 3, `Preset already exists: ${preset.id}`);
    }
    const lint = validatePreset(preset, await roleContextsFromRuntime(runtime));
    parseLintOrThrow(lint, "preset");
    await runtime.repository.upsertPreset(preset);
    emitSuccess(
      {
        command: "import-preset",
        result: { id: preset.id },
        lintFindings: lint.findings,
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.log(`Preset imported: ${preset.id}`),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function validatePresetCommand() {
  const id = getArg("id");
  const file = getArg("file");
  const runtime = await createAgentOsRuntime();
  try {
    let preset: PresetDefinition;
    if (file) {
      preset = await readPresetBundleFile(file);
    } else if (id) {
      const found = runtime.config.presets[id];
      if (!found) {
        throw new CliError("NOT_FOUND", 3, `Preset not found: ${id}`);
      }
      preset = found;
    } else {
      throw new CliError(
        "BAD_REQUEST",
        1,
        "Usage: validate-preset --id <presetId> | --file <path.json>",
      );
    }

    const lint = validatePreset(preset, await roleContextsFromRuntime(runtime));
    emitSuccess(
      {
        command: "validate-preset",
        result: lint,
        lintFindings: lint.findings,
        metadata: { consistencyIssues: runtime.consistencyIssues },
      },
      () => console.log(JSON.stringify(lint, null, 2)),
    );
    if (!lint.valid) {
      throw new CliError("VALIDATION_FAILED", 2, "preset validation failed", lint);
    }
  } finally {
    await runtime.storage.close();
  }
}

async function vclawRunCommand() {
  const task = getArg("task") ?? getArg("goal");
  if (!task) {
    throw new CliError(
      "BAD_REQUEST",
      1,
      "Missing task. Use: vclaw-run --task \"...\" (or --goal \"...\")",
    );
  }

  const result = runVclawTask({
    task,
    allowWrite: parseBool("allow-write", false),
    vclawBin: getArg("vclaw-bin"),
    vclawConfig: getArg("vclaw-config"),
    timeoutMs: Number(getArg("timeout-ms") ?? "120000"),
  });

  if (!result.ok) {
    throw new CliError("VCLAW_RUN_FAILED", 1, "vclaw run returned non-zero exit code", result);
  }

  emitSuccess(
    {
      command: "vclaw-run",
      result: {
        task,
        conclusion: result.stdout.trim().length > 0 ? result.stdout.trim() : "vclaw returned empty output",
        plan: [
          `Run through external Vclaw runtime (${result.resolvedBin})`,
          "Capture stdout/stderr and return unified CLI envelope",
        ],
        risks: [],
        acceptance: [
          `Subprocess exitCode=${result.exitCode}`,
          "Output bridged into Vclaw AgentOS command contract",
        ],
        bridge: result,
      },
      metadata: {
        vclawBin: result.resolvedBin,
      },
    },
    () => {
      console.log(`vclawBin: ${result.resolvedBin}`);
      console.log(`exitCode: ${result.exitCode}`);
      if (result.stdout.trim().length > 0) {
        console.log("stdout:");
        console.log(result.stdout.trim());
      }
      if (result.stderr.trim().length > 0) {
        console.log("stderr:");
        console.log(result.stderr.trim());
      }
    },
  );
}

async function listAgentsAliasCommand() {
  await listRolesCommand();
}

async function main() {
  const command = argv[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(
      [
        `Vclaw AgentOS ${AGENTOS_CLI_VERSION}`,
        "",
        "Usage: node --import tsx src/cli/agentos.ts <command> [options] [--json]",
        "Preferred wrapper: pnpm vclaw:agentos -- <command> [options] [--json]",
        "Compatibility wrapper: pnpm agentos -- <command> [options] [--json]",
        "",
        "Quick Start:",
        "  demo",
        '  run --goal "implement role-based routing" --preset default-demo',
        "  list-roles",
        "  inspect-memory --session demo-main",
        "  inspect-session --session demo-main",
        "  setup-workspace --workspace .vclaw/workspace",
        "",
        "Commands:",
        "  demo [--goal <text>] [--preset <id>] [--session <id>]",
        "  run --goal <text> [--roles a,b] [--preset <id>] [--required-capabilities a,b] [--preferred-roles a,b] [--excluded-roles a,b]",
        "      [--executor local|vclaw|auto] [--allow-write true|false] [--vclaw-bin <path>] [--vclaw-config <path>] [--timeout-ms <number>]",
        "      [--deerflow true|false] [--deerflow-force] [--deerflow-mode flash|standard|pro|ultra]",
        "      [--deerflow-backend <path>] [--deerflow-config <path>] [--deerflow-python <bin>] [--deerflow-model <name>]",
        "  chat [--roles a,b] [--preset <id>] [--executor local|vclaw|auto]",
        "  list-roles",
        "  list-agents (compat alias)",
        "  inspect-role --id <roleId>",
        "  create-role --id <roleId> ...",
        "  update-role --id <roleId> ...",
        "  disable-role --id <roleId>",
        "  enable-role --id <roleId>",
        "  delete-role --id <roleId>",
        "  export-role --id <roleId> --file <path.json>",
        "  import-role --file <path.json> [--overwrite true|false]",
        "  validate-role --id <roleId> | --file <path.json>",
        "  list-presets",
        "  inspect-preset --id <presetId>",
        "  create-preset --id <presetId> --roles a,b --order a,b",
        "  update-preset --id <presetId> [patch fields]",
        "  delete-preset --id <presetId>",
        "  export-preset --id <presetId> --file <path.json>",
        "  import-preset --file <path.json> [--overwrite true|false]",
        "  validate-preset --id <presetId> | --file <path.json>",
        "  inspect-memory [--session <id>] [--layer short-term|long-term|project-entity]",
        "  inspect-session [--session <id>] [--limit <number>]",
        "  setup-workspace [--workspace <dir>]",
        "  vclaw-run --task <text> [--allow-write true|false] [--vclaw-bin <path>] [--vclaw-config <path>] [--timeout-ms <number>]",
        "",
        "JSON mode:",
        "  append --json to any command above for machine-readable output",
        "",
        "Examples:",
        "  pnpm vclaw:agentos -- demo --json",
        "  pnpm vclaw:agentos -- run --goal \"assess release risk\" --preset default-demo",
        "  pnpm vclaw:agentos -- run --goal \"implement release hardening\" --executor vclaw --json",
        "  pnpm vclaw:agentos -- run --goal \"investigate issue\" --task-type research --required-capabilities research,review --preset \"\" --json",
        "  pnpm vclaw:agentos -- run --goal \"produce a competitive report\" --task-type research --deerflow true --deerflow-mode ultra --json",
        "  pnpm vclaw:agentos -- inspect-memory --session demo-main --json",
        "  pnpm vclaw:agentos -- inspect-session --session demo-main --json",
        "  pnpm vclaw:agentos -- setup-workspace --workspace .vclaw/workspace --json",
        "  pnpm vclaw:agentos -- vclaw-run --task \"scan workspace and summarize risks\" --json",
        "",
        "Exit codes:",
        "  0 success",
        "  1 bad request / unknown command / unexpected error",
        "  2 validation failed",
        "  3 not found / conflict",
        "",
        "Schema doc: docs/cli-schema.md",
      ].join("\n"),
    );
    return;
  }

  switch (command) {
    case "demo":
      await demoCommand();
      return;
    case "run":
      await runCommand();
      return;
    case "chat":
      await chatCommand();
      return;
    case "inspect-memory":
      await inspectMemoryCommand();
      return;
    case "inspect-session":
      await inspectSessionCommand();
      return;
    case "setup-workspace":
      await setupWorkspaceCommand();
      return;
    case "list-roles":
      await listRolesCommand();
      return;
    case "inspect-role":
      await inspectRoleCommand();
      return;
    case "create-role":
      await createRoleCommand();
      return;
    case "update-role":
      await updateRoleCommand();
      return;
    case "disable-role":
      await disableRoleCommand();
      return;
    case "enable-role":
      await enableRoleCommand();
      return;
    case "delete-role":
      await deleteRoleCommand();
      return;
    case "export-role":
      await exportRoleCommand();
      return;
    case "import-role":
      await importRoleCommand();
      return;
    case "validate-role":
      await validateRoleCommand();
      return;
    case "list-presets":
      await listPresetsCommand();
      return;
    case "inspect-preset":
      await inspectPresetCommand();
      return;
    case "create-preset":
      await createPresetCommand();
      return;
    case "update-preset":
      await updatePresetCommand();
      return;
    case "delete-preset":
      await deletePresetCommand();
      return;
    case "export-preset":
      await exportPresetCommand();
      return;
    case "import-preset":
      await importPresetCommand();
      return;
    case "validate-preset":
      await validatePresetCommand();
      return;
    case "list-agents":
      await listAgentsAliasCommand();
      return;
    case "vclaw-run":
      await vclawRunCommand();
      return;
    default:
      throw new CliError(
        "UNKNOWN_COMMAND",
        1,
        `Unknown command: ${command}. Use: pnpm vclaw:agentos -- help`,
      );
  }
}

main().catch((err) => {
  const command = argv[0] ?? "unknown";
  const rawErr = normalizeError(err);
  const cliErr =
    rawErr.code === "BAD_REQUEST"
      ? new CliError(
          rawErr.code,
          rawErr.exitCode,
          `${rawErr.message}. Use: pnpm vclaw:agentos -- help`,
          rawErr.details,
        )
      : rawErr;
  if (jsonMode) {
    const payload: CliEnvelope<never> & {
      routeSummary?: string;
      selectedRoles?: string[];
      selectionReasons?: string[];
    } = {
      ok: false,
      command,
      version: AGENTOS_CLI_VERSION,
      routeSummary: undefined,
      selectedRoles: undefined,
      selectionReasons: undefined,
      result: undefined,
      lintFindings: undefined,
      metadata: {
        generatedAt: nowIso(),
        exitCode: cliErr.exitCode,
      },
      error: {
        code: cliErr.code,
        message: cliErr.message,
        details: cliErr.details,
      },
    };
    console.error(JSON.stringify(payload, null, 2));
  } else {
    console.error(`[vclaw-agentos] ${cliErr.code}: ${cliErr.message}`);
    if (cliErr.details) {
      console.error(JSON.stringify(cliErr.details, null, 2));
    }
  }
  process.exitCode = cliErr.exitCode;
});
