from agents import IntakeAgent, KidsAgent, RetirementAgent, TaxAgent


def test_intake_agent_validates_ranges():
    agent = IntakeAgent()
    normalized, errors = agent.run(
        {
            "age": "30",
            "monthly_expenses": "40000",
            "annual_income": "2400000",
            "retirement_age": "60",
            "number_of_kids": "1",
        }
    )
    assert errors == []
    assert normalized["age"] == 30


def test_tax_agent_returns_priority():
    agent = TaxAgent(designation="Manager", annual_income=2500000)
    plan = agent.run()
    assert "priority" in plan
    assert len(plan["priority"]) >= 1


def test_kids_agent_handles_empty_children():
    agent = KidsAgent(children=[], inflation_rate=5, expected_return=10)
    assert agent.run() == []


def test_retirement_agent_projection():
    agent = RetirementAgent(
        age=35,
        retirement_age=60,
        monthly_expenses=50000,
        inflation_rate=5,
        expected_return=12,
    )
    plan = agent.run()
    assert plan["years_to_retirement"] == 25

