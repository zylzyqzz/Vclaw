import type { ResolvedRuntimeAgent } from "../registry/agent-registry.js";
import type {
  RoleExecutionMode,
  RoleExecutionOptions,
  RoleExecutionResult,
  TaskRequest,
} from "../types.js";
import { runVclawTask } from "../integration/vclaw-bridge.js";

const SECTION_NAMES = ["Conclusion", "Plan", "Risks", "Acceptance"] as const;

export interface ExecuteRoleInput {
  taskId: string;
  request: TaskRequest;
  agent: ResolvedRuntimeAgent;
  priorExecutions: RoleExecutionResult[];
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSection(text: string, label: (typeof SECTION_NAMES)[number]): string {
  const names = SECTION_NAMES.map(escapeRegex).join("|");
  const pattern = new RegExp(
    `(?:^|\\n)(?:#{1,6}\\s*|\\*\\*)?${escapeRegex(label)}(?:\\*\\*)?\\s*:?[ \\t]*\\n([\\s\\S]*?)(?=(?:\\n(?:#{1,6}\\s*|\\*\\*)?(?:${names})(?:\\*\\*)?\\s*:?[ \\t]*\\n)|$)`,
    "i",
  );
  const match = pattern.exec(text);
  return match?.[1]?.trim() ?? "";
}

function extractList(section: string): string[] {
  const normalized = section
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const items = normalized
    .map((line) => {
      const bullet = line.match(/^[-*]\s+(.+)$/u)?.[1] ?? line.match(/^\d+\.\s+(.+)$/u)?.[1];
      return bullet ? collapseWhitespace(bullet) : undefined;
    })
    .filter((line): line is string => Boolean(line))
    .filter((line) => !/^(none|n\/a)$/iu.test(line));

  if (items.length > 0) {
    return items;
  }

  const collapsed = collapseWhitespace(section);
  if (!collapsed || /^(none|n\/a)$/iu.test(collapsed)) {
    return [];
  }
  return [collapsed];
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => collapseWhitespace(value)).filter(Boolean)));
}

function toMarkdown(result: {
  conclusion: string;
  plan: string[];
  risks: string[];
  acceptance: string[];
}): string {
  return [
    "Conclusion",
    result.conclusion,
    "",
    "Plan",
    ...(result.plan.length > 0 ? result.plan.map((item) => `- ${item}`) : ["- none"]),
    "",
    "Risks",
    ...(result.risks.length > 0 ? result.risks.map((item) => `- ${item}`) : ["- none"]),
    "",
    "Acceptance",
    ...(result.acceptance.length > 0
      ? result.acceptance.map((item) => `- ${item}`)
      : ["- none"]),
  ].join("\n");
}

function summarizePriorExecutions(priorExecutions: RoleExecutionResult[]): string {
  if (priorExecutions.length === 0) {
    return "- none";
  }

  return priorExecutions
    .map((execution) => {
      const summary = execution.conclusion || execution.plan[0] || execution.output;
      return `- ${execution.roleName}: ${collapseWhitespace(summary).slice(0, 220)}`;
    })
    .join("\n");
}

function summarizeSessionReplay(request: TaskRequest): string {
  const turns = request.sessionReplay?.turns ?? [];
  if (turns.length === 0) {
    return "- none";
  }

  return turns
    .map((turn) => {
      const summary = turn.conclusion || turn.routeSummary || turn.goal;
      return `- ${turn.status} :: ${collapseWhitespace(summary).slice(0, 220)}`;
    })
    .join("\n");
}

function summarizeMemoryContext(request: TaskRequest): string {
  const entries = request.memoryContext?.summary ?? [];
  if (entries.length === 0) {
    return "- none";
  }
  return entries.map((entry) => `- ${entry}`).join("\n");
}

function buildRolePrompt(input: ExecuteRoleInput): string {
  const { agent, request, priorExecutions } = input;
  return [
    `You are the ${agent.runtime.name} role inside Vclaw AgentOS.`,
    `Role description: ${agent.template.description}`,
    `Role goals: ${agent.template.goals.join("; ")}`,
    `System instruction: ${agent.template.systemInstruction}`,
    `Input contract: ${agent.template.inputContract}`,
    `Output contract: ${agent.template.outputContract}`,
    `Capabilities: ${agent.effectiveCapabilities.join(", ") || "none"}`,
    `Policy max turns: ${agent.effectivePolicy.maxTurns}`,
    `Allowed tools: ${agent.effectivePolicy.allowedTools.join(", ") || "none"}`,
    `Denied tools: ${agent.effectivePolicy.deniedTools.join(", ") || "none"}`,
    "",
    `Goal:\n${request.goal}`,
    "",
    `Task type: ${request.taskType ?? "general"}`,
    "",
    `Constraints:\n${
      (request.constraints ?? []).length > 0
        ? (request.constraints ?? []).map((item) => `- ${item}`).join("\n")
        : "- none"
    }`,
    "",
    "Session replay:",
    summarizeSessionReplay(request),
    "",
    "Recalled memory:",
    summarizeMemoryContext(request),
    "",
    "Prior role outputs:",
    summarizePriorExecutions(priorExecutions),
    "",
    "Return Markdown with exactly these top-level sections in order:",
    "Conclusion",
    "Plan",
    "Risks",
    "Acceptance",
    "Use concise bullet lists for Plan, Risks, and Acceptance.",
    "If a section has no items, write '- none'.",
  ].join("\n");
}

function firstGoalLine(goal: string): string {
  return collapseWhitespace(goal).replace(/[.]+$/u, "");
}

function fromPrior(priorExecutions: RoleExecutionResult[], field: "plan" | "risks" | "acceptance"): string[] {
  return dedupe(priorExecutions.flatMap((execution) => execution[field])).slice(0, 4);
}

function localRoleOutput(input: ExecuteRoleInput): Omit<RoleExecutionResult, "startedAt" | "completedAt" | "durationMs"> {
  const { agent, request, priorExecutions } = input;
  const roleId = agent.runtime.id;
  const shortGoal = firstGoalLine(request.goal);
  const priorPlans = fromPrior(priorExecutions, "plan");
  const priorRisks = fromPrior(priorExecutions, "risks");
  const priorAcceptance = fromPrior(priorExecutions, "acceptance");
  const constraints = dedupe(request.constraints ?? []);
  const recalledMemory = (request.memoryContext?.summary ?? []).slice(0, 2);
  const priorTurns = request.sessionReplay?.turns ?? [];

  let conclusion = `${agent.runtime.name} prepared a focused contribution for "${shortGoal}".`;
  let plan = [
    `Anchor the work on the goal: ${shortGoal}`,
    "Keep the output aligned with the declared role capabilities",
  ];
  let risks = [
    "Missing environment details can reduce execution accuracy",
    "Role output still depends on route quality and provided constraints",
  ];
  let acceptance = [
    `${agent.runtime.name} output stays within the requested contract`,
    "Next role or operator can act on the result without additional unpacking",
  ];

  if (recalledMemory.length > 0) {
    plan = dedupe([`Reuse prior memory context: ${recalledMemory[0]}`, ...plan]);
  }
  if (priorTurns.length > 0) {
    acceptance = dedupe([
      `Current output continues a session with ${priorTurns.length} recorded turn(s)`,
      ...acceptance,
    ]);
  }

  if (roleId.includes("planner")) {
    conclusion = `Planner decomposed "${shortGoal}" into an execution-ready sequence.`;
    plan = dedupe([
      `Clarify scope, assumptions, and success criteria for "${shortGoal}"`,
      ...(constraints.length > 0
        ? [`Thread these constraints through the plan: ${constraints.join("; ")}`]
        : ["Surface missing constraints before implementation starts"]),
      "Break the work into small, testable increments",
      "Hand implementation priorities to builder and validation priorities to reviewer",
    ]);
    risks = dedupe([
      "Ambiguous success criteria can make downstream implementation drift",
      "Large tasks may need further decomposition before execution",
      ...priorRisks,
    ]);
    acceptance = dedupe([
      "Plan is ordered and actionable",
      "Constraints are visible in the execution sequence",
      "Downstream roles know what to build and what to validate",
    ]);
  } else if (roleId.includes("builder")) {
    conclusion = `Builder translated the plan for "${shortGoal}" into runnable implementation steps.`;
    plan = dedupe([
      ...recalledMemory.map((item) => `Carry forward known context: ${item}`),
      ...(priorPlans.length > 0 ? priorPlans.slice(0, 2) : []),
      "Implement the smallest end-to-end slice first",
      "Add or update verification coverage before broadening scope",
      "Leave the workspace in a state that reviewer can validate quickly",
    ]);
    risks = dedupe([
      "Integration edges may fail if upstream assumptions were incomplete",
      "A minimal slice can still hide compatibility regressions",
      ...priorRisks,
    ]);
    acceptance = dedupe([
      "Implementation path is incremental and testable",
      "Risky edges are visible before broad rollout",
      ...priorAcceptance,
    ]);
  } else if (roleId.includes("reviewer")) {
    conclusion = `Reviewer identified the main validation and regression gates for "${shortGoal}".`;
    plan = dedupe([
      "Check the plan and implementation against the declared goal",
      "Inspect regressions, edge cases, and missing coverage",
      "Confirm the final acceptance bar before sign-off",
      ...priorPlans.slice(0, 1),
    ]);
    risks = dedupe([
      "Fast-moving changes can hide platform-specific regressions",
      "Acceptance criteria may be incomplete if user impact is underspecified",
      ...priorRisks,
    ]);
    acceptance = dedupe([
      "Top risks are explicit",
      "Validation steps are concrete",
      "Release confidence is backed by visible checks",
    ]);
  } else if (roleId.includes("commander")) {
    conclusion = `Commander synthesized the role outputs for "${shortGoal}" into a final direction.`;
    plan = dedupe([
      ...recalledMemory.map((item) => `Preserve recalled context in the final decision: ${item}`),
      ...(priorPlans.length > 0 ? priorPlans.slice(0, 3) : ["Consolidate role guidance into one operator-ready path"]),
      "Resolve tradeoffs and keep the highest-value path visible",
      "Close with a clear final recommendation and acceptance bar",
    ]);
    risks = dedupe([
      ...priorRisks,
      "Synthesis quality depends on the quality of upstream role outputs",
    ]);
    acceptance = dedupe([
      ...(priorAcceptance.length > 0 ? priorAcceptance.slice(0, 3) : []),
      "Final output is concise, coherent, and actionable",
    ]);
  }

  const output = toMarkdown({ conclusion, plan, risks, acceptance });
  return {
    roleId: agent.runtime.id,
    roleName: agent.runtime.name,
    executor: "local",
    status: "completed",
    output,
    conclusion,
    plan,
    risks,
    acceptance,
    prompt: buildRolePrompt(input),
    warnings: [],
  };
}

function parseRoleOutput(markdown: string): {
  conclusion: string;
  plan: string[];
  risks: string[];
  acceptance: string[];
} {
  const conclusion = collapseWhitespace(extractSection(markdown, "Conclusion")) || collapseWhitespace(markdown);
  return {
    conclusion,
    plan: extractList(extractSection(markdown, "Plan")),
    risks: extractList(extractSection(markdown, "Risks")),
    acceptance: extractList(extractSection(markdown, "Acceptance")),
  };
}

function resolveMode(options?: RoleExecutionOptions): RoleExecutionMode {
  const raw = options?.mode ?? process.env.VCLAW_AGENTOS_ROLE_EXECUTOR ?? "local";
  return raw === "auto" || raw === "vclaw" || raw === "local" ? raw : "local";
}

export class DefaultRoleExecutor {
  async execute(input: ExecuteRoleInput): Promise<RoleExecutionResult> {
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const mode = resolveMode(input.request.roleExecution);

    if (mode === "local") {
      const local = localRoleOutput(input);
      return {
        ...local,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
      };
    }

    const prompt = buildRolePrompt(input);
    const bridge = runVclawTask({
      task: prompt,
      allowWrite: input.request.roleExecution?.allowWrite ?? false,
      vclawBin: input.request.roleExecution?.vclawBin,
      vclawConfig: input.request.roleExecution?.vclawConfig,
      timeoutMs: input.request.roleExecution?.timeoutMs,
    });

    if (bridge.ok && bridge.stdout.trim().length > 0) {
      const parsed = parseRoleOutput(bridge.stdout.trim());
      return {
        roleId: input.agent.runtime.id,
        roleName: input.agent.runtime.name,
        executor: "vclaw",
        status: "completed",
        output: bridge.stdout.trim(),
        conclusion: parsed.conclusion,
        plan: parsed.plan,
        risks: parsed.risks,
        acceptance: parsed.acceptance,
        prompt,
        warnings: bridge.stderr.trim().length > 0 ? [bridge.stderr.trim()] : [],
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
        command: bridge.command,
      };
    }

    const fallback = localRoleOutput(input);
    const warning =
      bridge.stderr.trim().length > 0
        ? bridge.stderr.trim()
        : `vclaw executor exited with code ${bridge.exitCode}`;
    return {
      ...fallback,
      executor: "vclaw-fallback",
      status: "fallback",
      warnings: [`Requested ${mode} role executor fell back to local execution: ${warning}`],
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
      command: bridge.command,
    };
  }
}
