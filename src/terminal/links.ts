import { formatTerminalLink } from "../utils.js";

export const DOCS_ROOT = "https://docs.vclaw.ai";
export const DOCS_LABEL_ROOT = "https://docs.vclaw.ai";

function normalizeDocsLabel(label: string): string {
  return label
    .replace(/docs\.openclaw\.ai/gi, "docs.vclaw.ai")
    .replace(/WeiClaw/g, "Vclaw")
    .replace(/weiclaw/g, "vclaw")
    .replace(/OpenClaw/g, "Vclaw")
    .replace(/openclaw/g, "vclaw");
}

export function formatDocsLink(
  path: string,
  label?: string,
  opts?: { fallback?: string; force?: boolean },
): string {
  const trimmed = path.trim();
  const url = trimmed.startsWith("http")
    ? trimmed
    : `${DOCS_ROOT}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
  return formatTerminalLink(normalizeDocsLabel(label ?? url), url, {
    fallback: opts?.fallback ?? url,
    force: opts?.force,
  });
}

export function formatDocsRootLink(label?: string): string {
  return formatTerminalLink(normalizeDocsLabel(label ?? DOCS_LABEL_ROOT), DOCS_ROOT, {
    fallback: DOCS_ROOT,
  });
}

