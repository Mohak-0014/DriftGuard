import logging
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta, date
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.market_data import PriceHistory

logger = logging.getLogger(__name__)

class MarketDataService:
    def __init__(self, db):
        self.db = db

    def _is_data_fresh(self, tickers: list[str]) -> bool:
        for ticker in tickers:
            latest = (
                self.db.query(PriceHistory)
                .filter(PriceHistory.ticker == ticker)
                .order_by(PriceHistory.date.desc())
                .first()
            )
            if not latest:
                return False
            latest_date = latest.date
            if hasattr(latest_date, "date"):
                latest_date = latest_date.date()
            age = datetime.now() - datetime.combine(latest_date, datetime.min.time())
            if age > timedelta(hours=6):
                return False
            count = self.db.query(PriceHistory).filter(PriceHistory.ticker == ticker).count()
            if count < 200:
                logger.debug("Data for %s is fresh but shallow (%d rows). Forcing update.", ticker, count)
                return False
        return True

    def search_ticker(self, query: str) -> List[Dict[str, Any]]:
        import requests
        try:
            url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}"
            headers = {"User-Agent": "Mozilla/5.0"}
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                results = []
                for quote in data.get("quotes", []):
                    if quote.get("quoteType") in ["EQUITY", "ETF", "MUTUALFUND"]:
                        results.append({
                            "symbol": quote.get("symbol"),
                            "shortname": quote.get("shortname"),
                            "longname": quote.get("longname"),
                            "exchange": quote.get("exchange"),
                            "type": quote.get("quoteType"),
                        })
                return results
            logger.warning("Yahoo ticker search returned %s", response.status_code)
            return []
        except Exception as exc:
            logger.error("Error searching ticker '%s': %s", query, exc)
            return []

    def fetch_and_store_prices(self, tickers: list[str]):
        if self._is_data_fresh(tickers):
            return {"status": "fresh", "message": "Data is already up-to-date"}

        try:
            logger.info("Fetching price data from yfinance for %s", tickers)
            data = yf.download(tickers, period="2y", interval="1d", group_by="ticker", auto_adjust=True, threads=False)

            if data.empty:
                raise ValueError("yfinance returned empty data")

            if len(tickers) == 1:
                ticker = tickers[0]
                ticker_data = data
                if isinstance(data.columns, pd.MultiIndex):
                    try:
                        ticker_data = data.xs(ticker, axis=1, level=0)
                    except KeyError:
                        if ticker in data.columns:
                            ticker_data = data[ticker]
                self._process_single_ticker(ticker, ticker_data)
            else:
                for ticker in tickers:
                    if ticker in data.columns.levels[0]:
                        self._process_single_ticker(ticker, data[ticker])

            self.db.commit()
            self._publish_price_event(tickers, "yfinance")
            return {"status": "success", "message": f"Updated prices for {len(tickers)} tickers (yfinance)"}

        except Exception as exc:
            logger.warning("yfinance failed: %s. Trying AlphaVantage fallback...", exc)
            success_count = 0
            errors = []

            for ticker in tickers:
                try:
                    df = self._fetch_alphavantage(ticker)
                    if not df.empty:
                        self._process_single_ticker(ticker, df)
                        success_count += 1
                        if len(tickers) > 1:
                            import time
                            time.sleep(15)
                    else:
                        errors.append(f"{ticker}: Empty AV data")
                except Exception as av_exc:
                    errors.append(f"{ticker}: {av_exc}")

            if success_count > 0:
                self.db.commit()
                self._publish_price_event(tickers, "alphavantage")
                return {"status": "success", "message": f"Updated {success_count} tickers (AlphaVantage). Errors: {errors}"}
            self.db.rollback()
            return {"status": "error", "message": f"All sources failed. yfinance: {exc}. AV: {errors}"}

    def _fetch_alphavantage(self, ticker: str) -> pd.DataFrame:
        import requests
        from app.core.config import settings

        if not settings.ALPHAVANTAGE_API_KEY:
            logger.warning("ALPHAVANTAGE_API_KEY not set — cannot fetch data for %s", ticker)
            return pd.DataFrame()

        url = "https://www.alphavantage.co/query"
        params = {
            "function": "TIME_SERIES_DAILY",
            "symbol": ticker,
            "apikey": settings.ALPHAVANTAGE_API_KEY,
            "outputsize": "compact",
        }

        try:
            r = requests.get(url, params=params, timeout=15)
            r.raise_for_status()
            data = r.json()
        except requests.RequestException as exc:
            logger.error("AlphaVantage request failed for %s: %s", ticker, exc)
            return pd.DataFrame()

        if "Error Message" in data:
            raise ValueError(data["Error Message"])
        if "Note" in data:
            logger.warning("AlphaVantage rate limit note for %s: %s", ticker, data["Note"])

        ts = data.get("Time Series (Daily)", {})
        if not ts:
            return pd.DataFrame()

        rows = []
        for date_str, values in ts.items():
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            rows.append({
                "date": dt,
                "Open": float(values["1. open"]),
                "High": float(values["2. high"]),
                "Low": float(values["3. low"]),
                "Close": float(values["4. close"]),
                "Volume": int(values["5. volume"]),
            })

        df = pd.DataFrame(rows)
        if not df.empty:
            df.set_index("date", inplace=True)
        return df

    def _process_single_ticker(self, ticker: str, df: pd.DataFrame):
        if df.empty:
            return

        for index, row in df.iterrows():
            date_val = index.to_pydatetime()
            if date_val.tzinfo is not None:
                date_val = date_val.replace(tzinfo=None)

            try:
                open_val = float(row["Open"])
                high_val = float(row["High"])
                low_val = float(row["Low"])
                close_val = float(row["Close"])
                volume_val = int(row["Volume"]) if pd.notna(row["Volume"]) else 0

                if pd.isna(close_val) or pd.isna(open_val):
                    continue
            except Exception as exc:
                logger.debug("Skipping row %s for %s: %s", date_val, ticker, exc)
                continue

            existing = self.db.query(PriceHistory).filter(
                PriceHistory.ticker == ticker,
                PriceHistory.date == date_val,
            ).first()

            if existing:
                existing.open = open_val
                existing.high = high_val
                existing.low = low_val
                existing.close = close_val
                existing.volume = volume_val
            else:
                self.db.add(PriceHistory(
                    ticker=ticker,
                    date=date_val,
                    open=open_val,
                    high=high_val,
                    low=low_val,
                    close=close_val,
                    volume=volume_val,
                ))

    def get_latest_prices(self, tickers: list[str]) -> Dict[str, float]:
        from app.services.cache import cache

        prices: Dict[str, float] = {}
        uncached: list[str] = []

        for ticker in tickers:
            cached_price = cache.get_price(ticker)
            if cached_price is not None:
                prices[ticker] = cached_price
            else:
                uncached.append(ticker)

        for ticker in uncached:
            latest = (
                self.db.query(PriceHistory)
                .filter(PriceHistory.ticker == ticker, PriceHistory.close.isnot(None))
                .order_by(PriceHistory.date.desc())
                .first()
            )
            if latest:
                prices[ticker] = latest.close
                cache.set_price(ticker, latest.close)

        return prices

    def _publish_price_event(self, tickers: list[str], source: str) -> None:
        try:
            from app.messaging.producer import kafka_producer
            from app.messaging.events import TOPIC_PRICE_FETCHED, PriceFetchedEvent
            kafka_producer.publish(TOPIC_PRICE_FETCHED, PriceFetchedEvent(tickers=tickers, source=source))
        except Exception as exc:
            logger.debug("Could not publish price event: %s", exc)

    def get_volatility_history(self, ticker: str, days: int = 90, window: int = 30) -> list[dict]:
        import numpy as np
        cutoff_date = date.today() - timedelta(days=days + window + 10)
        history = (
            self.db.query(PriceHistory)
            .filter(PriceHistory.ticker == ticker, PriceHistory.date >= cutoff_date)
            .order_by(PriceHistory.date.asc())
            .all()
        )

        if not history or len(history) < window:
            return []

        df = pd.DataFrame([{"date": h.date, "close": h.close} for h in history])
        df["returns"] = df["close"].pct_change()
        df["volatility"] = df["returns"].rolling(window=window).std() * np.sqrt(252)
        result_df = df.dropna().tail(days)

        result = []
        for _, row in result_df.iterrows():
            date_val = row["date"]
            result.append({
                "date": date_val.isoformat() if hasattr(date_val, "isoformat") else str(date_val),
                "value": row["volatility"],
            })
        return result
