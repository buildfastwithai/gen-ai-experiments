from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

from utils.finance import calculate_retirement_plan


@dataclass
class RetirementAgent:
    age: int
    retirement_age: int
    monthly_expenses: float
    inflation_rate: float
    expected_return: float
    current_corpus: float = 0

    def run(self) -> Dict[str, float]:
        return calculate_retirement_plan(
            age=self.age,
            retirement_age=self.retirement_age,
            monthly_expenses=self.monthly_expenses,
            inflation_rate=self.inflation_rate,
            expected_return=self.expected_return,
            current_corpus=self.current_corpus,
        )

