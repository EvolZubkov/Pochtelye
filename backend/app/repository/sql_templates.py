import uuid

from sqlalchemy import func, or_, select

from app.repository.base import (
    NewTemplate,
    Template,
    TemplatePage,
    TemplateScope,
    TemplateSummary,
)
from app.repository.convert import required_utc
from app.repository.models import TemplateRow, utcnow

_TEMPLATE_EDITABLE = ("name", "category", "blocks", "preview")


def _summary_fields(row: TemplateRow) -> dict:
    return {
        "id": row.id,
        "owner_sub": row.owner_sub,
        "scope": TemplateScope(row.scope),
        "name": row.name,
        "category": row.category,
        "preview": row.preview,
        "created_at": required_utc(row.created_at),
        "updated_at": required_utc(row.updated_at),
    }


def to_summary(row: TemplateRow) -> TemplateSummary:
    return TemplateSummary(**_summary_fields(row))


def to_template(row: TemplateRow) -> Template:
    return Template(**_summary_fields(row), blocks=tuple(row.blocks))


class TemplatesMixin:
    def _active_template(self, session, template_id: str) -> TemplateRow | None:
        return session.scalar(
            select(TemplateRow).where(
                TemplateRow.id == template_id, TemplateRow.deleted_at.is_(None)
            )
        )

    def list_templates(
        self, viewer_sub: str, page: int, limit: int, scope: TemplateScope | None = None
    ) -> TemplatePage:
        visible = or_(
            TemplateRow.scope == TemplateScope.SHARED.value,
            TemplateRow.owner_sub == viewer_sub,
        )
        conditions = [TemplateRow.deleted_at.is_(None), visible]
        if scope is not None:
            conditions.append(TemplateRow.scope == scope.value)
        with self._sessions() as session:
            total = session.scalar(select(func.count()).select_from(TemplateRow).where(*conditions))
            rows = session.scalars(
                select(TemplateRow)
                .where(*conditions)
                .order_by(TemplateRow.name, TemplateRow.id)
                .offset((page - 1) * limit)
                .limit(limit)
            ).all()
            return TemplatePage(items=tuple(to_summary(r) for r in rows), total=total or 0)

    def get_template(self, template_id: str) -> Template | None:
        with self._sessions() as session:
            row = self._active_template(session, template_id)
            return to_template(row) if row else None

    def create_template(self, new: NewTemplate) -> Template:
        with self._sessions.begin() as session:
            row = TemplateRow(
                id=str(uuid.uuid4()),
                owner_sub=new.owner_sub,
                scope=new.scope.value,
                name=new.name,
                category=new.category,
                blocks=list(new.blocks),
                preview=new.preview,
            )
            session.add(row)
            session.flush()
            return to_template(row)

    def update_template(self, template_id: str, changes: dict) -> Template | None:
        with self._sessions.begin() as session:
            row = self._active_template(session, template_id)
            if row is None:
                return None
            for key in _TEMPLATE_EDITABLE:
                if key in changes:
                    setattr(row, key, changes[key])
            row.updated_at = utcnow()
            return to_template(row)

    def delete_template(self, template_id: str) -> bool:
        with self._sessions.begin() as session:
            row = self._active_template(session, template_id)
            if row is None:
                return False
            row.deleted_at = utcnow()
            return True
