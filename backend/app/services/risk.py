import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.services.market_data import MarketDataService
from app.models.portfolio import Portfolio

class RiskEngine:
    def __init__(self, db: Session):
        self.db = db
        self.md_service = MarketDataService(db)

    def calculate_metrics(self, portfolio: Portfolio, window_days=730):
        """
        Calculate risk metrics for a portfolio based on current holdings.
        Assumes current weights held constant over the window (Backcast).
        """
        tickers = [h.ticker for h in portfolio.holdings]
        if not tickers:
            return None

        # 1. Fetch historical prices
        end_date = datetime.now()
        start_date = end_date - timedelta(days=window_days)
        
        # ... (unchanged comments) ...
        
        returns_df = self._get_returns_df(tickers, start_date)
        
        if returns_df.empty:
            return None

        # 2. Calculate Portfolio Returns Series
        
        # ... (unchanged comments) ...
        
        # We need current market value to get weights.
        latest_prices = self.md_service.get_latest_prices(tickers)
        if not latest_prices:
             return None
             
        current_values = {}
        for h in portfolio.holdings:
            price = latest_prices.get(h.ticker)
            if price is None:
                price = 0.0
            current_values[h.ticker] = h.quantity * price
            
        total_mv = sum(current_values.values())
        
        if total_mv == 0:
            return None
            
        weights = pd.Series({t: v/total_mv for t, v in current_values.items()})
        
        # Align weights to matches in returns_df
        # returns_df columns are tickers.
        # Filter weights to those in returns_df (in case some data missing)
        valid_tickers = [t for t in weights.index if t in returns_df.columns]
        weights = weights[valid_tickers]
        weights = weights / weights.sum() # Renormalize
        
        portfolio_returns = returns_df[valid_tickers].dot(weights)
        
        # 3. Calculate Metrics
        
        # Annualization factor
        ann_factor = 252 # Trading days
        
        # Volatility (Annualized)
        daily_vol = portfolio_returns.std()
        volatility = daily_vol * np.sqrt(ann_factor)
        
        # Sharpe Ratio (Annualized, Rf=0)
        avg_daily_ret = portfolio_returns.mean()
        sharpe = (avg_daily_ret / daily_vol) * np.sqrt(ann_factor) if daily_vol > 0 else 0
        
        # Sortino Ratio (Annualized, Rf=0)
        # Downside deviation: std dev of negative returns only
        negative_returns = portfolio_returns[portfolio_returns < 0]
        downside_dev = negative_returns.std()
        # Sortino = (Mean - Rf) / DownsideDev
        sortino = (avg_daily_ret * ann_factor) / (downside_dev * np.sqrt(ann_factor)) if downside_dev > 0 else 0
        
        # Max Drawdown
        cumulative_returns = (1 + portfolio_returns).cumprod()
        peak = cumulative_returns.cummax()
        drawdown = (cumulative_returns - peak) / peak
        max_drawdown = drawdown.min() # Negative number
        
        # VaR 95% (Historical)
        # The 5th percentile of daily returns
        var_95 = np.percentile(portfolio_returns, 5) 
        
        # Rolling Volatility History (30-day window, annualized)
        rolling_std = portfolio_returns.rolling(window=30).std() * np.sqrt(ann_factor)
        rolling_std = rolling_std.dropna()
        
        volatility_history = [
            {"date": date.to_pydatetime(), "value": float(val)}
            for date, val in rolling_std.items()
        ]
        
        return {
            "sharpe_ratio": float(sharpe),
            "sortino_ratio": float(sortino),
            "max_drawdown": float(max_drawdown),
            "value_at_risk_95": float(var_95),
            "volatility": float(volatility),
            "volatility_history": volatility_history
        }

    def _get_returns_df(self, tickers, start_date):
        from app.models.market_data import PriceHistory
        
        dfs = []
        for ticker in tickers:
            hist = self.db.query(PriceHistory.date, PriceHistory.close)\
                .filter(PriceHistory.ticker == ticker, PriceHistory.date >= start_date)\
                .order_by(PriceHistory.date.asc())\
                .all()
            
            if not hist:
                continue
                
            df = pd.DataFrame(hist, columns=['date', ticker])
            df.drop_duplicates(subset=['date'], keep='first', inplace=True)
            df.set_index('date', inplace=True)
            dfs.append(df)
            
        if not dfs:
            return pd.DataFrame()

        combined = pd.concat(dfs, axis=1, join='inner')
        returns = combined.pct_change().dropna()
        return returns
