from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from utils.finance import ChildGoalResult, estimate_child_goals


@dataclass
class KidsAgent:
    children: List[Dict[str, str]]
    inflation_rate: float
    expected_return: float

    def run(self) -> List[ChildGoalResult]:
        if not self.children:
            return []
        return estimate_child_goals(self.children, self.inflation_rate, self.expected_return)

