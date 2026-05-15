from __future__ import annotations

import os

import pytest

from mcp_server.tools.analysis import analyze_stock
from mcp_server.tools.macro_anchor import get_macro_anchors
from mcp_server.tools.macro_info import get_macro_info
from mcp_server.tools.recommendation import recommend_stock
from mcp_server.tools.technical import get_technical_indicators


pytestmark = pytest.mark.skipif(
    os.getenv("RUN_REAL_MARKET_TESTS") != "1",
    reason="Set RUN_REAL_MARKET_TESTS=1 to run live Yahoo/RBA smoke tests.",
)


def test_technical_indicators_live_contract():
    result = get_technical_indicators("BHP", "3mo")
    assert result.symbol == "BHP.AX"
    assert result.error is None
    assert result.last_price is not None
    assert result.price_series


def test_macro_info_live_contract():
    result = get_macro_info()
    assert result.as_of_date
    assert result.rba_policy.data_source == "RBA A2 Table CSV"
    assert result.asx_market.asx200_level is not None


def test_macro_anchors_live_contract():
    result = get_macro_anchors()
    assert result.as_of_date
    assert result.risk_sentiment.vix_regime in {"LOW", "NORMAL", "ELEVATED", "EXTREME", "UNKNOWN"}
    assert result.summary


def test_analysis_live_contract():
    result = analyze_stock("CBA")
    assert result.symbol == "CBA.AX"
    assert -100 <= result.scores.combined_score <= 100


def test_recommendation_live_contract():
    result = recommend_stock("RIO")
    assert result.symbol == "RIO.AX"
    assert result.action in {"BUY", "SELL", "HOLD"}
    assert 0 <= result.confidence <= 100
