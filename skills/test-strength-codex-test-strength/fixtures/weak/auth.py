def check_password_length(password: str) -> bool:
    if len(password) >= 8:
        return True
    return False
