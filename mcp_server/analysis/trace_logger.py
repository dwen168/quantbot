import datetime
import os

def log_llm_performance(model: str, duration: float, prompt: str, source: str = "mcp"):
    """
    Logs LLM performance to quantbot.log in the root directory.
    duration is in milliseconds.
    """
    # Find project root (assuming we are in mcp_server/analysis/)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    log_file = os.path.join(current_dir, "../../", "quantbot.log")
    
    timestamp = datetime.datetime.now().isoformat()
    
    log_entry = (
        f"[{timestamp}] [{source}] Model: {model} | Duration: {duration:.2f}ms\n"
        f"Input: {prompt}\n"
        f"{'-' * 40}\n"
    )
    
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(log_entry)
    except Exception as e:
        print(f"Failed to write to quantbot.log: {e}", file=os.sys.stderr)
