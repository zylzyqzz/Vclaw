import type { AuthChoice, OnboardOptions } from "./onboard-types.js";

type OnboardProviderAuthOptionKey = keyof Pick<OnboardOptions, "openaiApiKey" | "litellmApiKey">;

export type OnboardProviderAuthFlag = {
  optionKey: OnboardProviderAuthOptionKey;
  authChoice: AuthChoice;
  cliFlag: `--${string}`;
  cliOption: `--${string} <key>`;
  description: string;
};

// Keep onboarding defaults focused on OpenAI-compatible routes.
export const ONBOARD_PROVIDER_AUTH_FLAGS: ReadonlyArray<OnboardProviderAuthFlag> = [
  {
    optionKey: "openaiApiKey",
    authChoice: "openai-api-key",
    cliFlag: "--openai-api-key",
    cliOption: "--openai-api-key <key>",
    description: "OpenAI API key",
  },
  {
    optionKey: "litellmApiKey",
    authChoice: "litellm-api-key",
    cliFlag: "--litellm-api-key",
    cliOption: "--litellm-api-key <key>",
    description: "LiteLLM API key",
  },
];
