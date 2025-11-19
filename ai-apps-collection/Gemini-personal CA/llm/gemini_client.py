from __future__ import annotations

import json
from typing import Dict, List

import google.generativeai as genai


class GeminiClient:
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        self.api_key = api_key
        self.model = model
        self._configured = False

    def _ensure_client(self) -> genai.GenerativeModel:
        if not self._configured:
            genai.configure(api_key=self.api_key)
            self._configured = True
        return genai.GenerativeModel(self.model)

    def build_summary(
        self,
        plan_inputs: Dict[str, str],
        retirement_plan: Dict[str, float],
        kids_plan: List[Dict[str, float]],
        tax_plan: Dict[str, List[str]],
        savings_focus: Dict[str, float],
    ) -> Dict[str, object]:
        prompt = self._summary_prompt(plan_inputs, retirement_plan, kids_plan, tax_plan, savings_focus)
        model = self._ensure_client()
        response = model.generate_content(prompt)
        text = response.text or "{}"
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {
                "priority_actions": tax_plan.get("priority", []),
                "narrative": text,
                "notes": ["Structured output fallback applied"],
            }

    def _summary_prompt(
        self,
        plan_inputs: Dict[str, str],
        retirement_plan: Dict[str, float],
        kids_plan: List[Dict[str, float]],
        tax_plan: Dict[str, List[str]],
        savings_focus: Dict[str, float],
    ) -> str:
        return (
            "You are a financial planner. Return JSON with keys priority_actions (list), "
            "narrative (string), and notes (list). "
            f"Inputs: {json.dumps(plan_inputs)}. "
            f"Retirement: {json.dumps(retirement_plan)}. "
            f"Kids: {json.dumps([child.__dict__ if hasattr(child, '__dict__') else child for child in kids_plan])}. "
            f"Tax: {json.dumps(tax_plan)}. "
            f"Savings: {json.dumps(savings_focus)}."
        )

