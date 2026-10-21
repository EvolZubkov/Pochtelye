# Почтелье v3

**Это v3 (новый репозиторий).** Legacy v2.x (Flask + PyQt) находится в `D:\cod\EmailBuilder\shablon_rassilok`: это справочник, здесь его не правим и не коммитим туда.

## Стек
- Бэкенд: Python, FastAPI, SQLAlchemy 2 + Alembic, structlog.
- Фронтенд: React + TypeScript + Vite, `@universityrt/ui-kit` (клон хэндбука: `D:\cod\EmailBuilder\ENGINERING_HANDBOOK\ui-kit`).
- Хостинг: skript.rt.ru (Python Platform) — временный контейнер OKD на запуск одного пользователя.

## Правила
- ADR хэндбука РТК: ответы API в envelope `{data, error, meta}`, поля camelCase; мягкое удаление `deleted_at`; `structlog` без PII; покрытие тестами не ниже 80%.
- Если нужного компонента нет в UI Kit, расширяем Kit, а не пишем одноразовый локальный.
- Хранилище скрыто за интерфейсом `Repository` (SQLite локально, PostgreSQL в проде).
- Отправка скрыта за интерфейсом `SenderBackend` (Exchange EWS, SMTP, в будущем почтовый клиент).
- Идентичность: JWT платформы (`PY_PLATFORM_JWT`, заголовок `jwt`), доступен только `sub`; роли храним сами.
- Секреты не коммитить: `.env`, ключи, токены, `credentials.json`.
- Решения и ограничения: `docs/adr/`.
