from sqlalchemy import case, func, select

from app.repository.base import (
    NewSend,
    SenderSummary,
    SendFilter,
    SendPage,
    SendRecord,
    SendStatus,
)
from app.repository.convert import as_utc, required_utc
from app.repository.models import SendLogRow


def to_record(row: SendLogRow) -> SendRecord:
    return SendRecord(
        id=row.id,
        sender_id=row.sender_id,
        sender_email=row.sender_email,
        sent_at=required_utc(row.sent_at),
        subject=row.subject,
        recipients=tuple(row.recipients),
        status=SendStatus(row.status),
        error_code=row.error_code,
        template_id=row.template_id,
    )


def _conditions(flt: SendFilter) -> list:
    conditions = []
    if flt.sender_id:
        conditions.append(SendLogRow.sender_id == flt.sender_id)
    if flt.date_from:
        conditions.append(SendLogRow.sent_at >= flt.date_from)
    if flt.date_to:
        conditions.append(SendLogRow.sent_at < flt.date_to)
    return conditions


class SendLogMixin:
    def record_send(self, new: NewSend) -> SendRecord:
        with self._sessions.begin() as session:
            row = SendLogRow(
                sender_id=new.sender_id,
                sender_email=new.sender_email,
                subject=new.subject,
                recipients=list(new.recipients),
                recipient_count=len(new.recipients),
                status=new.status.value,
                error_code=new.error_code,
                template_id=new.template_id,
            )
            session.add(row)
            session.flush()
            return to_record(row)

    def list_sends(self, page: int, limit: int, flt: SendFilter) -> SendPage:
        conditions = _conditions(flt)
        with self._sessions() as session:
            total = session.scalar(select(func.count()).select_from(SendLogRow).where(*conditions))
            rows = session.scalars(
                select(SendLogRow)
                .where(*conditions)
                .order_by(SendLogRow.sent_at.desc(), SendLogRow.id)
                .offset((page - 1) * limit)
                .limit(limit)
            ).all()
            return SendPage(items=tuple(to_record(r) for r in rows), total=total or 0)

    def summarize_senders(self, flt: SendFilter) -> tuple[SenderSummary, ...]:
        failed = func.sum(case((SendLogRow.status == SendStatus.FAILED.value, 1), else_=0))
        with self._sessions() as session:
            rows = session.execute(
                select(
                    SendLogRow.sender_id,
                    func.max(SendLogRow.sender_email),
                    func.count(),
                    func.sum(SendLogRow.recipient_count),
                    failed,
                    func.max(SendLogRow.sent_at),
                )
                .where(*_conditions(flt))
                .group_by(SendLogRow.sender_id)
                .order_by(func.max(SendLogRow.sent_at).desc())
            ).all()
            return tuple(
                SenderSummary(
                    sender_id=r[0],
                    sender_email=r[1],
                    messages=r[2],
                    recipients=int(r[3] or 0),
                    failed=int(r[4] or 0),
                    last_sent_at=as_utc(r[5]),
                )
                for r in rows
            )
