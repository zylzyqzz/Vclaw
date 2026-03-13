---
summary: "Connect Vclaw to Enterprise WeChat customer service (企微客服)"
read_when:
  - You want Vclaw to reply from Enterprise WeChat customer service
  - You need the official callback + sync_msg setup path
title: "WeChat KF"
---

# WeChat KF

`wechat-kf` is the official Enterprise WeChat customer service channel path for Vclaw.

This version is intentionally text-first and stable-first:

- callback verification via the official encrypted webhook
- `sync_msg` pulls inbound customer messages
- replies go out through `send_msg`
- media falls back to plain links for now

## What you need

1. A configured Enterprise WeChat customer service account
2. `corpId`
3. `corpSecret`
4. callback `token`
5. `encodingAesKey`
6. one `open_kfid`
7. a public HTTPS callback URL that points to your Vclaw Gateway

## Install

From this repo checkout:

```bash
vclaw plugins install ./extensions/wechat-kf
```

## Fast CLI setup

```bash
vclaw channels add --channel wechat-kf --corp-id wx1234567890 --corp-secret "$WECOM_KF_SECRET" --token "$WECOM_KF_CALLBACK_TOKEN" --encoding-aes-key "$WECOM_KF_AES_KEY" --default-open-kf-id wkf_xxxxxxxxxxxxx --webhook-path /plugins/wechat-kf/default
```

## Minimal config

```json5
{
  channels: {
    "wechat-kf": {
      enabled: true,
      corpId: "wx1234567890",
      corpSecret: "${WECOM_KF_SECRET}",
      token: "${WECOM_KF_CALLBACK_TOKEN}",
      encodingAesKey: "${WECOM_KF_AES_KEY}",
      webhookPath: "/plugins/wechat-kf/default",
      defaultOpenKfId: "wkf_xxxxxxxxxxxxx",
      dmPolicy: "pairing"
    }
  }
}
```

## Callback settings in Enterprise WeChat

Point the customer-service callback URL to:

```text
https://your-domain.example.com/plugins/wechat-kf/default
```

Use the same `token` and `encodingAesKey` values you put in Vclaw config.

## Start

```bash
vclaw gateway restart
vclaw channels status --probe
```

When the callback is healthy, Vclaw will:

1. verify and decrypt the callback
2. read the callback `Token`
3. call `kf/sync_msg`
4. dispatch the customer message into the normal Vclaw reply pipeline
5. answer with `kf/send_msg`

## Target syntax

Manual sends use:

```text
open_kfid:<OPEN_KFID>|external_userid:<EXTERNAL_USERID>
```

If `defaultOpenKfId` is configured, a bare `external_userid` also works for direct sends.

## Current limits

- text is the primary supported reply type
- media currently degrades to links
- callback URL must be reachable from Enterprise WeChat
- the default inbound origin filter is `[3]`; if your tenant reports customer messages with a
  different `origin`, adjust `channels.wechat-kf.inboundOrigins`
