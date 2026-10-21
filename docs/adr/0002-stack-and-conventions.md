# ADR-0002: Стек и соглашения

- **Статус:** Accepted
- **Дата:** 2026-10-21

## Решение

| Область | Выбор | Причина |
|---|---|---|
| Бэкенд | Python, FastAPI | Знакомый язык, перенос логики EWS и SMTP из v2 |
| Фронтенд | React + TypeScript + Vite | `@universityrt/ui-kit` написан на React |
| UI | `@universityrt/ui-kit` | Единый вид приложений РТК |
| БД | SQLAlchemy 2 + Alembic; SQLite → PostgreSQL | Один код на оба диалекта |
| Логи | `structlog`, JSON, `requestId` | ADR-0004 хэндбука РТК |
| API | Envelope `{data, error, meta}`, camelCase | ADR-0002 хэндбука РТК |
| Удаление | Мягкое, `deleted_at` | ADR-0003 хэндбука РТК |
| Тесты | Покрытие не ниже 80% | ADR-0005 хэндбука РТК |
| i18n | `ru` по умолчанию, бэкенд отдаёт коды ошибок | Задел под другие языки и почтовый клиент |

## Расширяемость

- `Repository` — доступ к данным.
- `SenderBackend` — отправка (Exchange EWS, SMTP, в будущем почтовый клиент).
- `IdentityProvider` — источник пользователя (JWT платформы, dev-заглушка).

## Что не входит в первый этап

- Переписывание холст-редактора писем (из v2 подключается как есть).
- Собственный почтовый клиент.

## Связанные документы

- Хэндбук: `ENGINERING_HANDBOOK/decisions/`, `handbook/architecture/`.
- [ADR-0001](0001-platform-constraints.md)
