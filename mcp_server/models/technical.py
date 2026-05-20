from __future__ import annotations

from pydantic import BaseModel, Field


class MovingAverages(BaseModel):
    sma_20: float | None = None
    sma_50: float | None = None
    sma_200: float | None = None
    ema_20: float | None = None
    ema_50: float | None = None


class Momentum(BaseModel):
    rsi_14: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    macd_histogram: float | None = None
    stoch_k: float | None = None
    stoch_d: float | None = None


class Volatility(BaseModel):
    bb_upper: float | None = None
    bb_middle: float | None = None
    bb_lower: float | None = None
    bb_width: float | None = None
    atr_14: float | None = None


class Trend(BaseModel):
    adx_14: float | None = None
    plus_di: float | None = None
    minus_di: float | None = None
    trend_signal: str = "SIDEWAYS"


class VolumeData(BaseModel):
    obv: float | None = None
    volume_sma_20: float | None = None
    volume_ratio: float | None = None


class TechnicalCandle(BaseModel):
    time: str
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float | None = None
    volume: float | None = None
    sma_20: float | None = None
    sma_50: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    macd_histogram: float | None = None


class TechnicalIndicators(BaseModel):
    symbol: str
    period: str
    last_price: float | None = None
    price_change_pct: float | None = None
    moving_averages: MovingAverages = Field(default_factory=MovingAverages)
    momentum: Momentum = Field(default_factory=Momentum)
    volatility: Volatility = Field(default_factory=Volatility)
    trend: Trend = Field(default_factory=Trend)
    volume: VolumeData = Field(default_factory=VolumeData)
    signals: list[str] = Field(default_factory=list)
    price_series: list[TechnicalCandle] = Field(default_factory=list)
    is_mock: bool = False
    error: str | None = None
