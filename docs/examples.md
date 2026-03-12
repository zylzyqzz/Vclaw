# Vclaw AgentOS Examples

## Recommended Demo Set

```bash
pnpm vclaw:agentos -- demo
pnpm vclaw:agentos -- demo --json
pnpm vclaw:agentos -- run --goal "investigate release risks" --task-type review --required-capabilities review --preset "" --json
pnpm vclaw:agentos -- inspect-memory --session demo-main --json
```

这组命令可以在 2 到 3 分钟内快速展示:

- 动态角色不是固定硬编码
- 路由解释同时支持人类阅读和机器解析
- memory 会在执行后留下可检查记录

## Sample Tasks

### 发布规划

```bash
pnpm vclaw:agentos -- run --goal "完成 v2.1.0 正式版发布规划" --preset default-demo
```

预期:

- `planner` 和 `commander` 输出结构化结论与计划

### 代码实现与评审

```bash
pnpm vclaw:agentos -- run --goal "实现并评审一条新的 CLI 路由" --roles builder,reviewer
```

预期:

- `builder` 给出实现路径
- `reviewer` 给出风险和验收点

### 动态路由

```bash
pnpm vclaw:agentos -- run --goal "调查异常并给出修复方案" --task-type research --required-capabilities research,review --preset ""
```

预期:

- 输出 `selectedRoles`
- 输出 `selectionReasons`

### 记忆观察

```bash
pnpm vclaw:agentos -- demo
pnpm vclaw:agentos -- inspect-memory --session demo-main
pnpm vclaw:agentos -- inspect-memory --session demo-main --layer long-term
```

### JSON Smoke Test

```bash
pnpm vclaw:agentos -- demo --json
pnpm vclaw:agentos -- validate-preset --id default-demo --json
```

预期:

- 顶层结构统一为 `ok/command/version/result/error/metadata`
