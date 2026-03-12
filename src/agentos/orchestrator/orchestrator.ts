import { randomUUID } from "node:crypto";
import { type DeerFlowBridgeRunner, shouldUseDeerFlow } from "../integration/deerflow-bridge.js";
import { MemoryManager } from "../memory/memory-manager.js";
import { AgentRegistry, type ResolvedRuntimeAgent } from "../registry/agent-registry.js";
import { ensurePresetExists } from "../registry/preset-utils.js";
import { validatePreset } from "../registry/role-validation.js";
import { SessionStore } from "../session/session-store.js";
import type {
  AgentCapability,
  DeerFlowBridgeResponse,
  OrchestratorConfig,
  PresetDefinition,
  TaskRequest,
  TaskResult,
} from "../types.js";

interface RouteDecision {
  routeSummary: string;
  selected: ResolvedRuntimeAgent[];
  reasons: string[];
}

const ROUTE_PRIORITY_EXPLICIT = "priority: explicit roles (highest)";
const ROUTE_PRIORITY_PRESET = "priority: preset (second)";
const ROUTE_PRIORITY_DYNAMIC = "priority: dynamic route (fallback)";

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function compact(values: Array<string | undefined>): string[] {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
}

function defaultConclusion(selectedRoles: string[]): string {
  return `Task completed with dynamic roles: ${selectedRoles.join(", ")}.`;
}

function defaultPlan(roleOutputs: Array<{ roleId: string; output: string }>): string[] {
  return roleOutputs.map((entry) => entry.output);
}

function defaultRisks(): string[] {
  return [
    "Route quality depends on role metadata and capability definitions",
    "Role disablement or preset drift can reduce route coverage",
  ];
}

function defaultAcceptance(): string[] {
  return [
    "Route generated from explicit roles, preset, or dynamic scoring",
    "Result includes routeSummary, selectedRoles, selectionReasons",
    "Memory persisted across short-term, long-term, and project/entity",
  ];
}

function deerflowFailure(
  config: OrchestratorConfig,
  sessionId: string,
  taskId: string,
  error: string,
): DeerFlowBridgeResponse {
  return {
    ok: false,
    status: "failed",
    transport: "embedded-python",
    mode: config.deerflow.mode,
    threadId: `${config.deerflow.threadPrefix}-${sessionId}-${taskId}`,
    summary: "DeerFlow bridge failed during research augmentation.",
    conclusion: "DeerFlow bridge failed during research augmentation.",
    plan: [],
    risks: [],
    acceptance: [],
    sources: [],
    artifacts: [],
    rawText: "",
    error,
    durationMs: 0,
  };
}

function missingRequiredCapabilities(
  selected: ResolvedRuntimeAgent[],
  required: AgentCapability[],
): AgentCapability[] {
  const covered = new Set(selected.flatMap((agent) => agent.effectiveCapabilities as string[]));
  return required.filter((cap) => !covered.has(cap));
}

function getPreset(config: OrchestratorConfig, presetId: string): PresetDefinition {
  return ensurePresetExists(config.presets, presetId);
}

function mergeRouteInputs(
  config: OrchestratorConfig,
  request: TaskRequest,
): {
  required: AgentCapability[];
  preferred: string[];
  excluded: string[];
  reasons: string[];
} {
  const reasons: string[] = [];
  const taskType = (request.taskType ?? "").trim();
  const rule = taskType ? config.routing.taskTypeRules[taskType] : undefined;

  const required = uniq([
    ...(rule?.requiredCapabilities ?? []),
    ...(request.requiredCapabilities ?? []),
  ]) as AgentCapability[];

  const preferred = uniq([...(rule?.preferredRoles ?? []), ...(request.preferredRoles ?? [])]);
  const excluded = uniq([...(rule?.excludedRoles ?? []), ...(request.excludedRoles ?? [])]);

  if (taskType && rule) {
    reasons.push(`taskType rule applied: ${taskType}`);
  }
  if (required.length > 0) {
    reasons.push(`requiredCapabilities: ${required.join(", ")}`);
  }
  if (preferred.length > 0) {
    reasons.push(`preferredRoles: ${preferred.join(", ")}`);
  }
  if (excluded.length > 0) {
    reasons.push(`excludedRoles: ${excluded.join(", ")}`);
  }

  return { required, preferred, excluded, reasons };
}

function scoreAgent(
  config: OrchestratorConfig,
  agent: ResolvedRuntimeAgent,
  request: TaskRequest,
  merged: ReturnType<typeof mergeRouteInputs>,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const caps = agent.effectiveCapabilities;

  if (merged.required.length > 0) {
    const matched = merged.required.filter((cap) => caps.includes(cap));
    if (matched.length > 0) {
      score += matched.length * config.routing.weights.requiredCapability;
      reasons.push(`matched requiredCapabilities: ${matched.join(",")}`);
    } else {
      reasons.push("no requiredCapabilities matched");
    }
  }

  if (merged.preferred.includes(agent.runtime.id)) {
    score += config.routing.weights.preferredRole;
    reasons.push("in preferredRoles");
  }

  if (merged.excluded.includes(agent.runtime.id)) {
    reasons.push("in excludedRoles");
    return { score: -1000, reasons };
  }

  const text = `${request.goal} ${request.taskType ?? ""}`.toLowerCase();
  for (const [capability, words] of Object.entries(config.routing.capabilityKeywords)) {
    if (
      words.some((w) => text.includes(w.toLowerCase())) &&
      caps.includes(capability as AgentCapability)
    ) {
      score += config.routing.weights.keywordMatch;
      reasons.push(`matched capability keywords: ${capability}`);
    }
  }

  const constraints = request.constraints ?? [];
  if (constraints.length > 0 && caps.includes("coordination")) {
    score += config.routing.weights.coordinationConstraint;
    reasons.push("coordination for constraints");
  }

  return { score, reasons: reasons.length > 0 ? reasons : ["fallback score"] };
}

export class Orchestrator {
  constructor(
    private readonly config: OrchestratorConfig,
    private readonly registry: AgentRegistry,
    private readonly sessions: SessionStore,
    private readonly memory: MemoryManager,
    private readonly deerflow?: DeerFlowBridgeRunner,
  ) {}

  async run(request: TaskRequest): Promise<TaskResult> {
    const taskId = randomUUID();
    await this.sessions.markRunning(request.sessionId, taskId);
    try {
      const route = await this.selectRoles(request);
      const deerflowDecision = shouldUseDeerFlow(this.config.deerflow, request);
      let deerflowResult: DeerFlowBridgeResponse | undefined;
      if (deerflowDecision.use) {
        if (this.deerflow) {
          try {
            deerflowResult = await this.deerflow.run({
              taskId,
              sessionId: request.sessionId,
              goal: request.goal,
              taskType: request.taskType,
              constraints: request.constraints ?? [],
              context: request.context,
              requestedOutput: "conclusion + plan + risks + acceptance",
              options: {
                ...request.deerflow,
                mode: deerflowDecision.mode,
              },
            });
          } catch (err) {
            deerflowResult = deerflowFailure(
              this.config,
              request.sessionId,
              taskId,
              err instanceof Error ? err.message : String(err),
            );
          }
        } else {
          deerflowResult = {
            ...deerflowFailure(
              this.config,
              request.sessionId,
              taskId,
              "DeerFlow bridge is not initialized.",
            ),
            status: "unavailable",
            summary: "DeerFlow bridge unavailable.",
            conclusion: "DeerFlow bridge unavailable.",
          };
        }
      }

      if (route.selected.length === 0 && deerflowResult?.status !== "completed") {
        throw new Error("No enabled runtime roles are available for this task route");
      }

      const roleOutputs = route.selected.map((agent, idx) => ({
        roleId: agent.runtime.id,
        output:
          `[${idx + 1}] ${agent.runtime.name}: ${agent.template.systemInstruction} ` +
          `Goal="${request.goal}" TaskType="${request.taskType ?? "general"}"`,
      }));
      if (deerflowResult?.status === "completed") {
        roleOutputs.push({
          roleId: "deerflow-research",
          output: deerflowResult.summary,
        });
      }

      const selectedRoles = [
        ...route.selected.map((x) => x.runtime.id),
        ...(deerflowResult?.status === "completed" ? ["deerflow-research"] : []),
      ];
      const plan =
        deerflowResult?.status === "completed" && deerflowResult.plan.length > 0
          ? uniq([...deerflowResult.plan, ...defaultPlan(roleOutputs)])
          : defaultPlan(roleOutputs);
      const conclusion =
        deerflowResult?.status === "completed"
          ? deerflowResult.conclusion
          : defaultConclusion(selectedRoles);
      const risks = uniq([
        ...(deerflowResult?.status === "completed" ? deerflowResult.risks : []),
        ...(deerflowResult && deerflowResult.status !== "completed"
          ? compact([
              `DeerFlow ${deerflowResult.status}: ${
                deerflowResult.error ?? deerflowResult.summary
              }`,
            ])
          : []),
        ...defaultRisks(),
      ]);
      const acceptance = uniq([
        ...(deerflowResult?.status === "completed" ? deerflowResult.acceptance : []),
        ...(deerflowResult?.status === "completed"
          ? [
              `DeerFlow ${deerflowResult.mode} response normalized into Vclaw task contract`,
            ]
          : []),
        ...defaultAcceptance(),
      ]);
      const selectionReasons = [
        ...route.reasons,
        ...deerflowDecision.reasons.map((reason) => `deerflow ${reason}`),
        ...compact(
          deerflowResult
            ? [
                `deerflow status: ${deerflowResult.status}`,
                deerflowResult.ok ? `deerflow mode: ${deerflowResult.mode}` : deerflowResult.error,
              ]
            : [],
        ),
      ];

      const result: TaskResult = {
        requestId: taskId,
        sessionId: request.sessionId,
        routeSummary:
          deerflowResult?.status === "completed"
            ? `${route.routeSummary} + deerflow (${deerflowResult.mode})`
            : route.routeSummary,
        selectedRoles,
        selectionReasons,
        conclusion,
        plan,
        risks,
        acceptance,
        roleOutputs,
        deerflow: deerflowResult,
      };

      await this.memory.captureRun(request.sessionId, request.goal, conclusion, taskId, deerflowResult);
      await this.sessions.markCompleted(request.sessionId, taskId);
      return result;
    } catch (err) {
      await this.sessions.markFailed(
        request.sessionId,
        taskId,
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }
  }

  private async selectRoles(request: TaskRequest): Promise<RouteDecision> {
    const explicitRoles = uniq(request.roles ?? []);
    if (explicitRoles.length > 0) {
      const selected = await this.registry.resolveMany(explicitRoles);
      return {
        routeSummary: "explicit roles route",
        selected,
        reasons: [
          ROUTE_PRIORITY_EXPLICIT,
          `explicit roles requested: ${explicitRoles.join(", ")}`,
          `resolved roles: ${selected.map((x) => x.runtime.id).join(", ") || "none"}`,
        ],
      };
    }

    const shouldUsePreset = request.preset !== "";
    const presetId = request.preset ?? this.config.defaultPreset;
    if (shouldUsePreset && presetId) {
      const preset = getPreset(this.config, presetId);
      const roleIds = uniq(preset.order.length > 0 ? preset.order : preset.roles).filter(
        (id) => !(request.excludedRoles ?? []).includes(id),
      );
      const roleContexts = [] as Array<{
        id: string;
        enabled: boolean;
        capabilities: string[];
        outputContract: string;
        policy: {
          enabled: boolean;
          maxTurns: number;
          allowedTools: string[];
          deniedTools: string[];
          constraints: string[];
        };
      }>;
      for (const agentId of roleIds) {
        const inspected = await this.registry.inspectRuntimeAgent(agentId);
        if (!inspected) {
          continue;
        }
        roleContexts.push({
          id: inspected.runtime.id,
          enabled: inspected.runtime.enabled && inspected.template.enabled,
          capabilities: inspected.effectiveCapabilities,
          outputContract: inspected.template.outputContract,
          policy: inspected.effectivePolicy,
        });
      }
      const validation = validatePreset(preset, roleContexts);
      if (!validation.valid) {
        const first = validation.findings.find((x) => x.level === "error");
        throw new Error(`Invalid preset ${preset.id}: ${first?.message ?? "unknown error"}`);
      }

      const selected = await this.registry.resolveMany(roleIds);
      if (selected.length > 0) {
        return {
          routeSummary: `preset route (${preset.id})`,
          selected,
          reasons: [
            ROUTE_PRIORITY_PRESET,
            `preset selected: ${preset.id}`,
            `preset defaultPolicy.maxTurns: ${preset.defaultPolicy.maxTurns}`,
            `preset roles resolved: ${selected.map((x) => x.runtime.id).join(", ")}`,
          ],
        };
      }
    }

    const merged = mergeRouteInputs(this.config, request);
    const all = await this.registry.listRuntimeAgents();
    const scored: Array<{ resolved: ResolvedRuntimeAgent; score: number; reasons: string[] }> = [];
    for (const role of all) {
      const resolved = await this.registry.inspectRuntimeAgent(role.id);
      if (
        !resolved ||
        !resolved.runtime.enabled ||
        !resolved.template.enabled ||
        !resolved.effectivePolicy.enabled
      ) {
        continue;
      }
      const evaluated = scoreAgent(this.config, resolved, request, merged);
      if (evaluated.score > -1000) {
        scored.push({ resolved, score: evaluated.score, reasons: evaluated.reasons });
      }
    }

    const selected = scored
      .toSorted((a, b) => b.score - a.score)
      .slice(0, this.config.routing.maxDynamicRoles)
      .filter((x) => x.score > 0)
      .map((x) => x.resolved);

    if (merged.required.length > 0) {
      const missing = missingRequiredCapabilities(selected, merged.required);
      if (missing.length > 0) {
        return {
          routeSummary: "dynamic capability route",
          selected: [],
          reasons: [
            ROUTE_PRIORITY_DYNAMIC,
            ...merged.reasons,
            `missing requiredCapabilities coverage: ${missing.join(", ")}`,
          ],
        };
      }
    }

    const reasons = [
      ROUTE_PRIORITY_DYNAMIC,
      ...merged.reasons,
      ...scored
        .toSorted((a, b) => b.score - a.score)
        .slice(0, this.config.routing.maxDynamicRoles)
        .map((x) => `${x.resolved.runtime.id}: score=${x.score}; ${x.reasons.join("; ")}`),
    ];

    return {
      routeSummary: "dynamic capability route",
      selected,
      reasons,
    };
  }
}
