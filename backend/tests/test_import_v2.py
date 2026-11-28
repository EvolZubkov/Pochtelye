import json

import pytest

from app.import_v2 import IMPORT_OWNER, import_shared_templates, main
from app.repository import TemplateScope


def _write(folder, file_name, **over):
    data = {
        "name": "Анонс",
        "category": "HR",
        "preview": "data:image/png;base64,AAAA",
        "blocks": [{"id": 1, "type": "text"}],
        **over,
    }
    (folder / file_name).write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


@pytest.fixture
def catalog(tmp_path):
    shared = tmp_path / "templates" / "shared"
    shared.mkdir(parents=True)
    return tmp_path, shared


def _shared(repository):
    return repository.list_templates("viewer", 1, 100, TemplateScope.SHARED).items


def test_imports_shared_templates_with_blocks_and_preview(repository, catalog):
    root, shared = catalog
    _write(shared, "a.json")

    report = import_shared_templates(repository, root)

    [summary] = _shared(repository)
    assert (report.created, report.skipped, report.failed) == (1, 0, ())
    assert (summary.name, summary.category, summary.owner_sub) == ("Анонс", "HR", IMPORT_OWNER)
    assert summary.preview == "data:image/png;base64,AAAA"
    assert repository.get_template(summary.id).blocks == ({"id": 1, "type": "text"},)


def test_second_run_creates_no_duplicates(repository, catalog):
    root, shared = catalog
    _write(shared, "a.json")
    _write(shared, "b.json", category="Другая")
    import_shared_templates(repository, root)

    report = import_shared_templates(repository, root)

    assert (report.created, report.skipped) == (0, 2)
    assert len(_shared(repository)) == 2


def test_empty_preview_is_stored_as_none(repository, catalog):
    root, shared = catalog
    _write(shared, "a.json", preview="")

    import_shared_templates(repository, root)

    assert _shared(repository)[0].preview is None


def test_broken_files_are_reported_and_others_imported(repository, catalog):
    root, shared = catalog
    (shared / "broken.json").write_text("{not json", encoding="utf-8")
    (shared / "list.json").write_text("[]", encoding="utf-8")
    _write(shared, "noname.json", name="")
    _write(shared, "good.json")

    report = import_shared_templates(repository, root)

    assert report.created == 1
    assert sorted(name for name, _ in report.failed) == ["broken.json", "list.json", "noname.json"]


def test_missing_folder_is_an_error(repository, tmp_path):
    with pytest.raises(FileNotFoundError):
        import_shared_templates(repository, tmp_path)


def test_command_line_imports_into_the_configured_database(catalog, tmp_path, monkeypatch, capsys):
    root, shared = catalog
    _write(shared, "a.json")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{(tmp_path / 'db.sqlite3').as_posix()}")

    assert main([str(root)]) == 0
    assert "Добавлено: 1" in capsys.readouterr().out


def test_command_line_needs_a_folder(capsys):
    assert main([]) == 2
