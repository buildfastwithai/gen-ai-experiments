def apply_discount(price: float, pct: float) -> float:
    if pct > 100:
        raise ValueError("Discount cannot exceed 100%")
    if pct < 0:
        raise ValueError("Discount cannot be negative")
    return price * (1 - pct / 100)
