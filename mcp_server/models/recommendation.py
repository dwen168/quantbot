from __future__ import annotations

from pydantic import BaseModel, Field


class AnalysisScores(BaseModel):
    technical_score: int
    macro_score: int
    combined_score: int
    signal_count_bullish: int
    signal_count_bearish: int


class KeyLevels(BaseModel):
    support: float | None = None
    resistance: float | None = None
    stop_loss_suggestion: float | None = None


class TechnicalAssessment(BaseModel):
    overall: str
    trend_signal: str
    momentum_signal: str
    volatility_signal: str
    volume_signal: str
    key_levels: KeyLevels = Field(default_factory=KeyLevels)


class MacroAssessment(BaseModel):
    overall: str
    rates_headwind: bool
    china_tailwind: bool
    commodity_tailwind: bool
    risk_sentiment: str


class SignalFactor(BaseModel):
    factor: str
    score: int

class StockAnalysis(BaseModel):
    symbol: str
    company_name: str
    sector: str | None = None
    analysis_date: str
    scores: AnalysisScores
    technical_assessment: TechnicalAssessment
    macro_assessment: MacroAssessment
    bullish_signals: list[SignalFactor] = Field(default_factory=list)
    bearish_signals: list[SignalFactor] = Field(default_factory=list)
    risk_factors: list[SignalFactor] = Field(default_factory=list)
    narrative: str | None = None


class PriceGuidance(BaseModel):
    current_price: float | None = None
    entry_range_low: float | None = None
    entry_range_high: float | None = None
    stop_loss: float | None = None
    target_price: float | None = None
    upside_pct: float | None = None
    downside_risk_pct: float | None = None


class Recommendation(BaseModel):
    symbol: str
    company_name: str
    recommendation_date: str
    action: str
    confidence: int
    time_horizon: str
    risk_level: str
    price_guidance: PriceGuidance
    key_reasons: list[SignalFactor] = Field(default_factory=list)
    key_risks: list[SignalFactor] = Field(default_factory=list)
    underlying_analysis: StockAnalysis
    narrative: str | None = None
