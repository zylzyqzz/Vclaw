import type { AgentOsStorage } from "../storage/storage.js";
import type { SessionState, TaskResult } from "../types.js";

interface SessionTimelineEntry {
  taskId: string;
  status: SessionState["status"];
  routeSummary?: string;
  selectedRoles?: string[];
  conclusion?: string;
  executionMode?: TaskResult["executionMode"];
  updatedAt: string;
}

function nextTimeline(
  current: SessionState,
  entry: SessionTimelineEntry,
): SessionTimelineEntry[] {
  const existing = Array.isArray(current.meta.timeline)
    ? (current.meta.timeline as SessionTimelineEntry[])
    : [];
  return [...existing, entry].slice(-20);
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

  async markRunning(sessionId: string, taskId: string): Promise<void> {
    const current = await this.getOrCreate(sessionId);
    await this.storage.upsertSession({
      ...current,
      activeTaskId: taskId,
      status: "running",
      updatedAt: new Date().toISOString(),
    });
  }

  async markCompleted(sessionId: string, taskId: string, result?: TaskResult): Promise<void> {
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
        lastRouteSummary: result?.routeSummary,
        lastSelectedRoles: result?.selectedRoles,
        lastConclusion: result?.conclusion,
        lastExecutionMode: result?.executionMode,
        timeline: nextTimeline(current, {
          taskId,
          status: "completed",
          routeSummary: result?.routeSummary,
          selectedRoles: result?.selectedRoles,
          conclusion: result?.conclusion,
          executionMode: result?.executionMode,
          updatedAt,
        }),
      },
    });
  }

  async markFailed(sessionId: string, taskId: string, message: string): Promise<void> {
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
        errors: [...errs, message],
        timeline: nextTimeline(current, {
          taskId,
          status: "failed",
          conclusion: message,
          updatedAt,
        }),
      },
    });
  }
}
