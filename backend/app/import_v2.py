"""Перенос общих шаблонов из Почтелья v2 (JSON-файлы каталога ресурсов) в базу v3.

Запуск из backend:
    .venv\\Scripts\\python -m app.import_v2 D:\\path\\to\\cache

База берётся из DATABASE_URL, как у приложения. Повторный запуск дублей не создаёт:
шаблон с тем же названием и категорией пропускается (и не перезаписывается).
Личные шаблоны не переносятся.
"""

import json
import sys
from dataclasses import dataclass
from pathlib import Path

from pydantic import ValidationError

from app.config import Settings
from app.migrate import upgrade_database
from app.repository import NewTemplate, Repository, SqlRepository, TemplateScope
from app.repository.sql import make_engine
from app.routes_templates import TemplateCreate

# Владельца-человека у перенесённых шаблонов нет: общие шаблоны правит администратор.
IMPORT_OWNER = "import-v2"
PAGE_SIZE = 200


@dataclass(frozen=True)
class ImportReport:
    created: int
    skipped: int
    failed: tuple[tuple[str, str], ...]  # (имя файла, причина)


def _existing_keys(repository: Repository) -> set[tuple[str, str]]:
    keys: set[tuple[str, str]] = set()
    page = 1
    while True:
        found = repository.list_templates(IMPORT_OWNER, page, PAGE_SIZE, TemplateScope.SHARED)
        keys.update((t.name, t.category) for t in found.items)
        if not found.items or page * PAGE_SIZE >= found.total:
            return keys
        page += 1


def _read(path: Path) -> TemplateCreate:
    """Те же проверки, что у API: неверный файл не попадёт в базу."""
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict):
        raise ValueError("в файле не объект шаблона")
    return TemplateCreate(
        name=data.get("name") or "",
        category=data.get("category") or "",
        scope=TemplateScope.SHARED,
        blocks=data.get("blocks") or [],
        preview=data.get("preview") or None,
    )


def import_shared_templates(repository: Repository, resources_dir: Path) -> ImportReport:
    folder = Path(resources_dir) / "templates" / "shared"
    if not folder.is_dir():
        raise FileNotFoundError(f"Нет папки общих шаблонов: {folder}")

    known = _existing_keys(repository)
    created = skipped = 0
    failed: list[tuple[str, str]] = []
    for path in sorted(folder.glob("*.json")):
        try:
            template = _read(path)
        except (OSError, ValueError, ValidationError) as error:
            failed.append((path.name, str(error).splitlines()[0]))
            continue
        key = (template.name, template.category)
        if key in known:
            skipped += 1
            continue
        repository.create_template(
            NewTemplate(
                owner_sub=IMPORT_OWNER,
                scope=TemplateScope.SHARED,
                name=template.name,
                category=template.category,
                blocks=tuple(template.blocks),
                preview=template.preview,
            )
        )
        known.add(key)
        created += 1
    return ImportReport(created=created, skipped=skipped, failed=tuple(failed))


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("Укажите каталог ресурсов v2: python -m app.import_v2 <путь к cache>")
        return 2
    database_url = Settings().database_url
    upgrade_database(database_url)
    repository = SqlRepository(make_engine(database_url))
    report = import_shared_templates(repository, Path(argv[0]))
    print(f"Добавлено: {report.created}, пропущено (уже есть): {report.skipped}")
    for name, reason in report.failed:
        print(f"Не перенесён {name}: {reason}")
    return 1 if report.failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
