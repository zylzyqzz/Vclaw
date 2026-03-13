# Vclaw AgentOS CLI JSON Schema

Version: `2026.3.13`

All core `Vclaw AgentOS` commands support `--json` and return a stable top-level envelope.

## Top-Level Envelope

```json
{
  "ok": true,
  "command": "run",
  "version": "2026.3.13",
  "routeSummary": "preset route (default-demo)",
  "selectedRoles": ["commander", "planner", "builder", "reviewer"],
  "selectionReasons": ["priority: preset (second)"],
  "result": {},
  "lintFindings": [],
  "metadata": {
    "generatedAt": "2026-03-13T00:00:00.000Z"
  }
}
```

Stable fields:

- `ok: boolean`
- `command: string`
- `version: string`
- `result: unknown`
- `metadata: Record<string, unknown>`
- `error?: { code: string; message: string; details?: unknown }`

Route-related fields:

- `routeSummary?: string`
- `selectedRoles?: string[]`
- `selectionReasons?: string[]`

Validation-related fields:

- `lintFindings?: Array<{ level: "error" | "warning"; code: string; message: string; target: string }>`

## Error Envelope

```json
{
  "ok": false,
  "command": "validate-preset",
  "version": "2026.3.13",
  "metadata": {
    "generatedAt": "2026-03-13T00:00:00.000Z",
    "exitCode": 2
  },
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "preset validation failed",
    "details": {
      "valid": false,
      "findings": []
    }
  }
}
```

## Exit Codes

- `0`: success
- `1`: bad request, unknown command, or unexpected error
- `2`: validation failed
- `3`: not found or conflict

## Result Shapes

### `run` / `demo`

Recommended fields in `result`:

- `requestId: string`
- `sessionId: string`
- `routeSummary: string`
- `selectedRoles: string[]`
- `selectionReasons: string[]`
- `executionMode: string`
- `conclusion: string`
- `plan: string[]`
- `risks: string[]`
- `acceptance: string[]`
- `roleOutputs: Array<{ roleId: string; output: string }>`
- `roleExecutions: Array<{ roleId, roleName, executor, status, prompt, durationMs }>`
- `sessionReplay: { sessionId, status, turns, timeline, lastConclusion, lastSelectedRoles }`
- `memoryContext: { query, hits, summary }`

### `inspect-session`

```json
{
  "command": "inspect-session",
  "result": {
    "sessionId": "local-main",
    "status": "completed",
    "turns": [
      {
        "taskId": "uuid",
        "goal": "plan release hardening",
        "status": "completed",
        "selectedRoles": ["planner", "reviewer"],
        "memorySummary": ["[short-term] previous conclusion"],
        "roleTrace": [{ "roleId": "planner", "executor": "local", "status": "completed" }]
      }
    ],
    "timeline": []
  }
}
```

### `inspect-memory`

```json
{
  "command": "inspect-memory",
  "result": {
    "records": [{ "layer": "short-term", "scope": "session:demo-main" }],
    "summary": {
      "total": 3,
      "byLayer": {
        "short-term": 1,
        "long-term": 1,
        "project-entity": 1
      }
    }
  }
}
```

### `setup-workspace`

```json
{
  "command": "setup-workspace",
  "result": {
    "workspaceDir": "E:\\Vclaw\\.vclaw\\workspace",
    "files": [
      {
        "file": "E:\\Vclaw\\.vclaw\\workspace\\AGENTS.md",
        "purpose": "Global operating rules and hard boundaries."
      }
    ],
    "next": [
      "Edit AGENTS.md for operating rules and hard boundaries."
    ]
  }
}
```

### `list-roles`

`result: Array<{ id, name, templateId, enabled, version, capabilities, maxTurns }>`

### `inspect-role`

`result: { runtime, template, effectiveCapabilities, effectivePolicy }`

### `list-presets`

`result: Array<PresetDefinition>`

### `inspect-preset`

`result: PresetDefinition`

### `validate-role` / `validate-preset`

`result: { valid: boolean; findings: LintFinding[] }`

## Supported JSON Commands

- `demo`
- `run`
- `chat` is interactive and does not use the JSON envelope
- `list-roles`
- `list-agents` as a compatibility alias for `list-roles`
- `inspect-role`
- `create-role`
- `update-role`
- `disable-role`
- `enable-role`
- `delete-role`
- `export-role`
- `import-role`
- `validate-role`
- `list-presets`
- `inspect-preset`
- `create-preset`
- `update-preset`
- `delete-preset`
- `export-preset`
- `import-preset`
- `validate-preset`
- `inspect-memory`
- `inspect-session`
- `setup-workspace`
- `vclaw-run`

## Compatibility Guidance

- Integrations should rely on the top-level envelope, not on human-readable stdout.
- Branch parsing on `command`, then parse `result`.
- Treat `metadata` as extensible and depend only on documented fields.
