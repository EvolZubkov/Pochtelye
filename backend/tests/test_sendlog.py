from datetime import UTC, datetime, timedelta

from app.repository import NewSend, SendFilter, SendStatus
from tests.conftest import ADMIN_SUB, EDITOR_SUB


def _as(sub):
    return {"x-test-sub": sub}


def _send(repository, sender, recipients, status=SendStatus.SENT, subject="Тема"):
    return repository.record_send(
        NewSend(
            sender_id=sender.id,
            sender_email=sender.email,
            subject=subject,
            recipients=tuple(recipients),
            status=status,
        )
    )


def test_record_and_list_sends_newest_first(repository):
    user = repository.ensure_admin("a")
    _send(repository, user, ["x@rt.ru"], subject="первое")
    _send(repository, user, ["y@rt.ru", "z@rt.ru"], subject="второе")

    page = repository.list_sends(1, 10, SendFilter())

    assert page.total == 2
    assert page.items[0].subject == "второе"
    assert page.items[0].recipients == ("y@rt.ru", "z@rt.ru")


def test_filters_by_sender_and_dates(repository):
    one = repository.ensure_admin("a")
    two = repository.ensure_admin("b")
    _send(repository, one, ["x@rt.ru"])
    _send(repository, two, ["y@rt.ru"])
    now = datetime.now(UTC)
    day = timedelta(days=1)

    by_sender = repository.list_sends(1, 10, SendFilter(sender_id=two.id))
    future = repository.list_sends(1, 10, SendFilter(date_from=now + day))
    past = repository.list_sends(1, 10, SendFilter(date_to=now - day))
    window = repository.list_sends(1, 10, SendFilter(date_from=now - day, date_to=now + day))

    assert by_sender.total == 1
    assert future.total == 0
    assert past.total == 0
    assert window.total == 2


def test_summary_counts_messages_recipients_and_failures(repository):
    user = repository.ensure_admin("a")
    _send(repository, user, ["x@rt.ru", "y@rt.ru"])
    _send(repository, user, ["z@rt.ru"], status=SendStatus.FAILED)

    [row] = repository.summarize_senders(SendFilter())

    assert (row.messages, row.recipients, row.failed) == (2, 3, 1)
    assert row.last_sent_at.tzinfo is not None


def test_admin_api_lists_log_and_summary(multi_client, repository):
    editor = repository.get_user_by_sub(EDITOR_SUB)
    _send(repository, editor, ["a@rt.ru", "b@rt.ru"])

    log = multi_client.get("/api/admin/send-log", headers=_as(ADMIN_SUB)).json()
    summary = multi_client.get(
        f"/api/admin/send-log/summary?senderId={editor.id}", headers=_as(ADMIN_SUB)
    ).json()

    assert log["meta"]["total"] == 1
    assert log["data"][0]["recipients"] == ["a@rt.ru", "b@rt.ru"]
    assert log["data"][0]["recipientCount"] == 2
    assert summary["data"][0]["messages"] == 1
    assert summary["data"][0]["senderEmail"] == "editor1@rt.ru"


def test_send_log_is_admin_only(multi_client):
    response = multi_client.get("/api/admin/send-log", headers=_as(EDITOR_SUB))

    assert response.status_code == 403


def test_send_log_filters_by_date_query(multi_client, repository):
    editor = repository.get_user_by_sub(EDITOR_SUB)
    _send(repository, editor, ["a@rt.ru"])

    future = multi_client.get(
        "/api/admin/send-log?dateFrom=2999-01-01T00:00:00Z", headers=_as(ADMIN_SUB)
    ).json()

    assert future["meta"]["total"] == 0
