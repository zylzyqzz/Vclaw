import type { AgentOsStorage } from "../storage/storage.js";
import type {
  MemoryRecall,
  SessionReplay,
  SessionState,
  SessionTimelineEntry,
  SessionTurn,
  TaskRequest,
  TaskResult,
} from "../types.js";

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readTimeline(value: unknown): SessionTimelineEntry[] {
  return Array.isArray(value) ? (value as SessionTimelineEntry[]) : [];
}

function readTurns(value: unknown): SessionTurn[] {
  return Array.isArray(value) ? (value as SessionTurn[]) : [];
}

function nextTimeline(
  current: SessionState,
  entry: SessionTimelineEntry,
): SessionTimelineEntry[] {
  const existing = readTimeline(current.meta.timeline);
  return [...existing, entry].slice(-20);
}

function nextTurns(current: SessionState, entry: SessionTurn): SessionTurn[] {
  return [...readTurns(current.meta.turns), entry].slice(-12);
}

function buildRoleTrace(result?: TaskResult): SessionTurn["roleTrace"] {
  return (result?.roleExecutions ?? []).map((execution) => ({
    roleId: execution.roleId,
    executor: execution.executor,
    status: execution.status,
    conclusion: execution.conclusion,
  }));
}

function recallSummary(recall?: MemoryRecall): string[] {
  return recall?.summary ?? [];
}

function buildReplay(current: SessionState, limit: number): SessionReplay {
  const turns = readTurns(current.meta.turns).slice(-Math.max(1, limit));
  return {
    sessionId: current.sessionId,
    activeTaskId: current.activeTaskId,
    status: current.status,
    updatedAt: current.updatedAt,
    lastTaskId:
      typeof current.meta.lastTaskId === "string" ? current.meta.lastTaskId : undefined,
    lastConclusion:
      typeof current.meta.lastConclusion === "string" ? current.meta.lastConclusion : undefined,
    lastSelectedRoles: readStringArray(current.meta.lastSelectedRoles),
    lastExecutionMode:
      typeof current.meta.lastExecutionMode === "string"
        ? (current.meta.lastExecutionMode as TaskResult["executionMode"])
        : undefined,
    timeline: readTimeline(current.meta.timeline).slice(-Math.max(1, limit)),
    turns,
  };
}

export class SessionStore {
  constructor(private readonly storage: AgentOsStorage) {}

  async getOrCreate(sessionId: string): Promise<SessionState> {
    const current = await this.storage.getSession(sessionId);
    if (current) {
      return current;
    }
    const state: SessionState = {
      sessionId,
      status: "idle",
      updatedAt: new Date().toISOString(),
      meta: {},
    };
    await this.storage.upsertSession(state);
    return state;
  }

  async inspect(sessionId: string, limit = 6): Promise<SessionReplay> {
    const current = await this.getOrCreate(sessionId);
    return buildReplay(current, limit);
  }

  async markRunning(sessionId: string, taskId: string, goal?: string): Promise<void> {
    const current = await this.getOrCreate(sessionId);
    await this.storage.upsertSession({
      ...current,
      activeTaskId: taskId,
      status: "running",
      updatedAt: new Date().toISOString(),
      meta: {
        ...current.meta,
        ...(goal ? { lastUserGoal: goal } : {}),
      },
    });
  }

  async markCompleted(
    sessionId: string,
    taskId: string,
    request: TaskRequest,
    result?: TaskResult,
  ): Promise<void> {
    const current = await this.getOrCreate(sessionId);
    const updatedAt = new Date().toISOString();
    await this.storage.upsertSession({
      ...current,
      activeTaskId: taskId,
      status: "completed",
      updatedAt,
      meta: {
        ...current.meta,
        lastTaskId: taskId,
        lastUserGoal: request.goal,
        lastRouteSummary: result?.routeSummary,
        lastSelectedRoles: result?.selectedRoles,
        lastConclusion: result?.conclusion,
        lastExecutionMode: result?.executionMode,
        lastMemorySummary: recallSummary(result?.memoryContext),
        timeline: nextTimeline(current, {
          taskId,
          status: "completed",
          routeSummary: result?.routeSummary,
          selectedRoles: result?.selectedRoles,
          conclusion: result?.conclusion,
          executionMode: result?.executionMode,
          updatedAt,
        }),
        turns: nextTurns(current, {
          taskId,
          goal: request.goal,
          status: "completed",
          routeSummary: result?.routeSummary,
          selectedRoles: result?.selectedRoles ?? [],
          conclusion: result?.conclusion,
          executionMode: result?.executionMode,
          memorySummary: recallSummary(result?.memoryContext),
          roleTrace: buildRoleTrace(result),
          updatedAt,
        }),
      },
    });
  }

  async markFailed(
    sessionId: string,
    taskId: string,
    message: string,
    goal?: string,
  ): Promise<void> {
    const current = await this.getOrCreate(sessionId);
    const errs = Array.isArray(current.meta.errors) ? current.meta.errors : [];
    const updatedAt = new Date().toISOString();
    await this.storage.upsertSession({
      ...current,
      activeTaskId: taskId,
      status: "failed",
      updatedAt,
      meta: {
        ...current.meta,
        ...(goal ? { lastUserGoal: goal } : {}),
        errors: [...errs, message],
        timeline: nextTimeline(current, {
          taskId,
          status: "failed",
          conclusion: message,
          updatedAt,
        }),
        turns: nextTurns(current, {
          taskId,
          goal: goal ?? (typeof current.meta.lastUserGoal === "string" ? current.meta.lastUserGoal : ""),
          status: "failed",
          selectedRoles: [],
          conclusion: message,
          memorySummary: [],
          roleTrace: [],
          updatedAt,
        }),
      },
    });
  }
}
