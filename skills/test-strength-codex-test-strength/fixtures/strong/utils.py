def is_admin(user_roles: list) -> bool:
    if "admin" in user_roles or "superuser" in user_roles:
        return True
    return False
