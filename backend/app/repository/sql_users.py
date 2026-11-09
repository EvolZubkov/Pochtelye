from datetime import datetime

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError

from app.repository.base import NewUser, Role, User, UserPage
from app.repository.convert import as_utc, required_utc
from app.repository.errors import DuplicateEmailError
from app.repository.models import UserRow, new_id, utcnow

_USER_EDITABLE = ("email", "display_name", "role", "audience_id", "group_id")


def normalize_email(email: str | None) -> str | None:
    return email.strip().lower() if email else None


def to_user(row: UserRow) -> User:
    return User(
        id=row.id,
        sub=row.sub,
        email=row.email,
        display_name=row.display_name,
        role=Role(row.role),
        audience_id=row.audience_id,
        group_id=row.group_id,
        created_at=required_utc(row.created_at),
        last_seen_at=as_utc(row.last_seen_at),
        invite_expires_at=as_utc(row.invite_expires_at),
    )


class UsersMixin:
    def _active_user(self, session, **filters) -> UserRow | None:
        conditions = [getattr(UserRow, key) == value for key, value in filters.items()]
        return session.scalar(select(UserRow).where(UserRow.deleted_at.is_(None), *conditions))

    def _email_owner(self, session, email: str, exclude_id: str | None = None) -> UserRow | None:
        query = select(UserRow).where(UserRow.email == email)
        if exclude_id:
            query = query.where(UserRow.id != exclude_id)
        return session.scalar(query)

    def get_user(self, user_id: str) -> User | None:
        with self._sessions() as session:
            row = self._active_user(session, id=user_id)
            return to_user(row) if row else None

    def get_user_by_sub(self, sub: str) -> User | None:
        with self._sessions() as session:
            row = self._active_user(session, sub=sub)
            return to_user(row) if row else None

    def list_users(self, page: int, limit: int, search: str | None = None) -> UserPage:
        conditions = [UserRow.deleted_at.is_(None)]
        if search:
            conditions.append(
                or_(
                    UserRow.email.icontains(search.strip(), autoescape=True),
                    UserRow.display_name.icontains(search.strip(), autoescape=True),
                )
            )
        with self._sessions() as session:
            total = session.scalar(select(func.count()).select_from(UserRow).where(*conditions))
            rows = session.scalars(
                select(UserRow)
                .where(*conditions)
                .order_by(UserRow.created_at, UserRow.id)
                .offset((page - 1) * limit)
                .limit(limit)
            ).all()
            return UserPage(items=tuple(to_user(r) for r in rows), total=total or 0)

    def ensure_admin(self, sub: str) -> User:
        user = self.get_user_by_sub(sub)
        if user is None:
            try:
                user = self.create_user(NewUser(email=None, role=Role.ADMIN, sub=sub))
            except IntegrityError:  # параллельный первый запрос уже создал запись
                user = self.get_user_by_sub(sub)
        if user.role != Role.ADMIN:
            user = self.update_user(user.id, {"role": Role.ADMIN}) or user
        return user

    def create_user(self, new: NewUser) -> User:
        email = normalize_email(new.email)
        with self._sessions.begin() as session:
            if email and self._email_owner(session, email) is not None:
                raise DuplicateEmailError(email)
            row = UserRow(id=new_id())
            row.sub = new.sub
            row.email = email
            row.display_name = new.display_name
            row.role = new.role.value
            row.audience_id = new.audience_id
            row.group_id = new.group_id
            row.invite_hash = None
            row.invite_expires_at = None
            row.last_seen_at = None
            session.add(row)
            session.flush()
            return to_user(row)

    def update_user(self, user_id: str, changes: dict) -> User | None:
        with self._sessions.begin() as session:
            row = self._active_user(session, id=user_id)
            if row is None:
                return None
            for key in _USER_EDITABLE:
                if key not in changes:
                    continue
                value = changes[key]
                if key == "email":
                    value = normalize_email(value)
                    if value and self._email_owner(session, value, exclude_id=row.id):
                        raise DuplicateEmailError(value)
                if key == "role":
                    value = Role(value).value
                setattr(row, key, value)
            session.flush()
            return to_user(row)

    def delete_user(self, user_id: str) -> bool:
        with self._sessions.begin() as session:
            row = self._active_user(session, id=user_id)
            if row is None:
                return False
            row.deleted_at = utcnow()
            # Освобождаем sub и почту: человека можно завести заново, а отправки в журнале
            # хранят снимок почты и не зависят от этой записи.
            row.sub = None
            row.email = None
            row.invite_hash = None
            row.invite_expires_at = None
            return True

    def set_invite(self, user_id: str, code_hash: str, expires_at: datetime) -> User | None:
        with self._sessions.begin() as session:
            row = self._active_user(session, id=user_id)
            if row is None:
                return None
            row.invite_hash = code_hash
            row.invite_expires_at = expires_at
            return to_user(row)

    def claim_invite(self, code_hash: str, sub: str, now: datetime) -> User | None:
        with self._sessions.begin() as session:
            # Один условный UPDATE: из двух одновременных попыток с одним кодом выиграет одна.
            claimed = session.execute(
                update(UserRow)
                .where(
                    UserRow.deleted_at.is_(None),
                    UserRow.sub.is_(None),
                    UserRow.invite_hash == code_hash,
                    UserRow.invite_expires_at > now,
                )
                .values(sub=sub, invite_hash=None, invite_expires_at=None, last_seen_at=now)
            )
            if claimed.rowcount != 1:
                return None
            row = session.scalar(select(UserRow).where(UserRow.sub == sub))
            return to_user(row)

    def claim_by_email(
        self, email: str, sub: str, display_name: str | None, now: datetime
    ) -> User | None:
        normalized = normalize_email(email)
        if not normalized:
            return None
        try:
            with self._sessions.begin() as session:
                # Условный UPDATE: привязать можно только ещё свободную запись.
                claimed = session.execute(
                    update(UserRow)
                    .where(
                        UserRow.deleted_at.is_(None),
                        UserRow.sub.is_(None),
                        UserRow.email == normalized,
                    )
                    .values(sub=sub, invite_hash=None, invite_expires_at=None, last_seen_at=now)
                )
                if claimed.rowcount == 1:
                    row = session.scalar(select(UserRow).where(UserRow.sub == sub))
                    if display_name and not row.display_name:
                        row.display_name = display_name
                    return to_user(row)
        except IntegrityError:
            pass  # параллельный запрос с тем же sub уже привязал запись
        # Параллельный первый запрос мог привязать запись раньше: пускаем, если sub уже наш.
        return self.get_user_by_sub(sub)

    def touch_last_seen(self, user_id: str, now: datetime) -> None:
        with self._sessions.begin() as session:
            row = self._active_user(session, id=user_id)
            if row is not None:
                row.last_seen_at = now

    def count_users_by_audience(self, audience_id: str) -> int:
        with self._sessions() as session:
            return (
                session.scalar(
                    select(func.count())
                    .select_from(UserRow)
                    .where(UserRow.deleted_at.is_(None), UserRow.audience_id == audience_id)
                )
                or 0
            )

    def count_users_by_group(self, group_id: str) -> int:
        with self._sessions() as session:
            return (
                session.scalar(
                    select(func.count())
                    .select_from(UserRow)
                    .where(UserRow.deleted_at.is_(None), UserRow.group_id == group_id)
                )
                or 0
            )
