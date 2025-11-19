from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

from utils.finance import validate_user_inputs


@dataclass
class IntakeAgent:
    def run(self, payload: Dict[str, str]) -> Tuple[Dict[str, float], List[str]]:
        normalized, errors = validate_user_inputs(payload)
        if not errors:
            monthly_income = normalized["annual_income"] / 12
            if normalized["monthly_expenses"] >= monthly_income:
                errors.append("Monthly expenses cannot exceed monthly income")
            if normalized["retirement_age"] <= normalized["age"]:
                errors.append("Retirement age must be greater than current age")
        return normalized, errors

