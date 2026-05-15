from __future__ import annotations

import math

import pandas as pd

from mcp_server.data.yfinance_client import get_ohlcv, normalize_asx_ticker
from mcp_server.models.technical import (
    Momentum,
    MovingAverages,
    TechnicalCandle,
    TechnicalIndicators,
    Trend,
    Volatility,
    VolumeData,
)


def _clean(value):
    if value is None:
        return None
    try:
        if pd.isna(value) or math.isinf(float(value)):
            return None
        return round(float(value), 4)
    except Exception:
        return None


def _rsi(close: pd.Series, length: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / length, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / length, adjust=False).mean()
    rs = gain / loss.replace(0, pd.NA)
    return 100 - (100 / (1 + rs))


def _add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    data = df.copy()
    close = data["Close"]
    high = data["High"]
    low = data["Low"]
    volume = data["Volume"]

    data["SMA_20"] = close.rolling(20).mean()
    data["SMA_50"] = close.rolling(50).mean()
    data["SMA_200"] = close.rolling(200).mean()
    data["EMA_20"] = close.ewm(span=20, adjust=False).mean()
    data["EMA_50"] = close.ewm(span=50, adjust=False).mean()
    data["RSI_14"] = _rsi(close)

    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    data["MACD"] = ema12 - ema26
    data["MACD_SIGNAL"] = data["MACD"].ewm(span=9, adjust=False).mean()
    data["MACD_HIST"] = data["MACD"] - data["MACD_SIGNAL"]

    lowest_low = low.rolling(14).min()
    highest_high = high.rolling(14).max()
    data["STOCH_K"] = 100 * (close - lowest_low) / (highest_high - lowest_low)
    data["STOCH_D"] = data["STOCH_K"].rolling(3).mean()

    bb_mid = close.rolling(20).mean()
    bb_std = close.rolling(20).std()
    data["BB_MIDDLE"] = bb_mid
    data["BB_UPPER"] = bb_mid + (2 * bb_std)
    data["BB_LOWER"] = bb_mid - (2 * bb_std)
    data["BB_WIDTH"] = (data["BB_UPPER"] - data["BB_LOWER"]) / bb_mid

    prev_close = close.shift(1)
    tr = pd.concat([(high - low), (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
    data["ATR_14"] = tr.rolling(14).mean()

    plus_dm = (high.diff()).where((high.diff() > -low.diff()) & (high.diff() > 0), 0.0)
    minus_dm = (-low.diff()).where((-low.diff() > high.diff()) & (-low.diff() > 0), 0.0)
    atr = tr.rolling(14).sum()
    data["PLUS_DI"] = 100 * plus_dm.rolling(14).sum() / atr
    data["MINUS_DI"] = 100 * minus_dm.rolling(14).sum() / atr
    dx = 100 * (data["PLUS_DI"] - data["MINUS_DI"]).abs() / (data["PLUS_DI"] + data["MINUS_DI"])
    data["ADX_14"] = dx.rolling(14).mean()

    direction = close.diff().apply(lambda value: 1 if value > 0 else (-1 if value < 0 else 0))
    data["OBV"] = (direction * volume.fillna(0)).cumsum()
    data["VOLUME_SMA_20"] = volume.rolling(20).mean()
    data["VOLUME_RATIO"] = volume / data["VOLUME_SMA_20"]
    return data


def _signals(latest: pd.Series) -> list[str]:
    signals: list[str] = []
    close = _clean(latest.get("Close"))
    rsi = _clean(latest.get("RSI_14"))
    sma200 = _clean(latest.get("SMA_200"))
    macd = _clean(latest.get("MACD"))
    macd_signal = _clean(latest.get("MACD_SIGNAL"))
    plus_di = _clean(latest.get("PLUS_DI"))
    minus_di = _clean(latest.get("MINUS_DI"))
    volume_ratio = _clean(latest.get("VOLUME_RATIO"))

    if rsi is not None:
        if rsi < 30:
            signals.append("RSI oversold (<30)")
        elif rsi > 70:
            signals.append("RSI overbought (>70)")
        else:
            signals.append("RSI neutral")
    if close is not None and sma200 is not None:
        signals.append("Price above SMA200 - bullish" if close > sma200 else "Price below SMA200 - bearish")
    if macd is not None and macd_signal is not None:
        signals.append("MACD above signal - bullish" if macd > macd_signal else "MACD below signal - bearish")
    if plus_di is not None and minus_di is not None:
        signals.append("+DI above -DI - uptrend pressure" if plus_di > minus_di else "-DI above +DI - downtrend pressure")
    if volume_ratio is not None and volume_ratio > 1.5:
        signals.append("Volume is elevated versus 20-day average")
    return signals


def get_technical_indicators(ticker: str, period: str = "2y") -> TechnicalIndicators:
    symbol = normalize_asx_ticker(ticker)
    try:
        df = _add_indicators(get_ohlcv(symbol, period))
        latest = df.dropna(how="all").iloc[-1]
        first_close = df["Close"].dropna().iloc[0]
        last_price = _clean(latest.get("Close"))
        price_change_pct = _clean(((last_price - first_close) / first_close) * 100) if last_price else None

        trend_signal = "SIDEWAYS"
        if _clean(latest.get("PLUS_DI")) is not None and _clean(latest.get("MINUS_DI")) is not None:
            adx = _clean(latest.get("ADX_14")) or 0
            if adx >= 20 and latest.get("PLUS_DI") > latest.get("MINUS_DI"):
                trend_signal = "UPTREND"
            elif adx >= 20 and latest.get("MINUS_DI") > latest.get("PLUS_DI"):
                trend_signal = "DOWNTREND"

        candles = [
            TechnicalCandle(
                time=index.date().isoformat(),
                open=_clean(row.get("Open")),
                high=_clean(row.get("High")),
                low=_clean(row.get("Low")),
                close=_clean(row.get("Close")),
                volume=_clean(row.get("Volume")),
                sma_20=_clean(row.get("SMA_20")),
                sma_50=_clean(row.get("SMA_50")),
                macd=_clean(row.get("MACD")),
                macd_signal=_clean(row.get("MACD_SIGNAL")),
                macd_histogram=_clean(row.get("MACD_HIST")),
            )
            for index, row in df.tail(520).iterrows()
        ]

        return TechnicalIndicators(
            symbol=symbol,
            period=period,
            last_price=last_price,
            price_change_pct=price_change_pct,
            moving_averages=MovingAverages(
                sma_20=_clean(latest.get("SMA_20")),
                sma_50=_clean(latest.get("SMA_50")),
                sma_200=_clean(latest.get("SMA_200")),
                ema_20=_clean(latest.get("EMA_20")),
                ema_50=_clean(latest.get("EMA_50")),
            ),
            momentum=Momentum(
                rsi_14=_clean(latest.get("RSI_14")),
                macd=_clean(latest.get("MACD")),
                macd_signal=_clean(latest.get("MACD_SIGNAL")),
                macd_histogram=_clean(latest.get("MACD_HIST")),
                stoch_k=_clean(latest.get("STOCH_K")),
                stoch_d=_clean(latest.get("STOCH_D")),
            ),
            volatility=Volatility(
                bb_upper=_clean(latest.get("BB_UPPER")),
                bb_middle=_clean(latest.get("BB_MIDDLE")),
                bb_lower=_clean(latest.get("BB_LOWER")),
                bb_width=_clean(latest.get("BB_WIDTH")),
                atr_14=_clean(latest.get("ATR_14")),
            ),
            trend=Trend(
                adx_14=_clean(latest.get("ADX_14")),
                plus_di=_clean(latest.get("PLUS_DI")),
                minus_di=_clean(latest.get("MINUS_DI")),
                trend_signal=trend_signal,
            ),
            volume=VolumeData(
                obv=_clean(latest.get("OBV")),
                volume_sma_20=_clean(latest.get("VOLUME_SMA_20")),
                volume_ratio=_clean(latest.get("VOLUME_RATIO")),
            ),
            signals=_signals(latest),
            price_series=candles,
        )
    except Exception as exc:
        return TechnicalIndicators(symbol=symbol, period=period, error=str(exc))
