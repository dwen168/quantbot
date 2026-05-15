from __future__ import annotations

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

from mcp_server.tools.analysis import analyze_stock as analyze_stock_impl
from mcp_server.tools.macro_anchor import get_macro_anchors as get_macro_anchors_impl
from mcp_server.tools.macro_info import get_macro_info as get_macro_info_impl
from mcp_server.tools.recommendation import recommend_stock as recommend_stock_impl
from mcp_server.tools.technical import get_technical_indicators as get_technical_indicators_impl

load_dotenv()

mcp = FastMCP("QuantBot ASX")


@mcp.tool()
def get_technical_indicators(ticker: str, period: str = "2y") -> dict:
    """Fetch ASX OHLCV data and calculate technical indicators."""
    return get_technical_indicators_impl(ticker, period).model_dump()


@mcp.tool()
def get_macro_info() -> dict:
    """Return current macro and market context relevant to ASX stocks."""
    return get_macro_info_impl().model_dump()


@mcp.tool()
def get_macro_anchors() -> dict:
    """Return structural macro anchors for ASX investors."""
    return get_macro_anchors_impl().model_dump()


@mcp.tool()
def analyze_stock(ticker: str) -> dict:
    """Synthesize technical and macro data into a structured stock analysis."""
    return analyze_stock_impl(ticker).model_dump()


@mcp.tool()
def recommend_stock(ticker: str) -> dict:
    """Convert stock analysis into a buy, sell, or hold recommendation."""
    return recommend_stock_impl(ticker).model_dump()


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
