import time
from collections import defaultdict, deque
from collections.abc import Callable


class FailureLimiter:
    """Ограничивает число неудачных попыток на ключ в скользящем окне (в памяти процесса).

    Достаточно для одного контейнера платформы; при нескольких репликах вынести в общее хранилище.
    """

    def __init__(
        self,
        max_failures: int = 5,
        window_seconds: float = 900.0,
        clock: Callable[[], float] = time.monotonic,
        max_keys: int = 10_000,
    ) -> None:
        self._max_keys = max_keys
        self._max_failures = max_failures
        self._window = window_seconds
        self._clock = clock
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _recent(self, key: str) -> deque[float]:
        failures = self._failures[key]
        cutoff = self._clock() - self._window
        while failures and failures[0] <= cutoff:
            failures.popleft()
        if not failures:
            self._failures.pop(key, None)
        return failures

    def is_blocked(self, key: str) -> bool:
        return len(self._recent(key)) >= self._max_failures

    def record_failure(self, key: str) -> None:
        self._recent(key)
        self._failures[key].append(self._clock())
        # Ключи приходят из непроверенного JWT: без потолка поток случайных sub раздул бы память.
        while len(self._failures) > self._max_keys:
            self._failures.pop(next(iter(self._failures)))

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)
