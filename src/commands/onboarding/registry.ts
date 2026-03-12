import { listChannelPlugins } from "../../channels/plugins/index.js";
import { telegramOnboardingAdapter } from "../../channels/plugins/onboarding/telegram.js";
import { isTruthyEnvValue } from "../../infra/env.js";
import type { ChannelChoice } from "../onboard-types.js";
import type { ChannelOnboardingAdapter } from "./types.js";

const BUILTIN_ONBOARDING_ADAPTERS: ChannelOnboardingAdapter[] = [
  telegramOnboardingAdapter,
];

function shouldExposeOnboardingChannel(channel: ChannelChoice): boolean {
  if (
    isTruthyEnvValue(process.env.WEICLAW_ENABLE_ALL_CHANNELS) ||
    isTruthyEnvValue(process.env.OPENCLAW_ENABLE_ALL_CHANNELS)
  ) {
    return true;
  }
  return channel === "telegram";
}

const CHANNEL_ONBOARDING_ADAPTERS = () => {
  const fromRegistry = listChannelPlugins()
    .map((plugin) => (plugin.onboarding ? ([plugin.id, plugin.onboarding] as const) : null))
    .filter((entry) => (entry ? shouldExposeOnboardingChannel(entry[0]) : false))
    .filter((entry): entry is readonly [ChannelChoice, ChannelOnboardingAdapter] => Boolean(entry));

  // Fall back to built-in adapters to keep onboarding working even when the plugin registry
  // fails to populate (see #25545).
  const fromBuiltins = BUILTIN_ONBOARDING_ADAPTERS.map(
    (adapter) => [adapter.channel, adapter] as const,
  ).filter((entry) => shouldExposeOnboardingChannel(entry[0]));

  return new Map<ChannelChoice, ChannelOnboardingAdapter>([...fromBuiltins, ...fromRegistry]);
};

export function getChannelOnboardingAdapter(
  channel: ChannelChoice,
): ChannelOnboardingAdapter | undefined {
  return CHANNEL_ONBOARDING_ADAPTERS().get(channel);
}

export function listChannelOnboardingAdapters(): ChannelOnboardingAdapter[] {
  return Array.from(CHANNEL_ONBOARDING_ADAPTERS().values());
}

// Legacy aliases (pre-rename).
export const getProviderOnboardingAdapter = getChannelOnboardingAdapter;
export const listProviderOnboardingAdapters = listChannelOnboardingAdapters;
