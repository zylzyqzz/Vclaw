import type { AgentMessage } from "@mariozechner/pi-agent-core";

type AssistantContentBlock = Extract<AgentMessage, { role: "assistant" }>["content"][number];
type AssistantMessage = Extract<AgentMessage, { role: "assistant" }>;

const MAX_PERSISTED_REASONING_SIGNATURE_CHARS = 1024;

export function isAssistantMessageWithContent(message: AgentMessage): message is AssistantMessage {
  return (
    !!message &&
    typeof message === "object" &&
    message.role === "assistant" &&
    Array.isArray(message.content)
  );
}

/**
 * Strip all `type: "thinking"` content blocks from assistant messages.
 *
 * If an assistant message becomes empty after stripping, it is replaced with
 * a synthetic `{ type: "text", text: "" }` block to preserve turn structure
 * (some providers require strict user/assistant alternation).
 *
 * Returns the original array reference when nothing was changed (callers can
 * use reference equality to skip downstream work).
 */
export function dropThinkingBlocks(messages: AgentMessage[]): AgentMessage[] {
  let touched = false;
  const out: AgentMessage[] = [];
  for (const msg of messages) {
    if (!isAssistantMessageWithContent(msg)) {
      out.push(msg);
      continue;
    }
    const nextContent: AssistantContentBlock[] = [];
    let changed = false;
    for (const block of msg.content) {
      if (block && typeof block === "object" && (block as { type?: unknown }).type === "thinking") {
        touched = true;
        changed = true;
        continue;
      }
      nextContent.push(block);
    }
    if (!changed) {
      out.push(msg);
      continue;
    }
    // Preserve the assistant turn even if all blocks were thinking-only.
    const content =
      nextContent.length > 0 ? nextContent : [{ type: "text", text: "" } as AssistantContentBlock];
    out.push({ ...msg, content });
  }
  return touched ? out : messages;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeCompactJsonSignature(
  value: unknown,
): { value: unknown; replayable: boolean } | null {
  let parsed: Record<string, unknown> | null = null;
  let sourceWasString = false;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || !trimmed.startsWith("{") || !trimmed.endsWith("}")) {
      return null;
    }
    try {
      const candidate = JSON.parse(trimmed);
      if (!isRecord(candidate)) {
        return null;
      }
      parsed = candidate;
      sourceWasString = true;
    } catch {
      return null;
    }
  } else if (isRecord(value)) {
    parsed = value;
  }

  if (!parsed) {
    return null;
  }

  const id = typeof parsed.id === "string" ? parsed.id.trim() : "";
  const type = typeof parsed.type === "string" ? parsed.type.trim() : "";
  const compactRecord =
    id || type
      ? ({
          ...(id ? { id } : {}),
          ...(type ? { type } : {}),
        } satisfies Record<string, unknown>)
      : null;

  if (!compactRecord) {
    return null;
  }

  return {
    value: sourceWasString ? JSON.stringify(compactRecord) : compactRecord,
    replayable: id.startsWith("rs_") || type.startsWith("reasoning"),
  };
}

function normalizeReasoningSignature(value: unknown): { value: unknown; replayable: boolean } | null {
  const normalizedJson = normalizeCompactJsonSignature(value);
  if (normalizedJson) {
    return normalizedJson;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_PERSISTED_REASONING_SIGNATURE_CHARS) {
    return null;
  }

  return {
    value: trimmed,
    replayable: trimmed.startsWith("rs_") || trimmed === "reasoning_text",
  };
}

function normalizeThoughtSignature(value: unknown): unknown | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_PERSISTED_REASONING_SIGNATURE_CHARS) {
    return undefined;
  }
  return trimmed;
}

function slimThinkingBlockForPersistence(
  block: AssistantContentBlock,
): { block: AssistantContentBlock; changed: boolean; replayable: boolean } {
  if (!block || typeof block !== "object" || (block as { type?: unknown }).type !== "thinking") {
    return { block, changed: false, replayable: false };
  }

  const record = block as unknown as Record<string, unknown>;
  const normalizedThinkingSignature = normalizeReasoningSignature(record.thinkingSignature);
  const normalizedThoughtSignature = normalizeThoughtSignature(record.thought_signature);
  const nextRecord: Record<string, unknown> = {
    type: "thinking",
    thinking: "",
  };

  if (normalizedThinkingSignature) {
    nextRecord.thinkingSignature = normalizedThinkingSignature.value;
  }
  if (normalizedThoughtSignature !== undefined) {
    nextRecord.thought_signature = normalizedThoughtSignature;
  }
  if (typeof record.id === "string" && record.id.trim().length > 0 && record.id.trim().length <= 256) {
    nextRecord.id = record.id.trim();
  }

  const nextKeys = Object.keys(nextRecord).sort();
  const currentKeys = Object.keys(record).sort();
  const changed =
    nextKeys.length !== currentKeys.length ||
    nextKeys.some((key, index) => key !== currentKeys[index]) ||
    nextKeys.some((key) => {
      const current = record[key];
      const next = nextRecord[key];
      if (typeof current === "object" || typeof next === "object") {
        try {
          return JSON.stringify(current) !== JSON.stringify(next);
        } catch {
          return true;
        }
      }
      return current !== next;
    });

  return {
    block: nextRecord as unknown as AssistantContentBlock,
    changed,
    replayable:
      normalizedThinkingSignature?.replayable === true || normalizedThoughtSignature !== undefined,
  };
}

/**
 * Persist hidden reasoning as lightweight placeholder blocks.
 *
 * We keep short replay-critical signatures so follow-up turns remain compatible,
 * but strip the heavy `thinking` text and bulky metadata that slow down session
 * transcript reads/writes in the TUI.
 */
export function slimThinkingBlocksForPersistence(messages: AgentMessage[]): AgentMessage[] {
  let touched = false;
  const out: AgentMessage[] = [];

  for (const msg of messages) {
    if (!isAssistantMessageWithContent(msg)) {
      out.push(msg);
      continue;
    }

    let changed = false;
    let hasNonThinkingBlock = false;
    let hasReplayableThinking = false;
    const nextContent: AssistantContentBlock[] = [];

    for (const block of msg.content) {
      if (!block || typeof block !== "object" || (block as { type?: unknown }).type !== "thinking") {
        hasNonThinkingBlock = true;
        nextContent.push(block);
        continue;
      }

      const slimmed = slimThinkingBlockForPersistence(block);
      changed ||= slimmed.changed;
      hasReplayableThinking ||= slimmed.replayable;
      nextContent.push(slimmed.block);
    }

    if (!changed) {
      out.push(msg);
      continue;
    }

    touched = true;
    out.push({
      ...msg,
      content:
        !hasNonThinkingBlock && !hasReplayableThinking
          ? ([{ type: "text", text: "" }] as AssistantContentBlock[])
          : nextContent,
    });
  }

  return touched ? out : messages;
}
