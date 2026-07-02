import logging
from sqlalchemy.orm import Session
from app.models.optimization import OptimizationResult
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)

class LLMExplanationService:
    def __init__(self, db: Session):
        self.db = db
        self.api_key = settings.GROQ_API_KEY
        self.base_url = "https://api.groq.com/openai/v1"
        self.model = "llama-3.3-70b-versatile"

        self.client = (
            AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
            if self.api_key
            else None
        )

    async def generate_explanation(self, optimization_id: int):
        opt_result = self.db.query(OptimizationResult).filter(OptimizationResult.id == optimization_id).first()
        if not opt_result:
            logger.warning("OptimizationResult %s not found.", optimization_id)
            return

        if not self.client:
            logger.info("GROQ_API_KEY not set — using mock explanation for optimization %s.", optimization_id)
            opt_result.explanation = (
                "AI Analysis (Mock): The portfolio was rebalanced to optimize risk-adjusted returns. "
                "Exposure to high-volatility assets was adjusted to align with the target risk profile."
            )
            opt_result.status = "COMPLETED"
            self.db.commit()
            return

        try:
            prompt = self._construct_optimized_prompt(opt_result.result_json)
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a financial analyst. Briefly explain portfolio rebalancing decisions based on Sharpe ratio, volatility, and quantitative data from the prompt. Be concise.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=300,
                temperature=0.7,
            )
            opt_result.explanation = response.choices[0].message.content.strip()
            opt_result.status = "COMPLETED"
            self.db.commit()
            logger.info("Groq explanation generated for optimization %s.", optimization_id)
        except Exception as exc:
            logger.error("Failed to generate explanation for optimization %s: %s", optimization_id, exc, exc_info=True)
            opt_result.status = "FAILED"
            opt_result.explanation = "Failed to generate AI insights."
            self.db.commit()

    def _construct_optimized_prompt(self, result_json: dict) -> str:
        metrics = result_json.get("metrics", {})
        new_weights = result_json.get("optimized_weights", {})
        current_weights = result_json.get("current_weights", {})

        ret = round(metrics.get("expected_return", 0) * 100, 1)
        vol = round(metrics.get("volatility", 0) * 100, 1)
        sharpe = round(metrics.get("sharpe_ratio", 0), 2)

        changes = []
        for t in set(new_weights) | set(current_weights):
            old_w = current_weights.get(t, 0.0)
            new_w = new_weights.get(t, 0.0)
            diff = new_w - old_w
            if abs(diff) > 0.01:
                action = "Increased" if diff > 0 else "Reduced"
                changes.append(f"{t}: {old_w*100:.1f}% -> {new_w*100:.1f}% ({action})")

        return (
            f"Portfolio Optimization Results:\n"
            f"- Projected Return: {ret}%\n"
            f"- Projected Risk (Vol): {vol}%\n"
            f"- Sharpe Ratio: {sharpe}\n\n"
            f"Key Allocation Changes:\n"
            + "\n".join(changes[:6])
            + "\n\nExplain why these specific changes improve the portfolio. Be concise."
        )
