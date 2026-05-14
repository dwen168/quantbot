import os
from dotenv import load_dotenv

load_dotenv()

# API Keys (to be filled by user or in .env)
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
FRED_API_KEY = os.getenv("FRED_API_KEY", "")
FMP_API_KEY = os.getenv("FMP_API_KEY", "")

# Cache settings
CACHE_EXPIRE_SECONDS = 3600
