from __future__ import annotations

from pydantic import BaseModel, Field


class RBAPolicy(BaseModel):
    cash_rate: float | None = None
    rate_direction: str = "UNKNOWN"
    last_change_date: str | None = None
    last_change_bps: int | None = None
    data_source: str = "RBA A2 Table CSV"


class SectorPerf(BaseModel):
    code: str
    name: str
    one_d_pct: float | None = None


class ASXMarket(BaseModel):
    asx200_level: float | None = None
    asx200_1d_change: float | None = None
    asx200_1mo_change: float | None = None
    asx200_ytd_change: float | None = None
    top_sectors: list[SectorPerf] = Field(default_factory=list)


class Currencies(BaseModel):
    aud_usd: float | None = None
    aud_cny: float | None = None
    aud_usd_1mo_change: float | None = None


class Commodities(BaseModel):
    iron_ore_etf_proxy: float | None = None
    gold_usd: float | None = None
    crude_oil_usd: float | None = None
    copper_usd: float | None = None
    coal_proxy_ticker: float | None = None


class GlobalIndices(BaseModel):
    sp500_1d_change: float | None = None
    nasdaq_1d_change: float | None = None
    shanghai_1d_change: float | None = None
    hang_seng_1d_change: float | None = None


class NewsItem(BaseModel):
    title: str
    publisher: str | None = None
    published: str | None = None
    url: str | None = None
    related_ticker: str | None = None


class MacroInfo(BaseModel):
    as_of_date: str
    rba_policy: RBAPolicy = Field(default_factory=RBAPolicy)
    asx_market: ASXMarket = Field(default_factory=ASXMarket)
    currencies: Currencies = Field(default_factory=Currencies)
    commodities: Commodities = Field(default_factory=Commodities)
    global_indices: GlobalIndices = Field(default_factory=GlobalIndices)
    news_headlines: list[NewsItem] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class RatesEnv(BaseModel):
    rba_cash_rate: float | None = None
    au_10y_bond_yield: float | None = None
    yield_curve_slope: float | None = None
    regime: str = "UNKNOWN"


class InflationData(BaseModel):
    latest_cpi_yoy: float | None = None
    latest_trimmed_mean: float | None = None
    rba_inflation_target: str = "2-3%"
    above_target: bool = False


class GrowthData(BaseModel):
    gdp_growth_yoy: float | None = None
    unemployment_rate: float | None = None
    retail_sales_mom: float | None = None


class ChinaExposure(BaseModel):
    shanghai_comp_ytd: float | None = None
    aud_cny_3mo_change: float | None = None
    iron_ore_proxy_ytd: float | None = None
    china_signal: str = "NEUTRAL"


class RiskSentiment(BaseModel):
    vix_level: float | None = None
    asx200_volatility_20d: float | None = None
    vix_regime: str = "UNKNOWN"


class SectorRotation(BaseModel):
    outperforming_sectors: list[str] = Field(default_factory=list)
    underperforming_sectors: list[str] = Field(default_factory=list)
    rotation_signal: str = "MIXED"


class MacroAnchors(BaseModel):
    as_of_date: str
    rates_environment: RatesEnv = Field(default_factory=RatesEnv)
    inflation: InflationData = Field(default_factory=InflationData)
    growth: GrowthData = Field(default_factory=GrowthData)
    china_exposure: ChinaExposure = Field(default_factory=ChinaExposure)
    risk_sentiment: RiskSentiment = Field(default_factory=RiskSentiment)
    sector_rotation: SectorRotation = Field(default_factory=SectorRotation)
    summary: str
    data_note: str | None = None
    errors: list[str] = Field(default_factory=list)
