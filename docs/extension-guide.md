# Vclaw AgentOS Extension Guide

这份指南只覆盖 AgentOS 角色、预设和路由扩展，不涉及私有资产或云端依赖。

## 扩展一个角色

### 创建角色

```bash
pnpm vclaw:agentos -- create-role \
  --id qa \
  --name "QA" \
  --description "Quality gate" \
  --goals "prevent regressions" \
  --system-instruction "Review output quality and edge cases" \
  --input-contract "task goal + constraints" \
  --output-contract "qa findings + risks + acceptance" \
  --capabilities qa,review \
  --memory-layers short-term,long-term \
  --memory-scopes session:*,entity:*
```

### 校验角色

```bash
pnpm vclaw:agentos -- validate-role --id qa
```

### 导出 / 导入角色

```bash
pnpm vclaw:agentos -- export-role --id qa --file /tmp/qa-role.json
pnpm vclaw:agentos -- import-role --file /tmp/qa-role.json --overwrite true
```

## 扩展一个 preset

### 创建 preset

```bash
pnpm vclaw:agentos -- create-preset \
  --id qa-gate \
  --name "QA Gate" \
  --roles planner,qa,reviewer \
  --order planner,qa,reviewer \
  --task-types qa,review
```

### 校验 preset

```bash
pnpm vclaw:agentos -- validate-preset --id qa-gate
```

## 调整路由策略

路由由 runtime config 的 `routing` 驱动，重点包括:

- `taskTypeRules`
- `capabilityKeywords`
- `weights`
- `maxDynamicRoles`

优先级固定为:

1. `run --roles`
2. `run --preset`
3. dynamic route

## 调试路由

```bash
pnpm vclaw:agentos -- run --goal "investigate failure" --task-type research --preset "" --json
```

重点观察:

- `routeSummary`
- `selectedRoles`
- `selectionReasons`

## 调试记忆

```bash
pnpm vclaw:agentos -- inspect-memory --session local-main
pnpm vclaw:agentos -- inspect-memory --session local-main --layer long-term --json
```

重点观察:

- `result.summary.total`
- `result.summary.byLayer`
- `result.records[*].scope`
