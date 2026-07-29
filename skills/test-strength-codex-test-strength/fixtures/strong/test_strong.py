import sys
print("DEBUG: sys.path is", sys.path)
import pytest
from billing import apply_discount
from auth import check_password_length
from calc import divide
from utils import is_admin
from logger import log_event

def test_apply_discount_strong():
    assert apply_discount(100.0, 10.0) == 90.0
    assert apply_discount(100.0, 0.0) == 100.0
    assert apply_discount(100.0, 100.0) == 0.0
    with pytest.raises(ValueError):
        apply_discount(100.0, 101.0)
    with pytest.raises(ValueError):
        apply_discount(100.0, -1.0)

def test_check_password_length_strong():
    assert check_password_length("short") is False
    assert check_password_length("1234567") is False
    assert check_password_length("12345678") is True
    assert check_password_length("verylongpassword") is True

def test_divide_strong():
    assert divide(10.0, 2.0) == 5.0
    assert divide(0.0, 5.0) == 0.0
    assert divide(-10.0, 2.0) == -5.0
    with pytest.raises(ZeroDivisionError):
        divide(10.0, 0.0)

def test_is_admin_strong():
    assert is_admin(["admin"]) is True
    assert is_admin(["superuser"]) is True
    assert is_admin(["admin", "superuser"]) is True
    assert is_admin(["user"]) is False
    assert is_admin([]) is False

def test_log_event_strong():
    payload = {}
    assert log_event("click", payload) is True
    assert payload.get("timestamp") == 123456789
