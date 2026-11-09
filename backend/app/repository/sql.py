from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.repository.models import Base
from app.repository.sql_audiences import AudiencesMixin
from app.repository.sql_groups import GroupsMixin
from app.repository.sql_sendlog import SendLogMixin
from app.repository.sql_templates import TemplatesMixin
from app.repository.sql_users import UsersMixin

__all__ = ["Base", "SqlRepository", "make_engine"]


def make_engine(database_url: str) -> Engine:
    if database_url.startswith("sqlite") and ":memory:" in database_url:
        return create_engine(
            database_url, connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
    if database_url.startswith("sqlite"):
        return create_engine(database_url, connect_args={"check_same_thread": False})
    return create_engine(database_url, pool_pre_ping=True)


class SqlRepository(UsersMixin, AudiencesMixin, GroupsMixin, TemplatesMixin, SendLogMixin):
    def __init__(self, engine: Engine) -> None:
        self._sessions = sessionmaker(engine, expire_on_commit=False)
