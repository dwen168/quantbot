from __future__ import annotations

import os
import subprocess
from typing import Any

import httpx


def _ollama_model() -> str:
    preferred = os.getenv("OLLAMA_MODEL", "gemma4:e4b")
    try:
        result = subprocess.run(["ollama", "list"], capture_output=True, text=True, timeout=3, check=False)
        if "gemma4:e4b" in result.stdout:
            return "gemma4:e4b"
    except Exception:
        pass
    return preferred


def _ollama(prompt: str, model: str | None = None) -> str | None:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    try:
        response = httpx.post(
            f"{base_url}/api/chat",
            json={
                "model": model or _ollama_model(),
                "messages": [
                    {"role": "system", "content": "Write concise ASX stock analysis. No financial advice disclaimer."},
                    {"role": "user", "content": prompt},
                ],
                "stream": False,
            },
            timeout=10,
        )
        response.raise_for_status()
        return response.json().get("message", {}).get("content")
    except Exception:
        return None


def _openai(prompt: str) -> str | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        response = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 220,
            },
            timeout=15,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except Exception:
        return None


def _anthropic(prompt: str) -> str | None:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        response = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            json={
                "model": os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest"),
                "max_tokens": 220,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=15,
        )
        response.raise_for_status()
        content: list[dict[str, Any]] = response.json().get("content", [])
        return "".join(block.get("text", "") for block in content if block.get("type") == "text") or None
    except Exception:
        return None


def generate_narrative(prompt: str, model: str | None = None) -> str | None:
    return _ollama(prompt, model=model) or _openai(prompt) or _anthropic(prompt)
