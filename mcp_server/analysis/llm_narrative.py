from __future__ import annotations

import os
import subprocess
import time
from typing import Any

import httpx

from .trace_logger import log_llm_performance


_MODEL_CACHE: str | None = None

def _get_available_ollama_models() -> list[str]:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    try:
        response = httpx.get(f"{base_url}/api/tags", timeout=3)
        if response.status_code == 200:
            return [m["name"] for m in response.json().get("models", [])]
    except Exception:
        pass
    return []

def _ollama_model() -> str:
    global _MODEL_CACHE
    if _MODEL_CACHE:
        return _MODEL_CACHE

    env_model = os.getenv("OLLAMA_MODEL")
    available_models = _get_available_ollama_models()
    
    # 1. If environment variable model is explicitly set and available, use it
    if env_model and any(env_model in m for m in available_models):
        _MODEL_CACHE = env_model
        return _MODEL_CACHE
        
    # 2. Priority list of reliable models known to be functional on this machine
    priorities = ["gemma4:e4b", "llama3.1:8b", "gemma3:4b", "qwen3.5:9b"]
    for p in priorities:
        # Check for exact match or versioned match
        for m in available_models:
            if m == p or m.startswith(f"{p}:") or p.startswith(f"{m}:"):
                _MODEL_CACHE = m
                return _MODEL_CACHE
                
    # 3. Last resort: first model in the list
    if available_models:
        _MODEL_CACHE = available_models[0]
        return _MODEL_CACHE
    
    _MODEL_CACHE = env_model or "gemma3:4b"
    return _MODEL_CACHE


def _ollama(prompt: str, model: str | None = None) -> str | None:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    
    # If a specific model is requested, try ONLY that model first
    # If no model requested, use the best one we can find
    models_to_try = [model] if model else []
    if not model:
        models_to_try.append(_ollama_model())
        
    # Also add fallbacks from our priority list if the primary one fails
    priorities = ["gemma4:e4b", "llama3.1:8b", "gemma3:4b", "qwen3.5:9b"]
    for p in priorities:
        if p not in models_to_try:
            models_to_try.append(p)

    available_models = _get_available_ollama_models()
    
    for target_model in models_to_try:
        if not target_model: continue
        
        # Verify model exists before trying
        if not any(target_model in m for m in available_models) and target_model not in priorities:
            continue

        start_time = time.time()
        try:
            response = httpx.post(
                f"{base_url}/api/chat",
                json={
                    "model": target_model,
                    "messages": [
                        {"role": "system", "content": "Write concise ASX stock analysis. No financial advice disclaimer."},
                        {"role": "user", "content": prompt},
                    ],
                    "stream": False,
                },
                timeout=30,
            )
            duration = (time.time() - start_time) * 1000
            if response.status_code == 200:
                log_llm_performance(target_model, duration, prompt, source="mcp-ollama")
                return response.json().get("message", {}).get("content")
            
            error_data = response.json() if response.headers.get("Content-Type") == "application/json" else {"error": response.text}
            print(f"Ollama error ({target_model}): {error_data.get('error')}", file=os.sys.stderr)
            
            log_llm_performance(target_model, duration, f"FAILED (HTTP {response.status_code}): {error_data.get('error')} | Prompt: {prompt}", source="mcp-ollama")
            
            # If the error is about loading the model, try the next one
            if "unable to load model" in str(error_data.get("error")).lower():
                continue
            else:
                # For other errors (like prompt too long), we might still want to try fallbacks
                continue
                
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            print(f"Ollama connection error ({target_model}): {e}", file=os.sys.stderr)
            log_llm_performance(target_model, duration, f"ERROR: {str(e)} | Prompt: {prompt}", source="mcp-ollama")
            continue
            
    return None



def map_gemini_model(model: str | None) -> str:
    mapping = {
        "Gemini 2.5 Flash-Lite": "gemini-2.5-flash-lite",
        "Gemma 4": "gemma-4-31b-it"
    }
    if not model:
        return os.getenv("GOOGLE_MODEL", "gemini-2.5-flash-lite")
    return mapping.get(model, model)


def _gemini(prompt: str, model: str | None = None) -> str | None:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    
    primary_model = model or os.getenv("GOOGLE_MODEL", "Gemini 2.5 Flash-Lite")
    online_models = ["Gemini 2.5 Flash-Lite", "Gemma 4"]
    models_to_try = [primary_model] + [m for m in online_models if m != primary_model]

    for current_model in models_to_try:
        target_model_id = map_gemini_model(current_model)
        for i in range(3): # 3 retries
            start_time = time.time()
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model_id}:generateContent?key={api_key}"
                response = httpx.post(
                    url,
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "systemInstruction": {"parts": [{"text": "Write concise ASX stock analysis. No financial advice disclaimer."}]}
                    },
                    timeout=30,
                )
                duration = (time.time() - start_time) * 1000
                
                if response.status_code == 503 or response.status_code == 429:
                    if i < 2:
                        time.sleep(1 * (2 ** i))
                        continue

                response.raise_for_status()
                candidates = response.json().get("candidates", [])
                if candidates:
                    text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text")
                    log_llm_performance(target_model_id, duration, prompt, source="mcp-gemini")
                    return text
                
                log_llm_performance(target_model_id, duration, f"FAILED (No candidates) | Prompt: {prompt}", source="mcp-gemini")
                break # Not a transient error, stop retrying this model
            except Exception as e:
                duration = (time.time() - start_time) * 1000
                if i < 2:
                    time.sleep(1 * (2 ** i))
                    continue
                else:
                    print(f"Gemini error ({target_model_id}): {e}", file=os.sys.stderr)
                    log_llm_performance(target_model_id, duration, f"ERROR: {str(e)} | Prompt: {prompt}", source="mcp-gemini")
                    break
    return None


def generate_narrative(prompt: str, model: str | None = None, provider: str | None = None) -> str | None:
    """
    Main entry point for generating AI narratives.
    Prioritizes the explicitly requested provider if available.
    """
    # Normalize provider string
    p = (provider or "").lower()
    
    # 1. Attempt the requested provider
    if p == "ollama":
        res = _ollama(prompt, model=model)
        if res: return res
    elif p == "gemini":
        res = _gemini(prompt, model=model)
        if res: return res

    # 2. If requested provider failed or none requested, try fallbacks in order of cost/locality
    return (
        _ollama(prompt, model=model) or 
        _gemini(prompt, model=model)
    )
