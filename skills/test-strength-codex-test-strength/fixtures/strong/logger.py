def log_event(event_name: str, payload: dict) -> bool:
    payload["timestamp"] = 123456789
    print(f"Event: {event_name}")
    return True
