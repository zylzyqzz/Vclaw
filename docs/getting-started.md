# Vclaw AgentOS Getting Started

## 目标

在 5 分钟内跑通一个可解释的多角色 demo，并拿到机器可读 JSON。

## 前置条件

- Node 22+
- pnpm

## 1. 安装依赖

```bash
pnpm install
```

## 2. 快速健康检查

```bash
pnpm tsgo
pnpm exec vitest run test/agentos/*.test.ts
```

## 3. 跑第一个 demo

```bash
pnpm vclaw:agentos -- demo
```

你会看到:

- `routeSummary`
- `selectedRoles`
- `selectionReasons`
- `conclusion / plan / risks / acceptance`

## 4. 查看角色与预设

```bash
pnpm vclaw:agentos -- list-roles
pnpm vclaw:agentos -- list-presets
pnpm vclaw:agentos -- inspect-preset --id default-demo
```

## 5. 查看记忆写入

```bash
pnpm vclaw:agentos -- inspect-memory --session demo-main
```

## 6. 切换到机器可读输出

```bash
pnpm vclaw:agentos -- demo --json
pnpm vclaw:agentos -- run --goal "生成发布检查清单" --preset default-demo --json
```

JSON 契约文档见 `docs/cli-schema.md`。

## 下一步

- `docs/cli-usage.md`
- `docs/examples.md`
- `docs/architecture.md`
