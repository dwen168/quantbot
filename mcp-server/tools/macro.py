import requests
import sys
import os

# Add the parent directory to sys.path to allow absolute imports when running main.py
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from config import FRED_API_KEY
except ImportError:
    FRED_API_KEY = ""

def get_macro_context():
    """
    Fetch macro economic indicators relevant to ASX (e.g., Cash Rate, Inflation, AUD/USD).
    """
    # Example using FRED (needs API Key)
    # Real implementation would fetch from RBA/ABS if possible or FRED as proxy
    indicators = {
        "cash_rate": "4.35% (RBA)",
        "inflation_cpi": "3.6% (ABS)",
        "gdp_growth": "1.5% (YoY)",
        "unemployment_rate": "3.8%",
        "aud_usd": "0.66"
    }
    
    # In a real scenario, we'd hit FRED:
    # if FRED_API_KEY:
    #    # Fetch series like 'AUSCPIALLQINMEI'
    #    pass
    
    return indicators

def get_macro_anchors():
    """
    Returns 'Macro Anchors' - fixed structural themes (e.g., Energy Transition, Aging Population).
    """
    anchors = [
        {"theme": "Energy Transition", "impact": "Positive for Lithium/Copper miners (PLS, LYC)"},
        {"theme": "Aging Population", "impact": "Positive for Healthcare/Aged Care (CSL, RHC)"},
        {"theme": "Higher Interest Rates", "impact": "Beneficial for Banks (CBA, NAB) but negative for REITs"},
        {"theme": "China Reopening/Growth", "impact": "Crucial for Iron Ore (BHP, RIO, FMG)"}
    ]
    return anchors
