import numpy as np
import pandas as pd
from scipy.optimize import minimize
from app.models.market_data import PriceHistory

class OptimizationEngine:
    def __init__(self, db):
        self.db = db

    def calculate_metrics(self, tickers, weights):
        """
        Calculate Portfolio Return, Volatility, Sharpe Ratio.
        Assume 252 trading days.
        """
        returns_df = self._get_returns_df(tickers)
        if returns_df.empty:
            return None
            
        cov_matrix = returns_df.cov() * 252
        avg_returns = returns_df.mean() * 252
        
        weights = np.array(weights)
        port_return = np.sum(avg_returns * weights)
        port_volatility = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
        sharpe_ratio = port_return / port_volatility if port_volatility > 0 else 0
        
        return {
            "expected_return": port_return,
            "volatility": port_volatility,
            "sharpe_ratio": sharpe_ratio
        }

    def optimize_portfolio(self, tickers, current_weights=None, min_weight=0.0, max_weight=1.0, 
                           turnover_penalty=0.0, large_deviation_threshold=0.10, large_deviation_penalty=0.0,
                           risk_aversion=5.0, div_penalty=0.0, sentiment_scores=None):
        """
        Mean-Variance Optimization with Ledoit-Wolf Covariance, EWMA Returns,
        Turnover Penalty, Diversification Regularization, and Sentiment Adjustment.
        """
        import pandas as pd
        from sklearn.covariance import LedoitWolf

        returns_df = self._get_returns_df(tickers)
        if returns_df.empty:
            return {t: 0 for t in tickers} # Fail safe

        num_assets = len(tickers)
        
        # 1. Expected Returns
        # Use simple historical mean over the full window (up to 2y) for stability
        avg_returns = returns_df.mean() * 252
        avg_returns = np.clip(avg_returns, -0.5, 0.5)
        
        # 2. Covariance Matrix using Ledoit-Wolf Shrinkage
        lw = LedoitWolf()
        cov_matrix = lw.fit(returns_df).covariance_ * 252

        # 3. Sentiment-Based Volatility Adjustment
        # Adjust diagonal (variance) based on sentiment
        # Positive sentiment -> Reduce Variance (Lower perceived risk)
        # Negative sentiment -> Increase Variance (Higher perceived risk)
        if sentiment_scores:
            sensitivity = 0.2
            for i, ticker in enumerate(tickers):
                score = sentiment_scores.get(ticker, 0.0)
                if score != 0:
                    # Factor < 1 for positive score (Safe)
                    # Factor > 1 for negative score (Risky)
                    factor = 1.0 - (score * sensitivity)
                    # Clamp to avoid extreme distortions (0.5x to 1.5x variance)
                    factor = np.clip(factor, 0.5, 1.5)
                    cov_matrix[i][i] *= factor
                    # print(f"DEBUG: Adjusted {ticker} variance by factor {factor:.2f} (Score: {score})")

        # Volatility Regime Detection
        recent_window = 30
        if len(returns_df) >= recent_window:
            recent_vol = returns_df.tail(recent_window).std() * np.sqrt(252)
            avg_vol = recent_vol.mean()
        else:
            recent_vol = returns_df.std() * np.sqrt(252)
            avg_vol = recent_vol.mean()
            
        is_high_volatility = avg_vol > 0.25 # Threshold: 25% annualized
        
        # Volatility Regime Detection (Optional: only if not manually overridden?)
        # For now, let's stick to the passed parameters if they are explicitly set, 
        # or we could keep the dynamic logic as a fallback. 
        # The user requested "proper optimization", so let's use the explicit parameters.
        
        risk_aversion_param = risk_aversion
        div_penalty_param = div_penalty
        
        # Original logic for dynamic regime was here, but we are prioritizing explicit control directly.
        # If we wanted to keep it, we'd check if defaults were used.
        
        # Current weights vector (aligned with tickers)
        w0 = np.zeros(num_assets)
        if current_weights:
            for i, ticker in enumerate(tickers):
                w0[i] = current_weights.get(ticker, 0.0)

        # Equal-weight reference for diversification regularization
        equal_weight = np.ones(num_assets) / num_assets

        def objective(weights):
            p_ret = np.sum(avg_returns * weights)
            p_vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
            
            # Turnover Cost
            diff = np.abs(weights - w0)
            turnover = np.sum(diff)
            
            # Large Deviation Penalty
            excess_deviation = np.maximum(diff - large_deviation_threshold, 0)
            large_dev_cost = np.sum(excess_deviation) * large_deviation_penalty
            
            # Diversification Regularization (L2 penalty toward equal-weight)
            # This discourages extreme concentration without forcing equal weight
            concentration_cost = div_penalty_param * np.sum((weights - equal_weight) ** 2)
            
            # Quadratic Utility with dynamic risk aversion
            utility = (
                p_ret
                - 0.5 * risk_aversion_param * (p_vol ** 2)
                - turnover_penalty * 0.01 * turnover
                - large_dev_cost
                - concentration_cost
            )
            
            return -utility

        constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1}) # Weights sum to 1
        
        # Apply max weight from config
        # effective_max = min(max_weight, 0.20) if is_high_volatility else max_weight
        # We respect the passed max_weight to avoid infeasible constraints (e.g. 3 assets * 0.2 max < 1.0)
        effective_max = max_weight
        
        bounds = tuple((min_weight, effective_max) for _ in range(num_assets))
        initial_guess = num_assets * [1. / num_assets,]

        result = minimize(objective, initial_guess, method='SLSQP', bounds=bounds, constraints=constraints)
        
        optimized_weights = dict(zip(tickers, result.x))
        
        # Normalize just in case
        total_w = sum(optimized_weights.values())
        if total_w > 0:
             optimized_weights = {k: v/total_w for k,v in optimized_weights.items()}
             
        return optimized_weights

    def _get_returns_df(self, tickers):
        price_data = {}
        min_len = float('inf')
        
        # We need aligned dates. 
        # Strategy: Fetch all history, merge on Date.
        
        dfs = []
        for ticker in tickers:
            hist = self.db.query(PriceHistory.date, PriceHistory.close)\
                .filter(PriceHistory.ticker == ticker)\
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

        # Inner join to get overlapping dates
        combined = pd.concat(dfs, axis=1, join='inner')
        returns = combined.pct_change().dropna()
        return returns
