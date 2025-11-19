from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

from llm.gemini_client import GeminiClient
from utils.finance import ChildGoalResult, compute_expense_allocation


@dataclass
class PlannerAgent:
    gemini_client: GeminiClient
    agno_api_key: Optional[str] = None

    def build_plan(
        self,
        intake_payload: Dict[str, str],
        retirement_plan: Dict[str, float],
        kids_plan: List[Dict[str, object]],
        tax_plan: Dict[str, List[str]],
    ) -> Dict[str, object]:
        savings_focus = compute_expense_allocation(
            monthly_expenses=intake_payload["monthly_expenses"],
            monthly_income=intake_payload["annual_income"] / 12,
        )
        gemini_summary = self.gemini_client.build_summary(
            plan_inputs=intake_payload,
            retirement_plan=retirement_plan,
            kids_plan=kids_plan,
            tax_plan=tax_plan,
            savings_focus=savings_focus,
        )
        return {
            "retirement": retirement_plan,
            "kids": kids_plan,
            "tax": tax_plan,
            "savings_allocation": savings_focus,
            "llm_summary": gemini_summary,
        }

