import pytest

from app import invites
from app.profile_schema import validate_profile
from app.ratelimit import FailureLimiter


def test_generated_codes_are_formatted_and_unambiguous():
    for _ in range(50):
        code = invites.generate_code()
        assert len(code) == 19 and code[4] == "-"
        assert not set(code.replace("-", "")) & set("01ILO")


def test_hash_ignores_case_and_separators():
    assert invites.hash_code("abcd-efgh-jkmn-pqrs") == invites.hash_code(" ABCD EFGH JKMN PQRS ")
    assert invites.hash_code("ABCD-EFGH-JKMN-PQRS") != invites.hash_code("ABCD-EFGH-JKMN-PQRT")


def test_limiter_blocks_after_max_failures_and_recovers_after_window():
    now = [0.0]
    limiter = FailureLimiter(max_failures=2, window_seconds=10, clock=lambda: now[0])

    limiter.record_failure("k")
    assert not limiter.is_blocked("k")
    limiter.record_failure("k")
    assert limiter.is_blocked("k")
    assert not limiter.is_blocked("other")

    now[0] = 11.0
    assert not limiter.is_blocked("k")


def test_limiter_reset_clears_failures():
    limiter = FailureLimiter(max_failures=1)
    limiter.record_failure("k")

    limiter.reset("k")

    assert not limiter.is_blocked("k")


def test_validate_profile_returns_normalized_dict():
    result = validate_profile({"blocks": {"text": {}}})

    assert result["blocks"]["text"] == {"enabled": True, "capabilities": []}


def test_validate_profile_rejects_huge_payload():
    huge = {"blocks": {"text": {"defaults": {"k": "x" * 60_000}}}}

    with pytest.raises(ValueError):
        validate_profile(huge)


def test_limiter_evicts_oldest_keys_beyond_the_cap():
    limiter = FailureLimiter(max_failures=1, max_keys=2)

    for key in ("a", "b", "c"):
        limiter.record_failure(key)

    assert not limiter.is_blocked("a")
    assert limiter.is_blocked("b") and limiter.is_blocked("c")
