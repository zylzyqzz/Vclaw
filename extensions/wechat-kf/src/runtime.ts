import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setWechatKfRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getWechatKfRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("WeChat KF runtime not initialized");
  }
  return runtime;
}
