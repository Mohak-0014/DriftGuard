import logging
from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.orm import Session
from app.api import deps
from app.core.limiter import limiter
from app.models.user import User
from app.models.portfolio import Portfolio
from app.services.optimization import OptimizationEngine
from app.services.market_data import MarketDataService

from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

class OptimizationConfig(BaseModel):
    min_weight: float = 0.05
    max_weight: float = 0.60
    turnover_penalty: float = 0.0
    large_deviation_threshold: float = 0.10
    large_deviation_penalty: float = 0.0
    risk_aversion: float = 5.0
    div_penalty: float = 0.0

@router.post("/{portfolio_id}/optimize")
@limiter.limit("10/minute")
def optimize_portfolio(
    request: Request,
    portfolio_id: int,
    background_tasks: BackgroundTasks,
    config: OptimizationConfig = OptimizationConfig(),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id, Portfolio.user_id == current_user.id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    tickers = [h.ticker for h in portfolio.holdings]
    if not tickers:
        raise HTTPException(status_code=400, detail="Portfolio has no holdings")

    # Ensure we have data.
    # Calculate current weights for turnover penalty
    # We need current prices to get current value of each holding
    md_service = MarketDataService(db)
    try:
        md_service.fetch_and_store_prices(tickers)
    except Exception as exc:
        logger.warning("Failed to update prices during optimization: %s", exc)

    prices = md_service.get_latest_prices(tickers)
    
    # Import currency service
    from app.services.currency import currency_service
    
    total_value_usd = 0.0
    holding_values_usd = {}
    
    for h in portfolio.holdings:
        raw_price = prices.get(h.ticker, h.avg_price)
        value_usd = currency_service.convert(h.quantity * raw_price, h.currency, "USD")
        holding_values_usd[h.ticker] = value_usd
        total_value_usd += value_usd
        
    current_weights = {}
    if total_value_usd > 0:
        for ticker, val in holding_values_usd.items():
            current_weights[ticker] = val / total_value_usd

    # Fetch Sentiment Scores
    from app.services.sentiment import SentimentService
    sentiment_service = SentimentService(db)
    sentiment_scores = {}
    for ticker in tickers:
        data = sentiment_service.get_sentiment(ticker)
        if data and 'score' in data:
            sentiment_scores[ticker] = data['score']

    optimizer = OptimizationEngine(db)
    # Pass current weights, turnover penalty, and sentiment scores
    target_weights = optimizer.optimize_portfolio(
        tickers, 
        current_weights=current_weights,
        min_weight=config.min_weight, 
        max_weight=config.max_weight, 
        turnover_penalty=config.turnover_penalty,
        large_deviation_threshold=config.large_deviation_threshold,
        large_deviation_penalty=config.large_deviation_penalty,
        risk_aversion=config.risk_aversion,
        div_penalty=config.div_penalty,
        sentiment_scores=sentiment_scores
    )

    # If the portfolio is already near-optimal (max per-asset deviation < 2%),
    # snap the target weights to the current weights so the result is idempotent
    # after accepting a rebalance.
    if current_weights:
        max_deviation = max(
            abs(target_weights.get(t, 0) - current_weights.get(t, 0))
            for t in tickers
        )
        if max_deviation < 0.02:
            target_weights = dict(current_weights)

    # Calculate metrics for current vs target
    metrics = optimizer.calculate_metrics(tickers, list(target_weights.values()))

    # Persist Result for Async Explanation
    from app.models.optimization import OptimizationResult
    from app.services.llm import LLMExplanationService
    
    # Store result JSON (weights + metrics)
    result_data = {
        "current_weights": current_weights,
        "optimized_weights": target_weights,
        "metrics": metrics
    }
    
    opt_result = OptimizationResult(
        portfolio_id=portfolio_id,
        status="PENDING",
        result_json=result_data,
        explanation=None
    )
    db.add(opt_result)
    db.commit()
    db.refresh(opt_result)
    
    # Trigger LLM explanation: Celery → Kafka → BackgroundTasks (degradation chain)
    from app.celery_app import celery_available
    if celery_available():
        from app.tasks.llm_tasks import generate_explanation as celery_generate
        celery_generate.delay(opt_result.id)
    else:
        from app.messaging.producer import kafka_producer
        from app.messaging.events import TOPIC_OPTIMIZATION_REQUEST, OptimizationRequestEvent
        published = kafka_producer.publish(
            TOPIC_OPTIMIZATION_REQUEST,
            OptimizationRequestEvent(optimization_id=opt_result.id, portfolio_id=portfolio_id),
        )
        if not published:
            llm_service = LLMExplanationService(db)
            background_tasks.add_task(llm_service.generate_explanation, opt_result.id)

    return {
        "portfolio_id": portfolio_id,
        "optimization_id": opt_result.id,
        "optimized_weights": target_weights,
        "metrics": metrics
    }

@router.get("/optimizations/{optimization_id}")
def get_optimization_result(
    optimization_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get the status and explanation of a specific optimization run.
    """
    from app.models.optimization import OptimizationResult
    result = db.query(OptimizationResult).filter(OptimizationResult.id == optimization_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Optimization result not found")
        
    # Check authorization
    if result.portfolio.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return {
        "id": result.id,
        "status": result.status,
        "explanation": result.explanation,
        "created_at": result.created_at
    }
from app.models.portfolio import RebalanceLog, Holding
from app.schemas import RebalanceLogCreate, RebalanceLogResponse, ApplyRebalanceRequest

@router.post("/log", response_model=RebalanceLogResponse)
def log_rebalance(
    rebalance_in: RebalanceLogCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Log a rebalancing event (manually triggered/accepted).
    """
    # Verify portfolio belongs to user
    portfolio = db.query(Portfolio).filter(Portfolio.id == rebalance_in.portfolio_id, Portfolio.user_id == current_user.id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    log_entry = RebalanceLog(
        portfolio_id=rebalance_in.portfolio_id,
        old_weights=rebalance_in.old_weights,
        recommended_weights=rebalance_in.recommended_weights,
        reason=rebalance_in.reason,
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry

@router.post("/{portfolio_id}/apply")
def apply_rebalance(
    portfolio_id: int,
    request: ApplyRebalanceRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Apply a rebalancing strategy by updating holdings to match target weights.
    Calculations are normalized to USD to handle mixed currencies.
    """
    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id, Portfolio.user_id == current_user.id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Get current prices
    md_service = MarketDataService(db)
    tickers = [h.ticker for h in portfolio.holdings]
    prices = md_service.get_latest_prices(tickers)
    
    if not prices:
        raise HTTPException(status_code=400, detail="No price data available")

    # Import currency service here to avoid circular imports if any
    from app.services.currency import currency_service

    # Calculate current total value in USD
    total_value_usd = 0.0
    holding_values_usd = {}
    
    for h in portfolio.holdings:
        raw_price = prices.get(h.ticker, h.avg_price)
        raw_value = h.quantity * raw_price
        # Convert to USD
        value_usd = currency_service.convert(raw_value, h.currency, "USD")
        holding_values_usd[h.ticker] = value_usd
        total_value_usd += value_usd
    
    if total_value_usd <= 0:
        raise HTTPException(status_code=400, detail="Portfolio has no value")

    # Save old weights for logging
    old_weights = {}
    for h in portfolio.holdings:
        old_weights[h.ticker] = holding_values_usd[h.ticker] / total_value_usd

    # Normalize target weights to ensure they sum to 1.0
    total_target_weight = sum(request.target_weights.values())
    normalized_weights = {}
    if total_target_weight > 0:
        normalized_weights = {k: v / total_target_weight for k, v in request.target_weights.items()}
    else:
        # Fallback if weights sum to 0 (unlikely but safe)
        normalized_weights = request.target_weights

    # Update holdings based on target weights
    for holding in portfolio.holdings:
        target_weight = normalized_weights.get(holding.ticker, 0)
        
        # Calculate target value in USD
        target_value_usd = total_value_usd * target_weight
        
        # Get current market price (in holding's native currency)
        current_price = prices.get(holding.ticker, holding.avg_price)
        
        # Get current price in USD for quantity calculation
        price_usd = currency_service.convert(current_price, holding.currency, "USD")
        
        if price_usd > 0:
            new_quantity = target_value_usd / price_usd
            old_quantity = holding.quantity
            
            if new_quantity > old_quantity:
                # Buying more shares: weighted average of old cost basis + new shares at market price
                # old_cost = old_quantity * old_avg_price
                # new_cost = (new_quantity - old_quantity) * current_price
                # new_avg  = (old_cost + new_cost) / new_quantity
                added_qty = new_quantity - old_quantity
                old_cost = old_quantity * holding.avg_price
                new_cost = added_qty * current_price  # current market price in native currency
                holding.avg_price = round((old_cost + new_cost) / new_quantity, 4)
            # If selling (new_quantity <= old_quantity), avg_price stays the same
            # because we're disposing of shares bought at the existing avg cost
            
            holding.quantity = round(new_quantity, 6)

    # Log the rebalance
    log_entry = RebalanceLog(
        portfolio_id=portfolio_id,
        old_weights=old_weights,
        recommended_weights=normalized_weights,
        reason="Strategy accepted by user",
    )
    db.add(log_entry)
    db.commit()

    # Return updated portfolio info
    return {
        "status": "success",
        "message": "Portfolio rebalanced successfully",
        "portfolio_id": portfolio_id,
        "new_weights": request.target_weights
    }
