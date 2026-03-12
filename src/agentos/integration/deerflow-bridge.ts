import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  DeerFlowBridgeRequest,
  DeerFlowBridgeResponse,
  DeerFlowConfig,
  DeerFlowEmbeddedConfig,
  DeerFlowExecutionMode,
  DeerFlowRequestOptions,
  TaskRequest,
} from "../types.js";

export interface DeerFlowRouteDecision {
  use: boolean;
  mode: DeerFlowExecutionMode;
  reasons: string[];
}

export interface DeerFlowBridgeRunner {
  run(request: DeerFlowBridgeRequest): Promise<DeerFlowBridgeResponse>;
}

interface EmbeddedScriptResponse {
  ok: boolean;
  threadId?: string;
  mode?: DeerFlowExecutionMode;
  text?: string;
  artifacts?: unknown[];
  error?: string;
}

const SECTION_NAMES = ["Conclusion", "Plan", "Risks", "Acceptance", "Sources"] as const;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstParagraph(value: string): string {
  return collapseWhitespace(value.split(/\n\s*\n/u)[0] ?? value);
}

function summarizeContext(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) {
    return "none";
  }
  const json = JSON.stringify(context, null, 2);
  if (json.length <= 2000) {
    return json;
  }
  return `${json.slice(0, 1997)}...`;
}

function buildStructuredPrompt(input: DeerFlowBridgeRequest): string {
  return [
    "You are DeerFlow acting as the deep-research engine for Vclaw AgentOS.",
    "Return Markdown with exactly these top-level sections in order:",
    "Conclusion",
    "Plan",
    "Risks",
    "Acceptance",
    "Sources",
    "Use concise bullet lists for Plan, Risks, Acceptance, and Sources.",
    "If a section has no items, write '- none'.",
    "",
    `Goal:\n${input.goal}`,
    "",
    `Task type: ${input.taskType ?? "general"}`,
    "",
    `Constraints:\n${
      input.constraints.length > 0 ? input.constraints.map((item) => `- ${item}`).join("\n") : "- none"
    }`,
    "",
    `Context summary:\n${summarizeContext(input.context)}`,
    "",
    `Requested output contract: ${input.requestedOutput}`,
  ].join("\n");
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

function extractSources(text: string): string[] {
  const fromSection = extractList(extractSection(text, "Sources"));
  if (fromSection.length > 0) {
    return fromSection;
  }
  return Array.from(new Set(text.match(/https?:\/\/\S+/gu) ?? []));
}

function buildSummary(text: string, conclusion: string): string {
  if (conclusion.trim().length > 0) {
    return conclusion;
  }
  const paragraph = firstParagraph(text);
  return paragraph.length > 0 ? paragraph : "DeerFlow completed without a textual summary.";
}

function normalizeArtifacts(value: unknown[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const artifacts = value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      if (!entry || typeof entry !== "object") {
        return undefined;
      }
      const shape = entry as Record<string, unknown>;
      const preferred =
        (typeof shape.artifact_url === "string" && shape.artifact_url) ||
        (typeof shape.path === "string" && shape.path) ||
        (typeof shape.url === "string" && shape.url) ||
        (typeof shape.name === "string" && shape.name);
      return preferred ? collapseWhitespace(preferred) : undefined;
    })
    .filter((entry): entry is string => Boolean(entry));
  return Array.from(new Set(artifacts));
}

function parseEmbeddedResponse(
  payload: EmbeddedScriptResponse,
  durationMs: number,
  mode: DeerFlowExecutionMode,
): DeerFlowBridgeResponse {
  const rawText = payload.text?.trim() ?? "";
  const conclusion = collapseWhitespace(extractSection(rawText, "Conclusion"));
  const plan = extractList(extractSection(rawText, "Plan"));
  const risks = extractList(extractSection(rawText, "Risks"));
  const acceptance = extractList(extractSection(rawText, "Acceptance"));
  const sources = extractSources(rawText);
  const artifacts = normalizeArtifacts(payload.artifacts);

  return {
    ok: payload.ok,
    status: payload.ok ? "completed" : "failed",
    transport: "embedded-python",
    mode: payload.mode ?? mode,
    threadId: payload.threadId ?? "vclaw-deerflow",
    summary: buildSummary(rawText, conclusion),
    conclusion: conclusion || buildSummary(rawText, conclusion),
    plan,
    risks,
    acceptance,
    sources,
    artifacts,
    rawText,
    error: payload.error,
    durationMs,
  };
}

function unavailableResponse(
  config: DeerFlowConfig,
  options: DeerFlowRequestOptions | undefined,
  error: string,
): DeerFlowBridgeResponse {
  return {
    ok: false,
    status: "unavailable",
    transport: "embedded-python",
    mode: options?.mode ?? config.mode,
    threadId: `${config.threadPrefix}-unavailable`,
    summary: "DeerFlow bridge unavailable.",
    conclusion: "DeerFlow bridge unavailable.",
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

function resolveOptions(
  config: DeerFlowConfig,
  options?: DeerFlowRequestOptions,
): DeerFlowEmbeddedConfig & { mode: DeerFlowExecutionMode } {
  return {
    ...config.embedded,
    ...options,
    mode: options?.mode ?? config.mode,
  };
}

function parseJsonOutput(stdout: string): EmbeddedScriptResponse | undefined {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return undefined;
  }

  const lines = trimmed.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]) as EmbeddedScriptResponse;
    } catch {
      continue;
    }
  }
  return undefined;
}

function scriptPath(): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../scripts/deerflow/vclaw_deerflow_bridge.py",
  );
}

function goalKeywordMatches(config: DeerFlowConfig, request: TaskRequest): string[] {
  const haystack = `${request.goal} ${request.taskType ?? ""}`.toLowerCase();
  return config.route.goalKeywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
}

export function shouldUseDeerFlow(config: DeerFlowConfig, request: TaskRequest): DeerFlowRouteDecision {
  const reasons: string[] = [];
  const mode = request.deerflow?.mode ?? config.mode;

  if (request.deerflow?.enabled === false && request.deerflow?.force !== true) {
    return { use: false, mode, reasons: ["disabled per request"] };
  }

  if (request.deerflow?.force === true) {
    return { use: true, mode, reasons: ["forced per request"] };
  }

  const enabled = request.deerflow?.enabled === true || config.enabled;
  if (!enabled) {
    return { use: false, mode, reasons };
  }

  if (request.deerflow?.enabled === true) {
    reasons.push("enabled per request");
  }

  const taskType = (request.taskType ?? "").trim().toLowerCase();
  if (taskType && config.route.taskTypes.some((candidate) => candidate.toLowerCase() === taskType)) {
    reasons.push(`taskType matched: ${taskType}`);
  }

  const requiredCaps = new Set(request.requiredCapabilities ?? []);
  const matchedCaps = config.route.requiredCapabilities.filter((cap) => requiredCaps.has(cap));
  if (matchedCaps.length > 0) {
    reasons.push(`requiredCapabilities matched: ${matchedCaps.join(", ")}`);
  }

  const keywords = goalKeywordMatches(config, request);
  if (keywords.length > 0) {
    reasons.push(`goalKeywords matched: ${keywords.join(", ")}`);
  }

  return {
    use: reasons.length > 0,
    mode,
    reasons,
  };
}

export function parseDeerFlowMarkdownResponse(
  text: string,
  mode: DeerFlowExecutionMode,
): DeerFlowBridgeResponse {
  return parseEmbeddedResponse({ ok: true, text, mode, threadId: "parsed-only" }, 0, mode);
}

export class DeerFlowEmbeddedBridge implements DeerFlowBridgeRunner {
  constructor(private readonly config: DeerFlowConfig) {}

  async run(request: DeerFlowBridgeRequest): Promise<DeerFlowBridgeResponse> {
    const resolved = resolveOptions(this.config, request.options);
    const backendPath = resolved.backendPath;
    const pythonBin = resolved.pythonBin || "python";

    if (!backendPath) {
      return unavailableResponse(
        this.config,
        request.options,
        "DeerFlow backend path is not configured.",
      );
    }
    if (!existsSync(path.join(backendPath, "src", "client.py"))) {
      return unavailableResponse(
        this.config,
        request.options,
        `DeerFlow backend path does not look valid: ${backendPath}`,
      );
    }

    const started = Date.now();
    const child = spawnSync(pythonBin, [scriptPath()], {
      cwd: backendPath,
      input: JSON.stringify({
        backendPath,
        configPath: resolved.configPath,
        threadId: `${this.config.threadPrefix}-${request.sessionId}-${request.taskId}`,
        message: buildStructuredPrompt(request),
        mode: resolved.mode,
        modelName: resolved.modelName,
      }),
      encoding: "utf8",
      timeout: Math.max(5000, this.config.timeoutMs),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
      shell: false,
    });

    const durationMs = Date.now() - started;
    const payload = parseJsonOutput(child.stdout ?? "");
    if (payload) {
      const parsed = parseEmbeddedResponse(payload, durationMs, resolved.mode);
      if (parsed.ok) {
        return parsed;
      }
      return {
        ...parsed,
        status: child.status === null ? "failed" : parsed.status,
        error:
          parsed.error ??
          child.stderr?.trim() ??
          (child.error ? `${child.error.name}: ${child.error.message}` : "DeerFlow bridge failed"),
      };
    }

    return {
      ok: false,
      status: "failed",
      transport: "embedded-python",
      mode: resolved.mode,
      threadId: `${this.config.threadPrefix}-${request.sessionId}-${request.taskId}`,
      summary: "DeerFlow bridge failed to return structured output.",
      conclusion: "DeerFlow bridge failed to return structured output.",
      plan: [],
      risks: [],
      acceptance: [],
      sources: [],
      artifacts: [],
      rawText: child.stdout?.trim() ?? "",
      error:
        child.stderr?.trim() ||
        (child.error ? `${child.error.name}: ${child.error.message}` : "Unknown DeerFlow bridge failure"),
      durationMs,
    };
  }
}
