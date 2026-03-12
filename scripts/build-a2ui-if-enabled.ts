import { bundleA2ui } from "./build-a2ui.mjs";
import { shouldBuildA2ui } from "../src/scripts/build-a2ui-gating.ts";

if (shouldBuildA2ui()) {
  bundleA2ui().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
} else {
  console.log("Skipping optional A2UI bundle for WeiClaw default build. Set WEICLAW_BUILD_UI=1 to enable.");
}
