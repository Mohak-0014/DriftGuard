import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta, date
from app.db.session import SessionLocal
from app.models.market_data import PriceHistory
from sqlalchemy import func

class MarketDataService:
    def __init__(self, db):
        self.db = db

    def _is_data_fresh(self, tickers: list[str]) -> bool:
        """
        Check if all tickers already have price data from today (or the last
        trading day if markets are closed).  If so, skip the yfinance call.
        """
        today = date.today()
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
            if hasattr(latest_date, 'date'):
                latest_date = latest_date.date()
            # Stale if the latest row is older than 6 hours
            if hasattr(latest_date, 'hour'):
                age = datetime.now() - datetime.combine(latest_date, datetime.min.time())
            else:
                age = datetime.now() - datetime.combine(latest_date, datetime.min.time())
            if age > timedelta(hours=6):
                return False
                
            # Check for data depth (approx 1 year trading days)
            count = self.db.query(PriceHistory).filter(PriceHistory.ticker == ticker).count()
            if count < 200:
                print(f"Data for {ticker} is fresh but shallow ({count} rows). Forcing update.")
                return False
                
        return True

    def fetch_and_store_prices(self, tickers: list[str]):
        """
        Fetches latest 3 months of data for tickers and stores in DB.
        Skips the download entirely if data is already fresh.
        """
        # Skip if we already have up-to-date data
        if self._is_data_fresh(tickers):
            return {"status": "fresh", "message": "Data is already up-to-date"}

        try:
            # Try yfinance first
            # Note: yfinance is currently unreliable/hanging in some envs
            # We wrap it in a timeout if possible, or just catch exceptions.
            # For now, we'll try it, but if it fails/returns empty, we go to fallback.
            
            # yfinance doesn't easily support timeout on download(). 
            # If it hangs, we might need to use a different mechanism or skip it if we suspect issues.
            # user explicitly requested fallback. Let's try yfinance but catch ANY error.
            print(f"Fetching from yfinance for {tickers}...")
            # Fetch 2 years of data for better optimization context
            data = yf.download(tickers, period="2y", interval="1d", group_by='ticker', auto_adjust=True, threads=False) # threads=False might help hang?
            
            if data.empty:
                raise Exception("yfinance returned empty data")
            
            # yfinance structure depends on number of tickers
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
                        ticker_data = data[ticker]
                        self._process_single_ticker(ticker, ticker_data)
            
            self.db.commit()
            return {"status": "success", "message": f"Updated prices for {len(tickers)} tickers (yfinance)"}

        except Exception as e:
            print(f"yfinance failed: {e}. Trying AlphaVantage fallback...")
            # Fallback to AlphaVantage
            success_count = 0
            errors = []
            
            for ticker in tickers:
                try:
                    df = self._fetch_alphavantage(ticker)
                    if not df.empty:
                        self._process_single_ticker(ticker, df)
                        success_count += 1
                        # Rate limit: 5 calls per minute (free tier) -> 12s delay
                        # We only delay if there are more tickers
                        if len(tickers) > 1:
                             import time
                             time.sleep(15) 
                    else:
                        errors.append(f"{ticker}: Empty AV data")
                except Exception as av_e:
                    errors.append(f"{ticker}: {av_e}")
            
            if success_count > 0:
                self.db.commit()
                return {"status": "success", "message": f"Updated prices for {success_count} tickers (AlphaVantage). Errors: {errors}"}
            else:
                self.db.rollback()
                return {"status": "error", "message": f"All sources failed. yfinance: {e}. AV Errors: {errors}"}
                
    def _fetch_alphavantage(self, ticker: str) -> pd.DataFrame:
        import requests
        from app.core.config import settings
        
        url = "https://www.alphavantage.co/query"
        params = {
            "function": "TIME_SERIES_DAILY",
            "symbol": ticker,
            "apikey": settings.ALPHAVANTAGE_API_KEY,
            "outputsize": "compact" # 100 data points (enough for 3mo verify)
        }
        
        print(f"Fetching from AlphaVantage for {ticker}...")
        try:
            r = requests.get(url, params=params, timeout=15)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f"AlphaVantage Request Failed: {e}")
            return pd.DataFrame()
        
        # Check for error or limit
        if "Error Message" in data:
             raise Exception(data["Error Message"])
        if "Note" in data:
             # Using free tier limit likely
             print(f"AlphaVantage Note: {data['Note']}")
        
        ts = data.get("Time Series (Daily)", {})
        if not ts:
            return pd.DataFrame()
            
        # Convert to DataFrame with columns: Open, High, Low, Close, Volume
        # AV keys: "1. open", "2. high", "3. low", "4. close", "5. volume"
        rows = []
        for date_str, values in ts.items():
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            rows.append({
                "date": dt,
                "Open": float(values["1. open"]),
                "High": float(values["2. high"]),
                "Low": float(values["3. low"]),
                "Close": float(values["4. close"]),
                "Volume": int(values["5. volume"])
            })
            
        df = pd.DataFrame(rows)
        if not df.empty:
            df.set_index("date", inplace=True)
            
        return df

    def _process_single_ticker(self, ticker, df):
        if df.empty:
            return

        for index, row in df.iterrows():
            # Strip timezone so comparisons with SQLite naive datetimes work
            date_val = index.to_pydatetime()
            if date_val.tzinfo is not None:
                date_val = date_val.replace(tzinfo=None)

            exists = self.db.query(PriceHistory).filter(
                PriceHistory.ticker == ticker,
                PriceHistory.date == date_val
            ).first()

            try:
                open_val = float(row['Open'])
                high_val = float(row['High'])
                low_val = float(row['Low'])
                close_val = float(row['Close'])
                volume_val = int(row['Volume']) if pd.notna(row['Volume']) else 0
                
                # Validation: Skip if any critical value is NaN
                if pd.isna(close_val) or pd.isna(open_val):
                     print(f"Skipping row {date_val} for {ticker} due to NaN values")
                     continue
                     
            except Exception as row_e:
                print(f"Error reading row {date_val}: {row_e}")
                continue

            if exists:
                # Update the existing row (e.g. intraday close may have changed)
                exists.open = open_val
                exists.high = high_val
                exists.low = low_val
                exists.close = close_val
                exists.volume = volume_val
            else:
                ph = PriceHistory(
                    ticker=ticker,
                    date=date_val,
                    open=open_val,
                    high=high_val,
                    low=low_val,
                    close=close_val,
                    volume=volume_val,
                )
                self.db.add(ph)
    
    def get_latest_prices(self, tickers: list[str]):
        """
        Get latest close price for tickers from DB.
        """
        prices = {}
        for ticker in tickers:
            latest = self.db.query(PriceHistory)\
                .filter(PriceHistory.ticker == ticker)\
                .filter(PriceHistory.close.isnot(None))\
                .order_by(PriceHistory.date.desc())\
                .first()
            if latest:
                prices[ticker] = latest.close
        return prices

    def get_volatility_history(self, ticker: str, days: int = 90, window: int = 30) -> list[dict]:
        """
        Calculate annualized volatility history (rolling window std dev of returns).
        Returns list of {date, value} where value is annualized volatility (0.0 to 1.0+).
        """
        # Fetch detailed history
        cutoff_date = date.today() - timedelta(days=days + window + 10) # Buffer for window
        history = (
            self.db.query(PriceHistory)
            .filter(PriceHistory.ticker == ticker, PriceHistory.date >= cutoff_date)
            .order_by(PriceHistory.date.asc()) # Ascending for rolling calc
            .all()
        )
        
        if not history or len(history) < window:
            return []
            
        # Convert to DataFrame for easy calculation
        data = [{"date": h.date, "close": h.close} for h in history]
        df = pd.DataFrame(data)
        
        # Calculate daily returns
        df['returns'] = df['close'].pct_change()
        
        # Calculate rolling volatility (std dev) * sqrt(252) for annualized
        import numpy as np
        df['volatility'] = df['returns'].rolling(window=window).std() * np.sqrt(252)
        
        # Filter to requested range (remove buffer)
        # We want the last 'days' days
        result_df = df.dropna().tail(days)
        
        result = []
        for _, row in result_df.iterrows():
            date_val = row['date']
            if hasattr(date_val, 'isoformat'):
                date_str = date_val.isoformat()
            else:
                date_str = str(date_val)
                
            result.append({
                "date": date_str,
                "value": row['volatility']
            })
            
        return result

