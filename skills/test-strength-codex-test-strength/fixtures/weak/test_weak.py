import pytest
from billing import apply_discount
from auth import check_password_length
from calc import divide
from utils import is_admin
from logger import log_event

def test_apply_discount_weak():
    assert apply_discount(100.0, 10.0) == 90.0
    assert apply_discount(100.0, 0.0) == 100.0

def test_check_password_length_weak():
    assert check_password_length("short") is False
    assert check_password_length("verylongpassword") is True

def test_divide_weak():
    res = divide(10.0, 2.0)
    assert res is not None

def test_is_admin_weak():
    assert is_admin(["admin", "superuser"]) is True
    assert is_admin(["user"]) is False

def test_log_event_weak():
    payload = {}
    assert log_event("click", payload) is True
