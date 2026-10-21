from datetime import UTC, datetime, timedelta

import pytest

from app.repository import DuplicateEmailError, NewUser, Role, UserStatus


def _invited(repository, email="a@rt.ru", role=Role.EDITOR, **kw):
    return repository.create_user(NewUser(email=email, role=role, **kw))


def test_create_user_normalizes_email_and_starts_invited(repository):
    user = _invited(repository, email="  Ivan@RT.ru ")

    assert user.email == "ivan@rt.ru"
    assert user.sub is None
    assert user.status == UserStatus.INVITED


def test_duplicate_email_is_rejected_case_insensitively(repository):
    _invited(repository, email="a@rt.ru")

    with pytest.raises(DuplicateEmailError):
        _invited(repository, email="A@rt.ru")


def test_update_user_changes_fields_and_rejects_taken_email(repository):
    first = _invited(repository, email="a@rt.ru")
    _invited(repository, email="b@rt.ru")

    updated = repository.update_user(first.id, {"role": Role.ADMIN, "display_name": "Анна"})

    assert updated.role == Role.ADMIN
    assert updated.display_name == "Анна"
    with pytest.raises(DuplicateEmailError):
        repository.update_user(first.id, {"email": "b@rt.ru"})


def test_update_unknown_user_returns_none(repository):
    assert repository.update_user("nope", {"role": Role.ADMIN}) is None


def test_delete_is_soft_and_frees_sub_and_email(repository):
    user = _invited(repository, email="a@rt.ru", sub="s1")

    assert repository.delete_user(user.id) is True
    assert repository.get_user(user.id) is None
    assert repository.get_user_by_sub("s1") is None
    assert repository.delete_user(user.id) is False


def test_same_email_can_be_invited_again_after_delete(repository):
    user = _invited(repository, email="a@rt.ru", role=Role.ADMIN, sub="s1")
    repository.delete_user(user.id)

    again = _invited(repository, email="a@rt.ru", role=Role.VIEWER)

    assert again.id != user.id
    assert again.role == Role.VIEWER
    assert again.sub is None


def test_claim_invite_binds_sub_once(repository):
    user = _invited(repository)
    now = datetime.now(UTC)
    repository.set_invite(user.id, "hash1", now + timedelta(days=1))

    claimed = repository.claim_invite("hash1", "sub-1", now)

    assert claimed.sub == "sub-1"
    assert claimed.status == UserStatus.ACTIVE
    assert claimed.invite_expires_at is None
    assert repository.claim_invite("hash1", "sub-2", now) is None


def test_claim_invite_rejects_wrong_or_expired_code(repository):
    user = _invited(repository)
    now = datetime.now(UTC)
    repository.set_invite(user.id, "hash1", now - timedelta(seconds=1))

    assert repository.claim_invite("hash1", "s", now) is None
    assert repository.claim_invite("other", "s", now) is None


def test_set_invite_unknown_user_returns_none(repository):
    assert repository.set_invite("nope", "h", datetime.now(UTC)) is None


def test_ensure_admin_is_idempotent_and_promotes(repository):
    first = repository.ensure_admin("boot-1")
    repository.update_user(first.id, {"role": Role.VIEWER})

    again = repository.ensure_admin("boot-1")

    assert again.id == first.id
    assert again.role == Role.ADMIN


def test_list_users_paginates_and_searches(repository):
    for name in ("anna@rt.ru", "boris@rt.ru", "clara@x.com"):
        _invited(repository, email=name)

    page = repository.list_users(page=1, limit=2)
    found = repository.list_users(page=1, limit=10, search="rt.ru")

    assert (len(page.items), page.total) == (2, 3)
    assert {u.email for u in found.items} == {"anna@rt.ru", "boris@rt.ru"}


def test_touch_last_seen_and_audience_count(repository):
    user = _invited(repository, audience_id="aud-1")
    now = datetime.now(UTC)

    repository.touch_last_seen(user.id, now)

    assert repository.get_user(user.id).last_seen_at is not None
    assert repository.count_users_by_audience("aud-1") == 1
    assert repository.count_users_by_audience("aud-2") == 0
