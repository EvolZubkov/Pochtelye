from sqlalchemy import func, select

from app.repository.base import Group, NewGroup
from app.repository.convert import required_utc
from app.repository.models import GroupRow, utcnow

_GROUP_EDITABLE = ("name", "features", "categories", "limits")


def to_group(row: GroupRow) -> Group:
    return Group(
        id=row.id,
        audience_id=row.audience_id,
        name=row.name,
        features=dict(row.features),
        categories=tuple(row.categories) if row.categories is not None else None,
        limits=dict(row.limits),
        created_at=required_utc(row.created_at),
        updated_at=required_utc(row.updated_at),
    )


class GroupsMixin:
    def _active_group(self, session, group_id: str) -> GroupRow | None:
        return session.scalar(
            select(GroupRow).where(GroupRow.id == group_id, GroupRow.deleted_at.is_(None))
        )

    def list_groups(self) -> tuple[Group, ...]:
        with self._sessions() as session:
            rows = session.scalars(
                select(GroupRow)
                .where(GroupRow.deleted_at.is_(None))
                .order_by(GroupRow.name, GroupRow.id)
            ).all()
            return tuple(to_group(r) for r in rows)

    def get_group(self, group_id: str) -> Group | None:
        with self._sessions() as session:
            row = self._active_group(session, group_id)
            return to_group(row) if row else None

    def create_group(self, new: NewGroup) -> Group:
        with self._sessions.begin() as session:
            row = GroupRow(
                audience_id=new.audience_id,
                name=new.name,
                features=dict(new.features),
                categories=list(new.categories) if new.categories is not None else None,
                limits=dict(new.limits or {}),
            )
            session.add(row)
            session.flush()
            return to_group(row)

    def update_group(self, group_id: str, changes: dict) -> Group | None:
        with self._sessions.begin() as session:
            row = self._active_group(session, group_id)
            if row is None:
                return None
            for key in _GROUP_EDITABLE:
                if key not in changes:
                    continue
                value = changes[key]
                if key == "categories" and value is not None:
                    value = list(value)
                setattr(row, key, value)
            row.updated_at = utcnow()
            session.flush()
            return to_group(row)

    def delete_group(self, group_id: str) -> bool:
        with self._sessions.begin() as session:
            row = self._active_group(session, group_id)
            if row is None:
                return False
            row.deleted_at = utcnow()
            return True

    def count_groups_by_audience(self, audience_id: str) -> int:
        with self._sessions() as session:
            return (
                session.scalar(
                    select(func.count())
                    .select_from(GroupRow)
                    .where(GroupRow.deleted_at.is_(None), GroupRow.audience_id == audience_id)
                )
                or 0
            )
