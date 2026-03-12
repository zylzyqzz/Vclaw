function isEnabled(value: string | undefined): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function shouldBuildA2ui(env: NodeJS.ProcessEnv = process.env): boolean {
  return isEnabled(env.WEICLAW_BUILD_UI) || isEnabled(env.OPENCLAW_BUILD_UI);
}

export function shouldSkipMissingA2uiAssets(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isEnabled(env.OPENCLAW_A2UI_SKIP_MISSING)) {
    return true;
  }
  return !shouldBuildA2ui(env);
}
