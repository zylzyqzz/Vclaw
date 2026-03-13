import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { wechatKfDock, wechatKfPlugin } from "./src/channel.js";
import { setWechatKfRuntime } from "./src/runtime.js";

const plugin = {
  id: "wechat-kf",
  name: "WeChat KF",
  description: "Vclaw WeChat KF (Enterprise WeChat customer service) channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setWechatKfRuntime(api.runtime);
    api.registerChannel({ plugin: wechatKfPlugin, dock: wechatKfDock });
  },
};

export default plugin;
