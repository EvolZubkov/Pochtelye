"""Ресурсы редактора писем: каталог картинок (config.json) и профиль аудитории."""

import json
from pathlib import Path
from typing import Any

import structlog

log = structlog.get_logger()

# Категории картинок раздаются от корня сайта: редактор строит URL как origin + src.
RESOURCE_DIRS = (
    "icons",
    "expert-badges",
    "bullets",
    "button-icons",
    "images",
    "banners",
    "banner-logos",
    "banner-backgrounds",
    "banner-icons",
    "dividers",
    "fonts",
)

# Блоки почты и отправка пока не перенесены из v2: функции скрыты, код не удаляется.
FEATURES = {"bulk_mail": False, "exchange_send": False}

EMPTY_CONFIG: dict[str, Any] = {"version": "1.0", "icons": {}}
BUNDLED_PROFILES = Path(__file__).parent / "editor_data" / "profiles"


def _read_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        log.warning("editor_json_unreadable", path=path.name, error=type(exc).__name__)
        return None


def _exists_inside(root: Path, relative: str) -> bool:
    candidate = (root / relative).resolve()
    return candidate.is_relative_to(root.resolve()) and candidate.is_file()


def _prune(node: Any, root: Path) -> Any:
    """Убирает записи каталога, чей файл отсутствует в каталоге ресурсов."""
    if isinstance(node, list):
        kept = []
        for item in node:
            if isinstance(item, dict) and isinstance(item.get("src"), str):
                if not _exists_inside(root, item["src"]):
                    continue
            kept.append(_prune(item, root))
        return kept
    if isinstance(node, dict):
        return {key: _prune(value, root) for key, value in node.items()}
    return node


def load_editor_config(
    resources_dir: str | None, features: dict[str, bool] | None = None
) -> dict[str, Any]:
    config = dict(EMPTY_CONFIG)
    if resources_dir:
        root = Path(resources_dir)
        loaded = _read_json(root / "config.json")
        if loaded is not None:
            config = _prune(loaded, root)
    return {**config, "features": {**FEATURES, **(features or {})}}


def load_editor_profile(name: str, resources_dir: str | None) -> dict[str, Any]:
    """Профиль из каталога ресурсов, иначе встроенный; default — запасной вариант."""
    candidates = []
    if resources_dir:
        candidates.append(Path(resources_dir) / "profiles" / f"{name}.json")
    candidates += [BUNDLED_PROFILES / f"{name}.json", BUNDLED_PROFILES / "default.json"]
    for path in candidates:
        profile = _read_json(path) if path.is_file() else None
        if profile is not None:
            return profile
    return {"name": "default", "blocks": {}}
