#!/usr/bin/env python3
"""Minimal embedded DeerFlow bridge for Vclaw AgentOS."""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path
from typing import Any


def mode_settings(mode: str) -> dict[str, bool]:
    normalized = (mode or "ultra").strip().lower()
    if normalized == "flash":
        return {
            "thinking_enabled": False,
            "subagent_enabled": False,
            "plan_mode": False,
        }
    if normalized == "standard":
        return {
            "thinking_enabled": True,
            "subagent_enabled": False,
            "plan_mode": False,
        }
    if normalized == "pro":
        return {
            "thinking_enabled": True,
            "subagent_enabled": False,
            "plan_mode": True,
        }
    return {
        "thinking_enabled": True,
        "subagent_enabled": True,
        "plan_mode": True,
    }


def collect_response(client: Any, payload: dict[str, Any]) -> dict[str, Any]:
    text = ""
    artifacts: list[Any] = []

    settings = mode_settings(str(payload.get("mode") or "ultra"))
    stream = client.stream(
        payload["message"],
        thread_id=payload["threadId"],
        model_name=payload.get("modelName"),
        thinking_enabled=settings["thinking_enabled"],
        subagent_enabled=settings["subagent_enabled"],
        plan_mode=settings["plan_mode"],
    )

    for event in stream:
        if getattr(event, "type", None) == "messages-tuple":
            data = getattr(event, "data", {}) or {}
            if data.get("type") == "ai" and data.get("content"):
                text = str(data["content"])
        if getattr(event, "type", None) == "values":
            data = getattr(event, "data", {}) or {}
            if isinstance(data.get("artifacts"), list):
                artifacts = data["artifacts"]

    return {
        "ok": True,
        "threadId": payload["threadId"],
        "mode": payload.get("mode") or "ultra",
        "text": text,
        "artifacts": artifacts,
    }


def main() -> int:
    raw = sys.stdin.read()
    payload = json.loads(raw or "{}")

    backend_path = Path(payload.get("backendPath") or ".").resolve()
    if not (backend_path / "src" / "client.py").exists():
        raise FileNotFoundError(f"Invalid DeerFlow backend path: {backend_path}")

    sys.path.insert(0, str(backend_path))
    os.chdir(backend_path)
    logging.basicConfig(level=logging.WARNING, stream=sys.stderr)

    from src.client import DeerFlowClient  # type: ignore

    client = DeerFlowClient(
        config_path=payload.get("configPath"),
        model_name=payload.get("modelName"),
        **mode_settings(str(payload.get("mode") or "ultra")),
    )

    response = collect_response(client, payload)
    sys.stdout.write(json.dumps(response, ensure_ascii=False))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover - cross-runtime safeguard
        error = {
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}",
        }
        sys.stdout.write(json.dumps(error, ensure_ascii=False))
        sys.stdout.flush()
        raise
