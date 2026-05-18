from __future__ import annotations

import os
import subprocess
from typing import Any

import httpx


_MODEL_CACHE: str | None = None

def _ollama_model() -> str:
    global _MODEL_CACHE
    if _MODEL_CACHE:
        return _MODEL_CACHE

    env_model = os.getenv("OLLAMA_MODEL")
    try:
        # Get list of available models
        result = subprocess.run(["ollama", "list"], capture_output=True, text=True, timeout=3, check=False)
        available_models = result.stdout
        
        # 1. If environment variable model is explicitly set and available, use it
        if env_model and env_model in available_models:
            _MODEL_CACHE = env_model
            return _MODEL_CACHE
            
        # 2. Priority list of reliable models known to be functional on this machine
        priorities = ["llama3.1:8b", "gemma3:4b", "qwen3.5:9b"]
        for m in priorities:
            if m in available_models:
                _MODEL_CACHE = m
                return _MODEL_CACHE
                
        # 3. Fallback to gemma4:e4b if nothing else
        if "gemma4:e4b" in available_models:
            _MODEL_CACHE = "gemma4:e4b"
            return _MODEL_CACHE
            
        # 4. Last resort: first model in the list (skip header)
        lines = available_models.strip().split("\n")
        if len(lines) > 1:
            _MODEL_CACHE = lines[1].split()[0]
            return _MODEL_CACHE
    except Exception:
        pass
    
    _MODEL_CACHE = env_model or "gemma3:4b"
    return _MODEL_CACHE


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
            timeout=30,
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
            timeout=30,
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
            timeout=30,
        )
        response.raise_for_status()
        content: list[dict[str, Any]] = response.json().get("content", [])
        return "".join(block.get("text", "") for block in content if block.get("type") == "text") or None
    except Exception:
        return None


def generate_narrative(prompt: str, model: str | None = None) -> str | None:
    return _ollama(prompt, model=model) or _openai(prompt) or _anthropic(prompt)
