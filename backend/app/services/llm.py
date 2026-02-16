import os
import json
from sqlalchemy.orm import Session
from app.models.optimization import OptimizationResult
from openai import AsyncOpenAI
from app.core.config import settings

class LLMExplanationService:
    def __init__(self, db: Session):
        self.db = db
        # Use Groq API Key from settings
        self.api_key = settings.GROQ_API_KEY
        self.base_url = "https://api.groq.com/openai/v1"
        self.model = "llama-3.3-70b-versatile"  # Valid model ID

        if self.api_key:
            self.client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )
        else:
            self.client = None

    async def generate_explanation(self, optimization_id: int):
        """
        Generates a concise, metrics-focused explanation using Groq API.
        """
        print(f"DEBUG: Generating explanation for {optimization_id} using Groq")
        opt_result = self.db.query(OptimizationResult).filter(OptimizationResult.id == optimization_id).first()
        if not opt_result:
            print(f"OptimizationResult {optimization_id} not found.")
            return

        # Debug API Key (redacted)
        if self.api_key:
            print(f"DEBUG: API Key found: {self.api_key[:4]}...{self.api_key[-4:]}")
        else:
            print("DEBUG: No API Key found in settings.")

        if not self.client:
            print("DEBUG: Client not initialized. Using mock.")
            mock_explanation = (
                "AI Analysis (Mock): The portfolio was rebalanced to optimize risk-adjusted returns. "
                "Exposure to high-volatility assets was adjusted to align with the target risk profile."
            )
            opt_result.explanation = mock_explanation
            opt_result.status = "COMPLETED"
            self.db.commit()
            return

        try:
            # optimize prompt data to save tokens
            prompt = self._construct_optimized_prompt(opt_result.result_json)
            print(f"DEBUG: Sending prompt to Groq: {prompt[:100]}...")

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a financial analyst. briefly explain portfolio rebalancing decisions based on Sharpe ratio, volatility, and use quantitative data from the prompt. Be concise."
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300, # Increased slightly for better quality
                temperature=0.7
            )

            explanation = response.choices[0].message.content.strip()
            print(f"DEBUG: Groq response received: {explanation[:50]}...")
            
            opt_result.explanation = explanation
            opt_result.status = "COMPLETED"
            self.db.commit()
            print("DEBUG: Groq explanation generated and saved successfully.")

        except Exception as e:
            print(f"ERROR: Failed to generate explanation with Groq. Type: {type(e).__name__}, Message: {str(e)}")
            import traceback
            traceback.print_exc()
            opt_result.status = "FAILED"
            opt_result.explanation = "Failed to generate AI insights."
            self.db.commit()

    def _construct_optimized_prompt(self, result_json):
        """
        Constructs a prompt with Before/After comparison.
        """
        metrics = result_json.get('metrics', {})
        new_weights = result_json.get('optimized_weights', {})
        current_weights = result_json.get('current_weights', {})
        
        # Round numbers
        ret = round(metrics.get('expected_return', 0) * 100, 1)
        vol = round(metrics.get('volatility', 0) * 100, 1)
        sharpe = round(metrics.get('sharpe_ratio', 0), 2)
        
        # Identify major changes
        changes = []
        all_tickers = set(new_weights.keys()) | set(current_weights.keys())
        
        for t in all_tickers:
            old_w = current_weights.get(t, 0.0)
            new_w = new_weights.get(t, 0.0)
            diff = new_w - old_w
            
            if abs(diff) > 0.01: # Check > 1% change
                action = "Increased" if diff > 0 else "Reduced"
                changes.append(f"{t}: {old_w*100:.1f}% -> {new_w*100:.1f}% ({action})")
        
        prompt = (
            f"Portfolio Optimization Results:\n"
            f"- Projected Return: {ret}%\n"
            f"- Projected Risk (Vol): {vol}%\n"
            f"- Sharpe Ratio: {sharpe}\n\n"
            f"Key Allocation Changes:\n" + 
            "\n".join(changes[:6]) + 
            f"\n\nExplain why these specific changes improve the portfolio (e.g. why increase X and decrease Y?). Be concise."
        )
        return prompt
