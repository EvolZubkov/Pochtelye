import httpx
import pytest

from app.platform import HttpPlatformClient, PodStatus
from app.sender import MemorySenderBackend, OutgoingMessage


@pytest.fixture
def message() -> OutgoingMessage:
    return OutgoingMessage("a@x.ru", ("b@x.ru",), "Тема", "<p>Привет</p>")


def test_memory_sender_collects_messages(message):
    sender = MemorySenderBackend()

    result = sender.send(message)

    assert result.ok is True
    assert sender.outbox == [message]


class _Recorder:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return httpx.Response(self.status_code)


def _patch_transport(monkeypatch, handler) -> None:
    real = httpx.AsyncClient

    def factory(*args, **kwargs):
        return real(*args, transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr("app.platform.httpx.AsyncClient", factory)


async def test_http_client_posts_status_with_jwt_header(monkeypatch):
    recorder = _Recorder(200)
    _patch_transport(monkeypatch, recorder)

    await HttpPlatformClient("http://platform/pods/status", "tok").send_status(PodStatus.RUNNING)

    request = recorder.requests[0]
    assert request.headers["jwt"] == "tok"
    assert b"RUNNING" in request.content


async def test_http_client_swallows_platform_errors(monkeypatch):
    _patch_transport(monkeypatch, _Recorder(500))

    await HttpPlatformClient("http://platform/pods/status").send_status(PodStatus.ERROR)
