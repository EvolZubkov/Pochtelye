from app.repository import Role


def test_get_user_returns_none_for_unknown(repository):
    assert repository.get_user("nobody") is None


def test_ensure_user_creates_once(repository):
    first = repository.ensure_user("u1", Role.EDITOR)
    second = repository.ensure_user("u1", Role.VIEWER)

    assert first.role == Role.EDITOR
    assert second.role == Role.EDITOR


def test_set_role_updates_and_returns_new_user(repository):
    repository.ensure_user("u1")

    updated = repository.set_role("u1", Role.ADMIN)

    assert updated.role == Role.ADMIN
    assert repository.get_user("u1").role == Role.ADMIN


def test_set_role_unknown_user_returns_none(repository):
    assert repository.set_role("ghost", Role.ADMIN) is None


def test_delete_is_soft_and_hides_user(repository):
    repository.ensure_user("u1")

    assert repository.delete_user("u1") is True
    assert repository.get_user("u1") is None
    assert repository.delete_user("u1") is False


def test_ensure_user_restores_deleted_with_default_role(repository):
    repository.ensure_user("u1", Role.ADMIN)
    repository.delete_user("u1")

    restored = repository.ensure_user("u1", Role.VIEWER)

    assert restored.role == Role.VIEWER
    assert repository.get_user("u1") is not None
