from sqlalchemy import select, update

from app.repository.base import Audience
from app.repository.convert import required_utc
from app.repository.models import AudienceRow, utcnow


def to_audience(row: AudienceRow) -> Audience:
    return Audience(
        id=row.id,
        name=row.name,
        profile=dict(row.profile),
        is_default=row.is_default,
        created_at=required_utc(row.created_at),
        updated_at=required_utc(row.updated_at),
    )


class AudiencesMixin:
    def _active_audience(self, session, audience_id: str) -> AudienceRow | None:
        return session.scalar(
            select(AudienceRow).where(
                AudienceRow.id == audience_id, AudienceRow.deleted_at.is_(None)
            )
        )

    def _unset_default(self, session, except_id: str) -> None:
        session.execute(
            update(AudienceRow).where(AudienceRow.id != except_id).values(is_default=False)
        )

    def list_audiences(self) -> tuple[Audience, ...]:
        with self._sessions() as session:
            rows = session.scalars(
                select(AudienceRow)
                .where(AudienceRow.deleted_at.is_(None))
                .order_by(AudienceRow.name, AudienceRow.id)
            ).all()
            return tuple(to_audience(r) for r in rows)

    def get_audience(self, audience_id: str) -> Audience | None:
        with self._sessions() as session:
            row = self._active_audience(session, audience_id)
            return to_audience(row) if row else None

    def get_default_audience(self) -> Audience | None:
        with self._sessions() as session:
            row = session.scalar(
                select(AudienceRow).where(
                    AudienceRow.is_default.is_(True), AudienceRow.deleted_at.is_(None)
                )
            )
            return to_audience(row) if row else None

    def create_audience(self, name: str, profile: dict, is_default: bool = False) -> Audience:
        with self._sessions.begin() as session:
            row = AudienceRow(name=name, profile=profile, is_default=is_default)
            session.add(row)
            session.flush()
            if is_default:
                self._unset_default(session, row.id)
            return to_audience(row)

    def update_audience(self, audience_id: str, changes: dict) -> Audience | None:
        with self._sessions.begin() as session:
            row = self._active_audience(session, audience_id)
            if row is None:
                return None
            if "name" in changes:
                row.name = changes["name"]
            if "profile" in changes:
                row.profile = changes["profile"]
            if changes.get("is_default") is True:
                row.is_default = True
                self._unset_default(session, row.id)
            row.updated_at = utcnow()
            session.flush()
            return to_audience(row)

    def delete_audience(self, audience_id: str) -> bool:
        with self._sessions.begin() as session:
            row = self._active_audience(session, audience_id)
            if row is None:
                return False
            row.deleted_at = utcnow()
            row.is_default = False
            return True
