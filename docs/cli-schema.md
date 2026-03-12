# Vclaw AgentOS CLI JSON Schema

`Vclaw AgentOS` 的核心命令支持 `--json`，输出统一 envelope，方便外部系统稳定解析。

## Top-level Envelope

```json
{
  "ok": true,
  "command": "run",
  "version": "2.1.0-rc.1",
  "routeSummary": "dynamic capability route",
  "selectedRoles": ["planner", "reviewer"],
  "selectionReasons": ["priority: dynamic route (fallback)"],
  "result": {},
  "lintFindings": [],
  "error": null,
  "metadata": {
    "generatedAt": "2026-03-12T00:00:00.000Z"
  }
}
```

稳定字段:

- `ok: boolean`
- `command: string`
- `version: string`
- `result: unknown`
- `error?: { code: string; message: string; details?: unknown }`
- `metadata: Record<string, unknown>`

路由相关字段:

- `routeSummary?: string`
- `selectedRoles?: string[]`
- `selectionReasons?: string[]`

校验相关字段:

- `lintFindings?: Array<{ level: "error" | "warning"; code: string; message: string; target: string }>`

## Error Envelope

```json
{
  "ok": false,
  "command": "validate-preset",
  "version": "2.1.0-rc.1",
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "preset validation failed",
    "details": {
      "valid": false,
      "findings": []
    }
  },
  "metadata": {
    "generatedAt": "2026-03-12T00:00:00.000Z",
    "exitCode": 2
  }
}
```

## Exit Code Contract

- `0`: 成功
- `1`: 参数错误 / 未知命令 / 非预期错误
- `2`: 校验失败
- `3`: 资源不存在或冲突

## Result Shapes

### `run` / `demo`

`result` 推荐包含:

- `requestId: string`
- `sessionId: string`
- `routeSummary: string`
- `selectedRoles: string[]`
- `selectionReasons: string[]`
- `conclusion: string`
- `plan: string[]`
- `risks: string[]`
- `acceptance: string[]`
- `roleOutputs: Array<{ roleId: string; output: string }>`

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

## Supported JSON Commands

- `demo`
- `run`
- `validate-role`
- `validate-preset`
- `inspect-role`
- `inspect-preset`
- `list-roles`
- `list-agents` 是 `list-roles` 的兼容别名
- `list-presets`
- `inspect-memory`

## Compatibility Guidance

- 集成方优先依赖顶层 envelope，而不是人类可读文本。
- 建议以 `command` 分支解析 `result`。
- `metadata` 允许扩展；集成方只依赖已文档化字段。
