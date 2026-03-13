import type { WechatKfTarget } from "./types.js";

const CHANNEL_PREFIX_RE = /^wechat-kf:/i;
const OPEN_KF_RE = /open_kfid:([^|]+)\|external_userid:(.+)$/i;

function trimValue(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

export function formatWechatKfTarget(target: WechatKfTarget): string {
  return `open_kfid:${target.openKfId}|external_userid:${target.externalUserId}`;
}

export function stripWechatKfTargetPrefix(value: string): string {
  return value.trim().replace(CHANNEL_PREFIX_RE, "");
}

export function parseWechatKfTarget(value: string): WechatKfTarget | null {
  const normalized = stripWechatKfTargetPrefix(value);
  const match = OPEN_KF_RE.exec(normalized);
  if (!match) {
    return null;
  }
  const openKfId = trimValue(match[1]);
  const externalUserId = trimValue(match[2]);
  if (!openKfId || !externalUserId) {
    return null;
  }
  return { openKfId, externalUserId };
}

export function resolveWechatKfTarget(
  input: string | undefined | null,
  defaultOpenKfId?: string,
): WechatKfTarget | null {
  const trimmed = trimValue(input);
  if (!trimmed) {
    return null;
  }
  const explicit = parseWechatKfTarget(trimmed);
  if (explicit) {
    return explicit;
  }
  const externalUserId = stripWechatKfTargetPrefix(trimmed);
  const openKfId = trimValue(defaultOpenKfId);
  if (!externalUserId || !openKfId) {
    return null;
  }
  return { openKfId, externalUserId };
}

export function normalizeWechatKfAllowEntry(value: string): string {
  const parsed = parseWechatKfTarget(value);
  return parsed ? formatWechatKfTarget(parsed) : stripWechatKfTargetPrefix(value);
}
