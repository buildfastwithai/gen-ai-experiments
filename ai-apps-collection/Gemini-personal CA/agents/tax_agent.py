from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from utils.finance import derive_tax_saving_options


@dataclass
class TaxAgent:
    designation: str
    annual_income: float

    def run(self) -> Dict[str, List[str]]:
        options = derive_tax_saving_options(self.annual_income, self.designation)
        priority = options[:2]
        additional = options[2:]
        return {"priority": priority, "additional": additional}

